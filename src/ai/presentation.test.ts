import { describe, it, expect } from "vitest";

import { createEmptyDocument } from "../model/document";
import { buildPresentation, outline, type OutlineItem } from "./presentation";

function docWith(texts: Array<{ text: string; size: number; weight?: number }>) {
  const doc = createEmptyDocument("Spec");
  const boardId = "b1";
  doc.nodes = {};
  const children: string[] = [];
  texts.forEach((t, i) => {
    const id = `t${i}`;
    doc.nodes[id] = {
      id, type: "text", name: t.text, frame: { x: 48, y: 40 + i * 40, width: 600, height: 24 },
      text: t.text, fills: [{ kind: "solid", color: "#000" }],
      style: { fontFamily: "Inter", fontSize: t.size, fontWeight: t.weight ?? 400, lineHeight: 1.4, align: "left" },
      parentId: boardId,
    } as never;
    children.push(id);
  });
  doc.boards = [{ id: boardId, name: "Doc", kind: "design", children, frame: { x: 0, y: 0, width: 700, height: 900 } }] as never;
  return doc;
}

describe("outline", () => {
  it("infers heading levels from font size + weight", () => {
    const items = outline(docWith([
      { text: "Big Title", size: 32, weight: 700 },
      { text: "A Section", size: 22, weight: 600 },
      { text: "body copy here", size: 14 },
      { text: "• a bullet", size: 14 },
    ]));
    expect(items[0].level).toBe(1); // largest → top-level
    expect(items[1].level).toBe(2); // smaller heading → sub
    expect(items[2].level).toBe(0); // body
    expect(items[3]).toEqual({ level: 0, text: "a bullet" }); // bullet stripped
  });

  it("returns empty for a document with no text", () => {
    expect(outline(createEmptyDocument("empty"))).toEqual([]);
  });
});

describe("buildPresentation", () => {
  const items: OutlineItem[] = [
    { level: 1, text: "Introduction" },
    { level: 2, text: "Why this matters" },
    { level: 0, text: "First reason" },
    { level: 0, text: "Second reason" },
    { level: 2, text: "How it works" },
    { level: 0, text: "Step one" },
  ];

  it("creates a title slide + one board per section/content slide", () => {
    const deck = buildPresentation(items, { title: "My Deck" });
    // title + section + 2 content slides
    expect(deck.boards.length).toBeGreaterThanOrEqual(4);
    expect(deck.boards[0].name).toBe("Title");
    // every slide is a 16:9 artboard with a background + offset so they tile
    expect(deck.boards[0].frame!.width).toBe(960);
    expect(deck.boards[0].frame!.height).toBe(540);
    expect(deck.boards[1].frame!.x).toBeGreaterThan(deck.boards[0].frame!.x);
    expect(deck.boards.every((b) => !!b.background)).toBe(true);
  });

  it("splits long bullet runs across slides", () => {
    const many: OutlineItem[] = [{ level: 2, text: "Lots" }, ...Array.from({ length: 10 }, (_, i) => ({ level: 0, text: `point ${i}` }))];
    const deck = buildPresentation(many, { maxBulletsPerSlide: 4 });
    // 10 bullets / 4 per slide → at least 3 content slides (+ title)
    expect(deck.boards.length).toBeGreaterThanOrEqual(4);
  });

  it("themes dark when asked", () => {
    const deck = buildPresentation(items, { theme: "dark" });
    expect(deck.boards[0].background).not.toBe("#ffffff");
  });

  it("names layers semantically (not generic)", () => {
    const deck = buildPresentation(items, {});
    const names = Object.values(deck.nodes).map((n) => n.name);
    expect(names).toContain("Accent bar");
    expect(names).toContain("Deck title");
    expect(names.some((n) => n.startsWith("Bullet "))).toBe(true);
  });
});
