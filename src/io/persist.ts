/**
 * persist — your work is never lost.
 *
 * The biggest thing that made Draften "not a real app you can design in" was
 * that closing it threw your work away. A good design tool (Sketch, Figma) never
 * loses work. This saves the canvas to localStorage on every change (debounced)
 * and restores it on open. First launch (nothing saved) → the seed.
 *
 * It's local + offline + free — no cloud, no account. Export/commit for anything
 * you want to keep elsewhere.
 */

const KEY = "draften-canvas-v1";

type Saved = {
  elements: readonly unknown[];
  appState?: Record<string, unknown>;
  files?: Record<string, unknown>;
  savedAt: number;
};

export function loadSaved(): Saved | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Saved;
    if (!data || !Array.isArray(data.elements)) return null;
    return data;
  } catch {
    return null;
  }
}

/** Debounced save — called on every Excalidraw change. */
let timer: ReturnType<typeof setTimeout> | null = null;
export function scheduleSave(get: () => { elements: readonly unknown[]; appState: Record<string, unknown>; files: Record<string, unknown> }) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    try {
      const { elements, appState, files } = get();
      const payload: Saved = {
        elements,
        // only the view bits worth keeping — not transient selection/pointer state
        appState: { viewBackgroundColor: appState.viewBackgroundColor, gridSize: appState.gridSize, scrollX: appState.scrollX, scrollY: appState.scrollY, zoom: appState.zoom },
        files,
        savedAt: Date.now(),
      };
      localStorage.setItem(KEY, JSON.stringify(payload));
    } catch { /* storage full or disabled — app still works, just no autosave */ }
  }, 600);
}

export function clearSaved() {
  try { localStorage.removeItem(KEY); } catch { /* nothing to clear */ }
}

export function hasSaved(): boolean {
  try { return !!localStorage.getItem(KEY); } catch { return false; }
}
