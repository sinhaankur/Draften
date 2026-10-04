import { describe, it, expect } from "vitest";

import { cmykHex, grayHex, rgbHex, toHex } from "./color";

describe("colour normalisation", () => {
  it("rgb", () => expect(rgbHex(255, 0, 0)).toBe("#ff0000"));
  it("gray 0..1", () => expect(grayHex(0.5)).toBe("#808080"));
  it("cmyk pure cyan", () => expect(cmykHex(1, 0, 0, 0)).toBe("#00ffff"));
  it("toHex passes through a hex string", () => expect(toHex("#AABBCC")).toBe("#aabbcc"));
  it("toHex expands a 3-digit hex", () => expect(toHex("#abc")).toBe("#aabbcc"));
  it("toHex reads a 1-number gray", () => expect(toHex([0])).toBe("#000000"));
  it("toHex reads a 3-number 0..1 rgb", () => expect(toHex([1, 0, 0])).toBe("#ff0000"));
  it("toHex reads a 4-number cmyk", () => expect(toHex([0, 1, 1, 0])).toBe("#ff0000"));
  it("toHex falls back to black", () => expect(toHex(null)).toBe("#000000"));
});
