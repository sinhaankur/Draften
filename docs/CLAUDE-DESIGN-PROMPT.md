# Claude prompt — design Draften's frontend

Paste the block below into Claude (claude.ai, or Claude in a design tool). It's
grounded in Draften's real architecture so the output fits the codebase. Attach a
screenshot of the current scaffold if you have one.

---

You are designing the frontend UI for **Draften** — a free, open-source, unified
**design + diagramming workspace**. Think "Figma × Sketch × OmniGraffle in one
canvas," but open source and free, for designers who can't afford subscriptions.
It also opens Sketch / Figma / OmniGraffle / PDF files, has a VS Code-grade code
view, and AI that generates a component library.

**Design a clean, professional, dark-first desktop UI.** Deliver it as: (1) a
high-level layout description, (2) an ASCII wireframe of the main editor, (3) a
component inventory with states, and (4) a design-token set (colors, type, spacing,
radii) I can drop into CSS variables. Keep it implementable in React + plain CSS
(no heavy UI kit).

## Product truths (design around these — don't invent features)

- **One unified canvas** is the hero. It hosts both freeform **vector/UI design**
  (frames, shapes, text) and **structured diagramming** (shapes with ports, smart
  auto-routing connectors, sticky notes), plus **map surfaces**: UX journey maps,
  ideas/mind maps, flows. All equal weight.
- **Boards** = pages/canvases; the workspace is many nestable boards ("canvas
  management").
- **Design system is the spine**, shown as a panel: **Brand kit → design tokens →
  components organised by Atomic Design** (atoms → molecules → organisms →
  templates → pages). Components are versioned.
- **AI** (a ✦ button / panel): "generate a component library," "make this a
  diagram," "write the code for this component." Provider-agnostic (Claude or any
  LLM).
- **Code view**: every component has real React/TS code — design and code are two
  views of one thing (a toggle or split view).
- **Import**: an "Open" flow that accepts .sketch / Figma (via token) / .graffle /
  .pdf and more — a plugin-based pipeline.
- **Free + open source** is part of the identity — the UI should feel generous and
  un-gated, never nagging about upgrades.

## Current shell (what exists — refine it, keep it recognisable)

- Top bar: brand "Draften" + version, a tool row (Select · Frame · Rect · Ellipse
  · Text · Shape · Connector · Sticky), and a ✦ AI button on the right.
- Left panel: Boards list (each with a colored kind-dot + kind label).
- Center: the canvas (dark, subtle grid, pan/zoom).
- Right panel: Design System — brand name, then Atoms/Molecules/Organisms/
  Templates/Pages groups.

## What I want from you

1. **Layout** — refine the three-pane editor. Where do tools, layers, properties,
   boards, the design-system library, the code view, and AI live? How do design
   mode and diagram mode coexist without clutter? How does the code view appear
   (bottom split? right tab? full toggle?)?
2. **Main-editor ASCII wireframe** — labelled, at desktop width.
3. **Component inventory** — every UI element (toolbar button, panel, list row,
   token swatch, component card, board tab, AI panel, properties inspector,
   import dialog) with its states (default/hover/active/selected/disabled).
4. **Design tokens** — a cohesive dark theme (with a light variant): color scale,
   an accent (currently a depth-blue #4c6fff — propose better if warranted),
   typography scale (I use Inter), spacing, radii, elevation. Give them as
   CSS custom properties.
5. **Two or three signature UI moments** that make Draften feel distinct and
   trustworthy (e.g. how AI-suggested components are previewed before accepting;
   how an imported file's fidelity/warnings are shown; how design↔code toggling
   feels).

Constraints: dark-first, calm and instrument-grade (the work is the hero, chrome
recedes), fast to implement in React + CSS variables, accessible contrast, no
paywall/upsell UI. Prioritise clarity for a power user who lives in this tool all
day.
