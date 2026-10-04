# Draften — Features (source of truth)

## ✅ CLEARED — 2026-09-10 bug audit (all 8 fixed since)
The dead/decorative UI from the first audit is now real: Boards "+" adds a board ·
Git panel + branch wired · Split/Code views render · Inspect reads & edits the live
selection · Layers panel wired to the canvas · components drag onto the canvas ·
Figma/Sketch paste has a real clipboard handler (`src/import/paste.ts`) · the app
ships the Draften icon. Kept here as a record, not a to-do.

---


The free, open-source alternative to Figma × Sketch × OmniGraffle. One document
model, many surfaces. This is the honest running list — ✅ done · 🟡 partial ·
⬜ to build. We build down this list.

Reference app for UX/UI standard: **Sketch.app** (native macOS feel).

---

## Core (the spine)
- ✅ One document model (design + diagram + map nodes in one union)
- ✅ Zustand store (document + design system)
- ✅ Excalidraw canvas (draw, select, move, resize, bind arrows, undo — MIT)
- ✅ Native desktop app (Tauri) → `/Applications/Draften.app`
- ✅ Light-default theme + Draften Violet brand + full token system in CSS

## Opening / importing other tools' files ("opens their files")
- ✅ **Sketch** importer (.sketch ZIP/JSON → model, tested). Now carries
  **stroke/border, opacity, rotation, corner radius, and real text style**
  (family/size/weight/colour from the attributedString) — not just solid fills.
- ✅ **Figma file** import (REST API + token → node tree). Now carries
  **stroke + weight, opacity, rotation, linear gradients, image fills, and full
  text style** (weight / align / line-height / letter-spacing).
- ✅ **Figma / Sketch paste** — clipboard handler parses `figma`/`figmeta` + the
  readable HTML payload → nodes (`src/import/paste.ts`).
- ✅ **PDF** importer — each page → an **artboard of REAL, EDITABLE nodes**, the
  way Sketch lets you edit every shape. Powered by the standalone
  **`@draften/pdf-vectors`** package (`packages/pdf-vectors/`): vectors become
  editable **rectangle / path** nodes (fills across RGB/gray/CMYK, strokes, dashes,
  line widths, alpha, transforms), and text becomes editable **text** nodes — so you
  can click any shape or word and change it, with no baked-in "ghost" text. All
  nodes group under the page board; pages lay out side by side. Only a scanned/
  image-only page falls back to a rasterized image so nothing is lost.
- ✅ **PDF EXPORT (editable)** — `@draften/pdf-vectors` also writes a real PDF back
  out (vector shapes + selectable/searchable text, not a flattened raster). Draften
  is a round-trip PDF **editor**: open a PDF → edit → export a PDF. File ▸ "Export
  PDF (editable)". Verified round-trip (import → export → re-import is identity).
- ⬜ **OmniGraffle** importer (Rust `decode_omnigraffle` exists → wire to model)
- ⬜ Generic image paste (PNG/SVG from clipboard → canvas)
- ⬜ **OmniGraffle** importer (Rust `decode_omnigraffle` exists → wire to model)
- ⬜ Generic image paste (PNG/SVG from clipboard → canvas)

**Import fidelity (shared, `src/import/to-canvas.ts`):** imported nodes render on
the canvas with their real stroke width/colour, opacity, rotation, true corner
radius, a gradient approximated to its mid stop, real bitmap bytes for data-URI
images (rasterized PDF pages show for real; registered via Excalidraw's file
store), and the artboard sheet in the board's real background colour — so an
opened Sketch/Figma/PDF file reads like it did in the source tool, and the Inspect
panel reads those same fields back. Board-parented nodes are offset by the
artboard frame so multi-page docs don't stack at the origin.

## AI design-thinking (the CORE — UI wireframe + UX)
- ✅ **Wireframe a flow** — a UX intent ("onboarding flow for a fitness app") →
  MULTIPLE LINKED, EDITABLE SCREENS (phone artboards) built from real low-fi UI
  blocks (status bar, nav, hero, input, button/CTA, card, list, tab bar, image,
  stat), themed by the design system, chained with flow connectors.
  `src/ai/wireframe.ts`. Deterministic (works offline / tiny-LLM); LLM refines copy.
- Everything is editable nodes + AI-named layers → think with it, don't just look.
- NEXT (grounded in the Universal Experience Framework, sinhaankur.com/framework):
  AI that reasons about WHY — placement, grouping/proximity, hierarchy, Hick's/
  Fitts' — to propose + critique layouts, and a docs page that teaches it.

## Presentations (design tool surface — not a separate app)
- ✅ **Import a PDF/Word → "Make presentation"** → a themed, multi-slide deck of
  EDITABLE 16:9 artboards (title + section + content slides) on Draften's own
  tiered AI (deterministic; works offline). `src/ai/presentation.ts`.
- ✅ **AI-named layers** — every layer gets a human name + description (Hero
  heading, Accent bar, Bullet dot, Page number…), so the layer list reads like
  Sketch's, not "Rectangle/Text". `src/ai/layer-namer.ts`.
