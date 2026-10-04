import { useEffect, useState } from "react";
import { Square, Circle, Diamond, Type, MoveUpRight, Minus, Image, Frame, Dot, Plus, Trash2, Pipette } from "lucide-react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { type LayerEffects, type DropShadow, type BlendMode, DEFAULT_SHADOW, effectStyle } from "../canvas/effects";

/**
 * InspectPanel — the real properties inspector.
 *
 * Reads the CURRENTLY SELECTED element off the live Excalidraw scene and shows
 * its real geometry + style. The common fields (position, size, colors, text,
 * corner radius) are editable and write straight back to the canvas via
 * updateScene — so Inspect actually inspects and edits, not a placeholder.
 *
 * Multi-select shows a count + the shared basics; no selection shows guidance.
 */

type Props = { api: ExcalidrawImperativeAPI | null };

// The slice of an Excalidraw element we read/write. Excalidraw's element type is
// a big union; we only touch these well-known fields.
type El = {
  id: string;
  type: string;
  x: number; y: number;
  width: number; height: number;
  angle?: number;
  strokeColor?: string;
  strokeWidth?: number;
  backgroundColor?: string;
  opacity?: number;
  roundness?: { type: number } | null;
  text?: string;
  fontSize?: number;
  customData?: { effects?: LayerEffects } | null;
};

const BLEND_MODES: BlendMode[] = ["normal", "multiply", "screen", "overlay", "darken", "lighten", "soft-light", "hard-light", "difference", "exclusion", "color", "luminosity"];

