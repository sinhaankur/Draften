import { useEffect, useState } from "react";

import { useRef } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { AnimatePresence, motion } from "motion/react";
import {
  PanelLeft, PanelRight, GitBranch, LayoutTemplate, Puzzle,
  Moon, Sun, Sparkles, History, Package, Server, Maximize2, MessageSquarePlus,
} from "lucide-react";

import { ExcalidrawCanvas, toElements } from "./canvas/ExcalidrawCanvas";
import { registerCanvasApplier } from "./canvas/apply-action";
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
import { WelcomeScreen } from "./ui/WelcomeScreen";
import { downloadProject } from "./export/project";
import { PrototypePlay } from "./ui/PrototypePlay";
import { PresentMode } from "./ui/PresentMode";
import { LayersPanel } from "./ui/LayersPanel";
import { RailAccount } from "./ui/RailAccount";
import { SettingsPanel, type SettingsValues } from "./ui/SettingsPanel";
import { MeasureOverlay } from "./ui/MeasureOverlay";
import { ComponentsPanel } from "./ui/ComponentsPanel";
import { AnnotationLayer } from "./ui/AnnotationLayer";
import { useAnnotations } from "./state/annotations-store";
import { StylesPanel } from "./ui/StylesPanel";
import { AlignBar } from "./ui/AlignBar";
import { BooleanBar } from "./ui/BooleanBar";
import { McpPanel } from "./ui/McpPanel";
import { PrototypePanel } from "./ui/PrototypePanel";
import { importFile, canImportFile, registerDesktopDrop } from "./import/import-file";
import "./App.css";

const LEVELS: AtomicLevel[] = ["atom", "molecule", "organism", "template", "page"];

// The app version shown in the top bar — fixed to the real release, not whatever
// appVersion a (possibly stale) saved document carries.
const APP_VERSION = "1.0.0";

