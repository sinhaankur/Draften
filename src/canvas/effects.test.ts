import { describe, it, expect } from "vitest";

import { rgba, boxShadowCss, filterCss, effectCssDecls, type DropShadow } from "./effects";

const shadow = (o: Partial<DropShadow> = {}): DropShadow => ({ kind: "drop", x: 0, y: 8, blur: 24, spread: 0, color: "#000000", opacity: 20, ...o });

describe("effects CSS", () => {
  it("rgba converts hex + opacity", () => {
    expect(rgba("#ffffff", 50)).toBe("rgba(255, 255, 255, 0.500)");
    expect(rgba("#3d6b5f", 100)).toBe("rgba(61, 107, 95, 1.000)");
    expect(rgba("#000", 0)).toBe("rgba(0, 0, 0, 0.000)"); // 3-digit hex
  });

  it("boxShadowCss builds a drop shadow", () => {
    expect(boxShadowCss([shadow()])).toBe("0px 8px 24px 0px rgba(0, 0, 0, 0.200)");
  });

  it("boxShadowCss marks inner shadows with inset", () => {
    expect(boxShadowCss([shadow({ kind: "inner", y: 2 })])).toContain("inset 0px 2px");
  });

  it("boxShadowCss joins multiple shadows", () => {
    const css = boxShadowCss([shadow(), shadow({ kind: "inner" })]);
    // two shadows → exactly one "inset" (the inner one) and both separated by ", "
    expect((css.match(/inset/g) ?? []).length).toBe(1);
    expect(css).toContain("), ");
  });

  it("empty shadows → empty string", () => {
    expect(boxShadowCss([])).toBe("");
    expect(boxShadowCss(undefined)).toBe("");
  });

  it("filterCss only when blur > 0", () => {
    expect(filterCss(4)).toBe("blur(4px)");
    expect(filterCss(0)).toBe("");
  });

  it("effectCssDecls combines shadow, blur, blend", () => {
    const decls = effectCssDecls({ shadows: [shadow()], blur: 3, blend: "multiply" });
    expect(decls.some((d) => d.startsWith("box-shadow:"))).toBe(true);
    expect(decls).toContain("filter:blur(3px)");
    expect(decls).toContain("mix-blend-mode:multiply");
  });

  it("normal blend is omitted", () => {
    expect(effectCssDecls({ blend: "normal" })).toEqual([]);
  });
});