export function InspectPanel({ api }: Props) {
  const [sel, setSel] = useState<El[]>([]);
  const [, force] = useState(0);

  // Poll selection from the live scene (Excalidraw doesn't expose a selection
  // subscription; a light interval keeps the panel in sync without coupling).
  useEffect(() => {
    if (!api) return;
    let raf = 0;
    const tick = () => {
      try {
        const st = api.getAppState();
        const ids = Object.keys(st.selectedElementIds || {}).filter((k) => st.selectedElementIds[k]);
        const els = api.getSceneElements().filter((e) => ids.includes(e.id) && !e.isDeleted) as unknown as El[];
        setSel((prev) => (sameSel(prev, els) ? prev : els));
      } catch { /* scene not ready */ }
      raf = window.setTimeout(tick, 250) as unknown as number;
    };
    tick();
    return () => window.clearTimeout(raf);
  }, [api]);

  if (!api) return <Empty text="Canvas is loading…" />;
  if (sel.length === 0) return <Empty text="Select a layer on the canvas to inspect its size, position and style." />;

  if (sel.length > 1) {
    return (
      <div style={pane}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: "var(--text-3, #8e8d88)" }}>Selected</span><span style={{ fontWeight: 600 }}>{sel.length} layers</span></div>
        <p style={{ fontSize: 12, color: "var(--text-3, #8e8d88)", marginTop: 8 }}>
          Multi-select. Pick a single layer to edit its properties, or move/align them together on the canvas.
        </p>
      </div>
    );
  }

  const el = sel[0];

  // Patch the selected element in the live scene, then nudge our own render.
  const patch = (fields: Partial<El>) => {
    const elements = api.getSceneElements().map((e) =>
      e.id === el.id ? ({ ...e, ...fields, version: (e as unknown as { version: number }).version + 1 }) : e,
    );
    api.updateScene({ elements: elements as Parameters<typeof api.updateScene>[0]["elements"] });
    setSel([{ ...el, ...fields }]);
    force((n) => n + 1);
  };

  const hasFill = el.type === "rectangle" || el.type === "ellipse" || el.type === "diamond";
  const isText = el.type === "text";

  // Effects live in customData.effects (survive convert/export; emitted as CSS).
  const fx: LayerEffects = el.customData?.effects ?? {};
  const patchEffects = (next: LayerEffects) => {
    patch({ customData: { ...(el.customData ?? {}), effects: next } } as Partial<El>);
  };
  const addShadow = () => patchEffects({ ...fx, shadows: [...(fx.shadows ?? []), { ...DEFAULT_SHADOW }] });
  const updateShadow = (i: number, s: Partial<DropShadow>) => {
    const shadows = (fx.shadows ?? []).map((sh, j) => (j === i ? { ...sh, ...s } : sh));
    patchEffects({ ...fx, shadows });
  };
  const removeShadow = (i: number) => patchEffects({ ...fx, shadows: (fx.shadows ?? []).filter((_, j) => j !== i) });

  return (
    <div style={pane}>
      {/* identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ display: "grid", placeItems: "center", color: "var(--accent, #3d6b5f)" }}><Glyph type={el.type} /></span>
        <span style={{ fontWeight: 600, textTransform: "capitalize" }}>{el.type}</span>
        <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono, monospace)", fontSize: 11, color: "var(--text-3, #8e8d88)" }}>
          {el.id.slice(0, 6)}
        </span>
      </div>

      {/* Position (Figma): X · Y · rotation */}
      <Section title="Position">
        <div style={grid2}>
          <Field label="X" value={el.x} onChange={(v) => patch({ x: v })} />
          <Field label="Y" value={el.y} onChange={(v) => patch({ y: v })} />
        </div>
        <div style={{ ...grid2, marginTop: 6 }}>
          <Field label="↻" value={Math.round(((el.angle ?? 0) * 180) / Math.PI)} suffix="°" onChange={(v) => patch({ angle: (v * Math.PI) / 180 })} />
          <div />
        </div>
      </Section>

      {/* Layout (Figma): W · H · corner radius */}
      <Section title="Layout">
        <div style={grid2}>
          <Field label="W" value={el.width} onChange={(v) => patch({ width: Math.max(1, v) })} />
          <Field label="H" value={el.height} onChange={(v) => patch({ height: Math.max(1, v) })} />
        </div>
        {hasFill && (
          <div style={{ ...grid2, marginTop: 6 }}>
            <Field label="⌜ ⌝" value={el.roundness ? 10 : 0} onChange={(v) => patch({ roundness: v > 0 ? { type: 3 } : null })} />
            <div />
          </div>
        )}
      </Section>

      {/* Appearance: opacity as a Sketch-style slider + number */}
      <Section title="Appearance">
        <OpacityRow value={Math.round(el.opacity ?? 100)} onChange={(v) => patch({ opacity: Math.min(100, Math.max(0, v)) })} />
      </Section>

      {/* Fill (Figma): color hex + opacity */}
      {hasFill && (
        <Section title="Fill">
          <FillRow value={el.backgroundColor && el.backgroundColor !== "transparent" ? el.backgroundColor : "#ffffff"} onChange={(v) => patch({ backgroundColor: v })} api={api} />
        </Section>
      )}

      {/* Stroke (Sketch/Figma): color + width */}
      <Section title="Stroke">
        <FillRow value={el.strokeColor ?? "#1d1d1b"} onChange={(v) => patch({ strokeColor: v })} api={api} />
        <div style={{ ...grid2, marginTop: 6 }}>
          <Field label="Weight" value={el.strokeWidth ?? 1} suffix="px" onChange={(v) => patch({ strokeWidth: Math.max(0, v) })} />
          <div />
        </div>
      </Section>

      {/* Text */}
      {isText && (
        <Section title="Text">
          <textarea
            value={el.text ?? ""}
            onChange={(e) => patch({ text: e.target.value })}
            rows={3}
            style={{ width: "100%", resize: "vertical", borderRadius: 8, border: "1px solid var(--line, #e7e6e2)", padding: "8px 10px", fontSize: 13, fontFamily: "inherit", background: "var(--surf, #fff)", color: "var(--t1, #1d1d1b)" }}
          />
          <div style={{ marginTop: 6 }}>
            <Field label="Size" value={el.fontSize ?? 16} onChange={(v) => patch({ fontSize: Math.max(4, v) })} />
          </div>
        </Section>
      )}

      {/* Effects (Sketch/Figma): shadows · blur · blend — stored as data, exported as CSS */}
      <Section title="Effects">
        {/* live preview chip so you SEE the shadow/blur/blend */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 40, height: 28, borderRadius: 6, background: el.backgroundColor && el.backgroundColor !== "transparent" ? el.backgroundColor : "var(--accent,#3d6b5f)", ...effectStyle(fx) }} />
          <span style={{ fontSize: 11.5, color: "var(--text-3,#8e8d88)" }}>Live preview</span>
        </div>

        {(fx.shadows ?? []).map((s, i) => (
          <div key={i} style={{ border: "1px solid var(--line,#e7e6e2)", borderRadius: 8, padding: 8, marginBottom: 6, background: "var(--surf,#fff)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <select value={s.kind} onChange={(e) => updateShadow(i, { kind: e.target.value as DropShadow["kind"] })}
                style={{ flex: 1, border: "1px solid var(--line,#e7e6e2)", borderRadius: 6, padding: "3px 6px", fontSize: 11.5, background: "var(--canvas,#efeeeb)", color: "var(--t1,#1d1d1b)" }}>
                <option value="drop">Drop shadow</option>
                <option value="inner">Inner shadow</option>
              </select>
              <button onClick={() => removeShadow(i)} title="Remove" style={{ border: 0, background: "transparent", color: "var(--text-3,#8e8d88)", cursor: "pointer", display: "grid", placeItems: "center" }}><Trash2 size={13} /></button>
            </div>
            <div style={grid2}>
              <Field label="X" value={s.x} onChange={(v) => updateShadow(i, { x: v })} />
              <Field label="Y" value={s.y} onChange={(v) => updateShadow(i, { y: v })} />
            </div>
            <div style={{ ...grid2, marginTop: 6 }}>
              <Field label="Blur" value={s.blur} onChange={(v) => updateShadow(i, { blur: Math.max(0, v) })} />
              <Field label="Spread" value={s.spread} onChange={(v) => updateShadow(i, { spread: v })} />
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
              <div style={{ flex: 1 }}><FillRow value={s.color} onChange={(v) => updateShadow(i, { color: v })} api={api} /></div>
              <div style={{ width: 72 }}><Field label="%" value={s.opacity} onChange={(v) => updateShadow(i, { opacity: Math.min(100, Math.max(0, v)) })} /></div>
            </div>
          </div>
        ))}
        <button onClick={addShadow}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", border: "1px dashed var(--line,#e7e6e2)", borderRadius: 7, padding: "6px", fontSize: 12, color: "var(--text-2,#5d5c58)", background: "transparent", cursor: "pointer" }}>
          <Plus size={13} /> Add shadow
        </button>

        <div style={{ ...grid2, marginTop: 8 }}>
          <Field label="Blur" value={fx.blur ?? 0} suffix="px" onChange={(v) => patchEffects({ ...fx, blur: Math.max(0, v) })} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--canvas,#efeeeb)", borderRadius: 7, padding: "3px 8px" }}>
            <span style={{ fontSize: 11, color: "var(--text-3,#8e8d88)", flex: "none" }}>Blend</span>
            <select value={fx.blend ?? "normal"} onChange={(e) => patchEffects({ ...fx, blend: e.target.value as BlendMode })}
              style={{ flex: 1, minWidth: 0, border: 0, background: "transparent", fontSize: 11.5, color: "var(--t1,#1d1d1b)", outline: "none", textTransform: "capitalize" }}>
              {BLEND_MODES.map((m) => <option key={m} value={m}>{m.replace("-", " ")}</option>)}
            </select>
          </div>
        </div>
      </Section>

      <button
        onClick={() => {
          const elements = api.getSceneElements().map((e) =>
            e.id === el.id ? ({ ...e, isDeleted: true }) : e,
          );
          api.updateScene({ elements: elements as Parameters<typeof api.updateScene>[0]["elements"] });
          setSel([]);
        }}
        style={{ marginTop: 14, width: "100%", border: "1px solid #e6b4b4", color: "#b23b3b", background: "transparent", borderRadius: 8, padding: "8px", fontWeight: 600, cursor: "pointer", fontSize: 13 }}
      >
        Delete layer
      </button>
    </div>
  );
}

/* ── small presentational helpers ─────────────────────────────────────────── */

const pane: React.CSSProperties = { padding: 16, fontSize: 13, color: "var(--t1, #1d1d1b)" };
const grid2: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 };

