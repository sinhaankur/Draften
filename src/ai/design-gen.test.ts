import { describe, expect, it } from "vitest";

import { byAtomicLevel } from "../model/design-system";
import { generateSystem, generateTokens } from "./design-gen";

describe("deterministic design-system generator (model-free core)", () => {
  it("produces a coherent token set from a brand brief", () => {
    const tokens = generateTokens({ brand: "Northwind" });
    // full brand ramp 50..900
    for (const stop of ["50", "100", "500", "900"]) {
      expect(tokens.colors[`brand.${stop}`]).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(tokens.typography["heading.lg"].fontSize).toBeGreaterThan(
      tokens.typography["body.md"].fontSize,
    );
    expect(tokens.spacing["4"]).toBe(16);
  });

  it("is deterministic — same brand → same primary color", () => {
    const a = generateTokens({ brand: "Acme" });
    const b = generateTokens({ brand: "Acme" });
    expect(a.colors["brand.500"]).toBe(b.colors["brand.500"]);
  });

  it("different brands get different hues", () => {
    const a = generateTokens({ brand: "Acme" });
    const b = generateTokens({ brand: "Zenith" });
    expect(a.colors["brand.500"]).not.toBe(b.colors["brand.500"]);
  });

  it("style vibe changes radii (brutalist → sharp, playful → round)", () => {
    expect(generateTokens({ brand: "X", style: "brutalist" }).radii.md).toBe(0);
    expect(generateTokens({ brand: "X", style: "playful" }).radii.md).toBeGreaterThan(8);
  });

  it("generates a full atomic ladder with real code + props", () => {
    const sys = generateSystem({ brand: "Northwind" });
    const byLevel = byAtomicLevel(sys.components);
    expect(byLevel.atom.length).toBeGreaterThanOrEqual(3);
    expect(byLevel.molecule.length).toBeGreaterThanOrEqual(1);
    expect(byLevel.organism.length).toBeGreaterThanOrEqual(1);
    for (const c of sys.components) {
      expect(c.code?.react).toContain("export function");
      expect(c.origin).toBe("ai");
      expect(c.version).toBe("0.1.0");
    }
    // organisms compose from lower levels
    const org = byLevel.organism[0];
    expect(org.composedOf?.length).toBeGreaterThan(0);
  });
});

import { generateDesignSystem } from "./design-gen";

describe("generateDesignSystem (store bridge)", () => {
  it("returns a full DesignSystem with brand, tokens, and components", () => {
    const ds = generateDesignSystem({ brand: "Northwind", style: "calm" });
    expect(ds.brand.name).toBe("Northwind");
    expect(ds.brand.primaryColorTokens?.length).toBeGreaterThan(0);
    expect(Object.keys(ds.tokens.colors).length).toBeGreaterThan(10);
    expect(ds.components.length).toBeGreaterThanOrEqual(5);
    // the brand's referenced primary tokens resolve to real colors
    for (const key of ds.brand.primaryColorTokens ?? []) {
      expect(ds.tokens.colors[key]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});
