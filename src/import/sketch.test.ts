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
          style: { fills: [{ isEnabled: true, color: { red: 1, green: 0, blue: 0, alpha: 1 } }] },
        },
        {
          do_objectID: "TEXT-1",
          _class: "text",
          name: "Label",
          frame: { _class: "rect", x: 10, y: 90, width: 200, height: 24 },
          attributedString: { string: "Hello" },
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
    // rectangle + text + group at root
    expect(board.children).toHaveLength(3);

    const rect = document.nodes["RECT-1"];
    expect(rect.type).toBe("rectangle");
    expect(rect.frame).toEqual({ x: 10, y: 20, width: 100, height: 50 });
    expect((rect as any).cornerRadius).toBe(6);
    expect((rect as any).fills[0]).toEqual({ kind: "solid", color: "#ff0000" });

    const text = document.nodes["TEXT-1"];
    expect(text.type).toBe("text");
    expect((text as any).text).toBe("Hello");

    // nested oval reachable via the group frame's children
    const group = document.nodes["GROUP-1"];
    expect(group.type).toBe("frame");
    expect((group as any).children).toContain("OVAL-1");
    expect(document.nodes["OVAL-1"].type).toBe("ellipse");

    expect(warnings).toEqual([]);
  });

  it("does not mutate an unrelated empty document", () => {
    const doc = createEmptyDocument("Fresh");
    expect(Object.keys(doc.nodes)).toHaveLength(0);
    expect(doc.boards).toHaveLength(1);
  });
});
