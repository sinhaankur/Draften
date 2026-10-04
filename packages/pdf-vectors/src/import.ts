/**
 * importPdf — the package entry point. PDF bytes + a pdf.js module → a neutral
 * PDFDoc of editable rect/path/text/image nodes.
 *
 * pdf.js is a PEER dependency the caller passes in (so we never pin a version and
 * the host app controls the worker). We only touch the small surface declared in
 * the structural types below.
 */

import { extractNodes, type OperatorList, type OpsMap } from "./extract";
import { IDENTITY } from "./geometry";
import type { PDFDoc, PDFNode, PDFPage, TextNode } from "./model";

export interface PdfJsLike {
  OPS: Record<string, number>;
  getDocument(opts: Record<string, unknown>): { promise: Promise<PdfDocLike> };
}
interface PdfDocLike { numPages: number; getPage(n: number): Promise<PdfPageLike>; }
interface PdfViewport { width: number; height: number }
interface PdfPageLike {
  getViewport(o: { scale: number }): PdfViewport;
  getTextContent(): Promise<{ items: unknown[] }>;
  getOperatorList(): Promise<OperatorList>;
  objs?: { get(name: string): unknown };
  commonObjs?: { get(name: string): unknown };
}
interface PdfTextItem { str: string; width: number; transform: number[]; fontName?: string }

export interface ImportOptions {
  title?: string;
  /** turn an image XObject into a PNG data URL (host provides canvas). Optional. */
  resolveImage?: (page: PdfPageLike, name: string) => string | undefined;
}

export async function importPdf(bytes: Uint8Array, pdfjs: PdfJsLike, opts: ImportOptions = {}): Promise<PDFDoc> {
  const pdf = await pdfjs.getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: true }).promise;
  const opsMap = toOpsMap(pdfjs.OPS);
  const pages: PDFPage[] = [];

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const nodes: PDFNode[] = [];

    // vectors + images
    try {
      const ol = await page.getOperatorList();
      const resolve = opts.resolveImage ? (name: string) => opts.resolveImage!(page, name) : undefined;
      nodes.push(...extractNodes(ol, opsMap, { baseCtm: IDENTITY, pageHeight: vp.height, resolveImage: resolve }));
    } catch { /* skip undecodable page graphics */ }

    // text
    const content = await page.getTextContent();
    for (const raw of content.items) {
      const it = raw as PdfTextItem;
      if (!("str" in it) || !it.str.trim()) continue;
      const x = it.transform[4];
      const fontSize = Math.abs(it.transform[3]) || 12;
      const y = vp.height - it.transform[5] - fontSize;
      const node: TextNode = {
        id: id(), type: "text",
        frame: { x, y, width: it.width || it.str.length * fontSize * 0.5, height: fontSize * 1.3 },
        text: it.str, fontSize: Math.round(fontSize), fontFamily: familyOf(it.fontName), fontWeight: weightOf(it.fontName),
        color: "#000000", align: "left",
      };
      nodes.push(node);
    }

    pages.push({ width: vp.width, height: vp.height, background: "#ffffff", nodes });
  }

  return { pages, title: opts.title };
}

function toOpsMap(OPS: Record<string, number>): OpsMap {
  return {
    save: OPS.save, restore: OPS.restore, transform: OPS.transform,
    constructPath: OPS.constructPath,
    fill: OPS.fill, stroke: OPS.stroke, eoFill: OPS.eoFill, fillStroke: OPS.fillStroke, eoFillStroke: OPS.eoFillStroke,
    setFillRGBColor: OPS.setFillRGBColor, setStrokeRGBColor: OPS.setStrokeRGBColor,
    setFillGray: OPS.setFillGray, setStrokeGray: OPS.setStrokeGray,
    setFillCMYKColor: OPS.setFillCMYKColor, setStrokeCMYKColor: OPS.setStrokeCMYKColor,
    setFillColorN: OPS.setFillColorN, setStrokeColorN: OPS.setStrokeColorN,
    setLineWidth: OPS.setLineWidth, setDash: OPS.setDash, setGState: OPS.setGState,
    paintImageXObject: OPS.paintImageXObject, paintInlineImageXObject: OPS.paintInlineImageXObject,
  };
}

/** pdf.js font names look like "g_d0_f1" or embedded PostScript names. */
function familyOf(fontName?: string): string {
  if (!fontName) return "Helvetica";
  const m = /([A-Za-z]+)(?:-|$)/.exec(fontName.replace(/^[a-z]_[a-z0-9]+_/, ""));
  return m ? m[1] : "Helvetica";
}
function weightOf(fontName?: string): number {
  const n = (fontName ?? "").toLowerCase();
  if (n.includes("bold")) return 700;
  if (n.includes("light")) return 300;
  if (n.includes("medium")) return 500;
  return 400;
}

function id(): string {
  try { return crypto.randomUUID(); } catch { return "t" + Math.random().toString(36).slice(2); }
}
