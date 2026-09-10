# Draften — Features (source of truth)

## 🐞 BUG AUDIT (2026-09-10, from the running app)
Dead/decorative UI that makes it feel unfinished — fix these:
1. **Boards "+" does nothing** — no onClick; can't add a board.
2. **"⑂ main" branch button is decorative** — no Git behind it.
3. **Split view = broken** — the segmented control sets `view` but only "Design"
   renders; Split shows nothing (no split layout), Code shows nothing (no editor).
4. **Inspect tab is a placeholder** — "Select a node to inspect" never populates;
   not wired to Excalidraw selection.
5. **Layers = placeholder** — "Managed on the canvas"; no real layers panel.
6. **Component cards aren't draggable** — can't drag a component onto the canvas.
7. **Figma paste unhandled** — no clipboard listener (the #1 complaint).
8. **App icon is default Tauri** — not the Draften logo yet.

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
- ✅ **Sketch** importer (.sketch ZIP/JSON → model, tested)
- 🟡 **PDF** importer (page → board, stub)
- ⬜ **Figma paste** — paste copied Figma layers (clipboard `figmeta`/`figma`
  format) → Draften. **BROKEN today: no clipboard handler at all.** ← top gap
- ⬜ **Figma file** import (REST API + token → node tree)
- ⬜ **OmniGraffle** importer (Rust `decode_omnigraffle` exists → wire to model)
- ⬜ Generic image paste (PNG/SVG from clipboard → canvas)

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

## Git (real, not a chip)  ← Ankur wants this
- 🟡 "⑂ main" is decorative today
- ⬜ **Real Git** — init/commit/branch/diff the document (JSON) so designs are
   versioned + shareable like code; GitHub-backed collaboration
- ⬜ Open a design from a GitHub repo; push/pull changes

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
