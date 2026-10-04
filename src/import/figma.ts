/**
 * Figma importer — open a user's Figma file.
 *
 * A local `.fig` is a proprietary binary (kiwi-encoded) with no public decoder,
 * so the honest, reliable way to open *your own* Figma file is Figma's official
 * **REST API**: with a personal access token + the file key (from the file URL),
 * `GET /v1/files/:key` returns the entire document as JSON. We walk that tree →
 * Draften nodes. It's the user's file and their token — Draften just reads it.
 *
 * This importer is `apiBased` (no bytes). The UI collects a token + a file URL /
 * key; we extract the key from a pasted URL automatically.
 */

import { createEmptyDocument, type Board, type DraftenDocument } from "../model/document";
import type { EllipseNode, FrameNode, Node, Paint, RectangleNode, TextNode } from "../model/node";
import type { ImportInput, ImportResult, Importer } from "./importer";

interface FigmaColor { r: number; g: number; b: number; a: number }
interface FigmaPaint { type: string; color?: FigmaColor; opacity?: number; visible?: boolean }
interface FigmaNode {
  id: string;
  name: string;
  type: string; // FRAME, GROUP, RECTANGLE, ELLIPSE, TEXT, COMPONENT, INSTANCE, CANVAS, DOCUMENT…
  children?: FigmaNode[];
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number } | null;
  fills?: FigmaPaint[];
  characters?: string;
  cornerRadius?: number;
  style?: { fontFamily?: string; fontSize?: number; fontWeight?: number; lineHeightPx?: number; textAlignHorizontal?: string };
  visible?: boolean;
}

/** Pull the file key out of a Figma URL, or accept a bare key. */
export function figmaFileKey(urlOrKey: string): string | null {
  const s = urlOrKey.trim();
  const m = s.match(/figma\.com\/(?:file|design)\/([A-Za-z0-9]+)/);
  if (m) return m[1];
  if (/^[A-Za-z0-9]{10,}$/.test(s)) return s; // looks like a bare key
  return null;
}

export class FigmaImporter implements Importer {
  id = "figma";
  label = "Figma (link + token)";
  extensions = [".fig"]; // only used to explain; real import is apiBased
  apiBased = true;

  canImport(input: ImportInput): boolean {
    return !!input.api?.token && !!input.api?.fileKey;
  }

  async import(input: ImportInput): Promise<ImportResult> {
    const token = input.api?.token;
    const fileKey = input.api?.fileKey && figmaFileKey(input.api.fileKey);
    if (!token || !fileKey) {
      throw new Error("Figma import needs a personal access token and a file URL/key.");
    }
    const warnings: string[] = [];

    const res = await fetch(`https://api.figma.com/v1/files/${fileKey}`, {
      headers: { "X-Figma-Token": token },
    });
    if (!res.ok) {
      if (res.status === 403) throw new Error("Figma rejected the token (403). Check it has file read access.");
      if (res.status === 404) throw new Error("Figma file not found (404). Check the URL/key and that the token can see it.");
      throw new Error(`Figma API error ${res.status}.`);
    }
    const json = (await res.json()) as { name?: string; document?: FigmaNode };
    const docRoot = json.document;
    if (!docRoot) throw new Error("Figma returned no document.");

    const name = json.name ?? "Figma import";
    const doc = createEmptyDocument(name);
    doc.importedFrom = "figma";
    doc.boards = [];

    // DOCUMENT → CANVAS (pages) → top-level nodes
    const pages = (docRoot.children ?? []).filter((c) => c.type === "CANVAS");
    for (const page of pages) {
      const board: Board = {
        id: page.id,
        name: page.name || "Page",
        kind: "design",
        children: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      };
      for (const child of page.children ?? []) {
        const node = this.mapNode(child, doc, warnings, undefined);
        if (node) board.children.push(node.id);
      }
      doc.boards.push(board);
    }
    if (doc.boards.length === 0) {
      warnings.push("No pages found; created an empty board.");
      doc.boards.push({ id: crypto.randomUUID(), name: "Page", kind: "design", children: [] });
    }
    return { document: doc, warnings };
  }

  // ── Figma node → Draften node ─────────────────────────────────────────────
  private mapNode(fn: FigmaNode, doc: DraftenDocument, warnings: string[], parentId: string | undefined): Node | undefined {
    const bb = fn.absoluteBoundingBox;
    const frame = bb ? { x: bb.x, y: bb.y, width: bb.width, height: bb.height } : { x: 0, y: 0, width: 100, height: 100 };
    const base = { id: fn.id, name: fn.name || fn.type, frame, parentId, visible: fn.visible !== false };

    switch (fn.type) {
      case "FRAME": case "GROUP": case "COMPONENT": case "COMPONENT_SET": case "INSTANCE": case "SECTION": {
        const node: FrameNode = { ...base, type: "frame", fills: this.fills(fn), cornerRadius: fn.cornerRadius, children: [] };
        doc.nodes[fn.id] = node;
        for (const child of fn.children ?? []) {
          const c = this.mapNode(child, doc, warnings, fn.id);
          if (c) node.children!.push(c.id);
        }
        return node;
      }
      case "RECTANGLE": case "VECTOR": case "LINE": case "STAR": case "REGULAR_POLYGON": {
        const node: RectangleNode = { ...base, type: "rectangle", fills: this.fills(fn), cornerRadius: fn.cornerRadius };
        doc.nodes[fn.id] = node;
        return node;
      }
      case "ELLIPSE": {
        const node: EllipseNode = { ...base, type: "ellipse", fills: this.fills(fn) };
        doc.nodes[fn.id] = node;
        return node;
      }
      case "TEXT": {
        const node: TextNode = {
          ...base, type: "text", text: fn.characters ?? "",
          fills: this.fills(fn, "#1d1d1b"),
          style: {
            fontFamily: fn.style?.fontFamily ?? "Inter",
            fontSize: fn.style?.fontSize ?? 16,
            fontWeight: fn.style?.fontWeight ?? 400,
            lineHeight: fn.style?.lineHeightPx ? fn.style.lineHeightPx / (fn.style?.fontSize ?? 16) : 1.4,
            align: (fn.style?.textAlignHorizontal?.toLowerCase() as "left" | "center" | "right") ?? "left",
          },
        };
        doc.nodes[fn.id] = node;
        return node;
      }
      default: {
        warnings.push(`Approximated unsupported Figma node "${fn.type}" as a frame.`);
        const node: FrameNode = { ...base, type: "frame", fills: this.fills(fn), children: [] };
        doc.nodes[fn.id] = node;
        for (const child of fn.children ?? []) {
          const c = this.mapNode(child, doc, warnings, fn.id);
          if (c) node.children!.push(c.id);
        }
        return node;
      }
    }
  }

  private fills(fn: FigmaNode, fallback?: string): Paint[] {
    const f = (fn.fills ?? []).find((x) => x.visible !== false && x.type === "SOLID" && x.color);
    if (f?.color) return [{ kind: "solid", color: this.hex(f.color) }];
    return fallback ? [{ kind: "solid", color: fallback }] : [{ kind: "none" }];
  }
  private hex(c: FigmaColor): string {
    const to = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
    return `#${to(c.r)}${to(c.g)}${to(c.b)}`;
  }
}
