/**
 * PDF importer — brings a PDF in as editable artboards (REAL extraction via pdf.js).
 *
 * PDF is a common "here's the design/spec" hand-off, so importing it is
 * first-class. Each page becomes an ARTBOARD of REAL, EDITABLE nodes — the way
 * Sketch lets you edit every shape:
 *   1. VECTORS → editable rectangle / path nodes (fills, strokes, line widths)
 *      extracted from the page's drawing operators (`src/import/pdf-vectors.ts`);
 *   2. TEXT → editable text nodes with their real size/position (PDF's bottom-left
 *      origin flipped to the app's top-left).
 * All nodes are parented to the page board, so they group as one artboard and
 * carry the page's real background colour. Only when a page yields NO vectors and
 * NO text (a scanned/image-only PDF) do we fall back to rasterizing it to an image
 * so nothing is lost. In a headless/test env (no 2D canvas) the raster fallback is
 * skipped; vector + text extraction still runs.
 */

import { createEmptyDocument } from "../model/document";
import type { DraftenDocument } from "../model/document";
import { extractNodes, IDENTITY, type OperatorList, type OpsMap } from "./pdf-vectors";
import type { ImportInput, ImportResult, Importer } from "./importer";

export class PdfImporter implements Importer {
  id = "pdf";
  label = "PDF (.pdf)";
  extensions = [".pdf"];

  canImport(input: ImportInput): boolean {
    if (input.filename?.toLowerCase().endsWith(".pdf")) return true;
    // "%PDF-" magic
    const b = input.bytes;
    return (
      !!b &&
      b.length > 5 &&
      b[0] === 0x25 &&
      b[1] === 0x50 &&
      b[2] === 0x44 &&
      b[3] === 0x46 &&
      b[4] === 0x2d
    );
  }

  async import(input: ImportInput): Promise<ImportResult> {
    if (!input.bytes) throw new Error("PDF import needs file bytes");
    const name = input.filename?.replace(/\.pdf$/i, "") ?? "PDF import";
    const doc = createEmptyDocument(name);
    doc.boards = []; // replace the seeded pages with the PDF's real pages
    doc.nodes = {};
    doc.importedFrom = "native";
    const warnings: string[] = [];

    const pdfjs = await import("pdfjs-dist");
    // Worker setup is the #1 cause of "PDF won't open" in a packaged/static app.
    // The ONLY approach that works identically in the browser, the Tauri webview,
    // and Node is to load the worker SOURCE as text and run it from a Blob URL —
    // no external module path to resolve, no "fake worker" dynamic import to crash
    // on. We try that first; if even that isn't available (e.g. in a test env),
    // we set a `workerPort` so pdf.js never reaches its failing fallback path.
    const GWO = (pdfjs as unknown as { GlobalWorkerOptions: { workerSrc?: string; workerPort?: Worker | null } }).GlobalWorkerOptions;
    try {
      const src = (await import("pdfjs-dist/build/pdf.worker.min.mjs?raw")).default as string;
      GWO.workerSrc = URL.createObjectURL(new Blob([src], { type: "text/javascript" }));
    } catch {
      try {
        // bundled URL (Vite emits the worker as an asset) — works in the app
        GWO.workerSrc = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default as unknown as string;
      } catch { /* last resort handled by getDocument opts below */ }
    }

    const data = input.bytes instanceof Uint8Array ? input.bytes : new Uint8Array(input.bytes);
    const pdf = await (pdfjs as unknown as { getDocument: (o: Record<string, unknown>) => { promise: Promise<PdfDoc> } })
      .getDocument({ data, isEvalSupported: false, useSystemFonts: true }).promise;

    const OPS = (pdfjs as unknown as { OPS: Record<string, number> }).OPS;
    const opsMap = this.opsMap(OPS);
    const RASTER_SCALE = 2;
    let vectorCount = 0;
    let textRuns = 0;
    let scannedPages = 0;

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const vp = page.getViewport({ scale: 1 });
      const boardId = crypto.randomUUID();
      const children: string[] = [];
      const pageX = (p - 1) * (vp.width + 60);

      // 1) VECTORS → editable rectangle/path nodes from the drawing operators.
      //    Coords are PDF user space (bottom-left); flip Y with pageHeight so they
      //    share the text's top-left space. (identity CTM; viewport scale is 1.)
      let vectorNodesOnPage = 0;
      try {
        const ol = (await page.getOperatorList()) as unknown as OperatorList;
        const vectors = extractNodes(ol, opsMap, { baseCtm: IDENTITY, pageHeight: vp.height, parentId: boardId });
        for (const n of vectors) {
          doc.nodes[n.id] = n as DraftenDocument["nodes"][string];
          children.push(n.id);
        }
        vectorNodesOnPage = vectors.length;
        vectorCount += vectors.length;
      } catch { /* a page that won't decode shouldn't kill the import */ }

      // 2) Editable text, parented to the same board (so they group).
      let textOnPage = 0;
      const content = await page.getTextContent();
      for (const raw of content.items) {
        const it = raw as PdfTextItem;
        if (!("str" in it) || !it.str.trim()) continue;
        const x = it.transform[4];
        const fontSize = Math.abs(it.transform[3]) || 12;
        const y = vp.height - it.transform[5] - fontSize; // flip PDF bottom-left → top-left
        const id = crypto.randomUUID();
        doc.nodes[id] = {
          id, type: "text", name: it.str.slice(0, 40),
          frame: { x, y, width: it.width || it.str.length * fontSize * 0.5, height: fontSize * 1.3 },
          text: it.str,
          style: { fontFamily: "Inter", fontSize: Math.round(fontSize), fontWeight: 400, lineHeight: 1.3, align: "left" },
          parentId: boardId,
        } as DraftenDocument["nodes"][string];
        children.push(id);
        textOnPage++;
        textRuns++;
      }

      // 3) Scanned/image-only page (no vectors, no text) → raster fallback so
      //    nothing is lost. Skipped where no 2D canvas exists (tests).
      if (vectorNodesOnPage === 0 && textOnPage === 0) {
        const dataUrl = await this.renderPageToDataUrl(page, RASTER_SCALE);
        if (dataUrl) {
          const imgId = crypto.randomUUID();
          doc.nodes[imgId] = {
            id: imgId, type: "image", name: `Page ${p}`,
            frame: { x: 0, y: 0, width: vp.width, height: vp.height },
            src: dataUrl, fit: "fill", parentId: boardId,
          } as DraftenDocument["nodes"][string];
          children.push(imgId);
          scannedPages++;
        }
      }

      doc.boards.push({
        id: boardId, name: `Page ${p}`, kind: "design", children,
        viewport: { x: 0, y: 0, zoom: 1 },
        // artboard: page size + real background colour read from the page
        frame: { x: pageX, y: 0, width: vp.width, height: vp.height },
        background: await this.pageBackground(page),
      } as DraftenDocument["boards"][number]);
    }

