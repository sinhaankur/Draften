import { useEffect, useRef, useState } from "react";
import { sceneCoordsToViewportCoords } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { rectGap, edgeDistances, type Box } from "../canvas/measure";

/**
 * MeasureOverlay — Figma/Sketch-style spacing guides.
 *
 * Select an element → a W×H size badge. Hold Alt/Option and hover another element
 * → red measurement lines + the pixel gap between them, plus the distance to the
 * containing frame's edges. It's a read-only SVG drawn OVER the canvas in screen
 * space (scene→screen = (coord + scroll) · zoom + offset), so it never touches
 * Excalidraw's scene. Pointer + selection + the Alt key are polled from the live
 * app state, the same lightweight pattern the other overlays use.
 */

type El = Box & { id: string; type: string; isDeleted?: boolean; frameId?: string | null };

const RED = "#e5484d";

export function MeasureOverlay({ api }: { api: ExcalidrawImperativeAPI | null }) {
  const [sel, setSel] = useState<El | null>(null);
  const [target, setTarget] = useState<El | null>(null);
  const [view, setView] = useState({ scrollX: 0, scrollY: 0, zoom: 1, offsetLeft: 0, offsetTop: 0 });
  const altRef = useRef(false);
  const mouseRef = useRef({ x: 0, y: 0 });

  // Alt/Option enables measuring (Figma parity).
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === "Alt") altRef.current = true; };
    const up = (e: KeyboardEvent) => { if (e.key === "Alt") altRef.current = false; };
    const move = (e: MouseEvent) => { mouseRef.current = { x: e.clientX, y: e.clientY }; };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("mousemove", move);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); window.removeEventListener("mousemove", move); };
  }, []);

  // Poll selection + viewport + (while Alt held) the element under the pointer.
  useEffect(() => {
    if (!api) return;
    let raf = 0;
    const tick = () => {
      try {
        const st = api.getAppState() as unknown as { selectedElementIds: Record<string, boolean>; scrollX: number; scrollY: number; zoom: { value: number }; offsetLeft: number; offsetTop: number };
        setView((v) => {
          const next = { scrollX: st.scrollX, scrollY: st.scrollY, zoom: st.zoom.value, offsetLeft: st.offsetLeft, offsetTop: st.offsetTop };
          return same(v, next) ? v : next;
        });
        const els = api.getSceneElements() as unknown as El[];
        const ids = Object.keys(st.selectedElementIds || {}).filter((k) => st.selectedElementIds[k]);
        const selected = ids.length === 1 ? els.find((e) => e.id === ids[0] && !e.isDeleted) ?? null : null;
        setSel((p) => (p?.id === selected?.id ? p : selected));

        if (selected && altRef.current) {
          // scene point under the pointer → which element is it over?
          const sx = (mouseRef.current.x - st.offsetLeft) / st.zoom.value - st.scrollX;
          const sy = (mouseRef.current.y - st.offsetTop) / st.zoom.value - st.scrollY;
          const hit = els.filter((e) => !e.isDeleted && e.id !== selected.id && e.type !== "frame" && hitTest(e, sx, sy)).pop() ?? null;
          setTarget((p) => (p?.id === hit?.id ? p : hit));
        } else if (target) {
          setTarget(null);
        }
      } catch { /* scene not ready */ }
      raf = window.setTimeout(tick, 80) as unknown as number;
    };
    tick();
    return () => window.clearTimeout(raf);
  }, [api, target]);

  if (!sel) return null;
  // Use Excalidraw's own authoritative scene→viewport transform (handles zoom +
  // scroll + offset exactly), so guides always sit on the real pixels.
  const vp = { zoom: { value: view.zoom }, offsetLeft: view.offsetLeft, offsetTop: view.offsetTop, scrollX: view.scrollX, scrollY: view.scrollY } as unknown as Parameters<typeof sceneCoordsToViewportCoords>[1];
  const sX = (v: number) => sceneCoordsToViewportCoords({ sceneX: v, sceneY: 0 }, vp).x;
  const sY = (v: number) => sceneCoordsToViewportCoords({ sceneX: 0, sceneY: v }, vp).y;

  // size badge under the selected element
  const badgeX = sX(sel.x + sel.width / 2);
  const badgeY = sY(sel.y + sel.height) + 6;

  return (
    <svg style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", pointerEvents: "none", zIndex: 5, overflow: "visible" }}>
      {/* selected size badge (always on when one element is selected) */}
      <Badge x={badgeX} y={badgeY} text={`${Math.round(sel.width)} × ${Math.round(sel.height)}`} center />

      {/* measurement to the hovered target (Alt held) */}
      {target && (() => {
        const g = rectGap(sel, target);
        if (g.axis === "x") {
          const leftB = sel.x <= target.x ? sel : target;
          const rightB = leftB === sel ? target : sel;
          const y = sY(Math.max(sel.y, target.y) + Math.min(sel.height, target.height) / 2);
          const x1 = sX(leftB.x + leftB.width), x2 = sX(rightB.x);
          return <Line x1={x1} y1={y} x2={x2} y2={y} label={`${g.dx}`} />;
        } else {
          const topB = sel.y <= target.y ? sel : target;
          const botB = topB === sel ? target : sel;
          const x = sX(Math.max(sel.x, target.x) + Math.min(sel.width, target.width) / 2);
          const y1 = sY(topB.y + topB.height), y2 = sY(botB.y);
          return <Line x1={x} y1={y1} x2={x} y2={y2} vertical label={`${g.dy}`} />;
        }
      })()}

      {/* distances to the containing frame's edges when Alt held + inside a frame */}
      {sel.frameId && target == null && mouseAlt() && (() => {
        const frame = (api!.getSceneElements() as unknown as El[]).find((e) => e.id === sel.frameId);
        if (!frame) return null;
        const d = edgeDistances(sel, frame);
        return (
          <>
            {d.left > 0 && <Line x1={sX(frame.x)} y1={sY(sel.y + sel.height / 2)} x2={sX(sel.x)} y2={sY(sel.y + sel.height / 2)} label={`${d.left}`} />}
            {d.right > 0 && <Line x1={sX(sel.x + sel.width)} y1={sY(sel.y + sel.height / 2)} x2={sX(frame.x + frame.width)} y2={sY(sel.y + sel.height / 2)} label={`${d.right}`} />}
            {d.top > 0 && <Line vertical x1={sX(sel.x + sel.width / 2)} y1={sY(frame.y)} x2={sX(sel.x + sel.width / 2)} y2={sY(sel.y)} label={`${d.top}`} />}
            {d.bottom > 0 && <Line vertical x1={sX(sel.x + sel.width / 2)} y1={sY(sel.y + sel.height)} x2={sX(sel.x + sel.width / 2)} y2={sY(frame.y + frame.height)} label={`${d.bottom}`} />}
          </>
        );
      })()}
    </svg>
  );
}

