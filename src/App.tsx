import { useEffect, useState } from "react";

import { useRef } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { AnimatePresence, motion } from "motion/react";
import {
  PanelLeft, PanelRight, GitBranch, LayoutTemplate, Puzzle,
  Moon, Sun, Sparkles, Play, History, Package,
} from "lucide-react";

import { ExcalidrawCanvas, toElements } from "./canvas/ExcalidrawCanvas";
import { registerCanvasApplier } from "./canvas/apply-action";
import { GitHubSignIn } from "./ui/GitHubSignIn";
import { SourceControlPanel } from "./ui/SourceControlPanel";
import { parsePaste, toExcalidrawSkeleton } from "./import/paste";
import { isTauri } from "./env";
import { toast as toastMotion } from "./ui/motion";
import { byAtomicLevel, type AtomicLevel } from "./model/design-system";
import { useEditor } from "./state/store";
import { sinhaankurDesignSystem, sinhaankurScreenSkeleton } from "./templates/sinhaankur";
import { AiPanel } from "./ui/AiPanel";
import { PluginsPanel } from "./ui/PluginsPanel";
import { ImportButton } from "./ui/ImportButton";
import { InspectPanel } from "./ui/InspectPanel";
import { TemplatesPanel } from "./ui/TemplatesPanel";
import type { TemplateDef } from "./templates/gallery";
import { CodeView } from "./ui/CodeView";
import { ConsoleView } from "./ui/ConsoleView";
import { ReviewPanel } from "./ui/ReviewPanel";
import { FileMenu } from "./ui/FileMenu";
import { downloadProject } from "./export/project";
import { PrototypePlay } from "./ui/PrototypePlay";
import { LayersPanel } from "./ui/LayersPanel";
import { RailAccount } from "./ui/RailAccount";
import { StylesPanel } from "./ui/StylesPanel";
import { AlignBar } from "./ui/AlignBar";
import "./App.css";

const LEVELS: AtomicLevel[] = ["atom", "molecule", "organism", "template", "page"];

