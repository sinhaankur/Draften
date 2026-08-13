# Draften — Vision

**One workspace for the whole design-system workflow: brand → tokens → atomic
components → UX/UI screens → code → versioned library.** A unified canvas that is
equal parts Figma, Sketch, and OmniGraffle — and opens their files — with a
VS Code-grade code view and AI that builds and maintains the system.

Today this workflow is spread across five or six tools that don't share a source
of truth: brand in one, tokens in another, UI in Figma, diagrams in OmniGraffle,
code in VS Code, versioning in Git, a component library bolted on the side.
Draften makes them **views of one document model.**

## The through-line

> Brand defines tokens. Tokens drive components. Components (atomic) compose into
> screens and flows on one canvas. Every visual has a code view. AI generates and
> refactors the library. Git versions all of it. Nothing is a separate file that
> drifts out of sync.

## The surfaces (all views of one shared document)

1. **Unified canvas** — freeform vector design (Figma/Sketch) *and* structured
   diagramming with smart auto-routing connectors (OmniGraffle), equal weight.
   UX (wireframes, flows, journeys) and UI (high-fidelity, prototyping) both
   first-class. The canvas hosts several **map surfaces**, all the same document
   model underneath:
   - **UX journey maps** — stages · touchpoints · emotion curve · pain points.
   - **Ideas mapping** — mind-maps / affinity maps (brainstorm → structure).
   - **Flows & diagrams** — flowcharts, sitemaps, architecture (smart connectors).
   - **Canvas management** — an infinite workspace organised into boards/pages
     you can nest, name, and navigate (Figma pages × FigJam boards): the
     structure layer over all the maps and designs.
2. **Design system** — the spine. **Brand kit** (logo, color system, type scale)
   → **design tokens** → **components**, organised by **Atomic Design** (atoms →
   molecules → organisms → templates → pages). The library is the source of
   truth the canvas draws from.
3. **Code view (VS Code-level)** — every component has real code (React/TS to
   start). Edit design or code; they're two views of one component. Monaco-based
   editor, extensible, dev-grade.
4. **AI (Claude / any LLM, pluggable)** — generate a component library from a
   prompt or a brand, scaffold atomic components, refactor, write the code view,
   name/organise tokens, produce diagrams. Provider-agnostic ("Claude or any
   LLM").
5. **Versioned library (Git)** — the component/token library is Git-backed:
   history, branches, diffs, reusable across projects. "Git library" = the design
   system as a versioned, shareable package.

## File interop ("opens their files" — universal, plugin-based)

Import is a **plugin pipeline**, not a fixed list. Every importer is a plugin
implementing one documented adapter interface (`foreign file → Draften document
model`), so **any design tool** can be supported — by us or the community.

| Format | How | Fidelity |
|--------|-----|----------|
| **Sketch** `.sketch` | ZIP + JSON (official schema) → our model | High — open format |
| **Figma** | REST API (token/OAuth) → JSON node tree → our model | High read; no local `.fig` |
| **OmniGraffle** `.graffle` | gzip + plist (Rust side) → our model | Partial — proprietary |
| **Adobe XD** `.xd` | Agi/ZIP → our model (importer plugin) | Partial |
| **draw.io / Visio / SVG** | XML/SVG → our model (importer plugins) | Varies |
| **SVG / our JSON** | native | Full round-trip |

## Open & extensible

- **Open source** (MIT). The whole app, model, and importers are public.
- **Plugin system** — a stable API surface: importers, exporters, canvas tools,
  panels, and AI actions are all plugins. Third parties extend Draften without
  forking. "Easy import from any design tool" falls out of this: an importer is
  just a plugin.

## Platform

**Tauri + React/TypeScript/Canvas.** The editor is written once in web tech (runs
in-browser *and* as a native desktop app via Tauri's Rust shell). Rust handles
native/heavy file parsing (ZIP, gzip, plist) and filesystem/Git. This matches the
web-canvas nature of the app (Figma/tldraw are web-based) and the strongest stack.

## Architecture principle

**One document model. Many surfaces.** The scene graph (`src/model/`) is the
single source of truth; canvas, code view, design-system panel, AI, and exporters
all read/write it. Importers map foreign formats *into* it. This is what keeps the
surfaces from drifting — the failure mode of the tools Draften replaces.

## Build order (living)

1. Document model + design tokens + atomic component model (the spine).
2. Canvas rendering + core tools (select/move/shape/connector/text).
3. Design-system panel (tokens, atomic library browser).
4. File importers — Sketch, then Figma API, then OmniGraffle (Rust).
5. Code view (Monaco) — component ↔ code binding.
6. AI service (pluggable provider) — generate/refactor library + code.
7. Git-backed library — versioning, diffs, shareable packages.

Status: **scaffolding the spine (1–2).** See `ROADMAP.md`.
