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
