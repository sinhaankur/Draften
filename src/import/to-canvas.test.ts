import { describe, expect, it } from "vitest";
import { documentToSkeleton } from "./to-canvas";
import { createEmptyDocument } from "../model/document";

describe("documentToSkeleton — imported doc → canvas", () => {
  it("converts frame, rect, ellipse and text nodes", () => {
    const doc = createEmptyDocument("test");
    doc.nodes = {
      f1: { id: "f1", type: "frame", name: "Artboard", frame: { x: 0, y: 0, width: 400, height: 300 }, fills: [{ kind: "solid", color: "#ffffff" }], children: ["r1", "t1"] } as never,
      r1: { id: "r1", type: "rectangle", name: "Box", frame: { x: 20, y: 20, width: 100, height: 40 }, fills: [{ kind: "solid", color: "#3d6b5f" }], cornerRadius: 8, parentId: "f1" } as never,
      t1: { id: "t1", type: "text", name: "Label", frame: { x: 20, y: 80, width: 200, height: 20 }, text: "Hello", fills: [{ kind: "solid", color: "#111111" }], style: { fontSize: 18 }, parentId: "f1" } as never,
    };
    const sk = documentToSkeleton(doc);
    expect(sk.length).toBe(3);
    const types = sk.map((s) => s.type);
    expect(types).toContain("rectangle");
    expect(types).toContain("text");
    // the text node keeps its content + size
    const text = sk.find((s) => s.type === "text") as Record<string, unknown>;
    expect(text.text).toBe("Hello");
    expect(text.fontSize).toBe(18);
  });

  it("carries stroke, opacity and rotation onto the canvas element", () => {
    const doc = createEmptyDocument("test");
    doc.nodes = {
      r1: {
        id: "r1", type: "rectangle", name: "Box",
        frame: { x: 0, y: 0, width: 100, height: 40 },
        fills: [{ kind: "solid", color: "#3d6b5f" }],
        stroke: { paint: { kind: "solid", color: "#ff0000" }, width: 3 },
        opacity: 0.5, rotation: Math.PI / 4,
      } as never,
    };
    const [rect] = documentToSkeleton(doc) as Array<Record<string, unknown>>;
    expect(rect.strokeColor).toBe("#ff0000");
    expect(rect.strokeWidth).toBe(3);
    expect(rect.opacity).toBe(50); // 0..1 → 0..100
    expect(rect.angle).toBeCloseTo(Math.PI / 4);
  });

  it("approximates a linear gradient fill as its middle stop", () => {
    const doc = createEmptyDocument("test");
    doc.nodes = {
      r1: {
        id: "r1", type: "rectangle", name: "Grad",
        frame: { x: 0, y: 0, width: 100, height: 40 },
        fills: [{ kind: "linear", angle: 90, stops: [{ offset: 0, color: "#000000" }, { offset: 1, color: "#ffffff" }] }],
      } as never,
    };
    const [rect] = documentToSkeleton(doc) as Array<Record<string, unknown>>;
    expect(rect.backgroundColor).toBe("#000000"); // mid of a 2-stop gradient
  });

  it("renders an image node as a labelled placeholder box", () => {
    const doc = createEmptyDocument("test");
    doc.nodes = {
      i1: { id: "i1", type: "image", name: "Avatar", frame: { x: 0, y: 0, width: 80, height: 80 }, src: "figma://image/abc" } as never,
    };
    const sk = documentToSkeleton(doc) as Array<Record<string, unknown>>;
    expect(sk.map((s) => s.type)).toEqual(["rectangle", "text"]);
    expect(sk[1].text).toBe("Avatar");
  });

  it("flattens child coordinates to world space (parent offset added)", () => {
    const doc = createEmptyDocument("test");
    doc.nodes = {
      f1: { id: "f1", type: "frame", name: "F", frame: { x: 100, y: 100, width: 200, height: 200 }, fills: [{ kind: "none" }], children: ["r1"] } as never,
      r1: { id: "r1", type: "rectangle", name: "R", frame: { x: 10, y: 10, width: 50, height: 50 }, fills: [{ kind: "solid", color: "#000000" }], parentId: "f1" } as never,
    };
    const sk = documentToSkeleton(doc);
    const rect = sk.find((s) => (s as { width?: number }).width === 50) as Record<string, number>;
    expect(rect.x).toBe(110); // 100 (parent) + 10 (child)
    expect(rect.y).toBe(110);
  });
});
