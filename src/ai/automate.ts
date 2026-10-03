/**
 * automate — Draften's "scripts", the modern OmniGraffle automation.
 *
 * OmniGraffle's magic was scripts that generated structure (tables of contents,
 * grids, diagrams). Draften does it two ways that always work:
 *   1. DETERMINISTIC commands (here) — recognised intents that run keyless +
 *      offline, instantly, with no model. The honest, reliable core.
 *   2. The LLM assistant layers natural language on top when a model is present.
 *
 * Each command returns an Excalidraw skeleton (real editable layers) + a summary.
 * Add a command = add one entry to COMMANDS. That's the whole extension surface.
 */

type Skeleton = Array<Record<string, unknown>>;
export type AutomationResult = { skeleton: Skeleton; summary: string } | null;

const INK = "#1d1d1b", MUTED = "#8e8d88", LINE = "#e7e6e2", ACC = "#3d6b5f", SURF = "#ffffff";
const base = { roughness: 0 as const, strokeWidth: 1, fillStyle: "solid" as const };

const txt = (x: number, y: number, t: string, size = 15, color = INK, family = 2) =>
  ({ ...base, type: "text", x, y, text: t, fontSize: size, fontFamily: family, strokeColor: color });
const rect = (x: number, y: number, w: number, h: number, extra: Record<string, unknown> = {}) =>
  ({ ...base, type: "rectangle", x, y, width: w, height: h, strokeColor: LINE, backgroundColor: SURF, roundness: { type: 3 }, ...extra });

