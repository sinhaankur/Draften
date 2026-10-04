import { describe, it, expect } from "vitest";

import { buildWireframe, planFlow } from "./wireframe";

describe("planFlow", () => {
  it("plans an onboarding flow with welcome + signup + a home", () => {
    const names = planFlow("onboarding flow for a fitness app").map((s) => s.name);
    expect(names).toContain("Welcome");
    expect(names).toContain("Sign up");
    expect(names[names.length - 1]).toMatch(/Home|Dashboard/);
  });

  it("plans a checkout flow with cart + payment", () => {
    const names = planFlow("checkout flow for a store").map((s) => s.name);
    expect(names).toContain("Cart");
    expect(names).toContain("Payment");
  });

  it("always lands on a home/dashboard screen", () => {
    const names = planFlow("a settings page").map((s) => s.name);
    expect(names.some((n) => /Home|Dashboard/.test(n))).toBe(true);
    expect(names).toContain("Settings");
  });
});

describe("buildWireframe", () => {
  const screens = planFlow("onboarding flow for a fitness app");
  const wf = buildWireframe(screens, { title: "Fitness onboarding" });

  it("creates one phone-sized artboard per screen", () => {
    expect(wf.boards.length).toBe(screens.length);
    expect(wf.boards[0].frame!.width).toBe(390);
    expect(wf.boards[0].frame!.height).toBe(844);
    // screens tile left→right without overlap
    expect(wf.boards[1].frame!.x).toBeGreaterThan(wf.boards[0].frame!.x);
  });

  it("builds real editable UI blocks (buttons, inputs, nav)", () => {
    const names = Object.values(wf.nodes).map((n) => n.name);
    expect(names.some((n) => n.startsWith("Button · "))).toBe(true);
    expect(names.some((n) => n.startsWith("Input · "))).toBe(true);
    expect(names.some((n) => n === "Nav title")).toBe(true);
    expect(names.some((n) => n === "Status bar")).toBe(true);
  });

  it("links the screens with flow connectors", () => {
    const connectors = Object.values(wf.nodes).filter((n) => n.type === "connector");
    expect(connectors.length).toBe(screens.length - 1);
    expect((connectors[0] as any).endArrow).toBe("arrow");
  });

  it("themes dark when asked", () => {
    const dark = buildWireframe(planFlow("dashboard"), { theme: "dark" });
    expect(dark.boards[0].background).not.toBe("#f6f6f4");
  });

  it("a tab-bar screen includes the tab bar blocks", () => {
    const home = wf.boards.find((b) => /Home|Dashboard/.test(b.name))!;
    const kids = home.children.map((id) => wf.nodes[id].name);
    expect(kids.some((n) => n === "Tab bar")).toBe(true);
  });
});
