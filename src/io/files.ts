/**
 * File I/O — save & open in open, non-proprietary formats.
 *
 * Draften's promise: your work is YOURS and portable. So saving/exporting never
 * uses a locked format. You can keep a local file (backed up like Sketch),
 * commit it to git, or hand it to any other open tool.
 *
 * Formats:
 *   .draften.json  — native document (plain JSON: scene + design system)
 *   .excalidraw    — the open Excalidraw format (opens in excalidraw.com + editor)
 *   .svg           — vector export of the canvas (opens anywhere)
 *   .png           — raster export
 *
 * Open: .draften.json and .excalidraw both load back onto the canvas.
 */

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

/** Trigger a browser download of a Blob/string. */
function download(filename: string, data: Blob | string, type = "application/json") {
  const blob = typeof data === "string" ? new Blob([data], { type }) : data;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Native .draften.json — our own document, plain JSON, fully open. */
export function saveDraften(api: ExcalidrawImperativeAPI, name: string) {
  const payload = {
    format: "draften",
    version: "0.1.0",
    name,
    savedAt: new Date().toISOString(),
    scene: {
      elements: api.getSceneElements(),
      appState: pickAppState(api.getAppState()),
      files: api.getFiles(),
    },
  };
  download(`${safe(name)}.draften.json`, JSON.stringify(payload, null, 2));
}

/** The open .excalidraw format — portable to excalidraw.com and others. */
export async function saveExcalidraw(api: ExcalidrawImperativeAPI, name: string) {
  const { serializeAsJSON } = await import("@excalidraw/excalidraw");
  const json = serializeAsJSON(api.getSceneElements(), api.getAppState(), api.getFiles(), "local");
  download(`${safe(name)}.excalidraw`, json);
}

/** SVG export — vector, opens in any browser/editor. */
export async function exportSvg(api: ExcalidrawImperativeAPI, name: string) {
  const { exportToSvg } = await import("@excalidraw/excalidraw");
  const svg = await exportToSvg({
    elements: api.getSceneElements(),
    appState: { ...api.getAppState(), exportBackground: true, exportWithDarkMode: false },
    files: api.getFiles(),
  });
  download(`${safe(name)}.svg`, svg.outerHTML, "image/svg+xml");
}

/** PNG export — raster, at @1x / @2x / @3x like Sketch/Figma export presets. */
export async function exportPng(api: ExcalidrawImperativeAPI, name: string, scale = 1) {
  const { exportToBlob } = await import("@excalidraw/excalidraw");
  const sel = selectedOrAll(api);
  const blob = await exportToBlob({
    elements: sel,
    appState: { ...api.getAppState(), exportBackground: true, exportScale: scale },
    files: api.getFiles(),
    mimeType: "image/png",
    quality: 1,
  });
  download(`${safe(name)}${scale > 1 ? `@${scale}x` : ""}.png`, blob, "image/png");
}

/** PDF export — a single page sized to the design, embedding a @2x raster.
    Self-contained writer (no heavy dependency); opens + prints 1:1 everywhere. */
export async function exportPdf(api: ExcalidrawImperativeAPI, name: string) {
  const { exportToBlob } = await import("@excalidraw/excalidraw");
  const sel = selectedOrAll(api);
  const blob = await exportToBlob({
    elements: sel,
    appState: { ...api.getAppState(), exportBackground: true, exportScale: 2 },
    files: api.getFiles(),
    mimeType: "image/jpeg",
    quality: 0.92,
  });
  const jpeg = new Uint8Array(await blob.arrayBuffer());
  const dims = jpegSize(jpeg);
  const { pdfFromJpeg } = await import("./pdf-export");
  const pdf = pdfFromJpeg(jpeg, dims.w, dims.h);
  download(`${safe(name)}.pdf`, new Blob([pdf as unknown as BlobPart], { type: "application/pdf" }), "application/pdf");
}

/**
 * Export a REAL, editable PDF (vector + selectable text) from the live scene via
 * @draften/pdf-vectors — not a flattened raster. This is what makes Draften a PDF
 * editor: open a PDF, edit it, write it back as a PDF that still has real shapes
 * and searchable text. Exports the selection if any, else the whole canvas, onto
 * one page sized to the content bounds.
 */
export async function exportVectorPdf(api: ExcalidrawImperativeAPI, name: string): Promise<string> {
  const { exportPdf } = await import("@draften/pdf-vectors");
  const els = selectedOrAll(api) as unknown as SceneEl[];
  if (!els.length) return "Nothing to export.";

  // content bounds → page size (points), with a small margin
  const M = 24;
  const minX = Math.min(...els.map((e) => e.x));
  const minY = Math.min(...els.map((e) => e.y));
  const maxX = Math.max(...els.map((e) => e.x + (e.width ?? 0)));
  const maxY = Math.max(...els.map((e) => e.y + (e.height ?? 0)));
  const width = Math.max(1, maxX - minX) + M * 2;
  const height = Math.max(1, maxY - minY) + M * 2;
  const ox = minX - M, oy = minY - M;

  const nodes = els.map((e) => sceneElToNode(e, ox, oy)).filter(Boolean) as PdfVecNode[];
  const bytes = exportPdf({ title: name, pages: [{ width, height, background: "#ffffff", nodes }] });
  download(`${safe(name)}.pdf`, new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }), "application/pdf");
  return `Exported ${els.length} layer${els.length === 1 ? "" : "s"} to PDF ✓`;
}

