import { convertToExcalidrawElements, Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import { useMemo } from "react";

import { loadSaved, scheduleSave } from "../io/persist";

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
    () => {
      // Restore the user's saved work if there is any (your work is never lost);
      // otherwise seed the welcome artboards on a true first launch.
      const saved = loadSaved();
      return {
        elements: saved ? (saved.elements as ReturnType<typeof convertToExcalidrawElements>) : convertToExcalidrawElements(seedSkeleton()),
        appState: {
          currentItemRoughness: 0, // crisp, precise shapes (not hand-drawn)
          currentItemFontFamily: 2, // Nunito — the normal (non-handwritten) font
          currentItemStrokeColor: "#3d6b5f",
          viewBackgroundColor: (saved?.appState?.viewBackgroundColor as string) ?? (theme === "dark" ? "#151514" : "#efeeeb"),
          gridSize: 20,
        },
        files: saved?.files as Record<string, never> | undefined,
        scrollToContent: true,
      };
    },
    // seed/restore once; the `theme` prop below drives light/dark
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Excalidraw
        initialData={initialData}
        excalidrawAPI={(api) => {
          onReady?.(api);
          // Frame all the artboards nicely on open (spacious, like the mockup)
          setTimeout(() => {
            try { api.scrollToContent(api.getSceneElements(), { fitToContent: true, animate: false }); } catch { /* ignore */ }
          }, 60);
        }}
        onChange={(elements, appState, files) => {
          // Auto-save (debounced) so closing the app never loses work.
          scheduleSave(() => ({ elements, appState: appState as unknown as Record<string, unknown>, files: files as unknown as Record<string, unknown> }));
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
const AW = 320, AH = 640; // artboard size

// Each artboard is a REAL frame; children are listed in the frame's `children`
// array (that's how Excalidraw's skeleton links them). Named layers → the tree
// reads well (SketchApp-style). Every child carries its own id.
let _sid = 0;
const sid = (p: string) => `${p}-${_sid++}`;

// Layer names ride in customData.name (Excalidraw preserves customData; the bare
// `name` field is dropped for non-frame elements). The Layers panel reads it.
function text(id: string, x: number, y: number, t: string, size = 15, color = INK, name?: string) {
  return { id, type: "text" as const, x, y, text: t, fontSize: size, fontFamily: 2, strokeColor: color, roughness: 0, ...(name ? { customData: { name } } : {}) };
}
function field(id: string, x: number, y: number, ph: string, name: string) {
  return { id, type: "rectangle" as const, x, y, width: 260, height: 42, roughness: 0, strokeColor: LINE, backgroundColor: SURF, strokeWidth: 1, roundness: { type: 3 } as const, customData: { name },
    label: { text: ph, fontSize: 13, fontFamily: 2, strokeColor: MUTED } };
}
function button(id: string, x: number, y: number, t: string, name = "Primary button") {
  return { id, type: "rectangle" as const, x, y, width: 260, height: 46, roughness: 0, strokeColor: ACC, backgroundColor: ACC, strokeWidth: 1, roundness: { type: 3 } as const, customData: { name },
    label: { text: t, fontSize: 14, fontFamily: 2, strokeColor: "#ffffff" } };
}

function seedSkeleton() {
  const x1 = 80, x2 = x1 + AW + 60, x3 = x2 + AW + 60;

  // Artboard 1: Welcome
  const w = {
    mark: { id: sid("w"), type: "ellipse" as const, x: x1 + 100, y: 170, width: 120, height: 120, roughness: 0, strokeColor: LINE, backgroundColor: "#f3f3f1", strokeWidth: 1, name: "Mark" },
    title: text(sid("w"), x1 + 28, 420, "Your designs, in\nyour repo", 24, INK, "Title"),
    body: text(sid("w"), x1 + 28, 500, "Branch, commit and review boards\nthe same way your team ships code.", 12, MUTED, "Body"),
    btn: button(sid("w"), x1 + 28, 620, "Get started"),
  };
  // Artboard 2: Create account
  const a = {
    title: text(sid("a"), x2 + 28, 150, "Create account", 22, INK, "Title"),
    emailL: text(sid("a"), x2 + 28, 210, "Email", 12, MUTED, "Email label"),
    emailF: field(sid("a"), x2 + 28, 230, "name@studio.dev", "Email field"),
    pwL: text(sid("a"), x2 + 28, 300, "Password", 12, MUTED, "Password label"),
    pwF: field(sid("a"), x2 + 28, 320, "••••••••", "Password field"),
    btn: button(sid("a"), x2 + 28, 620, "Continue"),
  };
  // Artboard 3: Connect repository
  const c = {
    title: text(sid("c"), x3 + 28, 150, "Where do your\ndesigns live?", 22, INK, "Title"),
    gh: field(sid("c"), x3 + 28, 250, "GitHub", "GitHub row"),
    gl: field(sid("c"), x3 + 28, 304, "GitLab", "GitLab row"),
    url: field(sid("c"), x3 + 28, 358, "Any git URL (SSH or HTTPS)", "Any git URL row"),
    note: text(sid("c"), x3 + 28, 430, "You stay in the flow with your code.", 12, MUTED, "Footnote"),
  };

  return [
    ...Object.values(w), ...Object.values(a), ...Object.values(c),
    { type: "frame" as const, name: "Welcome", x: x1, y: 80, width: AW, height: AH, children: Object.values(w).map((e) => e.id) },
    { type: "frame" as const, name: "Create account", x: x2, y: 80, width: AW, height: AH, children: Object.values(a).map((e) => e.id) },
    { type: "frame" as const, name: "Connect repository", x: x3, y: 80, width: AW, height: AH, children: Object.values(c).map((e) => e.id) },
  ];
}

/** Convert an Excalidraw element skeleton to full elements (for template loads). */
export function toElements(skeleton: Parameters<typeof convertToExcalidrawElements>[0]) {
  return convertToExcalidrawElements(skeleton);
}
