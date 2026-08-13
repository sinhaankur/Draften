/**
 * Canvas renderer — draws a board's node list to a 2D context.
 *
 * Deliberately a plain immediate-mode 2D renderer for the scaffold: it proves the
 * one-model→many-surfaces idea end to end (importer → model → pixels) and is
 * enough for design + diagram nodes. A WebGL/tiled renderer can replace this
 * later behind the same `renderBoard` signature without touching the model.
 */

import type { DraftenDocument } from "../model/document";
import type { ConnectorNode, Node, Paint, Rect } from "../model/node";
import type { Viewport } from "../state/store";

export function renderBoard(
  ctx: CanvasRenderingContext2D,
  doc: DraftenDocument,
  boardId: string,
  viewport: Viewport,
  selection: string[],
  size: { width: number; height: number; dpr: number },
): void {
  const { width, height, dpr } = size;
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // background
  ctx.fillStyle = "#0f1116";
  ctx.fillRect(0, 0, width, height);
  drawGrid(ctx, viewport, width, height);

  // world transform: pan + zoom
  ctx.translate(viewport.x, viewport.y);
  ctx.scale(viewport.zoom, viewport.zoom);

  const board = doc.boards.find((b) => b.id === boardId);
  if (!board) {
    ctx.restore();
    return;
  }

  // draw non-connector nodes first, then connectors on top (so edges sit over
  // shapes, and can resolve their endpoints from already-known frames)
  const nodes = board.children.map((id) => doc.nodes[id]).filter(Boolean);
  for (const n of nodes) if (n.type !== "connector") drawNode(ctx, doc, n);
  for (const n of nodes) if (n.type === "connector") drawConnector(ctx, doc, n);

  // selection overlay
  for (const id of selection) {
    const n = doc.nodes[id];
    if (n) drawSelection(ctx, n.frame);
  }

  ctx.restore();
}

function drawGrid(ctx: CanvasRenderingContext2D, vp: Viewport, w: number, h: number): void {
  const step = 24 * vp.zoom;
  if (step < 6) return;
  ctx.strokeStyle = "rgba(255,255,255,0.035)";
  ctx.lineWidth = 1;
  const ox = vp.x % step;
  const oy = vp.y % step;
  ctx.beginPath();
  for (let x = ox; x < w; x += step) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
  }
  for (let y = oy; y < h; y += step) {
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
  }
  ctx.stroke();
}

