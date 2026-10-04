/**
 * gitdiagram — turn a GitHub repo's file tree into a Draften DIAGRAM you can
 * read and edit, to UNDERSTAND a project at a glance.
 *
 * Inspired by gitdiagram.com (ahmedkhaleel2004/gitdiagram), which renders a repo
 * as an interactive architecture diagram. This is a native, deterministic take:
 * no LLM, no service — we read the real tree (github-api.listTree) and lay it out
 * as grouped frames (top-level directories = the project's components) with the
 * key files as shapes inside, nested directories as sub-groups. Grouping carries
 * the meaning (proximity = belonging), exactly the design principle the tool
 * teaches. Everything is editable Draften nodes.
 *
 *   buildGitDiagram(entries, { repo }) → DraftenDocument
 */

import { createEmptyDocument, type Board, type DraftenDocument } from "../model/document";
import type { FrameNode, Node, ShapeNode, TextNode } from "../model/node";
import type { TreeEntry } from "../git/github-api";

const PAD = 28;
const COL_W = 320;
const GAP = 48;
const FILE_H = 26;
const FILE_GAP = 8;
const HEADER = 56;
const MAX_FILES_PER_GROUP = 14;

// Common top-level roles → a short description + accent, so the diagram reads as
// architecture, not just folders. Honest: a label is a hint, never invented fact.
const ROLE: Record<string, { label: string; hue: string }> = {
  src: { label: "Source", hue: "#3d6b5f" },
  app: { label: "App", hue: "#3d6b5f" },
  components: { label: "UI components", hue: "#4b6bb0" },
  ui: { label: "UI", hue: "#4b6bb0" },
  lib: { label: "Library", hue: "#7a5bb0" },
  api: { label: "API", hue: "#b06a3d" },
  server: { label: "Server", hue: "#b06a3d" },
  tests: { label: "Tests", hue: "#5a8a4b" },
  test: { label: "Tests", hue: "#5a8a4b" },
  __tests__: { label: "Tests", hue: "#5a8a4b" },
  public: { label: "Static assets", hue: "#8e8d88" },
  assets: { label: "Assets", hue: "#8e8d88" },
  docs: { label: "Docs", hue: "#8e8d88" },
  scripts: { label: "Scripts", hue: "#b0983d" },
  packages: { label: "Packages", hue: "#7a5bb0" },
  styles: { label: "Styles", hue: "#b04b86" },
};

interface Group {
  name: string;
  dirs: Set<string>;
  files: string[]; // immediate + nested file basenames (deduped, capped)
  fileCount: number;
}

export interface GitDiagramOptions {
  repo?: string;
  branch?: string;
}

/** Group the flat tree by TOP-LEVEL directory; root files go in a "root" group. */
function groupByTopLevel(entries: TreeEntry[]): Group[] {
  const groups = new Map<string, Group>();
  const get = (name: string): Group => {
    let g = groups.get(name);
    if (!g) { g = { name, dirs: new Set(), files: [], fileCount: 0 }; groups.set(name, g); }
    return g;
  };
  for (const e of entries) {
    const parts = e.path.split("/");
    const top = parts.length === 1 ? "(root)" : parts[0];
    const g = get(top);
    if (e.type === "tree") { if (parts.length > 1) g.dirs.add(parts.slice(1).join("/")); }
    else {
      g.fileCount++;
      if (g.files.length < MAX_FILES_PER_GROUP) g.files.push(parts[parts.length - 1]);
    }
  }
  // sort: real dirs first (by file count desc), (root) last
  return [...groups.values()].sort((a, b) => {
    if (a.name === "(root)") return 1;
    if (b.name === "(root)") return -1;
    return b.fileCount - a.fileCount;
  });
}

