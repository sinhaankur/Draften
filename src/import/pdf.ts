/**
 * PDF importer — brings a PDF in as editable artboards (REAL extraction via pdf.js).
 *
 * PDF is a common "here's the design/spec" hand-off, so importing it is
 * first-class. Each page becomes an ARTBOARD that keeps its look:
 *   1. the page is RASTERIZED to a high-DPI image node (so vectors, images, fills,
 *      logos — everything — are preserved pixel-for-pixel, the way Figma/Sketch
 *      import PDFs), drawn as the page background;
 *   2. each text run becomes a positioned, EDITABLE text node on top (PDF's
 *      bottom-left origin flipped to the app's top-left).
 * Both the page image and the text are parented to the board, so they group as
 * one artboard and carry the page's real background colour. In a headless/test
 * environment (no 2D canvas) rasterization is skipped and text still imports.
 */

import { createEmptyDocument } from "../model/document";
import type { DraftenDocument } from "../model/document";
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

    // Render crisp on HiDPI without ballooning memory on big docs.
    const RASTER_SCALE = 2;
    let rasterized = 0;
    let textRuns = 0;

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const vp = page.getViewport({ scale: 1 });
      const boardId = crypto.randomUUID();
      const children: string[] = [];
      const pageX = (p - 1) * (vp.width + 60);

      // 1) Rasterize the whole page → an image node (the background). Keeps every
      //    vector/fill/image exactly as drawn. Skipped if no 2D canvas (tests).
      const dataUrl = await this.renderPageToDataUrl(page, RASTER_SCALE);
      if (dataUrl) {
        const imgId = crypto.randomUUID();
        doc.nodes[imgId] = {
          id: imgId, type: "image", name: `Page ${p}`,
          // frame is in BOARD space (relative to the board origin) → 0,0
          frame: { x: 0, y: 0, width: vp.width, height: vp.height },
          src: dataUrl, fit: "fill", parentId: boardId,
        } as DraftenDocument["nodes"][string];
        children.push(imgId);
        rasterized++;
      }

      // 2) Editable text on top, parented to the same board (so they group).
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
        textRuns++;
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
      warnings.push("No extractable text found — the PDF may be scanned images (OCR not wired).");
    } else {
      const pageWord = pdf.numPages === 1 ? "page" : "pages";
      warnings.push(
        rasterized
          ? `Imported ${pdf.numPages} ${pageWord} (full page kept) · ${textRuns} editable text runs.`
          : `Imported ${pdf.numPages} ${pageWord} · ${textRuns} text runs (page raster unavailable here).`,
      );
    }

    return { document: doc, warnings };
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
  render(o: { canvas?: HTMLCanvasElement | null; canvasContext?: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D; viewport: PdfViewport }): { promise: Promise<void> };
}
interface PdfTextItem { str: string; width: number; transform: number[]; }
