---
name: draften
description: >-
  Drive Draften — a free, git-backed, local-first design tool — to create and
  edit real designs. Use when the user wants to design a screen, UI, flow, or
  diagram; generate artboards/layers; combine shapes; build a design system; or
  turn a description into an editable, committable design file. Works through
  Draften's MCP server and its keyless on-device automations.
license: MIT
---

# Draften

Draften is a real design canvas (frames, artboards, layers, a Sketch-grade
inspector, boolean shapes, prototyping) whose files live in a git repo, with an
on-device AI companion. This skill teaches you — any model, via the MCP server or
the in-app assistant — to drive it **well**. It is the modern successor to
OmniGraffle's scripting: describe intent, produce real editable layers.

## The one rule: produce real, editable layers

Never produce a flat image or a vague mock. Everything you create in Draften is a
genuine editable object — a frame, a rectangle, an ellipse, a text layer, a line.
The user can select, nudge, restyle, and commit each one. Design *to the
primitives*, the same way a human designer would in Sketch or Figma.

## Mental model

- **Document** → **Pages** (each has its own canvas) → **Artboards/Frames** →
  **Layers** (shapes, text, groups).
- **Artboard = a `frame`** with a real pixel size (iPhone 393×852, Desktop
  1440×1024, etc.). Put screen content *inside* a frame so it reads as one screen.
- **Layer names** live in `customData.name` (they survive export/convert) — always
  name layers meaningfully ("CTA button", "Avatar"), never leave them "Rectangle".
- **Coordinates** are absolute canvas pixels. A layer inside a frame still uses
  canvas coordinates; place it within the frame's bounds.
- **Z-order** = array order: later elements render on top.

## Driving Draften via MCP (the tools that actually exist)

Draften exposes these MCP tools (names are exact; call them, don't invent others):

| Tool | Input | What it does |
|---|---|---|
| `get_design` | — | Read the canvas: a summary of frames (id, name, w, h) and layers. **Call this first** to see what's there before editing. |
| `add_rectangle` | `x, y, width, height, color?` | Add a rectangle (color = fill hex, e.g. `#3d6b5f`). |
| `add_text` | `x, y, text, size?` | Add a text layer. |
| `export_html` | — | Export the current canvas as HTML markup (read the design as code). |

Workflow: **`get_design` → plan → add layers → `get_design` again to verify.**
Build a screen by laying down a background rectangle (the frame fill), then
content rectangles, then text — in that z-order.

### Example: a sign-in screen

1. `get_design` — note the frame's size and origin (say 393×852 at 0,0).
2. `add_rectangle` 24,80,345,56 `#ffffff` → email field
3. `add_rectangle` 24,148,345,56 `#ffffff` → password field
4. `add_rectangle` 24,224,345,52 `#3d6b5f` → primary button
5. `add_text` 150,240 "Sign in" 16 → button label
6. `add_text` 24,40 "Welcome back" 28 → heading
7. `get_design` — confirm all seven layers landed.

Keep spacing on an 8px rhythm; align content to a consistent left margin (24px on
mobile). Use the brand accent `#3d6b5f` for primary actions.

## Keyless automations (offline, no model needed)

Draften's in-app assistant recognises these intents and draws them **instantly,
with no model at all**. When the user asks for one, phrase your prompt to match so
the deterministic path fires (faster and works offline):

- **Table of contents** — "table of contents for: Intro, Setup, Usage, API, FAQ"
- **Card grid** — "a 3×2 card grid" (rows×cols of real cards)
- **Nav bar** — "a nav bar with Home, Search, Profile"
- **Checklist / list** — "a checklist: sign up, verify email, invite team"
- **Flowchart** — "a flowchart: Start → Validate → (decision) → Save / Retry"
  (boxes + arrows; diamonds for decisions)

These produce real editable layers and log to the changelog. Prefer them for
structural scaffolding; fall back to free-form generation for bespoke visuals.

## Boolean shapes (vector management)

To combine shapes into one path: select 2+ shapes, then Union / Subtract /
Intersect / Difference. The result is a real editable vector path (a closed
`line`), inheriting the bottom shape's fill. Use this for icons and custom
silhouettes rather than stacking opaque rectangles.

## Design-system discipline

- Use the document's **color styles** and **text styles** (the design system) so
  values stay consistent and themeable — don't hardcode one-off hexes when a token
  exists.
- Type ramp: a clear hierarchy (e.g. 28/20/16/13). One accent color for actions.
- Respect light/dark: the brand accent lifts to `#86b8a8` on dark grounds.
- Icons are vector, stroke-width 1.5 (the Draften DS rule) — crisp at any zoom.

## Prototyping

To make it clickable: on a layer, add an interaction → Navigate to a target frame
with an animation (smart-animate / dissolve / push / slide) + duration. Links
persist with the document and drive Play.

## Committing (it's git-backed)

Designs are open-format files. After editing, the user saves and commits to their
repo — branches, diffs, PRs, history, all native. When you finish a change,
summarise it like a commit message ("Add sign-in screen: email+password fields,
primary CTA, heading") so it's ready to commit.

## Do / don't

**Do**
- Call `get_design` before and after edits.
- Name every layer meaningfully.
- Keep an 8px spacing rhythm and a consistent margin.
- Use the accent for primary actions, neutrals for surfaces.
- Prefer keyless automations for structural scaffolding.
- Build screen content *inside* a frame.

**Don't**
- Produce a flat image instead of layers.
- Invent MCP tools that aren't listed above.
- Leave layers unnamed or overlapping randomly.
- Hardcode colors when a design-system token fits.
- Place content outside its frame's bounds.

## One-line summary for the user

"I'll lay this out as real editable layers inside a frame, named and aligned, using
the design-system colors — then you can tweak any of it and commit it to your repo."
