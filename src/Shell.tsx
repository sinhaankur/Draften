import { useState } from "react";
import { App } from "./App";

/**
 * Shell — the real, functional Draften is the app. Full stop.
 *
 * Earlier the window DEFAULTED to a static render of the v2 mockup, which looked
 * complete but nothing in it worked — confusing. Fixed: the functional React App is
 * now the one and only app. The v2 mockup is kept only as an optional, clearly-
 * labelled "Preview design" reference (a read-only look at the target), never
 * pretending to be the working product.
 */
const KEY = "draften-preview-design";

export function Shell() {
  const [preview, setPreview] = useState<boolean>(() => localStorage.getItem(KEY) === "1");
  const toggle = () => { const v = !preview; setPreview(v); localStorage.setItem(KEY, v ? "1" : "0"); };

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      {/* the real app — always mounted */}
      <App />

      {/* optional read-only design reference, clearly labelled as a preview */}
      {preview && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9000, background: "var(--bg)" }}>
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 32, zIndex: 1,
            display: "flex", alignItems: "center", gap: 8, padding: "0 12px",
            background: "rgba(30,28,24,.85)", color: "#fff", fontSize: 12, fontFamily: "Geist, system-ui, sans-serif",
          }}>
            <span style={{ fontWeight: 600 }}>Design preview</span>
            <span style={{ opacity: 0.7 }}>read-only reference — not the working app</span>
            <button onClick={toggle} style={{ marginLeft: "auto", border: 0, background: "#3d6b5f", color: "#fff", borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontWeight: 600 }}>
              Back to app
            </button>
          </div>
          <iframe title="Draften v2 design (preview)" src="/v2/app.html"
            style={{ position: "absolute", top: 32, left: 0, right: 0, bottom: 0, width: "100%", height: "calc(100% - 32px)", border: 0 }} />
        </div>
      )}

      {/* a single, honest reference link — not a "views" toggle */}
      {!preview && (
        <button onClick={toggle} title="See the target design (read-only)"
          style={{
            position: "fixed", right: 12, bottom: 12, zIndex: 9999,
            border: 0, cursor: "pointer", borderRadius: 999, padding: "6px 14px",
            fontSize: 12, fontWeight: 600, fontFamily: "Geist, system-ui, sans-serif",
            background: "rgba(30,28,24,.72)", color: "rgba(255,255,255,.85)",
            backdropFilter: "blur(10px)", boxShadow: "0 4px 16px rgba(0,0,0,.25)",
          }}>
          Design preview
        </button>
      )}
    </div>
  );
}
