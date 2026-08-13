/**
 * Draften document model — the single source of truth.
 *
 * Every surface (canvas, code view, design-system panel, AI, importers,
 * exporters, git) reads and writes THIS model. Keeping one scene graph is the
 * whole architectural bet: it's what stops the surfaces from drifting the way
 * separate design/diagram/code/brand files do in the tools Draften replaces.
 *
 * A document is a tree of nodes grouped into boards (canvas management), plus the
 * design system (tokens + atomic component library) that the nodes reference.
 */

import type { DesignSystem } from "./design-system";
import type { Node } from "./node";

/** Semantic version of the on-disk document schema (migrations key off this). */
export const DOCUMENT_SCHEMA_VERSION = "0.1.0";

/**
 * A board = one page/canvas in the workspace. Boards are how "canvas management"
 * works: an infinite workspace organised into named, nestable surfaces (Figma
 * pages × FigJam boards). A board declares its intent so tools + rendering can
 * adapt (a journey map vs a UI design vs a flow diagram).
 */
export type BoardKind =
  | "design" // freeform vector / UI design (Figma/Sketch)
  | "diagram" // flowchart / architecture (OmniGraffle)
  | "journey" // UX journey map
  | "ideas" // mind-map / affinity map
  | "flow" // user flow / sitemap
  | "freeform"; // mixed

export interface Board {
  id: string;
  name: string;
  kind: BoardKind;
  /** child node ids (root-level nodes on this board) */
  children: string[];
  /** optional parent board id — boards can nest for organisation */
  parentId?: string;
  /** last-known viewport, so reopening a board restores the view */
  viewport?: { x: number; y: number; zoom: number };
}

/**
 * The whole document. `nodes` is a flat id→node map (fast lookup + stable refs);
 * tree structure lives in each node's `children`. `boards` are the top-level
 * surfaces. `designSystem` is the shared brand/token/component spine.
 */
export interface DraftenDocument {
  schemaVersion: string;
  id: string;
  name: string;
  /** app + document version — Draften versions itself and its documents */
  appVersion: string;
  createdAt: string;
  updatedAt: string;

  boards: Board[];
  /** flat map of every node in the document, keyed by id */
  nodes: Record<string, Node>;

  /** brand kit + design tokens + atomic component library */
  designSystem: DesignSystem;

  /** provenance — which tool a document/board was imported from, if any */
  importedFrom?: ImportSource;
}

export type ImportSource =
  | "sketch"
  | "figma"
  | "omnigraffle"
  | "xd"
  | "drawio"
  | "svg"
  | "native";

/** Create an empty document with one design board and an empty design system. */
export function createEmptyDocument(name = "Untitled", appVersion = "0.1.0"): DraftenDocument {
  const now = new Date().toISOString();
  const boardId = crypto.randomUUID();
  return {
    schemaVersion: DOCUMENT_SCHEMA_VERSION,
    id: crypto.randomUUID(),
    name,
    appVersion,
    createdAt: now,
    updatedAt: now,
    boards: [
      {
        id: boardId,
        name: "Board 1",
        kind: "design",
        children: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    ],
    nodes: {},
    designSystem: {
      brand: { name, logoNodeId: undefined },
      tokens: { colors: {}, typography: {}, spacing: {}, radii: {}, shadows: {} },
      components: [],
    },
    importedFrom: "native",
  };
}
