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
import type { Node, Paint, Stroke } from "../model/node";

type Skeleton = Array<Record<string, unknown>>;

const INK = "#1d1d1b";
const LINE = "#e7e6e2";

/** Resolve a fill to a single display colour: solid as-is, a linear gradient to
 *  its middle stop (Excalidraw has no gradient fill, so we approximate it). */
function solid(fills: Paint[] | undefined, fallback = "transparent"): string {
  const f = fills?.find((p) => p.kind === "solid" || p.kind === "linear");
  if (!f) return fallback;
  if (f.kind === "solid") return f.color;
  if (f.kind === "linear" && f.stops.length) {
    return f.stops[Math.floor((f.stops.length - 1) / 2)]?.color ?? f.stops[0].color;
  }
  return fallback;
}

/** Stroke → { strokeColor, strokeWidth } overrides, or {} when there's none. */
function strokeProps(stroke: Stroke | undefined): Record<string, unknown> {
  if (!stroke || stroke.paint.kind === "none") return {};
  const color = stroke.paint.kind === "solid" ? stroke.paint.color
    : stroke.paint.kind === "linear" ? solid([stroke.paint]) : undefined;
  if (!color) return {};
  return { strokeColor: color, strokeWidth: Math.max(0.5, stroke.width) };
}

/** opacity (0..1) + rotation (radians) shared by every node type. */
function transformProps(node: Node): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (typeof node.opacity === "number" && node.opacity < 1) out.opacity = Math.round(node.opacity * 100);
  if (typeof node.rotation === "number" && node.rotation !== 0) out.angle = node.rotation;
  return out;
}

/** World (x,y) of a node by walking parent frames up to the board.
 *
 * Nodes may be parented to a BOARD id (not another node) — a PDF page's image +
 * text are parented to the page board. Boards live in `doc.boards`, not
 * `doc.nodes`, and carry the page's placement on the infinite canvas (`frame`),
 * so the board offset must be added too — otherwise every page stacks at the
 * origin and the pages overlap. */
function worldXY(node: Node, doc: DraftenDocument): { x: number; y: number } {
  let x = node.frame.x, y = node.frame.y;
  let pid = node.parentId;
  const guard = new Set<string>();
  while (pid && !guard.has(pid)) {
    guard.add(pid);
    const parent = doc.nodes[pid];
    if (parent) {
      x += parent.frame.x;
      y += parent.frame.y;
      pid = parent.parentId;
      continue;
    }
    // Not a node → maybe a board. Add its artboard offset and stop.
    const board = (doc.boards ?? []).find((b) => b.id === pid) as { frame?: { x: number; y: number } } | undefined;
    if (board?.frame) { x += board.frame.x; y += board.frame.y; }
    break;
  }
  return { x, y };
}

