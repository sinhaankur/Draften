/**
 * rag — on-device Retrieval-Augmented grounding for the design assistant.
 *
 * The assistant used to dump the whole document summary + an 8 KB slice of any
 * attachment into the prompt. That's noisy and blind. RAG fixes it: chunk the
 * knowledge the assistant can draw on — the LIVE DOCUMENT, the DESIGN SYSTEM, and
 * Ankur's Universal Experience Framework (the Laws of UX) — then RETRIEVE only the
 * passages relevant to the user's prompt. So "why group these?" pulls the
 * Proximity/Gestalt law, and "edit the pricing card" pulls that layer.
 *
 * Mirrors ~/Documents/rag-engine: hybrid keyword + cosine over a light hashed
 * term vector, degrading to pure keyword when nothing embeds. Pure + in-browser,
 * no service, no key — true to the tiered/on-device rule.
 */

import type { DraftenDocument } from "../model/document";
import type { DesignSystem } from "../model/design-system";

export interface Chunk {
  id: string;
  /** where it came from, shown as a citation: "UX Law", "Document", "Design system" */
  source: string;
  text: string;
}

export interface Retrieved extends Chunk {
  score: number;
}

// ── the UX-framework knowledge base (Ankur's real Laws of UX) ────────────────
// Source: sinhaankur.com/framework. These are the "why" the assistant reasons
// with — placement, grouping, hierarchy, decision cost, feedback timing.
export const UX_LAWS: Chunk[] = [
  { id: "law.proximity", source: "UX Law · Proximity (Gestalt)", text: "Proximity / Gestalt grouping: elements placed near each other are perceived as a group. Group related controls and separate unrelated ones with space, not lines. This is WHY grouping matters — spacing communicates structure before any label does." },
  { id: "law.hierarchy", source: "UX Law · Visual hierarchy", text: "Visual hierarchy: size, weight, colour and position signal importance. The most important element should be the most prominent and highest/leftmost in reading order. Hierarchy tells the eye where to go first — WHY placement matters." },
  { id: "law.fitts", source: "UX Law · Fitts's Law", text: "Fitts's Law: the time to tap or click a target grows with distance and shrinks with size. PLACE primary buttons and the main CTA where they are big and easy to tap — within thumb reach on mobile, bottom-of-screen or full-width. Button placement and tap-target size follow Fitts: small, far targets cost the user time and taps." },
  { id: "law.hicks", source: "UX Law · Hick's Law", text: "Hick's Law: decision time rises with the number and complexity of choices (~log2(n+1)). Reduce options, group them, use progressive disclosure and sensible defaults. Fewer choices = faster, calmer decisions." },
  { id: "law.miller", source: "UX Law · Miller's Law", text: "Miller's Law: working memory holds ~7±2 chunks. Chunk content (phone numbers, menus, steps) into small groups; don't make people hold more than a handful of items at once." },
  { id: "law.jakob", source: "UX Law · Jakob's Law", text: "Jakob's Law: users spend most time on OTHER products, so they expect yours to work the same way. Use familiar patterns and placements (nav at top/bottom, primary action bottom-right or full-width) unless you have a strong reason not to." },
  { id: "law.peakend", source: "UX Law · Peak-End Rule", text: "Peak-End Rule: people judge an experience by its most intense moment and its end. Invest in the peak moment and a graceful ending (confirmation, delight) more than the average step." },
  { id: "law.doherty", source: "UX Law · Doherty Threshold", text: "Doherty Threshold: keep system response under ~400ms so attention holds and the interaction feels conversational. Use optimistic UI, skeletons and motion to mask latency." },
  { id: "law.whitespace", source: "UX Law · Whitespace & alignment", text: "Whitespace and alignment: consistent spacing and a shared alignment edge make a layout feel ordered and scannable. Align elements to a grid; use consistent gaps so proximity reads cleanly." },
  { id: "law.feedback", source: "UX Law · Feedback (Nielsen)", text: "Visibility of system status (Nielsen): always show what's happening — pressed states, loading, success/error. Every action needs visible feedback within the Doherty threshold." },
  { id: "law.contrast", source: "UX Law · Contrast & accessibility", text: "Contrast & accessibility (WCAG 2.2): body text needs 4.5:1 contrast, large text 3:1. Don't rely on colour alone; ensure targets are at least 44×44px for touch." },
];

