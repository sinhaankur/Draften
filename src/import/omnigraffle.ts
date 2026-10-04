/**
 * OmniGraffle importer — open a user's `.graffle` document.
 *
 * OmniGraffle stores its documents as an Apple **binary property list**, usually
 * **gzip-compressed**. On disk it's one of:
 *   - a single-file `.graffle`  → gzipped bplist (or a flat XML plist)
 *   - a `.graffle` **package**   → a folder/zip whose `data.plist` is the bplist
 *
 * We detect the container, decompress if needed (fflate), parse the bplist
 * (import/bplist.ts), then walk OmniGraffle's `GraphicsList` → Draften nodes:
 *   ShapedGraphic → shape / rectangle / ellipse / text
 *   LineGraphic   → connector (with its arrowheads + endpoints)
 *   Group         → frame with children
 *
 * It's the user's own file — Draften opens it rather than locking them out.
 * Coverage is incremental; unknown graphics become a best-effort shape + a
 * warning, and the on-device tiny LLM can later refine ambiguous mappings.
 */

import { gunzipSync } from "fflate";
import JSZip from "jszip";

import { createEmptyDocument, type Board, type DraftenDocument } from "../model/document";
import type { ConnectorNode, FrameNode, Node, Paint, ShapeNode, TextNode } from "../model/node";
import { parseBinaryPlist } from "./bplist";
import type { ImportInput, ImportResult, Importer } from "./importer";

/* Loose shapes of the OmniGraffle plist (only the fields we read). */
type OGColor = { r?: string; g?: string; b?: string; w?: string } | undefined;
interface OGGraphic {
  Class?: string;
  ID?: number;
  Bounds?: string;             // "{{x, y}, {w, h}}"
  Shape?: string;              // "Rectangle" | "Circle" | "Diamond" | ...
  Text?: { Text?: string };    // RTF-ish; we strip to plain
  Style?: { fill?: { Color?: OGColor }; stroke?: { Color?: OGColor; Width?: number } };
  Points?: string[];           // line endpoints
  Head?: { ID?: number };      // connector target graphic id
  Tail?: { ID?: number };      // connector source graphic id
  Graphics?: OGGraphic[];      // group children
  Name?: string;
}

export class OmniGraffleImporter implements Importer {
  id = "omnigraffle";
  label = "OmniGraffle (.graffle)";
  extensions = [".graffle"];

  canImport(input: ImportInput): boolean {
    if (input.filename?.toLowerCase().endsWith(".graffle")) return true;
    const b = input.bytes;
    if (!b || b.length < 4) return false;
    // gzip magic 1f 8b, or zip "PK", or "bplist"
    if (b[0] === 0x1f && b[1] === 0x8b) return true;
    if (b[0] === 0x50 && b[1] === 0x4b) return true;
    return b.length >= 6 && String.fromCharCode(b[0], b[1], b[2], b[3], b[4], b[5]) === "bplist";
  }

  async import(input: ImportInput): Promise<ImportResult> {
    if (!input.bytes) throw new Error("OmniGraffle import needs file bytes");
    const warnings: string[] = [];
    const plistBytes = await this.extractPlistBytes(input.bytes, warnings);

    let root: unknown;
    try {
      root = parseBinaryPlist(plistBytes);
    } catch (e) {
      throw new Error(`Could not read the OmniGraffle file: ${(e as Error).message}`);
    }

    const name = input.filename?.replace(/\.graffle$/i, "") ?? "OmniGraffle import";
    const doc = createEmptyDocument(name);
    doc.importedFrom = "omnigraffle";
    doc.boards = [];

    // OmniGraffle: top dict has "Sheets" (multi-canvas) or a single "GraphicsList".
    const sheets = this.sheetsOf(root);
    sheets.forEach((sheet, i) => {
      const board: Board = {
        id: crypto.randomUUID(),
        name: (sheet.name as string) || (sheets.length > 1 ? `Canvas ${i + 1}` : "Canvas"),
        kind: "diagram",
        children: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      };
      for (const g of sheet.graphics) {
        const node = this.mapGraphic(g, doc, warnings, undefined);
        if (node) board.children.push(node.id);
      }
      doc.boards.push(board);
    });

    if (doc.boards.length === 0) {
      warnings.push("No canvases found; created an empty diagram board.");
      doc.boards.push({ id: crypto.randomUUID(), name: "Canvas", kind: "diagram", children: [] });
    }
    return { document: doc, warnings };
  }

