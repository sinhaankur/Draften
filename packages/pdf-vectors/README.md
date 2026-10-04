# @draften/pdf-vectors

Round-trip **PDF ⇄ editable document**. Import a PDF into real editable nodes
(rectangles, paths, text, images — with fills, strokes, dashes, transforms), and
export the edited document back to a valid PDF. This is the engine that turns a
canvas app into a **PDF editor**, not just a viewer.

Most PDF tooling gives you *either* extracted text *or* a flat page raster.
`pdf-vectors` gives you **editable geometry**: click any shape or word and change
it, then write it back out.

```ts
import { importPdf, exportPdf } from "@draften/pdf-vectors";
import * as pdfjs from "pdfjs-dist";

// PDF → editable doc
const doc = await importPdf(bytes, pdfjs);
doc.pages[0].nodes             // RectNode | PathNode | TextNode | ImageNode
  .filter(n => n.type === "text")
  .forEach(t => (t.text = t.text.toUpperCase()));

// edited doc → real PDF
const out = exportPdf(doc);    // Uint8Array
```

## How it works

- **Import** replays each page's pdf.js operator list, tracking the graphics
  state (CTM, fill/stroke colour across RGB/gray/CMYK, line width, dashes, alpha)
  through `save`/`restore`/`transform`/`setGState`. Each painted path becomes a
  `rect` (axis-aligned) or `path` (SVG `d`) node; text comes from `getTextContent`;
  image XObjects become `image` nodes when you pass a `resolveImage` callback.
- **Export** writes PDF objects + a content stream per page by hand (no deps):
  rects/paths as fill/stroke ops, text with the standard-14 Helvetica family
  (stays selectable + searchable), with Y flipped back to PDF's bottom-left origin.

## Design choices / limits (honest)

- **Text fonts** map to the standard-14 (Helvetica/Helvetica-Bold) on export — no
  font embedding, so no bloat, but exotic typefaces are approximated.
- **Raster images** export as a placeholder box for now (faithful raster needs
  JPEG/DCT embedding); vectors and text round-trip exactly.
- **Gradients/patterns/clips** approximate to a solid fill; beziers are preserved.
- `pdfjs-dist` is a **peer dependency** — the host passes it in, controlling the
  version and the worker setup.

MIT © Ankur Sinha
