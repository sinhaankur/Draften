# Draften — design system (source of truth)

The approved visual design for the app, provided by Ankur. **This is the spec** the
app's UI implements — colours, type, spacing, the shell layout.

- `Draften v2.dc.html` — the definitive app mockup (System/Inspect/Stack rails, the
  topbar, the canvas, the bottom prompt bar). The screenshot `mockup-app.png` is from here.
- `Draften Docs.dc.html`, `Draften Website.dc.html` — companion surfaces.
- `_ds/…` — the generated design-system bundle (tokens in `styles.css`, manifest,
  component/foundation cards).
- `Design system for local LLM app.zip` — the original export, kept intact.

The live app applies these tokens in `src/index.css` (warm-neutral surfaces, the
teal-green accent `#3d6b5f` / `#86b8a8` dark, Geist type, soft radii). When the design
changes, update it here first, then reflect it in `src/index.css` / the shell.
