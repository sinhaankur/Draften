import { useEffect, useRef, useState } from "react";
import { FolderOpen, Save, Download, ChevronDown } from "lucide-react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { saveDraften, saveExcalidraw, exportSvg, exportPng, openFile } from "../io/files";

/**
 * FileMenu — real Save / Open / Export in open formats.
 *
 * Replaces the dead "main" branch button. Everything here is non-proprietary:
 * native .draften.json, the open .excalidraw format, SVG and PNG. "Backed up
 * like Sketch" (a real local file) and still git-controllable (the GitHub panel
 * commits the same document).
 */
export function FileMenu({ api, name, onOpened }: {
  api: ExcalidrawImperativeAPI | null;
  name: string;
  onOpened?: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const away = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  // ⌘S / Ctrl+S → quick native save; ⌘O → open.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (!api) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveDraften(api, name); }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "o") { e.preventDefault(); openFile(api).then((n) => n && onOpened?.(n)); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [api, name, onOpened]);

  const run = (fn: () => void) => { fn(); setOpen(false); };
  const disabled = !api;

  const item = (icon: React.ReactNode, label: string, hint: string, onClick: () => void) => (
    <button onClick={() => run(onClick)} disabled={disabled}
      style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", border: 0, background: "transparent",
        padding: "8px 12px", cursor: disabled ? "default" : "pointer", fontSize: 13, color: "var(--t1, #1d1d1b)", textAlign: "left", borderRadius: 7 }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = "var(--hover, #f0efec)"; }}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
      <span style={{ flex: "none", color: "var(--text-3, #8e8d88)" }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10.5, color: "var(--text-3, #8e8d88)" }}>{hint}</span>
    </button>
  );

  const sep = <div style={{ height: 1, background: "var(--line, #e7e6e2)", margin: "4px 0" }} />;
  const groupLabel = (t: string) => <div style={{ padding: "6px 12px 2px", fontSize: 10.5, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-3, #8e8d88)" }}>{t}</div>;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button className="tb-btn" onClick={() => setOpen((v) => !v)} title="File — save, open, export">
        File <ChevronDown size={12} />
      </button>
      {open && api && (
        <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 100, width: 240,
          background: "var(--panel, #fbfbfa)", border: "1px solid var(--line, #e7e6e2)", borderRadius: 10,
          boxShadow: "0 10px 30px -10px rgba(0,0,0,.25)", padding: 4 }}>
          {item(<FolderOpen size={15} />, "Open…", "⌘O", () => openFile(api).then((n) => n && onOpened?.(n)))}
          {sep}
          {groupLabel("Save")}
          {item(<Save size={15} />, "Save (.draften.json)", "⌘S", () => saveDraften(api, name))}
          {item(<Save size={15} />, "Save as .excalidraw", "", () => saveExcalidraw(api, name))}
          {sep}
          {groupLabel("Export")}
          {item(<Download size={15} />, "Export SVG", "", () => exportSvg(api, name))}
          {item(<Download size={15} />, "Export PNG", "", () => exportPng(api, name))}
          <div style={{ padding: "8px 12px 4px", fontSize: 11, color: "var(--text-3, #8e8d88)", lineHeight: 1.5 }}>
            Open formats only — your file stays yours, and the GitHub panel commits the same document.
          </div>
        </div>
      )}
    </div>
  );
}
