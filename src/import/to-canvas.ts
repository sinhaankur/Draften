/**
 * to-canvas — draw an imported DraftenDocument onto the Excalidraw canvas.
 *
 * Importers (Sketch/PDF/Word) produce a DraftenDocument (nodes + boards). The
 * canvas is Excalidraw, which reads its own scene — so without this, an imported
 * file loaded into the store but NEVER showed up. This converts the document's
 * nodes into an Excalidraw element skeleton (absolute-positioned, flattening the
 * node tree to world coordinates) and returns it for convertToExcalidrawElements.
 */

import type { DraftenDocument } from "../model/document";
import type { Node, Paint } from "../model/node";

type Skeleton = Array<Record<string, unknown>>;

const INK = "#1d1d1b";
const LINE = "#e7e6e2";

function solid(fills: Paint[] | undefined, fallback = "transparent"): string {
  const f = fills?.find((p) => p.kind === "solid") as { kind: "solid"; color: string } | undefined;
  return f?.color ?? fallback;
}

/** World (x,y) of a node by walking parent frames. */
function worldXY(node: Node, doc: DraftenDocument): { x: number; y: number } {
  let x = node.frame.x, y = node.frame.y;
  let pid = node.parentId;
  const guard = new Set<string>();
  while (pid && !guard.has(pid)) {
    guard.add(pid);
    const parent = doc.nodes[pid];
    if (!parent) break;
    x += parent.frame.x;
    y += parent.frame.y;
    pid = parent.parentId;
  }
  return { x, y };
}

export function documentToSkeleton(doc: DraftenDocument): Skeleton {
  const out: Skeleton = [];
  const base = { roughness: 0 as const, strokeWidth: 1, fillStyle: "solid" as const };

  for (const node of Object.values(doc.nodes)) {
    const { x, y } = worldXY(node, doc);
    const w = Math.max(1, node.frame.width);
    const h = Math.max(1, node.frame.height);

    switch (node.type) {
      case "frame":
      case "rectangle": {
        const fill = solid((node as { fills?: Paint[] }).fills);
        const radius = (node as { cornerRadius?: number }).cornerRadius;
        out.push({
          ...base, type: "rectangle", x, y, width: w, height: h,
          strokeColor: fill === "transparent" ? LINE : fill === "#ffffff" ? LINE : darken(fill),
          backgroundColor: fill,
          ...(radius ? { roundness: { type: 3 } } : {}),
        });
        break;
      }
      case "ellipse":
        out.push({ ...base, type: "ellipse", x, y, width: w, height: h, backgroundColor: solid((node as { fills?: Paint[] }).fills), strokeColor: LINE });
        break;
      case "text": {
        const t = node as { text: string; style?: { fontSize?: number }; fills?: Paint[] };
        out.push({
          ...base, type: "text", x, y,
          text: t.text || node.name || "",
          fontSize: t.style?.fontSize ?? 16,
          fontFamily: 2,
          strokeColor: solid(t.fills, INK),
        });
        break;
      }
      default:
        // paths/images/unknown → a hairline frame so nothing silently vanishes
        out.push({ ...base, type: "rectangle", x, y, width: w, height: h, strokeColor: LINE, backgroundColor: "transparent" });
        break;
    }
  }
  return out;
}

/** A slightly darker stroke than the fill, so flat shapes still read an edge. */
function darken(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return LINE;
  const n = parseInt(m[1], 16);
  const r = Math.max(0, ((n >> 16) & 255) - 20), g = Math.max(0, ((n >> 8) & 255) - 20), b = Math.max(0, (n & 255) - 20);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
