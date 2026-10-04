import { useState } from "react";
import { Plus, Trash2, Pencil, Check, RotateCcw } from "lucide-react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { useDesignSystem, type ColorStyle, type TextStyle } from "../state/design-system";

/**
 * StylesPanel — the editable design system (Color styles + Text styles).
 *
 * Works like a real component library: it ships with PREBUILT styles so it's
 * never empty, and you can CREATE your own (new, or captured from the selected
 * layer), EDIT them inline (name, colour, size/weight), and DELETE them. Clicking
 * a style APPLIES it to the current selection. Everything persists.
 */
type Props = { api: ExcalidrawImperativeAPI | null };

export function StylesPanel({ api }: Props) {
  const { colors, texts, addColor, updateColor, removeColor, addText, updateText, removeText, resetToDefaults } = useDesignSystem();
  const [editingColor, setEditingColor] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string | null>(null);

  // selection helpers ---------------------------------------------------------
  const selected = () => {
    if (!api) return [];
    const st = api.getAppState();
    const ids = Object.keys(st.selectedElementIds || {}).filter((k) => st.selectedElementIds[k]);
    return api.getSceneElements().filter((e) => ids.includes(e.id) && !e.isDeleted);
  };

  const applyColor = (value: string) => {
    if (!api) return;
    const ids = selected().map((e) => e.id);
    if (!ids.length) return;
    const els = api.getSceneElements().map((e) =>
      ids.includes(e.id) ? (e.type === "text" ? { ...e, strokeColor: value } : { ...e, backgroundColor: value }) : e,
    );
    api.updateScene({ elements: els as Parameters<typeof api.updateScene>[0]["elements"] });
  };
  const applyText = (s: TextStyle) => {
    if (!api) return;
    const ids = selected().map((e) => e.id);
    const els = api.getSceneElements().map((e) =>
      ids.includes(e.id) && e.type === "text" ? { ...e, fontSize: s.size } : e,
    );
    api.updateScene({ elements: els as Parameters<typeof api.updateScene>[0]["elements"] });
  };

  // "add from selection" — capture the selected layer's fill as a new color style
  const addColorFromSelection = () => {
    const sel = selected()[0] as { backgroundColor?: string; strokeColor?: string; type?: string } | undefined;
    const value = sel ? (sel.type === "text" ? sel.strokeColor : sel.backgroundColor) || "#3d6b5f" : "#3d6b5f";
    addColor("New color", value && value !== "transparent" ? value : "#3d6b5f");
    setEditingColor(null);
  };

  return (
    <>
      {/* Color styles ------------------------------------------------------- */}
      <div className="section-title">
        Color styles
        <button className="ds-add" title="Add a color (from selection or default)" onClick={addColorFromSelection}><Plus size={13} /></button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, marginBottom: 12 }}>
        {colors.map((c) => (
          <ColorRow key={c.id} c={c}
            editing={editingColor === c.id}
            onApply={() => applyColor(c.value)}
            onEdit={() => setEditingColor(editingColor === c.id ? null : c.id)}
            onChange={(patch) => updateColor(c.id, patch)}
            onDelete={() => { removeColor(c.id); setEditingColor(null); }}
          />
        ))}
      </div>

      {/* Text styles -------------------------------------------------------- */}
      <div className="section-title">
        Text styles
        <button className="ds-add" title="Add a text style" onClick={() => { addText("New style", 16, 400); }}><Plus size={13} /></button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, marginBottom: 12 }}>
        {texts.map((t) => (
          <TextRow key={t.id} t={t}
            editing={editingText === t.id}
            onApply={() => applyText(t)}
            onEdit={() => setEditingText(editingText === t.id ? null : t.id)}
            onChange={(patch) => updateText(t.id, patch)}
            onDelete={() => { removeText(t.id); setEditingText(null); }}
          />
        ))}
      </div>

      <button className="ds-reset" onClick={resetToDefaults} title="Restore the prebuilt styles">
        <RotateCcw size={12} /> Reset to defaults
      </button>
    </>
  );
}

/* ── rows ─────────────────────────────────────────────────────────────────── */

