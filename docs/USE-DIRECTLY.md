# Use directly — libraries & references for Draften

> Research 2026-10. The goal: reach **Sketch + Figma + OmniGraffle** quality while
> staying **free, open-format, git-backed**. These are concrete, license-checked
> things we can pull in or copy from — not just inspiration.

## Open the files people send you (the "don't get locked in" promise)

| Need | Package | License | Notes |
|---|---|---|---|
| **Read/write `.sketch`** | [`@sketch-hq/sketch-file`](https://www.npmjs.com/package/@sketch-hq/sketch-file) | **MIT** ✅ | Official Sketch pkg. `fromFile`/`toFile` → whole document as a JS object (pages in one tree). The real way to open Sketch files. |
| **Sketch JSON types/schema** | [`@sketch-hq/sketch-file-format`](https://www.npmjs.com/package/@sketch-hq/sketch-file-format) | **MIT** ✅ | Official JSON Schema + TS types. Validate/convert Sketch JSON correctly. |
| Sketch (community) | [`node-sketch`](https://github.com/oscarotero/node-sketch) | MIT ✅ | Older (7y) but simple unzip→json manipulation. |
| **Figma → JSON** | [`figma-to-json`](https://github.com/yagudaev/figma-to-json) | check | Read/write Figma files as JSON without opening Figma. |
| **Figma → SVG** | [`figma-export-svg`](https://github.com/joshuaslate/figma-export-svg) | **MIT** ✅ | CLI, uses Figma API + SVGO. Cleanest MIT option for Figma→SVG. |

→ **Plan:** add a Sketch importer (`src/import/sketch.ts` already a stub) backed by
`@sketch-hq/sketch-file` (MIT, safe). Figma import stays paste/API-link based.

## Design tokens (the design-system spine)

- [`style-dictionary`](https://github.com/style-dictionary/style-dictionary) — **Apache-2.0**
  (not MIT, but permissive + compatible). Tokens in JSON → CSS vars / Swift / Android /
  etc. Forward-compatible with the **Design Token Community Group (DTCG)** spec.
  → Use for: exporting Draften's design system to real `--css-vars` + platform files.
- The **DTCG token spec** is the open standard to store tokens in — align our
  `design-system.ts` token shape to it so they're portable.

## Canvas (what we build on)

- **Excalidraw** (MIT) — our canvas. Gives: rectangle/ellipse/diamond/arrow/line/
  free-draw, arrow-binding, **grouping**, undo/redo, zoom/pan, PNG/SVG/`.excalidraw`
  export, and a **programmatic scene API** (`getSceneElements`/`updateScene`/
  `exportToSvg`/`serializeAsJSON`) — which is what powers our Inspect, Code, Play,
  File menu, persistence. It does **not** ship a layers panel / frames-as-artboards /
  design-tokens — those are ours to add on top (that's Draften's value).

## Credible-free-alternative reference: Penpot (what "good" looks like)

[Penpot](https://github.com/penpot/penpot) (open source) — the bar for a free Figma
alternative. What to learn from / aim at:
- **Code-native / open standards**: SVG · CSS · HTML · JSON; designs readable by devs +
  AI (they ship an MCP server). → matches our Code view + open-format saves.
- **Design Tokens** as the single source of truth; **Components & Variants**.
- **Real-time collaboration** + self-hosting (full ownership, no lock-in).
- **Inspect mode** (instant SVG/CSS/HTML), **plugins**, webhooks/API.

Draften's differentiators vs Penpot: **git-backed** (not a server we run) + **on-device
AI** + **opens Sketch/Figma files** + **desktop app**. Penpot needs a server; Draften is
local-first + free by construction.

## OmniGraffle lesson (Ankur's note)

OmniGraffle "was good but didn't evolve" — its magic was **scripting** (auto-generate
tables of contents, diagrams). Draften's modern equivalent = the **AI assistant + a
scripting/automation API** over the same scene graph. That's the moat.
