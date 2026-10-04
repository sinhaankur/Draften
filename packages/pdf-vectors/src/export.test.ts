import { describe, it, expect } from "vitest";

import { exportPdf, pathDToPdf } from "./export";
import type { PDFDoc } from "./model";

const sample: PDFDoc = {
  title: "Round Trip",
  pages: [{
    width: 612, height: 792, background: "#ffffff",
    nodes: [
      { id: "r", type: "rect", frame: { x: 100, y: 100, width: 200, height: 120 }, fill: { kind: "solid", color: "#ff0000" } },
      { id: "p", type: "path", frame: { x: 50, y: 500, width: 350, height: 150 }, d: "M 50 600 L 400 650 L 300 500", fill: { kind: "none" }, stroke: { color: "#0000ff", width: 3 } },
      { id: "t", type: "text", frame: { x: 72, y: 72, width: 300, height: 30 }, text: "Hello Editable", fontSize: 24, fontFamily: "Helvetica", fontWeight: 700, color: "#000000" },
    ],
  }],
};

function asText(bytes: Uint8Array): string {
  let s = ""; for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]); return s;
}

describe("exportPdf — structure", () => {
  const bytes = exportPdf(sample);
  const txt = asText(bytes);

  it("is a valid PDF file (header, catalog, xref, EOF)", () => {
    expect(txt.startsWith("%PDF-1.")).toBe(true);
    expect(txt).toContain("/Type /Catalog");
    expect(txt).toContain("/Type /Pages");
    expect(txt).toContain("/Type /Page ");
    expect(txt).toContain("xref");
    expect(txt.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("emits the page size, a red fill, a blue stroke and the text", () => {
    expect(txt).toContain("/MediaBox [0 0 612 792]");
    expect(txt).toContain("1 0 0 rg"); // red fill
    expect(txt).toContain("0 0 1 RG"); // blue stroke
    expect(txt).toContain("3 w");       // stroke width
    expect(txt).toContain("(Hello Editable) Tj");
    expect(txt).toContain("/F2 24 Tf"); // bold font at size 24
  });

  it("flips Y to PDF bottom-left (rect at top-left y=100 on an 792 page)", () => {
    // rect height 120, py = 792 - 100 - 120 = 572
    expect(txt).toContain("100 572 200 120 re");
  });
});

describe("pathDToPdf", () => {
  it("converts M/L to PDF ops with Y flipped", () => {
    expect(pathDToPdf("M 50 600 L 400 650", 792)).toBe("50 192 m\n400 142 l");
  });
  it("promotes a quadratic to a cubic", () => {
    const out = pathDToPdf("M 0 0 Q 10 10 20 0", 0);
    expect(out).toContain(" c"); // became a cubic
  });
});
