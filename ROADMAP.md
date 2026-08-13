# Draften — Roadmap

✅ done · 🟡 partial · ⬜ next. The spine (one document model) comes first because
every surface hangs off it.

## Done (scaffold)
- ✅ **Document model** — `document.ts` (boards/canvas management), `node.ts`
  (design + diagram + map nodes in one union), `design-system.ts` (brand · tokens
  · **atomic** component library, versioned).
- ✅ **State** — Zustand store: live document, active board, selection, viewport,
  tool, mutations funnelled through one place (ready for undo/AI/importers).
- ✅ **Canvas** — 2D renderer (frames, shapes, text, connectors with routing,
  sticky, mind/journey nodes) + `<Canvas>` with pan/zoom; seeded design+diagram
  sample so the unified idea is visible on first run.
- ✅ **Importer contract** + **Sketch importer** (ZIP/JSON → model), unit-tested
  (nested groups, fills, text). Plugin registry so any tool can be added.
- ✅ **AI provider contract** — pluggable Claude/any-LLM + structured actions
  (generate component library, component code, diagrams, tokens).
- ✅ **Tauri shell** — Rust `decode_omnigraffle` (gzip + plist → JSON), `app_version`.
- ✅ Web build + tests green (type-check clean, 3 tests pass, 96KB gz bundle).

## Next
1. ⬜ **Tools** — implement create/drag for rectangle/ellipse/frame/text/shape/
   connector/sticky (pointer → model mutations); marquee select; move/resize.
2. ⬜ **Figma importer** — REST API (token) → node tree → model (a second
   `Importer`). Then **OmniGraffle importer** consuming `decode_omnigraffle`.
3. ⬜ **Design-system panel** — token editor (color/type/spacing), atomic library
   browser, drag component → instance on canvas.
4. ⬜ **Code view** — Monaco; component ↔ React/TS binding (two views of one).
5. ⬜ **AI provider** — Anthropic + OpenAI-compatible + Ollama; wire the ✦ AI
   button to `generateComponentLibrary` / `generateDiagram`.
6. ⬜ **Git-backed library** — versioning, diffs, shareable component/token package.
7. ⬜ **More importers** — XD, draw.io, Visio, SVG (all plugins).
8. ⬜ **Export** — SVG, PNG, our JSON; component code export.

## Principles (don't drift)
- One document model; every surface reads/writes it. Importers map *into* it.
- Importers / exporters / tools / panels / AI actions are **plugins** (open).
- Draften versions itself (semver) and its library (Git).
