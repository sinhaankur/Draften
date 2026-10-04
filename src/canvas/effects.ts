/**
 * effects — layer effects (shadows, blur, blend mode) the way Sketch/Figma have
 * them. Excalidraw has no native element shadow/blur, so we store the effect on
 * the layer's `customData.effects` (which survives convert/export) and:
 *   - preview it live in the inspector,
 *   - emit it as real CSS in codegen (Code view + exported runnable app),
 *   - round-trip it through open-format save/open.
 *
 * Keeping effects as plain data (not baked pixels) is the honest, editable path:
 * the design stays vector, and the generated code carries the real box-shadow /
 * filter / mix-blend-mode. This is "vector management" for appearance.
 */

export interface DropShadow {
  kind: "drop" | "inner";
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string; // hex
  opacity: number; // 0..100
}

export type BlendMode =
  | "normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten"
  | "color-dodge" | "color-burn" | "hard-light" | "soft-light"
  | "difference" | "exclusion" | "hue" | "saturation" | "color" | "luminosity";

export interface LayerEffects {
  shadows?: DropShadow[];
  /** gaussian blur radius in px (0 = none) */
  blur?: number;
  blend?: BlendMode;
}

export const DEFAULT_SHADOW: DropShadow = { kind: "drop", x: 0, y: 8, blur: 24, spread: 0, color: "#000000", opacity: 18 };

/** Read effects off an element's customData (safe on any element). */
export function effectsOf(el: { customData?: { effects?: LayerEffects } | null } | undefined): LayerEffects {
  return el?.customData?.effects ?? {};
}

/** hex + 0..100 opacity → rgba() string. */
export function rgba(hex: string, opacity: number): string {
  const h = hex.replace(/^#/, "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(n.slice(0, 2), 16) || 0;
  const g = parseInt(n.slice(2, 4), 16) || 0;
  const b = parseInt(n.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${(Math.max(0, Math.min(100, opacity)) / 100).toFixed(3)})`;
}

/** The CSS `box-shadow` value for a set of shadows (drop + inner). "" if none. */
export function boxShadowCss(shadows?: DropShadow[]): string {
  if (!shadows || shadows.length === 0) return "";
  return shadows
    .map((s) => `${s.kind === "inner" ? "inset " : ""}${Math.round(s.x)}px ${Math.round(s.y)}px ${Math.round(s.blur)}px ${Math.round(s.spread)}px ${rgba(s.color, s.opacity)}`)
    .join(", ");
}

/** The CSS `filter` value for blur. "" if none. */
export function filterCss(blur?: number): string {
  return blur && blur > 0 ? `blur(${Math.round(blur)}px)` : "";
}

/** Append effect CSS declarations to a style list (used by codegen + preview). */
export function effectCssDecls(fx: LayerEffects): string[] {
  const out: string[] = [];
  const bs = boxShadowCss(fx.shadows);
  if (bs) out.push(`box-shadow:${bs}`);
  const fl = filterCss(fx.blur);
  if (fl) out.push(`filter:${fl}`);
  if (fx.blend && fx.blend !== "normal") out.push(`mix-blend-mode:${fx.blend}`);
  return out;
}

/** As an inline React.CSSProperties object (for the live inspector preview). */
export function effectStyle(fx: LayerEffects): Record<string, string> {
  const style: Record<string, string> = {};
  const bs = boxShadowCss(fx.shadows);
  if (bs) style.boxShadow = bs;
  const fl = filterCss(fx.blur);
  if (fl) style.filter = fl;
  if (fx.blend && fx.blend !== "normal") style.mixBlendMode = fx.blend;
  return style;
}
