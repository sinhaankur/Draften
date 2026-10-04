import { describe, it, expect } from "vitest";

import { createEmptyDocument } from "../model/document";
import { autoNameLayers, describeNode } from "./layer-namer";
import type { Node } from "../model/node";

const board = { width: 960, height: 540 };

function textNode(text: string, size: number, weight = 400, y = 100): Node {
  return { id: "t", type: "text", name: "Text", frame: { x: 72, y, width: 600, height: 30 }, text, fills: [{ kind: "solid", color: "#000" }], style: { fontFamily: "Inter", fontSize: size, fontWeight: weight, lineHeight: 1.4 } } as Node;
}

describe("describeNode", () => {
  it("calls a big top text a hero heading", () => {
    const d = describeNode(textNode("Welcome", 56, 700, 30), board);
    expect(d.name).toContain("Hero heading");
  });
  it("recognises a bullet", () => {
    expect(describeNode(textNode("• a point", 16), board).name).toContain("Bullet");
  });
  it("recognises a page number", () => {
    expect(describeNode(textNode("7", 12), board).name).toBe("Page number");
  });
  it("names a thin full-width rect an accent bar", () => {
    const r = { id: "r", type: "rectangle", name: "Rectangle", frame: { x: 0, y: 0, width: 960, height: 6 }, fills: [{ kind: "solid", color: "#3d6b5f" }] } as Node;
    expect(describeNode(r, board).name).toBe("Accent bar");
  });
  it("names a small square a bullet dot", () => {
    const r = { id: "r", type: "rectangle", name: "Rectangle", frame: { x: 72, y: 120, width: 8, height: 8 }, fills: [{ kind: "solid", color: "#000" }] } as Node;
    expect(describeNode(r, board).name).toBe("Bullet dot");
  });
  it("names a rounded rect a card/button", () => {
    const r = { id: "r", type: "rectangle", name: "Rectangle", frame: { x: 72, y: 120, width: 160, height: 44 }, fills: [{ kind: "solid", color: "#000" }], cornerRadius: 8 } as Node;
    expect(describeNode(r, board).name).toBe("Card / button");
  });
});

describe("autoNameLayers", () => {
  it("renames generic nodes across the document and counts changes", () => {
    const doc = createEmptyDocument("d");
    doc.nodes = {
      a: { id: "a", type: "text", name: "Text", frame: { x: 0, y: 0, width: 400, height: 60 }, text: "Big Title", fills: [], style: { fontFamily: "Inter", fontSize: 48, fontWeight: 700, lineHeight: 1.4 } } as never,
      b: { id: "b", type: "rectangle", name: "Rectangle", frame: { x: 0, y: 0, width: 960, height: 6 }, fills: [{ kind: "solid", color: "#333" }] } as never,
    };
    doc.boards = [{ id: "bd", name: "S", kind: "design", children: ["a", "b"], frame: { x: 0, y: 0, width: 960, height: 540 } }] as never;
    const n = autoNameLayers(doc);
    expect(n).toBe(2);
    expect(doc.nodes["b"].name).toBe("Accent bar");
  });
});