/** Pull a list of items out of a free-text prompt (commas, "and", newlines, numbers). */
function items(prompt: string): string[] {
  const after = prompt.replace(/^.*?(?:of|:|for|with)\s+/i, "");
  return after
    .split(/,|\band\b|\n|\d+[.)]/i)
    .map((s) => s.trim().replace(/^["'-]+|["'.]+$/g, ""))
    .filter((s) => s.length > 1 && s.length < 80)
    .slice(0, 20);
}

/** Count requested ("5 cards", "a 3x4 grid"). */
function num(prompt: string, fallback: number): number {
  const m = prompt.match(/(\d+)/);
  const n = m ? parseInt(m[1], 10) : fallback;
  return Math.min(Math.max(n, 1), 50);
}

type Command = { test: (p: string) => boolean; run: (p: string) => AutomationResult };

const COMMANDS: Command[] = [
  // ── Table of contents (the OmniGraffle classic) ──────────────────────────
  {
    test: (p) => /table of contents|toc\b|contents page|index page/i.test(p),
    run: (p) => {
      const list = items(p);
      const entries = list.length ? list : ["Introduction", "Getting started", "Core concepts", "Reference", "Appendix"];
      const sk: Skeleton = [
        rect(80, 80, 520, 120 + entries.length * 44, { backgroundColor: SURF }),
        txt(112, 112, "Table of Contents", 24),
        { ...base, type: "line", x: 112, y: 156, width: 456, height: 0, points: [[0, 0], [456, 0]], strokeColor: LINE },
      ];
      entries.forEach((e, i) => {
        const y = 184 + i * 44;
        sk.push(txt(112, y, `${i + 1}.  ${e}`, 15));
        sk.push(txt(540, y, String((i + 1) * 2 + 1), 15, MUTED)); // page no.
        sk.push({ ...base, type: "line", x: 112 + measure(`${i + 1}.  ${e}`) + 12, y: y + 9, width: 0, height: 0, points: [[0, 0], [Math.max(20, 400 - measure(e)), 0]], strokeColor: LINE, strokeStyle: "dotted" });
      });
      return { skeleton: sk, summary: `Generated a table of contents with ${entries.length} entries` };
    },
  },
  // ── Grid of N cards / a NxM grid ─────────────────────────────────────────
  {
    test: (p) => /grid|cards|tiles|gallery/i.test(p),
    run: (p) => {
      const gm = p.match(/(\d+)\s*[x×]\s*(\d+)/i);
      let cols: number, rows: number;
      if (gm) { cols = +gm[1]; rows = +gm[2]; } else { const n = num(p, 6); cols = Math.min(n, 3); rows = Math.ceil(n / cols); }
      const sk: Skeleton = [];
      const CW = 200, CH = 140, GAP = 24;
      let k = 1;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const x = 80 + c * (CW + GAP), y = 80 + r * (CH + GAP);
        sk.push(rect(x, y, CW, CH, { backgroundColor: SURF }));
        sk.push(rect(x + 16, y + 16, CW - 32, 72, { backgroundColor: "#efeeeb", strokeColor: "#efeeeb" }));
        sk.push(txt(x + 16, y + 100, `Card ${k}`, 14));
        sk.push(txt(x + 16, y + 120, "Supporting text", 11, MUTED));
        k++;
      }
      return { skeleton: sk, summary: `Generated a ${cols}×${rows} grid (${cols * rows} cards)` };
    },
  },
  // ── Nav bar from a list of links ─────────────────────────────────────────
  {
    test: (p) => /nav ?bar|navigation|menu bar|top bar|header( with)? (nav|menu|links)/i.test(p),
    run: (p) => {
      const links = items(p).length ? items(p) : ["Home", "Features", "Pricing", "Docs", "Contact"];
      const sk: Skeleton = [rect(80, 80, 900, 56, { backgroundColor: SURF })];
      sk.push(txt(104, 98, "Brand", 18, INK));
      let x = 980 - 24;
      [...links].reverse().forEach((l) => { const w = measure(l) + 8; x -= w + 20; sk.push(txt(x, 100, l, 14, MUTED)); });
      return { skeleton: sk, summary: `Generated a nav bar with ${links.length} links` };
    },
  },
  // ── Flowchart / flow: boxes connected by arrows (the OmniGraffle sweet spot) ─
  {
    test: (p) => /flow ?chart|flow diagram|flow of|process flow|pipeline|a flow\b|steps? (?:diagram|flow)|→|->/i.test(p),
    run: (p) => {
      // split on arrows first, else on the usual separators
      let steps = p.includes("→") || p.includes("->")
        ? p.replace(/^.*?(?:of|:|for)\s+/i, "").split(/→|->/).map((s) => s.trim()).filter(Boolean)
        : items(p);
      if (steps.length < 2) steps = ["Start", "Process", "Decision", "End"];
      steps = steps.slice(0, 8);
      const sk: Skeleton = [];
      const BW = 170, BH = 64, GAP = 60;
      steps.forEach((s, i) => {
        const x = 80 + i * (BW + GAP), y = 120;
        const last = i === steps.length - 1;
        const isDecision = /decision|\?|choose|if\b/i.test(s);
        if (isDecision) {
          sk.push({ ...base, type: "diamond", x, y: y - 8, width: BW, height: BH + 16, strokeColor: ACC, backgroundColor: "#eaf1ee", roundness: null });
        } else {
          sk.push(rect(x, y, BW, BH, { strokeColor: i === 0 || last ? ACC : LINE, backgroundColor: i === 0 || last ? "#eaf1ee" : SURF }));
        }
        sk.push(txt(x + 14, y + 22, s.slice(0, 22), 13, INK));
        // arrow to the next box
        if (!last) {
          const ax = x + BW, ay = y + BH / 2;
          sk.push({ ...base, type: "arrow", x: ax, y: ay, width: GAP, height: 0, points: [[0, 0], [GAP, 0]], strokeColor: MUTED, endArrowhead: "arrow" });
        }
      });
      return { skeleton: sk, summary: `Generated a flowchart with ${steps.length} steps` };
    },
  },
  // ── Stack a list vertically (steps / checklist / menu) ───────────────────
  {
    test: (p) => /stack|list of|checklist|vertical list|bullet|menu of/i.test(p),
    run: (p) => {
      const list = items(p).length ? items(p) : ["First item", "Second item", "Third item"];
      const sk: Skeleton = [];
      list.forEach((it, i) => {
        const y = 80 + i * 56;
        sk.push(rect(80, y, 440, 48, { backgroundColor: SURF }));
        sk.push({ ...base, type: "ellipse", x: 96, y: y + 14, width: 20, height: 20, strokeColor: ACC, backgroundColor: ACC });
        sk.push(txt(104, y + 16, String(i + 1), 11, "#fff"));
        sk.push(txt(132, y + 16, it, 14));
      });
      return { skeleton: sk, summary: `Stacked ${list.length} items vertically` };
    },
  },
];

/**
 * Try to satisfy a prompt deterministically. Returns null if no command matches
 * (then the caller can fall through to the LLM / design-system generator).
 */
export function automate(prompt: string): AutomationResult {
  const p = prompt.trim();
  for (const c of COMMANDS) if (c.test(p)) return c.run(p);
  return null;
}

/** The commands we can run keyless — surfaced as suggestions in the UI. */
export const AUTOMATIONS = [
  "A table of contents for: Intro, Setup, Usage, API, FAQ",
  "A flowchart: Idea → Design → Build → Review → Ship",
  "A 3×3 grid of cards",
  "A nav bar: Home, Features, Pricing, Docs",
  "A checklist of: Research, Design, Build, Ship",
];

/** rough text width (px) for layout — monospace-ish estimate. */
function measure(s: string): number { return Math.round(s.length * 8.2); }
