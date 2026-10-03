import { motion } from "motion/react";
import { LayoutTemplate } from "lucide-react";

import { TEMPLATES, type TemplateDef } from "../templates/gallery";
import { overlay, scrim } from "./motion";

/**
 * Templates panel — a gallery of real starting points. Picking one draws its
 * laid-out screen onto the canvas (via the onPick callback the App wires to the
 * Excalidraw API). Every element is a real, editable layer afterwards.
 */
export function TemplatesPanel({ onClose, onPick }: { onClose: () => void; onPick: (t: TemplateDef) => void }) {
  return (
    <motion.div className="ai-overlay" onClick={onClose} {...scrim}>
      <motion.div className="ai-dialog" onClick={(e) => e.stopPropagation()} {...overlay} style={{ maxWidth: 680 }}>
        <div className="ai-title" style={{ display: "flex", alignItems: "center", gap: 7 }}><LayoutTemplate size={16} /> Templates</div>
        <p className="muted small">
          A real starting point — picked, it draws onto the canvas as editable layers.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 14 }}>
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => { onPick(t); onClose(); }}
              style={{
                textAlign: "left", border: "1px solid var(--line, #e7e6e2)", borderRadius: 12,
                padding: 14, background: "var(--surf, #fff)", cursor: "pointer", transition: "border-color .15s",
                display: "flex", flexDirection: "column", gap: 6,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--accent, #3d6b5f)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--line, #e7e6e2)")}
            >
              {/* mini wireframe preview */}
              <Preview id={t.id} />
              <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
              <div className="muted small" style={{ lineHeight: 1.5 }}>{t.blurb}</div>
              <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                {t.tags.map((tag) => (
                  <span key={tag} style={{ fontSize: 10, fontWeight: 600, color: "var(--accent, #3d6b5f)", background: "var(--acc-soft, #eaf1ee)", borderRadius: 999, padding: "1px 7px" }}>{tag}</span>
                ))}
              </div>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 16, textAlign: "right" }}>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** A tiny, abstract wireframe so each card reads at a glance. */
function Preview({ id }: { id: string }) {
  const box = { background: "var(--canvas, #efeeeb)", borderRadius: 8, height: 86, position: "relative" as const, overflow: "hidden" };
  const bar = (s: React.CSSProperties) => <span style={{ position: "absolute", background: "#c9c8c3", borderRadius: 3, ...s }} />;
  const acc = (s: React.CSSProperties) => <span style={{ position: "absolute", background: "#3d6b5f", borderRadius: 3, ...s }} />;
  const common: Record<string, React.ReactNode> = {
    signin: <>{bar({ left: "32%", top: 14, width: "36%", height: 10 })}{bar({ left: "32%", top: 34, width: "36%", height: 8 })}{bar({ left: "32%", top: 48, width: "36%", height: 8 })}{acc({ left: "32%", top: 64, width: "36%", height: 10 })}</>,
    dashboard: <>{bar({ left: 0, top: 0, bottom: 0, width: 22, background: "#2a2a28" })}{bar({ left: 30, top: 10, width: 18, height: 14 })}{bar({ left: 52, top: 10, width: 18, height: 14 })}{bar({ left: 74, top: 10, width: 18, height: 14 })}{bar({ left: 30, top: 30, right: 6, height: 48 })}</>,
    pricing: <>{acc({ left: "38%", top: 12, width: "24%", height: 62, background: "#3d6b5f" })}{bar({ left: "10%", top: 16, width: "22%", height: 54 })}{bar({ left: "68%", top: 16, width: "22%", height: 54 })}</>,
    mobile: <>{bar({ left: "8%", top: 10, width: 22, bottom: 10 })}{bar({ left: "40%", top: 10, width: 22, bottom: 10 })}{bar({ left: "72%", top: 10, width: 22, bottom: 10 })}</>,
    blank: <>{bar({ left: "40%", top: 8, width: 20, bottom: 8 })}</>,
    sinhaankur: <>{bar({ left: 0, top: 0, right: 0, bottom: 0, background: "#050505", borderRadius: 8 })}{bar({ left: 12, top: 30, width: "55%", height: 14, background: "#f5f5f0" })}{acc({ left: 12, top: 50, width: "20%", height: 14, background: "#e9b545" })}</>,
    vscode: <>{bar({ left: 0, top: 0, right: 0, bottom: 0, background: "#1e1e1e", borderRadius: 8 })}{bar({ left: 0, top: 0, bottom: 0, width: 12, background: "#333" })}{bar({ left: 12, top: 0, bottom: 0, width: 34, background: "#252526" })}{bar({ left: 52, top: 14, width: "20%", height: 6, background: "#555" })}{bar({ left: 52, top: 28, width: "44%", height: 6, background: "#777" })}{bar({ left: 52, top: 40, width: "32%", height: 6, background: "#555" })}{acc({ left: 0, bottom: 0, right: 0, height: 8, background: "#007acc" })}</>,
    fitness: <>{bar({ left: "34%", top: 0, width: "32%", bottom: 0, background: "#f4f3f0", borderRadius: 6 })}{acc({ left: "40%", top: 10, width: 20, height: 20, background: "transparent" })}{acc({ left: "40%", top: 10, width: 20, height: 20, background: "#3d6b5f", borderRadius: 99 })}{bar({ left: "38%", top: 38, width: "24%", height: 14 })}{bar({ left: "38%", top: 56, width: "24%", height: 12 })}</>,
  };
  return <div style={box}>{common[id]}</div>;
}
