import { useEffect, useState } from "react";

import { ExcalidrawCanvas } from "./canvas/ExcalidrawCanvas";
import { isTauri } from "./env";
import { byAtomicLevel, type AtomicLevel } from "./model/design-system";
import { useEditor } from "./state/store";
import "./App.css";

const LEVELS: AtomicLevel[] = ["atom", "molecule", "organism", "template", "page"];

export function App() {
  const doc = useEditor((s) => s.doc);
  const activeBoardId = useEditor((s) => s.activeBoardId);
  const setActiveBoard = useEditor((s) => s.setActiveBoard);

  const [view, setView] = useState<"Design" | "Split" | "Code">("Design");
  const [dsTab, setDsTab] = useState<"System" | "Inspect" | "Stack">("System");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const library = byAtomicLevel(doc.designSystem.components);
  const activeBoard = doc.boards.find((b) => b.id === activeBoardId);

  return (
    <div className="app">
      {/* top bar */}
      <header className="topbar">
        <div className="brand">
          <span className="logo">◗</span>
          <span>draften</span>
          <span className="chip">v{doc.appVersion} · MIT</span>
        </div>
        <div className="breadcrumb">
          <span>{doc.name}</span>
          <span className="sep">›</span>
          <span className="current">{activeBoard?.name ?? "Board"}</span>
        </div>
        {/* Drawing tools live on the Excalidraw canvas itself now. */}
        <div className="spacer" />
        <div className="segmented">
          {(["Design", "Split", "Code"] as const).map((v) => (
            <button key={v} className={view === v ? "on" : ""} onClick={() => setView(v)}>
              {v}
            </button>
          ))}
        </div>
        <button className="branch" title="Git branch">
          ⑂ main ✓
        </button>
        <button
          className="branch"
          onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          title="Toggle theme"
        >
          {theme === "light" ? "☾" : "☀"}
        </button>
        <button className="ai-btn">✦ AI</button>
      </header>

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

            <div className="section-title">Layers</div>
            <div className="muted small">Managed on the canvas.</div>
          </div>
          <div className="pane-footer">
            <span className="live" /> All changes saved locally
          </div>
        </aside>

        {/* center: canvas */}
        <main className="stage">
          <ExcalidrawCanvas theme={theme} />
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
                  <span className="swatch" style={{ background: "var(--accent)" }} />
                  <span className="swatch" style={{ background: "var(--text)" }} />
                  <span className="swatch" style={{ background: "var(--raised)" }} />
                  <span className="swatch" style={{ background: "var(--kind-diagram)" }} />
                  <span className="swatch" style={{ background: "var(--kind-journey)" }} />
                </div>
                <div className="muted small">Inter · 4pt grid</div>

                <div className="divider" />

                {LEVELS.map((lvl) => (
                  <div key={lvl} className="ds-group">
                    <div className="ds-level">
                      <span>{lvl}s</span>
                      <span>{library[lvl].length || ""}</span>
                    </div>
                    {library[lvl].length === 0 ? (
                      lvl === "atom" ? (
                        <div className="comp-cards">
                          <div className="comp-card">
                            <div className="demo">
                              <span className="mini-btn">Button</span>
                            </div>
                            <div className="cname">Button</div>
                          </div>
                          <div className="comp-card">
                            <div className="demo">
                              <span className="mini-input" />
                            </div>
                            <div className="cname">Input</div>
                          </div>
                        </div>
                      ) : (
                        <div className="muted small">— none yet —</div>
                      )
                    ) : (
                      <div className="comp-cards">
                        {library[lvl].map((c) => (
                          <div key={c.id} className="comp-card">
                            <div className="demo muted small">{c.name}</div>
                            <div className="cname">
                              {c.name} <span className="muted">v{c.version}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button className="new-component">+ New component</button>
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
