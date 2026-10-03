import { afterEach, describe, expect, it, vi } from "vitest";
import { DocxImporter } from "./docx";

afterEach(() => vi.restoreAllMocks());

describe("DocxImporter", () => {
  const imp = new DocxImporter();

  it("recognises .docx by extension + zip magic", () => {
    const zipMagic = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]);
    expect(imp.canImport({ filename: "spec.docx", bytes: zipMagic })).toBe(true);
    expect(imp.canImport({ filename: "notes.txt", bytes: zipMagic })).toBe(false);
  });

  it("extracts headings + paragraphs into positioned text nodes", async () => {
    // stub mammoth so we don't need a real .docx binary
    vi.doMock("mammoth", () => ({
      convertToHtml: async () => ({
        value: "<h1>Product brief</h1><p>Draften lives in your repo.</p><li>Local-first</li>",
        messages: [],
      }),
    }));
    // re-import so the mock applies
    const { DocxImporter: Fresh } = await import("./docx");
    const res = await new Fresh().import({ filename: "brief.docx", bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04]) });

    const nodes = Object.values(res.document.nodes);
    expect(nodes.length).toBe(3);
    const texts = nodes.map((n) => (n as { text: string }).text);
    expect(texts).toContain("Product brief");
    expect(texts).toContain("Draften lives in your repo.");
    expect(texts.some((t) => t.startsWith("• Local-first"))).toBe(true); // list bullet

    // the heading is larger + bolder than the paragraph
    const h = nodes.find((n) => (n as { text: string }).text === "Product brief") as { style: { fontSize: number; fontWeight: number } };
    const p = nodes.find((n) => (n as { text: string }).text.startsWith("Draften")) as { style: { fontSize: number } };
    expect(h.style.fontSize).toBeGreaterThan(p.style.fontSize);
    expect(h.style.fontWeight).toBe(600);

    // one board holding them all, named after the file
    expect(res.document.boards).toHaveLength(1);
    expect(res.document.boards[0].children.length).toBe(3);
    expect(res.warnings.some((w) => /3 blocks/.test(w))).toBe(true);
  });

  it("warns honestly when the document has no text", async () => {
    vi.doMock("mammoth", () => ({ convertToHtml: async () => ({ value: "", messages: [] }) }));
    const { DocxImporter: Fresh } = await import("./docx");
    const res = await new Fresh().import({ filename: "empty.docx", bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04]) });
    expect(res.warnings.some((w) => /No text/.test(w))).toBe(true);
  });
});
