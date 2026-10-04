import { useCallback, useEffect, useMemo, useState } from "react";
import { X, ChevronLeft, ChevronRight, StickyNote } from "lucide-react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { useEditor } from "../state/store";

/**
 * PresentMode — a real fullscreen slide show, the "use it instead of PowerPoint"
 * payoff. Each board with a frame is one slide; we render ONLY that slide's
 * elements (those inside its frame) to SVG and fit it to the screen. Arrow keys /
 * click / space advance; Esc exits; a thumbnail rail lets you jump; speaker notes
 * (board.notes) show on a toggle. Chrome-free — just the deck.
 */
export function PresentMode({ api, onClose }: { api: ExcalidrawImperativeAPI; onClose: () => void }) {
  const doc = useEditor((s) => s.doc);
  const slides = useMemo(() => (doc.boards ?? []).filter((b) => b.frame), [doc.boards]);
  const [i, setI] = useState(0);
  const [svg, setSvg] = useState("");
  const [showNotes, setShowNotes] = useState(false);
  const [showRail, setShowRail] = useState(true);

  const clamp = useCallback((n: number) => Math.max(0, Math.min(slides.length - 1, n)), [slides.length]);
  const go = useCallback((n: number) => setI((cur) => clamp(typeof n === "number" ? n : cur)), [clamp]);

  // render the current slide's elements to an SVG fitted to the viewport
  useEffect(() => {
    let alive = true;
    (async () => {
      const slide = slides[i];
      if (!slide?.frame) { setSvg(""); return; }
      const { exportToSvg } = await import("@excalidraw/excalidraw");
      const f = slide.frame;
      // elements whose centre is inside this slide's frame
      const inSlide = api.getSceneElements().filter((e) => {
        const el = e as unknown as { x: number; y: number; width: number; height: number; isDeleted?: boolean };
        if (el.isDeleted) return false;
        const cx = el.x + (el.width ?? 0) / 2, cy = el.y + (el.height ?? 0) / 2;
        return cx >= f.x && cx <= f.x + f.width && cy >= f.y && cy <= f.y + f.height;
      });
      try {
        const out = await exportToSvg({
          elements: inSlide as never,
          appState: { ...api.getAppState(), exportBackground: true, exportWithDarkMode: false, viewBackgroundColor: slide.background ?? "#ffffff" },
          files: api.getFiles(),
          exportPadding: 0,
        });
        out.removeAttribute("width");
        out.removeAttribute("height");
        out.setAttribute("viewBox", `${f.x} ${f.y} ${f.width} ${f.height}`);
        out.setAttribute("preserveAspectRatio", "xMidYMid meet");
        out.setAttribute("style", "width:100%;height:100%;display:block");
        if (alive) setSvg(out.outerHTML);
      } catch { if (alive) setSvg(""); }
    })();
    return () => { alive = false; };
  }, [api, slides, i]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") { e.preventDefault(); setI((c) => clamp(c + 1)); }
      if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); setI((c) => clamp(c - 1)); }
      if (e.key === "Home") setI(0);
      if (e.key === "End") setI(slides.length - 1);
      if (e.key.toLowerCase() === "n") setShowNotes((v) => !v);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [clamp, onClose, slides.length]);

  const slide = slides[i];
  const notes = (slide as { notes?: string } | undefined)?.notes ?? "";

  if (!slides.length) {
    return (
      <div style={backdrop}>
        <div style={{ color: "#aaa", fontSize: 15 }}>No slides to present. Import a document and “Make presentation”, or add boards.</div>
        <button onClick={onClose} style={closeBtn}><X size={18} /></button>
      </div>
    );
  }

  return (
    <div style={backdrop}>
      <button onClick={onClose} title="Exit (Esc)" style={closeBtn}><X size={18} /></button>

      {/* the slide */}
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", padding: showRail ? "3vh 4vw 16vh" : "4vh 4vw" }}>
        <div style={{ width: "min(92vw, calc(88vh * 16 / 9))", aspectRatio: "16 / 9", background: slide?.background ?? "#fff", boxShadow: "0 24px 80px rgba(0,0,0,.5)", borderRadius: 6, overflow: "hidden" }}
          onClick={() => setI((c) => clamp(c + 1))}
          dangerouslySetInnerHTML={{ __html: svg }} />
      </div>

      {/* prev / next */}
      <button onClick={() => go(i - 1)} disabled={i === 0} style={{ ...arrow, left: 16 }}><ChevronLeft size={26} /></button>
      <button onClick={() => go(i + 1)} disabled={i === slides.length - 1} style={{ ...arrow, right: 16 }}><ChevronRight size={26} /></button>

      {/* speaker notes */}
      {showNotes && (
        <div style={{ position: "absolute", left: "50%", bottom: showRail ? 150 : 24, transform: "translateX(-50%)", maxWidth: "60vw", background: "rgba(20,20,20,.92)", color: "#ddd", borderRadius: 10, padding: "12px 16px", fontSize: 14, lineHeight: 1.5 }}>
          {notes || <span style={{ color: "#777" }}>No notes for this slide. Press N to hide.</span>}
        </div>
      )}

      {/* bottom bar: counter + notes toggle */}
      <div style={{ position: "absolute", bottom: showRail ? 124 : 18, left: 20, display: "flex", gap: 12, alignItems: "center", color: "#bbb", fontSize: 13 }}>
        <span style={{ fontFamily: "monospace" }}>{i + 1} / {slides.length}</span>
        <button onClick={() => setShowNotes((v) => !v)} title="Speaker notes (N)" style={pill}><StickyNote size={13} /> Notes</button>
        <button onClick={() => setShowRail((v) => !v)} style={pill}>{showRail ? "Hide rail" : "Show rail"}</button>
      </div>

      {/* thumbnail rail */}
      {showRail && (
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 108, background: "rgba(10,10,10,.9)", borderTop: "1px solid #2a2a2a", display: "flex", gap: 8, padding: 12, overflowX: "auto", alignItems: "center" }}>
          {slides.map((s, k) => (
            <button key={s.id} onClick={() => go(k)} title={s.name}
              style={{ flex: "none", width: 142, height: 80, borderRadius: 4, border: k === i ? "2px solid #fff" : "1px solid #333", background: s.background ?? "#fff", color: "#111", cursor: "pointer", position: "relative", overflow: "hidden", padding: 0 }}>
              <span style={{ position: "absolute", top: 3, left: 5, fontSize: 9, color: "#888", fontFamily: "monospace" }}>{k + 1}</span>
              <span style={{ position: "absolute", left: 6, right: 6, top: "50%", transform: "translateY(-50%)", fontSize: 11, fontWeight: 600, color: "#333", textAlign: "left", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const backdrop: React.CSSProperties = { position: "fixed", inset: 0, background: "#0b0b0d", zIndex: 9999 };
const closeBtn: React.CSSProperties = { position: "absolute", top: 16, right: 16, zIndex: 2, background: "rgba(255,255,255,.08)", color: "#eee", border: "1px solid #333", borderRadius: 8, width: 36, height: 36, display: "grid", placeItems: "center", cursor: "pointer" };
const arrow: React.CSSProperties = { position: "absolute", top: "50%", transform: "translateY(-50%)", zIndex: 2, background: "rgba(255,255,255,.06)", color: "#eee", border: "1px solid #333", borderRadius: 999, width: 44, height: 44, display: "grid", placeItems: "center", cursor: "pointer" };
const pill: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(255,255,255,.06)", color: "#ccc", border: "1px solid #333", borderRadius: 7, padding: "3px 9px", fontSize: 12, cursor: "pointer" };
