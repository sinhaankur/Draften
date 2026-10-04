import { describe, it, expect } from "vitest";

import { createEmptyDocument } from "../model/document";
import { buildCorpus, chunkDocument, chunkText, contextBlock, retrieve, UX_LAWS } from "./rag";

describe("UX knowledge base", () => {
  it("includes the core laws the assistant reasons with", () => {
    const ids = UX_LAWS.map((l) => l.id);
    expect(ids).toEqual(expect.arrayContaining(["law.proximity", "law.fitts", "law.hicks", "law.hierarchy"]));
  });
});

describe("retrieve", () => {
  it("surfaces the Proximity/grouping law for a grouping question", () => {
    const hits = retrieve("why does grouping these controls matter?", UX_LAWS, 3);
    expect(hits[0].source).toMatch(/Proximity/);
  });

  it("surfaces Fitts's law for a tap-target/placement question", () => {
    const hits = retrieve("where should I place the primary button so it's easy to tap?", UX_LAWS, 3);
    expect(hits.map((h) => h.source).join(" ")).toMatch(/Fitts/);
  });

  it("surfaces Hick's law for a too-many-choices question", () => {
    const hits = retrieve("there are too many menu options and choices", UX_LAWS, 3);
    expect(hits.map((h) => h.source).join(" ")).toMatch(/Hick/);
  });

  it("returns nothing for an unrelated query (graceful, no noise)", () => {
    expect(retrieve("banana helicopter xyzzy", UX_LAWS, 3)).toHaveLength(0);
  });

  it("ranks by relevance and respects k", () => {
    const hits = retrieve("spacing alignment hierarchy placement", UX_LAWS, 2);
    expect(hits.length).toBeLessThanOrEqual(2);
    expect(hits[0].score).toBeGreaterThanOrEqual(hits[hits.length - 1].score);
  });
});

describe("chunkers", () => {
  it("chunks the live document by board with its text", () => {
    const doc = createEmptyDocument("D");
    doc.nodes = { t: { id: "t", type: "text", name: "Headline", frame: { x: 0, y: 0, width: 100, height: 20 }, text: "Pricing plans", fills: [] } as never };
    doc.boards = [{ id: "b", name: "Pricing", kind: "design", children: ["t"] }] as never;
    const chunks = chunkDocument(doc);
    expect(chunks[0].source).toContain("Pricing");
    expect(chunks[0].text).toContain("Pricing plans");
  });

  it("chunks long attachment text into passages", () => {
    const chunks = chunkText("para one.\n\npara two is here.\n\npara three.", "Attached · spec.pdf");
    expect(chunks.length).toBe(3);
    expect(chunks[1].text).toContain("para two");
  });

  it("buildCorpus combines UX laws + document", () => {
    const doc = createEmptyDocument("D");
    const corpus = buildCorpus(doc);
    expect(corpus.length).toBeGreaterThanOrEqual(UX_LAWS.length);
  });
});

describe("contextBlock", () => {
  it("formats retrieved chunks with their source as citations", () => {
    const block = contextBlock(retrieve("grouping proximity", UX_LAWS, 1));
    expect(block).toMatch(/^- \[UX Law/);
  });
});