type SceneEl = {
  id: string; type: string; x: number; y: number; width?: number; height?: number;
  angle?: number; opacity?: number; strokeColor?: string; backgroundColor?: string;
  strokeWidth?: number; text?: string; fontSize?: number; textAlign?: string;
  points?: Array<[number, number]>; roundness?: unknown;
};
type PdfVecNode = import("@draften/pdf-vectors").PDFNode;

/** One Excalidraw element → a neutral pdf-vectors node (origin-shifted). */
function sceneElToNode(e: SceneEl, ox: number, oy: number): PdfVecNode | null {
  const x = e.x - ox, y = e.y - oy;
  const w = Math.max(0, e.width ?? 0), h = Math.max(0, e.height ?? 0);
  const op = e.opacity != null && e.opacity < 100 ? e.opacity / 100 : undefined;
  const hasBg = e.backgroundColor && e.backgroundColor !== "transparent";
  const fill = hasBg ? { kind: "solid" as const, color: e.backgroundColor! } : { kind: "none" as const };
  const stroke = e.strokeColor && e.strokeColor !== "transparent"
    ? { color: e.strokeColor, width: e.strokeWidth ?? 1 } : undefined;

  switch (e.type) {
    case "rectangle": case "diamond":
      return { id: e.id, type: "rect", frame: { x, y, width: w, height: h }, fill, ...(stroke ? { stroke } : {}), ...(e.roundness ? { radius: 8 } : {}), ...(op ? { opacity: op } : {}) };
    case "ellipse": {
      // approximate an ellipse as a path (4 cubic arcs)
      const d = ellipsePathD(x, y, w, h);
      return { id: e.id, type: "path", frame: { x, y, width: w, height: h }, d, fill, ...(stroke ? { stroke } : {}), ...(op ? { opacity: op } : {}) };
    }
    case "line": case "arrow": case "freedraw": {
      const pts = (e.points ?? []).map(([px, py]) => [px + x, py + y] as [number, number]);
      if (pts.length < 2) return null;
      const d = "M " + pts.map((p) => `${r2(p[0])} ${r2(p[1])}`).join(" L ");
      return { id: e.id, type: "path", frame: { x, y, width: w, height: h }, d, fill: { kind: "none" }, ...(stroke ? { stroke } : { stroke: { color: "#1d1d1b", width: 1 } }), ...(op ? { opacity: op } : {}) };
    }
    case "text":
      return { id: e.id, type: "text", frame: { x, y, width: w, height: h }, text: e.text ?? "", fontSize: e.fontSize ?? 16, fontFamily: "Helvetica", fontWeight: 400, color: e.strokeColor ?? "#1d1d1b", align: (e.textAlign as "left" | "center" | "right") ?? "left", ...(op ? { opacity: op } : {}) };
    default:
      return null;
  }
}

function r2(n: number): number { return Math.round(n * 100) / 100; }

/** A 4-cubic-bezier ellipse as an absolute SVG path (top-left space). */
function ellipsePathD(x: number, y: number, w: number, h: number): string {
  const kx = (w / 2) * 0.5523, ky = (h / 2) * 0.5523;
  const cx = x + w / 2, cy = y + h / 2;
  const x0 = x, x1 = x + w, y0 = y, y1 = y + h;
  return [
    `M ${r2(x0)} ${r2(cy)}`,
    `C ${r2(x0)} ${r2(cy - ky)} ${r2(cx - kx)} ${r2(y0)} ${r2(cx)} ${r2(y0)}`,
    `C ${r2(cx + kx)} ${r2(y0)} ${r2(x1)} ${r2(cy - ky)} ${r2(x1)} ${r2(cy)}`,
    `C ${r2(x1)} ${r2(cy + ky)} ${r2(cx + kx)} ${r2(y1)} ${r2(cx)} ${r2(y1)}`,
    `C ${r2(cx - kx)} ${r2(y1)} ${r2(x0)} ${r2(cy + ky)} ${r2(x0)} ${r2(cy)} Z`,
  ].join(" ");
}

