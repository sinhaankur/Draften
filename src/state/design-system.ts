/**
 * design-system store — the editable Color & Text styles that make up a real,
 * usable design system. Ships with a sensible PREBUILT set (so the panel is never
 * empty — the "too native / bare" fix), and lets you CREATE, EDIT, and DELETE your
 * own, the way a component library is actually built. Persisted to localStorage so
 * your system sticks between sessions.
 */

import { create } from "zustand";

export interface ColorStyle { id: string; name: string; value: string }
export interface TextStyle { id: string; name: string; size: number; weight: number }

// Prebuilt defaults — a complete starter system, editable and deletable.
const DEFAULT_COLORS: ColorStyle[] = [
  { id: "c-primary", name: "Brand / Primary", value: "#3d6b5f" },
  { id: "c-primary-dark", name: "Brand / Primary Dark", value: "#2f5349" },
  { id: "c-accent", name: "Accent", value: "#e9b545" },
  { id: "c-ink", name: "Ink", value: "#1d1d1b" },
  { id: "c-muted", name: "Muted", value: "#8e8d88" },
  { id: "c-surface", name: "Surface", value: "#ffffff" },
  { id: "c-line", name: "Line", value: "#e7e6e2" },
];
const DEFAULT_TEXT: TextStyle[] = [
  { id: "t-display", name: "Display", size: 32, weight: 700 },
  { id: "t-heading", name: "Heading", size: 22, weight: 600 },
  { id: "t-subheading", name: "Subheading", size: 17, weight: 600 },
  { id: "t-body", name: "Body", size: 15, weight: 400 },
  { id: "t-caption", name: "Caption", size: 12, weight: 400 },
];

interface DSState {
  colors: ColorStyle[];
  texts: TextStyle[];
  addColor: (name: string, value: string) => void;
  updateColor: (id: string, patch: Partial<ColorStyle>) => void;
  removeColor: (id: string) => void;
  addText: (name: string, size: number, weight: number) => void;
  updateText: (id: string, patch: Partial<TextStyle>) => void;
  removeText: (id: string) => void;
  resetToDefaults: () => void;
}

const KEY = "draften-design-system";

function load(): { colors: ColorStyle[]; texts: TextStyle[] } {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (Array.isArray(p.colors) && Array.isArray(p.texts)) return p;
    }
  } catch { /* fall through to defaults */ }
  return { colors: DEFAULT_COLORS, texts: DEFAULT_TEXT };
}

function persist(colors: ColorStyle[], texts: TextStyle[]) {
  try { localStorage.setItem(KEY, JSON.stringify({ colors, texts })); } catch { /* ignore */ }
}

const uid = () => Math.random().toString(36).slice(2, 9);

export const useDesignSystem = create<DSState>((set) => ({
  ...load(),

  addColor: (name, value) => set((s) => {
    const colors = [...s.colors, { id: uid(), name: name.trim() || "New color", value }];
    persist(colors, s.texts); return { colors };
  }),
  updateColor: (id, patch) => set((s) => {
    const colors = s.colors.map((c) => (c.id === id ? { ...c, ...patch } : c));
    persist(colors, s.texts); return { colors };
  }),
  removeColor: (id) => set((s) => {
    const colors = s.colors.filter((c) => c.id !== id);
    persist(colors, s.texts); return { colors };
  }),

  addText: (name, size, weight) => set((s) => {
    const texts = [...s.texts, { id: uid(), name: name.trim() || "New style", size, weight }];
    persist(s.colors, texts); return { texts };
  }),
  updateText: (id, patch) => set((s) => {
    const texts = s.texts.map((t) => (t.id === id ? { ...t, ...patch } : t));
    persist(s.colors, texts); return { texts };
  }),
  removeText: (id) => set((s) => {
    const texts = s.texts.filter((t) => t.id !== id);
    persist(s.colors, texts); return { texts };
  }),

  resetToDefaults: () => set(() => {
    persist(DEFAULT_COLORS, DEFAULT_TEXT);
    return { colors: [...DEFAULT_COLORS], texts: [...DEFAULT_TEXT] };
  }),
}));
