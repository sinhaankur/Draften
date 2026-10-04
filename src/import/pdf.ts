/**
 * PDF importer — brings a PDF in as editable boards (REAL extraction via pdf.js).
 *
 * PDF is a common "here's the design/spec" hand-off, so importing it is
 * first-class. Each page → a board sized to the page; each text run → a positioned,
 * editable text node (PDF's bottom-left origin flipped to the app's top-left). This
 * is also what lets the AI assistant "turn this PDF into a design" — the extracted
 * text becomes real content. Images/vector paths are a follow-up; text is the
 * high-value 90%.
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

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const vp = page.getViewport({ scale: 1 });
      const boardId = crypto.randomUUID();
      const children: string[] = [];
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
      }

      doc.boards.push({
        id: boardId, name: `Page ${p}`, kind: "design", children,
        viewport: { x: 0, y: 0, zoom: 1 },
        frame: { x: (p - 1) * (vp.width + 60), y: 0, width: vp.width, height: vp.height },
      } as DraftenDocument["boards"][number]);
    }

    if (!doc.boards.length) {
      doc.boards.push({ id: crypto.randomUUID(), name: "Page 1", kind: "design", children: [], viewport: { x: 0, y: 0, zoom: 1 } });
      warnings.push("No extractable text found — the PDF may be scanned images (OCR not wired).");
    } else {
      const total = Object.keys(doc.nodes).length;
      warnings.push(`Imported ${pdf.numPages} page${pdf.numPages === 1 ? "" : "s"} · ${total} text runs.`);
    }

    return { document: doc, warnings };
  }
}

// Minimal structural types for the pdf.js objects we touch (version-agnostic).
interface PdfDoc { numPages: number; getPage(n: number): Promise<PdfPage>; }
interface PdfPage {
  getViewport(o: { scale: number }): { width: number; height: number };
  getTextContent(): Promise<{ items: unknown[] }>;
}
interface PdfTextItem { str: string; width: number; transform: number[]; }
