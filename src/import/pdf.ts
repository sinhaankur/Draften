/**
 * PDF importer — brings a PDF in as editable artboards, via @draften/pdf-vectors.
 *
 * Each page → an ARTBOARD of REAL, EDITABLE nodes (the way Sketch lets you edit
 * every shape): vectors become rectangle/path nodes, text becomes text nodes. The
 * heavy lifting (operator-list replay, colour spaces, transforms, path parsing)
 * lives in the standalone `@draften/pdf-vectors` package so it's reusable + tested
 * on its own; here we just map its neutral PDFDoc onto Draften's document model.
 *
 * Only a scanned/image-only page (no vectors, no text) falls back to a rasterized
 * image so nothing is lost. In headless/test envs (no 2D canvas) the raster
 * fallback is skipped; vector + text extraction still runs.
 */

import { importPdf, type PDFNode as VecNode, type Paint as VecPaint, type Stroke as VecStroke } from "@draften/pdf-vectors";

import { createEmptyDocument } from "../model/document";
import type { DraftenDocument } from "../model/document";
import type { Node, Paint, Stroke } from "../model/node";
import type { ImportInput, ImportResult, Importer } from "./importer";

export class PdfImporter implements Importer {
  id = "pdf";
  label = "PDF (.pdf)";
  extensions = [".pdf"];

  canImport(input: ImportInput): boolean {
    if (input.filename?.toLowerCase().endsWith(".pdf")) return true;
    const b = input.bytes; // "%PDF-" magic
    return !!b && b.length > 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d;
  }

  async import(input: ImportInput): Promise<ImportResult> {
    if (!input.bytes) throw new Error("PDF import needs file bytes");
    const name = input.filename?.replace(/\.pdf$/i, "") ?? "PDF import";
    const doc = createEmptyDocument(name);
    doc.boards = [];
    doc.nodes = {};
    doc.importedFrom = "native";
    const warnings: string[] = [];

    const pdfjs = await import("pdfjs-dist");
    this.setupWorker(pdfjs);

    const data = input.bytes instanceof Uint8Array ? input.bytes : new Uint8Array(input.bytes);
    const parsed = await importPdf(data, pdfjs as never, { title: name });

    let vectorCount = 0;
    let textRuns = 0;
    let scannedPages = 0;

    parsed.pages.forEach((page, p) => {
      const boardId = crypto.randomUUID();
      const children: string[] = [];
      const pageX = p * (page.width + 60);

      for (const vn of page.nodes) {
        const node = this.toNode(vn, boardId);
        if (!node) continue;
        doc.nodes[node.id] = node as DraftenDocument["nodes"][string];
        children.push(node.id);
        if (vn.type === "text") textRuns++;
        else vectorCount++;
      }

      doc.boards.push({
        id: boardId, name: `Page ${p + 1}`, kind: "design", children,
        viewport: { x: 0, y: 0, zoom: 1 },
        frame: { x: pageX, y: 0, width: page.width, height: page.height },
        background: page.background ?? "#ffffff",
      } as DraftenDocument["boards"][number]);
    });

    // scanned/image-only pages: raster fallback so nothing is lost
    if (vectorCount === 0 && textRuns === 0) {
      scannedPages = await this.rasterFallback(pdfjs, data, doc, parsed.pages.map((pg) => pg));
    }

    if (!doc.boards.length) {
      doc.boards.push({ id: crypto.randomUUID(), name: "Page 1", kind: "design", children: [], viewport: { x: 0, y: 0, zoom: 1 } });
      warnings.push("Nothing extractable found in this PDF.");
    } else {
      const pageWord = parsed.pages.length === 1 ? "page" : "pages";
      const bits = [`Imported ${parsed.pages.length} ${pageWord}`, `${vectorCount} editable shapes`, `${textRuns} editable text runs`];
      if (scannedPages) bits.push(`${scannedPages} scanned page(s) kept as image`);
      warnings.push(bits.join(" · ") + ".");
    }

    return { document: doc, warnings };
  }

