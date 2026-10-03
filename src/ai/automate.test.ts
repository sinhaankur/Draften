import { describe, expect, it } from "vitest";
import { automate } from "./automate";

describe("automate — keyless design scripts (the OmniGraffle automation)", () => {
  it("generates a table of contents from a list", () => {
    const r = automate("A table of contents for: Intro, Setup, Usage, API, FAQ");
    expect(r).not.toBeNull();
    const texts = r!.skeleton.filter((s) => s.type === "text").map((s) => s.text);
    expect(texts.some((t) => String(t).includes("Table of Contents"))).toBe(true);
    expect(texts.some((t) => String(t).includes("Intro"))).toBe(true);
    expect(texts.some((t) => String(t).includes("FAQ"))).toBe(true);
    expect(r!.summary).toMatch(/5 entries/);
  });

  it("falls back to default TOC entries when none given", () => {
    const r = automate("make a table of contents");
    expect(r).not.toBeNull();
    expect(r!.summary).toMatch(/entries/);
  });

  it("builds an N×M grid of cards", () => {
    const r = automate("a 3x2 grid of cards");
    expect(r).not.toBeNull();
    const cards = r!.skeleton.filter((s) => s.type === "text" && String((s as { text: string }).text).startsWith("Card"));
    expect(cards.length).toBe(6);
    expect(r!.summary).toMatch(/3×2/);
  });

  it("builds a nav bar from links", () => {
    const r = automate("a nav bar: Home, Features, Pricing");
    expect(r).not.toBeNull();
    const texts = r!.skeleton.filter((s) => s.type === "text").map((s) => String((s as { text: string }).text));
    expect(texts).toContain("Home");
    expect(texts).toContain("Pricing");
  });

  it("stacks a list vertically", () => {
    const r = automate("a checklist of: Research, Design, Build, Ship");
    expect(r).not.toBeNull();
    const texts = r!.skeleton.filter((s) => s.type === "text").map((s) => String((s as { text: string }).text));
    expect(texts).toContain("Research");
    expect(texts).toContain("Ship");
  });

  it("returns null for a prompt no command matches (→ falls through to the LLM)", () => {
    expect(automate("explain the theory of relativity")).toBeNull();
  });
});
