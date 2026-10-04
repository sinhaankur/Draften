import { describe, it, expect } from "vitest";

import { figmaFileKey, FigmaImporter } from "./figma";

describe("figmaFileKey", () => {
  it("extracts the key from a file URL", () => {
    expect(figmaFileKey("https://www.figma.com/file/abc123XYZ/My-Design?node-id=1")).toBe("abc123XYZ");
  });
  it("extracts the key from a design URL", () => {
    expect(figmaFileKey("https://figma.com/design/KEY9876xyz/Thing")).toBe("KEY9876xyz");
  });
  it("accepts a bare key", () => {
    expect(figmaFileKey("abcdef123456")).toBe("abcdef123456");
  });
  it("rejects nonsense", () => {
    expect(figmaFileKey("not a key")).toBeNull();
  });
});

describe("FigmaImporter", () => {
  it("is API-based and needs a token + key", () => {
    const imp = new FigmaImporter();
    expect(imp.apiBased).toBe(true);
    expect(imp.canImport({})).toBe(false);
    expect(imp.canImport({ api: { token: "t", fileKey: "k" } })).toBe(true);
  });
  it("errors clearly without credentials", async () => {
    await expect(new FigmaImporter().import({})).rejects.toThrow(/token/i);
  });
});
