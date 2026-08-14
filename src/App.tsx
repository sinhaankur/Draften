import { useEffect, useState } from "react";

import { Canvas } from "./canvas/Canvas";
import { isTauri } from "./env";
import { byAtomicLevel, type AtomicLevel } from "./model/design-system";
import type { Node } from "./model/node";
import { useEditor, type ToolId } from "./state/store";
import "./App.css";

const TOOLS: Array<{ id: ToolId; label: string; glyph: string }> = [
  { id: "select", label: "Select (V)", glyph: "▶" },
  { id: "frame", label: "Frame (F)", glyph: "⌗" },
  { id: "rectangle", label: "Rectangle (R)", glyph: "▭" },
  { id: "ellipse", label: "Ellipse (O)", glyph: "◯" },
  { id: "text", label: "Text (T)", glyph: "T" },
  { id: "shape", label: "Shape (S)", glyph: "◇" },
  { id: "connector", label: "Connector (C)", glyph: "⟿" },
  { id: "sticky", label: "Sticky (N)", glyph: "▧" },
];

const LEVELS: AtomicLevel[] = ["atom", "molecule", "organism", "template", "page"];

export function App() {
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const doc = useEditor((s) => s.doc);
  const activeBoardId = useEditor((s) => s.activeBoardId);
  const setActiveBoard = useEditor((s) => s.setActiveBoard);
  const addNode = useEditor((s) => s.addNode);

  const [view, setView] = useState<"Design" | "Split" | "Code">("Design");
  const [dsTab, setDsTab] = useState<"System" | "Inspect" | "Stack">("System");
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (Object.keys(useEditor.getState().doc.nodes).length > 0) return;
    seedSample(addNode);
  }, [addNode]);

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
        <div className="toolbar">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={tool === t.id ? "tool active" : "tool"}
              onClick={() => setTool(t.id)}
              title={t.label}
            >
              {t.glyph}
            </button>
          ))}
        </div>
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
            {(activeBoard?.children ?? []).map((id) => {
              const n = doc.nodes[id];
              if (!n) return null;
              return (
                <div key={id} className="row small">
                  <span className="muted">{glyphForType(n.type)}</span> {n.name}
                </div>
              );
            })}
          </div>
          <div className="pane-footer">
            <span className="live" /> All changes saved locally
          </div>
        </aside>

        {/* center: canvas */}
        <main className="stage">
          <Canvas theme={theme} />
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

function glyphForType(t: Node["type"]): string {
  switch (t) {
    case "frame":
      return "⌗";
    case "text":
      return "T";
    case "shape":
      return "◇";
    case "connector":
      return "⟿";
    case "ellipse":
      return "◯";
    case "sticky":
      return "▧";
    default:
      return "▭";
  }
}

/** Seed: one UI card + a two-box flow, to show design + diagram on one canvas. */
function seedSample(addNode: (n: Node) => void) {
  addNode({
    id: crypto.randomUUID(),
    type: "frame",
    name: "Signup / mobile",
    frame: { x: 80, y: 90, width: 260, height: 300 },
    fills: [{ kind: "solid", color: "#ffffff" }],
    cornerRadius: 8,
    stroke: { paint: { kind: "solid", color: "#e2e5ec" }, width: 1 },
    children: [],
  } as Node);
  addNode({
    id: crypto.randomUUID(),
    type: "text",
    name: "Create account",
    frame: { x: 100, y: 112, width: 220, height: 24 },
    text: "Create account",
    fills: [{ kind: "solid", color: "#171a21" }],
    style: { fontFamily: "Inter", fontSize: 18, fontWeight: 700, lineHeight: 1.3 },
  } as Node);

  const boxA = crypto.randomUUID();
  const boxB = crypto.randomUUID();
  addNode({
    id: boxA,
    type: "shape",
    name: "App opened",
    shape: "roundRect",
    frame: { x: 420, y: 110, width: 130, height: 56 },
    fills: [{ kind: "solid", color: "#ffffff" }],
    stroke: { paint: { kind: "solid", color: "#5b34d6" }, width: 1.5 },
    label: "App opened",
  } as Node);
  addNode({
    id: boxB,
    type: "shape",
    name: "Has account?",
    shape: "diamond",
    frame: { x: 610, y: 96, width: 140, height: 84 },
    fills: [{ kind: "solid", color: "#ffffff" }],
    stroke: { paint: { kind: "solid", color: "#1d8f7e" }, width: 1.5 },
    label: "Has account?",
  } as Node);
  addNode({
    id: crypto.randomUUID(),
    type: "connector",
    name: "edge",
    frame: { x: 0, y: 0, width: 0, height: 0 },
    from: { nodeId: boxA },
    to: { nodeId: boxB },
    routing: "orthogonal",
    stroke: { paint: { kind: "solid", color: "#5b34d6" }, width: 1.5 },
    endArrow: "arrow",
  } as Node);
}