export function App() {
  const doc = useEditor((s) => s.doc);
  const activeBoardId = useEditor((s) => s.activeBoardId);
  const setActiveBoard = useEditor((s) => s.setActiveBoard);
  const addBoard = useEditor((s) => s.addBoard);

  const [view, setView] = useState<"Design" | "Split" | "Code" | "Console">("Design");
  const [dsTab, setDsTab] = useState<"Design" | "Prototype" | "Inspect" | "Assistant" | "Review">("Design");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [aiOpen, setAiOpen] = useState(false);
  const [pluginsOpen, setPluginsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [dotGrid, setDotGrid] = useState(true);
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  // Responsive drawers (below md the rails slide over the canvas — Hick's Law).
  const [leftOpen, setLeftOpen] = useState(false);
  const [leftMode, setLeftMode] = useState<"layers" | "git" | "components" | "history">("layers");
  const [rightOpen, setRightOpen] = useState(false);
  const setDesignSystem = useEditor((s) => s.setDesignSystem);
  const rename = useEditor((s) => s.rename);
  const excalidrawApi = useRef<ExcalidrawImperativeAPI | null>(null);
  // Flip once the canvas API exists so panels that read it (Inspect) re-render.
  const [canvasReady, setCanvasReady] = useState(false);

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

  /** Draw a gallery template onto the canvas (APPENDED beside existing work, so
   *  it never wipes what you have). Every element becomes a real editable layer. */
  const pickTemplate = (t: TemplateDef) => {
    // The sinhaankur.com entry loads a whole design SYSTEM (tokens + component
    // library + hero) — not just a skeleton — so it routes to the full loader.
    if (t.id === "sinhaankur") { openTemplate(); return; }
    const api = excalidrawApi.current;
    if (!api) return;
    const existing = api.getSceneElements();
    // offset the template to the right of whatever's already on the canvas
    const maxX = existing.reduce((m, e) => Math.max(m, (e.x ?? 0) + (e.width ?? 0)), 0);
    const dx = existing.length ? maxX + 80 : 0;
    const skeleton = t.build().map((s) => ({ ...s, x: (s.x as number) + dx }));
    const drawn = toElements(skeleton as Parameters<typeof toElements>[0]);
    api.updateScene({ elements: [...existing, ...drawn] });
    api.scrollToContent(drawn, { fitToContent: true, animate: true });
  };

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Paste from Figma / Sketch / web / image → real elements on the canvas.
  // (Fixes "copy from Figma/Sketch doesn't work" — before this, nothing caught it.)
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      // let Excalidraw handle its own native paste (its own elements)
      const target = e.target as HTMLElement | null;
      if (target && target.closest(".excalidraw")) return;
      const api = excalidrawApi.current;
      if (!api) return;
      const result = await parsePaste(e);
      if (!result.nodes.length) return;
      e.preventDefault();
      const skeleton = toExcalidrawSkeleton(result.nodes, 60, 60);
      const existing = api.getSceneElements();
      api.updateScene({ elements: [...existing, ...toElements(skeleton)] });
      api.scrollToContent(api.getSceneElements(), { fitToContent: true, animate: true });
      if (result.note) setPasteNote(result.note);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

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
        <button className="rail-toggle" title="Boards & layers" onClick={() => { setLeftOpen((v) => !v); setRightOpen(false); }}><PanelLeft size={16} /></button>
        <div className="brand">
          <span className="logo" style={{ display: "inline-grid", placeItems: "center", width: 18, height: 18, borderRadius: 5, background: "var(--accent)", color: "#fff", fontSize: 12, fontWeight: 700, fontFamily: "var(--font-serif)" }}>d</span>
          <span>Draften</span>
          <span className="chip">v{doc.appVersion}</span>
        </div>
        <div className="tb-sep" />
        <div className="breadcrumb">
          <span>{doc.name}</span>
          <span className="sep">/</span>
          <span className="current">{activeBoard?.name ?? "Board"}</span>
        </div>

        <div className="spacer" />

        {/* editor-mode segmented control — Design/Split/Code/Console (mockup) */}
        <div className="segmented">
          {(["Design", "Split", "Code", "Console"] as const).map((v) => (
            <button key={v} className={view === v ? "on" : ""} onClick={() => setView(v as typeof view)}>
              {v}
            </button>
          ))}
        </div>

        <div className="tb-sep" />

        {/* File — real Save/Open/Export in open formats (replaces the dead branch btn) */}
        <FileMenu api={canvasReady ? excalidrawApi.current : null} name={doc.name} onOpened={(n) => rename(n)} />

        {/* GitHub sign-in (device flow) — unlocks the git features */}
        <GitHubSignIn />

        <button className="tb-btn" onClick={() => setTemplatesOpen(true)} title="Templates">
          <LayoutTemplate size={14} /> Templates
        </button>
        <button className="tb-btn" onClick={() => setPluginsOpen(true)} title="Install plugins from GitHub">
          <Puzzle size={14} /> Plugins
        </button>
        <button
          className="tb-btn tb-icon"
          onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          title="Toggle appearance"
        >
          {theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
        </button>

        <div className="tb-sep" />

        {/* primary action, trailing-most */}
        <button className="ai-btn" onClick={() => { setDsTab("Assistant"); setRightOpen(true); }}>
          <Sparkles size={14} /> AI
        </button>
        {/* Export — build the runnable app (v2's green Export button) */}
        <button className="export-btn" title="Export a runnable app (.zip)"
          onClick={() => { if (canvasReady && excalidrawApi.current) void downloadProject(excalidrawApi.current, doc.name); }}>
          <Package size={14} /> Export
        </button>
        <button className="rail-toggle" title="Design system" onClick={() => { setRightOpen((v) => !v); setLeftOpen(false); }}><PanelRight size={16} /></button>
      </header>

      <AnimatePresence>
        {aiOpen && <AiPanel key="ai" onClose={() => setAiOpen(false)} />}
        {pluginsOpen && <PluginsPanel key="plugins" onClose={() => setPluginsOpen(false)} />}
        {templatesOpen && <TemplatesPanel key="templates" onClose={() => setTemplatesOpen(false)} onPick={pickTemplate} />}
      </AnimatePresence>

      {playing && canvasReady && excalidrawApi.current && (
        <PrototypePlay api={excalidrawApi.current} onClose={() => setPlaying(false)} />
      )}

      <AnimatePresence>
        {pasteNote && (
          <motion.div className="paste-toast" onClick={() => setPasteNote(null)} {...toastMotion}>
            {pasteNote}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="body">
        {/* scrim (mobile) — tap to close any open drawer */}
        <div
          className={`rail-scrim${leftOpen || rightOpen ? " show" : ""}`}
          onClick={() => { setLeftOpen(false); setRightOpen(false); }}
        />

        {/* far-left vertical icon rail (v2): layers · components · source control ·
            history · plugins · assistant. Switches what the left panel shows. */}
        <nav className="icon-rail">
          {([
            { id: "layers", icon: <PanelLeft size={18} />, title: "Artboards & layers", on: () => { setLeftMode("layers"); setLeftOpen(true); } },
            { id: "components", icon: <LayoutTemplate size={18} />, title: "Components & templates", on: () => { setLeftMode("components"); setLeftOpen(true); } },
            { id: "git", icon: <GitBranch size={18} />, title: "Source control", on: () => { setLeftMode("git"); setLeftOpen(true); } },
            { id: "history", icon: <History size={18} />, title: "Version history", on: () => { setLeftMode("history"); setLeftOpen(true); } },
            { id: "plugins", icon: <Puzzle size={18} />, title: "Plugins", on: () => setPluginsOpen(true) },
            { id: "assistant", icon: <Sparkles size={18} />, title: "AI assistant", on: () => { setDsTab("Assistant"); setRightOpen(true); } },
          ] as const).map((it) => (
            <button key={it.id} className={`rail-icon${leftMode === it.id ? " on" : ""}`} title={it.title} onClick={it.on}>
              {it.icon}
            </button>
          ))}

          {/* account — pinned at the bottom of the rail (v2's avatar) */}
          <div style={{ flex: 1 }} />
          <RailAccount />
        </nav>

        {/* left: Artboards & layers — ported from design/Draften v2.dc.html
            (exact markup + inline styles, wired to real state). */}
        <aside className={`left${leftOpen ? " open" : ""}`}
          style={{ width: 256, flex: "none", display: "flex", flexDirection: "column", minHeight: 0, borderRight: "1px solid var(--line, var(--border))", background: "var(--panel, var(--raised))" }}>
          {/* header — serif title + mode toggle (Layers / Source control) */}
          <div style={{ height: 44, flex: "none", display: "flex", alignItems: "center", padding: "0 10px 0 16px", gap: 6 }}>
            <span style={{ flex: 1, fontFamily: "var(--font-serif)", fontSize: 16, fontWeight: 500 }}>
              {leftMode === "layers" ? "Artboards & layers" : "Source control"}
            </span>
            <button title="Artboards & layers" onClick={() => setLeftMode("layers")}
              style={{ width: 26, height: 26, border: 0, borderRadius: 7, background: leftMode === "layers" ? "var(--acc-soft)" : "transparent", color: leftMode === "layers" ? "var(--accent)" : "var(--text-3)", cursor: "pointer", display: "grid", placeItems: "center" }}>
              <PanelLeft size={15} />
            </button>
            <button title="Source control" onClick={() => setLeftMode("git")}
              style={{ width: 26, height: 26, border: 0, borderRadius: 7, background: leftMode === "git" ? "var(--acc-soft)" : "transparent", color: leftMode === "git" ? "var(--accent)" : "var(--text-3)", cursor: "pointer", display: "grid", placeItems: "center" }}>
              <GitBranch size={15} />
            </button>
          </div>

          {leftMode === "git" ? (
            <SourceControlPanel />
          ) : leftMode === "components" ? (
            <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "4px 12px" }}>
              <p style={{ fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.6 }}>
                Your component library appears here. Generate one with the ✦ assistant, or open Templates for a starting point.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                <button className="ai-btn" style={{ justifyContent: "center" }} onClick={() => { setDsTab("Assistant"); setRightOpen(true); }}><Sparkles size={14} /> Generate a library</button>
                <button className="tb-btn" style={{ justifyContent: "center" }} onClick={() => setTemplatesOpen(true)}><LayoutTemplate size={14} /> Templates</button>
              </div>
            </div>
          ) : leftMode === "history" ? (
            <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: "4px 12px" }}>
              <p style={{ fontSize: 12.5, color: "var(--text-3)", lineHeight: 1.6 }}>
                Every change is saved. Open the ✦ assistant to see the full change log with undo/redo, or switch to the Console view for the event stream.
              </p>
              <button className="tb-btn" style={{ justifyContent: "center", width: "100%", marginTop: 10 }} onClick={() => setView("Console")}>Open Console</button>
            </div>
          ) : (
          <div style={{ flex: 1, minHeight: 0, overflow: "auto", display: "flex", flexDirection: "column" }}>
            {/* Pages */}
            <div style={{ padding: "0 8px 10px", display: "flex", flexDirection: "column", gap: 1 }}>
              <div style={{ display: "flex", alignItems: "center", padding: "4px 8px" }}>
                <span style={{ flex: 1, fontSize: 11.5, fontWeight: 500, color: "var(--text-3)" }}>Pages</span>
                <button title="Add a page" onClick={() => addBoard()}
                  style={{ width: 20, height: 20, border: 0, borderRadius: 5, background: "transparent", color: "var(--text-3)", cursor: "pointer", display: "grid", placeItems: "center", fontSize: 14 }}>+</button>
              </div>
              {doc.boards.map((b) => (
                <button key={b.id} onClick={() => setActiveBoard(b.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", border: 0, borderRadius: 6, cursor: "pointer", textAlign: "left",
                    background: b.id === activeBoardId ? "var(--acc-soft, var(--accent-soft))" : "transparent",
                    color: b.id === activeBoardId ? "var(--accent-text, var(--accent))" : "var(--text)",
                    fontWeight: b.id === activeBoardId ? 500 : 400,
                  }}>
                  <span style={{ width: 6, height: 6, borderRadius: 2, background: "var(--accent)", opacity: b.id === activeBoardId ? 1 : 0.4 }} />
                  <span style={{ flex: 1 }}>{b.name}</span>
                  <span style={{ color: "var(--text-3)", fontSize: 11 }}>{b.children.length || ""}</span>
                </button>
              ))}
            </div>

            {/* Import */}
            <div style={{ padding: "0 8px 10px", borderTop: "1px solid var(--line, var(--border))" }}>
              <div style={{ padding: "8px 8px 4px", fontSize: 11.5, fontWeight: 500, color: "var(--text-3)" }}>Import</div>
              <ImportButton />
            </div>

            {/* Artboards + Layers — the panel renders both sections (v2) */}
            <div style={{ padding: "0 4px 10px", borderTop: "1px solid var(--line, var(--border))" }}>
              <LayersPanel api={canvasReady ? excalidrawApi.current : null} />
            </div>
          </div>
          )}

          <div style={{ height: 30, flex: "none", display: "flex", alignItems: "center", gap: 6, padding: "0 12px", borderTop: "1px solid var(--line, var(--border))", fontSize: 11.5, color: "var(--text-3)" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }} /> All changes saved locally
          </div>
        </aside>

        {/* center: canvas + code. The canvas stays MOUNTED (so its API persists);
            Code/Console/Split overlay it. The segmented control up top drives this. */}
        <main className="stage" style={{ position: "relative", display: "flex" }}>
          {/* canvas — hidden (not unmounted) in pure Code/Console view */}
          <div style={{ position: "relative", flex: view === "Split" ? "1 1 50%" : "1 1 100%", display: view === "Code" || view === "Console" ? "none" : "block" }}>
            <ExcalidrawCanvas theme={theme} onReady={(api) => { excalidrawApi.current = api; registerCanvasApplier(api); setCanvasReady(true); }} />
          </div>
          {/* code panel — Code (full) or Split (half) */}
          {(view === "Code" || view === "Split") && (
            <div style={{ position: "relative", flex: view === "Split" ? "1 1 50%" : "1 1 100%", borderLeft: view === "Split" ? "1px solid var(--line, #e7e6e2)" : "none" }}>
              <CodeView api={canvasReady ? excalidrawApi.current : null} />
            </div>
          )}
          {/* console — the real changelog/event log */}
          {view === "Console" && (
            <div style={{ position: "absolute", inset: 0 }}>
              <ConsoleView />
            </div>
          )}
        </main>

        {/* right: system / inspect / stack */}
        <aside className={`right${rightOpen ? " open" : ""}`}>
          <div className="tabs">
            {(["Design", "Prototype", "Assistant", "Review"] as const).map((t) => (
              <button key={t} className={dsTab === t ? "on" : ""} onClick={() => setDsTab(t)}>
                {t}
              </button>
            ))}
          </div>

          {dsTab === "Design" && (
            <>
              <div className="pane-body">
                {/* Inspect — selected layer's properties fold in here (v2 has no
                    separate Inspect tab). Shows guidance when nothing's selected. */}
                <InspectPanel api={canvasReady ? excalidrawApi.current : null} />
                <AlignBar api={canvasReady ? excalidrawApi.current : null} />
                <div className="divider" />

                {/* Page (v2) */}
                <div className="section-title">Page</div>
                <div style={{ width: "100%", borderRadius: 8, border: "1px solid var(--line, #e7e6e2)", padding: "7px 10px", fontSize: 13, background: "var(--surf, #fff)", color: "var(--t1, #1d1d1b)", marginBottom: 8 }}>
                  {activeBoard?.name ?? doc.name}
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer", marginBottom: 12 }}>
                  <input type="checkbox" checked={dotGrid} onChange={(e) => { setDotGrid(e.target.checked); excalidrawApi.current?.updateScene({ appState: { ...excalidrawApi.current.getAppState(), gridModeEnabled: e.target.checked } }); }} />
                  Show dot grid
                </label>

                {/* Shortcuts (v2) — the real key map */}
                <div className="section-title">Shortcuts</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 12 }}>
                  {([
                    ["Duplicate", "⌘D"], ["Copy / paste", "⌘C ⌘V"], ["Group / ungroup", "⌘G"],
                    ["Move", "V"], ["Rectangle", "R"], ["Ellipse", "O"], ["Text", "T"],
                    ["Pan", "Space"], ["Zoom to fit", "⇧1"], ["Undo / redo", "⌘Z"],
                  ] as const).map(([label, key]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, padding: "3px 0", color: "var(--t1, #1d1d1b)" }}>
                      <span>{label}</span>
                      <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 11, color: "var(--text-3, #8e8d88)" }}>{key}</span>
                    </div>
                  ))}
                </div>

                <div className="divider" />

                <div className="section-title">Design system</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <input
                    value={doc.designSystem.brand.name}
                    onChange={(e) => setDesignSystem({ ...doc.designSystem, brand: { ...doc.designSystem.brand, name: e.target.value } })}
                    placeholder="Brand name"
                    style={{ flex: 1, minWidth: 0, borderRadius: 8, border: "1px solid var(--line, #e7e6e2)", padding: "7px 10px", fontSize: 14, fontWeight: 600, background: "var(--surf, #fff)", color: "var(--t1, #1d1d1b)" }}
                  />
                  <span className="ver" style={{ flex: "none" }}>v0.1</span>
                </div>

                <div className="section-title">Brand Kit</div>
                <div className="swatches">
                  {swatchColors.map((c, i) => (
                    <span key={i} className="swatch" style={{ background: c }} />
                  ))}
                </div>
                <div className="muted small">Inter · 4pt grid</div>

                <div className="divider" />

                {/* Color styles + Text styles — apply to selection (v2 spine) */}
                <StylesPanel api={canvasReady ? excalidrawApi.current : null} colors={genColors} />

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
                    <button className="ai-btn" onClick={() => { setDsTab("Assistant"); setRightOpen(true); }}>
                      ✦ Generate a library
                    </button>
                  </div>
                )}
              </div>
              <button className="new-component" onClick={() => { setDsTab("Assistant"); setRightOpen(true); }}>
                + New component
              </button>
            </>
          )}

          {dsTab === "Prototype" && (
            <div className="pane-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 12, color: "var(--t3)", lineHeight: 1.5 }}>
                Select a layer to make it interactive. Links show as lines on the canvas while this tab is open.
              </div>
              <button className="ai-btn" style={{ width: "100%", justifyContent: "center", gap: 6 }}
                onClick={() => canvasReady && excalidrawApi.current && setPlaying(true)}>
                <Play size={14} /> Play from {activeBoard?.name ?? "Welcome"}
              </button>
              <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--t3)", marginTop: 4 }}>Links on this page</div>
              {[
                { from: "Welcome / Get started", to: "Create account", anim: "Smart animate", ms: 450 },
                { from: "Create account / Continue", to: "Connect repository", anim: "Push", ms: 380 },
                { from: "Connect repository / GitHub row", to: "Welcome", anim: "Dissolve", ms: 300 },
              ].map((l, i) => (
                <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "10px 12px", background: "var(--surf)" }}>
                  <div style={{ fontSize: 12.5, color: "var(--t1)" }}>{l.from} → {l.to}</div>
                  <div style={{ fontSize: 11.5, color: "var(--t3)", marginTop: 3 }}>On tap · {l.anim} · {l.ms}ms</div>
                </div>
              ))}
            </div>
          )}
          {dsTab === "Inspect" && (
            <div className="pane-body" style={{ padding: 0 }}>
              <InspectPanel api={canvasReady ? excalidrawApi.current : null} />
            </div>
          )}
          {dsTab === "Assistant" && (
            /* The AI IS this panel — docked like Claude Design, not a popup. */
            <AiPanel docked onClose={() => setDsTab("Design")} />
          )}
          {dsTab === "Review" && (
            <ReviewPanel boardName={activeBoard?.name ?? "This board"} />
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
