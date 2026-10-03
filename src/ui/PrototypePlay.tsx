import { useEffect, useState } from "react";
import { X, Play } from "lucide-react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

/**
 * PrototypePlay — a real, chrome-free preview of the design.
 *
 * "Play" renders the current canvas to SVG (via Excalidraw's exporter) and shows
 * it full-screen with no editor UI — the way you'd present a design. Device-frame
 * sizes (phone / tablet / desktop) let you see it at real widths. It's a genuine
 * preview, not a dead button. Esc closes it.
 */
export function PrototypePlay({ api, onClose }: { api: ExcalidrawImperativeAPI; onClose: () => void }) {
  const [svg, setSvg] = useState<string>("");
  const [frame, setFrame] = useState<"fit" | "phone" | "tablet" | "desktop">("fit");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { exportToSvg } = await import("@excalidraw/excalidraw");
        const el = await exportToSvg({
          elements: api.getSceneElements(),
          appState: { ...api.getAppState(), exportBackground: true, exportWithDarkMode: false },
          files: api.getFiles(),
        });
        // let it scale to its container
        el.removeAttribute("width");
        el.removeAttribute("height");
        el.setAttribute("style", "width:100%;height:100%;display:block");
        if (alive) setSvg(el.outerHTML);
      } catch { if (alive) setSvg("<p style='color:#888;padding:40px'>Nothing to preview yet.</p>"); }
    })();
    return () => { alive = false; };
  }, [api]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const frameW: Record<typeof frame, number | null> = { fit: null, phone: 390, tablet: 834, desktop: 1280 };
  const w = frameW[frame];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#1a1a18", display: "flex", flexDirection: "column" }}>
      {/* minimal play bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", color: "#fff" }}>
        <span style={{ fontWeight: 700, fontSize: 14, display: "inline-flex", alignItems: "center", gap: 6 }}><Play size={14} /> Preview</span>
        <div style={{ display: "flex", gap: 2, background: "rgba(255,255,255,.08)", borderRadius: 8, padding: 2, marginLeft: 8 }}>
          {(["fit", "phone", "tablet", "desktop"] as const).map((f) => (
            <button key={f} onClick={() => setFrame(f)}
              style={{ border: 0, cursor: "pointer", borderRadius: 6, padding: "4px 12px", fontSize: 12.5, fontWeight: 600, textTransform: "capitalize",
                background: frame === f ? "#fff" : "transparent", color: frame === f ? "#1a1a18" : "rgba(255,255,255,.72)" }}>
              {f}
            </button>
          ))}
        </div>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "rgba(255,255,255,.5)" }}>Esc to close</span>
        <button onClick={onClose} style={{ border: 0, background: "rgba(255,255,255,.1)", color: "#fff", borderRadius: 8, width: 30, height: 30, display: "grid", placeItems: "center", cursor: "pointer" }}>
          <X size={16} />
        </button>
      </div>

      {/* the design, framed */}
      <div style={{ flex: 1, overflow: "auto", display: "grid", placeItems: "center", padding: 24 }}>
        <div style={{ width: w ? w : "min(100%, 1400px)", maxWidth: "100%", background: "#fff", borderRadius: w ? 20 : 8, overflow: "hidden", boxShadow: "0 20px 60px -20px rgba(0,0,0,.6)" }}
          dangerouslySetInnerHTML={{ __html: svg }} />
      </div>
    </div>
  );
}
