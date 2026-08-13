import { useEffect } from "react";

import { Canvas } from "./canvas/Canvas";
import { byAtomicLevel } from "./model/design-system";
import type { Node } from "./model/node";
import { useEditor, type ToolId } from "./state/store";
import "./App.css";

const TOOLS: Array<{ id: ToolId; label: string; key: string }> = [
  { id: "select", label: "Select", key: "V" },
  { id: "frame", label: "Frame", key: "F" },
  { id: "rectangle", label: "Rect", key: "R" },
  { id: "ellipse", label: "Ellipse", key: "O" },
  { id: "text", label: "Text", key: "T" },
  { id: "shape", label: "Shape", key: "S" },
  { id: "connector", label: "Connector", key: "C" },
  { id: "sticky", label: "Sticky", key: "N" },
];

export function App() {
  const tool = useEditor((s) => s.tool);
  const setTool = useEditor((s) => s.setTool);
  const doc = useEditor((s) => s.doc);
  const activeBoardId = useEditor((s) => s.activeBoardId);
  const setActiveBoard = useEditor((s) => s.setActiveBoard);
  const addNode = useEditor((s) => s.addNode);

  // Seed a small sample once so the canvas shows the unified idea on first run:
  // a UI card (design) + two diagram shapes joined by a connector.
  useEffect(() => {
    if (Object.keys(useEditor.getState().doc.nodes).length > 0) return;
    seedSample(addNode);
  }, [addNode]);

  const library = byAtomicLevel(doc.designSystem.components);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          Draften <span className="ver">v{doc.appVersion}</span>
        </div>
        <div className="toolbar">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={tool === t.id ? "tool active" : "tool"}
              onClick={() => setTool(t.id)}
              title={`${t.label} (${t.key})`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="spacer" />
        <button className="ghost" title="AI actions (coming soon)">
          ✦ AI
        </button>
      </header>

      <div className="body">
        <aside className="left">
          <SectionTitle>Boards</SectionTitle>
          {doc.boards.map((b) => (
            <button
              key={b.id}
              className={b.id === activeBoardId ? "row active" : "row"}
              onClick={() => setActiveBoard(b.id)}
            >
              <span className="dot" data-kind={b.kind} /> {b.name}
              <span className="muted">{b.kind}</span>
            </button>
          ))}
        </aside>

        <main className="stage">
          <Canvas />
        </main>

        <aside className="right">
          <SectionTitle>Design System</SectionTitle>
          <div className="ds-brand">{doc.designSystem.brand.name}</div>
          {(["atom", "molecule", "organism", "template", "page"] as const).map((lvl) => (
            <div key={lvl} className="ds-group">
              <div className="ds-level">{lvl}s</div>
              {library[lvl].length === 0 ? (
                <div className="muted small">— none yet —</div>
              ) : (
                library[lvl].map((c) => (
                  <div key={c.id} className="row small">
                    {c.name} <span className="muted">v{c.version}</span>
                  </div>
                ))
              )}
            </div>
          ))}
          <div className="hint small">
            Generate a library with ✦ AI, or import from Sketch / Figma / OmniGraffle.
          </div>
        </aside>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <div className="section-title">{children}</div>;
}

/** Seed: one UI card + a two-box flow, to show design + diagram on one canvas. */
function seedSample(addNode: (n: Node) => void) {
  addNode({
    id: crypto.randomUUID(),
    type: "frame",
    name: "Card",
    frame: { x: 80, y: 90, width: 240, height: 140 },
    fills: [{ kind: "solid", color: "#1b2233" }],
    cornerRadius: 12,
    stroke: { paint: { kind: "solid", color: "#2c3547" }, width: 1 },
    children: [],
  } as Node);
  addNode({
    id: crypto.randomUUID(),
    type: "text",
    name: "Card title",
    frame: { x: 100, y: 112, width: 200, height: 24 },
    text: "Unified canvas",
    fills: [{ kind: "solid", color: "#e6e9ef" }],
    style: { fontFamily: "Inter", fontSize: 18, fontWeight: 600, lineHeight: 1.3 },
  } as Node);

  const boxA = crypto.randomUUID();
  const boxB = crypto.randomUUID();
  addNode({
    id: boxA,
    type: "shape",
    name: "Start",
    shape: "roundRect",
    frame: { x: 420, y: 100, width: 120, height: 60 },
    fills: [{ kind: "solid", color: "#26324a" }],
    stroke: { paint: { kind: "solid", color: "#4c6fff" }, width: 1.5 },
    label: "Start",
  } as Node);
  addNode({
    id: boxB,
    type: "shape",
    name: "Ship",
    shape: "diamond",
    frame: { x: 620, y: 90, width: 130, height: 80 },
    fills: [{ kind: "solid", color: "#2a2440" }],
    stroke: { paint: { kind: "solid", color: "#a838d6" }, width: 1.5 },
    label: "Decision",
  } as Node);
  addNode({
    id: crypto.randomUUID(),
    type: "connector",
    name: "edge",
    frame: { x: 0, y: 0, width: 0, height: 0 },
    from: { nodeId: boxA },
    to: { nodeId: boxB },
    routing: "orthogonal",
    stroke: { paint: { kind: "solid", color: "#8892a6" }, width: 1.5 },
    endArrow: "arrow",
  } as Node);
}