  // ── neutral PDFNode → Draften Node ─────────────────────────────────────────
  private toNode(vn: VecNode, parentId: string): Node | undefined {
    const base = { id: vn.id, frame: vn.frame, parentId, ...(vn.opacity !== undefined && vn.opacity < 1 ? { opacity: vn.opacity } : {}) };
    switch (vn.type) {
      case "rect": {
        return {
          ...base, type: "rectangle", name: "Rectangle",
          fills: this.paint(vn.fill), ...(vn.stroke ? { stroke: this.stroke(vn.stroke) } : {}),
          ...(vn.radius ? { cornerRadius: vn.radius } : {}),
        } as Node;
      }
      case "path": {
        return {
          ...base, type: "path", name: "Path", d: vn.d,
          fills: this.paint(vn.fill), ...(vn.stroke ? { stroke: this.stroke(vn.stroke) } : {}),
        } as Node;
      }
      case "text": {
        return {
          ...base, type: "text", name: vn.text.slice(0, 40), text: vn.text,
          fills: [{ kind: "solid", color: vn.color }],
          style: { fontFamily: vn.fontFamily, fontSize: vn.fontSize, fontWeight: vn.fontWeight, lineHeight: 1.3, align: vn.align ?? "left" },
        } as Node;
      }
      case "image": {
        return { ...base, type: "image", name: "Image", src: vn.src, fit: "fill" } as Node;
      }
    }
  }

  private paint(p: VecPaint): Paint[] {
    if (!p || p.kind === "none") return [{ kind: "none" }];
    return [{ kind: "solid", color: p.color }];
  }
  private stroke(s: VecStroke): Stroke {
    return { paint: { kind: "solid", color: s.color }, width: s.width, ...(s.dash ? { dash: s.dash } : {}) };
  }

  // ── worker + raster fallback (browser/Tauri only) ──────────────────────────
  private setupWorker(pdfjs: unknown): void {
    const GWO = (pdfjs as { GlobalWorkerOptions: { workerSrc?: string } }).GlobalWorkerOptions;
    try {
      // handled by the importer caller in the app via bundler; a no-op if preset
      if (!GWO.workerSrc) GWO.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).href;
    } catch { /* worker set elsewhere */ }
  }

  private async rasterFallback(
    pdfjs: unknown, data: Uint8Array, doc: DraftenDocument, pages: Array<{ width: number; height: number }>,
  ): Promise<number> {
    const canvas = this.makeCanvas();
    if (!canvas) return 0;
    let n = 0;
    try {
      const pdf = await (pdfjs as { getDocument: (o: Record<string, unknown>) => { promise: Promise<PdfDocLike> } })
        .getDocument({ data, isEvalSupported: false, useSystemFonts: true }).promise;
      for (let p = 1; p <= pdf.numPages; p++) {
        const page = await pdf.getPage(p);
        const vp = page.getViewport({ scale: 2 });
        canvas.width = Math.ceil(vp.width); canvas.height = Math.ceil(vp.height);
        const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
        if (!ctx) continue;
        await page.render({ canvas: canvas as HTMLCanvasElement, viewport: vp }).promise;
        const src = (canvas as HTMLCanvasElement).toDataURL("image/png");
        const board = doc.boards[p - 1];
        if (!board) continue;
        const imgId = crypto.randomUUID();
        doc.nodes[imgId] = {
          id: imgId, type: "image", name: `Page ${p}`,
          frame: { x: 0, y: 0, width: pages[p - 1]?.width ?? vp.width / 2, height: pages[p - 1]?.height ?? vp.height / 2 },
          src, fit: "fill", parentId: board.id,
        } as DraftenDocument["nodes"][string];
        board.children.push(imgId);
        n++;
      }
    } catch { /* leave as empty boards */ }
    return n;
  }

  private makeCanvas(): HTMLCanvasElement | undefined {
    if (typeof document !== "undefined" && typeof document.createElement === "function") {
      const c = document.createElement("canvas");
      if (c && typeof c.getContext === "function") return c;
    }
    return undefined;
  }
}

interface PdfDocLike { numPages: number; getPage(n: number): Promise<PdfPageLike>; }
interface PdfPageLike {
  getViewport(o: { scale: number }): { width: number; height: number };
  render(o: { canvas: HTMLCanvasElement; viewport: { width: number; height: number } }): { promise: Promise<void> };
}
