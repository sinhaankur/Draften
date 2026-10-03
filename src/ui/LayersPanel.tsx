import { useEffect, useState } from "react";
import { Eye, EyeOff, Square, Circle, Diamond, Type, MoveUpRight, Minus, Image, Frame, Group, PenLine, Dot, ChevronRight, ChevronDown } from "lucide-react";
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
  name?: string | null;
  customData?: { name?: string } | null;
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
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

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

  const rows = buildRows(els, collapsed);
  const toggleCollapse = (id: string) => setCollapsed((c) => { const n = new Set(c); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1, padding: "2px 4px", maxHeight: 420, overflow: "auto" }}>
      {rows.map((r) => {
        const on = selected.has(r.id);
        const hidden = (r.opacity ?? 100) === 0;
        const isFrame = r.type === "frame";
        return (
          <div key={r.id}
            onClick={(e) => select(r.id, e.metaKey || e.shiftKey)}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 8px", paddingLeft: 6 + r.depth * 16,
              borderRadius: 6, cursor: "pointer", fontSize: 12.5,
              background: on ? "var(--acc-soft, #eaf1ee)" : "transparent",
              color: on ? "var(--accent, #3d6b5f)" : hidden ? "var(--text-3, #8e8d88)" : "var(--t1, #1d1d1b)",
              opacity: hidden ? 0.55 : 1, fontWeight: on || isFrame ? 600 : 400 }}>
            {/* collapse chevron for frames; spacer otherwise so labels align */}
            {isFrame ? (
              <button onClick={(e) => { e.stopPropagation(); toggleCollapse(r.id); }}
                style={{ flex: "none", border: 0, background: "transparent", cursor: "pointer", color: "var(--text-3, #8e8d88)", display: "grid", placeItems: "center", width: 14, height: 14, padding: 0 }}>
                {collapsed.has(r.id) ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
              </button>
            ) : <span style={{ width: 14, flex: "none" }} />}
            <span style={{ flex: "none", width: 15, display: "grid", placeItems: "center", color: on || isFrame ? "var(--accent, #3d6b5f)" : "var(--text-3, #8e8d88)" }}><Glyph type={r.type} /></span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
            <button onClick={(e) => { e.stopPropagation(); toggleVisible(r.id); }} title={hidden ? "Show" : "Hide"}
              style={{ flex: "none", border: 0, background: "transparent", cursor: "pointer", color: "var(--text-3, #8e8d88)", display: "grid", placeItems: "center", width: 20, height: 20, padding: 0 }}>
              {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        );
      })}
    </div>
  );
}

type Row = { id: string; type: string; label: string; depth: number; opacity?: number };

/**
 * The layers TREE (SketchApp/Figma style): frames (artboards) at the top, their
 * children nested beneath, then any loose elements + groups. Newest on top.
 */
function buildRows(els: El[], collapsed: Set<string>): Row[] {
  const rows: Row[] = [];
  const ordered = els.slice().reverse(); // newest first
  const frames = ordered.filter((e) => e.type === "frame");
  const framed = new Set<string>();

  // 1) each frame + its children nested under it
  for (const f of frames) {
    rows.push({ id: f.id, type: "frame", label: nameOf(f, els), depth: 0, opacity: f.opacity });
    if (collapsed.has(f.id)) { ordered.forEach((e) => { if (e.frameId === f.id) framed.add(e.id); }); continue; }
    const kids = ordered.filter((e) => e.frameId === f.id && e.type !== "frame");
    for (const k of kids) { framed.add(k.id); rows.push({ id: k.id, type: k.type, label: nameOf(k, els), depth: 1, opacity: k.opacity }); }
  }

  // 2) loose elements (not in a frame), grouped where they share a group id
  const seenGroup = new Set<string>();
  for (const e of ordered) {
    if (e.type === "frame" || framed.has(e.id)) continue;
    const gid = e.groupIds && e.groupIds.length ? e.groupIds[e.groupIds.length - 1] : null;
    if (gid && !seenGroup.has(gid)) {
      seenGroup.add(gid);
      const members = ordered.filter((x) => !x.frameId && (x.groupIds || []).includes(gid));
      rows.push({ id: gid, type: "group", label: `Group · ${members.length}`, depth: 0 });
      for (const m of members) rows.push({ id: m.id, type: m.type, label: nameOf(m, els), depth: 1, opacity: m.opacity });
    } else if (!gid) {
      rows.push({ id: e.id, type: e.type, label: nameOf(e, els), depth: 0, opacity: e.opacity });
    }
  }
  return rows;
}

function nameOf(e: El, all: El[]): string {
  if (e.customData?.name) return trim(e.customData.name); // layer name (survives convert)
  if (e.name) return trim(e.name);                        // frames carry a real name
  if (e.type === "text" && e.text) return trim(e.text);
  const bound = (e.boundElements || []).find((b) => b.type === "text");
  if (bound) { const t = all.find((x) => x.id === bound.id); if (t?.text) return trim(t.text); }
  return cap(e.type);
}
const trim = (s: string) => { const one = s.replace(/\s+/g, " ").trim(); return one.length > 28 ? one.slice(0, 28) + "…" : one; };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A real vector (lucide) icon per element type — matches the design system. */
function Glyph({ type }: { type: string }) {
  const sz = 13;
  switch (type) {
    case "rectangle": return <Square size={sz} />;
    case "ellipse": return <Circle size={sz} />;
    case "diamond": return <Diamond size={sz} />;
    case "text": return <Type size={sz} />;
    case "arrow": return <MoveUpRight size={sz} />;
    case "line": return <Minus size={sz} />;
    case "image": return <Image size={sz} />;
    case "frame": return <Frame size={sz} />;
    case "group": return <Group size={sz} />;
    case "freedraw": return <PenLine size={sz} />;
    default: return <Dot size={sz} />;
  }
}

function Hint({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: "6px 10px", fontSize: 12, color: "var(--text-3, #8e8d88)", lineHeight: 1.5 }}>{children}</div>;
}

function sameIds(a: El[], b: El[]) { return a.length === b.length && a.every((x, i) => x.id === b[i].id); }
function sameMeta(a: El[], b: El[]) { return a.every((x, i) => x.opacity === b[i]?.opacity && x.text === b[i]?.text); }
function sameSet(a: Set<string>, b: Set<string>) { return a.size === b.size && [...a].every((x) => b.has(x)); }
