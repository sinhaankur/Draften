import { beforeEach, describe, expect, it } from "vitest";
import { skeletonFor, resetFlow } from "./apply-action";
import type { DraftenAction } from "../ai/assistant";

const act = (op: string, payload?: Record<string, unknown>, detail?: string): DraftenAction =>
  ({ op, payload, detail });

describe("apply-action · skeletonFor", () => {
  beforeEach(() => resetFlow(80));

  it("draws a styled button (brand fill + label), not a grey box", () => {
    const [el] = skeletonFor(act("create", { type: "button", label: "Get started" })) as any[];
    expect(el.type).toBe("rectangle");
    expect(el.backgroundColor).toBe("#4f46e5");         // brand fill
    expect(el.roundness).toBeTruthy();                   // rounded, designed
    expect(el.label.text).toBe("Get started");
  });

  it("draws an input as a bordered surface with placeholder", () => {
    const [el] = skeletonFor(act("create", { type: "input", label: "Email" })) as any[];
    expect(el.backgroundColor).toBe("#ffffff");
    expect(el.label.text).toBe("Email");
  });

  it("draws a heading as large text", () => {
    const [el] = skeletonFor(act("create", { type: "heading", text: "Welcome" })) as any[];
    expect(el.type).toBe("text");
    expect(el.fontSize).toBeGreaterThanOrEqual(24);
    expect(el.text).toBe("Welcome");
  });

  it("infers the kind from detail when no explicit type", () => {
    const [btn] = skeletonFor(act("create", {}, "a primary submit button")) as any[];
    expect(btn.backgroundColor).toBe("#4f46e5"); // inferred button
    const [card] = skeletonFor(act("create", {}, "a product card")) as any[];
    expect(card.width).toBeGreaterThanOrEqual(300); // inferred card
  });

  it("stacks successive elements down the board (flow cursor)", () => {
    const [a] = skeletonFor(act("create", { type: "button", label: "A" })) as any[];
    const [b] = skeletonFor(act("create", { type: "button", label: "B" })) as any[];
    expect(b.y).toBeGreaterThan(a.y); // B is below A, with spacing
  });

  it("honours an explicit x/y (scripted layout stays put)", () => {
    const [el] = skeletonFor(act("create", { type: "card", x: 500, y: 300 })) as any[];
    expect(el.x).toBe(500);
    expect(el.y).toBe(300);
  });

  it("a generic op still makes a clean (rounded, non-sketchy) box", () => {
    const [el] = skeletonFor(act("create", { label: "Thing" })) as any[];
    expect(el.roughness).toBe(0);
    expect(el.roundness).toBeTruthy();
  });
});
