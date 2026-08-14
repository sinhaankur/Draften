/**
 * Connector edge-clipping — where a connector should actually touch a shape.
 *
 * Center-to-center lines cross straight through the shapes they join (the bug in
 * the screenshot: the line stabbing through the "Has account?" diamond). Instead,
 * we clip each endpoint to the shape's *boundary* along the line toward the other
 * end, per the shape's real geometry (rectangle / ellipse / diamond). Pure math,
 * unit-tested, so this stays correct as routing gets fancier.
 */

import type { Node, Rect } from "../model/node";

export interface Pt {
  x: number;
  y: number;
}

/** Center of a node's frame. */
export function center(f: Rect): Pt {
  return { x: f.x + f.width / 2, y: f.y + f.height / 2 };
}

/** The shape kind used for boundary math (from a node). Defaults to rectangle. */
function shapeOf(node: Node): "rect" | "ellipse" | "diamond" {
  if (node.type === "ellipse") return "ellipse";
  if (node.type === "shape") {
    if (node.shape === "ellipse") return "ellipse";
    if (node.shape === "diamond") return "diamond";
  }
  return "rect";
}

/**
 * The point on `node`'s boundary where the ray from its center toward `toward`
 * exits the shape. Returns the center if `toward` coincides with it.
 */
export function edgePoint(node: Node, toward: Pt): Pt {
  const f = node.frame;
  const c = center(f);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) return c;

  const hw = f.width / 2;
  const hh = f.height / 2;

  switch (shapeOf(node)) {
    case "ellipse": {
      // scale the direction so it lands on the ellipse: (x/hw)² + (y/hh)² = 1
      const t = 1 / Math.sqrt((dx * dx) / (hw * hw) + (dy * dy) / (hh * hh));
      return { x: c.x + dx * t, y: c.y + dy * t };
    }
    case "diamond": {
      // diamond boundary: |x|/hw + |y|/hh = 1
      const t = 1 / (Math.abs(dx) / hw + Math.abs(dy) / hh);
      return { x: c.x + dx * t, y: c.y + dy * t };
    }
    case "rect":
    default: {
      // rectangle boundary: clip the ray to the nearer of the vertical/horizontal
      // sides (the classic "slab" method).
      const tx = hw / Math.abs(dx || Number.EPSILON);
      const ty = hh / Math.abs(dy || Number.EPSILON);
      const t = Math.min(tx, ty);
      return { x: c.x + dx * t, y: c.y + dy * t };
    }
  }
}

/**
 * Given the two endpoint nodes (or free points), return the clipped [from, to]
 * points where the connector should visibly start and end — on each shape's edge,
 * not its center. Free endpoints (no node) are used as-is.
 */
export function clippedEndpoints(
  fromNode: Node | undefined,
  fromPoint: Pt | undefined,
  toNode: Node | undefined,
  toPoint: Pt | undefined,
): { a: Pt; b: Pt } | undefined {
  const aCenter = fromNode ? center(fromNode.frame) : fromPoint;
  const bCenter = toNode ? center(toNode.frame) : toPoint;
  if (!aCenter || !bCenter) return undefined;

  const a = fromNode ? edgePoint(fromNode, bCenter) : aCenter;
  const b = toNode ? edgePoint(toNode, aCenter) : bCenter;
  return { a, b };
}
