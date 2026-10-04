# Sketch parity — full feature drill-down → Draften status → plan

A grounded, exhaustive audit of **every** Sketch feature (from sketch.com/features
+ docs, Oct 2026), mapped to Draften. Built so we design against the *real* thing.

Legend: ✅ have · 🟡 partial · 🚧 building this pass · ⏳ next · ○ later · ★ we beat Sketch

---

## 1 · Vector & shapes
| Sketch feature | Draften | Status |
|---|---|---|
| Shape presets (rect, oval, line, arrow, triangle, star, polygon) | Excalidraw shapes | ✅ |
| **Boolean ops — Union / Subtract / Intersect / Difference** | `boolean-ops.ts` + Combine bar | 🚧 |
| Pen tool / freehand vector paths | Excalidraw line + freedraw | ✅ |
| Edit points (vector editing) | Excalidraw edit mode | 🟡 |
| Masks (shape + alpha) | — | ⏳ |
| Smooth/squircle corners, angles >90° | single radius now | 🟡 |
| Rounded corners on combined shapes | after boolean | ⏳ |
| Scissors (open paths) / reverse / close / offset / combine paths | combine via boolean; rest | 🟡 |
| Convert border to vector, outline | — | ○ |
| Rotate / flip H+V / scale / skew (transform) | rotate ✅; flip 🚧; skew ○ | 🟡 |
| Math operators in fields (+ − * / ^) | — | ⏳ |
| Lock proportions / pixel-fit | — | ⏳ |

## 2 · Text
| Sketch | Draften | Status |
|---|---|---|
| Font, size, weight, style | size ✅; font+weight 🚧 | 🟡 |
| Kerning, line-height, baseline, spacing | 🚧 (Text section) | 🟡 |
| Bold/italic/underline/strike, align | align 🚧 | 🟡 |
| Variable fonts | self-hosted variable fonts loaded | ✅ |
| Text on path / convert to outlines | — | ○ |
| Lists, prefixes/suffixes | — | ○ |

## 3 · Color
| Sketch | Draften | Status |
|---|---|---|
| Color picker (RGB/HSB/HSL, eyedropper) | hex now → picker | 🟡 |
| **Color Variables** (sync across doc) | design-system tokens | ✅ |
| Tints on groups/symbols | — | ⏳ |
| Find & replace color | — | ○ |
| P3 / sRGB profiles | browser default | 🟡 |

## 4 · Styling & effects
| Sketch | Draften | Status |
|---|---|---|
| Multiple fills (solid/gradient/image/noise) | solid ✅; gradient+image 🚧 | 🟡 |
| Gradients (linear/radial, Oklab) | 🚧 | ⏳ |
| Borders (inside/center/outside, dashed, per-side) | stroke ✅; per-side ⏳ | 🟡 |
| **Shadows (drop + inner, multiple)** | Effects → Shadow | 🚧 |
| **Blur (gaussian/motion/zoom/background)** | Effects → Blur | 🚧 |
| Blend modes | Appearance → blend | 🚧 |
| Layer styles (shared) | `StylesPanel` | ✅ |
| Glass / progressive blur / progressive alpha | — | ○ |

## 5 · Layers
| Sketch | Draften | Status |
|---|---|---|
| Layer tree + nesting | `LayersPanel` | ✅ |
| **Rename** (inline / dbl-click) | 🚧 | 🚧 |
| **Lock / unlock** | 🚧 per-row | 🚧 |
| Show / hide | ✅ eye | ✅ |
| **Duplicate / smart duplicate** | 🚧 | 🚧 |
| **Reorder (drag z) + front/back** | 🚧 | 🚧 |
| Group / ungroup | ⌘G ✅ + menu 🚧 | ✅ |
| **Wrap in artboard / fit frame to contents** | `wrapInArtboard` 🚧 | 🚧 |
| Tidy / distribute / align | `AlignBar` ✅ | ✅ |
| Flatten / focus mode / find layer | — | ○ |

