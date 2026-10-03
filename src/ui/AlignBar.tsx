import { useEffect, useState } from "react";
import {
  AlignHorizontalJustifyStart, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd,
  AlignHorizontalSpaceBetween, AlignVerticalSpaceBetween,
} from "lucide-react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

/**
 * AlignBar — align & distribute the selection (Sketch/Figma core, v2's Align).
 *
 * Shows only when 2+ elements are selected. Aligns left/center/right/top/middle/
 * bottom to the selection's bounding box, and distributes evenly. Writes real
 * geometry back to the canvas.
 */
type El = { id: string; x: number; y: number; width: number; height: number; isDeleted?: boolean };

export function AlignBar({ api }: { api: ExcalidrawImperativeAPI | null }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!api) return;
    let t = 0;
    const tick = () => {
      try {
        const st = api.getAppState();
        const n = Object.keys(st.selectedElementIds || {}).filter((k) => st.selectedElementIds[k]).length;
        setCount((c) => (c === n ? c : n));
      } catch { /* not ready */ }
      t = window.setTimeout(tick, 300) as unknown as number;
    };
    tick();
    return () => window.clearTimeout(t);
  }, [api]);

  if (!api || count < 2) return null;

  const selected = (): El[] => {
    const st = api.getAppState();
    const ids = Object.keys(st.selectedElementIds || {}).filter((k) => st.selectedElementIds[k]);
    return api.getSceneElements().filter((e) => ids.includes(e.id) && !e.isDeleted) as unknown as El[];
  };

  const write = (patch: Map<string, { x?: number; y?: number }>) => {
    const els = api.getSceneElements().map((e) => (patch.has(e.id) ? { ...e, ...patch.get(e.id) } : e));
    api.updateScene({ elements: els as Parameters<typeof api.updateScene>[0]["elements"] });
  };

  const bounds = (els: El[]) => ({
    minX: Math.min(...els.map((e) => e.x)),
    maxX: Math.max(...els.map((e) => e.x + e.width)),
    minY: Math.min(...els.map((e) => e.y)),
    maxY: Math.max(...els.map((e) => e.y + e.height)),
  });

  const alignH = (mode: "left" | "center" | "right") => {
    const els = selected(); const b = bounds(els); const p = new Map<string, { x: number }>();
    for (const e of els) p.set(e.id, { x: mode === "left" ? b.minX : mode === "right" ? b.maxX - e.width : (b.minX + b.maxX) / 2 - e.width / 2 });
    write(p);
  };
  const alignV = (mode: "top" | "middle" | "bottom") => {
    const els = selected(); const b = bounds(els); const p = new Map<string, { y: number }>();
    for (const e of els) p.set(e.id, { y: mode === "top" ? b.minY : mode === "bottom" ? b.maxY - e.height : (b.minY + b.maxY) / 2 - e.height / 2 });
    write(p);
  };
  const distribute = (axis: "h" | "v") => {
    const els = selected().slice().sort((a, b) => (axis === "h" ? a.x - b.x : a.y - b.y));
    if (els.length < 3) return;
    const b = bounds(els);
    const total = axis === "h" ? b.maxX - b.minX : b.maxY - b.minY;
    const sizes = els.reduce((s, e) => s + (axis === "h" ? e.width : e.height), 0);
    const gap = (total - sizes) / (els.length - 1);
    let pos = axis === "h" ? b.minX : b.minY;
    const p = new Map<string, { x?: number; y?: number }>();
    for (const e of els) { p.set(e.id, axis === "h" ? { x: pos } : { y: pos }); pos += (axis === "h" ? e.width : e.height) + gap; }
    write(p);
  };

  const btn = (title: string, onClick: () => void, icon: React.ReactNode) => (
    <button title={title} onClick={onClick}
      style={{ flex: 1, display: "grid", placeItems: "center", height: 28, border: "1px solid var(--line,#e7e6e2)", background: "var(--surf,#fff)", color: "var(--t1,#1d1d1b)", borderRadius: 7, cursor: "pointer" }}>
      {icon}
    </button>
  );

  return (
    <div style={{ marginTop: 10 }}>
      <div className="section-title">Align · {count} selected</div>
      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
        {btn("Align left", () => alignH("left"), <AlignHorizontalJustifyStart size={15} />)}
        {btn("Align center", () => alignH("center"), <AlignHorizontalJustifyCenter size={15} />)}
        {btn("Align right", () => alignH("right"), <AlignHorizontalJustifyEnd size={15} />)}
        {btn("Distribute horizontally", () => distribute("h"), <AlignHorizontalSpaceBetween size={15} />)}
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
        {btn("Align top", () => alignV("top"), <AlignVerticalJustifyStart size={15} />)}
        {btn("Align middle", () => alignV("middle"), <AlignVerticalJustifyCenter size={15} />)}
        {btn("Align bottom", () => alignV("bottom"), <AlignVerticalJustifyEnd size={15} />)}
        {btn("Distribute vertically", () => distribute("v"), <AlignVerticalSpaceBetween size={15} />)}
      </div>
    </div>
  );
}
