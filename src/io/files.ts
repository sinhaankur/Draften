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

/** PNG export — raster. */
export async function exportPng(api: ExcalidrawImperativeAPI, name: string) {
  const { exportToBlob } = await import("@excalidraw/excalidraw");
  const blob = await exportToBlob({
    elements: api.getSceneElements(),
    appState: { ...api.getAppState(), exportBackground: true },
    files: api.getFiles(),
    mimeType: "image/png",
    quality: 1,
  });
  download(`${safe(name)}.png`, blob, "image/png");
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
