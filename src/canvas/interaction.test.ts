import { describe, expect, it } from "vitest";

import type { Node } from "../model/node";
import { hitTest, pickTopmost, rectFromDrag, screenToWorld, worldToScreen } from "./interaction";

const rectNode = (id: string, x: number, y: number, w = 100, h = 60): Node =>
  ({
    id,
    type: "rectangle",
    name: id,
    frame: { x, y, width: w, height: h },
    fills: [{ kind: "solid", color: "#fff" }],
  }) as Node;

describe("interaction math", () => {
  it("screen↔world round-trips under pan + zoom", () => {
    const vp = { x: 40, y: -20, zoom: 2 };
    const w = screenToWorld(100, 100, vp);
    const s = worldToScreen(w.x, w.y, vp);
    expect(s.x).toBeCloseTo(100, 6);
    expect(s.y).toBeCloseTo(100, 6);
  });

  it("screenToWorld accounts for zoom (not just pan)", () => {
    const vp = { x: 0, y: 0, zoom: 2 };
    // a point 200px right on screen is 100 units right in world at 2× zoom
    expect(screenToWorld(200, 0, vp).x).toBeCloseTo(100, 6);
  });

  it("rectFromDrag normalizes a bottom-left→top-right drag to positive size", () => {
    const r = rectFromDrag({ x: 100, y: 100 }, { x: 40, y: 30 });
    expect(r).toEqual({ x: 40, y: 30, width: 60, height: 70 });
  });

  it("hitTest respects the frame bounds", () => {
    const n = rectNode("a", 10, 10, 100, 50);
    expect(hitTest(n, 50, 30)).toBe(true);
    expect(hitTest(n, 5, 30)).toBe(false);
    expect(hitTest(n, 50, 70)).toBe(false);
  });

  it("pickTopmost returns the last (visually top) overlapping node", () => {
    const under = rectNode("under", 0, 0, 100, 100);
    const over = rectNode("over", 20, 20, 100, 100);
    const top = pickTopmost([under, over], 50, 50);
    expect(top?.id).toBe("over");
  });

  it("pickTopmost skips connectors and empty nodes, returns undefined on miss", () => {
    const connector = {
      id: "c",
      type: "connector",
      name: "c",
      frame: { x: 0, y: 0, width: 0, height: 0 },
      from: { nodeId: "x" },
      to: { nodeId: "y" },
      routing: "straight",
      stroke: { paint: { kind: "solid", color: "#000" }, width: 1 },
    } as Node;
    expect(pickTopmost([connector], 0, 0)).toBeUndefined();
    expect(pickTopmost([rectNode("a", 10, 10)], 500, 500)).toBeUndefined();
  });
});
