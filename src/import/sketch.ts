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
  Stroke,
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
/** One run of attributes inside an attributedString (font, size, colour). */
interface SketchTextAttribute {
  MSAttributedStringFontAttribute?: { attributes?: { name?: string; size?: number } };
  MSAttributedStringColorAttribute?: SketchColor;
  kerning?: number;
}
interface SketchLayer {
  do_objectID: string;
  _class: string;
  name?: string;
  frame?: SketchRect & { _class: string };
  layers?: SketchLayer[];
  rotation?: number; // degrees, clockwise-positive in Sketch
  style?: {
    fills?: Array<{ color?: SketchColor; isEnabled?: boolean }>;
    borders?: Array<{ color?: SketchColor; isEnabled?: boolean; thickness?: number }>;
    contextSettings?: { opacity?: number };
  };
  isVisible?: boolean;
  attributedString?: {
    string?: string;
    attributes?: Array<{ attributes?: SketchTextAttribute }>;
  };
  fixedRadius?: number;
  /** bitmap layers reference an image file inside the archive */
  image?: { _ref?: string };
  /** shapePath vector geometry: normalized curvePoints + closed flag */
  isClosed?: boolean;
  points?: Array<{
    point?: string;        // "{x, y}" normalized 0..1
    curveFrom?: string;
    curveTo?: string;
    hasCurveFrom?: boolean;
    hasCurveTo?: boolean;
  }>;
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

