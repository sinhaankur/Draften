/**
 * Colour normalisation — every PDF colour space the common operators produce,
 * reduced to a #rrggbb hex. pdf.js already hands RGB operators a hex string, but
 * gray and CMYK arrive as raw components, and some fills arrive as 0..1 arrays.
 */

function clamp255(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function hex2(v: number): string {
  return clamp255(v).toString(16).padStart(2, "0");
}

export function rgbHex(r: number, g: number, b: number): string {
  return `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}

/** Gray 0..1 → hex. */
export function grayHex(g: number): string {
  const v = clamp255(g * 255);
  return rgbHex(v, v, v);
}

/** CMYK 0..1 → hex (the standard naive conversion; good enough for flat fills). */
export function cmykHex(c: number, m: number, y: number, k: number): string {
  const r = 255 * (1 - c) * (1 - k);
  const g = 255 * (1 - m) * (1 - k);
  const b = 255 * (1 - y) * (1 - k);
  return rgbHex(r, g, b);
}

/**
 * Normalise whatever a pdf.js colour operator produced into hex.
 * Accepts: a hex string ("#rrggbb"), a 1-number gray, a 3-number RGB 0..1 or
 * 0..255, or a 4-number CMYK. Falls back to black.
 */
export function toHex(arg: unknown): string {
  if (typeof arg === "string") {
    if (/^#[0-9a-f]{6}$/i.test(arg)) return arg.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(arg)) return ("#" + arg.slice(1).split("").map((c) => c + c).join("")).toLowerCase();
    return "#000000";
  }
  if (Array.isArray(arg)) {
    const a = arg.map(Number);
    if (a.length === 1) return grayHex(a[0] <= 1 ? a[0] : a[0] / 255);
    if (a.length === 3) {
      const scaled = a.every((v) => v <= 1);
      return rgbHex(scaled ? a[0] * 255 : a[0], scaled ? a[1] * 255 : a[1], scaled ? a[2] * 255 : a[2]);
    }
    if (a.length === 4) return cmykHex(a[0], a[1], a[2], a[3]);
  }
  return "#000000";
}
