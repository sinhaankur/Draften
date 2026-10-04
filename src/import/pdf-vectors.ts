/**
 * PDF vector extraction — turn a page's drawing operators into REAL editable
 * nodes (rectangles, lines, paths), the way Sketch lets you edit every shape.
 *
 * pdf.js hands us a page as an operator list: a flat program of drawing commands
 * (`constructPath`, `setFillRGBColor`, `transform`, `save`/`restore`, …). We
 * replay it, tracking the current transform matrix (CTM), and emit a Draften node
 * per painted path. Coordinates are PDF user space (origin bottom-left); we apply
 * the CTM, then flip Y to the app's top-left space.
 *
 * This is deliberately pure of pdf.js imports except for the OPS code map passed
 * in — so the parser (the fiddly bit) is unit-testable with plain numbers.
 */

import type { Node, Paint, PathNode, RectangleNode, Stroke } from "../model/node";

/** 2×3 affine matrix [a, b, c, d, e, f] (pdf.js convention). */
export type Matrix = [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** Multiply two matrices (m1 then m2, pdf.js `Util.transform` order). */
export function mul(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}

/** Apply a matrix to a point. */
export function apply(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** One sub-path command in device space (already CTM-applied + Y-flipped). */
export interface Segment {
  op: "M" | "L" | "C" | "Q" | "Z";
  pts: number[]; // M/L: [x,y]; C: [x1,y1,x2,y2,x,y]; Q: [x1,y1,x,y]; Z: []
}

/**
 * Parse one pdf.js `constructPath` segment buffer into device-space segments.
 * The buffer is op-tagged: [op, ...coords, op, ...coords]:
 *   0 → moveTo (x,y) · 1 → lineTo (x,y) · 2 → curveTo (6) · 3 → quadratic (4)
 *   (bezier variants collapse to C/Q) · 4 → closePath (0)
 * `ctm` maps user space → device; `pageHeight` flips Y to top-left (0 = no flip,
 * e.g. when coords are already top-left).
 */
export function parseSegmentBuffer(buf: ArrayLike<number>, ctm: Matrix, pageHeight: number): Segment[] {
  const out: Segment[] = [];
  const pt = (x: number, y: number): [number, number] => {
    const [dx, dy] = apply(ctm, x, y);
    return [dx, pageHeight ? pageHeight - dy : dy];
  };
  let i = 0;
  const n = buf.length;
  while (i < n) {
    const op = buf[i++];
    switch (op) {
      case 0: { const [x, y] = pt(buf[i++], buf[i++]); out.push({ op: "M", pts: [x, y] }); break; }
      case 1: { const [x, y] = pt(buf[i++], buf[i++]); out.push({ op: "L", pts: [x, y] }); break; }
      case 2: {
        const [x1, y1] = pt(buf[i++], buf[i++]);
        const [x2, y2] = pt(buf[i++], buf[i++]);
        const [x, y] = pt(buf[i++], buf[i++]);
        out.push({ op: "C", pts: [x1, y1, x2, y2, x, y] });
        break;
      }
      case 3: {
        const [x1, y1] = pt(buf[i++], buf[i++]);
        const [x, y] = pt(buf[i++], buf[i++]);
        out.push({ op: "Q", pts: [x1, y1, x, y] });
        break;
      }
      case 4: out.push({ op: "Z", pts: [] }); break;
      default: i = n; break; // unknown tag → stop this buffer safely
    }
  }
  return out;
}

/** Segments → an SVG path `d` string (absolute commands). */
export function segmentsToPathD(segs: Segment[]): string {
  const r = (v: number) => Math.round(v * 100) / 100;
  return segs
    .map((s) => {
      switch (s.op) {
        case "M": return `M ${r(s.pts[0])} ${r(s.pts[1])}`;
        case "L": return `L ${r(s.pts[0])} ${r(s.pts[1])}`;
        case "C": return `C ${r(s.pts[0])} ${r(s.pts[1])} ${r(s.pts[2])} ${r(s.pts[3])} ${r(s.pts[4])} ${r(s.pts[5])}`;
        case "Q": return `Q ${r(s.pts[0])} ${r(s.pts[1])} ${r(s.pts[2])} ${r(s.pts[3])}`;
        case "Z": return "Z";
      }
    })
    .join(" ");
}

/** Axis-aligned bounds of a set of segments. */
export function segmentBounds(segs: Segment[]): { x: number; y: number; width: number; height: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of segs) {
    for (let k = 0; k < s.pts.length; k += 2) {
      const x = s.pts[k], y = s.pts[k + 1];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
  if (!Number.isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Is this just a closed axis-aligned rectangle? → emit the cleaner rect node. */
export function isRectangle(segs: Segment[]): boolean {
  const draw = segs.filter((s) => s.op !== "Z");
  if (draw.length !== 4 && draw.length !== 5) return false;
  if (draw[0].op !== "M") return false;
  if (!draw.slice(1).every((s) => s.op === "L")) return false;
  const xs = new Set(draw.map((s) => Math.round(s.pts[0])));
  const ys = new Set(draw.map((s) => Math.round(s.pts[1])));
  return xs.size === 2 && ys.size === 2; // only two distinct x's and y's
}

// ── operator-list walk → nodes ───────────────────────────────────────────────

/** The numeric OPS codes we care about (pass pdf.js's `OPS` in). */
export interface OpsMap {
  save: number; restore: number; transform: number;
  constructPath: number;
  fill: number; stroke: number; eoFill: number; fillStroke: number; eoFillStroke: number;
  setFillRGBColor: number; setStrokeRGBColor: number;
  setLineWidth: number;
}

export interface OperatorList { fnArray: number[]; argsArray: unknown[][]; }

interface GfxState { ctm: Matrix; fill: string; stroke: string; lineWidth: number }

/**
 * Replay an operator list into editable nodes. `baseCtm` is the viewport matrix
 * that maps user space → the page's pixel space (from `page.getViewport().transform`
 * when available); pass IDENTITY to keep user-space coords. `pageHeight` flips Y.
 * `mkId` lets the caller inject deterministic ids in tests.
 */
export function extractNodes(
  ol: OperatorList,
  OPS: OpsMap,
  opts: { baseCtm?: Matrix; pageHeight: number; parentId?: string; mkId?: () => string },
): Node[] {
  const mkId = opts.mkId ?? (() => crypto.randomUUID());
  const base = opts.baseCtm ?? IDENTITY;
  const stack: GfxState[] = [];
  let g: GfxState = { ctm: base, fill: "#000000", stroke: "#000000", lineWidth: 1 };
  const nodes: Node[] = [];

  const isFill = (op: number) => op === OPS.fill || op === OPS.eoFill || op === OPS.fillStroke || op === OPS.eoFillStroke;
  const isStroke = (op: number) => op === OPS.stroke || op === OPS.fillStroke || op === OPS.eoFillStroke;

  for (let i = 0; i < ol.fnArray.length; i++) {
    const fn = ol.fnArray[i];
    const args = ol.argsArray[i] as unknown[];

    if (fn === OPS.save) { stack.push({ ...g }); continue; }
    if (fn === OPS.restore) { if (stack.length) g = stack.pop()!; continue; }
    if (fn === OPS.transform) { g.ctm = mul(g.ctm, args as unknown as Matrix); continue; }
    if (fn === OPS.setFillRGBColor) { g.fill = String(args[0]); continue; }
    if (fn === OPS.setStrokeRGBColor) { g.stroke = String(args[0]); continue; }
    if (fn === OPS.setLineWidth) { g.lineWidth = Number(args[0]) || 1; continue; }

    if (fn === OPS.constructPath) {
      // v6: args = [paintOp, segmentBuffers[], minMax]. The paint op is baked in.
      const paintOp = args[0] as number;
      const buffers = args[1] as ArrayLike<number>[];
      const filled = isFill(paintOp);
      const stroked = isStroke(paintOp);
      if (!filled && !stroked) continue; // clip/no-paint → skip (we don't edit clips)

      const segs: Segment[] = [];
      for (const buf of buffers) segs.push(...parseSegmentBuffer(buf, g.ctm, opts.pageHeight));
      if (!segs.length) continue;
      const b = segmentBounds(segs);
      if (b.width < 0.5 && b.height < 0.5) continue; // degenerate

      const fills: Paint[] = filled ? [{ kind: "solid", color: g.fill }] : [{ kind: "none" }];
      const stroke: Stroke | undefined = stroked
        ? { paint: { kind: "solid", color: g.stroke }, width: scaleLineWidth(g.lineWidth, g.ctm) }
        : undefined;

      const id = mkId();
      if (isRectangle(segs)) {
        const rect: RectangleNode = {
          id, type: "rectangle", name: "Rectangle",
          frame: { x: b.x, y: b.y, width: b.width, height: b.height },
          fills, ...(stroke ? { stroke } : {}), parentId: opts.parentId,
        };
        nodes.push(rect);
      } else {
        const path: PathNode = {
          id, type: "path", name: "Path",
          frame: { x: b.x, y: b.y, width: Math.max(1, b.width), height: Math.max(1, b.height) },
          d: segmentsToPathD(segs), fills, ...(stroke ? { stroke } : {}), parentId: opts.parentId,
        };
        nodes.push(path);
      }
    }
  }
  return nodes;
}

/** Line width is in user space; scale it by the CTM's average axis scale. */
function scaleLineWidth(w: number, ctm: Matrix): number {
  const sx = Math.hypot(ctm[0], ctm[1]);
  const sy = Math.hypot(ctm[2], ctm[3]);
  return Math.max(0.25, w * ((sx + sy) / 2));
}
