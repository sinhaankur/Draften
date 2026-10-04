/**
 * presentation — turn an imported document (PDF/Word) into a GOOD slide deck.
 *
 * The product goal: import a PDF or Word file, then "make it a presentation" and
 * get a real, themed, multi-slide deck you can edit — the way Claude can build a
 * deck from a document, but running on DRAFTEN's own tiered AI. So the core is
 * DETERMINISTIC (works offline / on a tiny LLM): it reads the document's heading
 * structure into an outline and lays out slides. The LLM tier is optional polish
 * (tighter titles, speaker notes) layered on top — never required.
 *
 *   outline(importedDoc) → OutlineItem[]
 *   buildPresentation(outline, opts) → DraftenDocument (one board per slide)
 */

import { createEmptyDocument, type Board, type DraftenDocument } from "../model/document";
import type { Node } from "../model/node";
import { generateTokens } from "./design-gen";

/** 16:9 slide, points. */
const SLIDE_W = 960;
const SLIDE_H = 540;
const GAP = 60;
const PAD = 72;

export interface OutlineItem {
  /** 1 = top heading (→ section slide), 2 = sub-heading (→ slide title), 0 = body/bullet */
  level: number;
  text: string;
}

export interface PresentationOptions {
  /** deck title (first slide); defaults to the document name */
  title?: string;
  /** a vibe that seeds the theme: "calm", "bold", "editorial", "dark"… */
  theme?: string;
  /** author/footer line */
  footer?: string;
  /** max bullets per content slide before it splits onto another slide */
  maxBulletsPerSlide?: number;
}

interface Theme {
  bg: string; title: string; body: string; accent: string; muted: string;
  dark: boolean;
}

// ── outline extraction ───────────────────────────────────────────────────────

/**
 * Read an imported DraftenDocument (PDF/Word) into an ordered outline. Heading
 * level is inferred from each text node's font size + weight (both importers set
 * them), and bullets are recognised by a leading "• ". Nodes are visited in
 * reading order (board order, then top-to-bottom by y).
 */
export function outline(doc: DraftenDocument): OutlineItem[] {
  const texts: Array<{ text: string; size: number; weight: number; bullet: boolean }> = [];
  for (const board of doc.boards ?? []) {
    const nodes = (board.children ?? [])
      .map((id) => doc.nodes[id])
      .filter((n): n is Node => !!n && n.type === "text")
      .sort((a, b) => a.frame.y - b.frame.y);
    for (const n of nodes) {
      const t = n as Node & { text?: string; style?: { fontSize?: number; fontWeight?: number } };
      const raw = (t.text ?? "").trim();
      if (!raw) continue;
      const bullet = /^[•\-*]\s+/.test(raw);
      texts.push({
        text: raw.replace(/^[•\-*]\s+/, ""),
        size: t.style?.fontSize ?? 15,
        weight: t.style?.fontWeight ?? 400,
        bullet,
      });
    }
  }
  if (!texts.length) return [];

  // Heading threshold: notably larger than the median body size, or bold + larger.
  const sizes = texts.map((t) => t.size).sort((a, b) => a - b);
  const median = sizes[Math.floor(sizes.length / 2)];
  const bigSize = Math.max(median + 3, median * 1.3);

  // a heading is notably bigger than body, OR bold and at least body size
  const isHeading = (t: { size: number; weight: number }) => t.size >= bigSize || (t.weight >= 600 && t.size >= median);
  const headingSizes = texts.filter((t) => !t.bullet && isHeading(t)).map((t) => t.size);
  const maxHeading = headingSizes.length ? Math.max(...headingSizes) : bigSize;

  return texts.map((t) => {
    if (t.bullet) return { level: 0, text: t.text };
    if (!isHeading(t)) return { level: 0, text: t.text };
    // top-level if within ~10% of the biggest heading, else a sub-heading
    const level = t.size >= maxHeading * 0.9 ? 1 : 2;
    return { level, text: t.text };
  });
}

// ── deck construction ────────────────────────────────────────────────────────

/** Group the flat outline into slides: a heading opens a slide, body/bullets fill
 *  it, a new heading starts the next. Long bullet runs split across slides. */
interface SlideSpec {
  kind: "title" | "section" | "content";
  title: string;
  bullets: string[];
}

function toSlides(items: OutlineItem[], opts: PresentationOptions): SlideSpec[] {
  const maxB = opts.maxBulletsPerSlide ?? 6;
  const slides: SlideSpec[] = [];
  let cur: SlideSpec | null = null;
  const push = () => { if (cur) { slides.push(cur); cur = null; } };

  for (const it of items) {
    if (it.level === 1) { push(); slides.push({ kind: "section", title: it.text, bullets: [] }); continue; }
    if (it.level === 2) { push(); cur = { kind: "content", title: it.text, bullets: [] }; continue; }
    // body / bullet
    if (!cur) cur = { kind: "content", title: "Overview", bullets: [] };
    cur.bullets.push(it.text);
    if (cur.bullets.length >= maxB) { const carry: string = cur.title; push(); cur = { kind: "content", title: carry, bullets: [] }; }
  }
  push();
  return slides.filter((s) => s.kind === "section" || s.title || s.bullets.length);
}

