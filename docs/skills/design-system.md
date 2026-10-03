---
name: draften-design-system
description: How to build Draften's UI so it matches the approved v2 design system exactly
when-to-use: Any time you add/change UI in the Draften app, website, or docs.
---

# Skill: Draften design system

The source of truth is the approved **v2 design** (`Design system for local LLM
app.zip` → `Draften v2.dc.html` + `_ds/.../styles.css` + `readme.md`). Never
invent a parallel look. Match it.

## Tokens (never hard-code)
- Surfaces (warm neutral): `--bg #f6f6f4`, `--canvas #efeeeb`, `--raised/--panel #fbfbfa`, `--overlay #ffffff`.
- Accent: **teal-green `--accent #3d6b5f`** (light) / `#86b8a8` (dark). Soft `--acc-soft`.
- Ink/text: `--t1 #1d1d1b`, `--t3 #8e8d88` (muted). Hairline `--line #e7e6e2`.
- Type: **Geist** (sans), **Geist Mono** (mono labels/code), **Source Serif 4**
  (display/serif moments). Radii soft (8/10/12px). 14px controls.
- Take every color/font/space/radius from a `var(--…)` — never a raw hex/px the tokens carry.

## Icons — VECTOR, lucide at 1.5 stroke
- Use **lucide-react**. The DS readme mandates **stroke-width 1.5** ("lighter, more
  technical"). Enforced globally in `src/index.css` via `svg.lucide { stroke-width:1.5 }`.
- All icons are inline vector (viewBox 24, round caps/joins) → crisp at any zoom.
- Brand `Github` icon was removed from lucide ≥1.49 — use `GitBranch`.

## Components
- Reuse `.btn`/`.ai-btn`/`.tb-btn`/`.card`/`.segmented`/`.tabs` patterns already in
  `App.css` + `index.css`. Don't fork new class systems.
- Primary action = the one solid accent fill. Ghost/secondary = hairline border.
- Interactive states are themed (hover tint + pressed from the accent ramp); focus =
  `:focus-visible { outline:2px solid var(--accent); outline-offset:2px }`. Never default blue.

## Honesty rule
- Every control must DO something real. No placeholder buttons (audit: every `<button>`
  has an onClick). If a feature can't be real yet, remove it — don't fake it.