/** Read a JPEG's pixel dimensions from its SOF marker. */
function jpegSize(b: Uint8Array): { w: number; h: number } {
  let i = 2;
  while (i < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1];
    // SOF0..SOF3, SOF5..SOF7, SOF9..SOF11, SOF13..SOF15 carry dimensions
    if ((marker >= 0xc0 && marker <= 0xcf) && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      const h = (b[i + 5] << 8) | b[i + 6];
      const w = (b[i + 7] << 8) | b[i + 8];
      return { w, h };
    }
    i += 2 + ((b[i + 2] << 8) | b[i + 3]);
  }
  return { w: 800, h: 600 };
}

/** Copy the selected layer's CSS to the clipboard (developer handoff, like
    Sketch/Figma "Copy CSS"). Returns a status string for a toast. */
export async function copyLayerCss(api: ExcalidrawImperativeAPI): Promise<string> {
  const st = api.getAppState();
  const ids = Object.keys(st.selectedElementIds || {}).filter((k) => st.selectedElementIds[k]);
  const el = api.getSceneElements().find((e) => ids.includes(e.id)) as unknown as {
    width: number; height: number; backgroundColor?: string; strokeColor?: string;
    roundness?: unknown; opacity?: number; type: string; customData?: { effects?: import("../canvas/effects").LayerEffects } | null;
  } | undefined;
  if (!el) return "Select a layer to copy its CSS.";
  const { effectsOf, effectCssDecls } = await import("../canvas/effects");
  const decls: string[] = [
    `width: ${Math.round(el.width)}px`,
    `height: ${Math.round(el.height)}px`,
  ];
  if (el.backgroundColor && el.backgroundColor !== "transparent") decls.push(`background: ${el.backgroundColor}`);
  if (el.strokeColor && el.type !== "text") decls.push(`border: 1px solid ${el.strokeColor}`);
  if (el.type === "text" && el.strokeColor) decls.push(`color: ${el.strokeColor}`);
  if (el.roundness) decls.push("border-radius: 10px");
  if (el.type === "ellipse") decls.push("border-radius: 9999px");
  if (el.opacity != null && el.opacity < 100) decls.push(`opacity: ${(el.opacity / 100).toFixed(2)}`);
  for (const d of effectCssDecls(effectsOf(el))) decls.push(d.replace(":", ": "));
  const css = decls.join(";\n  ");
  try {
    await navigator.clipboard.writeText(`.layer {\n  ${css};\n}`);
    return "Copied CSS to clipboard ✓";
  } catch {
    return "Couldn't access the clipboard.";
  }
}

/** The current selection, or the whole scene if nothing is selected. */
function selectedOrAll(api: ExcalidrawImperativeAPI) {
  const st = api.getAppState();
  const ids = Object.keys(st.selectedElementIds || {}).filter((k) => st.selectedElementIds[k]);
  const all = api.getSceneElements();
  if (ids.length === 0) return all;
  const picked = all.filter((e) => ids.includes(e.id));
  return picked.length ? picked : all;
}

/** Open a .draften.json or .excalidraw file back onto the canvas. */
export async function openFile(api: ExcalidrawImperativeAPI): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".draften.json,.json,.excalidraw";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        // Both formats carry { elements, appState, files } (ours nests under .scene).
        const scene = data.scene ?? data;
        api.updateScene({
          elements: scene.elements ?? [],
          appState: { ...api.getAppState(), ...pickAppState(scene.appState ?? {}) },
        });
        if (scene.files) api.addFiles(Object.values(scene.files));
        api.scrollToContent(api.getSceneElements(), { fitToContent: true });
        resolve(data.name ?? file.name.replace(/\.(draften\.json|json|excalidraw)$/i, ""));
      } catch {
        resolve(null);
      }
    };
    input.click();
  });
}

/** Only the appState fields worth persisting (the rest is transient UI). */
function pickAppState(s: Record<string, unknown>): Record<string, unknown> {
  return {
    viewBackgroundColor: s.viewBackgroundColor,
    gridSize: s.gridSize,
    name: s.name,
  };
}

function safe(name: string): string {
  return (name || "draften").replace(/[^a-z0-9-_]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "draften";
}
