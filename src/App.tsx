import { useEffect, useState } from "react";

import { useRef } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { AnimatePresence, motion } from "motion/react";
import {
  PanelLeft, PanelRight, GitBranch, LayoutTemplate, Puzzle,
  Moon, Sun, Sparkles, Play, History,
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
import { PrototypePlay } from "./ui/PrototypePlay";
import { LayersPanel } from "./ui/LayersPanel";
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
        <button className="ai-btn" onClick={() => setAiOpen(true)}>
          <Sparkles size={14} /> AI
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
            { id: "assistant", icon: <Sparkles size={18} />, title: "AI assistant", on: () => setAiOpen(true) },
          ] as const).map((it) => (
            <button key={it.id} className={`rail-icon${leftMode === it.id ? " on" : ""}`} title={it.title} onClick={it.on}>
              {it.icon}
            </button>
          ))}
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

            {/* Layers — the real tree (click to select, 👁 to toggle) */}
            <div style={{ padding: "0 4px 10px", borderTop: "1px solid var(--line, var(--border))" }}>
              <div style={{ padding: "8px 8px 4px", fontSize: 11.5, fontWeight: 500, color: "var(--text-3)" }}>Layers</div>
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
            {(["Design", "Prototype", "Inspect", "Assistant", "Review"] as const).map((t) => (
              <button key={t} className={dsTab === t ? "on" : ""} onClick={() => { setDsTab(t); if (t === "Assistant") setAiOpen(true); }}>
                {t}
              </button>
            ))}
          </div>

          {dsTab === "Design" && (
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

          {dsTab === "Prototype" && (
            <div className="pane-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 12, color: "var(--t3)" }}>
                Preview your design with no editor chrome — at real phone, tablet &amp; desktop widths.
              </div>
              <button className="ai-btn" style={{ width: "100%", justifyContent: "center", gap: 6 }}
                onClick={() => canvasReady && excalidrawApi.current && setPlaying(true)}>
                <Play size={14} /> Play
              </button>
              <div style={{ fontSize: 11.5, color: "var(--t3)", marginTop: 4, lineHeight: 1.5 }}>
                Tip: use frames (artboards) to lay out separate screens — Play shows the whole canvas as a clean preview.
              </div>
            </div>
          )}
          {dsTab === "Inspect" && (
            <div className="pane-body" style={{ padding: 0 }}>
              <InspectPanel api={canvasReady ? excalidrawApi.current : null} />
            </div>
          )}
          {dsTab === "Assistant" && (
            <div className="pane-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 11.5, color: "var(--t3)" }}>The assistant runs on your local model (LM Studio / Ollama). Nothing leaves this Mac.</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>What should we change?</div>
              {["Add a secondary button", "Make this artboard dark", "Center the layers", "Tighten the title copy"].map((s) => (
                <button key={s} onClick={() => setAiOpen(true)}
                  style={{ textAlign: "left", padding: "8px 10px", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surf)", color: "var(--t1)", cursor: "pointer", fontSize: 12.5 }}>
                  {s}
                </button>
              ))}
              <button className="ai-btn" style={{ width: "100%", justifyContent: "center", marginTop: 4 }} onClick={() => setAiOpen(true)}>✦ Open the assistant</button>
            </div>
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
