/**
 * App state — the live document plus editor/session state, in a Zustand store.
 *
 * The document is the single source of truth (see model/document.ts); the store
 * wraps it with the editor concerns (active board, selection, viewport, tool) and
 * the mutation helpers every surface calls. Keeping mutations here (not scattered
 * across components) is what lets undo/redo, AI edits, and importers all funnel
 * through one place later.
 */

import { create } from "zustand";

import { createEmptyDocument, type DraftenDocument } from "../model/document";
import type { Node } from "../model/node";

export type ToolId =
  | "select"
  | "hand"
  | "frame"
  | "rectangle"
  | "ellipse"
  | "text"
  | "shape"
  | "connector"
  | "sticky";

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

interface EditorState {
  doc: DraftenDocument;
  activeBoardId: string;
  selection: string[];
  tool: ToolId;
  viewport: Viewport;

  // ── selectors ──
  activeBoard: () => DraftenDocument["boards"][number] | undefined;
  boardNodes: () => Node[];

  // ── mutations ──
  setTool: (tool: ToolId) => void;
  setViewport: (v: Partial<Viewport>) => void;
  select: (ids: string[]) => void;
  addNode: (node: Node) => void;
  updateNode: (id: string, patch: Partial<Node>) => void;
  removeNode: (id: string) => void;
  setActiveBoard: (id: string) => void;
  loadDocument: (doc: DraftenDocument) => void;
}

const initialDoc = createEmptyDocument();

export const useEditor = create<EditorState>((set, get) => ({
  doc: initialDoc,
  activeBoardId: initialDoc.boards[0].id,
  selection: [],
  tool: "select",
  viewport: { x: 0, y: 0, zoom: 1 },

  activeBoard: () => {
    const { doc, activeBoardId } = get();
    return doc.boards.find((b) => b.id === activeBoardId);
  },

  boardNodes: () => {
    const board = get().activeBoard();
    if (!board) return [];
    const { nodes } = get().doc;
    return board.children.map((id) => nodes[id]).filter(Boolean);
  },

  setTool: (tool) => set({ tool }),

  setViewport: (v) => set((s) => ({ viewport: { ...s.viewport, ...v } })),

  select: (ids) => set({ selection: ids }),

  addNode: (node) =>
    set((s) => {
      const board = s.doc.boards.find((b) => b.id === s.activeBoardId);
      if (!board) return s;
      return {
        doc: {
          ...s.doc,
          updatedAt: new Date().toISOString(),
          nodes: { ...s.doc.nodes, [node.id]: node },
          boards: s.doc.boards.map((b) =>
            b.id === board.id ? { ...b, children: [...b.children, node.id] } : b,
          ),
        },
        selection: [node.id],
      };
    }),

  updateNode: (id, patch) =>
    set((s) => {
      const existing = s.doc.nodes[id];
      if (!existing) return s;
      return {
        doc: {
          ...s.doc,
          updatedAt: new Date().toISOString(),
          nodes: { ...s.doc.nodes, [id]: { ...existing, ...patch } as Node },
        },
      };
    }),

  removeNode: (id) =>
    set((s) => {
      const nodes = { ...s.doc.nodes };
      delete nodes[id];
      return {
        doc: {
          ...s.doc,
          updatedAt: new Date().toISOString(),
          nodes,
          boards: s.doc.boards.map((b) => ({
            ...b,
            children: b.children.filter((c) => c !== id),
          })),
        },
        selection: s.selection.filter((sel) => sel !== id),
      };
    }),

  setActiveBoard: (id) => set({ activeBoardId: id, selection: [] }),

  loadDocument: (doc) =>
    set({
      doc,
      activeBoardId: doc.boards[0]?.id ?? "",
      selection: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    }),
}));
