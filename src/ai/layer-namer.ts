/**
 * layer-namer — give every layer a HUMAN name + description, the way a careful
 * designer names layers in Sketch ("Primary button", "Hero heading", "Divider").
 *
 * Imported PDFs/vectors arrive as "Rectangle", "Path", "Text" — meaningless in a
 * layer list. This infers a meaningful name from each node's type, geometry, text,
 * and role on its board. It's DETERMINISTIC (works offline / tiny-LLM): the rules
 * encode what a designer would call the thing. The LLM tier can refine names on
 * demand, but the baseline is always useful without a model.
 */

import type { DraftenDocument } from "../model/document";
import type { Node } from "../model/node";

export interface NamedLayer {
  id: string;
  name: string;
  /** one-line description of what the layer is / its role */
  description: string;
}

/** Name + describe a single node given its board context. */
export function describeNode(node: Node, board?: { width: number; height: number }): NamedLayer {
  const f = node.frame;
  const bw = board?.width ?? 0;
  const bh = board?.height ?? 0;
  const nearTop = bh > 0 && f.y < bh * 0.18;
  const full = bw > 0 && f.width > bw * 0.8;
  const thin = f.height <= 10 || f.width <= 10;

  switch (node.type) {
    case "text": {
      const t = node as Node & { text?: string; style?: { fontSize?: number; fontWeight?: number } };
      const words = (t.text ?? "").trim();
      const size = t.style?.fontSize ?? 15;
      const bold = (t.style?.fontWeight ?? 400) >= 600;
      const short = words.length <= 40;
      // page numbers + bare markers get a clean name (no quoted content)
      if (/^\d+$/.test(words)) return { id: node.id, name: "Page number", description: `Page number, ${Math.round(size)}px.` };
      let role = "Body text";
      if (size >= 40) role = nearTop ? "Hero heading" : "Display heading";
      else if (size >= 24 || (bold && short)) role = "Heading";
      else if (/^[•\-*]/.test(words)) role = "Bullet";
      else if (/@|https?:|\.com/.test(words)) role = "Link / contact";
      const label = words ? `${role} — “${truncate(words, 28)}”` : role;
      return { id: node.id, name: label, description: `${role}, ${Math.round(size)}px${bold ? " bold" : ""}.` };
    }
    case "rectangle": {
      // a small square reads as a bullet marker — check before the thin/divider rule
      if (Math.abs(f.width - f.height) < 4 && f.width <= 16) return { id: node.id, name: "Bullet dot", description: "A small square bullet marker." };
      if (thin && full) return { id: node.id, name: "Accent bar", description: "A thin full-width rule / banner." };
      if (thin) return { id: node.id, name: "Divider", description: "A thin rule used to separate content." };
      const fill = firstColor(node);
      if (f.width > bw * 0.6 && f.height > bh * 0.6) return { id: node.id, name: "Background panel", description: `Large filled panel${fill ? ` (${fill})` : ""}.` };
      const r = (node as Node & { cornerRadius?: number }).cornerRadius;
      return { id: node.id, name: r ? "Card / button" : "Rectangle", description: `${Math.round(f.width)}×${Math.round(f.height)}${fill ? `, ${fill}` : ""}${r ? ", rounded" : ""}.` };
    }
    case "ellipse": {
      const round = Math.abs(f.width - f.height) < 2;
      return { id: node.id, name: round ? "Circle" : "Ellipse", description: `${Math.round(f.width)}×${Math.round(f.height)}.` };
    }
    case "path": {
      const d = (node as Node & { d?: string }).d ?? "";
      const pts = (d.match(/[MLCQ]/g) ?? []).length;
      const closed = /z/i.test(d);
      return { id: node.id, name: closed ? "Shape" : "Line / stroke", description: `Vector path, ${pts} segment${pts === 1 ? "" : "s"}${closed ? ", closed" : ""}.` };
    }
    case "image":
      return { id: node.id, name: (node as Node & { name?: string }).name || "Image", description: "An embedded image." };
    case "frame": {
      const kids = ((node as Node & { children?: string[] }).children ?? []).length;
      return { id: node.id, name: node.name || "Frame", description: `A container of ${kids} layer${kids === 1 ? "" : "s"}.` };
    }
    default:
      // group / shape / connector / sticky / map nodes
      return { id: node.id, name: node.name || capitalize(node.type), description: node.type };
  }
}

/** Name + describe every node in a document, returning a flat map. */
export function describeDocument(doc: DraftenDocument): Record<string, NamedLayer> {
  const boardOf = new Map<string, { width: number; height: number }>();
  for (const b of doc.boards ?? []) {
    const f = b.frame;
    if (f) for (const id of b.children ?? []) boardOf.set(id, { width: f.width, height: f.height });
  }
  const out: Record<string, NamedLayer> = {};
  for (const node of Object.values(doc.nodes)) {
    out[node.id] = describeNode(node, boardOf.get(node.id));
  }
  return out;
}

/** Apply inferred names back onto the document's nodes (mutates names only). */
export function autoNameLayers(doc: DraftenDocument): number {
  const named = describeDocument(doc);
  let n = 0;
  for (const node of Object.values(doc.nodes)) {
    const nm = named[node.id];
    if (nm && node.name !== nm.name) { node.name = nm.name; n++; }
  }
  return n;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function firstColor(node: Node): string | undefined {
  const fills = (node as Node & { fills?: Array<{ kind: string; color?: string }> }).fills;
  const f = fills?.find((p) => p.kind === "solid");
  return f?.color;
}
