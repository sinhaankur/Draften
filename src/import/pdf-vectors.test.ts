import { describe, it, expect } from "vitest";

import {
  IDENTITY,
  apply,
  extractNodes,
  isRectangle,
  mul,
  parseSegmentBuffer,
  segmentBounds,
  segmentsToPathD,
  type OperatorList,
  type OpsMap,
} from "./pdf-vectors";

// The real pdf.js v6 OPS codes we depend on (observed from a live getOperatorList).
const OPS: OpsMap = {
  save: 10, restore: 11, transform: 12,
  constructPath: 91,
  fill: 22, stroke: 20, eoFill: 23, fillStroke: 24, eoFillStroke: 25,
  setFillRGBColor: 59, setStrokeRGBColor: 58,
  setLineWidth: 2,
};

describe("matrix helpers", () => {
  it("identity leaves a point unchanged", () => {
    expect(apply(IDENTITY, 5, 7)).toEqual([5, 7]);
  });
  it("translation + scale compose", () => {
    const m = mul([2, 0, 0, 2, 10, 20], IDENTITY); // scale 2, translate (10,20)
    expect(apply(m, 1, 1)).toEqual([12, 22]);
  });
});

describe("parseSegmentBuffer", () => {
  it("parses a closed rectangle (move + 3 lines + close), flipping Y", () => {
    // op-tagged: 0=move 1=line 4=close ; coords in user space
    const buf = [0, 100, 100, 1, 300, 100, 1, 300, 220, 1, 100, 220, 4];
    const segs = parseSegmentBuffer(buf, IDENTITY, 792); // page height 792 → flip
    expect(segs.map((s) => s.op)).toEqual(["M", "L", "L", "L", "Z"]);
    // first point: (100,100) → y flipped to 792-100 = 692
    expect(segs[0].pts).toEqual([100, 692]);
    expect(isRectangle(segs)).toBe(true);
  });

  it("parses an open polyline (not a rectangle)", () => {
    const buf = [0, 50, 600, 1, 400, 650, 1, 300, 500];
    const segs = parseSegmentBuffer(buf, IDENTITY, 0); // no flip
    expect(segs.map((s) => s.op)).toEqual(["M", "L", "L"]);
    expect(isRectangle(segs)).toBe(false);
  });

  it("parses a cubic bezier", () => {
    const buf = [0, 0, 0, 2, 1, 1, 2, 1, 3, 0];
    const segs = parseSegmentBuffer(buf, IDENTITY, 0);
    expect(segs[1].op).toBe("C");
    expect(segs[1].pts).toEqual([1, 1, 2, 1, 3, 0]);
  });
});

describe("segment geometry", () => {
  it("bounds a shape", () => {
    const segs = parseSegmentBuffer([0, 10, 10, 1, 40, 60], IDENTITY, 0);
    expect(segmentBounds(segs)).toEqual({ x: 10, y: 10, width: 30, height: 50 });
  });
  it("emits an SVG d string", () => {
    const segs = parseSegmentBuffer([0, 0, 0, 1, 10, 10, 4], IDENTITY, 0);
    expect(segmentsToPathD(segs)).toBe("M 0 0 L 10 10 Z");
  });
});

describe("extractNodes — operator list → editable nodes", () => {
  // Mirrors a real page: red filled rect, then a blue stroked polyline.
  const ol: OperatorList = {
    fnArray: [OPS.setFillRGBColor, OPS.constructPath, OPS.setStrokeRGBColor, OPS.setLineWidth, OPS.constructPath],
    argsArray: [
      ["#ff0000"],
      [OPS.fill, [[0, 100, 100, 1, 300, 100, 1, 300, 220, 1, 100, 220, 4]], { 0: 100, 1: 100, 2: 300, 3: 220 }],
      ["#0000ff"],
      [3],
      [OPS.stroke, [[0, 50, 600, 1, 400, 650, 1, 300, 500]], { 0: 50, 1: 500, 2: 400, 3: 650 }],
    ],
  };

  it("emits an editable rectangle for a filled rect and a path for a stroke", () => {
    let i = 0;
    const nodes = extractNodes(ol, OPS, { baseCtm: IDENTITY, pageHeight: 792, parentId: "board1", mkId: () => `n${++i}` });
    expect(nodes).toHaveLength(2);

    const rect = nodes[0];
    expect(rect.type).toBe("rectangle");
    expect((rect as any).fills[0]).toEqual({ kind: "solid", color: "#ff0000" });
    expect(rect.parentId).toBe("board1");
    expect(Math.round(rect.frame.width)).toBe(200); // 300-100

    const path = nodes[1];
    expect(path.type).toBe("path");
    expect((path as any).stroke.paint.color).toBe("#0000ff");
    expect((path as any).stroke.width).toBe(3);
    expect((path as any).d).toContain("M "); // real path data
  });

  it("honours save/restore for colour + transform state", () => {
    const nested: OperatorList = {
      fnArray: [OPS.setFillRGBColor, OPS.save, OPS.setFillRGBColor, OPS.constructPath, OPS.restore, OPS.constructPath],
      argsArray: [
        ["#111111"],
        [],
        ["#22ff22"],
        [OPS.fill, [[0, 0, 0, 1, 10, 0, 1, 10, 10, 1, 0, 10, 4]], {}],
        [],
        [OPS.fill, [[0, 20, 20, 1, 40, 20, 1, 40, 40, 1, 20, 40, 4]], {}],
      ],
    };
    let i = 0;
    const nodes = extractNodes(nested, OPS, { baseCtm: IDENTITY, pageHeight: 0, mkId: () => `n${++i}` });
    expect((nodes[0] as any).fills[0].color).toBe("#22ff22"); // inside save/restore
    expect((nodes[1] as any).fills[0].color).toBe("#111111"); // restored
  });
});