function Empty({ text }: { text: string }) {
  return <div style={{ padding: 16, fontSize: 12.5, lineHeight: 1.6, color: "var(--text-3, #8e8d88)" }}>{text}</div>;
}

/* Figma-style inspector sections: a titled block with a hairline divider above. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: "12px 0", borderTop: "1px solid var(--line, #e7e6e2)" }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--t1, #1d1d1b)", marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

/* Opacity: a Sketch-style slider + a number box that stay in sync. */
function OpacityRow({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <input type="range" min={0} max={100} value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        style={{ flex: 1, accentColor: "var(--accent, #3d6b5f)", height: 4, cursor: "pointer" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 2, background: "var(--canvas, #efeeeb)", borderRadius: 7, padding: "5px 8px", width: 64 }}>
        <input type="number" min={0} max={100} value={value}
          onChange={(e) => { const v = parseInt(e.target.value); if (!Number.isNaN(v)) onChange(Math.min(100, Math.max(0, v))); }}
          style={{ width: "100%", minWidth: 0, border: 0, background: "transparent", fontSize: 12.5, color: "var(--t1, #1d1d1b)", fontFamily: "var(--font-mono, monospace)", outline: "none", textAlign: "right" }} />
        <span style={{ fontSize: 11, color: "var(--text-3, #8e8d88)" }}>%</span>
      </div>
    </div>
  );
}

