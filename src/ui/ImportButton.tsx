import { useRef, useState } from "react";

import { importers } from "../import/importer";
import { figmaFileKey } from "../import/figma";
import type { DraftenDocument } from "../model/document";
import { useEditor } from "../state/store";
import { documentToSkeleton } from "../import/to-canvas";
import { drawSkeletonOnCanvas } from "../canvas/apply-action";

/**
 * Import entry — makes the registered importers actually reachable.
 *
 * Two paths, because the sources differ:
 *   • FILE import (Sketch · PDF · Word) — a file picker; the registry picks the
 *     importer by extension/magic, runs it, loads + draws the result.
 *   • FIGMA import — Figma has no local file format we can parse, so it's the
 *     official REST API: paste the file URL + a personal access token, and the
 *     FigmaImporter reads the document. The token is remembered on-device.
 * Both surface fidelity warnings honestly, and never fake a result.
 */
const FIGMA_TOKEN_KEY = "draften-figma-token";

export function ImportButton() {
  const loadDocument = useEditor((s) => s.loadDocument);
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [figmaOpen, setFigmaOpen] = useState(false);
  const [figUrl, setFigUrl] = useState("");
  const [figToken, setFigToken] = useState(() => { try { return localStorage.getItem(FIGMA_TOKEN_KEY) || ""; } catch { return ""; } });
  const [busy, setBusy] = useState(false);

  const accept = importers.all().filter((i) => !i.apiBased).flatMap((i) => i.extensions).join(",");

  const place = async (document: DraftenDocument, warnings: string[], label: string) => {
    loadDocument(document);
    const drew = await drawSkeletonOnCanvas(documentToSkeleton(document));
    const nodeCount = Object.keys(document.nodes).length;
    setStatus(warnings.length
      ? `Imported ${label} · ${nodeCount} layers · ${warnings[0]}`
      : `Imported ${label} · ${nodeCount} layers${drew ? " ✓" : ""}`);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("Reading…");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const input = { bytes, filename: file.name };
      const importer = importers.pick(input);
      if (!importer) { setStatus(`No importer for "${file.name}". Supported: ${accept || "—"}.`); return; }
      const { document, warnings } = await importer.import(input);
      await place(document, warnings, file.name);
    } catch (err) {
      setStatus(`Import failed: ${(err as Error).message}`);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const onFigma = async () => {
    const key = figmaFileKey(figUrl);
    if (!key) { setStatus("Paste a Figma file URL (figma.com/design/… or /file/…)."); return; }
    if (!figToken.trim()) { setStatus("Paste a Figma personal access token."); return; }
    try { localStorage.setItem(FIGMA_TOKEN_KEY, figToken.trim()); } catch { /* ok */ }
    setBusy(true); setStatus("Reading from Figma…");
    try {
      const importer = importers.all().find((i) => i.id === "figma");
      if (!importer) { setStatus("Figma importer unavailable."); return; }
      const { document, warnings } = await importer.import({ api: { token: figToken.trim(), fileKey: key } });
      await place(document, warnings, document.name || "Figma file");
      setFigmaOpen(false); setFigUrl("");
    } catch (err) {
      setStatus(`Figma import failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="import-wrap">
      <button className="row small" onClick={() => inputRef.current?.click()}
        title="Import a design file — Sketch · PDF · Word. OmniGraffle via the desktop app.">
        ⤓ Import file
      </button>
      <button className="row small" onClick={() => setFigmaOpen((v) => !v)} title="Import a Figma file via link + token">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>◆ Import from Figma</span>
      </button>

      {figmaOpen && (
        <div style={{ border: "1px solid var(--line, #e7e6e2)", borderRadius: 9, padding: 10, marginTop: 6, background: "var(--surf, #fff)" }}>
          <input value={figUrl} onChange={(e) => setFigUrl(e.target.value)} placeholder="Figma file URL"
            onPaste={(e) => { e.stopPropagation(); setFigUrl(e.clipboardData.getData("text").trim()); e.preventDefault(); }}
            style={fieldStyle} />
          <input value={figToken} type="password" autoComplete="off" placeholder="Personal access token"
            onChange={(e) => setFigToken(e.target.value)}
            onPaste={(e) => { e.stopPropagation(); setFigToken(e.clipboardData.getData("text").trim()); e.preventDefault(); }}
            style={{ ...fieldStyle, marginTop: 6 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <button className="ai-btn" style={{ padding: "6px 12px" }} disabled={busy} onClick={onFigma}>{busy ? "Reading…" : "Import"}</button>
            <a href="https://www.figma.com/developers/api#access-tokens" target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "var(--accent, #3d6b5f)" }}>Get a token →</a>
          </div>
        </div>
      )}

      <input ref={inputRef} type="file" accept={accept} onChange={onFile} style={{ display: "none" }} />
      {status && <div className="import-status muted small">{status}</div>}
    </div>
  );
}

const fieldStyle: React.CSSProperties = {
  width: "100%", borderRadius: 7, border: "1px solid var(--line, #e7e6e2)",
  padding: "7px 9px", fontSize: 12.5, background: "var(--canvas, #efeeeb)", color: "var(--t1, #1d1d1b)",
};
