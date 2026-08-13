/**
 * PDF importer (stub) — brings a PDF in as boards you can explore + edit.
 *
 * PDF is a common "here's the design" hand-off format, so importing it is
 * first-class. Each page becomes a board; extracted vector paths + text + images
 * become nodes. Full extraction needs a PDF engine (pdf.js on the web, or the
 * Rust side for speed on desktop) — this stub establishes the contract + page→
 * board mapping so the engine wiring is a drop-in, and the pipeline already
 * recognises `.pdf`.
 */

import { createEmptyDocument } from "../model/document";
import type { ImportInput, ImportResult, Importer } from "./importer";

export class PdfImporter implements Importer {
  id = "pdf";
  label = "PDF (.pdf)";
  extensions = [".pdf"];

  canImport(input: ImportInput): boolean {
    if (input.filename?.toLowerCase().endsWith(".pdf")) return true;
    // "%PDF-" magic
    const b = input.bytes;
    return (
      !!b &&
      b.length > 5 &&
      b[0] === 0x25 &&
      b[1] === 0x50 &&
      b[2] === 0x44 &&
      b[3] === 0x46 &&
      b[4] === 0x2d
    );
  }

  async import(input: ImportInput): Promise<ImportResult> {
    if (!input.bytes) throw new Error("PDF import needs file bytes");
    const name = input.filename?.replace(/\.pdf$/i, "") ?? "PDF import";
    const doc = createEmptyDocument(name);
    doc.importedFrom = "native"; // becomes "pdf" once ImportSource is extended

    // The stub creates one board and reports what full extraction will add. The
    // page→board loop plugs in here once the PDF engine (pdf.js / Rust) lands:
    // for each page → new board (kind "design"), extract text runs → text nodes,
    // vector ops → path nodes, XObject images → image nodes, at page coordinates.
    doc.boards[0].name = "Page 1";

    return {
      document: doc,
      warnings: [
        "PDF import is a stub: the file was recognised and a page board created, " +
          "but vector/text extraction is not wired yet (needs the PDF engine). " +
          "Each PDF page will become an editable board.",
      ],
    };
  }
}
