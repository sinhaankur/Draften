import { describe, expect, it } from "vitest";

import type { Node } from "../model/node";
import { edgePoint } from "./connector-geometry";

const rect = (x: number, y: number, w: number, h: number): Node =>
  ({ id: "r", type: "rectangle", name: "r", frame: { x, y, width: w, height: h }, fills: [] }) as Node;

const diamond = (x: number, y: number, w: number, h: number): Node =>
  ({ id: "d", type: "shape", name: "d", shape: "diamond", frame: { x, y, width: w, height: h }, fills: [] }) as Node;

const ellipse = (x: number, y: number, w: number, h: number): Node =>
  ({ id: "e", type: "ellipse", name: "e", frame: { x, y, width: w, height: h }, fills: [] }) as Node;

describe("connector edge clipping", () => {
  it("rectangle: a point to the right exits the right edge at mid-height", () => {
    const n = rect(0, 0, 100, 60); // center (50,30)
    const p = edgePoint(n, { x: 500, y: 30 });
    expect(p.x).toBeCloseTo(100, 5); // right edge
    expect(p.y).toBeCloseTo(30, 5);
  });

  it("rectangle: a point straight below exits the bottom edge", () => {
    const n = rect(0, 0, 100, 60);
    const p = edgePoint(n, { x: 50, y: 500 });
    expect(p.y).toBeCloseTo(60, 5);
    expect(p.x).toBeCloseTo(50, 5);
  });

  it("diamond: a point to the right exits at the right vertex", () => {
    const n = diamond(0, 0, 140, 84); // center (70,42), right vertex (140,42)
    const p = edgePoint(n, { x: 900, y: 42 });
    expect(p.x).toBeCloseTo(140, 4);
    expect(p.y).toBeCloseTo(42, 4);
  });

  it("diamond: the clipped point is inside the bounding box (never past a vertex)", () => {
    const n = diamond(0, 0, 140, 84);
    const p = edgePoint(n, { x: 300, y: -300 }); // up-right
    // on the diamond edge: |x-70|/70 + |y-42|/42 == 1
    const v = Math.abs(p.x - 70) / 70 + Math.abs(p.y - 42) / 42;
    expect(v).toBeCloseTo(1, 4);
  });

  it("ellipse: the clipped point lies on the ellipse", () => {
    const n = ellipse(0, 0, 120, 80); // center (60,40)
    const p = edgePoint(n, { x: 400, y: 260 });
    const v = ((p.x - 60) / 60) ** 2 + ((p.y - 40) / 40) ** 2;
    expect(v).toBeCloseTo(1, 4);
  });

  it("returns center when the target coincides with it", () => {
    const n = rect(0, 0, 100, 60);
    const p = edgePoint(n, { x: 50, y: 30 });
    expect(p).toEqual({ x: 50, y: 30 });
  });
});
