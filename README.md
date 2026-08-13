# Draften

**One workspace for the whole design-system workflow** — brand → tokens → atomic
components → UX/UI screens → diagrams → code → versioned library. A unified canvas
that is equal parts **Figma**, **Sketch**, and **OmniGraffle**, that **opens their
files**, with a **VS Code-grade code view** and **AI** that builds and maintains
the system.

Today this workflow is scattered across five or six tools that don't share a
source of truth. Draften makes them **views of one document model.**

> See [`VISION.md`](VISION.md) for the full picture and [`ROADMAP.md`](ROADMAP.md)
> for the build order.

## What it is

- **Unified canvas** — freeform vector design *and* structured diagramming with
  smart connectors, equal weight. Hosts UX journey maps, ideas/mind maps, flows,
  and UI design — organised into nestable boards (canvas management).
- **Design system spine** — brand kit → design tokens → components by **Atomic
  Design** (atoms → molecules → organisms → templates → pages). The library is
  the source of truth the canvas draws from.
- **Opens design files** — a plugin-based import pipeline: **Sketch** (open
  ZIP/JSON) ✅, **Figma** (REST API) and **OmniGraffle** (gzip plist, native) and
  **XD / draw.io / SVG** as importer plugins. Easy to add any tool.
- **Code view (VS Code-level)** — every component has real code; design and code
  are two views of one component.
- **AI (Claude / any LLM, pluggable)** — generate a component library, scaffold
  atomic components, write the code view, produce diagrams — as reviewable edits
  to the shared model.
- **Versioned library (Git)** — the component/token library is Git-backed:
  history, diffs, reusable across projects.
- **Open source + plugins** — importers, exporters, tools, panels, and AI actions
  are all plugins against documented contracts.

## Architecture

**One document model. Many surfaces.** The scene graph (`src/model/`) is the
single source of truth; the canvas, code view, design-system panel, AI, and
importers all read/write it. This is what stops the surfaces drifting — the
failure mode of the tools Draften replaces.

**Tauri + React/TypeScript/Canvas** — the editor is written once in web tech (runs
in-browser *and* as a native desktop app). Rust handles native/heavy file parsing
(ZIP/gzip/plist) and, later, filesystem + Git.

```
src/
  model/         document · node (design + diagram) · design-system (atomic)
  state/         Zustand store (the live document + editor state)
  canvas/        2D renderer + <Canvas>
  import/        importer contract + Sketch importer (+ Figma/OmniGraffle next)
  ai/            provider contract (Claude / any LLM) + structured actions
  plugins/       built-in plugin registration (open, extensible)
src-tauri/       Rust shell: decode_omnigraffle (gzip+plist), app_version
```

## Develop

```bash
pnpm install
pnpm dev            # Vite dev server (browser)
pnpm build          # type-check + production web build
pnpm test           # vitest (model + importers)
pnpm tauri dev      # native desktop app (needs Rust toolchain)
```

## Status

🚧 Early but **running**: the document model (design + diagram + atomic design
system), Zustand store, 2D canvas renderer with a seeded design+diagram sample,
the importer plugin contract with a **working Sketch importer** (tested), the AI
provider contract, and the Tauri shell with the OmniGraffle native decoder.
Web build + tests green. Next: Figma/OmniGraffle importers, tools, code view, AI
provider, Git library. See [`ROADMAP.md`](ROADMAP.md).

## License

MIT — © Ankur Sinha.
