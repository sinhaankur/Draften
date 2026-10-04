/**
 * measure — pure geometry for the spacing tools.
 *
 * Figma/Sketch show the pixel gap between two elements (and to the artboard
 * edges) when you hold Alt/Option, and can auto-space a selection evenly. The
 * fiddly part is the geometry; keeping it pure makes it testable and reusable by
 * both the measurement OVERLAY and the auto-spacing ACTION.
 */

export interface Box { x: number; y: number; width: number; height: number }

export const right = (b: Box) => b.x + b.width;
export const bottom = (b: Box) => b.y + b.height;
export const cx = (b: Box) => b.x + b.width / 2;
export const cy = (b: Box) => b.y + b.height / 2;

/** Do two boxes overlap on the X axis? (their vertical spans intersect) */
export function overlapsX(a: Box, b: Box): boolean {
  return a.x < right(b) && right(a) > b.x;
}
export function overlapsY(a: Box, b: Box): boolean {
  return a.y < bottom(b) && bottom(a) > b.y;
}

export interface Gap {
  /** horizontal gap in px (0 if they overlap/touch horizontally) */
  dx: number;
  /** vertical gap in px */
  dy: number;
  /** the dominant axis to label ("x" = side-by-side, "y" = stacked) */
  axis: "x" | "y";
}

/**
 * The gap between two boxes. If they sit side-by-side (vertical spans overlap),
 * the meaningful measure is the horizontal gap; if stacked, the vertical gap.
 * Negative raw gaps (overlap) are clamped to 0.
 */
export function rectGap(a: Box, b: Box): Gap {
  const horizontal = b.x >= right(a) ? b.x - right(a) : a.x >= right(b) ? a.x - right(b) : 0;
  const vertical = b.y >= bottom(a) ? b.y - bottom(a) : a.y >= bottom(b) ? a.y - bottom(b) : 0;
  // side-by-side (share a horizontal band) → label the horizontal gap, else vertical
  const axis: "x" | "y" = overlapsY(a, b) ? "x" : overlapsX(a, b) ? "y" : (horizontal >= vertical ? "x" : "y");
  return { dx: Math.max(0, Math.round(horizontal)), dy: Math.max(0, Math.round(vertical)), axis };
}

export interface EdgeDistances { top: number; right: number; bottom: number; left: number }

/** Distances from an element's edges to its containing frame's inner edges. */
export function edgeDistances(el: Box, frame: Box): EdgeDistances {
  return {
    left: Math.round(el.x - frame.x),
    top: Math.round(el.y - frame.y),
    right: Math.round(right(frame) - right(el)),
    bottom: Math.round(bottom(frame) - bottom(el)),
  };
}

// ── auto-spacing (Figma "tidy up" / distribute) ──────────────────────────────

export type Axis = "horizontal" | "vertical";

/**
 * Evenly distribute boxes along an axis with a fixed gap, preserving order and
 * the first box's position. Returns the new x/y for each box id. This is the
 * "auto spacing" button: pick a gap (or the average current gap) and tidy up.
 */
export function distribute(
  boxes: Array<{ id: string } & Box>,
  axis: Axis,
  gap?: number,
): Record<string, { x: number; y: number }> {
  if (boxes.length < 2) return {};
  const sorted = [...boxes].sort((a, b) => (axis === "horizontal" ? a.x - b.x : a.y - b.y));
  const g = gap ?? averageGap(sorted, axis);
  const out: Record<string, { x: number; y: number }> = {};
  let cursor = axis === "horizontal" ? sorted[0].x : sorted[0].y;
  for (const b of sorted) {
    out[b.id] = axis === "horizontal" ? { x: Math.round(cursor), y: b.y } : { x: b.x, y: Math.round(cursor) };
    cursor += (axis === "horizontal" ? b.width : b.height) + g;
  }
  return out;
}

/** The average visible gap between consecutive boxes along an axis. */
export function averageGap(sortedBoxes: Box[], axis: Axis): number {
  if (sortedBoxes.length < 2) return 0;
  let total = 0, n = 0;
  for (let i = 1; i < sortedBoxes.length; i++) {
    const prev = sortedBoxes[i - 1], cur = sortedBoxes[i];
    total += axis === "horizontal" ? cur.x - right(prev) : cur.y - bottom(prev);
    n++;
  }
  return n ? Math.max(0, Math.round(total / n)) : 0;
}

/** Snap a value to the nearest step on a spacing scale (4/8-grid etc.). */
export function snapToScale(value: number, step = 8): number {
  return Math.round(value / step) * step;
}
