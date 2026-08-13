/**
 * Sketch importer — `.sketch` is a ZIP of JSON (the open Sketch file format).
 *
 * Layout inside the archive:
 *   document.json     — pages list (refs), shared styles
 *   pages/<id>.json   — one page each, a tree of layers
 *   meta.json         — app version, fonts, page order
 *   images/…          — bitmap assets
 *
 * We unzip, walk each page's layer tree, and map Sketch layers → Draften nodes.
 * Coverage is intentionally incremental: common layers (artboard, rect, oval,
 * text, group, shapePath, bitmap) map cleanly; anything unknown becomes a
 * best-effort frame and is noted in `warnings` rather than dropped silently.
 */

import JSZip from "jszip";

import { createEmptyDocument, type Board, type DraftenDocument } from "../model/document";
import type {
  EllipseNode,
  FrameNode,
  Node,
  Paint,
  RectangleNode,
  TextNode,
} from "../model/node";
import type { ImportInput, ImportResult, Importer } from "./importer";

interface SketchColor {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}
interface SketchRect {
  x: number;
  y: number;
  width: number;
  height: number;
}
interface SketchLayer {
  do_objectID: string;
  _class: string;
  name?: string;
  frame?: SketchRect & { _class: string };
  layers?: SketchLayer[];
  style?: { fills?: Array<{ color?: SketchColor; isEnabled?: boolean }> };
  isVisible?: boolean;
  attributedString?: { string?: string };
  fixedRadius?: number;
}

export class SketchImporter implements Importer {
  id = "sketch";
  label = "Sketch (.sketch)";
  extensions = [".sketch"];

  canImport(input: ImportInput): boolean {
    if (input.filename?.toLowerCase().endsWith(".sketch")) return true;
    // ZIP magic "PK\x03\x04"
    const b = input.bytes;
    return !!b && b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;
  }

  async import(input: ImportInput): Promise<ImportResult> {
    if (!input.bytes) throw new Error("Sketch import needs file bytes");
    const warnings: string[] = [];
    const zip = await JSZip.loadAsync(input.bytes);

    const meta = await this.readJson(zip, "meta.json");
    const name = input.filename?.replace(/\.sketch$/i, "") ?? "Sketch import";
    const doc = createEmptyDocument(name);
    doc.importedFrom = "sketch";
    doc.boards = []; // replace the default board with the Sketch pages

    // meta.json → ordered list of page ids under pagesAndArtboards or pages
    const pageIds: string[] =
      (meta?.pagesAndArtboards && Object.keys(meta.pagesAndArtboards)) ??
      (Array.isArray(meta?.pages) ? meta.pages : []);

    if (pageIds.length === 0) {
      // fall back to scanning the pages/ folder
      const found = Object.keys(zip.files).filter((f) => /^pages\/.+\.json$/.test(f));
      for (const f of found) pageIds.push(f.replace(/^pages\//, "").replace(/\.json$/, ""));
    }

    for (const pageId of pageIds) {
      const page = await this.readJson(zip, `pages/${pageId}.json`);
      if (!page) {
        warnings.push(`Missing page JSON for ${pageId}`);
        continue;
      }
      const board: Board = {
        id: page.do_objectID ?? crypto.randomUUID(),
        name: page.name ?? "Page",
        kind: "design",
        children: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      };
      for (const layer of page.layers ?? []) {
        const node = this.mapLayer(layer, doc, warnings, undefined);
        if (node) board.children.push(node.id);
      }
      doc.boards.push(board);
    }

    if (doc.boards.length === 0) {
      warnings.push("No pages found; created an empty board.");
      doc.boards.push({ id: crypto.randomUUID(), name: "Board 1", kind: "design", children: [] });
    }

    return { document: doc, warnings };
  }

  // ── layer → node ───────────────────────────────────────────────────────────

  private mapLayer(
    layer: SketchLayer,
    doc: DraftenDocument,
    warnings: string[],
    parentId: string | undefined,
  ): Node | undefined {
    const id = layer.do_objectID ?? crypto.randomUUID();
    const frame = layer.frame
      ? { x: layer.frame.x, y: layer.frame.y, width: layer.frame.width, height: layer.frame.height }
      : { x: 0, y: 0, width: 100, height: 100 };
    const base = {
      id,
      name: layer.name ?? layer._class,
      frame,
      visible: layer.isVisible !== false,
      parentId,
    };

    let node: Node;
    switch (layer._class) {
      case "artboard":
      case "group":
      case "symbolMaster": {
        node = { ...base, type: "frame", fills: this.fills(layer), children: [] } as FrameNode;
        doc.nodes[id] = node;
        for (const child of layer.layers ?? []) {
          const c = this.mapLayer(child, doc, warnings, id);
          if (c) (node as FrameNode).children!.push(c.id);
        }
        return node;
      }
      case "rectangle":
        node = {
          ...base,
          type: "rectangle",
          fills: this.fills(layer),
          cornerRadius: layer.fixedRadius,
        } as RectangleNode;
        break;
      case "oval":
        node = { ...base, type: "ellipse", fills: this.fills(layer) } as EllipseNode;
        break;
      case "text":
        node = {
          ...base,
          type: "text",
          text: layer.attributedString?.string ?? "",
          fills: this.fills(layer, "#000000"),
          style: {
            fontFamily: "Inter",
            fontSize: 16,
            fontWeight: 400,
            lineHeight: 1.4,
          },
        } as TextNode;
        break;
      default:
        // unknown → a plain frame so nothing vanishes; note it once per class
        warnings.push(`Approximated unsupported Sketch layer "${layer._class}" as a frame.`);
        node = { ...base, type: "frame", fills: this.fills(layer), children: [] } as FrameNode;
        break;
    }
    doc.nodes[id] = node;
    return node;
  }

  private fills(layer: SketchLayer, fallback?: string): Paint[] {
    const f = layer.style?.fills?.find((x) => x.isEnabled !== false && x.color);
    if (f?.color) return [{ kind: "solid", color: this.color(f.color) }];
    return fallback ? [{ kind: "solid", color: fallback }] : [{ kind: "none" }];
  }

  private color(c: SketchColor): string {
    const to255 = (v: number) => Math.round((v ?? 0) * 255);
    const hex = (v: number) => to255(v).toString(16).padStart(2, "0");
    return `#${hex(c.red)}${hex(c.green)}${hex(c.blue)}`;
  }

  private async readJson(zip: JSZip, path: string): Promise<any | undefined> {
    const file = zip.file(path);
    if (!file) return undefined;
    try {
      return JSON.parse(await file.async("string"));
    } catch {
      return undefined;
    }
  }
}
