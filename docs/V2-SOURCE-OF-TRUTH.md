# V2 = the source of truth

> Ankur: "Refer to V2 for everything — that's the source of truth on what our goal
> is." Extracted from `Design system for local LLM app.zip` → `Draften v2.dc.html`.
> The app must have EVERYTHING here. ✅ = shipped, ◻ = still to build.

## Canvas / layers / artboards
- ✅ Layers (real tree), Pages, Artboards, Autosave, Snap
- ◻ New artboard · Custom size · **Align** · Bring forward / Send backward ·
  Opacity (per-layer, have it in Inspect) · Scale · Show dot grid toggle
  (align/forward/backward exist in Excalidraw right-click — surface them as buttons)

## Design system (the spine)
- ✅ Components (generate), Templates
- ◻ **Color styles · Text styles** (named, reusable) · Create / Update / Detach
  component · Instance of · Preview variants · Colors matched to styles

## Text
- ◻ Bold / Regular / Medium · Sans / Serif / Mono · Fonts substituted warning

## Prototype / interaction
- ✅ Play (preview)
- ◻ Interaction · Trigger · Navigate to · Animation · Duration · Easing ·
  Scenarios · Links on this page (real artboard→artboard links)

## Git — the collaboration spine (GitHub now → all later)
- ✅ Sign in (device flow), commit, Open PR, branches, Pull requests (panel)
- ◻ **Clone a repository** (Repository URL + PAT) · Git identity · **Pull** ·
  Review and commit · Abort / Complete **merge** · Restore this version
- ✅ Open-format files (.draften.json / .excalidraw) + Export (SVG/PNG) + **Build
  runnable app (.zip)** + standalone HTML  ← app-builder, beyond v2

## Live collaboration
- ◻ **Live session** · Invite · Reply · End session · Share

## AI assistant
- ✅ Conversational assistant (New chat feel), Ask the assistant, keyless automations
- ◻ **Draften as an MCP server** · "Servers the assistant can use" (MCP clients) ·
  Copy client config · Assistant edits (apply/preview)

## Review
- ✅ Approve · Request changes · (comments) · Dismiss (have resolve)
- ◻ Load sample review · "No review on this branch" states

## Welcome / onboarding
- ◻ "Welcome to Draften" · New project · Open project · Clone a repository ·
  Recent · Skip to the editor

## Theme / settings
- ✅ Theme toggle (light/dark)
- ◻ Settings panel · Shortcuts · Report an issue

PRIORITY (Ankur, "SketchApp-style working much needed" + "app builder"):
1. Titlebar fix (brand collides with macOS traffic lights — data-os not applying)
2. Build runnable app (DONE) + export repo
3. Color/Text styles + component instances (the Sketch design-system working)
4. Clone a repository + Pull + Review-and-commit (full git loop)
5. MCP server (Draften as an MCP server) — the AI-builder moat
6. Live session (collaborate)
