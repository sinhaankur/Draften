# Draften — Depth plan (closing the gap to Figma / Sketch / OmniGraffle)

Honest map of what a pro design tool has that Draften lacks, in priority order.
Effort: 🟢 small (hours) · 🟡 medium (a day+) · 🔴 large (multi-day / architectural).
Each item says what "done" means so it's checkable, not vibes.

Draften today = Excalidraw canvas + shell + AI design-system + Sketch/PDF/paste
import. That covers *drawing*. The gap is everything a design tool wraps around
drawing: inspection, structure, systems, and real file I/O.

---

## TIER 1 — makes it feel like a real tool (do first)

### 1. Inspector panel (L1 + L2) 🟡  ← highest value
The right "Inspect" tab is a placeholder. Wire it to the live Excalidraw selection.
- **L1 (layout):** X, Y, W, H, rotation — editable, two-way.
- **L2 (appearance):** fill, stroke + width, corner radius, opacity; for text:
  font family, size, weight, align, line-height, color.
- Multi-select: show shared values / "Mixed".
- **Done =** select a shape → see + edit its real properties → canvas updates live.

### 2. Layers panel 🟡
"Managed on the canvas" is a placeholder. Show a real tree of canvas elements.
- List every element (icon by type), select syncs both ways, rename, reorder
  (z-order), show/hide, lock. Groups/frames nest.
- **Done =** the layer list mirrors the canvas and clicking selects.

### 3. Alignment & distribution 🟢
Align left/center/right/top/middle/bottom, distribute, tidy spacing — the toolbar
every diagram/design tool has. (Excalidraw has some; surface it + add distribute.)

### 4. Real export 🟢
Export selection/board → PNG / SVG / PDF at 1×/2×/3×. (Excalidraw exports; wire a
clean Draften export menu with scale + selection.)

---

## TIER 2 — the "design system" spine (Draften's differentiator)

### 5. Component library → instances 🟡
Drag a component from the right panel onto the canvas as an instance.
- **Done =** dragging "Button" places a real, styled node; edit master → note it's
  a component instance (full override/variant later).

### 6. Token editor 🟡
Edit color/type/spacing tokens live; canvas + components reflect changes.

### 7. Component variants & props 🔴
Button {size, state, variant}. The thing that makes a *system*, not a sticker
sheet. Big — needs a variant model + a picker in the inspector.

### 8. Styles (shared fill/text/effect) 🟡
Named, reusable styles applied to elements (like Figma styles / Sketch shared
styles). Ties into tokens.

---

## TIER 3 — file interop ("opens their files", the promise)

### 9. Figma paste fidelity 🟡  ← started
Today: lifts text/structure from the Figma clipboard. Deepen: real rects with
fills + sizes, nesting, styles. (Full vector needs #10.)

### 10. Figma file import 🔴
Figma REST API + personal token → node tree → model. The real "open a Figma file."

### 11. OmniGraffle import 🟡
Rust `decode_omnigraffle` exists (gzip+plist→JSON) but isn't wired to the model.
Wire it → boards + shapes + connectors.

### 12. Sketch import polish 🟡
Importer parses but doesn't render onto the Excalidraw canvas yet — connect it.

### 13. Native Draften file format 🟢
Save/open `.draften` (the document JSON) so work persists between sessions.

---

## TIER 4 — collaboration & platform (Ankur's asks)

### 14. Plugin system + GitHub install 🔴
Manifest + sandboxed API; install a plugin from a GitHub repo/URL; registry UI.

### 15. Real Git 🔴
init/commit/branch/diff the document JSON; open from / push to GitHub.

### 16. Accounts (file-type-driven) 🟡
No login by default. GitHub OAuth required only when the file is GitHub-hosted /
shared / multi-user. The file type decides.

### 17. Multi-user real-time 🔴  ← biggest
CRDT (Yjs) + a relay; live cursors + merged edits. Breaks pure local-first, so
design guest/offline to still work.

### 18. MCP server 🟡
Expose named Draften actions (read doc, add node, apply tokens, import) so an
agent can drive it.

---

## TIER 5 — polish to match native (Sketch reference)

### 19. UX/UI native polish 🟡
Inspector rows, panel spacing, menus, keyboard shortcuts (⌘C/V/G/⌥drag), cursors,
empty states, resize handles styling — measured against Sketch.app.

### 20. Prototyping 🔴
Link screens, hotspots, transitions, preview mode. (Figma's other half.)

---

## Build order (methodical)
Tier 1 top-to-bottom first (Inspector → Layers → Align → Export) — that alone
lifts it from "basic OmniGraffle" to "real tool." Then Tier 3 #11/#12 (wire the
importers that already half-exist) for the "opens files" promise. Then Tier 2
(the design-system depth that makes Draften *Draften*). Tier 4 collaboration is
last because it's the heaviest + needs the rest solid first.
