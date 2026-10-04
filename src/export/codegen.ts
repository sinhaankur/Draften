/**
 * codegen — turn the live canvas into real code.
 *
 * Draften's pitch is "designs in your repo", so the Code view must emit REAL,
 * readable code from what's on the canvas — not a placeholder. We read the
 * Excalidraw elements and generate absolutely-positioned HTML/CSS (faithful to
 * the layout) and a matching React component. Rectangles → <div>, text → <p>,
 * ellipses → rounded <div>, labels → inner text. It's intentionally simple and
 * honest: what you see maps 1:1 to what you get.
 */

import { effectsOf, effectCssDecls } from "../canvas/effects";

type El = {
  id: string;
  type: string;
  x: number; y: number; width: number; height: number;
  strokeColor?: string;
  backgroundColor?: string;
  roundness?: { type: number } | null;
  text?: string;
  fontSize?: number;
  angle?: number;
  opacity?: number;
  isDeleted?: boolean;
  boundElements?: { id: string; type: string }[] | null;
  containerId?: string;
  customData?: { effects?: import("../canvas/effects").LayerEffects } | null;
};

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function bounds(els: El[]): { minX: number; minY: number } {
  let minX = Infinity, minY = Infinity;
  for (const e of els) { minX = Math.min(minX, e.x); minY = Math.min(minY, e.y); }
  return { minX: Number.isFinite(minX) ? minX : 0, minY: Number.isFinite(minY) ? minY : 0 };
}

/** The text that belongs to a shape (its bound label), if any. */
function labelOf(el: El, all: El[]): string | undefined {
  const bound = (el.boundElements || []).find((b) => b.type === "text");
  if (!bound) return undefined;
  const t = all.find((x) => x.id === bound.id);
  return t?.text;
}

function styleFor(e: El, minX: number, minY: number): string {
  const s: string[] = [
    "position:absolute",
    `left:${Math.round(e.x - minX)}px`,
    `top:${Math.round(e.y - minY)}px`,
    `width:${Math.round(e.width)}px`,
    `height:${Math.round(e.height)}px`,
  ];
  if (e.backgroundColor && e.backgroundColor !== "transparent") s.push(`background:${e.backgroundColor}`);
  if (e.strokeColor && e.type !== "text") s.push(`border:1px solid ${e.strokeColor}`);
  if (e.type === "text" && e.strokeColor) s.push(`color:${e.strokeColor}`);
  if (e.roundness) s.push("border-radius:10px");
  if (e.type === "ellipse") s.push("border-radius:9999px");
  if (e.fontSize) s.push(`font-size:${Math.round(e.fontSize)}px`);
  if (e.opacity != null && e.opacity < 100) s.push(`opacity:${(e.opacity / 100).toFixed(2)}`);
  if (e.type === "text") s.push("display:flex", "align-items:center");
  // layer effects (shadow / blur / blend) → real CSS, so what you style exports
  s.push(...effectCssDecls(effectsOf(e)));
  return s.join(";");
}

export function toHtml(elements: readonly unknown[]): string {
  const els = (elements as El[]).filter((e) => !e.isDeleted && !e.containerId); // skip bound labels (rendered inside their shape)
  if (!els.length) return "<!-- canvas is empty — draw something or pick a template -->";
  const { minX, minY } = bounds(els);
  const rows = els
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .map((e) => {
      const inner = e.type === "text" ? esc(e.text || "") : esc(labelOf(e, els) || "");
      const tag = e.type === "text" ? "p" : "div";
      return `  <${tag} style="${styleFor(e, minX, minY)}">${inner}</${tag}>`;
    });
  return `<div class="draften-screen" style="position:relative;font-family:Inter,system-ui,sans-serif">
${rows.join("\n")}
</div>`;
}

export function toReact(elements: readonly unknown[]): string {
  const html = toHtml(elements)
    .replace(/<!--[\s\S]*?-->/g, "{/* empty */}")
    .replace(/ style="([^"]*)"/g, (_m, css: string) => " style={{" + css.split(";").filter(Boolean).map((rule) => {
      const [k, v] = rule.split(":");
      const key = k.trim().replace(/-([a-z])/g, (_x, c) => c.toUpperCase());
      return `${key}: ${/^-?\d+(\.\d+)?(px)?$/.test(v.trim()) && !v.includes("px") ? v.trim() : `"${v.trim()}"`}`;
    }).join(", ") + "}}")
    .replace(/class=/g, "className=");
  return `export function Screen() {
  return (
${html.split("\n").map((l) => "    " + l).join("\n")}
  );
}`;
}
