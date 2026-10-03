import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

/**
 * StylesPanel — Color styles + Text styles (the design-system spine, v2).
 *
 * Named, reusable styles. Clicking one APPLIES it to the current selection on the
 * canvas (fill/stroke for colors; font size/weight for text) — the real Sketch
 * working: define once, apply everywhere. Styles come from the design tokens so
 * they stay in sync with the brand.
 */

type Props = { api: ExcalidrawImperativeAPI | null; colors: Record<string, string> };

// The brand color styles (named). Falls back to the house palette when the
// design system hasn't generated tokens yet.
const DEFAULT_COLORS: { name: string; value: string }[] = [
  { name: "Brand / Primary", value: "#3d6b5f" },
  { name: "Brand / Primary Dark", value: "#2f5349" },
  { name: "Accent", value: "#e9b545" },
  { name: "Ink", value: "#1d1d1b" },
  { name: "Muted", value: "#8e8d88" },
  { name: "Surface", value: "#ffffff" },
  { name: "Line", value: "#e7e6e2" },
];

const TEXT_STYLES: { name: string; size: number; weight: number }[] = [
  { name: "Display", size: 32, weight: 700 },
  { name: "Heading", size: 22, weight: 600 },
  { name: "Subheading", size: 17, weight: 600 },
  { name: "Body", size: 15, weight: 400 },
  { name: "Caption", size: 12, weight: 400 },
];

export function StylesPanel({ api, colors }: Props) {
  const colorStyles = Object.keys(colors).length
    ? ["brand.500", "brand.700", "accent.500", "neutral.900", "neutral.500", "neutral.100"]
        .filter((k) => colors[k])
        .map((k) => ({ name: k.replace(".", " / "), value: colors[k] }))
    : DEFAULT_COLORS;

  const applyColor = (value: string) => {
    if (!api) return;
    const st = api.getAppState();
    const ids = Object.keys(st.selectedElementIds || {}).filter((k) => st.selectedElementIds[k]);
    if (!ids.length) return;
    const els = api.getSceneElements().map((e) => {
      if (!ids.includes(e.id)) return e;
      // text → stroke color; shapes → fill
      return e.type === "text" ? { ...e, strokeColor: value } : { ...e, backgroundColor: value };
    });
    api.updateScene({ elements: els as Parameters<typeof api.updateScene>[0]["elements"] });
  };

  const applyText = (s: { size: number; weight: number }) => {
    if (!api) return;
    const st = api.getAppState();
    const ids = Object.keys(st.selectedElementIds || {}).filter((k) => st.selectedElementIds[k]);
    const els = api.getSceneElements().map((e) =>
      ids.includes(e.id) && e.type === "text" ? { ...e, fontSize: s.size } : e,
    );
    api.updateScene({ elements: els as Parameters<typeof api.updateScene>[0]["elements"] });
  };

  return (
    <>
      <div className="section-title">Color styles</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, marginBottom: 10 }}>
        {colorStyles.map((c) => (
          <button key={c.name} onClick={() => applyColor(c.value)} title={`Apply ${c.value} to selection`}
            style={row}>
            <span style={{ width: 16, height: 16, borderRadius: 4, background: c.value, border: "1px solid rgba(0,0,0,.1)", flex: "none" }} />
            <span style={{ flex: 1, textAlign: "left" }}>{c.name}</span>
            <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10.5, color: "var(--text-3, #8e8d88)" }}>{c.value}</span>
          </button>
        ))}
      </div>

      <div className="section-title">Text styles</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 1, marginBottom: 10 }}>
        {TEXT_STYLES.map((s) => (
          <button key={s.name} onClick={() => applyText(s)} title="Apply to selected text" style={row}>
            <span style={{ flex: 1, textAlign: "left", fontSize: Math.min(s.size, 16), fontWeight: s.weight }}>{s.name}</span>
            <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10.5, color: "var(--text-3, #8e8d88)" }}>{s.size}/{s.weight}</span>
          </button>
        ))}
      </div>
    </>
  );
}

const row: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, width: "100%",
  border: 0, background: "transparent", cursor: "pointer", padding: "5px 6px",
  borderRadius: 6, fontSize: 12.5, color: "var(--t1, #1d1d1b)",
};
