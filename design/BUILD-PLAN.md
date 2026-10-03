# Draften — build plan to match the approved v2 design

> The approved design (10 screenshots + `design/*.dc.html`) is a complete product:
> a git-native design app with many modes, a landing website, and a docs site. This
> plan sequences the build so it matches the design without sprawl. The HTML mockups
> in `design/` are the pixel spec; `src/index.css` already carries the tokens.

## What the design actually is (from the screenshots + mockups)

### A) The app (one shell, many modes)
- **Topbar**: `◉ Draften` · `app-designs / Onboarding` breadcrumb · **Design / Split /
  Code / Console** segmented · `● Ready` · (right) avatars + **Live** · branch
  `feat/onboarding` · undo/redo · **Export**.
- **Left rail** — context-switches by a vertical icon strip:
  - **Artboards & layers**: Pages (Onboarding/Settings/Marketing) · Artboards
    (Welcome/Create account/Connect repository + sizes) · Layers (nested tree).
  - **Source control**: branch, Pull/Push, commit message, Changes, Pull requests.
  - **Integrations / MCP**: "Draften as an MCP server", the `draften` API list, copy
    client config; MCP / Editors / Plugins tabs.
  - **Models & connections**: LM Studio / Ollama / llama.cpp / OpenAI-compatible
    endpoints with Connected status (the provider system — already built).
- **Canvas**: multiple **artboards side by side** (real phone/screen mockups), a
  bottom tool dock (select/frame/shapes/text/pen/connector), zoom control, dot grid.
- **Right rail** — tabbed: **Design · Prototype · Inspect · Assistant · Review**
  - **Design**: page props, "Artboards on this page", Shortcuts list.
  - **Prototype**: flow arrows between artboards, "Play from Welcome", links list.
  - **Assistant**: provider badge (Qwen3 16B · LM Studio · Local), "What should we
    change?" action chips, prompt box → edits (already built: assistant + changelog).
  - **Review**: threaded comments (people + avatars), numbered pins, Approve/Request.
  - **Inspect**: measurements/CSS of the selection.
- **Live session**: multiplayer presence (You/Jonas/Priya, GitHub avatars), invite.
- **Templates** gallery (modal): categories + cards, some "Planned".

### B) The website (landing)
"A free design tool that lives in your git repo." Hero, `brew install --cask
draften`, Download for macOS, the app screenshot, "Free and open source · MIT".

### C) The docs site
"Product brief" — left nav (Overview/Product/Design/Engineering/Quality/Strategy),
"The idea", a "Principles" table (Local-first, Git is the source of truth, …).

## What's already built (reuse)
- ✅ Tokens/design language (`src/index.css`) — teal-green, Geist, warm-neutral.
- ✅ The **Assistant** (streamed, structured actions) + **changelog** + **LM Studio /
  any-LLM** providers + **canvas drawing** + prompt starters.
- ✅ The shell skeleton (topbar, 3 rails, Design/Split/Code, Excalidraw canvas).
- ✅ Tauri desktop packaging (`.dmg`).

## Build order (incremental, each shippable)
1. **App shell to spec — left rail.** The icon strip + the four left modes
   (Artboards&layers tree / Source control / Integrations-MCP / Models&connections).
   Pages/Artboards/Layers is the backbone the canvas hangs off.
2. **App shell — right rail tabs.** Design · Prototype · Inspect · Assistant ·
   Review as real tabs (Assistant already works; style it to the screenshot).
3. **Canvas — side-by-side artboards** + the bottom tool dock + zoom/dot-grid, so a
   page shows multiple screens like the mockup.
4. **Modes depth** — Prototype (flow arrows + Play), Review (comments + pins),
   Source control (real git via Tauri), Templates gallery. (Biggest; stage it.)
5. **Live session** — presence/multiplayer (later; needs a transport).
6. **Website** — the landing page (static; fast; ship first of the public pair).
7. **Docs site** — the product-brief docs (static).

## Honesty
This is a large build — weeks, not one pass. Each step above is a real, self-
contained increment that moves the app visibly toward the screenshots. We ship and
verify each, never a hollow shell. The design in `design/` is the source of truth.
© Ankur Sinha.
