import { useEffect, useRef } from "react";

import { useEditor } from "../state/store";
import { renderBoard } from "./render";

/** The canvas surface. Owns the <canvas>, DPR sizing, pan/zoom, and redraw. */
export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doc = useEditor((s) => s.doc);
  const activeBoardId = useEditor((s) => s.activeBoardId);
  const viewport = useEditor((s) => s.viewport);
  const selection = useEditor((s) => s.selection);
  const setViewport = useEditor((s) => s.setViewport);

  // redraw whenever the doc / board / view / selection changes
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
  }, [doc, activeBoardId, viewport, selection]);

  // redraw on resize
  useEffect(() => {
    const onResize = () => setViewport({});
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [setViewport]);

  // pan with wheel, zoom with ctrl/cmd-wheel (Figma-style)
  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      const factor = Math.exp(-e.deltaY * 0.002);
      const next = Math.min(8, Math.max(0.1, viewport.zoom * factor));
      // zoom toward the cursor
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

  return (
    <canvas
      ref={canvasRef}
      onWheel={onWheel}
      style={{ width: "100%", height: "100%", display: "block", cursor: "default" }}
    />
  );
}
