/**
 * extract — replay a pdf.js page operator list into neutral editable nodes.
 *
 * Tracks the graphics state (CTM, fill/stroke colour, line width, dash, alpha)
 * through save/restore/transform/setGState, and turns each painted path into a
 * rect/path node, each image-paint into an image node. Text is extracted
 * separately (from getTextContent) by the page reader. Pure except for the OPS
 * code map + optional image resolver the caller injects.
 */

import { toHex } from "./color";
import {
  IDENTITY, avgScale, isRectangle, mul, parseSegmentBuffer, segmentBounds,
  segmentsToPathD, type Matrix, type Segment,
} from "./geometry";
import type { ImageNode, PathNode, PDFNode, RectNode, Stroke } from "./model";

/** Numeric OPS codes we depend on (pass pdf.js's `OPS` through `opsMap`). */
export interface OpsMap {
  save: number; restore: number; transform: number;
  constructPath: number;
  fill: number; stroke: number; eoFill: number; fillStroke: number; eoFillStroke: number;
  setFillRGBColor: number; setStrokeRGBColor: number;
  setFillGray: number; setStrokeGray: number;
  setFillCMYKColor: number; setStrokeCMYKColor: number;
  setFillColorN: number; setStrokeColorN: number;
  setLineWidth: number; setDash: number; setGState: number;
  paintImageXObject: number; paintInlineImageXObject: number;
}

export interface OperatorList { fnArray: number[]; argsArray: unknown[][]; }

/** Resolve a pdf.js image XObject name to a PNG data URL (caller supplies it). */
export type ImageResolver = (name: string) => string | undefined;

interface GfxState {
  ctm: Matrix;
  fill: string; stroke: string;
  lineWidth: number;
  dash?: number[];
  fillAlpha: number; strokeAlpha: number;
}

export interface ExtractOptions {
  baseCtm?: Matrix;
  pageHeight: number;
  mkId?: () => string;
  resolveImage?: ImageResolver;
}

