/**
 * apply-action — turn the assistant's STRUCTURED ACTIONS into real, good-looking
 * elements on the Excalidraw canvas.
 *
 * "The design app needs to be good" — so an AI "create a button" does NOT drop a
 * grey box; it draws a properly styled button (rounded, brand fill, centered
 * label). Each action maps to a small Excalidraw skeleton; we expand it with
 * convertToExcalidrawElements and append to the live scene. Layout actions stack
 * elements with real spacing so a generated screen reads as a designed screen.
 *
 * The UI registers `window.draften.ai.applyAction` → this module, so the assistant
 * (assistant.ts) can apply edits without importing the canvas directly.
 *
 * © Ankur Sinha.
 */

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { DraftenAction } from "../ai/assistant";

// A local skeleton type (plain objects) so the pure skeletonFor logic — and its
// tests — don't pull in @excalidraw/excalidraw (a heavy browser module). The
// Excalidraw converter is lazy-imported only inside applyActionToCanvas.
type Skeleton = Array<Record<string, unknown>>;

// A small, tasteful default palette so generated UI looks designed, not debug.
const INK = "#171a21";
const MUTED = "#6b7280";
const BORDER = "#d7dbe3";
const SURFACE = "#ffffff";
const BRAND = "#4f46e5";
const BRAND_INK = "#ffffff";
const FONT = 2 as const; // Excalidraw "normal" font

/** A cursor so successive "create" actions stack down the board, not overlap. */
let flowY = 80;
const FLOW_X = 120;
export function resetFlow(y = 80) { flowY = y; }

/** Build an Excalidraw skeleton for one action. Returns [] for ops with no visual
 *  (tokens/component/note handled elsewhere) so callers can skip cleanly. */
export function skeletonFor(a: DraftenAction): Skeleton {
  const p = (a.payload ?? {}) as Record<string, unknown>;
  const label = (p.label as string) || (p.text as string) || a.detail || "";
  const x = (p.x as number) ?? FLOW_X;
  const y = (p.y as number) ?? flowY;
  const kind = ((p.type as string) || inferKind(a)).toLowerCase();

  const made: Skeleton = (() => {
    switch (kind) {
      case "button":
        return [{
          type: "rectangle", x, y, width: (p.width as number) ?? 160, height: 44,
          roundness: { type: 3 }, backgroundColor: BRAND, strokeColor: BRAND, roughness: 0,
          label: { text: label || "Button", fontSize: 15, fontFamily: FONT, strokeColor: BRAND_INK },
        }];
      case "input":
      case "field":
        return [{
          type: "rectangle", x, y, width: (p.width as number) ?? 280, height: 44,
          roundness: { type: 3 }, backgroundColor: SURFACE, strokeColor: BORDER, roughness: 0,
          label: { text: label || "Placeholder", fontSize: 14, fontFamily: FONT, strokeColor: MUTED },
        }];
      case "heading":
      case "title":
        return [{ type: "text", x, y, text: label || "Heading", fontSize: 28, fontFamily: FONT, strokeColor: INK, roughness: 0 }];
      case "text":
      case "paragraph":
        return [{ type: "text", x, y, text: label || "Text", fontSize: 16, fontFamily: FONT, strokeColor: MUTED, roughness: 0 }];
      case "card":
        return [{
          type: "rectangle", x, y, width: (p.width as number) ?? 320, height: (p.height as number) ?? 180,
          roundness: { type: 3 }, backgroundColor: SURFACE, strokeColor: BORDER, roughness: 0,
          label: label ? { text: label, fontSize: 16, fontFamily: FONT, strokeColor: INK } : undefined,
        }];
      case "frame":
      case "screen":
        return [{
          type: "rectangle", x, y, width: (p.width as number) ?? 390, height: (p.height as number) ?? 720,
          roundness: { type: 3 }, backgroundColor: "#fafbfd", strokeColor: BORDER, roughness: 0,
        }];
      default:
        // honest generic: a labelled box, still clean (rounded, no sketchiness)
        return [{
          type: "rectangle", x, y, width: (p.width as number) ?? 200, height: (p.height as number) ?? 80,
          roundness: { type: 3 }, backgroundColor: SURFACE, strokeColor: BORDER, roughness: 0,
          label: label ? { text: label, fontSize: 14, fontFamily: FONT, strokeColor: INK } : undefined,
        }];
    }
  })();

  // advance the flow cursor by the created element's height + gap (only when the
  // action didn't pin an explicit y, so a scripted layout stays where it's placed)
  if (p.y == null) {
    const h = (made[0] as { height?: number }).height ?? 44;
    flowY = y + h + 16;
  }
  return made;
}

function inferKind(a: DraftenAction): string {
  const s = `${a.target ?? ""} ${a.detail ?? ""}`.toLowerCase();
  if (/button|cta|submit/.test(s)) return "button";
  if (/input|field|email|password|text box/.test(s)) return "input";
  if (/head|title|h1|h2/.test(s)) return "heading";
  if (/card|tile|panel/.test(s)) return "card";
  if (/screen|frame|page|artboard/.test(s)) return "frame";
  if (/paragraph|body|copy|caption/.test(s)) return "text";
  return "box";
}

/** Apply one action to the live Excalidraw scene. Visual ops draw; non-visual ops
 *  (tokens/component/note/delete) are no-ops here (handled by the store/UI). */
export async function applyActionToCanvas(api: ExcalidrawImperativeAPI, a: DraftenAction): Promise<void> {
  if (["tokens", "component", "note"].includes(a.op)) return;
  if (a.op === "delete") return; // deletion by id lands with selection mapping later
  const skeleton = skeletonFor(a);
  if (!skeleton.length) return;
  // lazy-import so this heavy module loads only when actually drawing
  const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");
  const existing = api.getSceneElements();
  const fresh = convertToExcalidrawElements(skeleton as Parameters<typeof convertToExcalidrawElements>[0]);
  api.updateScene({ elements: [...existing, ...fresh] });
}

/** Register the applier on the global draften API so the assistant can reach it. */
export function registerCanvasApplier(api: ExcalidrawImperativeAPI): void {
  const w = window as unknown as { draften?: Record<string, unknown> };
  w.draften = w.draften || {};
  const ai = (w.draften.ai as Record<string, unknown>) || {};
  ai.applyAction = (a: DraftenAction) => applyActionToCanvas(api, a);
  w.draften.ai = ai;
}
