import { convertToExcalidrawElements, Excalidraw } from "@excalidraw/excalidraw";
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
export function ExcalidrawCanvas({ theme }: { theme?: "light" | "dark" }) {
  const initialData = useMemo(
    () => ({
      elements: convertToExcalidrawElements(seedSkeleton()),
      appState: {
        currentItemRoughness: 0, // crisp, precise shapes (not hand-drawn)
        currentItemFontFamily: 2, // Nunito — the normal (non-handwritten) font
        currentItemStrokeColor: "#5b34d6",
        viewBackgroundColor: theme === "dark" ? "#0c0e12" : "#edeff4",
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
function seedSkeleton() {
  return [
    // UI design card
    {
      type: "rectangle" as const,
      id: "card",
      x: 80,
      y: 90,
      width: 260,
      height: 160,
      roughness: 0,
      strokeColor: "#c9ceda",
      backgroundColor: "#ffffff",
      strokeWidth: 1,
      label: { text: "Create account", fontSize: 20, fontFamily: 2, strokeColor: "#171a21", verticalAlign: "top" as const },
    },
    // flow: start node
    {
      type: "rectangle" as const,
      id: "start",
      x: 440,
      y: 110,
      width: 140,
      height: 60,
      roughness: 0,
      strokeColor: "#5b34d6",
      backgroundColor: "#f4f0ff",
      strokeWidth: 1.5,
      label: { text: "App opened", fontSize: 16, fontFamily: 2, strokeColor: "#171a21" },
    },
    // flow: decision node
    {
      type: "diamond" as const,
      id: "decide",
      x: 660,
      y: 96,
      width: 150,
      height: 90,
      roughness: 0,
      strokeColor: "#1d8f7e",
      backgroundColor: "#eefaf7",
      strokeWidth: 1.5,
      label: { text: "Has account?", fontSize: 16, fontFamily: 2, strokeColor: "#171a21" },
    },
    // an arrow BOUND to both shapes — snaps to edges, follows on move
    {
      type: "arrow" as const,
      x: 580,
      y: 140,
      roughness: 0,
      strokeColor: "#5b34d6",
      strokeWidth: 1.5,
      start: { id: "start" },
      end: { id: "decide" },
    },
  ];
}
