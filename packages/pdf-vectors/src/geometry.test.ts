import { describe, it, expect } from "vitest";

import {
  IDENTITY, apply, avgScale, isRectangle, mul,
  parseSegmentBuffer, segmentBounds, segmentsToPathD,
} from "./geometry";

describe("matrix", () => {
  it("identity is a no-op", () => expect(apply(IDENTITY, 3, 4)).toEqual([3, 4]));
  it("scale+translate composes", () => {
    const m = mul([2, 0, 0, 2, 10, 20], IDENTITY);
    expect(apply(m, 1, 1)).toEqual([12, 22]);
  });
  it("avgScale of a 2x matrix is 2", () => expect(avgScale([2, 0, 0, 2, 0, 0])).toBe(2));
});

describe("parseSegmentBuffer", () => {
  it("parses a closed rect and flips Y", () => {
    const segs = parseSegmentBuffer([0, 100, 100, 1, 300, 100, 1, 300, 220, 1, 100, 220, 4], IDENTITY, 792);
    expect(segs.map((s) => s.op)).toEqual(["M", "L", "L", "L", "Z"]);
    expect(segs[0].pts).toEqual([100, 692]);
    expect(isRectangle(segs)).toBe(true);
  });
  it("parses an open polyline (not a rect)", () => {
    const segs = parseSegmentBuffer([0, 50, 600, 1, 400, 650, 1, 300, 500], IDENTITY, 0);
    expect(isRectangle(segs)).toBe(false);
  });
  it("parses a cubic", () => {
    const segs = parseSegmentBuffer([0, 0, 0, 2, 1, 1, 2, 1, 3, 0], IDENTITY, 0);
    expect(segs[1].op).toBe("C");
    expect(segs[1].pts).toEqual([1, 1, 2, 1, 3, 0]);
  });
});

describe("geometry derived", () => {
  it("bounds", () => expect(segmentBounds(parseSegmentBuffer([0, 10, 10, 1, 40, 60], IDENTITY, 0))).toEqual({ x: 10, y: 10, width: 30, height: 50 }));
  it("path d", () => expect(segmentsToPathD(parseSegmentBuffer([0, 0, 0, 1, 10, 10, 4], IDENTITY, 0))).toBe("M 0 0 L 10 10 Z"));
});