export function documentToSkeleton(doc: DraftenDocument): Skeleton {
  const out: Skeleton = [];
  const base = { roughness: 0 as const, strokeWidth: 1, fillStyle: "solid" as const };

  // Each board (a PDF/Sketch page) → an artboard "sheet" rectangle so you SEE
  // the document page behind its contents, not floating runs. Drawn first =
  // behind. The sheet uses the board's real background colour when it declares
  // one (e.g. a PDF page's paper colour), else white.
  for (const board of doc.boards ?? []) {
    const b = board as { frame?: { x: number; y: number; width: number; height: number }; background?: string };
    const f = b.frame;
    if (!f) continue;
    out.push({ ...base, type: "rectangle", x: f.x, y: f.y, width: Math.max(1, f.width ?? 800), height: Math.max(1, f.height ?? 1000), strokeColor: LINE, backgroundColor: b.background || "#ffffff" });
  }

  for (const node of Object.values(doc.nodes)) {
    const { x, y } = worldXY(node, doc);
    const w = Math.max(1, node.frame.width);
    const h = Math.max(1, node.frame.height);

    const xf = transformProps(node);
    const sp = strokeProps((node as { stroke?: Stroke }).stroke);

    switch (node.type) {
      case "frame":
      case "rectangle": {
        const fill = solid((node as { fills?: Paint[] }).fills);
        const radius = (node as { cornerRadius?: number }).cornerRadius;
        out.push({
          ...base, type: "rectangle", x, y, width: w, height: h,
          // a real stroke wins; else a faint edge so flat shapes still read
          strokeColor: fill === "transparent" ? LINE : fill === "#ffffff" ? LINE : darken(fill),
          backgroundColor: fill,
          ...(radius ? { roundness: { type: 3 } } : {}),
          ...xf, ...sp,
        });
        break;
      }
      case "ellipse":
        out.push({ ...base, type: "ellipse", x, y, width: w, height: h, backgroundColor: solid((node as { fills?: Paint[] }).fills), strokeColor: LINE, ...xf, ...sp });
        break;
      case "image": {
        const src = (node as { src?: string }).src ?? "";
        if (src.startsWith("data:")) {
          // Real bitmap bytes (e.g. a rasterized PDF page) → an Excalidraw image
          // element. The dataURL rides along on `_dataURL`; drawSkeletonOnCanvas
          // registers it as a file and keeps only the fileId. `status: "saved"`
          // is REQUIRED — a "pending" image renders blank even with its file
          // registered (Excalidraw only paints saved images).
          out.push({ ...base, type: "image", x, y, width: w, height: h, fileId: node.id, _dataURL: src, status: "saved", strokeColor: "transparent", ...xf });
        } else {
          // No inline bytes (e.g. a figma:// ref) → a labelled placeholder box so
          // the layout reads until the real pixels are fetched.
          out.push({ ...base, type: "rectangle", x, y, width: w, height: h, backgroundColor: "#f1f0ec", strokeColor: LINE, ...xf });
          out.push({ ...base, type: "text", x: x + 6, y: y + Math.max(0, h / 2 - 8), text: node.name || "Image", fontSize: 12, fontFamily: 2, strokeColor: "#8e8d88", ...xf });
        }
        break;
      }
      case "text": {
        const t = node as { text: string; style?: { fontSize?: number; align?: string }; fills?: Paint[] };
        out.push({
          ...base, type: "text", x, y,
          text: t.text || node.name || "",
          fontSize: t.style?.fontSize ?? 16,
          fontFamily: 2,
          textAlign: t.style?.align ?? "left",
          strokeColor: solid(t.fills, INK),
          ...xf,
        });
        break;
      }
      case "path": {
        // SVG `d` → an editable Excalidraw line (polyline). Curves are flattened
        // to short segments; points are relative to the element origin (x,y).
        const d = (node as { d?: string }).d ?? "";
        const fills = (node as { fills?: Paint[] }).fills;
        const abs = flattenPathD(d);
        if (abs.length >= 2) {
          const pts = abs.map(([px, py]) => [px - x, py - y]);
          const fill = solid(fills, "transparent");
          out.push({
            ...base, type: "line", x, y,
            points: pts,
            strokeColor: sp.strokeColor ?? (fill !== "transparent" ? darken(fill) : INK),
            strokeWidth: (sp.strokeWidth as number) ?? 1,
            backgroundColor: fill,
            ...xf,
          });
        } else {
          out.push({ ...base, type: "rectangle", x, y, width: w, height: h, strokeColor: LINE, backgroundColor: solid(fills, "transparent"), ...xf, ...sp });
        }
        break;
      }
      default:
        // unknown → a hairline frame so nothing silently vanishes
        out.push({ ...base, type: "rectangle", x, y, width: w, height: h, strokeColor: LINE, backgroundColor: "transparent", ...xf, ...sp });
        break;
    }
  }
  return out;
}

/**
 * Flatten an absolute SVG path `d` (M/L/C/Q/Z, as our PDF extractor emits) into a
 * list of [x,y] points for an Excalidraw polyline. Beziers are sampled into a few
 * line segments — enough to read the shape; the node stays fully editable.
 */
export function flattenPathD(d: string): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const re = /([MLCQZ])([^MLCQZ]*)/gi;
  let m: RegExpExecArray | null;
  let cur: [number, number] = [0, 0];
  let start: [number, number] | null = null;
  const nums = (s: string) => (s.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
  while ((m = re.exec(d))) {
    const cmd = m[1].toUpperCase();
    const n = nums(m[2]);
    if (cmd === "M") { cur = [n[0], n[1]]; start = cur; pts.push(cur); }
    else if (cmd === "L") { cur = [n[0], n[1]]; pts.push(cur); }
    else if (cmd === "C") {
      const [x1, y1, x2, y2, x, y] = n;
      for (let t = 1; t <= 6; t++) pts.push(cubic(cur, [x1, y1], [x2, y2], [x, y], t / 6));
      cur = [x, y];
    } else if (cmd === "Q") {
      const [x1, y1, x, y] = n;
      for (let t = 1; t <= 5; t++) pts.push(quad(cur, [x1, y1], [x, y], t / 5));
      cur = [x, y];
    } else if (cmd === "Z") { if (start) { pts.push(start); cur = start; } }
  }
  return pts;
}

function cubic(p0: number[], p1: number[], p2: number[], p3: number[], t: number): [number, number] {
  const u = 1 - t;
  const b0 = u * u * u, b1 = 3 * u * u * t, b2 = 3 * u * t * t, b3 = t * t * t;
  return [b0 * p0[0] + b1 * p1[0] + b2 * p2[0] + b3 * p3[0], b0 * p0[1] + b1 * p1[1] + b2 * p2[1] + b3 * p3[1]];
}
function quad(p0: number[], p1: number[], p2: number[], t: number): [number, number] {
  const u = 1 - t;
  const b0 = u * u, b1 = 2 * u * t, b2 = t * t;
  return [b0 * p0[0] + b1 * p1[0] + b2 * p2[0], b0 * p0[1] + b1 * p1[1] + b2 * p2[1]];
}

/** A slightly darker stroke than the fill, so flat shapes still read an edge. */
function darken(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return LINE;
  const n = parseInt(m[1], 16);
  const r = Math.max(0, ((n >> 16) & 255) - 20), g = Math.max(0, ((n >> 8) & 255) - 20), b = Math.max(0, (n & 255) - 20);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
