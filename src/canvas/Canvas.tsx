import { useEffect, useRef, useState } from "react";

import type { Node, Rect } from "../model/node";
import { useEditor } from "../state/store";
import {
  createNodeForTool,
  defaultSizeForTool,
  MIN_DRAW,
} from "./create-node";
import {
  CLICK_SLOP,
  pickTopmost,
  rectFromDrag,
  screenToWorld,
} from "./interaction";
import { renderBoard } from "./render";

/** A live drag in progress (create a new node, or move an existing one). */
type Drag =
  | { kind: "create"; startWorld: { x: number; y: number }; preview: Rect }
  | { kind: "move"; ids: string[]; startWorld: { x: number; y: number }; origin: Record<string, { x: number; y: number }> }
  | { kind: "pan"; startScreen: { x: number; y: number }; startVp: { x: number; y: number } }
  | null;

/** The canvas surface. Owns the <canvas>, DPR sizing, pan/zoom, tool pointer I/O.
 *  `theme` is passed only to force a repaint when the light/dark ground flips. */
export function Canvas({ theme }: { theme?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doc = useEditor((s) => s.doc);
  const activeBoardId = useEditor((s) => s.activeBoardId);
  const viewport = useEditor((s) => s.viewport);
  const selection = useEditor((s) => s.selection);
  const tool = useEditor((s) => s.tool);
  const setViewport = useEditor((s) => s.setViewport);
  const select = useEditor((s) => s.select);
  const addNode = useEditor((s) => s.addNode);
  const updateNode = useEditor((s) => s.updateNode);
  const setTool = useEditor((s) => s.setTool);

  const [drag, setDrag] = useState<Drag>(null);
  const dragStartScreen = useRef<{ x: number; y: number } | null>(null);

  // redraw whenever the doc / board / view / selection / live-drag changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);

    renderBoard(ctx, doc, activeBoardId, viewport, selection, {
      width: rect.width,
      height: rect.height,
      dpr,
    });

    // draw the create-preview rectangle on top
    if (drag?.kind === "create") {
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(viewport.x, viewport.y);
      ctx.scale(viewport.zoom, viewport.zoom);
      ctx.strokeStyle =
        getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#5b34d6";
      ctx.lineWidth = 1 / viewport.zoom;
      ctx.setLineDash([4 / viewport.zoom, 3 / viewport.zoom]);
      const p = drag.preview;
      ctx.strokeRect(p.x, p.y, p.width, p.height);
      ctx.restore();
    }
  }, [doc, activeBoardId, viewport, selection, drag, theme]);

  useEffect(() => {
    const onResize = () => setViewport({});
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [setViewport]);

  const localPoint = (e: React.PointerEvent): { x: number; y: number } => {
    const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const boardNodes = (): Node[] => {
    const board = doc.boards.find((b) => b.id === activeBoardId);
    if (!board) return [];
    return board.children.map((id) => doc.nodes[id]).filter(Boolean);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const sp = localPoint(e);
    dragStartScreen.current = sp;
    const wp = screenToWorld(sp.x, sp.y, viewport);

    // space/middle-button or hand tool → pan
    if (e.button === 1 || tool === "hand") {
      setDrag({ kind: "pan", startScreen: sp, startVp: { x: viewport.x, y: viewport.y } });
      return;
    }

    if (tool === "select") {
      const hit = pickTopmost(boardNodes(), wp.x, wp.y);
      if (hit) {
        const ids = selection.includes(hit.id) ? selection : [hit.id];
        select(ids);
        const origin: Record<string, { x: number; y: number }> = {};
        for (const id of ids) {
          const n = doc.nodes[id];
          if (n) origin[id] = { x: n.frame.x, y: n.frame.y };
        }
        setDrag({ kind: "move", ids, startWorld: wp, origin });
      } else {
        select([]);
      }
      return;
    }

    // a creating tool → begin a create drag (may become a click-to-place)
    setDrag({ kind: "create", startWorld: wp, preview: { x: wp.x, y: wp.y, width: 0, height: 0 } });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag) return;
    const sp = localPoint(e);
    const wp = screenToWorld(sp.x, sp.y, viewport);

    if (drag.kind === "pan") {
      const dx = sp.x - drag.startScreen.x;
      const dy = sp.y - drag.startScreen.y;
      setViewport({ x: drag.startVp.x + dx, y: drag.startVp.y + dy });
    } else if (drag.kind === "create") {
      setDrag({ ...drag, preview: rectFromDrag(drag.startWorld, wp) });
    } else if (drag.kind === "move") {
      const dx = wp.x - drag.startWorld.x;
      const dy = wp.y - drag.startWorld.y;
      for (const id of drag.ids) {
        const o = drag.origin[id];
        const n = doc.nodes[id];
        if (o && n) updateNode(id, { frame: { ...n.frame, x: o.x + dx, y: o.y + dy } });
      }
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const sp = localPoint(e);
    const start = dragStartScreen.current;
    const moved =
      !!start && (Math.abs(sp.x - start.x) > CLICK_SLOP || Math.abs(sp.y - start.y) > CLICK_SLOP);

    if (drag?.kind === "create") {
      const wp = screenToWorld(sp.x, sp.y, viewport);
      let frame: Rect;
      if (moved) {
        frame = rectFromDrag(drag.startWorld, wp);
        if (frame.width < MIN_DRAW || frame.height < MIN_DRAW) frame = { ...frame, width: Math.max(frame.width, MIN_DRAW), height: Math.max(frame.height, MIN_DRAW) };
      } else {
        // click-to-place at the press point with a default size
        const size = defaultSizeForTool(tool);
        frame = { x: drag.startWorld.x, y: drag.startWorld.y, ...size };
      }
      const node = createNodeForTool(tool, frame);
      if (node) {
        addNode(node);
        setTool("select"); // Figma-style: drop back to select after placing
      }
    }

    setDrag(null);
    dragStartScreen.current = null;
  };

  // pan with wheel, zoom with ctrl/cmd-wheel (Figma-style)
  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      const factor = Math.exp(-e.deltaY * 0.002);
      const next = Math.min(8, Math.max(0.1, viewport.zoom * factor));
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const wx = (cx - viewport.x) / viewport.zoom;
      const wy = (cy - viewport.y) / viewport.zoom;
      setViewport({ zoom: next, x: cx - wx * next, y: cy - wy * next });
    } else {
      setViewport({ x: viewport.x - e.deltaX, y: viewport.y - e.deltaY });
    }
  };

  const cursor = tool === "hand" ? "grab" : tool === "select" ? "default" : "crosshair";

  return (
    <canvas
      ref={canvasRef}
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{ width: "100%", height: "100%", display: "block", cursor, touchAction: "none" }}
    />
  );
}
