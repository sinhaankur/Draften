import { describe, it, expect } from "vitest";

import { averageGap, distribute, edgeDistances, rectGap, snapToScale, type Box } from "./measure";

const box = (x: number, y: number, width = 40, height = 40): Box => ({ x, y, width, height });

describe("rectGap", () => {
  it("measures the horizontal gap between side-by-side boxes", () => {
    const g = rectGap(box(0, 0), box(60, 5)); // 40-wide at 0 → right edge 40; next at x=60
    expect(g.axis).toBe("x");
    expect(g.dx).toBe(20); // 60 - 40
  });
  it("measures the vertical gap between stacked boxes", () => {
    const g = rectGap(box(0, 0), box(5, 100));
    expect(g.axis).toBe("y");
    expect(g.dy).toBe(60); // 100 - 40
  });
  it("clamps overlap to zero", () => {
    expect(rectGap(box(0, 0), box(10, 0)).dx).toBe(0);
  });
});

describe("edgeDistances", () => {
  it("gives distances to the frame's inner edges", () => {
    const frame = box(0, 0, 200, 300);
    const el = box(20, 30, 100, 40);
    expect(edgeDistances(el, frame)).toEqual({ left: 20, top: 30, right: 80, bottom: 230 });
  });
});

describe("distribute (auto spacing)", () => {
  it("spaces boxes evenly with a fixed gap, preserving order + first position", () => {
    const boxes = [
      { id: "a", ...box(0, 0, 50, 20) },
      { id: "c", ...box(300, 0, 50, 20) },
      { id: "b", ...box(120, 0, 50, 20) },
    ];
    const out = distribute(boxes, "horizontal", 10);
    expect(out["a"].x).toBe(0);           // first stays
    expect(out["b"].x).toBe(60);          // 0 + 50 + 10
    expect(out["c"].x).toBe(120);         // 60 + 50 + 10
  });

  it("uses the average current gap when none is given", () => {
    const boxes = [
      { id: "a", ...box(0, 0, 40, 20) },
      { id: "b", ...box(60, 0, 40, 20) },  // gap 20
      { id: "c", ...box(140, 0, 40, 20) }, // gap 40
    ];
    const out = distribute(boxes, "horizontal"); // avg gap = 30
    expect(out["b"].x).toBe(70);  // 0 + 40 + 30
    expect(out["c"].x).toBe(140); // 70 + 40 + 30
  });

  it("returns nothing for fewer than two boxes", () => {
    expect(distribute([{ id: "a", ...box(0, 0) }], "horizontal")).toEqual({});
  });
});

describe("averageGap + snapToScale", () => {
  it("averages consecutive gaps", () => {
    expect(averageGap([box(0, 0, 10), box(20, 0, 10), box(50, 0, 10)], "horizontal")).toBe(15); // gaps 10, 20
  });
  it("snaps to an 8-grid", () => {
    expect(snapToScale(21)).toBe(24);
    expect(snapToScale(11)).toBe(8);
  });
});