export function App() {
  const doc = useEditor((s) => s.doc);
  const activeBoardId = useEditor((s) => s.activeBoardId);
  const setActiveBoard = useEditor((s) => s.setActiveBoard);
  const addBoard = useEditor((s) => s.addBoard);
  const renameBoard = useEditor((s) => s.renameBoard);
  const deleteBoard = useEditor((s) => s.deleteBoard);
  const [editingBoard, setEditingBoard] = useState<string | null>(null);

  const [view, setView] = useState<"Design" | "Split" | "Code" | "Console">("Design");
  const [dsTab, setDsTab] = useState<"Design" | "Styles" | "Prototype" | "Assistant" | "Review">("Design");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    try { return (localStorage.getItem("draften-theme") as "light" | "dark") || "light"; } catch { return "light"; }
  });
  const [pluginsOpen, setPluginsOpen] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [mcpOpen, setMcpOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [presenting, setPresenting] = useState(false);
  // Welcome / start screen — the front door. Shown until the user starts (first
  // run), then reopenable from the brand. Persisted so it only greets once.
  const [welcome, setWelcome] = useState(() => {
    try { return localStorage.getItem("draften-welcomed") !== "1"; } catch { return true; }
  });
  const dismissWelcome = () => { setWelcome(false); try { localStorage.setItem("draften-welcomed", "1"); } catch { /* ignore */ } };
  const [dotGrid, setDotGrid] = useState(false); // off by default — Sketch has a clean canvas
  const [snap, setSnap] = useState(true);
  const [aiProvider, setAiProvider] = useState(() => { try { return localStorage.getItem("draften-ai-provider") || "deterministic"; } catch { return "deterministic"; } });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const applySettings = (patch: Partial<SettingsValues>) => {
    if (patch.theme) { setTheme(patch.theme); try { localStorage.setItem("draften-theme", patch.theme); } catch { /* ok */ } }
    if (patch.dotGrid !== undefined) { setDotGrid(patch.dotGrid); excalidrawApi.current?.updateScene({ appState: { ...excalidrawApi.current.getAppState(), gridModeEnabled: patch.dotGrid } }); }
    if (patch.snap !== undefined) setSnap(patch.snap);
    if (patch.aiProvider) { setAiProvider(patch.aiProvider); try { localStorage.setItem("draften-ai-provider", patch.aiProvider); } catch { /* ok */ } }
  };
  const [pasteNote, setPasteNote] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Native desktop drag-drop (Tauri): the OS drop reports file PATHS, which the
  // browser onDrop never sees. This wires the webview drag-drop event → importer,
  // so dropping a file onto the app window actually opens it. No-op on the web.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    registerDesktopDrop((msg) => setPasteNote(msg), (over) => setDragOver(over)).then((u) => { unlisten = u; });
    return () => unlisten?.();
  }, []);
  // Responsive drawers (below md the rails slide over the canvas — Hick's Law).
  const [leftOpen, setLeftOpen] = useState(true); // layers/artboards visible on launch (Sketch/Figma always show it)
  const [leftMode, setLeftMode] = useState<"layers" | "git" | "components" | "history">("layers");
  const [rightOpen, setRightOpen] = useState(true); // inspector visible on launch (Sketch/Figma do)
  const annDropping = useAnnotations((s) => s.dropping);
  const setAnnDropping = useAnnotations((s) => s.setDropping);
  const setDesignSystem = useEditor((s) => s.setDesignSystem);
  const rename = useEditor((s) => s.rename);
  const excalidrawApi = useRef<ExcalidrawImperativeAPI | null>(null);
  // Flip once the canvas API exists so panels that read it (Inspect) re-render.
  const [canvasReady, setCanvasReady] = useState(false);
  // Is a layer selected? drives the Sketch-style right panel (inspector when
  // selected; page + design-system when not).
  const [hasSelection, setHasSelection] = useState(false);
  useEffect(() => {
    if (!canvasReady) return;
    let t = 0;
    const tick = () => {
      try {
        const api = excalidrawApi.current;
        if (api) { const st = api.getAppState(); const n = Object.keys(st.selectedElementIds || {}).filter((k) => st.selectedElementIds[k]).length; setHasSelection((v) => (v === n > 0 ? v : n > 0)); }
      } catch { /* ignore */ }
      t = window.setTimeout(tick, 300) as unknown as number;
    };
    tick();
    return () => window.clearTimeout(t);
  }, [canvasReady]);

  // Per-page canvas scenes (Sketch-style): each Page has its OWN artboards/layers.
  // Switching pages saves the current scene and loads the target's. Keyed by board id.
  const pageScenes = useRef<Map<string, readonly unknown[]>>(new Map());

  /** Switch to a page like Sketch: stash the current page's canvas, load the new one. */
  const switchPage = (id: string) => {
    if (id === activeBoardId) return;
    const api = excalidrawApi.current;
    if (api) {
      // save the page we're leaving
      pageScenes.current.set(activeBoardId, api.getSceneElements());
      // load the page we're entering (empty if never visited)
      const next = pageScenes.current.get(id) ?? [];
      api.updateScene({ elements: next as Parameters<typeof api.updateScene>[0]["elements"] });
      setTimeout(() => { try { api.scrollToContent(api.getSceneElements(), { fitToContent: true, animate: false }); } catch { /* ignore */ } }, 40);
    }
    setActiveBoard(id);
  };

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
      const target = e.target as HTMLElement | null;
      // NEVER intercept paste into a form field (token input, text areas, etc.) —
      // let the field receive it normally. (This was blocking the GitHub token paste.)
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
      // let Excalidraw handle its own native paste (its own elements)
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
    <div className="app"
      onDragOver={(e) => { if (e.dataTransfer?.types?.includes("Files")) { e.preventDefault(); setDragOver(true); } }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
      onDrop={async (e) => {
        if (!e.dataTransfer?.files?.length) return;
        e.preventDefault(); setDragOver(false);
        const file = Array.from(e.dataTransfer.files).find((f) => canImportFile(f.name)) ?? e.dataTransfer.files[0];
        setPasteNote("Opening " + file.name + "…");
        try { setPasteNote(await importFile(file)); } catch (err) { setPasteNote("Couldn't open " + file.name + ": " + (err as Error).message); }
      }}>
      {/* Welcome / start screen — the front door (first run + reopenable). */}
      {welcome && (
        <WelcomeScreen
          onBlank={dismissWelcome}
          onTemplate={(t) => { dismissWelcome(); setTimeout(() => pickTemplate(t), 60); }}
          onOpenFile={() => {
            dismissWelcome();
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".sketch,.graffle,.pdf,.docx,.svg,.png,.jpg";
            input.onchange = async () => {
              const file = input.files?.[0];
              if (!file) return;
              setPasteNote("Opening " + file.name + "…");
              try { setPasteNote(await importFile(file)); } catch (err) { setPasteNote("Couldn't open " + file.name + ": " + (err as Error).message); }
            };
            input.click();
          }}
          onConnectGit={() => { dismissWelcome(); setLeftMode("git"); setLeftOpen(true); }}
        />
      )}

      {/* drop-to-open overlay */}
      {dragOver && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(61,107,95,.12)", backdropFilter: "blur(2px)", display: "grid", placeItems: "center", pointerEvents: "none" }}>
          <div style={{ background: "var(--panel, #fbfbfa)", border: "2px dashed var(--accent, #3d6b5f)", borderRadius: 16, padding: "28px 40px", fontSize: 16, fontWeight: 600, color: "var(--accent, #3d6b5f)" }}>
            Drop to open · PDF · Word · Sketch
          </div>
        </div>
      )}
      {/* unified toolbar (Xcode-style): leading identity · flexible space ·
          grouped trailing actions, separated by spacers */}
      <header className="topbar">
        <button className="rail-toggle" title="Boards & layers" onClick={() => { setLeftOpen((v) => !v); setRightOpen(false); }}><PanelLeft size={16} /></button>
        <div className="brand">
          <span className="logo" style={{ display: "inline-grid", placeItems: "center", width: 22, height: 22, borderRadius: 6, background: "var(--accent)", flex: "none" }}>
            {/* solid geometric D monogram */}
            <svg width="14" height="14" viewBox="0 0 24 24" aria-label="Draften">
              <path d="M6 4h6.5a7.5 8 0 0 1 0 16H6V4zm3.5 3.2v9.6h2.8a4.8 4.8 0 0 0 0-9.6z" fill="#fff"/>
            </svg>
          </span>
          <span>Draften</span>
          <span className="chip">v{APP_VERSION}</span>
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

        {/* File — real Save/Open/Export in open formats. Templates, Plugins, MCP
            and the Assistant all live in the left rail now, so the top bar stays
            calm: no duplicate entry points (one home per action). */}
        <FileMenu api={canvasReady ? excalidrawApi.current : null} name={doc.name} onOpened={(n) => rename(n)} onToast={(m) => setPasteNote(m)} />

        <div className="tb-sep" />

        {/* trailing cluster: annotate · appearance · reset view · export · panel toggle */}
        <button
          className={`tb-btn tb-icon${annDropping ? " on" : ""}`}
          onClick={() => setAnnDropping(!annDropping)}
          title="Add a note (annotation pin) — click the canvas to place"
          aria-label="Add annotation"
          style={annDropping ? { background: "var(--accent-soft)", color: "var(--accent)" } : undefined}
        >
          <MessageSquarePlus size={15} />
        </button>
        <button
          className="tb-btn tb-icon"
          onClick={() => setTheme((t) => { const next = t === "light" ? "dark" : "light"; try { localStorage.setItem("draften-theme", next); } catch { /* ok */ } return next; })}
          title="Toggle appearance"
        >
          {theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
        </button>
        {/* Reset view — fit all content to the viewport */}
        <button className="tb-btn tb-icon" title="Reset view (fit to content)"
          onClick={() => { const api = excalidrawApi.current; if (api) { api.scrollToContent(api.getSceneElements(), { fitToContent: true, animate: true }); api.updateScene({ appState: { ...api.getAppState() } }); } }}>
          <Maximize2 size={15} />
        </button>
        {/* Export — build the runnable app (v2's green Export button) */}
        <button className="export-btn" title="Export a runnable app (.zip)"
          onClick={() => { if (canvasReady && excalidrawApi.current) void downloadProject(excalidrawApi.current, doc.name); }}>
          <Package size={14} /> Export
        </button>
        <button className="rail-toggle" title="Design system" onClick={() => { setRightOpen((v) => !v); setLeftOpen(false); }}><PanelRight size={16} /></button>
      </header>

      <AnimatePresence>
        {pluginsOpen && <PluginsPanel key="plugins" onClose={() => setPluginsOpen(false)} />}
        {templatesOpen && <TemplatesPanel key="templates" onClose={() => setTemplatesOpen(false)} onPick={pickTemplate} />}
        {mcpOpen && <McpPanel key="mcp" onClose={() => setMcpOpen(false)} />}
      </AnimatePresence>

      {playing && canvasReady && excalidrawApi.current && (
        <PrototypePlay api={excalidrawApi.current} onClose={() => setPlaying(false)} />
      )}

      {presenting && canvasReady && excalidrawApi.current && (
        <PresentMode api={excalidrawApi.current} onClose={() => setPresenting(false)} />
      )}

      {settingsOpen && (
        <SettingsPanel
          onClose={() => setSettingsOpen(false)}
          values={{ theme, dotGrid, snap, aiProvider }}
          onChange={applySettings}
        />
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
            { id: "mcp", icon: <Server size={18} />, title: "Draften as an MCP server", on: () => setMcpOpen(true) },
            { id: "assistant", icon: <Sparkles size={18} />, title: "AI assistant", on: () => { setDsTab("Assistant"); setRightOpen(true); } },
          ] as const).map((it) => (
            <button key={it.id} className={`rail-icon${leftMode === it.id ? " on" : ""}`} title={it.title} onClick={it.on}>
              {it.icon}
            </button>
          ))}

          {/* account — pinned at the bottom of the rail (v2's avatar) */}
          <div style={{ flex: 1 }} />
          <RailAccount onOpenSettings={() => setSettingsOpen(true)} />
        </nav>

        {/* left: Artboards & layers — ported from design/Draften v2.dc.html
            (exact markup + inline styles, wired to real state). */}
        <aside className={`left${leftOpen ? " open" : ""}`}
          style={{ width: 256, flex: "none", display: "flex", flexDirection: "column", minHeight: 0, borderRight: "1px solid var(--line, var(--border))", background: "var(--panel, var(--raised))" }}>
          {/* header — serif title + mode toggle (Layers / Source control) */}
          <div style={{ height: 44, flex: "none", display: "flex", alignItems: "center", padding: "0 10px 0 16px", gap: 6 }}>
            <span style={{ flex: 1, fontFamily: "var(--font-serif)", fontSize: 16, fontWeight: 500 }}>
              {leftMode === "layers" ? "Artboards & layers"
                : leftMode === "components" ? "Components"
                : leftMode === "history" ? "Version history"
                : "Source control"}
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
            <ComponentsPanel
              api={canvasReady ? excalidrawApi.current : null}
              onOpenTemplates={() => setTemplatesOpen(true)}
              onGenerate={() => { setDsTab("Assistant"); setRightOpen(true); }}
            />
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
                <button title="Add a page" onClick={() => { const name = window.prompt("New page name", `Page ${doc.boards.length + 1}`); if (name !== null) addBoard("design", name); }}
                  style={{ width: 20, height: 20, border: 0, borderRadius: 5, background: "transparent", color: "var(--text-3)", cursor: "pointer", display: "grid", placeItems: "center", fontSize: 14 }}>+</button>
              </div>
              {doc.boards.map((b) => (
                <div key={b.id} className="page-row" onClick={() => switchPage(b.id)} onDoubleClick={() => setEditingBoard(b.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 6, cursor: "pointer",
                    background: b.id === activeBoardId ? "var(--acc-soft, var(--accent-soft))" : "transparent",
                    color: b.id === activeBoardId ? "var(--accent-text, var(--accent))" : "var(--text)",
                    fontWeight: b.id === activeBoardId ? 500 : 400,
                  }}>
                  <span style={{ width: 6, height: 6, borderRadius: 2, background: "var(--accent)", opacity: b.id === activeBoardId ? 1 : 0.4, flex: "none" }} />
                  {editingBoard === b.id ? (
                    <input autoFocus defaultValue={b.name}
                      onClick={(e) => e.stopPropagation()}
                      onBlur={(e) => { const v = e.target.value.trim(); if (v) renameBoard(b.id, v); setEditingBoard(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditingBoard(null); }}
                      style={{ flex: 1, minWidth: 0, border: "1px solid var(--accent)", borderRadius: 4, padding: "1px 5px", fontSize: 13, background: "var(--surf)", color: "var(--t1)" }} />
                  ) : (
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</span>
                  )}
                  <span style={{ color: "var(--text-3)", fontSize: 11 }}>{b.children.length || ""}</span>
                  {doc.boards.length > 1 && (
                    <button className="page-del" title="Delete page" onClick={(e) => { e.stopPropagation(); if (window.confirm(`Delete page "${b.name}"?`)) deleteBoard(b.id); }}
                      style={{ border: 0, background: "transparent", color: "var(--text-3)", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: 0, flex: "none" }}>×</button>
                  )}
                </div>
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
            {/* Spacing guides (Alt/Option-hover) over the canvas — Figma/Sketch-style. */}
            {canvasReady && <MeasureOverlay api={excalidrawApi.current} />}
            {/* Numbered annotation pins anchored to the canvas (specs / review). */}
            {canvasReady && <AnnotationLayer api={excalidrawApi.current} />}
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
            {(["Design", "Styles", "Prototype", "Assistant", "Review"] as const).map((t) => (
              <button key={t} className={dsTab === t ? "on" : ""} onClick={() => setDsTab(t)}>
                {t}
              </button>
            ))}
          </div>

          {dsTab === "Design" && (
            /* Design tab = THE INSPECTOR (Sketch/Figma: the right panel is the
               inspector, nothing else). A layer selected → its properties; nothing
               selected → the Page/Document inspector + a quiet hint. Design-system
               + styles live in their own "Styles" tab now. */
            <>
              <div className="pane-body">
                <InspectPanel api={canvasReady ? excalidrawApi.current : null} />
                <AlignBar api={canvasReady ? excalidrawApi.current : null} />
                <BooleanBar api={canvasReady ? excalidrawApi.current : null} />

                {hasSelection ? null : (
                  <>
                    <div style={{ textAlign: "center", padding: "6px 0 14px", color: "var(--sk-text-3, #8e8d88)" }}>
                      <div style={{ fontSize: 12.5, lineHeight: 1.6 }}>Nothing selected</div>
                      <div style={{ fontSize: 11.5, marginTop: 2 }}>Pick a layer to inspect it, or press <span style={{ fontFamily: "var(--font-mono, monospace)" }}>?</span> for shortcuts.</div>
                    </div>

                    <div className="section-title">Page</div>
                    <div style={{ width: "100%", borderRadius: 8, border: "1px solid var(--line, #e7e6e2)", padding: "7px 10px", fontSize: 13, background: "var(--surf, #fff)", color: "var(--t1, #1d1d1b)", marginBottom: 8 }}>
                      {activeBoard?.name ?? doc.name}
                    </div>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer", marginBottom: 4 }}>
                      <input type="checkbox" checked={dotGrid} onChange={(e) => { setDotGrid(e.target.checked); excalidrawApi.current?.updateScene({ appState: { ...excalidrawApi.current.getAppState(), gridModeEnabled: e.target.checked } }); }} />
                      Show dot grid
                    </label>
                  </>
                )}
              </div>
            </>
          )}

          {dsTab === "Styles" && (
            /* Styles tab = the design system (brand · colour + text styles ·
               components). Pulled out of the inspector so the Design tab stays
               inspector-first, like Sketch/Figma. */
            <>
              <div className="pane-body">
                <div className="section-title">Design system</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <input
                    value={doc.designSystem.brand.name}
                    onChange={(e) => setDesignSystem({ ...doc.designSystem, brand: { ...doc.designSystem.brand, name: e.target.value } })}
                    placeholder="Brand name"
                    style={{ flex: 1, minWidth: 0, borderRadius: 8, border: "1px solid var(--line, #e7e6e2)", padding: "7px 10px", fontSize: 14, fontWeight: 600, background: "var(--surf, #fff)", color: "var(--t1, #1d1d1b)" }}
                  />
                  <span className="ver" style={{ flex: "none" }}>v1.0.00</span>
                </div>

                <div className="section-title">Brand Kit</div>
                <div className="swatches">
                  {swatchColors.map((c, i) => (
                    <span key={i} className="swatch" style={{ background: c }} />
                  ))}
                </div>
                <div className="muted small">Inter · 4pt grid</div>

                <div className="divider" />

                <StylesPanel api={canvasReady ? excalidrawApi.current : null} />

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
            <PrototypePanel
              api={canvasReady ? excalidrawApi.current : null}
              onPlay={() => canvasReady && excalidrawApi.current && setPlaying(true)}
              onPresent={() => canvasReady && excalidrawApi.current && setPresenting(true)}
              activeBoardName={activeBoard?.name ?? "Welcome"}
            />
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
          <button className="status-toggle" title="Toggle the dot grid"
            onClick={() => { setDotGrid((v) => { const next = !v; excalidrawApi.current?.updateScene({ appState: { ...excalidrawApi.current.getAppState(), gridModeEnabled: next } }); return next; }); }}>
            Grid {dotGrid ? "on" : "off"}
          </button>
        </div>
      </footer>
    </div>
  );
}
