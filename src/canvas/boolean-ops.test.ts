import { describe, it, expect } from "vitest";

import { booleanCombine, elementToRing, type GeomEl } from "./boolean-ops";

const rect = (x: number, y: number, w: number, h: number): GeomEl => ({
  id: `r-${x}-${y}`, type: "rectangle", x, y, width: w, height: h, backgroundColor: "#3d6b5f",
});

describe("elementToRing", () => {
  it("turns a rectangle into its 4 corners", () => {
    const ring = elementToRing(rect(0, 0, 10, 10));
    expect(ring).toEqual([[0, 0], [10, 0], [10, 10], [0, 10]]);
  });
  it("samples an ellipse into many points", () => {
    const ring = elementToRing({ id: "e", type: "ellipse", x: 0, y: 0, width: 10, height: 10 });
    expect(ring.length).toBeGreaterThan(16);
  });
});

describe("booleanCombine", () => {
  const a = rect(0, 0, 10, 10);
  const b = rect(5, 0, 10, 10); // overlaps a on the right half

  it("union of two overlapping rects spans the full width", () => {
    const res = booleanCombine([a, b], "union")!;
    expect(res).toBeTruthy();
    const xs = res.paths[0].map((p) => p[0]);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(15);
  });

  it("intersect keeps only the overlap (x 5..10)", () => {
    const res = booleanCombine([a, b], "intersect")!;
    const xs = res.paths[0].map((p) => p[0]);
    expect(Math.min(...xs)).toBe(5);
    expect(Math.max(...xs)).toBe(10);
  });

  it("intersect of non-overlapping shapes is null", () => {
    const far = rect(100, 100, 10, 10);
    expect(booleanCombine([a, far], "intersect")).toBeNull();
  });

  it("subtract cuts b out of a (left half remains)", () => {
    const res = booleanCombine([a, b], "subtract")!;
    const xs = res.paths[0].map((p) => p[0]);
    expect(Math.max(...xs)).toBeLessThanOrEqual(5);
  });

  it("needs at least two shapes", () => {
    expect(booleanCombine([a], "union")).toBeNull();
  });
});
