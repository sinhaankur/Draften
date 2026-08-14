import { useRef, useState } from "react";

import { importers } from "../import/importer";
import { useEditor } from "../state/store";

/**
 * Import entry — makes the registered importers actually reachable.
 *
 * Before this, Sketch/PDF importers were registered but no UI ever called them.
 * This opens a real file picker, picks the right importer by extension/magic,
 * runs it, loads the result into the store, and surfaces any fidelity warnings
 * honestly (e.g. "approximated an unsupported layer"). Figma is API-based (no
 * local file) so it's noted as not-yet-wired rather than silently missing.
 */
export function ImportButton() {
  const loadDocument = useEditor((s) => s.loadDocument);
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);

  const accept = importers
    .all()
    .flatMap((i) => i.extensions)
    .join(",");

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("Reading…");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const input = { bytes, filename: file.name };
      const importer = importers.pick(input);
      if (!importer) {
        setStatus(`No importer for "${file.name}". Supported: ${accept || "—"}.`);
        return;
      }
      const { document, warnings } = await importer.import(input);
      loadDocument(document);
      setStatus(
        warnings.length
          ? `Imported ${file.name} · ${warnings.length} note(s): ${warnings[0]}`
          : `Imported ${file.name} ✓`,
      );
    } catch (err) {
      setStatus(`Import failed: ${(err as Error).message}`);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="import-wrap">
      <button className="row small" onClick={() => inputRef.current?.click()} title="Import a design file">
        ⤓ Import file
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={onFile}
        style={{ display: "none" }}
      />
      {status && <div className="import-status muted small">{status}</div>}
      <div className="import-note muted small">
        Sketch · PDF supported. Figma needs a link + token (coming); OmniGraffle
        via the desktop app.
      </div>
    </div>
  );
}
