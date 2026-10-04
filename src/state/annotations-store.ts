/**
 * annotations-store — pinned annotations on the canvas (design specs / review).
 *
 * An annotation is a NUMBERED pin anchored to a scene coordinate (not the screen),
 * with a note. Pins stay put as you pan/zoom; the number is a stable reference you
 * can cite in a review ("see ②"). Persisted on-device so notes survive reloads.
 * A `dropping` mode arms the canvas so a click drops the next pin — otherwise the
 * canvas behaves normally (annotations never get in the way of designing).
 */

import { create } from "zustand";

export interface Annotation {
  id: string;
  /** display number (1-based), kept contiguous via renumber() */
  n: number;
  /** scene coordinates (board space), so the pin is anchored to the design */
  x: number;
  y: number;
  text: string;
  createdAt: number;
}

const KEY = "draften-annotations";

function load(): Annotation[] {
  try { const a = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(a) ? a : []; } catch { return []; }
}
function save(a: Annotation[]) {
  try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* ignore */ }
}

/** Keep pin numbers contiguous + in creation order after an add/remove. */
export function renumber(list: Annotation[]): Annotation[] {
  return [...list]
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((a, i) => (a.n === i + 1 ? a : { ...a, n: i + 1 }));
}

const rid = () => `an-${Math.random().toString(36).slice(2, 9)}`;

export interface AnnotationsState {
  items: Annotation[];
  /** true while the user is placing a pin (a canvas click drops it) */
  dropping: boolean;
  setDropping: (v: boolean) => void;
  add: (x: number, y: number, text?: string) => string;
  update: (id: string, patch: Partial<Annotation>) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useAnnotations = create<AnnotationsState>((set, get) => ({
  items: load(),
  dropping: false,
  setDropping: (v) => set({ dropping: v }),
  add: (x, y, text = "") => {
    const id = rid();
    const items = renumber([...get().items, { id, n: 0, x, y, text, createdAt: Date.now() }]);
    save(items);
    set({ items });
    return id;
  },
  update: (id, patch) => {
    const items = get().items.map((a) => (a.id === id ? { ...a, ...patch } : a));
    save(items);
    set({ items });
  },
  remove: (id) => {
    const items = renumber(get().items.filter((a) => a.id !== id));
    save(items);
    set({ items });
  },
  clear: () => { save([]); set({ items: [] }); },
}));