  /** Get the raw bplist bytes out of whatever container we were handed. */
  private async extractPlistBytes(bytes: Uint8Array, warnings: string[]): Promise<Uint8Array> {
    // gzip?
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
      return gunzipSync(bytes);
    }
    // zip package? find data.plist (may itself be gzipped)
    if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
      const zip = await JSZip.loadAsync(bytes);
      const entry =
        zip.file("data.plist") ||
        zip.file(/(^|\/)data\.plist$/)[0] ||
        zip.file(/\.plist$/)[0];
      if (!entry) throw new Error("No data.plist inside the .graffle package");
      const inner = await entry.async("uint8array");
      return inner[0] === 0x1f && inner[1] === 0x8b ? gunzipSync(inner) : inner;
    }
    // already a bplist
    if (String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5]) === "bplist") {
      return bytes;
    }
    // flat XML plist — not binary; note and let the parser throw a clear error
    warnings.push("This looks like an XML (not binary) OmniGraffle file; some data may be approximated.");
    return bytes;
  }

  /** Normalise the plist into a list of {name, graphics} sheets. */
  private sheetsOf(root: unknown): Array<{ name?: string; graphics: OGGraphic[] }> {
    const r = root as Record<string, unknown>;
    if (Array.isArray(r?.Sheets)) {
      return (r.Sheets as Record<string, unknown>[]).map((s) => ({
        name: s.SheetTitle as string,
        graphics: (s.GraphicsList as OGGraphic[]) ?? [],
      }));
    }
    if (Array.isArray(r?.GraphicsList)) {
      return [{ name: r.SheetTitle as string, graphics: r.GraphicsList as OGGraphic[] }];
    }
    return [];
  }

  // ── graphic → node ──────────────────────────────────────────────────────────

  private mapGraphic(g: OGGraphic, doc: DraftenDocument, warnings: string[], parentId: string | undefined): Node | undefined {
    const id = g.ID != null ? `og-${g.ID}` : crypto.randomUUID();
    const frame = this.bounds(g.Bounds);
    const base = { id, name: g.Name ?? g.Class ?? "Shape", frame, parentId, visible: true };

    // Group → frame with children
    if (g.Class === "Group" && Array.isArray(g.Graphics)) {
      const node: FrameNode = { ...base, type: "frame", fills: [{ kind: "none" }], children: [] };
      doc.nodes[id] = node;
      for (const child of g.Graphics) {
        const c = this.mapGraphic(child, doc, warnings, id);
        if (c) node.children!.push(c.id);
      }
      return node;
    }

    // Line → connector
    if (g.Class === "LineGraphic") {
      const node: ConnectorNode = {
        ...base,
        type: "connector",
        from: g.Tail?.ID != null ? { nodeId: `og-${g.Tail.ID}` } : { nodeId: "", point: this.point(g.Points?.[0]) },
        to: g.Head?.ID != null ? { nodeId: `og-${g.Head.ID}` } : { nodeId: "", point: this.point(g.Points?.[g.Points.length - 1]) },
        routing: "orthogonal",
        stroke: { paint: { kind: "solid", color: this.color(g.Style?.stroke?.Color) ?? "#5d5c58" }, width: g.Style?.stroke?.Width ?? 1 },
        endArrow: "arrow",
      };
      doc.nodes[id] = node;
      return node;
    }

    // ShapedGraphic → shape / text
    if (g.Class === "ShapedGraphic" || g.Shape || g.Text) {
      const label = this.plainText(g.Text?.Text);
      // pure text block (no real shape) → text node
      if (label && (!g.Shape || g.Shape === "Rectangle") && this.color(g.Style?.fill?.Color) == null) {
        const node: TextNode = {
          ...base, type: "text", text: label,
          fills: [{ kind: "solid", color: "#1d1d1b" }],
          style: { fontFamily: "Inter", fontSize: 14, fontWeight: 400, lineHeight: 1.4, align: "center" },
        };
        doc.nodes[id] = node;
        return node;
      }
      const node: ShapeNode = {
        ...base, type: "shape",
        shape: this.shapeKind(g.Shape),
        fills: [{ kind: "solid", color: this.color(g.Style?.fill?.Color) ?? "#ffffff" }],
        stroke: { paint: { kind: "solid", color: this.color(g.Style?.stroke?.Color) ?? "#d8d7d2" }, width: g.Style?.stroke?.Width ?? 1 },
        label: label || undefined,
      };
      doc.nodes[id] = node;
      return node;
    }

    warnings.push(`Approximated unsupported OmniGraffle graphic "${g.Class ?? "?"}" as a shape.`);
    const node: ShapeNode = { ...base, type: "shape", shape: "rect", fills: [{ kind: "none" }] };
    doc.nodes[id] = node;
    return node;
  }

  private shapeKind(s?: string): ShapeNode["shape"] {
    switch ((s ?? "").toLowerCase()) {
      case "circle": case "ellipse": return "ellipse";
      case "diamond": return "diamond";
      case "cylinder": return "cylinder";
      case "hexagon": return "hexagon";
      case "cloud": return "cloud";
      case "roundrect": case "rounded rectangle": return "roundRect";
      default: return "rect";
    }
  }

  /** OmniGraffle bounds string "{{x, y}, {w, h}}" → Rect. */
  private bounds(s?: string) {
    const nums = (s ?? "").match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
    const [x = 0, y = 0, width = 100, height = 60] = nums;
    return { x, y, width, height };
  }
  private point(s?: string) {
    const nums = (s ?? "").match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
    return { x: nums[0] ?? 0, y: nums[1] ?? 0 };
  }

  /** OmniGraffle colours are 0..1 floats stored as strings (r/g/b or w grey). */
  private color(c: OGColor): string | null {
    if (!c) return null;
    const to = (v?: string) => Math.round((v ? parseFloat(v) : 0) * 255);
    const hex = (v: number) => v.toString(16).padStart(2, "0");
    if (c.w != null) { const g = to(c.w); return `#${hex(g)}${hex(g)}${hex(g)}`; }
    if (c.r != null || c.g != null || c.b != null) return `#${hex(to(c.r))}${hex(to(c.g))}${hex(to(c.b))}`;
    return null;
  }

  /** Strip OmniGraffle's RTF-ish text down to a plain label. */
  private plainText(t?: string): string {
    if (!t) return "";
    // real OG text is RTF; pull the readable run after the last control word group
    const noRtf = t.replace(/\{\\[^}]*\}/g, "").replace(/\\[a-z]+-?\d* ?/gi, "").replace(/[{}]/g, "");
    return noRtf.trim();
  }
}

/** A single enabled solid fill helper mirrors the Sketch importer's shape. */
export function solid(color: string): Paint[] { return [{ kind: "solid", color }]; }
