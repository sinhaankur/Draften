/**
 * Node factories — turn a tool + a world-space rect into a fresh Node.
 *
 * One place that knows the sensible defaults for each tool, so the pointer
 * handlers stay about *interaction* and this stays about *what gets created*.
 * AI generation and importers build nodes directly against the model types, so
 * this is specifically the manual-drawing path.
 */

import type { Node, Rect } from "../model/node";
import type { ToolId } from "../state/store";

const ACCENT = "#4c6fff";
const SURFACE = "#1b2233";
const STROKE = "#2c3547";

/** Create a node for a drag-drawn tool. Returns undefined for non-creating tools. */
export function createNodeForTool(tool: ToolId, frame: Rect): Node | undefined {
  const id = crypto.randomUUID();
  const base = { id, frame, visible: true };

  switch (tool) {
    case "frame":
      return {
        ...base,
        type: "frame",
        name: "Frame",
        fills: [{ kind: "solid", color: SURFACE }],
        cornerRadius: 8,
        stroke: { paint: { kind: "solid", color: STROKE }, width: 1 },
        children: [],
      };
    case "rectangle":
      return {
        ...base,
        type: "rectangle",
        name: "Rectangle",
        fills: [{ kind: "solid", color: SURFACE }],
        cornerRadius: 4,
      };
    case "ellipse":
      return {
        ...base,
        type: "ellipse",
        name: "Ellipse",
        fills: [{ kind: "solid", color: SURFACE }],
      };
    case "text":
      return {
        ...base,
        type: "text",
        name: "Text",
        text: "Text",
        fills: [{ kind: "solid", color: "#e6e9ef" }],
        style: { fontFamily: "Inter", fontSize: 16, fontWeight: 400, lineHeight: 1.4 },
      };
    case "shape":
      return {
        ...base,
        type: "shape",
        name: "Shape",
        shape: "roundRect",
        fills: [{ kind: "solid", color: "#26324a" }],
        stroke: { paint: { kind: "solid", color: ACCENT }, width: 1.5 },
        label: "Shape",
      };
    case "sticky":
      return {
        ...base,
        type: "sticky",
        name: "Sticky",
        text: "Note",
        fill: { kind: "solid", color: "#ffd76a" },
      };
    default:
      // select / hand / connector are handled by their own interaction paths
      return undefined;
  }
}

/** Minimum drawn size (world units) so a stray click doesn't make a 0px node. */
export const MIN_DRAW = 6;

/** A default size for click-to-place (no drag) creation. */
export function defaultSizeForTool(tool: ToolId): { width: number; height: number } {
  switch (tool) {
    case "text":
      return { width: 120, height: 28 };
    case "sticky":
      return { width: 140, height: 120 };
    case "ellipse":
    case "rectangle":
    case "shape":
      return { width: 120, height: 80 };
    case "frame":
      return { width: 320, height: 220 };
    default:
      return { width: 100, height: 100 };
  }
}
