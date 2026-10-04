/**
 * layer-actions — the per-layer operations Figma/Sketch have and Excalidraw
 * doesn't expose in a panel: rename, duplicate, delete, lock, reorder (z-order),
 * wrap-in-artboard. Each takes the imperative canvas API and writes real scene
 * changes. Pure helpers so the LayersPanel stays a thin view.
 */
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

type Writable = Parameters<ExcalidrawImperativeAPI["updateScene"]>[0]["elements"];

function commit(api: ExcalidrawImperativeAPI, els: unknown[]) {
  api.updateScene({ elements: els as Writable });
}

/** Rename a layer — stored in customData.name so it survives convert/export. */
export function renameLayer(api: ExcalidrawImperativeAPI, id: string, name: string) {
  const els = api.getSceneElements().map((e) => {
    if (e.id !== id) return e;
    const cd = { ...(e as { customData?: object }).customData, name };
    // frames also carry a top-level `name` the canvas renders
    return e.type === "frame" ? { ...e, name, customData: cd } : { ...e, customData: cd };
  });
  commit(api, els);
}

/** Lock / unlock — a locked layer can't be selected or moved on the canvas. */
export function setLocked(api: ExcalidrawImperativeAPI, id: string, locked: boolean) {
  const els = api.getSceneElements().map((e) => (e.id === id ? { ...e, locked } : e));
  commit(api, els);
}

/** Delete a layer (and its bound text, and — for a frame — its children). */
export function deleteLayer(api: ExcalidrawImperativeAPI, id: string) {
  const scene = api.getSceneElements();
  const target = scene.find((e) => e.id === id);
  const kill = new Set<string>([id]);
  if (target?.type === "frame") scene.forEach((e) => { if ((e as { frameId?: string }).frameId === id) kill.add(e.id); });
  // bound text labels go with their container
  scene.forEach((e) => { const b = (e as { containerId?: string }).containerId; if (b && kill.has(b)) kill.add(e.id); });
  const els = scene.map((e) => (kill.has(e.id) ? { ...e, isDeleted: true } : e));
  commit(api, els);
}

/** Duplicate a layer 16px down-right, selected. */
export function duplicateLayer(api: ExcalidrawImperativeAPI, id: string) {
  const scene = api.getSceneElements();
  const src = scene.find((e) => e.id === id);
  if (!src) return;
  const newId = `${id}-copy-${Math.random().toString(36).slice(2, 7)}`;
  const copy = { ...src, id: newId, x: src.x + 16, y: src.y + 16, seed: Math.floor(Math.random() * 1e9) };
  commit(api, [...scene, copy]);
  api.updateScene({ appState: { ...api.getAppState(), selectedElementIds: { [newId]: true } } });
}

/** Bring a layer to the very front (end of the array = top in Excalidraw). */
export function bringToFront(api: ExcalidrawImperativeAPI, id: string) {
  const scene = api.getSceneElements();
  const el = scene.find((e) => e.id === id);
  if (!el) return;
  commit(api, [...scene.filter((e) => e.id !== id), el]);
}

/** Send a layer to the very back (start of the array = bottom). */
export function sendToBack(api: ExcalidrawImperativeAPI, id: string) {
  const scene = api.getSceneElements();
  const el = scene.find((e) => e.id === id);
  if (!el) return;
  commit(api, [el, ...scene.filter((e) => e.id !== id)]);
}

/** Move a layer one step up or down in z-order. */
export function reorder(api: ExcalidrawImperativeAPI, id: string, dir: "up" | "down") {
  const scene = api.getSceneElements().slice();
  const i = scene.findIndex((e) => e.id === id);
  if (i < 0) return;
  const j = dir === "up" ? i + 1 : i - 1;
  if (j < 0 || j >= scene.length) return;
  [scene[i], scene[j]] = [scene[j], scene[i]];
  commit(api, scene);
}

/** Move the element at index `from` to index `to` (drag-to-reorder). */
export function moveTo(api: ExcalidrawImperativeAPI, fromId: string, toId: string) {
  const scene = api.getSceneElements().slice();
  const from = scene.findIndex((e) => e.id === fromId);
  const to = scene.findIndex((e) => e.id === toId);
  if (from < 0 || to < 0 || from === to) return;
  const [moved] = scene.splice(from, 1);
  scene.splice(to, 0, moved);
  commit(api, scene);
}

/**
 * Wrap the selected loose elements in a new artboard (frame) sized to their
 * bounding box + padding — the "these aren't in a frame yet" fix.
 */
export function wrapInArtboard(api: ExcalidrawImperativeAPI, ids: string[], name = "Artboard") {
  const scene = api.getSceneElements();
  const sel = scene.filter((e) => ids.includes(e.id) && !e.isDeleted);
  if (sel.length === 0) return;
  const pad = 24;
  const minX = Math.min(...sel.map((e) => e.x)) - pad;
  const minY = Math.min(...sel.map((e) => e.y)) - pad;
  const maxX = Math.max(...sel.map((e) => e.x + e.width)) + pad;
  const maxY = Math.max(...sel.map((e) => e.y + e.height)) + pad;
  const frameId = `frame-${Math.random().toString(36).slice(2, 8)}`;
  const frame = {
    type: "frame", id: frameId, name,
    x: minX, y: minY, width: maxX - minX, height: maxY - minY,
    strokeColor: "transparent", backgroundColor: "transparent",
    customData: { name }, locked: false, angle: 0, seed: Math.floor(Math.random() * 1e9),
    version: 1, versionNonce: 0, isDeleted: false, groupIds: [], boundElements: null,
    updated: Date.now(), link: null, roundness: null,
  };
  const els = scene.map((e) => (ids.includes(e.id) ? { ...e, frameId } : e));
  // frame must sit BEFORE its children in the array (lower z) so it reads as the background
  commit(api, [frame, ...els]);
}
