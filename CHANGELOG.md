# Changelog

All notable changes to Draften. Draften is **free & open source (MIT)** on
Mac · Windows · Linux · Web. © Ankur Sinha.

## 1.0.00 — Opens their files · boolean · real layers

The 1.0 release. Draften opens the files other tools lock you into, combines
shapes like Sketch, and gives layers real Figma/Sketch actions — plus a proper
website, docs, and a SKILL file so any AI can drive it.

### Opens their files (it's your file — Draften opens it)
- **OmniGraffle** (`.graffle`) — decodes the gzipped Apple binary property list
  (our own `bplist` reader, no native dep) → shapes, connectors, groups, text.
- **Figma** (link + token) — reads your file via Figma's official REST API →
  frames, rectangles, ellipses, text, nested components.
- **Sketch** (`.sketch`), **PDF** (editable text), **Word** (`.docx`) — unchanged,
  still supported. Unknown nodes are approximated (never dropped) and noted.

### Design — Sketch parity
- **Boolean shapes** — Union · Subtract · Intersect · Difference, producing real
  editable vector paths (via a polygon-clipping engine). The "Combine" bar shows
  on 2+ shapes.
- **Layer actions** — rename (double-click), **lock/unlock**, duplicate, delete,
  reorder (drag), bring-to-front / send-to-back, right-click context menu, and
  **wrap selection in an artboard**.

### Fonts
- **Self-hosted** Geist / Geist Mono / Source Serif 4 / Inter (@fontsource) so
  type always renders — offline and on the desktop build.

### Website, docs & AI
- **Website** rebuilt to a premium, sketch.com-grade landing (OS/chip-aware
  download, honest product shot, comparison table, accessibility: skip-link +
  focus-visible).
- **Documentation** site with the full **free-user git flow** (install → create a
  GitHub token → connect → design → commit) + every feature, shortcuts, privacy,
  troubleshooting.
- **SKILL.md** — teaches any LLM / MCP client to drive Draften well.

### Project
- Grounded **Sketch feature drill-down** (`docs/SKETCH-PARITY-REVIEW.md`).
- 103 tests green. Single canonical author (Ankur Sinha).

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