    // Pre-load every embedded image as a data URL so bitmap layers render as
    // REAL pictures (not blank frames). The .sketch archive carries the PNG/JPG
    // bytes directly under images/… and each bitmap layer references one by path.
    const images = await this.loadImages(zip);

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
        const node = this.mapLayer(layer, doc, warnings, undefined, images);
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
    images: Map<string, string>,
  ): Node | undefined {
    const id = layer.do_objectID ?? crypto.randomUUID();
    const frame = layer.frame
      ? { x: layer.frame.x, y: layer.frame.y, width: layer.frame.width, height: layer.frame.height }
      : { x: 0, y: 0, width: 100, height: 100 };
    const opacity = layer.style?.contextSettings?.opacity;
    const base = {
      id,
      name: layer.name ?? layer._class,
      frame,
      visible: layer.isVisible !== false,
      parentId,
      // Sketch rotation is degrees clockwise; the model stores radians.
      ...(layer.rotation ? { rotation: (-layer.rotation * Math.PI) / 180 } : {}),
      ...(opacity !== undefined && opacity < 1 ? { opacity } : {}),
    };
    const stroke = this.stroke(layer);

    let node: Node;
    switch (layer._class) {
      case "artboard":
      case "group":
      case "symbolMaster": {
        node = { ...base, type: "frame", fills: this.fills(layer), ...(stroke ? { stroke } : {}), children: [] } as FrameNode;
        doc.nodes[id] = node;
        for (const child of layer.layers ?? []) {
          const c = this.mapLayer(child, doc, warnings, id, images);
          if (c) (node as FrameNode).children!.push(c.id);
        }
        return node;
      }
      case "shapePath": {
        // vector shape → an editable path node (SVG d built from normalized curvePoints)
        const d = this.shapePathD(layer);
        if (d) {
          node = { ...base, type: "path", d, fills: this.fills(layer), ...(stroke ? { stroke } : {}) } as Node;
          doc.nodes[id] = node;
          return node;
        }
        node = { ...base, type: "frame", fills: this.fills(layer), ...(stroke ? { stroke } : {}), children: [] } as FrameNode;
        break;
      }
      case "bitmap": {
        // a real image: resolve the referenced file to its data URL
        const ref = layer.image?._ref;
        const src = ref ? images.get(ref) : undefined;
        if (src) {
          node = { ...base, type: "image", src, fit: "fill" } as Node;
          doc.nodes[id] = node;
          return node;
        }
        // image bytes missing → a labelled frame so the layout still reads
        node = { ...base, type: "frame", fills: [{ kind: "none" }], children: [] } as FrameNode;
        break;
      }
      case "rectangle":
        node = {
          ...base,
          type: "rectangle",
          fills: this.fills(layer),
          cornerRadius: layer.fixedRadius,
          ...(stroke ? { stroke } : {}),
        } as RectangleNode;
        break;
      case "oval":
        node = { ...base, type: "ellipse", fills: this.fills(layer), ...(stroke ? { stroke } : {}) } as EllipseNode;
        break;
      case "text": {
        const attr = layer.attributedString?.attributes?.[0]?.attributes;
        const font = attr?.MSAttributedStringFontAttribute?.attributes;
        const color = attr?.MSAttributedStringColorAttribute;
        node = {
          ...base,
          type: "text",
          text: layer.attributedString?.string ?? "",
          fills: color ? [{ kind: "solid", color: this.color(color) }] : this.fills(layer, "#000000"),
          style: {
            fontFamily: this.fontFamily(font?.name) ?? "Inter",
            fontSize: font?.size ?? 16,
            fontWeight: this.fontWeight(font?.name),
            lineHeight: 1.4,
            ...(attr?.kerning ? { letterSpacing: attr.kerning } : {}),
          },
        } as TextNode;
        break;
      }
      default: {
        // unknown → a frame so nothing vanishes; note it once per class. If it's
        // a container (shapeGroup, etc.) recurse so nested layers aren't lost.
        warnings.push(`Approximated unsupported Sketch layer "${layer._class}" as a frame.`);
        const frameNode = { ...base, type: "frame", fills: this.fills(layer), ...(stroke ? { stroke } : {}), children: [] } as FrameNode;
        doc.nodes[id] = frameNode;
        for (const child of layer.layers ?? []) {
          const c = this.mapLayer(child, doc, warnings, id, images);
          if (c) frameNode.children!.push(c.id);
        }
        return frameNode;
      }
    }
    doc.nodes[id] = node;
    return node;
  }

  /**
   * Build an absolute SVG path `d` from a Sketch shapePath. Sketch stores each
   * curvePoint's `point`/`curveTo`/`curveFrom` as NORMALISED (0..1) coordinates
   * of the layer frame; we scale by the frame size + offset to the layer's
   * position, emitting cubic beziers between consecutive points (honouring each
   * point's control handles), closing the path when `isClosed`.
   */
  private shapePathD(layer: SketchLayer): string | undefined {
    const pts = layer.points;
    const f = layer.frame;
    if (!pts || pts.length < 2 || !f) return undefined;
    const r = (v: number) => Math.round(v * 100) / 100;
    const sx = (nx: number) => r(f.x + nx * f.width);
    const sy = (ny: number) => r(f.y + ny * f.height);
    const P = (s?: string): [number, number] | null => {
      const m = /\{\s*(-?[\d.eE]+)\s*,\s*(-?[\d.eE]+)\s*\}/.exec(s ?? "");
      return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
    };
    const first = P(pts[0].point);
    if (!first) return undefined;
    const d: string[] = [`M ${sx(first[0])} ${sy(first[1])}`];
    const n = pts.length;
    const last = layer.isClosed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const pa = P(a.point), pb = P(b.point);
      if (!pa || !pb) continue;
      const c1 = a.hasCurveFrom ? P(a.curveFrom) : null;
      const c2 = b.hasCurveTo ? P(b.curveTo) : null;
      if (c1 || c2) {
        const h1 = c1 ?? pa, h2 = c2 ?? pb;
        d.push(`C ${sx(h1[0])} ${sy(h1[1])} ${sx(h2[0])} ${sy(h2[1])} ${sx(pb[0])} ${sy(pb[1])}`);
      } else {
        d.push(`L ${sx(pb[0])} ${sy(pb[1])}`);
      }
    }
    if (layer.isClosed) d.push("Z");
    return d.join(" ");
  }

  /** Read every images/… entry in the archive into a path → data-URL map. */
  private async loadImages(zip: JSZip): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    const entries = Object.keys(zip.files).filter((f) => /^images\/.+\.(png|jpe?g|gif|webp|pdf)$/i.test(f));
    for (const path of entries) {
      const file = zip.file(path);
      if (!file) continue;
      try {
        const b64 = await file.async("base64");
        const mime = this.mimeOf(path);
        out.set(path, `data:${mime};base64,${b64}`);
      } catch { /* skip unreadable image */ }
    }
    return out;
  }

  private mimeOf(path: string): string {
    const ext = path.toLowerCase().split(".").pop();
    return ext === "jpg" || ext === "jpeg" ? "image/jpeg"
      : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp"
      : ext === "pdf" ? "application/pdf" : "image/png";
  }

  private fills(layer: SketchLayer, fallback?: string): Paint[] {
    const f = layer.style?.fills?.find((x) => x.isEnabled !== false && x.color);
    if (f?.color) return [{ kind: "solid", color: this.color(f.color) }];
    return fallback ? [{ kind: "solid", color: fallback }] : [{ kind: "none" }];
  }

  /** First enabled border → a model Stroke. */
  private stroke(layer: SketchLayer): Stroke | undefined {
    const b = layer.style?.borders?.find((x) => x.isEnabled !== false && x.color);
    if (!b?.color) return undefined;
    return { paint: { kind: "solid", color: this.color(b.color) }, width: b.thickness ?? 1 };
  }

  /** Sketch font PostScript names are like "Inter-SemiBold"; take the family. */
  private fontFamily(psName?: string): string | undefined {
    if (!psName) return undefined;
    return psName.split("-")[0].replace(/([a-z])([A-Z])/g, "$1 $2");
  }
  /** Map a weight word in the PostScript name to a numeric weight. */
  private fontWeight(psName?: string): number {
    const n = (psName ?? "").toLowerCase();
    if (n.includes("thin")) return 100;
    if (n.includes("extralight") || n.includes("ultralight")) return 200;
    if (n.includes("light")) return 300;
    if (n.includes("medium")) return 500;
    if (n.includes("semibold") || n.includes("demibold")) return 600;
    if (n.includes("extrabold") || n.includes("ultrabold")) return 800;
    if (n.includes("black") || n.includes("heavy")) return 900;
    if (n.includes("bold")) return 700;
    return 400;
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
