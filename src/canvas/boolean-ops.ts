/**
 * boolean-ops — real vector boolean operations (Union · Subtract · Intersect ·
 * Exclude), the Sketch/Figma "combine shapes" feature.
 *
 * WHY this file exists: Excalidraw (our canvas engine) has shapes but NO boolean
 * path engine — you can draw a rectangle and an ellipse, but you can't combine
 * them into one path. That is a core Sketch/Figma capability, so we add it:
 *
 *   1. turn each selected element into a polygon ring (real geometry):
 *        rectangle → its 4 corners (rotation-aware)
 *        diamond   → its 4 edge midpoints
 *        ellipse   → sampled around the arc (64 segments)
 *        line / freedraw / polygon → its own points
 *   2. run the boolean op with `polygon-clipping` (MIT, battle-tested, the same
 *      Martinez algorithm Figma-class tools use), top shape(s) against the rest
 *   3. emit the result as closed Excalidraw `line` layer(s) with absolute points,
 *      inheriting the fill/stroke of the bottom shape — so it stays fully editable.
 *
 * The result is a genuine vector path, not a raster — crisp at any zoom, and you
 * can keep nudging its points. This is "vector management" done right.
 */
import polygonClipping, { type Geom, type Polygon, type Ring } from "polygon-clipping";

/** Minimal shape of the Excalidraw elements we read. */
export type GeomEl = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle?: number;
  points?: readonly (readonly [number, number])[];
  backgroundColor?: string;
  strokeColor?: string;
  fillStyle?: string;
  strokeWidth?: number;
  roughness?: number;
  isDeleted?: boolean;
};

export type BoolOp = "union" | "subtract" | "intersect" | "exclude";

const TWO_PI = Math.PI * 2;

/** Rotate point (px,py) around centre (cx,cy) by angle (radians). */
function rot(px: number, py: number, cx: number, cy: number, a: number): [number, number] {
  if (!a) return [px, py];
  const s = Math.sin(a), c = Math.cos(a);
  const dx = px - cx, dy = py - cy;
  return [cx + dx * c - dy * s, cy + dx * s + dy * c];
}

/** Convert one element into an absolute-coordinate polygon ring (closed). */
export function elementToRing(e: GeomEl): [number, number][] {
  const { x, y, width: w, height: h } = e;
  const cx = x + w / 2, cy = y + h / 2, a = e.angle || 0;
  const r = (px: number, py: number) => rot(px, py, cx, cy, a);

  if (e.type === "ellipse") {
    const seg = 64, pts: [number, number][] = [];
    const rx = w / 2, ry = h / 2;
    for (let i = 0; i < seg; i++) {
      const t = (i / seg) * TWO_PI;
      pts.push(r(cx + Math.cos(t) * rx, cy + Math.sin(t) * ry));
    }
    return pts;
  }

  if (e.type === "diamond") {
    return [r(cx, y), r(x + w, cy), r(cx, y + h), r(x, cy)];
  }

  // line / freedraw / polygon / arrow → use its own points (relative to x,y)
  if (e.points && e.points.length >= 2) {
    const pts = e.points.map(([dx, dy]) => r(x + dx, y + dy));
    return pts as [number, number][];
  }

  // rectangle (and any boxy default) → 4 corners
  return [r(x, y), r(x + w, y), r(x + w, y + h), r(x, y + h)];
}

/** A closed, de-duplicated ring with at least a triangle's worth of points. */
function cleanRing(ring: [number, number][]): Ring | null {
  const out: [number, number][] = [];
  for (const p of ring) {
    const last = out[out.length - 1];
    if (!last || Math.abs(last[0] - p[0]) > 1e-6 || Math.abs(last[1] - p[1]) > 1e-6) out.push(p);
  }
  if (out.length < 3) return null;
  const first = out[0], last = out[out.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) out.push([first[0], first[1]]);
  return out as unknown as Ring;
}

function elToGeom(e: GeomEl): Geom | null {
  const ring = cleanRing(elementToRing(e));
  return ring ? [[ring]] as Geom : null;
}

export type BoolResult = {
  /** one or more result paths, each a list of absolute points (first = outer ring) */
  paths: [number, number][][];
  /** the source element whose style the result inherits */
  styleFrom: GeomEl;
};

/**
 * Combine the selected elements with a boolean op. `order` is z-order top→bottom
 * (last selected is usually on top in Excalidraw; we treat the FIRST element as
 * the base for subtract/intersect so behaviour matches Sketch "the bottom shape
 * is the base"). Returns result paths or null if the op produced nothing.
 */
export function booleanCombine(els: GeomEl[], op: BoolOp): BoolResult | null {
  const geoms = els.map(elToGeom).filter((g): g is Geom => !!g);
  if (geoms.length < 2) return null;

  const [base, ...rest] = geoms;
  let result: ReturnType<typeof polygonClipping.union>;
  try {
    if (op === "union") result = polygonClipping.union(base, ...rest);
    else if (op === "subtract") result = polygonClipping.difference(base, ...rest);
    else if (op === "intersect") result = polygonClipping.intersection(base, ...rest);
    else result = polygonClipping.xor(base, ...rest); // exclude
  } catch {
    return null;
  }

  // MultiPolygon → flatten to a list of outer rings (we drop holes for now; a
  // single outer path per polygon keeps it an editable Excalidraw line).
  const paths: [number, number][][] = [];
  for (const poly of result as Polygon[]) {
    const outer = poly[0];
    if (outer && outer.length >= 4) paths.push(outer.map(([px, py]) => [px, py] as [number, number]));
  }
  if (paths.length === 0) return null;

  return { paths, styleFrom: els[0] };
}

/**
 * Turn a result path (absolute points) into the params for an Excalidraw `line`
 * skeleton: a local origin + points relative to it + inherited style.
 */
export function pathToLineSkeleton(path: [number, number][], style: GeomEl, name: string) {
  const minX = Math.min(...path.map((p) => p[0]));
  const minY = Math.min(...path.map((p) => p[1]));
  const pts = path.map(([px, py]) => [px - minX, py - minY] as [number, number]);
  return {
    type: "line" as const,
    x: minX,
    y: minY,
    points: pts,
    backgroundColor: style.backgroundColor && style.backgroundColor !== "transparent" ? style.backgroundColor : "#3d6b5f",
    strokeColor: style.strokeColor || "#1d1d1b",
    fillStyle: (style.fillStyle as "solid" | "hachure" | "cross-hatch") || "solid",
    strokeWidth: style.strokeWidth ?? 1,
    roughness: style.roughness ?? 0,
    customData: { name },
  };
}
