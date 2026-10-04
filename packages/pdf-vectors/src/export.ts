/**
 * exportPdf — a neutral PDFDoc → real PDF bytes. Zero dependencies: we write the
 * file structure by hand (objects, xref, trailer) and a content stream per page.
 *
 * This is the other half of "Draften is a PDF editor": import a PDF, edit the
 * nodes, write it back out. Coordinates come in top-left (app space); PDF is
 * bottom-left, so every Y is flipped by pageHeight on the way out.
 *
 * Fonts use the standard-14 (Helvetica family) so no font embedding is needed —
 * text stays real, selectable, and searchable in the output.
 */

import type { PDFDoc, PDFNode, PDFPage, Paint, Stroke } from "./model";

const STD_FONT = "Helvetica";
const STD_FONT_BOLD = "Helvetica-Bold";

export function exportPdf(doc: PDFDoc): Uint8Array {
  const objects: string[] = []; // 1-indexed PDF objects (as raw body strings)
  const ref = (body: string): number => { objects.push(body); return objects.length; };

  // Reserve: 1 = Catalog, 2 = Pages (filled after we know the kids)
  ref("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesObjIndex = ref(""); // placeholder, patched below

  // Shared fonts
  const fontRegular = ref(`<< /Type /Font /Subtype /Type1 /BaseFont /${STD_FONT} >>`);
  const fontBold = ref(`<< /Type /Font /Subtype /Type1 /BaseFont /${STD_FONT_BOLD} >>`);

  const pageRefs: number[] = [];
  for (const page of doc.pages) {
    const { stream, images } = pageContent(page);
    const contentRef = ref(`<< /Length ${byteLength(stream)} >>\nstream\n${stream}\nendstream`);

    // image XObjects for this page
    const xobjectEntries: string[] = [];
    images.forEach((img, i) => {
      const imgRef = ref(img.obj);
      xobjectEntries.push(`/Im${i} ${imgRef} 0 R`);
    });

    const resources =
      `<< /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >>` +
      (xobjectEntries.length ? ` /XObject << ${xobjectEntries.join(" ")} >>` : "") +
      ` >>`;
    const pageRef = ref(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${round(page.width)} ${round(page.height)}] ` +
      `/Resources ${resources} /Contents ${contentRef} 0 R >>`,
    );
    pageRefs.push(pageRef);
  }

  // patch the Pages object now that we have the kids
  objects[pagesObjIndex - 1] =
    `<< /Type /Pages /Kids [${pageRefs.map((r) => `${r} 0 R`).join(" ")}] /Count ${pageRefs.length} >>`;

  let info = "";
  if (doc.title) {
    const infoRef = ref(`<< /Title (${pdfString(doc.title)}) /Producer (Draften) >>`);
    info = ` /Info ${infoRef} 0 R`;
  }

  return assemble(objects, info);
}

// ── one page's content stream ────────────────────────────────────────────────

interface EmittedImage { obj: string }

function pageContent(page: PDFPage): { stream: string; images: EmittedImage[] } {
  const h = page.height;
  const out: string[] = [];
  const images: EmittedImage[] = [];

  // paper background (if not white)
  if (page.background && page.background.toLowerCase() !== "#ffffff") {
    const [r, g, b] = hexRGB(page.background);
    out.push(`${r} ${g} ${b} rg 0 0 ${round(page.width)} ${round(h)} re f`);
  }

  for (const node of page.nodes) emitNode(node, h, out, images);
  return { stream: out.join("\n"), images };
}

function emitNode(node: PDFNode, h: number, out: string[], images: EmittedImage[]): void {
  switch (node.type) {
    case "rect": {
      const { x, y, width, height } = node.frame;
      const py = h - y - height; // flip
      out.push("q");
      alpha(out, node.fill, node.stroke, node.opacity);
      const painted = setPaints(out, node.fill, node.stroke);
      strokeStyle(out, node.stroke);
      out.push(`${num(x)} ${num(py)} ${num(width)} ${num(height)} re`);
      out.push(paintOp(painted));
      out.push("Q");
      break;
    }
    case "path": {
      out.push("q");
      alpha(out, node.fill, node.stroke, node.opacity);
      const painted = setPaints(out, node.fill, node.stroke);
      strokeStyle(out, node.stroke);
      out.push(pathDToPdf(node.d, h));
      out.push(paintOp(painted));
      out.push("Q");
      break;
    }
    case "text": {
      const { x, y } = node.frame;
      const baseline = h - y - node.fontSize; // top-left → baseline
      const [r, g, b] = hexRGB(node.color);
      const font = node.fontWeight >= 600 ? "F2" : "F1";
      out.push("q", "BT", `${r} ${g} ${b} rg`, `/${font} ${num(node.fontSize)} Tf`,
        `${num(x)} ${num(baseline)} Td`, `(${pdfString(node.text)}) Tj`, "ET", "Q");
      break;
    }
    case "image": {
      const png = dataUrlToBytes(node.src);
      if (!png) break;
      const { x, y, width, height } = node.frame;
      const py = h - y - height;
      const idx = images.length;
      // Embed PNG bytes via an Image XObject. We wrap raw PNG in a stream using
      // the /DCTDecode-free path by re-encoding to raw is heavy; instead we store
      // the PNG as an XObject with /Filter /FlateDecode is not valid for PNG, so
      // we emit it as an embedded file image using the simplest reliable route:
      // a PNG is not directly a PDF image, so we fall back to a placeholder box.
      // (Round-tripping raster faithfully needs JPEG/DCT; vectors/text are exact.)
      images.push({ obj: pngPlaceholderXObject(width, height) });
      out.push("q", `${num(width)} 0 0 ${num(height)} ${num(x)} ${num(py)} cm`, `/Im${idx} Do`, "Q");
      void png;
      break;
    }
  }
}

// ── content-stream helpers ───────────────────────────────────────────────────

function setPaints(out: string[], fill: Paint, stroke?: Stroke): { fill: boolean; stroke: boolean } {
  const doFill = fill.kind === "solid";
  if (doFill) { const [r, g, b] = hexRGB(fill.color); out.push(`${r} ${g} ${b} rg`); }
  const doStroke = !!stroke;
  if (doStroke) { const [r, g, b] = hexRGB(stroke!.color); out.push(`${r} ${g} ${b} RG`); }
  return { fill: doFill, stroke: doStroke };
}

function strokeStyle(out: string[], stroke?: Stroke): void {
  if (!stroke) return;
  out.push(`${num(stroke.width)} w`);
  if (stroke.dash && stroke.dash.length) out.push(`[${stroke.dash.map(num).join(" ")}] 0 d`);
}

function paintOp(p: { fill: boolean; stroke: boolean }): string {
  if (p.fill && p.stroke) return "B"; // fill + stroke
  if (p.fill) return "f";
  if (p.stroke) return "S";
  return "n"; // no-op paint (shouldn't happen)
}

/** Emit an ExtGState inline for alpha. PDF needs a named gs; we approximate by
 *  constant alpha via a simple /GS not referenced — so instead we skip true alpha
 *  and keep full opacity in the stream (opacity is preserved in the model). */
function alpha(_out: string[], _fill: Paint, _stroke?: Stroke, _nodeOpacity?: number): void {
  // Constant alpha requires an ExtGState resource; left as a known limitation so
  // the exporter stays single-pass + dependency-free. Shapes export fully opaque.
}

/** SVG `d` (top-left, absolute) → PDF path ops (bottom-left). */
export function pathDToPdf(d: string, pageHeight: number): string {
  const fy = (y: number) => pageHeight - y;
  const re = /([MLCQZ])([^MLCQZ]*)/gi;
  const ops: string[] = [];
  let m: RegExpExecArray | null;
  let cur: [number, number] = [0, 0];
  let start: [number, number] | null = null;
  const nums = (s: string) => (s.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
  while ((m = re.exec(d))) {
    const cmd = m[1].toUpperCase();
    const n = nums(m[2]);
    if (cmd === "M") { cur = [n[0], n[1]]; start = cur; ops.push(`${num(n[0])} ${num(fy(n[1]))} m`); }
    else if (cmd === "L") { cur = [n[0], n[1]]; ops.push(`${num(n[0])} ${num(fy(n[1]))} l`); }
    else if (cmd === "C") { ops.push(`${num(n[0])} ${num(fy(n[1]))} ${num(n[2])} ${num(fy(n[3]))} ${num(n[4])} ${num(fy(n[5]))} c`); cur = [n[4], n[5]]; }
    else if (cmd === "Q") {
      // promote quadratic → cubic for PDF (no quad op)
      const [x1, y1, x, y] = n;
      const c1x = cur[0] + (2 / 3) * (x1 - cur[0]);
      const c1y = cur[1] + (2 / 3) * (y1 - cur[1]);
      const c2x = x + (2 / 3) * (x1 - x);
      const c2y = y + (2 / 3) * (y1 - y);
      ops.push(`${num(c1x)} ${num(fy(c1y))} ${num(c2x)} ${num(fy(c2y))} ${num(x)} ${num(fy(y))} c`);
      cur = [x, y];
    } else if (cmd === "Z") { ops.push("h"); if (start) cur = start; }
  }
  return ops.join("\n");
}

function pngPlaceholderXObject(w: number, h: number): string {
  // A tiny grey 1×1 image stretched to the frame — honest placeholder for raster
  // until DCT/JPEG embedding lands. Keeps the output valid + the layout readable.
  const px = "\xcc\xcc\xcc"; // one grey RGB pixel
  return `<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB ` +
    `/BitsPerComponent 8 /Length ${px.length} >>\nstream\n${px}\nendstream`;
  void w; void h;
}

// ── low-level PDF assembly ───────────────────────────────────────────────────

function assemble(objects: string[], infoTrailer: string): Uint8Array {
  let pdf = "%PDF-1.4\n%\xe2\xe3\xcf\xd3\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(byteLength(pdf));
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xrefPos = byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R${infoTrailer} >>\nstartxref\n${xrefPos}\n%%EOF`;
  return latin1Bytes(pdf);
}

// ── small utilities ──────────────────────────────────────────────────────────

function round(n: number): number { return Math.round(n * 100) / 100; }
function num(n: number): string { return String(round(n)); }

function hexRGB(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const v = parseInt(m[1], 16);
  return [round(((v >> 16) & 255) / 255), round(((v >> 8) & 255) / 255), round((v & 255) / 255)];
}

/** Escape a string for a PDF literal ( ) string. */
function pdfString(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/[\r\n]+/g, " ");
}

function byteLength(s: string): number {
  // our streams are latin1 (one byte per char code 0..255)
  return s.length;
}

function latin1Bytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

function dataUrlToBytes(src: string): Uint8Array | null {
  const m = /^data:[^;]+;base64,(.*)$/.exec(src);
  if (!m) return null;
  try {
    const bin = typeof atob === "function" ? atob(m[1]) : fromBase64(m[1]);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch { return null; }
}

/** Minimal base64 decoder for environments without `atob` (e.g. Node tests). */
function fromBase64(b64: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, "");
  let out = "";
  for (let i = 0; i < clean.length; i += 4) {
    const n = (idx(clean[i]) << 18) | (idx(clean[i + 1]) << 12) | (idx(clean[i + 2]) << 6) | idx(clean[i + 3]);
    out += String.fromCharCode((n >> 16) & 0xff);
    if (clean[i + 2] !== undefined) out += String.fromCharCode((n >> 8) & 0xff);
    if (clean[i + 3] !== undefined) out += String.fromCharCode(n & 0xff);
  }
  function idx(c: string): number { return c === undefined ? 0 : chars.indexOf(c); }
  return out;
}
