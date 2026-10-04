import { describe, it, expect } from "vitest";

import { renumber, type Annotation } from "./annotations-store";

const a = (id: string, n: number, createdAt: number): Annotation => ({ id, n, x: 0, y: 0, text: "", createdAt });

describe("renumber", () => {
  it("numbers pins 1..n in creation order", () => {
    const out = renumber([a("c", 0, 300), a("a", 0, 100), a("b", 0, 200)]);
    expect(out.map((x) => [x.id, x.n])).toEqual([["a", 1], ["b", 2], ["c", 3]]);
  });

  it("closes the gap after a deletion", () => {
    // started 1,2,3; '2' removed → remaining should renumber to 1,2
    const remaining = [a("first", 1, 100), a("third", 3, 300)];
    const out = renumber(remaining);
    expect(out.map((x) => x.n)).toEqual([1, 2]);
    expect(out.map((x) => x.id)).toEqual(["first", "third"]);
  });

  it("leaves already-correct numbering untouched (same refs)", () => {
    const list = [a("a", 1, 1), a("b", 2, 2)];
    const out = renumber(list);
    expect(out[0]).toBe(list[0]);
    expect(out[1]).toBe(list[1]);
  });
});
