import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Lock, Unlock, Square, Circle, Diamond, Type, MoveUpRight, Minus, Image, Frame, Group, PenLine, Dot, ChevronRight, ChevronDown, Plus, Copy, Trash2, ArrowUpToLine, ArrowDownToLine, Pencil, SquareDashedBottom } from "lucide-react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { drawSkeletonOnCanvas } from "../canvas/apply-action";
import { renameLayer, setLocked, deleteLayer, duplicateLayer, bringToFront, sendToBack, moveTo, wrapInArtboard } from "../canvas/layer-actions";

// New-artboard size presets (v2: iPhone / Desktop / Tablet / Custom).
const ARTBOARD_PRESETS = [
  { name: "iPhone 16 Pro", w: 393, h: 852 },
  { name: "iPhone SE", w: 375, h: 667 },
  { name: "Android", w: 412, h: 915 },
  { name: "Tablet", w: 834, h: 1194 },
  { name: "Desktop", w: 1440, h: 1024 },
  { name: "Square", w: 1080, h: 1080 },
];

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
  width?: number;
  height?: number;
  isDeleted?: boolean;
  opacity?: number;
  locked?: boolean;
  groupIds?: string[];
  frameId?: string | null;
  boundElements?: { id: string; type: string }[] | null;
  containerId?: string;
};

type Menu = { id: string; x: number; y: number; locked: boolean } | null;

