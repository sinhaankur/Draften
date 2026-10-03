import { convertToExcalidrawElements, Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import { useMemo } from "react";

/**
 * The Draften canvas — built on Excalidraw (MIT), not a hand-rolled 2D canvas.
 *
 * Why: a real design/diagram canvas needs grouping, multi-select, snapping,
 * binding arrows, resize/rotate, and undo/redo. Excalidraw ships all of that,
 * battle-tested. Draften keeps its own shell (top bar, boards, design-system
 * spine, AI, importers) and mounts Excalidraw as the drawing surface, configured
 * for a crisp/precise look (roughness 0, not the default sketchy style).
 *
 * The seed shows the unified idea: a UI card (design) + a two-node flow whose
 * arrow BINDS to the shapes — it snaps to their edges and follows when moved, the
 * "things work together" behaviour that was missing. Elements are authored as an
 * Excalidraw *skeleton* and expanded with convertToExcalidrawElements (which fills
 * in the fractional index / binding internals correctly).
 */
export function ExcalidrawCanvas({
  theme,
  onReady,
}: {
  theme?: "light" | "dark";
  /** receives the Excalidraw API so the app can push a template scene */
  onReady?: (api: ExcalidrawImperativeAPI) => void;
}) {
  const initialData = useMemo(
    () => ({
      elements: convertToExcalidrawElements(seedSkeleton()),
      appState: {
        currentItemRoughness: 0, // crisp, precise shapes (not hand-drawn)
        currentItemFontFamily: 2, // Nunito — the normal (non-handwritten) font
        currentItemStrokeColor: "#3d6b5f",
        viewBackgroundColor: theme === "dark" ? "#151514" : "#efeeeb",
        gridSize: 20,
      },
      scrollToContent: true,
    }),
    // seed once; the `theme` prop below drives light/dark
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Excalidraw
        initialData={initialData}
        excalidrawAPI={(api) => {
          onReady?.(api);
          // Frame all the seeded artboards nicely on open (spacious, like the mockup)
          setTimeout(() => {
            try { api.scrollToContent(api.getSceneElements(), { fitToContent: true, animate: false }); } catch { /* ignore */ }
          }, 60);
        }}
        theme={theme === "dark" ? "dark" : "light"}
        gridModeEnabled
        UIOptions={{
          canvasActions: {
            changeViewBackgroundColor: false,
            clearCanvas: true,
            export: { saveFileToDisk: true },
            loadScene: true,
            saveToActiveFile: false,
            toggleTheme: false,
          },
        }}
      />
    </div>
  );
}

/**
 * The seed as an Excalidraw element skeleton. `label` makes a shape carry
 * centered text; an arrow with `start`/`end` element refs BINDS to those shapes.
 * convertToExcalidrawElements() turns this into full, valid Excalidraw elements.
 */
// The three Onboarding artboards from the approved v2 mockup, side by side —
// Welcome · Create account · Connect repository. White phone frames (390×852) with
// real content + the teal primary button, so the canvas opens populated like the
// screenshot instead of an empty flowchart.
const INK = "#1d1d1b", MUTED = "#8e8d88", LINE = "#e7e6e2", ACC = "#3d6b5f", SURF = "#ffffff";
function phone(x: number, title: string) {
  return {
    type: "rectangle" as const, x, y: 80, width: 300, height: 600,
    roughness: 0, strokeColor: LINE, backgroundColor: SURF, strokeWidth: 1, roundness: { type: 3 } as const,
    label: { text: title, fontSize: 11, fontFamily: 2, strokeColor: MUTED, verticalAlign: "top" as const },
  };
}
function text(x: number, y: number, t: string, size = 15, color = INK) {
  return { type: "text" as const, x, y, text: t, fontSize: size, fontFamily: 2, strokeColor: color, roughness: 0 };
}
function field(x: number, y: number, ph: string) {
  return { type: "rectangle" as const, x, y, width: 240, height: 40, roughness: 0, strokeColor: LINE, backgroundColor: SURF, strokeWidth: 1, roundness: { type: 3 } as const,
    label: { text: ph, fontSize: 13, fontFamily: 2, strokeColor: MUTED } };
}
function button(x: number, y: number, t: string) {
  return { type: "rectangle" as const, x, y, width: 240, height: 44, roughness: 0, strokeColor: ACC, backgroundColor: ACC, strokeWidth: 1, roundness: { type: 3 } as const,
    label: { text: t, fontSize: 14, fontFamily: 2, strokeColor: "#ffffff" } };
}

function seedSkeleton() {
  return [
    // ── Artboard 1: Welcome ──────────────────────────────────────────────
    phone(60, "Welcome · 300×600"),
    { type: "ellipse" as const, x: 150, y: 180, width: 120, height: 120, roughness: 0, strokeColor: LINE, backgroundColor: "#f3f3f1", strokeWidth: 1 },
    text(90, 430, "Your designs, in\nyour repo", 24),
    text(90, 500, "Branch, commit and review boards\nthe same way your team ships code.", 12, MUTED),
    button(90, 600, "Get started"),

    // ── Artboard 2: Create account ───────────────────────────────────────
    phone(420, "Create account · 300×600"),
    text(450, 150, "Create account", 22),
    text(450, 210, "Email", 12, MUTED),
    field(450, 230, "name@studio.dev"),
    text(450, 300, "Password", 12, MUTED),
    field(450, 320, "••••••••"),
    button(450, 600, "Continue"),

    // ── Artboard 3: Connect repository ───────────────────────────────────
    phone(780, "Connect repository · 300×600"),
    text(810, 150, "Where do your\ndesigns live?", 22),
    field(810, 260, "GitHub"),
    field(810, 310, "GitLab"),
    field(810, 360, "Any git URL (SSH or HTTPS)"),
    text(810, 420, "You stay in the flow with your code.", 12, MUTED),
  ];
}

/** Convert an Excalidraw element skeleton to full elements (for template loads). */
export function toElements(skeleton: Parameters<typeof convertToExcalidrawElements>[0]) {
  return convertToExcalidrawElements(skeleton);
}