/** Build the full presentation document from an outline. */
export function buildPresentation(items: OutlineItem[], opts: PresentationOptions = {}): DraftenDocument {
  const title = opts.title ?? "Presentation";
  const theme = resolveTheme(opts.theme, title);
  const doc = createEmptyDocument(title);
  doc.boards = [];
  doc.nodes = {};

  const slides: SlideSpec[] = [{ kind: "title", title, bullets: opts.footer ? [opts.footer] : [] }, ...toSlides(items, opts)];

  slides.forEach((spec, i) => {
    const x = i * (SLIDE_W + GAP);
    const boardId = crypto.randomUUID();
    const children: string[] = [];
    const add = (node: Node) => { doc.nodes[node.id] = node as DraftenDocument["nodes"][string]; children.push(node.id); };

    // an accent bar so slides read as a deck, not loose boards. Layers get
    // SEMANTIC names (not "Shape"/"Text") so the layer list reads like Sketch's.
    add(rect(boardId, "Accent bar", 0, 0, SLIDE_W, 8, theme.accent));

    if (spec.kind === "title") {
      add(text(boardId, "Deck title", PAD, SLIDE_H / 2 - 80, SLIDE_W - PAD * 2, spec.title, 56, 700, theme.title, "left"));
      add(rect(boardId, "Title rule", PAD, SLIDE_H / 2 + 6, 120, 5, theme.accent));
      if (spec.bullets[0]) add(text(boardId, "Subtitle", PAD, SLIDE_H / 2 + 28, SLIDE_W - PAD * 2, spec.bullets[0], 20, 400, theme.muted, "left"));
    } else if (spec.kind === "section") {
      add(text(boardId, "Section title", PAD, SLIDE_H / 2 - 40, SLIDE_W - PAD * 2, spec.title, 44, 700, theme.title, "left"));
      add(rect(boardId, "Section rule", PAD, SLIDE_H / 2 + 24, 80, 5, theme.accent));
    } else {
      add(text(boardId, "Slide title", PAD, PAD, SLIDE_W - PAD * 2, spec.title, 36, 700, theme.title, "left"));
      let by = PAD + 72;
      spec.bullets.forEach((b, bi) => {
        add(rect(boardId, `Bullet dot ${bi + 1}`, PAD, by + 9, 8, 8, theme.accent));
        add(text(boardId, `Bullet ${bi + 1}`, PAD + 24, by, SLIDE_W - PAD * 2 - 24, b, 20, 400, theme.body, "left"));
        by += 20 * 1.4 * Math.max(1, Math.ceil(b.length / 70)) + 18;
      });
    }

    // footer page number
    add(text(boardId, "Page number", SLIDE_W - PAD - 40, SLIDE_H - 40, 40, String(i + 1), 12, 400, theme.muted, "right"));

    // speaker notes: the slide's own points, as a prompt for what to say
    const notes = spec.kind === "content" && spec.bullets.length
      ? `Talk through: ${spec.bullets.join("; ")}.`
      : spec.kind === "section" ? `Transition into “${spec.title}”.` : "";

    const board: Board = {
      id: boardId, name: slideName(spec, i), kind: "design", children,
      viewport: { x: 0, y: 0, zoom: 1 },
      frame: { x, y: 0, width: SLIDE_W, height: SLIDE_H },
      background: theme.bg,
      ...(notes ? { notes } : {}),
    };
    doc.boards.push(board);
  });

  return doc;
}

function slideName(s: SlideSpec, i: number): string {
  if (s.kind === "title") return "Title";
  if (s.kind === "section") return s.title.slice(0, 24) || `Section ${i}`;
  return s.title.slice(0, 24) || `Slide ${i + 1}`;
}

// ── theming ──────────────────────────────────────────────────────────────────

function resolveTheme(vibe: string | undefined, seed: string): Theme {
  const v = (vibe ?? "").toLowerCase();
  const tokens = generateTokens({ brand: seed, style: vibe });
  // tokens.colors is keyed WITHOUT the leading "color." group (e.g. "brand.500").
  const c = (key: string): string | undefined => tokens.colors?.[key];
  const accent = c("brand.500") ?? "#3d6b5f";
  const dark = /dark|night|bold|midnight/.test(v);
  if (dark) {
    return { bg: c("brand.900") ?? "#15201d", title: "#ffffff", body: "#e7e6e2", accent: c("brand.300") ?? accent, muted: "#a7b2ae", dark: true };
  }
  return { bg: "#ffffff", title: c("brand.900") ?? "#15201d", body: "#2a2a28", accent, muted: "#8e8d88", dark: false };
}

// ── node helpers ─────────────────────────────────────────────────────────────

function rect(parentId: string, name: string, x: number, y: number, w: number, h: number, color: string): Node {
  return { id: crypto.randomUUID(), type: "rectangle", name, frame: { x, y, width: w, height: h }, fills: [{ kind: "solid", color }], parentId } as Node;
}

function text(parentId: string, name: string, x: number, y: number, w: number, content: string, size: number, weight: number, color: string, align: "left" | "center" | "right"): Node {
  return {
    id: crypto.randomUUID(), type: "text", name,
    frame: { x, y, width: w, height: size * 1.4 * Math.max(1, Math.ceil(content.length / Math.max(10, w / (size * 0.55)))) },
    text: content,
    fills: [{ kind: "solid", color }],
    style: { fontFamily: "Inter", fontSize: size, fontWeight: weight, lineHeight: 1.4, align },
    parentId,
  } as Node;
}