// ── chunkers: live doc + design system → chunks ──────────────────────────────

export function chunkDocument(doc: DraftenDocument): Chunk[] {
  const out: Chunk[] = [];
  for (const board of doc.boards ?? []) {
    const texts = (board.children ?? [])
      .map((id) => doc.nodes[id])
      .filter((n): n is NonNullable<typeof n> => !!n)
      .map((n) => {
        const t = n as { type: string; text?: string; name?: string };
        return t.type === "text" ? (t.text ?? "") : (t.name ?? t.type);
      })
      .filter(Boolean);
    out.push({
      id: `board.${board.id}`,
      source: `Document · ${board.name}`,
      text: `Screen "${board.name}": ${texts.slice(0, 40).join(" · ")}`,
    });
  }
  return out;
}

export function chunkDesignSystem(ds: DesignSystem | undefined): Chunk[] {
  if (!ds) return [];
  const out: Chunk[] = [];
  const colors = ds.tokens?.colors ? Object.keys(ds.tokens.colors).slice(0, 24).join(", ") : "";
  if (colors) out.push({ id: "ds.colors", source: "Design system · Colour", text: `Colour tokens available: ${colors}. Prefer these over literal hex.` });
  const comps = (ds.components ?? []).map((c) => c.name).join(", ");
  if (comps) out.push({ id: "ds.components", source: "Design system · Components", text: `Components available to reuse: ${comps}.` });
  return out;
}

/** Assemble the full retrievable corpus for the current state. */
export function buildCorpus(doc: DraftenDocument, ds?: DesignSystem, attachment?: { name: string; text: string }): Chunk[] {
  const corpus = [...UX_LAWS, ...chunkDocument(doc), ...chunkDesignSystem(ds)];
  if (attachment?.text) corpus.push(...chunkText(attachment.text, `Attached · ${attachment.name}`));
  return corpus;
}

/** Split long attachment text into ~paragraph chunks. */
export function chunkText(text: string, source: string, size = 600): Chunk[] {
  const paras = text.split(/\n{2,}/).flatMap((p) => (p.length <= size ? [p] : splitLen(p, size)));
  return paras.map((p, i) => ({ id: `${source}.${i}`, source, text: p.trim() })).filter((c) => c.text);
}

// ── retrieval: hybrid keyword + cosine ───────────────────────────────────────

const STOP = new Set("the a an and or of to in on for with is are be this that it as at by from your you".split(" "));

function terms(s: string): string[] {
  return (s.toLowerCase().match(/[a-z0-9']+/g) ?? []).filter((w) => w.length > 1 && !STOP.has(w));
}

/** A sparse term-frequency map (our lightweight "embedding"). */
function vec(s: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of terms(s)) m.set(t, (m.get(t) ?? 0) + 1);
  return m;
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0, na = 0, nb = 0;
  for (const [, v] of a) na += v * v;
  for (const [, v] of b) nb += v * v;
  for (const [k, v] of a) { const w = b.get(k); if (w) dot += v * w; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/** Retrieve the top-k most relevant chunks for a query. Hybrid: cosine over term
 *  vectors, plus a keyword-overlap boost so exact-term hits (e.g. "proximity")
 *  always surface even on short queries. Degrades to keyword if cosine is flat. */
export function retrieve(query: string, corpus: Chunk[], k = 4): Retrieved[] {
  const qv = vec(query);
  const qTerms = new Set(terms(query));
  const scored = corpus.map((c) => {
    const cv = vec(c.text + " " + c.source);
    const cos = cosine(qv, cv);
    let overlap = 0;
    for (const t of qTerms) if (cv.has(t)) overlap++;
    const kw = qTerms.size ? overlap / qTerms.size : 0;
    return { ...c, score: cos * 0.6 + kw * 0.4 };
  });
  return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, k);
}

/** Format retrieved chunks as a grounded context block for the prompt. */
export function contextBlock(hits: Retrieved[]): string {
  if (!hits.length) return "";
  return hits.map((h) => `- [${h.source}] ${h.text}`).join("\n");
}

function splitLen(s: string, n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n));
  return out;
}
