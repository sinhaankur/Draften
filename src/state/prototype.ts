/**
 * prototype — real interactions between artboards (Figma/Sketch prototyping).
 *
 * A Link ties a source layer → a target frame, with a trigger (tap), an animation,
 * and a duration. Links are persisted (localStorage) and drive Play mode's
 * navigation. This replaces the hardcoded "Links on this page" list with real,
 * user-created connections.
 */

import { create } from "zustand";

export type Animation = "Instant" | "Dissolve" | "Smart animate" | "Push" | "Slide";

export interface ProtoLink {
  id: string;
  fromId: string;        // source element id (the hotspot)
  fromLabel: string;     // human label for the list
  toFrame: string;       // target frame id
  toLabel: string;       // target frame name
  trigger: "On tap";     // (only tap for now)
  animation: Animation;
  ms: number;
}

const KEY = "draften-prototype-links";

function load(): ProtoLink[] {
  try { const r = JSON.parse(localStorage.getItem(KEY) || "[]"); return Array.isArray(r) ? r : []; } catch { return []; }
}
function save(links: ProtoLink[]) {
  try { localStorage.setItem(KEY, JSON.stringify(links)); } catch { /* storage off */ }
}

interface PrototypeState {
  links: ProtoLink[];
  add: (l: Omit<ProtoLink, "id">) => void;
  remove: (id: string) => void;
  update: (id: string, patch: Partial<ProtoLink>) => void;
  /** the target frame for a given source element, if linked (Play uses this) */
  targetFor: (fromId: string) => ProtoLink | undefined;
}

export const usePrototype = create<PrototypeState>((set, get) => ({
  links: load(),
  add: (l) => set((s) => { const links = [...s.links, { ...l, id: crypto.randomUUID() }]; save(links); return { links }; }),
  remove: (id) => set((s) => { const links = s.links.filter((x) => x.id !== id); save(links); return { links }; }),
  update: (id, patch) => set((s) => { const links = s.links.map((x) => (x.id === id ? { ...x, ...patch } : x)); save(links); return { links }; }),
  targetFor: (fromId) => get().links.find((l) => l.fromId === fromId),
}));