## 6 · Frames, artboards, layout
| Sketch | Draften | Status |
|---|---|---|
| Frames / artboards (nesting, templates) | real frames + presets | ✅ |
| **Stacks (auto-layout: gaps, min/max, z)** | auto-layout | ⏳ (big) |
| Pinning / resizing to edges (constraints) | — | ⏳ |
| Grids & layout (columns, gutters) | dot grid ✅; columns ⏳ | 🟡 |
| Sections (organize) | pages ✅ | 🟡 |

## 7 · Components & reuse
| Sketch | Draften | Status |
|---|---|---|
| **Symbols / components (synced instances)** | create/insert/detach | ⏳ (biggest craft gap) |
| Variants (by property) | — | ○ |
| Overrides (text/image/nested) | — | ⏳ |
| Shared Libraries across docs | **git repo = the library** | ★ |
| Text styles / layer styles | `StylesPanel` | ✅ |

## 8 · Images
| Sketch | Draften | Status |
|---|---|---|
| Place bitmaps, replace, adjust | place ✅; adjust ○ | 🟡 |
| Mask bitmap / background removal | — | ○ |
| Instant image layouts (grid/masonry) | automation grid 🟡 | 🟡 |

## 9 · Prototyping
| Sketch | Draften | Status |
|---|---|---|
| Link layer → frame | `PrototypePanel` | ✅ |
| Animations (smart-animate/dissolve/push/slide) | stored on link | ✅ |
| **Play w/ click-through nav** | `PrototypePlay` | 🚧 |
| Overlays / scroll areas / multiple start points | — | ○ |
| Preview in browser | web app | ✅ |

## 10 · Export & handoff
| Sketch | Draften | Status |
|---|---|---|
| **Export formats (PNG/JPG/SVG/PDF/WebP), @2x/@3x** | `ExportSettings` | 🚧 |
| Per-layer export slices | 🚧 | ⏳ |
| **Developer inspect (copy CSS, measures, tokens)** | Code view ✅; copy-CSS 🚧 | 🟡 |
| Design tokens export (CSS/JSON) | tokens ✅; export 🚧 | 🟡 |
| Export runnable app (React/HTML) | `project.ts` | ★ |

## 11 · Collaboration
| Sketch | Draften | Status |
|---|---|---|
| Commenting on canvas | ○ | ○ |
| **Real-time multiplayer** | live collab | ○ (biggest open) |
| Version history | **git history** | ★ |
| Permissions / sharing | **git repo access** | ★ |
| Libraries across team | **git** | ★ |

## 12 · Platform, AI, extensibility
| Sketch | Draften | Status |
|---|---|---|
| Platform | macOS only | ★ (Mac+Win+Linux+Web) |
| Price | paid subscription | ★ (free, MIT) |
| **MCP server (AI client)** | `mcp/tools.ts` + MCP panel | ✅ ★ |
| **AI design companion** | on-device AI + keyless automations | ✅ ★ |
| Plugins | GitHub plugins | ✅ |
| Opens other tools' files | Sketch/PDF/Word import | ★ |
| **SKILL.md (teach any LLM to drive it)** | `SKILL.md` | 🚧 ★ |

---

## Where Draften already BEATS Sketch (★)
Reach (4 platforms) · price (free, MIT) · git-native history + libraries +
permissions · opens Figma/Sketch/PDF/Word · on-device AI companion · MCP server ·
a SKILL.md so any AI can drive it · export to a runnable app.

## This-pass build order (the floor a designer would feel missing)
1. 🚧 **Boolean ops** (Union/Subtract/Intersect/Difference) — `boolean-ops.ts` + Combine bar
2. 🚧 **Layer ops** — rename, lock, duplicate, reorder, front/back, wrap-in-artboard, context menu
3. 🚧 **Effects** — drop + inner shadow, blur, blend mode (inspector section)
4. 🚧 **Export settings** — PNG/SVG/PDF @1x/2x/3x + copy CSS
5. 🚧 **SKILL.md** — teach any LLM to drive Draften

## Next passes
Symbols/instances + overrides · gradients + image fills · auto-layout (Stacks) ·
constraints/pinning · masks · prototype overlays/scroll · canvas comments ·
**live collab** (the one true multiplayer gap).