function drawNode(ctx: CanvasRenderingContext2D, doc: DraftenDocument, n: Node): void {
  const f = n.frame;
  ctx.globalAlpha = n.opacity ?? 1;

  switch (n.type) {
    case "frame":
    case "rectangle": {
      const radius = "cornerRadius" in n ? (n.cornerRadius ?? 0) : 0;
      roundRect(ctx, f, radius);
      paintFills(ctx, "fills" in n ? n.fills : []);
      ctx.fill();
      strokeIf(ctx, n);
      if (n.type === "frame" && n.children) {
        for (const cid of n.children) {
          const child = doc.nodes[cid];
          if (child) drawNode(ctx, doc, child);
        }
      }
      break;
    }
    case "ellipse": {
      ctx.beginPath();
      ctx.ellipse(f.x + f.width / 2, f.y + f.height / 2, f.width / 2, f.height / 2, 0, 0, Math.PI * 2);
      paintFills(ctx, n.fills);
      ctx.fill();
      strokeIf(ctx, n);
      break;
    }
    case "shape": {
      drawDiagramShape(ctx, n.shape, f);
      paintFills(ctx, n.fills);
      ctx.fill();
      strokeIf(ctx, n);
      if (n.label) drawCenteredLabel(ctx, n.label, f, "#e6e9ef");
      break;
    }
    case "sticky": {
      roundRect(ctx, f, 6);
      paintFills(ctx, [n.fill]);
      ctx.fill();
      drawCenteredLabel(ctx, n.text, f, "#1a1a1a");
      break;
    }
    case "text": {
      const s = n.style;
      ctx.fillStyle = solidOf(n.fills) ?? "#e6e9ef";
      ctx.font = `${s?.fontWeight ?? 400} ${s?.fontSize ?? 16}px ${s?.fontFamily ?? "Inter"}, sans-serif`;
      ctx.textBaseline = "top";
      ctx.fillText(n.text, f.x, f.y);
      break;
    }
    case "mindNode": {
      roundRect(ctx, f, 10);
      ctx.fillStyle = "#1b2233";
      ctx.fill();
      ctx.strokeStyle = "#4c6fff";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      drawCenteredLabel(ctx, n.text, f, "#e6e9ef");
      break;
    }
    case "journeyStage": {
      roundRect(ctx, f, 8);
      ctx.fillStyle = "#141821";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.08)";
      ctx.stroke();
      drawCenteredLabel(ctx, n.title, { ...f, height: 28 }, "#e6e9ef");
      break;
    }
    default:
      // image/path/instance placeholder box for the scaffold
      roundRect(ctx, f, 2);
      ctx.fillStyle = "#232a36";
      ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawConnector(ctx: CanvasRenderingContext2D, doc: DraftenDocument, n: ConnectorNode): void {
  const a = endpoint(doc, n.from);
  const b = endpoint(doc, n.to);
  if (!a || !b) return;
  ctx.strokeStyle = solidOfPaint(n.stroke.paint) ?? "#8892a6";
  ctx.lineWidth = n.stroke.width || 1.5;
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  if (n.routing === "orthogonal") {
    const midX = (a.x + b.x) / 2;
    ctx.lineTo(midX, a.y);
    ctx.lineTo(midX, b.y);
    ctx.lineTo(b.x, b.y);
  } else if (n.routing === "curved") {
    const dx = (b.x - a.x) * 0.5;
    ctx.bezierCurveTo(a.x + dx, a.y, b.x - dx, b.y, b.x, b.y);
  } else {
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
  if (n.endArrow && n.endArrow !== "none") drawArrow(ctx, a, b);
}

// ── helpers ────────────────────────────────────────────────────────────────

function endpoint(doc: DraftenDocument, e: ConnectorNode["from"]): { x: number; y: number } | undefined {
  if (e.point) return e.point;
  const node = e.nodeId ? doc.nodes[e.nodeId] : undefined;
  if (!node) return undefined;
  const f = node.frame;
  return { x: f.x + f.width / 2, y: f.y + f.height / 2 };
}

function drawArrow(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }): void {
  const ang = Math.atan2(b.y - a.y, b.x - a.x);
  const len = 9;
  ctx.beginPath();
  ctx.moveTo(b.x, b.y);
  ctx.lineTo(b.x - len * Math.cos(ang - 0.4), b.y - len * Math.sin(ang - 0.4));
  ctx.lineTo(b.x - len * Math.cos(ang + 0.4), b.y - len * Math.sin(ang + 0.4));
  ctx.closePath();
  ctx.fillStyle = ctx.strokeStyle;
  ctx.fill();
}

function drawDiagramShape(ctx: CanvasRenderingContext2D, shape: string, f: Rect): void {
  ctx.beginPath();
  switch (shape) {
    case "ellipse":
      ctx.ellipse(f.x + f.width / 2, f.y + f.height / 2, f.width / 2, f.height / 2, 0, 0, Math.PI * 2);
      break;
    case "diamond":
      ctx.moveTo(f.x + f.width / 2, f.y);
      ctx.lineTo(f.x + f.width, f.y + f.height / 2);
      ctx.lineTo(f.x + f.width / 2, f.y + f.height);
      ctx.lineTo(f.x, f.y + f.height / 2);
      ctx.closePath();
      break;
    case "roundRect":
      roundRectPath(ctx, f, 10);
      break;
    default:
      ctx.rect(f.x, f.y, f.width, f.height);
  }
}

function roundRect(ctx: CanvasRenderingContext2D, f: Rect, r: number): void {
  ctx.beginPath();
  roundRectPath(ctx, f, r);
}

function roundRectPath(ctx: CanvasRenderingContext2D, f: Rect, r: number): void {
  const radius = Math.min(r, f.width / 2, f.height / 2);
  ctx.moveTo(f.x + radius, f.y);
  ctx.arcTo(f.x + f.width, f.y, f.x + f.width, f.y + f.height, radius);
  ctx.arcTo(f.x + f.width, f.y + f.height, f.x, f.y + f.height, radius);
  ctx.arcTo(f.x, f.y + f.height, f.x, f.y, radius);
  ctx.arcTo(f.x, f.y, f.x + f.width, f.y, radius);
  ctx.closePath();
}

function paintFills(ctx: CanvasRenderingContext2D, fills: Paint[]): void {
  ctx.fillStyle = solidOf(fills) ?? "transparent";
}

function solidOf(fills: Paint[]): string | undefined {
  for (const p of fills) {
    const c = solidOfPaint(p);
    if (c) return c;
  }
  return undefined;
}

function solidOfPaint(p: Paint): string | undefined {
  if (p.kind === "solid") return p.color;
  if (p.kind === "linear") return p.stops[0]?.color;
  return undefined;
}

function strokeIf(ctx: CanvasRenderingContext2D, n: Node): void {
  const stroke = "stroke" in n ? n.stroke : undefined;
  if (!stroke) return;
  ctx.strokeStyle = solidOfPaint(stroke.paint) ?? "transparent";
  ctx.lineWidth = stroke.width;
  ctx.stroke();
}

function drawCenteredLabel(ctx: CanvasRenderingContext2D, text: string, f: Rect, color: string): void {
  ctx.fillStyle = color;
  ctx.font = "13px Inter, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, f.x + f.width / 2, f.y + f.height / 2, f.width - 12);
  ctx.textAlign = "start";
}

function drawSelection(ctx: CanvasRenderingContext2D, f: Rect): void {
  ctx.strokeStyle = "#4c6fff";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(f.x - 1, f.y - 1, f.width + 2, f.height + 2);
}