export function LayersPanel({ api }: { api: ExcalidrawImperativeAPI | null }) {
  const [els, setEls] = useState<El[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [addMenu, setAddMenu] = useState(false);
  const [menu, setMenu] = useState<Menu>(null);        // right-click context menu
  const [editing, setEditing] = useState<string | null>(null); // inline rename
  const [dragId, setDragId] = useState<string | null>(null);   // drag-to-reorder
  const draftName = useRef("");
  const addArtboardRef = useRef<(w: number, h: number, name: string) => void>(() => {});

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

  // Dismiss the context menu on any outside click or Escape.
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(null); };
    window.addEventListener("click", close);
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("click", close); window.removeEventListener("keydown", key); };
  }, [menu]);

  // Press "A" to drop a new artboard (Sketch/Figma convention) — declared here,
  // BEFORE any early return, so the hook count is stable. Calls the latest
  // addArtboard via a ref. Ignored while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || (el as HTMLElement).isContentEditable)) return;
      if (e.key === "a" || e.key === "A") {
        e.preventDefault();
        const p = ARTBOARD_PRESETS[0];
        addArtboardRef.current(p.w, p.h, p.name);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  const toggleLock = (id: string) => {
    const el = api.getSceneElements().find((e) => e.id === id) as unknown as El | undefined;
    setLocked(api, id, !el?.locked);
  };

  // Open the context menu at the cursor for a layer row.
  const openMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault(); e.stopPropagation();
    const el = api.getSceneElements().find((x) => x.id === id) as unknown as El | undefined;
    setMenu({ id, x: e.clientX, y: e.clientY, locked: !!el?.locked });
  };

  // Commit an inline rename.
  const commitRename = (id: string) => {
    const name = draftName.current.trim();
    if (name) renameLayer(api, id, name);
    setEditing(null);
  };

  // Wrap the selected loose layers into a new artboard.
  const wrapSelection = () => {
    const ids = [...selected];
    if (ids.length) wrapInArtboard(api, ids, "Artboard");
  };

  const rows = buildRows(els, collapsed);
  const toggleCollapse = (id: string) => setCollapsed((c) => { const n = new Set(c); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const frames = els.filter((e) => e.type === "frame" && !e.isDeleted);
  // selected layers that aren't frames and aren't already inside a frame → wrappable
  const looseSelected = els.filter((e) => selected.has(e.id) && e.type !== "frame" && !e.frameId);

  // Add a new artboard (a real frame) to the right of existing content.
  const addArtboard = (w: number, h: number, name: string) => {
    if (!api) return;
    const existing = api.getSceneElements().filter((e) => !(e as unknown as El).isDeleted);
    const maxX = existing.reduce((m, e) => Math.max(m, (e.x ?? 0) + (e.width ?? 0)), 0);
    const x = existing.length ? maxX + 60 : 80;
    const y = 80;
    const sheetId = `ab-sheet-${Math.random().toString(36).slice(2, 8)}`;
    // A REAL artboard: a soft shadow + a SOLID white sheet (fillStyle:solid, or it
    // renders hatched/transparent) + the frame container — so it actually shows as
    // a white card, not an empty outline. The sheet is the frame's child.
    void drawSkeletonOnCanvas([
      { type: "rectangle", name: "Shadow", x: x - 2, y: y + 6, width: w + 4, height: h + 2, roughness: 0, fillStyle: "solid", strokeColor: "transparent", backgroundColor: "#8a8a8a", opacity: 22, strokeWidth: 0, roundness: { type: 3 } },
      { id: sheetId, type: "rectangle", name: "Artboard", x, y, width: w, height: h, roughness: 0, fillStyle: "solid", strokeColor: "#e9e9e9", backgroundColor: "#ffffff", strokeWidth: 1 },
      { type: "frame", name, x, y, width: w, height: h, children: [sheetId] },
    ]);
  };
  addArtboardRef.current = addArtboard; // keep the "A" shortcut pointing at the live fn

  return (
   <>
    {/* Artboards — a distinct section (v2) with New-artboard presets */}
    <div style={{ padding: "0 4px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "4px 8px", position: "relative" }}>
          <span style={{ flex: 1, fontSize: 11.5, fontWeight: 500, color: "var(--text-3, #8e8d88)" }}>Artboards</span>
          <button title="New artboard" aria-label="New artboard" onClick={() => setAddMenu((v) => !v)} className="row-icon-btn"
            style={{ width: 28, height: 28, border: 0, borderRadius: 6, background: "transparent", color: "var(--text-3, #8e8d88)", cursor: "pointer", display: "grid", placeItems: "center" }}>
            <Plus size={14} />
          </button>
          {addMenu && (
            <div style={{ position: "absolute", top: "100%", right: 6, zIndex: 50, width: 180, background: "var(--panel, #fbfbfa)", border: "1px solid var(--line, #e7e6e2)", borderRadius: 9, boxShadow: "0 8px 24px -8px rgba(0,0,0,.25)", padding: 4 }}>
              <div style={{ padding: "4px 8px", fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-3, #8e8d88)" }}>New artboard</div>
              {ARTBOARD_PRESETS.map((pr) => (
                <button key={pr.name} onClick={() => { addArtboard(pr.w, pr.h, pr.name); setAddMenu(false); }}
                  style={{ display: "flex", justifyContent: "space-between", width: "100%", border: 0, background: "transparent", cursor: "pointer", padding: "6px 8px", borderRadius: 6, fontSize: 12.5, color: "var(--t1, #1d1d1b)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover, #f0efec)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                  <span>{pr.name}</span>
                  <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10.5, color: "var(--text-3, #8e8d88)" }}>{pr.w}×{pr.h}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {frames.length === 0 && <div style={{ padding: "2px 8px", fontSize: 12, color: "var(--text-3, #8e8d88)" }}>No artboards — add one with +</div>}
        {frames.map((f) => {
          const on = selected.has(f.id);
          return (
            <div key={f.id} onClick={(e) => select(f.id, e.metaKey || e.shiftKey)}
              style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 8px", borderRadius: 6, cursor: "pointer", fontSize: 12.5,
                background: on ? "var(--acc-soft, #eaf1ee)" : "transparent", color: on ? "var(--accent, #3d6b5f)" : "var(--t1, #1d1d1b)", fontWeight: on ? 600 : 400 }}>
              <span style={{ flex: "none", display: "grid", placeItems: "center", color: on ? "var(--accent, #3d6b5f)" : "var(--text-3, #8e8d88)" }}><Frame size={14} /></span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nameOf(f, els)}</span>
              <span style={{ flex: "none", fontFamily: "var(--font-mono, monospace)", fontSize: 10.5, color: "var(--text-3, #8e8d88)" }}>
                {Math.round(f.width ?? 0)}×{Math.round(f.height ?? 0)}
              </span>
            </div>
          );
        })}
      </div>
    {/* Layers — the full nested tree */}
    <div style={{ display: "flex", alignItems: "center", padding: "4px 8px 0", borderTop: "1px solid var(--line, #e7e6e2)" }}>
      <span style={{ flex: 1, fontSize: 11.5, fontWeight: 500, color: "var(--text-3, #8e8d88)" }}>Layers</span>
      {looseSelected.length >= 1 && (
        <button title="Wrap selection in an artboard" onClick={wrapSelection}
          style={{ display: "flex", alignItems: "center", gap: 4, border: 0, background: "transparent", color: "var(--accent, #3d6b5f)", cursor: "pointer", fontSize: 11, fontWeight: 600, padding: "2px 4px" }}>
          <SquareDashedBottom size={12} /> Wrap
        </button>
      )}
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 1, padding: "2px 4px", maxHeight: 420, overflow: "auto" }}>
      {rows.map((r) => {
        const on = selected.has(r.id);
        const hidden = (r.opacity ?? 100) === 0;
        const locked = !!r.locked;
        const isFrame = r.type === "frame";
        const dragging = dragId === r.id;
        return (
          <div key={r.id}
            draggable={editing !== r.id}
            onDragStart={() => setDragId(r.id)}
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => { e.preventDefault(); if (dragId && dragId !== r.id) moveTo(api, dragId, r.id); setDragId(null); }}
            onDragEnd={() => setDragId(null)}
            onClick={(e) => { if (editing !== r.id) select(r.id, e.metaKey || e.shiftKey); }}
            onDoubleClick={(e) => { e.stopPropagation(); draftName.current = r.label; setEditing(r.id); }}
            onContextMenu={(e) => openMenu(e, r.id)}
            className="layer-row"
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 8px", paddingLeft: 6 + r.depth * 16,
              borderRadius: 6, cursor: "pointer", fontSize: 12.5,
              background: on ? "var(--acc-soft, #eaf1ee)" : "transparent",
              color: on ? "var(--accent, #3d6b5f)" : hidden || locked ? "var(--text-3, #8e8d88)" : "var(--t1, #1d1d1b)",
              opacity: hidden ? 0.55 : 1, fontWeight: on || isFrame ? 600 : 400,
              outline: dragging ? "1.5px dashed var(--accent,#3d6b5f)" : "none" }}>
            {/* collapse chevron for frames; spacer otherwise so labels align.
                14px glyph, but a ≥20px hit area so it's easy to click (Fitts). */}
            {isFrame ? (
              <button onClick={(e) => { e.stopPropagation(); toggleCollapse(r.id); }}
                title={collapsed.has(r.id) ? "Expand" : "Collapse"} aria-label={collapsed.has(r.id) ? "Expand group" : "Collapse group"}
                style={{ flex: "none", border: 0, background: "transparent", cursor: "pointer", color: "var(--text-3, #8e8d88)", display: "grid", placeItems: "center", width: 20, height: 22, margin: "0 -3px", padding: 0 }}>
                {collapsed.has(r.id) ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
              </button>
            ) : <span style={{ width: 14, flex: "none" }} />}
            <span style={{ flex: "none", width: 15, display: "grid", placeItems: "center", color: on || isFrame ? "var(--accent, #3d6b5f)" : "var(--text-3, #8e8d88)" }}><Glyph type={r.type} /></span>
            {editing === r.id ? (
              <input autoFocus defaultValue={r.label}
                onChange={(e) => { draftName.current = e.target.value; }}
                onBlur={() => commitRename(r.id)}
                onKeyDown={(e) => { if (e.key === "Enter") commitRename(r.id); if (e.key === "Escape") setEditing(null); }}
                onClick={(e) => e.stopPropagation()}
                style={{ flex: 1, minWidth: 0, border: "1px solid var(--accent,#3d6b5f)", borderRadius: 5, padding: "1px 5px", fontSize: 12.5, background: "var(--surf,#fff)", color: "var(--t1,#1d1d1b)" }} />
            ) : (
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.label}</span>
            )}
            {/* lock — always visible when locked, on hover otherwise (CSS class) */}
            <button onClick={(e) => { e.stopPropagation(); toggleLock(r.id); }} title={locked ? "Unlock" : "Lock"} aria-label={locked ? "Unlock layer" : "Lock layer"}
              className={`row-icon-btn ${locked ? "" : "on-hover"}`} style={rowIconBtn}>
              {locked ? <Lock size={13} /> : <Unlock size={13} />}
            </button>
            <button onClick={(e) => { e.stopPropagation(); toggleVisible(r.id); }} title={hidden ? "Show" : "Hide"} aria-label={hidden ? "Show layer" : "Hide layer"}
              className="row-icon-btn" style={rowIconBtn}>
              {hidden ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        );
      })}
    </div>

    {/* Context menu (right-click a layer) — Figma/Sketch layer actions */}
    {menu && (
      <div role="menu" onClick={(e) => e.stopPropagation()}
        style={{ position: "fixed", top: Math.min(menu.y, window.innerHeight - 260), left: Math.min(menu.x, window.innerWidth - 200),
          zIndex: 1000, width: 190, background: "var(--panel,#fbfbfa)", border: "1px solid var(--line,#e7e6e2)", borderRadius: 9,
          boxShadow: "0 10px 30px -8px rgba(0,0,0,.28)", padding: 4 }}>
        <MenuItem icon={<Pencil size={13} />} label="Rename" onClick={() => { const lbl = rows.find((x) => x.id === menu.id)?.label ?? ""; draftName.current = lbl; setEditing(menu.id); setMenu(null); }} />
        <MenuItem icon={<Copy size={13} />} label="Duplicate" onClick={() => { duplicateLayer(api, menu.id); setMenu(null); }} />
        <MenuItem icon={menu.locked ? <Unlock size={13} /> : <Lock size={13} />} label={menu.locked ? "Unlock" : "Lock"} onClick={() => { toggleLock(menu.id); setMenu(null); }} />
        <div style={{ height: 1, background: "var(--line,#e7e6e2)", margin: "4px 0" }} />
        <MenuItem icon={<ArrowUpToLine size={13} />} label="Bring to front" onClick={() => { bringToFront(api, menu.id); setMenu(null); }} />
        <MenuItem icon={<ArrowDownToLine size={13} />} label="Send to back" onClick={() => { sendToBack(api, menu.id); setMenu(null); }} />
        <div style={{ height: 1, background: "var(--line,#e7e6e2)", margin: "4px 0" }} />
        <MenuItem icon={<Trash2 size={13} />} label="Delete" danger onClick={() => { deleteLayer(api, menu.id); setMenu(null); }} />
      </div>
    )}
   </>
  );
}

function MenuItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button role="menuitem" onClick={onClick}
      style={{ display: "flex", alignItems: "center", gap: 9, width: "100%", border: 0, background: "transparent", cursor: "pointer",
        padding: "7px 9px", borderRadius: 6, fontSize: 12.5, color: danger ? "var(--danger,#d0453b)" : "var(--t1,#1d1d1b)", textAlign: "left" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover,#f0efec)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
      <span style={{ display: "grid", placeItems: "center", color: danger ? "var(--danger,#d0453b)" : "var(--text-3,#8e8d88)" }}>{icon}</span>
      {label}
    </button>
  );
}

type Row = { id: string; type: string; label: string; depth: number; opacity?: number; locked?: boolean };

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
    rows.push({ id: f.id, type: "frame", label: nameOf(f, els), depth: 0, opacity: f.opacity, locked: f.locked });
    if (collapsed.has(f.id)) { ordered.forEach((e) => { if (e.frameId === f.id) framed.add(e.id); }); continue; }
    const kids = ordered.filter((e) => e.frameId === f.id && e.type !== "frame");
    for (const k of kids) { framed.add(k.id); rows.push({ id: k.id, type: k.type, label: nameOf(k, els), depth: 1, opacity: k.opacity, locked: k.locked }); }
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
      for (const m of members) rows.push({ id: m.id, type: m.type, label: nameOf(m, els), depth: 1, opacity: m.opacity, locked: m.locked });
    } else if (!gid) {
      rows.push({ id: e.id, type: e.type, label: nameOf(e, els), depth: 0, opacity: e.opacity, locked: e.locked });
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

// A 28×28 hit area around a 13–14px icon (Fitts/WCAG tap target), icon stays small.
const rowIconBtn: React.CSSProperties = {
  flex: "none", border: 0, background: "transparent", cursor: "pointer",
  color: "var(--text-3, #8e8d88)", display: "grid", placeItems: "center",
  width: 28, height: 28, padding: 0, borderRadius: 6,
};

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
