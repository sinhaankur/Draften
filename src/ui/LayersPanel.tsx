import { useEffect, useState } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

/**
 * LayersPanel — the real layers tree (Figma/Sketch have one; Excalidraw doesn't,
 * so it's ours). Lists every element on the canvas, newest on top. Click to
 * select it on the canvas; the eye toggles visibility. Grouped elements nest
 * under a "Group" row. Replaces the "Managed on the canvas" cop-out.
 */

type El = {
  id: string;
  type: string;
  text?: string;
  isDeleted?: boolean;
  opacity?: number;
  groupIds?: string[];
  frameId?: string | null;
  boundElements?: { id: string; type: string }[] | null;
  containerId?: string;
};

export function LayersPanel({ api }: { api: ExcalidrawImperativeAPI | null }) {
  const [els, setEls] = useState<El[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!api) return;
    let t = 0;
    const tick = () => {
      try {
        const scene = api.getSceneElements() as unknown as El[];
        // top-level only: skip bound text labels (they show inside their shape)
        const top = scene.filter((e) => !e.isDeleted && !e.containerId);
        setEls((prev) => (sameIds(prev, top) && sameMeta(prev, top) ? prev : top));
        const st = api.getAppState();
        const sel = new Set(Object.keys(st.selectedElementIds || {}).filter((k) => st.selectedElementIds[k]));
        setSelected((prev) => (sameSet(prev, sel) ? prev : sel));
      } catch { /* not ready */ }
      t = window.setTimeout(tick, 300) as unknown as number;
    };
    tick();
    return () => window.clearTimeout(t);
  }, [api]);

  if (!api) return <Hint>Canvas loading…</Hint>;
  if (els.length === 0) return <Hint>No layers yet — draw something, import a file, or pick a template.</Hint>;

  const select = (id: string, additive: boolean) => {
    const next = additive ? new Set(selected) : new Set<string>();
    if (additive && next.has(id)) next.delete(id); else next.add(id);
    const map: Record<string, true> = {};
    next.forEach((k) => (map[k] = true));
    api.updateScene({ appState: { ...api.getAppState(), selectedElementIds: map } });
    setSelected(next);
    const el = api.getSceneElements().find((e) => e.id === id);
    if (el) api.scrollToContent([el], { fitToContent: false, animate: true });
  };

  const toggleVisible = (id: string) => {
    const scene = api.getSceneElements().map((e) =>
      e.id === id ? { ...e, opacity: (e.opacity ?? 100) > 0 ? 0 : 100 } : e,
    );
    api.updateScene({ elements: scene as Parameters<typeof api.updateScene>[0]["elements"] });
  };

  // Group consecutive elements that share a group id under one collapsible row.
  const rows = buildRows(els);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1, padding: "2px 4px", maxHeight: 360, overflow: "auto" }}>
      {rows.map((r) => {
        const on = selected.has(r.id);
        const hidden = (r.opacity ?? 100) === 0;
        return (
          <div key={r.id}
            onClick={(e) => select(r.id, e.metaKey || e.shiftKey)}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 8px", paddingLeft: 8 + r.depth * 14,
              borderRadius: 6, cursor: "pointer", fontSize: 12.5,
              background: on ? "var(--acc-soft, #eaf1ee)" : "transparent",
              color: on ? "var(--accent, #3d6b5f)" : hidden ? "var(--text-3, #8e8d88)" : "var(--t1, #1d1d1b)",
              opacity: hidden ? 0.55 : 1, fontWeight: on ? 600 : 400 }}>
            <span style={{ flex: "none", width: 14, textAlign: "center", color: "var(--text-3, #8e8d88)" }}>{glyph(r.type)}</span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
            <button onClick={(e) => { e.stopPropagation(); toggleVisible(r.id); }} title={hidden ? "Show" : "Hide"}
              style={{ flex: "none", border: 0, background: "transparent", cursor: "pointer", color: "var(--text-3, #8e8d88)", fontSize: 12, width: 18 }}>
              {hidden ? "◌" : "👁"}
            </button>
          </div>
        );
      })}
    </div>
  );
}

type Row = { id: string; type: string; label: string; depth: number; opacity?: number };

function buildRows(els: El[]): Row[] {
  const rows: Row[] = [];
  // newest on top (design tools list reverse of paint order)
  const ordered = els.slice().reverse();
  const seenGroup = new Set<string>();
  for (const e of ordered) {
    const gid = e.groupIds && e.groupIds.length ? e.groupIds[e.groupIds.length - 1] : null;
    if (gid && !seenGroup.has(gid)) {
      seenGroup.add(gid);
      const members = ordered.filter((x) => (x.groupIds || []).includes(gid));
      rows.push({ id: gid, type: "group", label: `Group · ${members.length}`, depth: 0 });
      for (const m of members) rows.push({ id: m.id, type: m.type, label: nameOf(m, els), depth: 1, opacity: m.opacity });
    } else if (!gid) {
      rows.push({ id: e.id, type: e.type, label: nameOf(e, els), depth: 0, opacity: e.opacity });
    }
  }
  return rows;
}

function nameOf(e: El, all: El[]): string {
  if (e.type === "text" && e.text) return trim(e.text);
  // a shape with a bound label → show the label text
  const bound = (e.boundElements || []).find((b) => b.type === "text");
  if (bound) { const t = all.find((x) => x.id === bound.id); if (t?.text) return trim(t.text); }
  return cap(e.type);
}
const trim = (s: string) => { const one = s.replace(/\s+/g, " ").trim(); return one.length > 28 ? one.slice(0, 28) + "…" : one; };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function glyph(type: string): string {
  return { rectangle: "▭", ellipse: "◯", diamond: "◇", text: "T", arrow: "↗", line: "─", image: "🖼", frame: "⬚", group: "▣", freedraw: "✎" }[type] ?? "▪";
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "6px 10px", fontSize: 12, color: "var(--text-3, #8e8d88)", lineHeight: 1.5 }}>{children}</div>;
}

function sameIds(a: El[], b: El[]) { return a.length === b.length && a.every((x, i) => x.id === b[i].id); }
function sameMeta(a: El[], b: El[]) { return a.every((x, i) => x.opacity === b[i]?.opacity && x.text === b[i]?.text); }
function sameSet(a: Set<string>, b: Set<string>) { return a.size === b.size && [...a].every((x) => b.has(x)); }
