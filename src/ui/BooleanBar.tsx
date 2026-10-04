import { useEffect, useState } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { booleanCombine, pathToLineSkeleton, type BoolOp, type GeomEl } from "../canvas/boolean-ops";

/**
 * BooleanBar — combine the selected shapes (Union · Subtract · Intersect ·
 * Difference), the Sketch/Figma "combine shapes" feature Excalidraw lacks.
 *
 * Shows only when 2+ shapes are selected. Runs the op (see canvas/boolean-ops.ts),
 * removes the source shapes, and drops the resulting vector path in as a real,
 * editable `line` layer. Union merges; Subtract cuts later shapes from the first;
 * Intersect keeps the overlap; Difference (Exclude) keeps the non-overlap.
 */
const OPS: { op: BoolOp; label: string; icon: React.ReactNode; title: string }[] = [
  { op: "union",     label: "Union",     title: "Merge into one shape",          icon: <BoolIcon kind="union" /> },
  { op: "subtract",  label: "Subtract",  title: "Cut later shapes from the first", icon: <BoolIcon kind="subtract" /> },
  { op: "intersect", label: "Intersect", title: "Keep only the overlap",          icon: <BoolIcon kind="intersect" /> },
  { op: "exclude",   label: "Difference", title: "Keep everything but the overlap", icon: <BoolIcon kind="exclude" /> },
];

const COMBINABLE = new Set(["rectangle", "ellipse", "diamond", "line", "freedraw", "polygon"]);

export function BooleanBar({ api }: { api: ExcalidrawImperativeAPI | null }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!api) return;
    let t = 0;
    const tick = () => {
      try {
        const st = api.getAppState();
        const ids = Object.keys(st.selectedElementIds || {}).filter((k) => st.selectedElementIds[k]);
        const els = api.getSceneElements().filter((e) => ids.includes(e.id) && !e.isDeleted && COMBINABLE.has(e.type));
        setCount((c) => (c === els.length ? c : els.length));
      } catch { /* not ready */ }
      t = window.setTimeout(tick, 300) as unknown as number;
    };
    tick();
    return () => window.clearTimeout(t);
  }, [api]);

  if (!api || count < 2) return null;

  const run = async (op: BoolOp) => {
    const st = api.getAppState();
    const ids = Object.keys(st.selectedElementIds || {}).filter((k) => st.selectedElementIds[k]);
    const scene = api.getSceneElements();
    const sel = scene.filter((e) => ids.includes(e.id) && !e.isDeleted && COMBINABLE.has(e.type)) as unknown as GeomEl[];
    if (sel.length < 2) return;

    const result = booleanCombine(sel, op);
    if (!result) { return; } // op produced nothing (e.g. no overlap on intersect)

    const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");
    const name = `${op[0].toUpperCase()}${op.slice(1)} shape`;
    const skeletons = result.paths.map((path) => pathToLineSkeleton(path, result.styleFrom, name));
    const fresh = convertToExcalidrawElements(skeletons as Parameters<typeof convertToExcalidrawElements>[0]);

    // remove the source shapes, add the combined result
    const kept = scene.map((e) => (ids.includes(e.id) ? { ...e, isDeleted: true } : e));
    api.updateScene({ elements: [...kept, ...fresh] as Parameters<typeof api.updateScene>[0]["elements"] });

    // select the new result
    const map: Record<string, true> = {};
    fresh.forEach((f) => (map[f.id] = true));
    api.updateScene({ appState: { ...api.getAppState(), selectedElementIds: map } });
  };

  return (
    <div style={{ marginTop: 10 }}>
      <div className="section-title">Combine · {count} shapes</div>
      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
        {OPS.map((o) => (
          <button key={o.op} title={o.title} onClick={() => run(o.op)}
            style={{ flex: 1, display: "grid", placeItems: "center", height: 30, border: "1px solid var(--line,#e7e6e2)", background: "var(--surf,#fff)", color: "var(--t1,#1d1d1b)", borderRadius: 7, cursor: "pointer" }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent,#3d6b5f)")}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--line,#e7e6e2)")}>
            {o.icon}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Two-circle boolean glyphs, drawn to read at a glance (Sketch-style). */
function BoolIcon({ kind }: { kind: BoolOp }) {
  const a = { cx: 9, cy: 12, r: 5.5 };
  const b = { cx: 15, cy: 12, r: 5.5 };
  const stroke = "var(--t2,#5d5c58)";
  const fill = "var(--accent,#3d6b5f)";
  if (kind === "union") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24">
        <circle cx={a.cx} cy={a.cy} r={a.r} fill={fill} opacity="0.9" />
        <circle cx={b.cx} cy={b.cy} r={b.r} fill={fill} opacity="0.9" />
      </svg>
    );
  }
  if (kind === "subtract") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24">
        <circle cx={a.cx} cy={a.cy} r={a.r} fill={fill} opacity="0.9" />
        <circle cx={b.cx} cy={b.cy} r={b.r} fill="var(--surf,#fff)" stroke={stroke} strokeWidth="1.2" />
      </svg>
    );
  }
  if (kind === "intersect") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24">
        <circle cx={a.cx} cy={a.cy} r={a.r} fill="none" stroke={stroke} strokeWidth="1.2" />
        <circle cx={b.cx} cy={b.cy} r={b.r} fill="none" stroke={stroke} strokeWidth="1.2" />
        <clipPath id="ix"><circle cx={a.cx} cy={a.cy} r={a.r} /></clipPath>
        <circle cx={b.cx} cy={b.cy} r={b.r} fill={fill} opacity="0.9" clipPath="url(#ix)" />
      </svg>
    );
  }
  // exclude / difference
  return (
    <svg width="18" height="18" viewBox="0 0 24 24">
      <circle cx={a.cx} cy={a.cy} r={a.r} fill={fill} opacity="0.9" />
      <circle cx={b.cx} cy={b.cy} r={b.r} fill={fill} opacity="0.9" />
      <clipPath id="ex"><circle cx={a.cx} cy={a.cy} r={a.r} /></clipPath>
      <circle cx={b.cx} cy={b.cy} r={b.r} fill="var(--surf,#fff)" clipPath="url(#ex)" />
    </svg>
  );
}
