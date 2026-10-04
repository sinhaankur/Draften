import { useEffect, useState } from "react";
import {
  AlignHorizontalJustifyStart, AlignHorizontalJustifyCenter, AlignHorizontalJustifyEnd,
  AlignVerticalJustifyStart, AlignVerticalJustifyCenter, AlignVerticalJustifyEnd,
  AlignHorizontalSpaceBetween, AlignVerticalSpaceBetween, Wand2, Rows3, Columns3,
} from "lucide-react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { distribute as tidyDistribute, averageGap, snapToScale, type Box } from "../canvas/measure";

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

  // Auto-spacing / "Tidy up" (Figma): pack the selection with an EVEN gap. Works
  // with 2+ (unlike space-between). `gap` lets you set it; otherwise the current
  // average gap, snapped to the 8-grid, so it tidies to a sensible value.
  const [gap, setGap] = useState<number | "">("");
  const tidy = (axis: "horizontal" | "vertical") => {
    const els = selected();
    if (els.length < 2) return;
    const boxes = els.map((e) => ({ id: e.id, x: e.x, y: e.y, width: e.width, height: e.height } as { id: string } & Box));
    const g = gap === "" ? snapToScale(averageGap([...boxes].sort((a, b) => (axis === "horizontal" ? a.x - b.x : a.y - b.y)), axis)) : gap;
    const moved = tidyDistribute(boxes, axis, g);
    const p = new Map<string, { x?: number; y?: number }>();
    for (const id in moved) p.set(id, moved[id]);
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

      {/* Auto-spacing / Tidy up — pack with an even gap (Figma). */}
      <div className="section-title" style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
        <Wand2 size={12} /> Auto spacing
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 4, alignItems: "center" }}>
        {btn("Tidy up horizontally (even gap)", () => tidy("horizontal"), <Columns3 size={15} />)}
        {btn("Tidy up vertically (even gap)", () => tidy("vertical"), <Rows3 size={15} />)}
        <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, background: "var(--canvas,#efeeeb)", borderRadius: 7, padding: "0 8px", height: 28 }}>
          <span style={{ fontSize: 11, color: "var(--text-3,#8e8d88)" }}>gap</span>
          <input type="number" value={gap} placeholder="auto" min={0}
            onChange={(e) => setGap(e.target.value === "" ? "" : Math.max(0, parseInt(e.target.value) || 0))}
            style={{ width: "100%", minWidth: 0, border: 0, background: "transparent", fontSize: 12.5, color: "var(--t1,#1d1d1b)", outline: "none", fontFamily: "var(--font-mono, monospace)" }} />
        </div>
      </div>
    </div>
  );
}