export function extractNodes(ol: OperatorList, OPS: OpsMap, opts: ExtractOptions): PDFNode[] {
  const mkId = opts.mkId ?? (() => cryptoId());
  const base = opts.baseCtm ?? IDENTITY;
  const stack: GfxState[] = [];
  let g: GfxState = { ctm: base, fill: "#000000", stroke: "#000000", lineWidth: 1, fillAlpha: 1, strokeAlpha: 1 };
  const nodes: PDFNode[] = [];

  const isFill = (op: number) => op === OPS.fill || op === OPS.eoFill || op === OPS.fillStroke || op === OPS.eoFillStroke;
  const isStroke = (op: number) => op === OPS.stroke || op === OPS.fillStroke || op === OPS.eoFillStroke;

  for (let i = 0; i < ol.fnArray.length; i++) {
    const fn = ol.fnArray[i];
    const args = (ol.argsArray[i] ?? []) as unknown[];

    switch (fn) {
      case OPS.save: stack.push({ ...g }); continue;
      case OPS.restore: if (stack.length) g = stack.pop()!; continue;
      case OPS.transform: g.ctm = mul(g.ctm, args as unknown as Matrix); continue;

      case OPS.setFillRGBColor: g.fill = toHex(args[0]); continue;
      case OPS.setStrokeRGBColor: g.stroke = toHex(args[0]); continue;
      case OPS.setFillGray: g.fill = toHex([Number(args[0])]); continue;
      case OPS.setStrokeGray: g.stroke = toHex([Number(args[0])]); continue;
      case OPS.setFillCMYKColor: g.fill = toHex((args as number[]).slice(0, 4)); continue;
      case OPS.setStrokeCMYKColor: g.stroke = toHex((args as number[]).slice(0, 4)); continue;
      case OPS.setFillColorN: { const c = colorN(args); if (c) g.fill = c; continue; }
      case OPS.setStrokeColorN: { const c = colorN(args); if (c) g.stroke = c; continue; }

      case OPS.setLineWidth: g.lineWidth = Number(args[0]) || 1; continue;
      case OPS.setDash: g.dash = Array.isArray(args[0]) && (args[0] as number[]).length ? (args[0] as number[]).slice() : undefined; continue;
      case OPS.setGState: applyGState(g, args[0]); continue;
      default: break;
    }

    // images
    if ((fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) && opts.resolveImage) {
      const name = String(args[0] ?? "");
      const src = opts.resolveImage(name);
      if (src) {
        // image XObjects draw into the unit square under the CTM; derive the frame.
        const [x0, y0] = applyPt(g.ctm, 0, 0, opts.pageHeight);
        const [x1, y1] = applyPt(g.ctm, 1, 1, opts.pageHeight);
        const node: ImageNode = {
          id: mkId(), type: "image",
          frame: { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) },
          src, ...(g.fillAlpha < 1 ? { opacity: g.fillAlpha } : {}),
        };
        if (node.frame.width > 0.5 && node.frame.height > 0.5) nodes.push(node);
      }
      continue;
    }

    if (fn === OPS.constructPath) {
      const paintOp = args[0] as number;
      const buffers = args[1] as ArrayLike<number>[];
      const filled = isFill(paintOp);
      const stroked = isStroke(paintOp);
      if (!filled && !stroked) continue;

      const segs: Segment[] = [];
      for (const buf of buffers) segs.push(...parseSegmentBuffer(buf, g.ctm, opts.pageHeight));
      if (!segs.length) continue;
      const b = segmentBounds(segs);
      if (b.width < 0.5 && b.height < 0.5) continue;

      const fill = filled
        ? { kind: "solid" as const, color: g.fill, ...(g.fillAlpha < 1 ? { opacity: g.fillAlpha } : {}) }
        : { kind: "none" as const };
      const stroke: Stroke | undefined = stroked
        ? { color: g.stroke, width: Math.max(0.25, g.lineWidth * avgScale(g.ctm)), ...(g.dash ? { dash: g.dash } : {}), ...(g.strokeAlpha < 1 ? { opacity: g.strokeAlpha } : {}) }
        : undefined;

      if (isRectangle(segs)) {
        const rect: RectNode = { id: mkId(), type: "rect", frame: b, fill, ...(stroke ? { stroke } : {}) };
        nodes.push(rect);
      } else {
        const path: PathNode = {
          id: mkId(), type: "path",
          frame: { x: b.x, y: b.y, width: Math.max(1, b.width), height: Math.max(1, b.height) },
          d: segmentsToPathD(segs), fill, ...(stroke ? { stroke } : {}),
        };
        nodes.push(path);
      }
    }
  }
  return nodes;
}

function applyPt(m: Matrix, x: number, y: number, pageHeight: number): [number, number] {
  const dx = m[0] * x + m[2] * y + m[4];
  const dy = m[1] * x + m[3] * y + m[5];
  return [dx, pageHeight ? pageHeight - dy : dy];
}

/** setGState sets an array of [key, value] pairs; we read alpha (ca/CA). */
function applyGState(g: GfxState, raw: unknown): void {
  if (!Array.isArray(raw)) return;
  for (const entry of raw as unknown[]) {
    if (!Array.isArray(entry)) continue;
    const [k, v] = entry as [string, unknown];
    if (k === "ca" && typeof v === "number") g.fillAlpha = v;
    else if (k === "CA" && typeof v === "number") g.strokeAlpha = v;
    else if (k === "LW" && typeof v === "number") g.lineWidth = v;
  }
}

/** setFillColorN/setStrokeColorN: a numeric component array (pattern names skipped). */
function colorN(args: unknown[]): string | undefined {
  const nums = args.filter((a) => typeof a === "number") as number[];
  if (!nums.length) return undefined;
  return toHex(nums);
}

function cryptoId(): string {
  try { return crypto.randomUUID(); } catch { return "n" + Math.random().toString(36).slice(2); }
}
