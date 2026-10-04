/**
 * pdf-vectors — the neutral document model.
 *
 * Deliberately independent of any app (Draften, Excalidraw, React). A PDF comes
 * in and a PDF goes out through THIS shape, so the package round-trips on its own
 * and any consumer can map it to their own scene graph. Coordinates are top-left
 * origin, points (1/72"), matching the app canvas convention.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A paint: solid colour (hex), or none. Gradients/patterns approximate to solid. */
export type Paint =
  | { kind: "solid"; color: string; opacity?: number }
  | { kind: "none" };

export interface Stroke {
  color: string;
  width: number;
  /** on/off dash pattern in points, if the PDF set one */
  dash?: number[];
  opacity?: number;
}

export type PDFNodeType = "rect" | "path" | "text" | "image";

interface BaseNode {
  id: string;
  type: PDFNodeType;
  frame: Rect;
  /** 0..1, multiplies into paints; 1 when absent */
  opacity?: number;
}

export interface RectNode extends BaseNode {
  type: "rect";
  fill: Paint;
  stroke?: Stroke;
  /** corner radius in points (0 = sharp) */
  radius?: number;
}

export interface PathNode extends BaseNode {
  type: "path";
  /** absolute SVG path data in page (top-left) space */
  d: string;
  fill: Paint;
  stroke?: Stroke;
}

export interface TextNode extends BaseNode {
  type: "text";
  text: string;
  fontSize: number;
  /** PostScript-ish family name; the exporter maps to a standard-14 font */
  fontFamily: string;
  fontWeight: number;
  color: string;
  align?: "left" | "center" | "right";
}

export interface ImageNode extends BaseNode {
  type: "image";
  /** a data: URL (PNG) for the embedded raster */
  src: string;
}

export type PDFNode = RectNode | PathNode | TextNode | ImageNode;

export interface PDFPage {
  /** page size in points */
  width: number;
  height: number;
  /** page paper colour; default white */
  background?: string;
  nodes: PDFNode[];
}

export interface PDFDoc {
  /** 0+ pages, each a flat list of absolute-positioned nodes */
  pages: PDFPage[];
  /** optional title (for the exporter's /Info) */
  title?: string;
}
