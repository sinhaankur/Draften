# Draften — the open-source playbook (learning from Blender & friends)

Blender is the proof that a **free, open-source, all-in-one, community-governed**
tool can match and beat expensive specialized software. Draften is the design-world
version of that bet. This is what we copy — and where we currently fall short.

## What made Blender win → what Draften does

### 1. The plugin API IS the app's API
Blender's whole UI + every add-on run through **one module (`bpy`)** — objects,
operators (actions), properties, panels (UI). A plugin is just a packaged script;
there's no second-class plugin layer. That single, uniform surface is *why* the
add-on ecosystem exploded.
- **Draften rule:** expose **one `draften` API** that the app, AI, importers, and
  plugins all use — `draften.document`, `draften.addNode`, `draften.tokens`,
  `draften.registerPanel`, `draften.registerImporter`, `draften.on(event)`.
  No private "core-only" powers. (Today we have importer/AI *contracts* but not
  this unified surface — **build it**; it's the highest-leverage architecture move.)

### 2. Layered: fast core + scriptable everything
C/C++ core + Python everywhere else. Draften's analog: **Rust (Tauri) core** for
heavy/binary/file/Git work + **TS/React** for UI, canvas, plugins. Already right.

### 3. All-in-one, free, beats specialized-and-paid
Blender bundled the whole pipeline free vs per-tool subscriptions. Draften =
design + diagram + tokens + code + deploy in one, vs Figma+Sketch+OmniGraffle+
handoff. This is the thesis — hold the line: **never paywall a feature.**

### 4. Community roadmap, diversified funding (later)
Blender's roadmap comes from contributors; a *diversified* fund (no single donor
steers it) sustains it — only ~0.5% pay, and that's fine. For Draften:
- Free-forever architecture already removes per-user cost.
- Sustainability (if ever) = optional donations / sponsors / a hosted-convenience
  tier — **the tool stays fully free and open.**
- Keep the roadmap public (FEATURES.md / DEPTH.md) and let issues drive it.

### 5. Prove it with real work ("Open Movies")
Blender made real films to validate the tool and pull features forward. Draften's
version: **dogfood in public** — design real things with Draften and ship them
(e.g. redesign a sinhaankur.com page in Draften → export → live). Each real use
surfaces the next real feature.

### 6. Radical honesty about limits
Blender is candid it's not yet the studio default. Draften keeps the same honesty
(the paste toast already says "full fidelity needs a file import"). Trust > hype.

## Other open-source tools worth mirroring
- **Excalidraw** (MIT) — already Draften's canvas. Study its plugin/extension
  patterns + `.excalidraw` open file format.
- **Penpot** — open-source Figma alternative; closest peer. Learn from its
  component/library model and self-host/collaboration approach (but Draften stays
  Git-backed/local-first, not server-required).
- **tldraw** — great SDK/extensibility design (note: non-commercial license, so we
  don't depend on it — Excalidraw was chosen for MIT).
- **Godot** (MIT) — how a free tool builds a real plugin/asset ecosystem + funding.
- **VS Code / Language Server Protocol** — the extension API + the idea of a
  documented protocol others implement (mirror for Draften's MCP + plugin API).

## The one thing to get right first — ✅ BUILT
**A `bpy`-style unified Draften API** — `src/api/draften.ts` (tested, 9/9). ONE
object everything hangs off:
- `draften.document` — get/load/rename, **toJSON/fromJSON open format** (Excalidraw),
  `.boards` (list/add/activate), `.designSystem` (get/set/components/tokens) (Penpot).
- `draften.commands` — register / execute / list (**VS Code** commands).
- `draften.events` — on/emit bus with disposables (VS Code).
- `draften.panels` — contribute UI to left/right/inspector (Blender/Godot).
- `draften.importers` / `draften.ai` — the existing registries, unified in.
- **Plugin lifecycle** `enablePlugin/disablePlugin` with `activate(ctx)` +
  `ctx.subscriptions` auto-cleanup (**VS Code + Godot**).
- Exposed on `window.draften` for the console + external tools (like `bpy`).

Next off this surface: (1) GitHub-installed plugins (fetch a plugin module → run
its `activate`), (2) MCP server that maps to `draften.commands`, (3) migrate the
app's own buttons to `draften.commands` so the app dogfoods its own API (the
Blender rule: no core-only powers).
