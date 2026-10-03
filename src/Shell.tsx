import { useState } from "react";
import { App } from "./App";

/**
 * Shell — chooses what fills the window.
 *
 * "Render the mockup directly": by default we show the approved v2 design exactly
 * as designed (design/Draften v2.dc.html, served from /v2/app.html with its own
 * runtime) in a full-window iframe — so the app LOOKS like v2 with nothing missing.
 * A small floating toggle switches to the functional React app (the real,
 * interactive Draften we're building behind the design). Preference persists.
 *
 * As the React app reaches parity with the mockup, this can flip its default.
 */
const KEY = "draften-view-mode";

export function Shell() {
  const [mode, setMode] = useState<"design" | "app">(
    () => (localStorage.getItem(KEY) as "design" | "app") || "design",
  );
  const set = (m: "design" | "app") => { setMode(m); localStorage.setItem(KEY, m); };

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      {mode === "design" ? (
        <iframe
          title="Draften v2 design"
          src="/v2/app.html"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
        />
      ) : (
        <App />
      )}

      {/* floating view toggle — design (the mockup) ↔ app (functional) */}
      <div style={{
        position: "fixed", right: 12, bottom: 12, zIndex: 9999,
        display: "flex", gap: 2, padding: 3, borderRadius: 999,
        background: "rgba(30,28,24,.72)", backdropFilter: "blur(10px)",
        boxShadow: "0 4px 16px rgba(0,0,0,.25)",
      }}>
        {(["design", "app"] as const).map((m) => (
          <button key={m} onClick={() => set(m)}
            style={{
              border: 0, cursor: "pointer", borderRadius: 999, padding: "5px 12px",
              fontSize: 12, fontWeight: 600, fontFamily: "Geist, system-ui, sans-serif",
              background: mode === m ? "#3d6b5f" : "transparent",
              color: mode === m ? "#fff" : "rgba(255,255,255,.72)",
            }}>
            {m === "design" ? "Design" : "App"}
          </button>
        ))}
      </div>
    </div>
  );
}