- ✅ **Present mode** — fullscreen slide show (`src/ui/PresentMode.tsx`): each
  board = a slide, arrow-key / click / space nav, thumbnail rail, speaker notes
  (N), per-slide SVG clipped to its frame. Reached from Prototype ▸ "Present".
- Framing: presentation is ONE surface of a UI-wireframe / UX design tool — the
  deck is just artboards + components + the shared document, presented. Next:
  richer AI layouts (2-col, image, quote), slide reorder, components in decks.

## Design system
- ✅ AI-generated design system (deterministic: tokens + atomic components)
- 🟡 System panel shows generated tokens + components
- ⬜ **Token editor** (edit color/type/spacing live)
- ⬜ **Component library** — drag a component onto canvas as an instance
- ⬜ Git-versioned library

## Code
- ⬜ **Code view** (Monaco) — component ↔ React/TS, two views of one model
- ⬜ Export selection → code

## AI
- ✅ Tiered, no-subscription AI (deterministic / Apple FM / tiny WebGPU LLM)
- ⬜ Cloud (Claude) provider option
- ⬜ AI edits the live document (not just generate-from-scratch)

## Plugins  ← Ankur wants this
- ⬜ **Plugin system** — a manifest + sandboxed API surface
- ⬜ **GitHub plugin support** — install/load a plugin from a GitHub repo/URL
- ⬜ Plugin registry UI (browse / enable / update)

## MCP  ← Ankur wants this
- ⬜ **Draften as an MCP server** — expose safe, named actions (read doc, add
  node, apply tokens, import file) so an AI/agent can drive Draften
- ⬜ Draften as an MCP client (consume other servers)

## UX / UI polish (to Sketch/Figma standard)
- 🟡 Editor chrome (top bar, boards, System/Inspect/Stack panels)
- ⬜ Native-grade polish pass vs Sketch.app (spacing, panels, inspector, menus,
  keyboard shortcuts, empty states, cursors)
- ⬜ Proper inspector (position/size/fill/stroke/text of the selected element)
- ⬜ Layers panel wired to the live canvas

---

## Git (real — designs live in your repo)
- ✅ **Real Git connect** — device-flow OAuth OR paste a Personal Access Token
  (account menu). Signed in → the Source Control panel lists repos/branches/
  commits/PRs, **commits the document** (`draften/<name>.draften.json`) via the
  GitHub API, **clones/pulls** a design out of a repo, and **opens a PR**. Every
  action reports success/failure; nothing faked. (`src/git/*`, SourceControlPanel.)
- ✅ **Git Diagram** — "Diagram" button reads the repo's file tree
  (`listTree`) and renders its ARCHITECTURE as an editable Draften diagram
  (top-level folders = grouped frames, files = shapes, src→components/packages
  connectors), to understand a project at a glance. Inspired by gitdiagram.com,
  native + deterministic. `src/ai/gitdiagram.ts`.
- ⬜ Visual commit diff of the document.

## Accounts & collaboration  ← Ankur wants this
- ⬜ **Account mode** — optional sign-in (keep guest/local-first default)
- ⬜ **GitHub account login (OAuth)** — sign in with GitHub; fits the "designs
   live in Git" model (your repos = your files, no separate account system)
- **AUTH IS FILE-TYPE-DRIVEN (Ankur's rule):** by default no login. Auth is only
   required by what you open — a local `.draften`/import = guest; a GitHub-hosted
   or shared/multi-user file = requires GitHub login. The file type decides.
- ⬜ **Multi-user mode** — real-time collaboration (multiple cursors, live edits).
   BIG: needs a sync backend (CRDT like Yjs + a relay) — the one feature that
   breaks pure local-first. Design it so guest/offline still works.
- ⬜ Share a design (link or GitHub) for others to open/edit

## The bigger why (Ankur)
"The start of open-source, GitHub-supported, collaborative design." Free tool +
your files live in Git + plugins from GitHub + AI on a local LLM = design work that
isn't locked in a paid silo.

## Local LLM  ← Ankur wants this
- ✅ Tiered AI already includes a tiny in-browser WebGPU LLM (web-llm) + Apple FM
- ⬜ Make the **local LLM the visible default** in the AI panel (pick model, runs
   on-device, no key), with deterministic fallback

## Branding  ← Ankur wants this
- 🟡 "◗ Draften" wordmark + Violet token exist
- ⬜ **Own it**: real logo mark, app icon, splash, consistent identity, MIT ©
   Ankur Sinha throughout (make it clearly HIS product)

---

## Build order (agreed, updated)
1. **UX/UI + branding polish** to Sketch standard — the app must look pro first
   (real logo/icon, refined chrome, inspector, layers wired, empty states).
2. **Figma paste** — catch clipboard, parse `figma` payload → nodes.
3. **Plugin system + GitHub install** — manifest, sandbox, load-from-GitHub.
4. **Real Git** — version the document, GitHub open/push/pull.
5. **Local LLM default** in the AI panel.
6. **MCP server** — named Draften actions an agent can call.
7. Design-system editor + Monaco code view.