/* a measurement line with end ticks + a centered px label */
function Line({ x1, y1, x2, y2, label, vertical }: { x1: number; y1: number; x2: number; y2: number; label: string; vertical?: boolean }) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const tick = 5;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={RED} strokeWidth={1} />
      {vertical ? (
        <>
          <line x1={x1 - tick} y1={y1} x2={x1 + tick} y2={y1} stroke={RED} strokeWidth={1} />
          <line x1={x2 - tick} y1={y2} x2={x2 + tick} y2={y2} stroke={RED} strokeWidth={1} />
        </>
      ) : (
        <>
          <line x1={x1} y1={y1 - tick} x2={x1} y2={y1 + tick} stroke={RED} strokeWidth={1} />
          <line x1={x2} y1={y2 - tick} x2={x2} y2={y2 + tick} stroke={RED} strokeWidth={1} />
        </>
      )}
      <Badge x={mx} y={my} text={label} center fill={RED} />
    </g>
  );
}

function Badge({ x, y, text, center, fill = "#1d1d1b" }: { x: number; y: number; text: string; center?: boolean; fill?: string }) {
  const w = text.length * 6.6 + 10, h = 16;
  const bx = center ? x - w / 2 : x;
  const by = y - h / 2;
  return (
    <g>
      <rect x={bx} y={by} width={w} height={h} rx={3} fill={fill} />
      <text x={bx + w / 2} y={by + h / 2 + 3.5} fontSize={10.5} fill="#fff" textAnchor="middle" fontFamily="var(--font-mono, monospace)">{text}</text>
    </g>
  );
}

function hitTest(e: Box, x: number, y: number): boolean {
  return x >= e.x && x <= e.x + e.width && y >= e.y && y <= e.y + e.height;
}
function same(a: { scrollX: number; scrollY: number; zoom: number }, b: { scrollX: number; scrollY: number; zoom: number }): boolean {
  return a.scrollX === b.scrollX && a.scrollY === b.scrollY && a.zoom === b.zoom;
}
// the overlay reads the live Alt state via the module-scoped ref through a getter
let _alt = false;
if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => { if (e.key === "Alt") _alt = true; });
  window.addEventListener("keyup", (e) => { if (e.key === "Alt") _alt = false; });
}
function mouseAlt(): boolean { return _alt; }
