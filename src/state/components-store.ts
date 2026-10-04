/**
 * components-store — the component library (masters), on-device + opt-in.
 *
 * Holds the captured component definitions and an `enabled` flag, so components
 * are strictly opt-in: the app designs fine without the library, and you turn it
 * on only when you want reuse. Persisted to localStorage so the library sticks
 * across launches (per the "designs live with you" principle).
 */

import { create } from "zustand";

import type { ComponentDef } from "../canvas/components";

const LIB_KEY = "draften-components";
const ENABLED_KEY = "draften-components-enabled";

function load(): ComponentDef[] {
  try { return JSON.parse(localStorage.getItem(LIB_KEY) || "[]"); } catch { return []; }
}
function save(defs: ComponentDef[]) {
  try { localStorage.setItem(LIB_KEY, JSON.stringify(defs)); } catch { /* ignore */ }
}
function loadEnabled(): boolean {
  try { return localStorage.getItem(ENABLED_KEY) === "1"; } catch { return false; }
}

export interface ComponentsState {
  enabled: boolean;
  defs: ComponentDef[];
  setEnabled: (v: boolean) => void;
  add: (def: ComponentDef) => void;
  update: (id: string, patch: Partial<ComponentDef>) => void;
  remove: (id: string) => void;
}

export const useComponents = create<ComponentsState>((set, get) => ({
  enabled: loadEnabled(),
  defs: load(),
  setEnabled: (v) => { try { localStorage.setItem(ENABLED_KEY, v ? "1" : "0"); } catch { /* ignore */ } set({ enabled: v }); },
  add: (def) => { const defs = [def, ...get().defs]; save(defs); set({ defs }); },
  update: (id, patch) => { const defs = get().defs.map((d) => (d.id === id ? { ...d, ...patch } : d)); save(defs); set({ defs }); },
  remove: (id) => { const defs = get().defs.filter((d) => d.id !== id); save(defs); set({ defs }); },
}));
