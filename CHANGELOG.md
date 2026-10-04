# Changelog

All notable changes to Draften. Versions follow semver (pre-1.0: minor bumps per
feature wave). Draften is **free & open source (MIT)** on Mac · Windows · Linux · Web.

## 0.4.0 — Design tool, for real

The release where Draften became a genuinely usable, Figma/Sketch-grade design tool.

### Design
- **Figma-style inspector** — selecting a layer shows Position · Layout · Appearance ·
  Fill · Stroke · Text, all editable, writing straight to the canvas.
- **Sketch-style pages** — each page has its own canvas; switching swaps the artboards.
  Pages are named, renameable (double-click) and deletable.
- **Nested Layers tree** — artboards (real frames) with named children, type icons,
  visibility, collapse.
- **Artboards section** with dimensions + **New artboard presets** (iPhone / Android /
  Tablet / Desktop / Square).
- **Color styles + Text styles** (apply to selection) and **Align & distribute** (2+ layers).
- Editable **brand name** / design system; vector icons app-wide (lucide @1.5).

### Dev-oriented (git + code)
- **GitHub sign-in** (Personal Access Token) → **Clone · Pull · Commit · Open PR**, and
  **open designs straight from a repo** (your designs live in your git repo).
- **Export a runnable app** (.zip Vite+React+TS) + **open-format Save/Open** (.draften.json,
  .excalidraw) + SVG/PNG.
- **Code view** — live React/HTML generated from the canvas.

### AI companion
- **Docked assistant** (Claude Design-style, in the right rail — not a popup).
- **Keyless design automations** — table of contents, flowcharts, grids, nav bars,
  checklists; run offline, on-device.
- **MCP server** — "Draften as an MCP server": exposes the canvas as tools (get_design,
  add_rectangle, …) + client config, so an external AI can drive it.

### Opens their files
- Open + **edit PDFs like a document**, plus Word and Sketch; **drag-and-drop** to open.

### Platform & polish
- **Cross-platform** — Mac (Apple Silicon + Intel), Windows (x64 + ARM), Linux (x64 + ARM),
  Web. Apple Intelligence is macOS-only; every other OS uses WebLLM / LM Studio / the
  keyless engine, so AI works everywhere.
- Auto-save (your work is never lost), reset-view, solid-D logo, single-window titlebar.
- Website with the "design-centered, dev-oriented, AI companion" positioning + full SEO +
  OS/chip detection.

## 0.1.0 — First scaffold
- The initial canvas, shell, and the two-view design/app experiment (later unified).
