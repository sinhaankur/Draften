/**
 * App state — the document + design system, in a Zustand store.
 *
 * Since the canvas moved to Excalidraw (which owns drawing, selection, viewport,
 * undo/redo), this store's job narrowed to what Draften's *shell* owns: the
 * document metadata, the boards list, and the **design system** (brand · tokens ·
 * atomic component library) that the right-hand panel renders and the AI fills.
 * Keeping that in one place is what lets the ✦ AI action and importers funnel
 * their results through a single, reviewable path.
 */

import { create } from "zustand";

import { createEmptyDocument, type DraftenDocument } from "../model/document";
import type { DesignSystem } from "../model/design-system";

interface EditorState {
  doc: DraftenDocument;
  activeBoardId: string;

  // ── selectors ──
  activeBoard: () => DraftenDocument["boards"][number] | undefined;

  // ── mutations ──
  setActiveBoard: (id: string) => void;
  /** Replace the whole document (importers load a foreign file into here). */
  loadDocument: (doc: DraftenDocument) => void;
  /** Replace the design system (the ✦ AI generator loads its result here). */
  setDesignSystem: (ds: DesignSystem) => void;
  /** Rename the document. */
  rename: (name: string) => void;
}

const initialDoc = createEmptyDocument();

export const useEditor = create<EditorState>((set, get) => ({
  doc: initialDoc,
  activeBoardId: initialDoc.boards[0].id,

  activeBoard: () => {
    const { doc, activeBoardId } = get();
    return doc.boards.find((b) => b.id === activeBoardId);
  },

  setActiveBoard: (id) => set({ activeBoardId: id }),

  loadDocument: (doc) =>
    set({ doc, activeBoardId: doc.boards[0]?.id ?? "" }),

  setDesignSystem: (ds) =>
    set((s) => ({
      doc: { ...s.doc, designSystem: ds, updatedAt: new Date().toISOString() },
    })),

  rename: (name) =>
    set((s) => ({ doc: { ...s.doc, name, updatedAt: new Date().toISOString() } })),
}));
