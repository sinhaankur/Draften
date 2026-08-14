import { useEffect, useState } from "react";

import { useRef } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { ExcalidrawCanvas, toElements } from "./canvas/ExcalidrawCanvas";
import { isTauri } from "./env";
import { byAtomicLevel, type AtomicLevel } from "./model/design-system";
import { useEditor } from "./state/store";
import { sinhaankurDesignSystem, sinhaankurScreenSkeleton } from "./templates/sinhaankur";
import { AiPanel } from "./ui/AiPanel";
import { ImportButton } from "./ui/ImportButton";
import "./App.css";

const LEVELS: AtomicLevel[] = ["atom", "molecule", "organism", "template", "page"];

export function App() {
  const doc = useEditor((s) => s.doc);
  const activeBoardId = useEditor((s) => s.activeBoardId);
  const setActiveBoard = useEditor((s) => s.setActiveBoard);

  const [view, setView] = useState<"Design" | "Split" | "Code">("Design");
  const [dsTab, setDsTab] = useState<"System" | "Inspect" | "Stack">("System");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [aiOpen, setAiOpen] = useState(false);
  const setDesignSystem = useEditor((s) => s.setDesignSystem);
  const rename = useEditor((s) => s.rename);
  const excalidrawApi = useRef<ExcalidrawImperativeAPI | null>(null);

  /** Load the sinhaankur.com template: real design system into the panel, and
   *  the hero screen onto the canvas (dark ground). One click, whole pipeline. */
  const openTemplate = () => {
    setDesignSystem(sinhaankurDesignSystem);
    rename(sinhaankurDesignSystem.brand.name);
    setTheme("dark");
    const api = excalidrawApi.current;
    if (api) {
      api.updateScene({
        elements: toElements(sinhaankurScreenSkeleton()),
        appState: { viewBackgroundColor: "#0c0e12" },
      });
      api.scrollToContent(api.getSceneElements(), { fitToContent: true });
    }
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const library = byAtomicLevel(doc.designSystem.components);
  const hasComponents = doc.designSystem.components.length > 0;
  const activeBoard = doc.boards.find((b) => b.id === activeBoardId);
  // Brand-kit swatches: real generated palette when present, else theme tokens.
  const genColors = doc.designSystem.tokens.colors;
  const swatchColors = hasComponents
    ? ["brand.500", "brand.700", "accent.500", "neutral.500", "neutral.900"]
        .map((k) => genColors[k])
        .filter(Boolean)
    : ["var(--accent)", "var(--text)", "var(--raised)", "var(--kind-diagram)", "var(--kind-journey)"];

  return (
    <div className="app">
      {/* unified toolbar (Xcode-style): leading identity · flexible space ·
          grouped trailing actions, separated by spacers */}
      <header className="topbar">
        <div className="brand">
          <span className="logo">◗</span>
          <span>Draften</span>
          <span className="chip">v{doc.appVersion}</span>
        </div>
        <div className="tb-sep" />
        <div className="breadcrumb">
          <span>{doc.name}</span>
          <span className="sep">›</span>
          <span className="current">{activeBoard?.name ?? "Board"}</span>
        </div>

        <div className="spacer" />

        {/* editor-mode segmented control */}
        <div className="segmented">
          {(["Design", "Split", "Code"] as const).map((v) => (
            <button key={v} className={view === v ? "on" : ""} onClick={() => setView(v)}>
              {v}
            </button>
          ))}
        </div>

        <div className="tb-sep" />

        {/* document actions group */}
        <button className="tb-btn" title="Git branch">
          ⑂ main
        </button>
        <button className="tb-btn" onClick={openTemplate} title="Load the sinhaankur.com test template">
          Template
        </button>
        <button
          className="tb-btn tb-icon"
          onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          title="Toggle appearance"
        >
          {theme === "light" ? "☾" : "☀"}
        </button>

        <div className="tb-sep" />

        {/* primary action, trailing-most */}
        <button className="ai-btn" onClick={() => setAiOpen(true)}>
          ✦ AI
        </button>
      </header>

      {aiOpen && <AiPanel onClose={() => setAiOpen(false)} />}

      <div className="body">
        {/* left: boards + layers */}
        <aside className="left">
          <div className="pane-body">
            <div className="section-title">
              Boards <span className="add">+</span>
            </div>
            {doc.boards.map((b) => (
              <button
                key={b.id}
                className={b.id === activeBoardId ? "row active" : "row"}
                onClick={() => setActiveBoard(b.id)}
              >
                <span className="dot" data-kind={b.kind} /> {b.name}
                <span className="count">{b.children.length || ""}</span>
              </button>
            ))}

            <div className="divider" />

            <div className="section-title">Import</div>
            <ImportButton />

            <div className="divider" />

            <div className="section-title">Layers</div>
            <div className="muted small">Managed on the canvas.</div>
          </div>
          <div className="pane-footer">
            <span className="live" /> All changes saved locally
          </div>
        </aside>

        {/* center: canvas */}
        <main className="stage">
          <ExcalidrawCanvas theme={theme} onReady={(api) => (excalidrawApi.current = api)} />
        </main>

        {/* right: system / inspect / stack */}
        <aside className="right">
          <div className="tabs">
            {(["System", "Inspect", "Stack"] as const).map((t) => (
              <button key={t} className={dsTab === t ? "on" : ""} onClick={() => setDsTab(t)}>
                {t}
              </button>
            ))}
          </div>

          {dsTab === "System" && (
            <>
              <div className="pane-body">
                <div className="ds-name">
                  {doc.designSystem.brand.name}
                  <span className="ver">v0.1</span>
                </div>

                <div className="section-title">Brand Kit</div>
                <div className="swatches">
                  {swatchColors.map((c, i) => (
                    <span key={i} className="swatch" style={{ background: c }} />
                  ))}
                </div>
                <div className="muted small">Inter · 4pt grid</div>

                <div className="divider" />

                {hasComponents ? (
                  LEVELS.map((lvl) => (
                    <div key={lvl} className="ds-group">
                      <div className="ds-level">
                        <span>{lvl}s</span>
                        <span>{library[lvl].length || ""}</span>
                      </div>
                      {library[lvl].length === 0 ? (
                        <div className="muted small">— none yet —</div>
                      ) : (
                        <div className="comp-cards">
                          {library[lvl].map((c) => (
                            <div key={c.id} className="comp-card" title={c.description}>
                              <div className="demo muted small">{c.name}</div>
                              <div className="cname">
                                {c.name} <span className="muted">v{c.version}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="ds-empty">
                    <div className="muted small">No components yet.</div>
                    <button className="ai-btn" onClick={() => setAiOpen(true)}>
                      ✦ Generate a library
                    </button>
                  </div>
                )}
              </div>
              <button className="new-component" onClick={() => setAiOpen(true)}>
                + New component
              </button>
            </>
          )}

          {dsTab === "Inspect" && (
            <div className="pane-body muted small">Select a node to inspect its properties.</div>
          )}
          {dsTab === "Stack" && (
            <div className="pane-body muted small">
              Tech-stack plugins & code targets appear here.
            </div>
          )}
        </aside>
      </div>

      {/* status bar */}
      <footer className="statusbar">
        <a href="https://github.com/sinhaankur/Draften" target="_blank" rel="noreferrer">
          MIT license
        </a>
        <span>Drag from a port to connect · ⌥ drag duplicates</span>
        <div className="right">
          <span>{isTauri() ? "Desktop" : "Web"}</span>
          <span>Snap on</span>
          <span>Grid 24</span>
        </div>
      </footer>
    </div>
  );
}
