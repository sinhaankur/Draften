/**
 * @draften/pdf-vectors — round-trip PDF ⇄ editable vector/text document.
 *
 * Most PDF libraries give you either text or a flat raster. This one gives you
 * EDITABLE nodes (rectangles, paths, text, images) with fills, strokes, and
 * transforms — and writes them back to a real PDF. That's what lets an app be a
 * PDF *editor*, not just a viewer.
 *
 *   import { importPdf, exportPdf } from "@draften/pdf-vectors";
 *   const doc = await importPdf(bytes, pdfjs);   // → PDFDoc (edit doc.pages[].nodes)
 *   const out = exportPdf(doc);                  // → Uint8Array (a real PDF)
 *
 * pdf.js is a peer dependency: the caller passes the module in (version-free, and
 * the host controls the worker). © Ankur Sinha · MIT.
 */

export { importPdf, type ImportOptions, type PdfJsLike } from "./import";
export { exportPdf, pathDToPdf } from "./export";
export { extractNodes, type OpsMap, type OperatorList, type ImageResolver } from "./extract";
export { toHex, rgbHex, grayHex, cmykHex } from "./color";
export {
  IDENTITY, apply, mul, avgScale,
  parseSegmentBuffer, segmentsToPathD, segmentBounds, isRectangle,
  type Matrix, type Segment,
} from "./geometry";
export type {
  PDFDoc, PDFPage, PDFNode, RectNode, PathNode, TextNode, ImageNode,
  Paint, Stroke, Rect, PDFNodeType,
} from "./model";
