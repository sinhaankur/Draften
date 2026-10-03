import { describe, expect, it } from "vitest";
import { toHtml, toReact } from "./codegen";

const rect = { id: "r1", type: "rectangle", x: 100, y: 120, width: 200, height: 48, backgroundColor: "#3d6b5f", strokeColor: "#3d6b5f", roundness: { type: 3 } };
const text = { id: "t1", type: "text", x: 110, y: 130, width: 180, height: 20, text: "Sign in", strokeColor: "#ffffff", fontSize: 14 };

describe("codegen — canvas → code", () => {
  it("emits positioned HTML relative to the top-left bound", () => {
    const html = toHtml([rect, text]);
    // minX=100, minY=120 → the rect sits at 0,0
    expect(html).toContain("left:0px");
    expect(html).toContain("top:0px");
    expect(html).toContain("width:200px");
    expect(html).toContain("background:#3d6b5f");
    expect(html).toContain("Sign in");
  });

  it("escapes text content (no HTML injection)", () => {
    const html = toHtml([{ ...text, text: "<script>x</script>" }]);
    expect(html).not.toContain("<script>x");
    expect(html).toContain("&lt;script&gt;");
  });

  it("honest about an empty canvas", () => {
    expect(toHtml([])).toContain("empty");
  });

  it("React output uses className + a Screen component", () => {
    const code = toReact([rect, text]);
    expect(code).toContain("export function Screen()");
    expect(code).toContain("className=");
    expect(code).not.toContain(' style="'); // style became an object, not a string attr
  });

  it("skips deleted elements", () => {
    const html = toHtml([rect, { ...text, isDeleted: true }]);
    expect(html).not.toContain("Sign in");
  });
});