function ColorRow({ c, editing, onApply, onEdit, onChange, onDelete }: {
  c: ColorStyle; editing: boolean; onApply: () => void; onEdit: () => void;
  onChange: (p: Partial<ColorStyle>) => void; onDelete: () => void;
}) {
  if (editing) {
    return (
      <div style={editBox}>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="color" value={/^#[0-9a-f]{6}$/i.test(c.value) ? c.value : "#3d6b5f"} onChange={(e) => onChange({ value: e.target.value })}
            style={{ width: 22, height: 22, border: "1px solid rgba(0,0,0,.12)", borderRadius: 5, padding: 0, background: "none", cursor: "pointer", flex: "none" }} />
          <input value={c.value.replace(/^#/, "").toUpperCase()} onChange={(e) => onChange({ value: "#" + e.target.value.replace(/[^0-9a-f]/gi, "").slice(0, 6) })}
            style={{ ...inp, width: 86, fontFamily: "var(--font-mono, monospace)" }} />
          <button onClick={onEdit} title="Done" style={iconBtn}><Check size={14} /></button>
          <button onClick={onDelete} title="Delete" style={{ ...iconBtn, color: "var(--danger,#d0453b)" }}><Trash2 size={13} /></button>
        </div>
        <input value={c.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Style name"
          style={{ ...inp, marginTop: 6 }} />
      </div>
    );
  }
  return (
    <div className="ds-row" style={row}>
      <button onClick={onApply} title={`Apply ${c.value} to selection`} style={applyBtn}>
        <span style={{ width: 16, height: 16, borderRadius: 4, background: c.value, border: "1px solid rgba(0,0,0,.1)", flex: "none" }} />
        <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
        <span style={mono}>{c.value}</span>
      </button>
      <button className="ds-edit on-hover" onClick={onEdit} title="Edit" style={iconBtn}><Pencil size={12} /></button>
    </div>
  );
}

function TextRow({ t, editing, onApply, onEdit, onChange, onDelete }: {
  t: TextStyle; editing: boolean; onApply: () => void; onEdit: () => void;
  onChange: (p: Partial<TextStyle>) => void; onDelete: () => void;
}) {
  if (editing) {
    return (
      <div style={editBox}>
        <input value={t.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="Style name" style={inp} />
        <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
          <label style={lbl}>Size</label>
          <input type="number" value={t.size} onChange={(e) => onChange({ size: Math.max(4, +e.target.value || 0) })} style={{ ...inp, width: 56 }} />
          <label style={lbl}>Weight</label>
          <select value={t.weight} onChange={(e) => onChange({ weight: +e.target.value })} style={{ ...inp, width: 72 }}>
            {[300, 400, 500, 600, 700, 800].map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
          <button onClick={onEdit} title="Done" style={iconBtn}><Check size={14} /></button>
          <button onClick={onDelete} title="Delete" style={{ ...iconBtn, color: "var(--danger,#d0453b)" }}><Trash2 size={13} /></button>
        </div>
      </div>
    );
  }
  return (
    <div className="ds-row" style={row}>
      <button onClick={onApply} title="Apply to selected text" style={applyBtn}>
        <span style={{ flex: 1, textAlign: "left", fontSize: Math.min(t.size, 16), fontWeight: t.weight, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</span>
        <span style={mono}>{t.size}/{t.weight}</span>
      </button>
      <button className="ds-edit on-hover" onClick={onEdit} title="Edit" style={iconBtn}><Pencil size={12} /></button>
    </div>
  );
}

/* ── styles ───────────────────────────────────────────────────────────────── */
const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 2, borderRadius: 6 };
const applyBtn: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0,
  border: 0, background: "transparent", cursor: "pointer", padding: "5px 6px",
  borderRadius: 6, fontSize: 12.5, color: "var(--t1, #1d1d1b)",
};
const iconBtn: React.CSSProperties = { border: 0, background: "transparent", cursor: "pointer", color: "var(--text-3,#8e8d88)", display: "grid", placeItems: "center", width: 24, height: 24, flex: "none", borderRadius: 5 };
const mono: React.CSSProperties = { fontFamily: "var(--font-mono, monospace)", fontSize: 10.5, color: "var(--text-3, #8e8d88)", flex: "none" };
const editBox: React.CSSProperties = { border: "1px solid var(--accent,#3d6b5f)", borderRadius: 8, padding: 8, background: "var(--surf,#fff)" };
const inp: React.CSSProperties = { width: "100%", border: "1px solid var(--line,#e7e6e2)", borderRadius: 6, padding: "4px 7px", fontSize: 12.5, background: "var(--canvas,#efeeeb)", color: "var(--t1,#1d1d1b)", outline: "none" };
const lbl: React.CSSProperties = { fontSize: 11, color: "var(--text-3,#8e8d88)", flex: "none" };