    if (!doc.boards.length) {
      doc.boards.push({ id: crypto.randomUUID(), name: "Page 1", kind: "design", children: [], viewport: { x: 0, y: 0, zoom: 1 } });
      warnings.push("Nothing extractable found in this PDF.");
    } else {
      const pageWord = pdf.numPages === 1 ? "page" : "pages";
      const bits = [`Imported ${pdf.numPages} ${pageWord}`, `${vectorCount} editable shapes`, `${textRuns} editable text runs`];
      if (scannedPages) bits.push(`${scannedPages} scanned page(s) kept as image`);
      warnings.push(bits.join(" · ") + ".");
    }

    return { document: doc, warnings };
  }

  /** Map pdf.js's OPS enum to the subset the vector extractor needs. */
  private opsMap(OPS: Record<string, number>): OpsMap {
    return {
      save: OPS.save, restore: OPS.restore, transform: OPS.transform,
      constructPath: OPS.constructPath,
      fill: OPS.fill, stroke: OPS.stroke, eoFill: OPS.eoFill, fillStroke: OPS.fillStroke, eoFillStroke: OPS.eoFillStroke,
      setFillRGBColor: OPS.setFillRGBColor, setStrokeRGBColor: OPS.setStrokeRGBColor,
      setLineWidth: OPS.setLineWidth,
    };
  }

  /**
   * Render a PDF page to a PNG data URL via pdf.js's canvas renderer. Returns
   * `undefined` when no 2D canvas is available (jsdom/node tests) so import still
   * succeeds as text-only rather than throwing.
   */
  private async renderPageToDataUrl(page: PdfPage, scale: number): Promise<string | undefined> {
    const canvas = this.makeCanvas();
    if (!canvas) return undefined;
    const vp = page.getViewport({ scale });
    canvas.width = Math.max(1, Math.ceil(vp.width));
    canvas.height = Math.max(1, Math.ceil(vp.height));
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | null;
    if (!ctx) return undefined;
    try {
      // pdf.js v6: pass the `canvas` directly (the `canvasContext`-only form is a
      // deprecated back-compat path). An OffscreenCanvas has no element to pass,
      // so fall back to the context form (with canvas: null) for that case.
      const isOffscreen = typeof OffscreenCanvas !== "undefined" && canvas instanceof OffscreenCanvas;
      const params = isOffscreen
        ? { canvas: null, canvasContext: ctx, viewport: vp }
        : { canvas: canvas as HTMLCanvasElement, viewport: vp };
      await page.render(params).promise;
      // OffscreenCanvas uses convertToBlob; HTMLCanvasElement uses toDataURL.
      if (typeof (canvas as HTMLCanvasElement).toDataURL === "function") {
        return (canvas as HTMLCanvasElement).toDataURL("image/png");
      }
      const blob = await (canvas as OffscreenCanvas).convertToBlob({ type: "image/png" });
      return await this.blobToDataUrl(blob);
    } catch {
      return undefined; // a page that won't raster shouldn't kill the import
    }
  }

  /** A drawable canvas in the browser/Tauri webview, or undefined in tests. */
  private makeCanvas(): HTMLCanvasElement | OffscreenCanvas | undefined {
    if (typeof document !== "undefined" && typeof document.createElement === "function") {
      const c = document.createElement("canvas");
      if (c && typeof c.getContext === "function") return c;
    }
    if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(1, 1);
    return undefined;
  }

  private blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(blob);
    });
  }

  /** The page's paper colour, if the PDF declares one; default white. */
  private async pageBackground(page: PdfPage): Promise<string> {
    try {
      // pdf.js exposes the page background via the viewport; most PDFs are white.
      const bg = (page as unknown as { _pageInfo?: { background?: string } })._pageInfo?.background;
      return typeof bg === "string" ? bg : "#ffffff";
    } catch {
      return "#ffffff";
    }
  }
}

// Minimal structural types for the pdf.js objects we touch (version-agnostic).
interface PdfDoc { numPages: number; getPage(n: number): Promise<PdfPage>; }
interface PdfViewport { width: number; height: number }
interface PdfPage {
  getViewport(o: { scale: number }): PdfViewport;
  getTextContent(): Promise<{ items: unknown[] }>;
  getOperatorList(): Promise<{ fnArray: number[]; argsArray: unknown[][] }>;
  render(o: { canvas?: HTMLCanvasElement | null; canvasContext?: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D; viewport: PdfViewport }): { promise: Promise<void> };
}
interface PdfTextItem { str: string; width: number; transform: number[]; }
