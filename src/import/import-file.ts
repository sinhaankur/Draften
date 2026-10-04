/**
 * importFile — the one path to open any supported file (PDF, Word, Sketch).
 *
 * Used by both the Import button AND drag-and-drop. Picks the right importer by
 * extension/magic, extracts to a DraftenDocument, loads it into the store, and
 * draws it onto the canvas so you SEE it. Returns a human status string.
 */

import { importers } from "./importer";
import { documentToSkeleton } from "./to-canvas";
import { drawSkeletonOnCanvas } from "../canvas/apply-action";
import { useEditor } from "../state/store";

export async function importFile(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const input = { bytes, filename: file.name };
  const importer = importers.pick(input);
  if (!importer) {
    const exts = importers.all().flatMap((i) => i.extensions).join(", ");
    return `Can't open "${file.name}". Supported: ${exts || "—"}.`;
  }
  // Any importer/convert failure becomes a clear message — never an app crash.
  try {
    const { document, warnings } = await importer.import(input);
    useEditor.getState().loadDocument(document);
    const drew = await drawSkeletonOnCanvas(documentToSkeleton(document));
    const layers = Object.keys(document.nodes).length;
    return warnings.length
      ? `Opened ${file.name} · ${layers} layers · ${warnings[0]}`
      : `Opened ${file.name} · ${layers} layers${drew ? " ✓" : ""}`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Couldn't open "${file.name}" (${importer.label}): ${msg}`;
  }
}

/** Can this dropped file be opened by one of our importers? */
export function canImportFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return importers.all().some((i) => i.extensions.some((ext) => lower.endsWith(ext)));
}

/**
 * Open a file the desktop app received by PATH (native drag-drop gives paths, not
 * File objects). Reads the bytes via the Rust `read_dropped_file` command, wraps
 * them in a File, and runs the normal import.
 */
export async function importFileByPath(path: string): Promise<string> {
  const name = path.split(/[\\/]/).pop() || path;
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const bytes = await invoke<number[] | Uint8Array>("read_dropped_file", { path });
    const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const file = new File([u8.buffer as ArrayBuffer], name);
    return await importFile(file);
  } catch (err) {
    return `Couldn't open "${name}": ${(err as Error).message}`;
  }
}

/**
 * Wire native desktop drag-drop (Tauri). The webview's drag-drop event reports
 * dropped file PATHS; we open the first supported one. Returns an unlisten fn.
 * A no-op (returns undefined) outside Tauri — the HTML onDrop handles the web.
 * `onStatus`/`onHover` let the UI show the drop cue + result.
 */
export async function registerDesktopDrop(
  onStatus: (msg: string) => void,
  onHover?: (over: boolean) => void,
): Promise<(() => void) | undefined> {
  const w = window as unknown as { __TAURI_INTERNALS__?: unknown; __TAURI__?: unknown };
  if (!w.__TAURI_INTERNALS__ && !w.__TAURI__) return undefined;
  try {
    const { getCurrentWebview } = await import("@tauri-apps/api/webview");
    const webview = getCurrentWebview();
    const unlisten = await webview.onDragDropEvent(async (event) => {
      const p = event.payload as { type: string; paths?: string[] };
      if (p.type === "over" || p.type === "enter") { onHover?.(true); return; }
      if (p.type === "leave" || p.type === "cancel") { onHover?.(false); return; }
      if (p.type === "drop" && p.paths?.length) {
        onHover?.(false);
        const path = p.paths.find((x) => canImportFile(x)) ?? p.paths[0];
        onStatus(`Opening ${path.split(/[\\/]/).pop()}…`);
        onStatus(await importFileByPath(path));
      }
    });
    return unlisten;
  } catch {
    return undefined;
  }
}
