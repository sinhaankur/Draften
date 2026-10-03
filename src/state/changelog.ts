/**
 * Changelog — a reviewable, undoable history of every change to the document.
 *
 * An AI design tool must be honest about what it changed. Claude-design-grade means
 * the user sees each edit in plain language, can undo/redo, and can revert to any
 * point. Every mutation — AI or manual — records a ChangeEntry here, so the History
 * panel is the source of truth for "what happened and who did it."
 *
 * Design: entries are append-only; undo moves a cursor back (doesn't delete), so
 * redo works, and "revert to here" is just "set the cursor." Each entry carries the
 * structured `actions` the AI emitted (never an opaque blob) so the change is exact.
 *
 * © Ankur Sinha.
 */

import { create } from "zustand";

/** One structured edit (what the AI returns; also what a manual tool records). */
export interface ChangeAction {
  /** a stable verb: "create" | "update" | "delete" | "style" | "move" | "component" | "tokens" | "layout" | … */
  op: string;
  /** the target(s) this action touched (node ids, component ids, "tokens", "board:x") */
  target?: string;
  /** a compact, human-readable description of this one action */
  detail?: string;
  /** the raw payload (node data, token patch, etc.) — kept so the change is exact */
  payload?: unknown;
}

export interface ChangeEntry {
  id: string;
  /** ISO timestamp */
  time: string;
  /** who made the change */
  author: "ai" | "you" | "import" | "plugin";
  /** one plain-language line for the History panel ("AI added a 3-field sign-up form") */
  summary: string;
  /** the structured actions that made up this change */
  actions: ChangeAction[];
  /** optional provider/model that produced an AI change (for provenance) */
  via?: string;
}

export interface ChangelogState {
  /** append-only list, oldest first */
  entries: ChangeEntry[];
  /** index of the last APPLIED entry (+1). entries[0..cursor-1] are "active". */
  cursor: number;

  /** Record a new change. Truncates any redo tail (new branch), then appends. */
  record: (e: Omit<ChangeEntry, "id" | "time"> & { time?: string }) => ChangeEntry;
  /** Move the cursor back one (undo). Returns the undone entry, or null. */
  undo: () => ChangeEntry | null;
  /** Move the cursor forward one (redo). Returns the redone entry, or null. */
  redo: () => ChangeEntry | null;
  /** Set the cursor to just-after entry `id` ("revert to this point"). */
  revertTo: (id: string) => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  /** The currently-active entries (what's "live" given the cursor). */
  active: () => ChangeEntry[];
  clear: () => void;
}

let _seq = 0;
function nextId(): string {
  _seq += 1;
  return `chg_${Date.now().toString(36)}_${_seq}`;
}

export const useChangelog = create<ChangelogState>((set, get) => ({
  entries: [],
  cursor: 0,

  record: (e) => {
    const entry: ChangeEntry = {
      id: nextId(),
      time: e.time ?? new Date().toISOString(),
      author: e.author,
      summary: e.summary,
      actions: e.actions,
      via: e.via,
    };
    set((s) => {
      // a new change after an undo discards the redo tail (a fresh branch)
      const kept = s.entries.slice(0, s.cursor);
      const entries = [...kept, entry];
      return { entries, cursor: entries.length };
    });
    return entry;
  },

  undo: () => {
    const { cursor, entries } = get();
    if (cursor <= 0) return null;
    const undone = entries[cursor - 1];
    set({ cursor: cursor - 1 });
    return undone;
  },

  redo: () => {
    const { cursor, entries } = get();
    if (cursor >= entries.length) return null;
    const redone = entries[cursor];
    set({ cursor: cursor + 1 });
    return redone;
  },

  revertTo: (id) => {
    const { entries } = get();
    const idx = entries.findIndex((e) => e.id === id);
    if (idx >= 0) set({ cursor: idx + 1 });
  },

  canUndo: () => get().cursor > 0,
  canRedo: () => get().cursor < get().entries.length,
  active: () => get().entries.slice(0, get().cursor),
  clear: () => set({ entries: [], cursor: 0 }),
}));
