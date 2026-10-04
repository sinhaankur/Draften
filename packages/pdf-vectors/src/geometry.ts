/**
 * Geometry — affine matrices + path-segment parsing for PDF operator lists.
 * Pure numbers only, so the fiddly bits are unit-testable without pdf.js.
 */

/** 2×3 affine matrix [a, b, c, d, e, f] (pdf.js convention). */
export type Matrix = [number, number, number, number, number, number];

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

/** Compose m1 then m2 (pdf.js `Util.transform` order). */
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

/** The average axis scale of a matrix (for scaling line widths). */
export function avgScale(m: Matrix): number {
  return (Math.hypot(m[0], m[1]) + Math.hypot(m[2], m[3])) / 2;
}

export interface Segment {
  op: "M" | "L" | "C" | "Q" | "Z";
  pts: number[];
}

/**
 * Parse one pdf.js `constructPath` segment buffer into device-space segments.
 * Op-tagged buffer: 0=moveTo(2) 1=lineTo(2) 2=curveTo(6) 3=quadratic(4) 4=close(0).
 * `ctm` maps user→device; `pageHeight` flips Y to top-left (0 = no flip).
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
      default: i = n; break;
    }
  }
  return out;
}

/** Segments → an absolute SVG path `d` string. */
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

/** Is this just a closed axis-aligned rectangle? */
export function isRectangle(segs: Segment[]): boolean {
  const draw = segs.filter((s) => s.op !== "Z");
  if (draw.length !== 4 && draw.length !== 5) return false;
  if (draw[0].op !== "M") return false;
  if (!draw.slice(1).every((s) => s.op === "L")) return false;
  const xs = new Set(draw.map((s) => Math.round(s.pts[0])));
  const ys = new Set(draw.map((s) => Math.round(s.pts[1])));
  return xs.size === 2 && ys.size === 2;
}
