import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { createEmptyDocument } from "../model/document";
import { SketchImporter } from "./sketch";

/** Build a minimal but valid `.sketch` archive in memory for the importer. */
async function makeSketchZip(): Promise<Uint8Array> {
  const zip = new JSZip();
  const pageId = "PAGE-1";
  zip.file(
    "meta.json",
    JSON.stringify({ pagesAndArtboards: { [pageId]: { name: "Page 1" } } }),
  );
  zip.file("document.json", JSON.stringify({ pages: [{ _ref: `pages/${pageId}` }] }));
  // a tiny real PNG (1×1) so a bitmap layer resolves to a data URL
  zip.file("images/img1.png", "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", { base64: true });
  zip.file(
    `pages/${pageId}.json`,
    JSON.stringify({
      do_objectID: pageId,
      _class: "page",
      name: "Page 1",
      layers: [
        {
          do_objectID: "RECT-1",
          _class: "rectangle",
          name: "Box",
          frame: { _class: "rect", x: 10, y: 20, width: 100, height: 50 },
          fixedRadius: 6,
          rotation: 90, // Sketch degrees, clockwise-positive
          style: {
            fills: [{ isEnabled: true, color: { red: 1, green: 0, blue: 0, alpha: 1 } }],
            borders: [{ isEnabled: true, thickness: 2, color: { red: 0, green: 0, blue: 1, alpha: 1 } }],
            contextSettings: { opacity: 0.4 },
          },
        },
        {
          do_objectID: "TEXT-1",
          _class: "text",
          name: "Label",
          frame: { _class: "rect", x: 10, y: 90, width: 200, height: 24 },
          attributedString: {
            string: "Hello",
            attributes: [
              {
                attributes: {
                  MSAttributedStringFontAttribute: { attributes: { name: "Inter-SemiBold", size: 22 } },
                  MSAttributedStringColorAttribute: { red: 0, green: 0.5, blue: 1, alpha: 1 },
                },
              },
            ],
          },
        },
        {
          do_objectID: "BMP-1",
          _class: "bitmap",
          name: "Photo",
          frame: { _class: "rect", x: 10, y: 130, width: 120, height: 80 },
          image: { _class: "MSJSONFileReference", _ref_class: "MSImageData", _ref: "images/img1.png" },
        },
        {
          do_objectID: "PATH-1",
          _class: "shapePath",
          name: "Triangle",
          frame: { _class: "rect", x: 100, y: 100, width: 200, height: 100 },
          isClosed: true,
          points: [
            { _class: "curvePoint", point: "{0, 0}", hasCurveFrom: false, hasCurveTo: false },
            { _class: "curvePoint", point: "{1, 0}", hasCurveFrom: false, hasCurveTo: false },
            { _class: "curvePoint", point: "{0.5, 1}", hasCurveFrom: false, hasCurveTo: false },
          ],
        },
        {
          do_objectID: "GROUP-1",
          _class: "group",
          name: "Group",
          frame: { _class: "rect", x: 0, y: 0, width: 300, height: 200 },
          layers: [
            {
              do_objectID: "OVAL-1",
              _class: "oval",
              name: "Dot",
              frame: { _class: "rect", x: 5, y: 5, width: 20, height: 20 },
            },
          ],
        },
      ],
    }),
  );
  const buf = await zip.generateAsync({ type: "uint8array" });
  return buf;
}

describe("SketchImporter", () => {
  it("recognizes .sketch by extension and by ZIP magic", async () => {
    const imp = new SketchImporter();
    expect(imp.canImport({ filename: "x.sketch" })).toBe(true);
    const bytes = await makeSketchZip();
    expect(imp.canImport({ bytes })).toBe(true);
    expect(imp.canImport({ filename: "x.txt", bytes: new Uint8Array([1, 2, 3, 4]) })).toBe(false);
  });

  it("imports pages, layers, and a nested group into the document model", async () => {
    const imp = new SketchImporter();
    const bytes = await makeSketchZip();
    const { document, warnings } = await imp.import({ bytes, filename: "demo.sketch" });

    expect(document.importedFrom).toBe("sketch");
    expect(document.boards).toHaveLength(1);
    const board = document.boards[0];
    expect(board.name).toBe("Page 1");
    // rectangle + text + bitmap + shapePath + group at root
    expect(board.children).toHaveLength(5);

    const rect = document.nodes["RECT-1"];
    expect(rect.type).toBe("rectangle");
    expect(rect.frame).toEqual({ x: 10, y: 20, width: 100, height: 50 });
    expect((rect as any).cornerRadius).toBe(6);
    expect((rect as any).fills[0]).toEqual({ kind: "solid", color: "#ff0000" });
    // border → stroke, context opacity, and rotation (deg CW → rad CCW) carry through
    expect((rect as any).stroke).toEqual({ paint: { kind: "solid", color: "#0000ff" }, width: 2 });
    expect((rect as any).opacity).toBe(0.4);
    expect((rect as any).rotation).toBeCloseTo((-90 * Math.PI) / 180);

    const text = document.nodes["TEXT-1"];
    expect(text.type).toBe("text");
    expect((text as any).text).toBe("Hello");
    // real text attributes, not the hardcoded Inter/16/400
    expect((text as any).style.fontFamily).toBe("Inter");
    expect((text as any).style.fontSize).toBe(22);
    expect((text as any).style.fontWeight).toBe(600); // "SemiBold"
    expect((text as any).fills[0]).toEqual({ kind: "solid", color: "#0080ff" });

    // bitmap → a real image node with the embedded PNG as a data URL
    const bmp = document.nodes["BMP-1"];
    expect(bmp.type).toBe("image");
    expect((bmp as any).src).toMatch(/^data:image\/png;base64,/);

    // shapePath → an editable path node with absolute SVG d (normalized → scaled)
    const path = document.nodes["PATH-1"];
    expect(path.type).toBe("path");
    // point {0,0} of a 200×100 frame at (100,100) → M 100 100 ; {1,0} → L 300 100;
    // {0.5,1} → L 200 200; closed back to start + Z
    expect((path as any).d).toBe("M 100 100 L 300 100 L 200 200 L 100 100 Z");

    // nested oval reachable via the group frame's children
    const group = document.nodes["GROUP-1"];
    expect(group.type).toBe("frame");
    expect((group as any).children).toContain("OVAL-1");
    expect(document.nodes["OVAL-1"].type).toBe("ellipse");

    expect(warnings).toEqual([]);
  });

  it("a fresh document starts clean (no nodes) with the seeded pages", () => {
    const doc = createEmptyDocument("Fresh");
    expect(Object.keys(doc.nodes)).toHaveLength(0);
    // A fresh doc seeds the v2 pages (Onboarding/Settings/Marketing); the point is
    // it carries no imported NODES, not that it has exactly one board.
    expect(doc.boards).toHaveLength(3);
    expect(doc.boards.map((b) => b.name)).toContain("Onboarding");
  });
});
