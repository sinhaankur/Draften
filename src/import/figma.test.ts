import { afterEach, describe, it, expect, vi } from "vitest";

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

describe("FigmaImporter — fidelity of the mapped tree", () => {
  afterEach(() => vi.restoreAllMocks());

  const bb = (x: number, y: number, w: number, h: number) => ({ x, y, width: w, height: h });

  function mockFigma(document: unknown) {
    vi.stubGlobal("fetch", vi.fn(async () =>
      ({ ok: true, status: 200, json: async () => ({ name: "Mock", document }) }) as unknown as Response,
    ));
  }

  it("maps stroke, opacity, rotation, gradient, image and text style", async () => {
    mockFigma({
      id: "0:0", name: "Document", type: "DOCUMENT",
      children: [{
        id: "1:0", name: "Page 1", type: "CANVAS",
        children: [
          {
            id: "2:1", name: "Card", type: "RECTANGLE", absoluteBoundingBox: bb(0, 0, 100, 60),
            fills: [{ type: "SOLID", color: { r: 0.2, g: 0.4, b: 0.37, a: 1 } }],
            strokes: [{ type: "SOLID", color: { r: 1, g: 0, b: 0, a: 1 } }], strokeWeight: 2,
            opacity: 0.5, rotation: Math.PI / 6, cornerRadius: 8,
          },
          {
            id: "2:2", name: "Banner", type: "RECTANGLE", absoluteBoundingBox: bb(0, 80, 200, 40),
            fills: [{ type: "GRADIENT_LINEAR",
              gradientHandlePositions: [{ x: 0, y: 0 }, { x: 1, y: 0 }],
              gradientStops: [{ position: 0, color: { r: 0, g: 0, b: 0, a: 1 } }, { position: 1, color: { r: 1, g: 1, b: 1, a: 1 } }] }],
          },
          {
            id: "2:3", name: "Avatar", type: "RECTANGLE", absoluteBoundingBox: bb(0, 140, 48, 48),
            fills: [{ type: "IMAGE", imageRef: "abc123" }],
          },
          {
            id: "2:4", name: "Title", type: "TEXT", absoluteBoundingBox: bb(0, 200, 180, 24),
            characters: "Hello",
            fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0, a: 1 } }],
            style: { fontFamily: "Inter", fontSize: 24, fontWeight: 600, textAlignHorizontal: "CENTER", lineHeightPx: 30, letterSpacing: 0.5 },
          },
        ],
      }],
    });

    const { document } = await new FigmaImporter().import({ api: { token: "t", fileKey: "KEY1234567" } });

    const card = document.nodes["2:1"] as any;
    expect(card.type).toBe("rectangle");
    expect(card.stroke).toEqual({ paint: { kind: "solid", color: "#ff0000" }, width: 2 });
    expect(card.opacity).toBe(0.5);
    expect(card.rotation).toBeCloseTo(Math.PI / 6);
    expect(card.cornerRadius).toBe(8);

    const banner = document.nodes["2:2"] as any;
    expect(banner.fills[0].kind).toBe("linear");
    expect(banner.fills[0].stops).toHaveLength(2);
    expect(banner.fills[0].angle).toBe(0); // handles run left→right

    const avatar = document.nodes["2:3"] as any;
    expect(avatar.type).toBe("image");
    expect(avatar.src).toContain("abc123");

    const title = document.nodes["2:4"] as any;
    expect(title.type).toBe("text");
    expect(title.style.fontSize).toBe(24);
    expect(title.style.fontWeight).toBe(600);
    expect(title.style.align).toBe("center");
    expect(title.style.lineHeight).toBeCloseTo(30 / 24);
    expect(title.style.letterSpacing).toBe(0.5);
  });
});