export function buildGitDiagram(entries: TreeEntry[], opts: GitDiagramOptions = {}): DraftenDocument {
  const title = opts.repo ? `${opts.repo} — architecture` : "Repo architecture";
  const doc = createEmptyDocument(title);
  doc.boards = [];
  doc.nodes = {};

  const groups = groupByTopLevel(entries);
  const boardId = crypto.randomUUID();
  const children: string[] = [];

  // grid layout: as many columns as fit a readable canvas (3 across)
  const COLS = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(groups.length))));
  const colX = (i: number) => PAD + (i % COLS) * (COL_W + GAP);

  // compute each group's height, then place row by row so rows align to tallest
  const heights = groups.map((g) => HEADER + Math.min(g.files.length, MAX_FILES_PER_GROUP) * (FILE_H + FILE_GAP) + (g.dirs.size ? 28 : 0) + PAD);
  const rowY: number[] = [];
  for (let i = 0; i < groups.length; i++) {
    const row = Math.floor(i / COLS);
    if (rowY[row] === undefined) {
      const prevRow = row - 1;
      rowY[row] = prevRow < 0 ? PAD : rowY[prevRow] + rowHeight(heights, prevRow, COLS) + GAP;
    }
  }

  const groupFrameIds: string[] = [];
  groups.forEach((g, i) => {
    const x = colX(i);
    const y = rowY[Math.floor(i / COLS)];
    const h = heights[i];
    const role = ROLE[g.name.toLowerCase()];
    const accent = role?.hue ?? "#8e8d88";

    const frameId = crypto.randomUUID();
    groupFrameIds.push(frameId);
    const frame: FrameNode = {
      id: frameId, type: "frame", name: g.name,
      frame: { x, y, width: COL_W, height: h },
      fills: [{ kind: "solid", color: "#ffffff" }],
      stroke: { paint: { kind: "solid", color: "#e7e6e2" }, width: 1 },
      cornerRadius: 14, parentId: boardId, children: [],
    };
    doc.nodes[frameId] = frame as DraftenDocument["nodes"][string];
    children.push(frameId);

    const kid = (n: Node) => { doc.nodes[n.id] = n as DraftenDocument["nodes"][string]; frame.children!.push(n.id); };

    // header bar + title + role + count (relative to the frame)
    kid(rectNode("Accent", x, y, 6, h, accent, 14));
    kid(textNode("Folder name", x + 20, y + 16, COL_W - 40, g.name === "(root)" ? "Root files" : g.name, 17, 700, "#1d1d1b"));
    const sub = `${role?.label ? role.label + " · " : ""}${g.fileCount} file${g.fileCount === 1 ? "" : "s"}${g.dirs.size ? ` · ${g.dirs.size} sub-folder${g.dirs.size === 1 ? "" : "s"}` : ""}`;
    kid(textNode("Folder role", x + 20, y + 38, COL_W - 40, sub, 12, 400, "#8e8d88"));

    // key files as shape rows
    let fy = y + HEADER;
    g.files.forEach((f) => {
      kid(shapeNode(`File · ${f}`, x + 20, fy, COL_W - 40, FILE_H, f, accent));
      fy += FILE_H + FILE_GAP;
    });
    if (g.fileCount > g.files.length) {
      kid(textNode("More", x + 20, fy + 2, COL_W - 40, `+${g.fileCount - g.files.length} more…`, 11.5, 400, "#8e8d88"));
    }
  });

  // a light connector from the first "source" group to the others it likely uses
  const srcIdx = groups.findIndex((g) => ["src", "app"].includes(g.name.toLowerCase()));
  if (srcIdx >= 0) {
    for (let i = 0; i < groups.length; i++) {
      if (i === srcIdx) continue;
      if (!["components", "ui", "lib", "api", "packages"].includes(groups[i].name.toLowerCase())) continue;
      const id = crypto.randomUUID();
      doc.nodes[id] = {
        id, type: "connector", name: `${groups[srcIdx].name} → ${groups[i].name}`,
        frame: { x: 0, y: 0, width: 0, height: 0 },
        from: { nodeId: groupFrameIds[srcIdx] }, to: { nodeId: groupFrameIds[i] },
        routing: "orthogonal", stroke: { paint: { kind: "solid", color: "#c9c8c3" }, width: 1.5 },
        endArrow: "arrow",
      } as DraftenDocument["nodes"][string];
    }
  }

  const totalW = PAD * 2 + COLS * COL_W + (COLS - 1) * GAP;
  const totalH = (rowY[rowY.length - 1] ?? PAD) + rowHeight(heights, rowY.length - 1, COLS) + PAD;
  doc.boards.push({
    id: boardId, name: title, kind: "diagram", children,
    viewport: { x: 0, y: 0, zoom: 1 },
    frame: { x: 0, y: 0, width: Math.max(totalW, COL_W + PAD * 2), height: Math.max(totalH, 400) },
    background: "#f6f6f4",
  } as Board);

  return doc;
}

/** Tallest group height in a row (for stacking rows without overlap). */
function rowHeight(heights: number[], row: number, cols: number): number {
  if (row < 0) return 0;
  let max = 0;
  for (let i = row * cols; i < (row + 1) * cols && i < heights.length; i++) max = Math.max(max, heights[i]);
  return max;
}

// ── node helpers ─────────────────────────────────────────────────────────────

function rectNode(name: string, x: number, y: number, w: number, h: number, color: string, radius = 0): Node {
  return { id: crypto.randomUUID(), type: "rectangle", name, frame: { x, y, width: w, height: h }, fills: [{ kind: "solid", color }], ...(radius ? { cornerRadius: radius } : {}) } as Node;
}

function textNode(name: string, x: number, y: number, w: number, text: string, size: number, weight: number, color: string): TextNode {
  return {
    id: crypto.randomUUID(), type: "text", name,
    frame: { x, y, width: w, height: size * 1.4 },
    text, fills: [{ kind: "solid", color }],
    style: { fontFamily: "Inter", fontSize: size, fontWeight: weight, lineHeight: 1.3, align: "left" },
  } as TextNode;
}

function shapeNode(name: string, x: number, y: number, w: number, h: number, label: string, accent: string): ShapeNode {
  return {
    id: crypto.randomUUID(), type: "shape", shape: "roundRect", name,
    frame: { x, y, width: w, height: h },
    fills: [{ kind: "solid", color: "#f6f6f4" }],
    stroke: { paint: { kind: "solid", color: accent }, width: 1 },
    label,
  } as ShapeNode;
}
