import { useEffect, useState } from "react";
import { Play, Link2, Trash2, Presentation } from "lucide-react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { usePrototype, type Animation } from "../state/prototype";

/**
 * PrototypePanel — real interactions (Figma/Sketch prototyping).
 *
 * Select a layer → choose a target frame + animation → "Link". The connection is
 * stored (usePrototype) and drives Play. Lists all real links on the page with
 * delete. No more hardcoded demo links.
 */
const ANIMATIONS: Animation[] = ["Smart animate", "Dissolve", "Push", "Slide", "Instant"];

type El = { id: string; type: string; name?: string | null; customData?: { name?: string } | null; text?: string; isDeleted?: boolean };

export function PrototypePanel({ api, onPlay, onPresent, activeBoardName }: {
  api: ExcalidrawImperativeAPI | null; onPlay: () => void; onPresent?: () => void; activeBoardName: string;
}) {
  const links = usePrototype((s) => s.links);
  const add = usePrototype((s) => s.add);
  const remove = usePrototype((s) => s.remove);

  const [sel, setSel] = useState<El | null>(null);
  const [frames, setFrames] = useState<El[]>([]);
  const [toFrame, setToFrame] = useState("");
  const [anim, setAnim] = useState<Animation>("Smart animate");
  const [ms, setMs] = useState(400);

  useEffect(() => {
    if (!api) return;
    let t = 0;
    const tick = () => {
      try {
        const scene = api.getSceneElements() as unknown as El[];
        const fr = scene.filter((e) => e.type === "frame" && !e.isDeleted);
        setFrames((p) => (p.length === fr.length && p.every((x, i) => x.id === fr[i].id) ? p : fr));
        const st = api.getAppState();
        const ids = Object.keys(st.selectedElementIds || {}).filter((k) => st.selectedElementIds[k]);
        const one = ids.length === 1 ? scene.find((e) => e.id === ids[0] && !e.isDeleted) : null;
        setSel((p) => (p?.id === one?.id ? p : one ?? null));
      } catch { /* not ready */ }
      t = window.setTimeout(tick, 300) as unknown as number;
    };
    tick();
    return () => window.clearTimeout(t);
  }, [api]);

  const nameOf = (e: El) => e.customData?.name || e.name || (e.type === "text" ? (e.text || "").slice(0, 24) : e.type);

  const createLink = () => {
    if (!sel || !toFrame) return;
    const target = frames.find((f) => f.id === toFrame);
    add({ fromId: sel.id, fromLabel: nameOf(sel), toFrame, toLabel: target ? nameOf(target) : "Frame", trigger: "On tap", animation: anim, ms });
    setToFrame("");
  };

  return (
    <div className="pane-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <button className="ai-btn" style={{ width: "100%", justifyContent: "center", gap: 6 }} onClick={onPlay}>
        <Play size={14} /> Play from {activeBoardName}
      </button>
      {onPresent && (
        <button className="ghost small" style={{ width: "100%", justifyContent: "center", gap: 6 }} onClick={onPresent}>
          <Presentation size={14} /> Present slides (fullscreen)
        </button>
      )}

      {/* Create a connection from the selected layer */}
      <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 12, background: "var(--surf)" }}>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--t3)", marginBottom: 6 }}>New interaction</div>
        {!sel ? (
          <div style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.5 }}>Select a layer on the canvas to link it to a screen.</div>
        ) : (
          <>
            <div style={{ fontSize: 12.5, marginBottom: 6 }}>On tap <b>{nameOf(sel)}</b> →</div>
            <select value={toFrame} onChange={(e) => setToFrame(e.target.value)} style={inp}>
              <option value="">Navigate to…</option>
              {frames.map((f) => <option key={f.id} value={f.id}>{nameOf(f)}</option>)}
            </select>
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <select value={anim} onChange={(e) => setAnim(e.target.value as Animation)} style={{ ...inp, flex: 1 }}>
                {ANIMATIONS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <input type="number" value={ms} onChange={(e) => setMs(Math.max(0, +e.target.value || 0))} style={{ ...inp, width: 64 }} />
              <span style={{ alignSelf: "center", fontSize: 11, color: "var(--t3)" }}>ms</span>
            </div>
            <button onClick={createLink} disabled={!toFrame} className="ai-btn" style={{ width: "100%", justifyContent: "center", gap: 6, marginTop: 8 }}>
              <Link2 size={13} /> Link
            </button>
          </>
        )}
      </div>

      {/* Real links on this page */}
      <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--t3)", marginTop: 4 }}>Interactions ({links.length})</div>
      {links.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--t3)" }}>No interactions yet — select a layer and link it to a screen.</div>
      ) : (
        links.map((l) => (
          <div key={l.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", background: "var(--surf)" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12.5, color: "var(--t1)" }}>{l.fromLabel} → {l.toLabel}</div>
              <div style={{ fontSize: 11.5, color: "var(--t3)", marginTop: 3 }}>{l.trigger} · {l.animation} · {l.ms}ms</div>
            </div>
            <button onClick={() => remove(l.id)} title="Remove" style={{ border: 0, background: "transparent", color: "var(--t3)", cursor: "pointer" }}>
              <Trash2 size={13} />
            </button>
          </div>
        ))
      )}
    </div>
  );
}

const inp: React.CSSProperties = {
  width: "100%", borderRadius: 7, border: "1px solid var(--line, #e7e6e2)", padding: "6px 8px",
  fontSize: 12.5, background: "var(--surf, #fff)", color: "var(--t1, #1d1d1b)",
};
