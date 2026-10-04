import { useEffect, useState } from "react";
import { sceneCoordsToViewportCoords, viewportCoordsToSceneCoords } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { useAnnotations } from "../state/annotations-store";

/**
 * AnnotationLayer — numbered pins anchored to the canvas (design specs / review).
 *
 * Pins are stored in SCENE coordinates, so they stay stuck to the design as you
 * pan/zoom; this overlay converts each to screen space with Excalidraw's own
 * transform and draws a numbered marker. When "dropping" is armed, clicking the
 * canvas converts the click to scene space and drops the next pin, then opens its
 * note. Click any pin to edit/delete. The overlay only intercepts clicks while
 * dropping — otherwise it's pointer-transparent and never blocks designing.
 */
export function AnnotationLayer({ api }: { api: ExcalidrawImperativeAPI | null }) {
  const items = useAnnotations((s) => s.items);
  const dropping = useAnnotations((s) => s.dropping);
  const setDropping = useAnnotations((s) => s.setDropping);
  const add = useAnnotations((s) => s.add);
  const update = useAnnotations((s) => s.update);
  const remove = useAnnotations((s) => s.remove);

  const [view, setView] = useState({ scrollX: 0, scrollY: 0, zoom: 1, offsetLeft: 0, offsetTop: 0 });
  const [editing, setEditing] = useState<string | null>(null);

  // keep the viewport transform fresh so pins track pan/zoom
  useEffect(() => {
    if (!api) return;
    let raf = 0;
    const tick = () => {
      try {
        const st = api.getAppState() as unknown as { scrollX: number; scrollY: number; zoom: { value: number }; offsetLeft: number; offsetTop: number };
        setView((v) => {
          const next = { scrollX: st.scrollX, scrollY: st.scrollY, zoom: st.zoom.value, offsetLeft: st.offsetLeft, offsetTop: st.offsetTop };
          return (v.scrollX === next.scrollX && v.scrollY === next.scrollY && v.zoom === next.zoom && v.offsetLeft === next.offsetLeft) ? v : next;
        });
      } catch { /* not ready */ }
      raf = window.setTimeout(tick, 90) as unknown as number;
    };
    tick();
    return () => window.clearTimeout(raf);
  }, [api]);

  // Esc cancels drop mode
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && dropping) setDropping(false); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [dropping, setDropping]);

  const vp = { zoom: { value: view.zoom }, offsetLeft: view.offsetLeft, offsetTop: view.offsetTop, scrollX: view.scrollX, scrollY: view.scrollY } as unknown as Parameters<typeof sceneCoordsToViewportCoords>[1];
  const toScreen = (x: number, y: number) => sceneCoordsToViewportCoords({ sceneX: x, sceneY: y }, vp);

  const onDropClick = (e: React.MouseEvent) => {
    if (!dropping) return;
    const scene = viewportCoordsToSceneCoords({ clientX: e.clientX, clientY: e.clientY }, vp);
    const id = add(Math.round(scene.x), Math.round(scene.y));
    setDropping(false);
    setEditing(id);
  };

  // when nothing to show and not dropping, render nothing
  if (!items.length && !dropping) return null;

  return (
    <div
      onClick={onDropClick}
      style={{ position: "fixed", inset: 0, zIndex: 6, pointerEvents: dropping ? "auto" : "none", cursor: dropping ? "crosshair" : "default" }}
    >
      {dropping && (
        <div style={{ position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)", background: "#1d1d1b", color: "#fff", fontSize: 12.5, padding: "6px 12px", borderRadius: 8, pointerEvents: "none" }}>
          Click where you want the note · Esc to cancel
        </div>
      )}

      {items.map((p) => {
        const s = toScreen(p.x, p.y);
        return (
          <div key={p.id} style={{ position: "fixed", left: s.x, top: s.y, transform: "translate(-50%, -100%)", pointerEvents: "auto" }}>
            {/* the pin */}
            <button
              onClick={(e) => { e.stopPropagation(); setEditing(editing === p.id ? null : p.id); }}
              title={p.text || `Annotation ${p.n}`}
              style={{ width: 24, height: 24, borderRadius: "50% 50% 50% 2px", transform: "rotate(45deg)", border: "2px solid #fff", background: "#e5a000", color: "#1d1d1b", fontWeight: 700, fontSize: 12, cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,.25)", display: "grid", placeItems: "center" }}>
              <span style={{ transform: "rotate(-45deg)" }}>{p.n}</span>
            </button>

            {/* the note bubble (open while editing) */}
            {editing === p.id && (
              <div onClick={(e) => e.stopPropagation()}
                style={{ position: "absolute", top: 28, left: "50%", transform: "translateX(-50%)", width: 220, background: "var(--panel,#fbfbfa)", border: "1px solid var(--line,#e7e6e2)", borderRadius: 10, boxShadow: "0 10px 30px -10px rgba(0,0,0,.3)", padding: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#e5a000" }}>Note {p.n}</span>
                  <button onClick={() => { remove(p.id); setEditing(null); }} title="Delete note" aria-label="Delete note"
                    style={{ marginLeft: "auto", border: 0, background: "transparent", cursor: "pointer", color: "var(--text-3,#8e8d88)", fontSize: 15, lineHeight: 1, width: 28, height: 28, display: "grid", placeItems: "center", borderRadius: 6 }}>×</button>
                </div>
                <textarea autoFocus value={p.text} onChange={(e) => update(p.id, { text: e.target.value })}
                  placeholder="Spec or feedback…" rows={3}
                  style={{ width: "100%", resize: "vertical", border: "1px solid var(--line,#e7e6e2)", borderRadius: 7, padding: "7px 9px", fontSize: 12.5, fontFamily: "inherit", background: "var(--surf,#fff)", color: "var(--t1,#1d1d1b)" }} />
                <div style={{ textAlign: "right", marginTop: 6 }}>
                  <button onClick={() => setEditing(null)} style={{ border: 0, background: "var(--accent,#3d6b5f)", color: "#fff", borderRadius: 7, padding: "5px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Done</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
