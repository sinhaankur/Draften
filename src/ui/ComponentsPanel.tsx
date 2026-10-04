import { useEffect, useState } from "react";
import { Boxes, Plus, Pencil, Trash2, RefreshCw, Sparkles, LayoutTemplate } from "lucide-react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { useComponents } from "../state/components-store";
import { captureComponent, stampInstance, syncInstances, instanceCount, type El } from "../canvas/components";

/**
 * ComponentsPanel — the real component library (Figma/Sketch symbols).
 *
 * OPT-IN: a toggle turns the library on; off, the app designs normally and this
 * panel just invites you to enable it. On, you can:
 *   • create a component from the current selection,
 *   • drop an instance onto the canvas,
 *   • edit a master (select its source) + sync all instances to match,
 *   • rename / delete.
 * Everything writes real elements to the canvas; nothing is faked.
 */
export function ComponentsPanel({ api, onOpenTemplates, onGenerate }: {
  api: ExcalidrawImperativeAPI | null;
  onOpenTemplates: () => void;
  onGenerate: () => void;
}) {
  const enabled = useComponents((s) => s.enabled);
  const setEnabled = useComponents((s) => s.setEnabled);
  const defs = useComponents((s) => s.defs);
  const add = useComponents((s) => s.add);
  const update = useComponents((s) => s.update);
  const remove = useComponents((s) => s.remove);

  const [selCount, setSelCount] = useState(0);
  const [status, setStatus] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  // poll selection so "Create from selection" knows if it's available
  useEffect(() => {
    if (!api || !enabled) return;
    let t = 0;
    const tick = () => {
      try {
        const st = api.getAppState();
        const n = Object.keys(st.selectedElementIds || {}).filter((k) => st.selectedElementIds[k]).length;
        setSelCount((c) => (c === n ? c : n));
      } catch { /* not ready */ }
      t = window.setTimeout(tick, 300) as unknown as number;
    };
    tick();
    return () => window.clearTimeout(t);
  }, [api, enabled]);

  const selectedEls = (): El[] => {
    if (!api) return [];
    const st = api.getAppState();
    const ids = Object.keys(st.selectedElementIds || {}).filter((k) => st.selectedElementIds[k]);
    return api.getSceneElements().filter((e) => ids.includes(e.id) && !e.isDeleted) as unknown as El[];
  };

  const createFromSelection = () => {
    const els = selectedEls();
    if (els.length < 1) { setStatus("Select something to make a component."); return; }
    const def = captureComponent(els, `Component ${defs.length + 1}`);
    add(def);
    setRenaming(def.id);
    setStatus(`Created “${def.name}” from ${els.length} layer${els.length === 1 ? "" : "s"}.`);
  };

  const dropInstance = (id: string) => {
    if (!api) return;
    const def = defs.find((d) => d.id === id);
    if (!def) return;
    const st = api.getAppState() as unknown as { scrollX: number; scrollY: number; width: number; height: number };
    // drop near the centre of the current viewport
    const x = -st.scrollX + (st.width ?? 1200) / 2 - def.width / 2;
    const y = -st.scrollY + (st.height ?? 800) / 2 - def.height / 2;
    const fresh = stampInstance(def, Math.round(x), Math.round(y));
    const scene = api.getSceneElements();
    api.updateScene({ elements: [...scene, ...fresh] as unknown as Parameters<typeof api.updateScene>[0]["elements"] });
    const ids = Object.fromEntries(fresh.map((e) => [e.id, true as const]));
    api.updateScene({ appState: { ...api.getAppState(), selectedElementIds: ids } });
    setStatus(`Placed an instance of “${def.name}”.`);
  };

  // "Edit": re-capture the master from the CURRENT selection (your edited version)
  const editFromSelection = (id: string) => {
    const els = selectedEls();
    if (els.length < 1) { setStatus("Select the edited layers, then Edit to update the master."); return; }
    const base = defs.find((d) => d.id === id);
    const recap = captureComponent(els, base?.name ?? "Component");
    update(id, { elements: recap.elements, width: recap.width, height: recap.height });
    setStatus(`Updated master “${base?.name}”. Hit Sync to push to instances.`);
  };

  const sync = (id: string) => {
    if (!api) return;
    const def = defs.find((d) => d.id === id);
    if (!def) return;
    const { scene, synced } = syncInstances(def, api.getSceneElements() as unknown as El[]);
    if (!synced) { setStatus("No instances to sync yet."); return; }
    api.updateScene({ elements: scene as unknown as Parameters<typeof api.updateScene>[0]["elements"] });
    setStatus(`Synced ${synced} instance${synced === 1 ? "" : "s"} of “${def.name}”.`);
  };

  if (!enabled) {
    return (
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "8px 12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Boxes size={16} style={{ color: "var(--text-3)" }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Components</span>
        </div>
        <p style={{ fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.6 }}>
          Reusable components (symbols) — define once, drop instances, edit the master and
          sync them all. Optional: you can design without them.
        </p>
        <button className="ai-btn" style={{ justifyContent: "center", width: "100%", marginTop: 10 }} onClick={() => setEnabled(true)}>
          <Boxes size={14} /> Enable components
        </button>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          <button className="tb-btn" style={{ justifyContent: "center" }} onClick={onGenerate}><Sparkles size={14} /> Generate a library</button>
          <button className="tb-btn" style={{ justifyContent: "center" }} onClick={onOpenTemplates}><LayoutTemplate size={14} /> Templates</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "8px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Boxes size={16} style={{ color: "var(--accent)" }} />
        <span style={{ fontSize: 13, fontWeight: 600 }}>Components</span>
        <button className="ghost small" style={{ marginLeft: "auto", fontSize: 11 }} onClick={() => setEnabled(false)}>Disable</button>
      </div>

      <button className="ai-btn" style={{ justifyContent: "center", width: "100%" }} disabled={selCount < 1} onClick={createFromSelection}>
        <Plus size={14} /> Create from selection{selCount ? ` (${selCount})` : ""}
      </button>

      {status && <p style={{ fontSize: 11.5, color: "var(--text-3)", margin: "8px 0 0", lineHeight: 1.5 }}>{status}</p>}

      {defs.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--text-3)", marginTop: 12, lineHeight: 1.6 }}>No components yet. Select some layers and “Create from selection”.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 12 }}>
          {defs.map((d) => {
            const count = api ? instanceCount(d, api.getSceneElements() as unknown as El[]) : 0;
            return (
              <div key={d.id} style={{ border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", background: "var(--surf,#fff)" }}>
                <button title={`Place an instance of ${d.name}`} onClick={() => dropInstance(d.id)}
                  style={{ width: "100%", height: 64, border: 0, borderBottom: "1px solid var(--line)", background: "var(--canvas,#efeeeb)", cursor: "pointer", display: "grid", placeItems: "center", color: "var(--text-3)" }}>
                  <Boxes size={20} />
                </button>
                <div style={{ padding: "6px 8px" }}>
                  {renaming === d.id ? (
                    <input autoFocus defaultValue={d.name}
                      onBlur={(e) => { update(d.id, { name: e.target.value.trim() || d.name }); setRenaming(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                      style={{ width: "100%", fontSize: 12, border: "1px solid var(--accent)", borderRadius: 5, padding: "2px 5px", background: "var(--surf,#fff)", color: "var(--t1)" }} />
                  ) : (
                    <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.name}</div>
                  )}
                  <div style={{ fontSize: 10.5, color: "var(--text-3)", marginTop: 1 }}>{count} instance{count === 1 ? "" : "s"}</div>
                  <div style={{ display: "flex", gap: 2, marginTop: 5 }}>
                    <IconBtn title="Rename" onClick={() => setRenaming(d.id)}><Pencil size={12} /></IconBtn>
                    <IconBtn title="Update master from selection" onClick={() => editFromSelection(d.id)}><Boxes size={12} /></IconBtn>
                    <IconBtn title="Sync instances to master" onClick={() => sync(d.id)}><RefreshCw size={12} /></IconBtn>
                    <IconBtn title="Delete component" danger onClick={() => { remove(d.id); setStatus(`Deleted “${d.name}”.`); }}><Trash2 size={12} /></IconBtn>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function IconBtn({ title, onClick, danger, children }: { title: string; onClick: () => void; danger?: boolean; children: React.ReactNode }) {
  return (
    <button title={title} onClick={onClick}
      style={{ flex: 1, minWidth: 28, height: 26, border: 0, borderRadius: 6, background: "transparent", cursor: "pointer", display: "grid", placeItems: "center", color: danger ? "#b23b3b" : "var(--text-3)" }}
      className="row-icon-btn">
      {children}
    </button>
  );
}
