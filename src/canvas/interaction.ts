/**
 * Canvas interaction math — pure helpers shared by the pointer handlers.
 *
 * Kept separate from React so the coordinate transforms + hit-testing are
 * unit-testable (a class of bug — off-by-a-zoom-factor — that's easy to ship and
 * annoying to debug by hand). No DOM, no store.
 */

import type { Node, Rect } from "../model/node";
import type { Viewport } from "../state/store";

/** Screen (canvas-local px) → world (board) coordinates. */
export function screenToWorld(sx: number, sy: number, vp: Viewport): { x: number; y: number } {
  return { x: (sx - vp.x) / vp.zoom, y: (sy - vp.y) / vp.zoom };
}

/** World → screen coordinates. */
export function worldToScreen(wx: number, wy: number, vp: Viewport): { x: number; y: number } {
  return { x: wx * vp.zoom + vp.x, y: wy * vp.zoom + vp.y };
}

/** Normalize a drag (start→current) into a positive-size rect in world space. */
export function rectFromDrag(
  start: { x: number; y: number },
  current: { x: number; y: number },
): Rect {
  return {
    x: Math.min(start.x, current.x),
    y: Math.min(start.y, current.y),
    width: Math.abs(current.x - start.x),
    height: Math.abs(current.y - start.y),
  };
}

/** Is a world point inside a node's frame? (axis-aligned; ignores rotation.) */
export function hitTest(node: Node, wx: number, wy: number): boolean {
  const f = node.frame;
  return wx >= f.x && wx <= f.x + f.width && wy >= f.y && wy <= f.y + f.height;
}

/**
 * Top-most node at a world point, from a board's node list. Iterates back-to-front
 * (last drawn = visually on top = first hit). Connectors are skipped for hit-test
 * (they're picked by their endpoints later); zero-size nodes are ignored.
 */
export function pickTopmost(nodes: Node[], wx: number, wy: number): Node | undefined {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (n.type === "connector") continue;
    if (n.frame.width === 0 && n.frame.height === 0) continue;
    if (hitTest(n, wx, wy)) return n;
  }
  return undefined;
}

/** A drag threshold (screen px) below which a press+release counts as a click. */
export const CLICK_SLOP = 4;
