/**
 * Word importer — brings a .docx in as an editable board (REAL extraction).
 *
 * Word is the other common "here's the spec/content" hand-off, so alongside PDF it
 * imports first-class. A .docx is a zip of XML; mammoth extracts the document's
 * structured content (headings + paragraphs). We lay each block out top-to-bottom
 * as a text node on one board — real, editable content the AI assistant can then
 * turn into a design. Headings get a larger size so structure survives.
 *
 * © Ankur Sinha.
 */

import { createEmptyDocument } from "../model/document";
import type { DraftenDocument } from "../model/document";
import type { ImportInput, ImportResult, Importer } from "./importer";

export class DocxImporter implements Importer {
  id = "docx";
  label = "Word (.docx)";
  extensions = [".docx"];

  canImport(input: ImportInput): boolean {
    if (input.filename?.toLowerCase().endsWith(".docx")) return true;
    // .docx is a zip: "PK\x03\x04" magic
    const b = input.bytes;
    return !!b && b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04
      && (input.filename?.toLowerCase().endsWith(".docx") ?? false);
  }

  async import(input: ImportInput): Promise<ImportResult> {
    if (!input.bytes) throw new Error("Word import needs file bytes");
    const name = input.filename?.replace(/\.docx$/i, "") ?? "Word import";
    const doc = createEmptyDocument(name);
    doc.boards = [];
    doc.nodes = {};
    doc.importedFrom = "native";
    const warnings: string[] = [];

    // mammoth → semantic HTML, so we keep heading vs paragraph structure.
    const mammoth = await import("mammoth");
    const arrayBuffer = input.bytes instanceof Uint8Array
      ? input.bytes.buffer.slice(input.bytes.byteOffset, input.bytes.byteOffset + input.bytes.byteLength)
      : input.bytes;
    const { value: html, messages } = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer as ArrayBuffer });
    for (const m of messages) if (m.type === "warning") warnings.push(m.message);

    // parse the HTML into ordered blocks (tag + text) without a DOM dependency
    const blocks = [...html.matchAll(/<(h[1-6]|p|li)[^>]*>([\s\S]*?)<\/\1>/gi)]
      .map((m) => ({ tag: m[1].toLowerCase(), text: stripTags(m[2]).trim() }))
      .filter((b) => b.text);

    const boardId = crypto.randomUUID();
    const children: string[] = [];
    let y = 48;
    const W = 680;
    for (const b of blocks) {
      const isH = b.tag.startsWith("h");
      const level = isH ? Number(b.tag[1]) : 0;
      const fontSize = isH ? Math.max(18, 34 - (level - 1) * 4) : 15;
      const id = crypto.randomUUID();
      doc.nodes[id] = {
        id, type: "text", name: b.text.slice(0, 40),
        frame: { x: 48, y, width: W, height: fontSize * 1.4 * Math.max(1, Math.ceil(b.text.length / 90)) },
        text: b.tag === "li" ? `• ${b.text}` : b.text,
        style: { fontFamily: "Inter", fontSize, fontWeight: isH ? 600 : 400, lineHeight: 1.4, align: "left" },
        parentId: boardId,
      } as DraftenDocument["nodes"][string];
      children.push(id);
      y += fontSize * 1.4 * Math.max(1, Math.ceil(b.text.length / 90)) + (isH ? 16 : 10);
    }

    doc.boards.push({
      id: boardId, name: name || "Document", kind: "design", children,
      viewport: { x: 0, y: 0, zoom: 1 },
      frame: { x: 0, y: 0, width: W + 96, height: Math.max(600, y + 48) },
    } as DraftenDocument["boards"][number]);

    if (!children.length) {
      warnings.push("No text content found in the document.");
    } else {
      warnings.push(`Imported ${children.length} blocks from the Word document.`);
    }
    return { document: doc, warnings };
  }
}

/** Strip HTML tags + decode the few entities mammoth emits, to plain text. */
function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}
