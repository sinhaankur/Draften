---
name: draften-open-other-tools-files
description: How to import Sketch / Figma / OmniGraffle / PDF / Word into Draften (don't get locked in)
when-to-use: When building or extending an importer (src/import/*).
---

# Skill: Open the files people send you

Draften's promise is "opens their files — don't get locked in." Importers register
against one contract (`src/import/importer.ts`) and turn a foreign file into real,
editable canvas elements.

## Use these (license-checked, 2026)
- **Sketch `.sketch`** → [`@sketch-hq/sketch-file`](https://www.npmjs.com/package/@sketch-hq/sketch-file) (**MIT**) +
  [`@sketch-hq/sketch-file-format`](https://www.npmjs.com/package/@sketch-hq/sketch-file-format) (**MIT**, TS types/schema).
  Official. `fromFile` → whole document as one JS tree. Back the `src/import/sketch.ts` stub with this.
- **Figma** → paste-from-Figma (already in `src/import/paste.ts`) or
  [`figma-to-json`](https://github.com/yagudaev/figma-to-json) (file→JSON) /
  [`figma-export-svg`](https://github.com/joshuaslate/figma-export-svg) (MIT, API→SVG, needs a token+link).
- **PDF** → `pdfjs-dist` (already real in `src/import/pdf.ts`): page→board, text runs→nodes.
- **Word `.docx`** → `mammoth` (already real in `src/import/docx.ts`): headings/paragraphs→text nodes.
- **OmniGraffle `.graffle`** → a plist/zip; parse via the desktop app's Rust side (Tauri)
  when built. Not yet implemented — stub + flag as desktop-only.

## Rules
- Import produces REAL extraction (positioned editable elements), never a flat image stub.
- Flip coordinate origins where the source differs (PDF is bottom-left).
- Warn honestly when something can't be read ("no text found", unsupported feature).
- Each importer is just another `Importer` against the same contract — register in `src/plugins/builtins.ts`.
