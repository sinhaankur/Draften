import { describe, it, expect } from "vitest";

import { extractNodes, type OperatorList, type OpsMap } from "./extract";
import { IDENTITY } from "./geometry";

// Real pdf.js v6 OPS codes for the operators we use.
const OPS: OpsMap = {
  save: 10, restore: 11, transform: 12,
  constructPath: 91,
  fill: 22, stroke: 20, eoFill: 23, fillStroke: 24, eoFillStroke: 25,
  setFillRGBColor: 59, setStrokeRGBColor: 58,
  setFillGray: 57, setStrokeGray: 56,
  setFillCMYKColor: 65, setStrokeCMYKColor: 64,
  setFillColorN: 63, setStrokeColorN: 62,
  setLineWidth: 2, setDash: 4, setGState: 9,
  paintImageXObject: 85, paintInlineImageXObject: 86,
};

describe("extractNodes", () => {
  it("emits a rect for a filled rect and a path for a stroked polyline", () => {
    const ol: OperatorList = {
      fnArray: [OPS.setFillRGBColor, OPS.constructPath, OPS.setStrokeRGBColor, OPS.setLineWidth, OPS.constructPath],
      argsArray: [
        ["#ff0000"],
        [OPS.fill, [[0, 100, 100, 1, 300, 100, 1, 300, 220, 1, 100, 220, 4]], {}],
        ["#0000ff"],
        [3],
        [OPS.stroke, [[0, 50, 600, 1, 400, 650, 1, 300, 500]], {}],
      ],
    };
    let i = 0;
    const nodes = extractNodes(ol, OPS, { baseCtm: IDENTITY, pageHeight: 792, mkId: () => `n${++i}` });
    expect(nodes).toHaveLength(2);
    expect(nodes[0].type).toBe("rect");
    expect((nodes[0] as any).fill).toEqual({ kind: "solid", color: "#ff0000" });
    expect(nodes[1].type).toBe("path");
    expect((nodes[1] as any).stroke.color).toBe("#0000ff");
    expect((nodes[1] as any).stroke.width).toBe(3);
  });

  it("reads gray + CMYK fills (key gap)", () => {
    const ol: OperatorList = {
      fnArray: [OPS.setFillGray, OPS.constructPath, OPS.setFillCMYKColor, OPS.constructPath],
      argsArray: [
        [0.5],
        [OPS.fill, [[0, 0, 0, 1, 10, 0, 1, 10, 10, 1, 0, 10, 4]], {}],
        [0, 1, 1, 0], // red
        [OPS.fill, [[0, 20, 0, 1, 30, 0, 1, 30, 10, 1, 20, 10, 4]], {}],
      ],
    };
    let i = 0;
    const nodes = extractNodes(ol, OPS, { baseCtm: IDENTITY, pageHeight: 0, mkId: () => `n${++i}` });
    expect((nodes[0] as any).fill.color).toBe("#808080");
    expect((nodes[1] as any).fill.color).toBe("#ff0000");
  });

  it("reads fill-alpha opacity from setGState, and dashes from setDash", () => {
    const ol: OperatorList = {
      fnArray: [OPS.setGState, OPS.setDash, OPS.setStrokeRGBColor, OPS.constructPath],
      argsArray: [
        [[["ca", 0.4]]],
        [[3, 2]],
        ["#000000"],
        [OPS.fillStroke, [[0, 0, 0, 1, 10, 0, 1, 10, 10, 1, 0, 10, 4]], {}],
      ],
    };
    const [node] = extractNodes(ol, OPS, { baseCtm: IDENTITY, pageHeight: 0 });
    expect((node as any).fill.opacity).toBe(0.4);
    expect((node as any).stroke.dash).toEqual([3, 2]);
  });

  it("honours save/restore for colour state", () => {
    const ol: OperatorList = {
      fnArray: [OPS.setFillRGBColor, OPS.save, OPS.setFillRGBColor, OPS.constructPath, OPS.restore, OPS.constructPath],
      argsArray: [
        ["#111111"], [], ["#22ff22"],
        [OPS.fill, [[0, 0, 0, 1, 10, 0, 1, 10, 10, 1, 0, 10, 4]], {}],
        [],
        [OPS.fill, [[0, 20, 20, 1, 40, 20, 1, 40, 40, 1, 20, 40, 4]], {}],
      ],
    };
    let i = 0;
    const nodes = extractNodes(ol, OPS, { baseCtm: IDENTITY, pageHeight: 0, mkId: () => `n${++i}` });
    expect((nodes[0] as any).fill.color).toBe("#22ff22");
    expect((nodes[1] as any).fill.color).toBe("#111111");
  });
});
