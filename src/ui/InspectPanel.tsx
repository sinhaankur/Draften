import { useEffect, useState } from "react";
import { Square, Circle, Diamond, Type, MoveUpRight, Minus, Image, Frame, Dot } from "lucide-react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

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
  backgroundColor?: string;
  opacity?: number;
  roundness?: { type: number } | null;
  text?: string;
  fontSize?: number;
};

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

      {/* Appearance (Figma): opacity · blend */}
      <Section title="Appearance">
        <Field label="Opacity" value={Math.round(el.opacity ?? 100)} suffix="%" onChange={(v) => patch({ opacity: Math.min(100, Math.max(0, v)) })} />
      </Section>

      {/* Fill (Figma): color hex + opacity */}
      {hasFill && (
        <Section title="Fill">
          <FillRow value={el.backgroundColor && el.backgroundColor !== "transparent" ? el.backgroundColor : "#ffffff"} onChange={(v) => patch({ backgroundColor: v })} />
        </Section>
      )}

      {/* Stroke (Figma): color + width */}
      <Section title="Stroke">
        <FillRow value={el.strokeColor ?? "#1d1d1b"} onChange={(v) => patch({ strokeColor: v })} />
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

/* A Figma fill/stroke row: swatch · hex · opacity. */
function FillRow({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--canvas, #efeeeb)", borderRadius: 7, padding: "5px 8px" }}>
      <input type="color" value={toHex(value)} onChange={(e) => onChange(e.target.value)}
        style={{ width: 20, height: 20, border: "1px solid rgba(0,0,0,.12)", borderRadius: 4, padding: 0, background: "none", cursor: "pointer", flex: "none" }} />
      <input value={value.replace(/^#/, "").toUpperCase()} onChange={(e) => onChange("#" + e.target.value.replace(/[^0-9a-f]/gi, ""))}
        style={{ flex: 1, minWidth: 0, border: 0, background: "transparent", fontSize: 12.5, color: "var(--t1, #1d1d1b)", fontFamily: "var(--font-mono, monospace)", outline: "none", textTransform: "uppercase" }} />
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
      x.strokeColor !== y.strokeColor || x.backgroundColor !== y.backgroundColor || x.text !== y.text ||
      x.angle !== y.angle || x.opacity !== y.opacity || x.fontSize !== y.fontSize) return false;
  }
  return true;
}