/* A labelled numeric field (Figma style: label inside, light fill). */
function Field({ label, value, suffix, onChange }: { label: string; value: number; suffix?: string; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--canvas, #efeeeb)", borderRadius: 7, padding: "5px 8px" }}>
      <span style={{ fontSize: 11, color: "var(--text-3, #8e8d88)", flex: "none", minWidth: 14 }}>{label}</span>
      <input type="number" value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
        onChange={(e) => { const v = parseFloat(e.target.value); if (!Number.isNaN(v)) onChange(v); }}
        style={{ flex: 1, minWidth: 0, border: 0, background: "transparent", fontSize: 12.5, color: "var(--t1, #1d1d1b)", fontFamily: "var(--font-mono, monospace)", outline: "none" }} />
      {suffix && <span style={{ fontSize: 11, color: "var(--text-3, #8e8d88)" }}>{suffix}</span>}
    </div>
  );
}

/* A Figma fill/stroke row: swatch · hex · native eyedropper · opacity.
   The swatch is a native <input type="color"> — on macOS that opens the real
   system color panel (P3-aware, with the OS eyedropper). The pipette button uses
   the native EyeDropper API (WebKit/Chromium) to sample ANY pixel on screen —
   the prebuilt macOS color-sampling, invoked rather than re-implemented. */
function FillRow({ value, onChange, api: _api }: { value: string; onChange: (v: string) => void; api?: ExcalidrawImperativeAPI | null }) {
  const canPick = typeof window !== "undefined" && "EyeDropper" in window;
  const pick = async () => {
    try {
      const Ctor = (window as unknown as { EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> } }).EyeDropper;
      const res = await new Ctor().open();
      if (res?.sRGBHex) onChange(res.sRGBHex);
    } catch { /* user cancelled */ }
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--canvas, #efeeeb)", borderRadius: 7, padding: "5px 8px" }}>
      <input type="color" value={toHex(value)} onChange={(e) => onChange(e.target.value)} title="Open the system color panel"
        style={{ width: 20, height: 20, border: "1px solid rgba(0,0,0,.12)", borderRadius: 4, padding: 0, background: "none", cursor: "pointer", flex: "none" }} />
      <input value={value.replace(/^#/, "").toUpperCase()} onChange={(e) => onChange("#" + e.target.value.replace(/[^0-9a-f]/gi, ""))}
        style={{ flex: 1, minWidth: 0, border: 0, background: "transparent", fontSize: 12.5, color: "var(--t1, #1d1d1b)", fontFamily: "var(--font-mono, monospace)", outline: "none", textTransform: "uppercase" }} />
      {canPick && (
        <button onClick={pick} title="Sample a colour from anywhere on screen (eyedropper)"
          style={{ border: 0, background: "transparent", cursor: "pointer", color: "var(--text-3, #8e8d88)", display: "grid", placeItems: "center", flex: "none", padding: 0 }}>
          <Pipette size={13} />
        </button>
      )}
      <span style={{ fontSize: 11.5, color: "var(--text-3, #8e8d88)" }}>100%</span>
    </div>
  );
}

/** Vector (lucide) icon per element type — matches the design system. */
function Glyph({ type }: { type: string }) {
  const sz = 15;
  switch (type) {
    case "rectangle": return <Square size={sz} />;
    case "ellipse": return <Circle size={sz} />;
    case "diamond": return <Diamond size={sz} />;
    case "text": return <Type size={sz} />;
    case "arrow": return <MoveUpRight size={sz} />;
    case "line": return <Minus size={sz} />;
    case "image": return <Image size={sz} />;
    case "frame": return <Frame size={sz} />;
    default: return <Dot size={sz} />;
  }
}

function toHex(c: string): string {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  if (/^#[0-9a-f]{3}$/i.test(c)) return "#" + c.slice(1).split("").map((x) => x + x).join("");
  return "#000000"; // the native color input needs a hex; the text field keeps the real value
}

function sameSel(a: El[], b: El[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (x.id !== y.id || x.x !== y.x || x.y !== y.y || x.width !== y.width || x.height !== y.height ||
      x.strokeColor !== y.strokeColor || x.strokeWidth !== y.strokeWidth || x.backgroundColor !== y.backgroundColor || x.text !== y.text ||
      x.angle !== y.angle || x.opacity !== y.opacity || x.fontSize !== y.fontSize) return false;
  }
  return true;
}
