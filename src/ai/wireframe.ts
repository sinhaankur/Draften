/**
 * wireframe — the design-thinking core: a UX intent → a real, editable WIREFRAME.
 *
 * This is what makes Draften an AI-powered design tool and not a slide maker:
 * you describe a product intent ("onboarding flow for a fitness app") and get
 * MULTIPLE LINKED SCREENS (phone artboards) built from real low-fi UI blocks —
 * nav bars, inputs, buttons, cards, lists, tab bars — themed by the design
 * system, with a flow between them. Everything is editable nodes, so it's a
 * starting point to think with, not a picture.
 *
 * Deterministic by design (works offline / on a tiny LLM): a planner maps the
 * intent to a sequence of screen archetypes, and each archetype composes blocks.
 * The LLM tier can rename/rewrite copy on top, never required.
 *
 *   planFlow("fitness onboarding") → ScreenSpec[]
 *   buildWireframe(specs, opts)    → DraftenDocument (one artboard per screen)
 */

import { createEmptyDocument, type Board, type DraftenDocument } from "../model/document";
import type { ConnectorNode, Node } from "../model/node";
import { generateTokens } from "./design-gen";

// iPhone-ish artboard, points.
const SCREEN_W = 390;
const SCREEN_H = 844;
const GAP = 120;
const PAD = 20;

export interface ScreenSpec {
  name: string;
  /** ordered block archetypes that fill the screen */
  blocks: BlockSpec[];
  /** whether to show the bottom tab bar */
  tabBar?: boolean;
}

export type BlockSpec =
  | { t: "statusBar" }
  | { t: "navBar"; title: string; back?: boolean }
  | { t: "hero"; title: string; subtitle?: string }
  | { t: "title"; text: string }
  | { t: "paragraph"; text: string }
  | { t: "input"; label: string }
  | { t: "button"; label: string; primary?: boolean }
  | { t: "card"; title: string; body?: string }
  | { t: "list"; rows: string[] }
  | { t: "image"; label?: string }
  | { t: "stat"; label: string; value: string };

export interface WireframeOptions {
  title?: string;
  theme?: string;
}

interface Theme { ink: string; muted: string; line: string; accent: string; surf: string; onAccent: string; bg: string }

// ── flow planner: intent → screens ───────────────────────────────────────────

/** Map a free-text UX intent to a sequence of screen specs. Recognises common
 *  product flows; falls back to a sensible generic app flow. */
export function planFlow(intent: string): ScreenSpec[] {
  const p = intent.toLowerCase();
  const domain = subject(intent);

  const onboarding = /onboard|sign ?up|get started|welcome|register/.test(p);
  const auth = /log ?in|sign ?in|auth|account/.test(p);
  const checkout = /checkout|cart|payment|purchase|buy|shop|store|ecommerce|e-commerce/.test(p);
  const dashboard = /dashboard|home|feed|overview|app\b/.test(p);
  const settings = /settings|profile/.test(p);

  const screens: ScreenSpec[] = [];

  if (onboarding || (!auth && !checkout && !dashboard && !settings)) {
    screens.push({
      name: "Welcome",
      blocks: [
        { t: "statusBar" },
        { t: "image", label: `${domain} hero` },
        { t: "hero", title: `Welcome to ${domain}`, subtitle: "A short line on the value you deliver." },
        { t: "button", label: "Get started", primary: true },
        { t: "button", label: "I already have an account" },
      ],
    });
    screens.push({
      name: "Goals",
      blocks: [
        { t: "statusBar" }, { t: "navBar", title: "Your goals", back: true },
        { t: "title", text: "What do you want to achieve?" },
        { t: "list", rows: ["Option one", "Option two", "Option three"] },
        { t: "button", label: "Continue", primary: true },
      ],
    });
  }

  if (auth || onboarding) {
    screens.push({
      name: "Sign up",
      blocks: [
        { t: "statusBar" }, { t: "navBar", title: "Create account", back: true },
        { t: "input", label: "Email" }, { t: "input", label: "Password" },
        { t: "button", label: "Create account", primary: true },
        { t: "paragraph", text: "By continuing you agree to the terms." },
      ],
    });
  }

  if (checkout) {
    screens.push({
      name: "Cart",
      blocks: [
        { t: "statusBar" }, { t: "navBar", title: "Cart", back: true },
        { t: "list", rows: ["Item one — $20", "Item two — $35", "Item three — $12"] },
        { t: "stat", label: "Total", value: "$67.00" },
        { t: "button", label: "Checkout", primary: true },
      ],
    });
    screens.push({
      name: "Payment",
      blocks: [
        { t: "statusBar" }, { t: "navBar", title: "Payment", back: true },
        { t: "input", label: "Card number" }, { t: "input", label: "Expiry" }, { t: "input", label: "CVC" },
        { t: "button", label: "Pay $67.00", primary: true },
      ],
    });
  }

  // the home/dashboard the flow lands on
  screens.push({
    name: dashboard ? "Home" : "Dashboard",
    tabBar: true,
    blocks: [
      { t: "statusBar" }, { t: "navBar", title: domain },
      { t: "stat", label: "This week", value: "4 of 5" },
      { t: "card", title: "Today", body: "The main thing to do right now." },
      { t: "list", rows: ["Recent item one", "Recent item two", "Recent item three"] },
    ],
  });

  if (settings) {
    screens.push({
      name: "Settings",
      tabBar: true,
      blocks: [
        { t: "statusBar" }, { t: "navBar", title: "Settings", back: true },
        { t: "list", rows: ["Account", "Notifications", "Privacy", "Help", "Sign out"] },
      ],
    });
  }

  return screens;
}

// ── build: screens → document ────────────────────────────────────────────────

export function buildWireframe(screens: ScreenSpec[], opts: WireframeOptions = {}): DraftenDocument {
  const theme = resolveTheme(opts.theme, opts.title ?? "Wireframe");
  const doc = createEmptyDocument(opts.title ?? "Wireframe");
  doc.boards = [];
  doc.nodes = {};

  const boardIds: string[] = [];
  screens.forEach((screen, i) => {
    const bx = i * (SCREEN_W + GAP);
    const boardId = crypto.randomUUID();
    boardIds.push(boardId);
    const children: string[] = [];
    const add = (n: Node) => { doc.nodes[n.id] = n as DraftenDocument["nodes"][string]; children.push(n.id); };

    let y = 0;
    for (const b of screen.blocks) y = emitBlock(b, boardId, y, theme, add);
    if (screen.tabBar) emitTabBar(boardId, theme, add);

    doc.boards.push({
      id: boardId, name: screen.name, kind: "design", children,
      viewport: { x: 0, y: 0, zoom: 1 },
      frame: { x: bx, y: 0, width: SCREEN_W, height: SCREEN_H },
      background: theme.bg,
    } as Board);
  });

  // flow connectors between consecutive screens (the UX flow)
  for (let i = 0; i < boardIds.length - 1; i++) {
    const id = crypto.randomUUID();
    const conn: ConnectorNode = {
      id, type: "connector", name: `${screens[i].name} → ${screens[i + 1].name}`,
      frame: { x: 0, y: 0, width: 0, height: 0 },
      from: { nodeId: boardIds[i] }, to: { nodeId: boardIds[i + 1] },
      routing: "orthogonal", stroke: { paint: { kind: "solid", color: theme.accent }, width: 2 },
      endArrow: "arrow",
    };
    doc.nodes[id] = conn as DraftenDocument["nodes"][string];
  }

  return doc;
}

// ── block composition ────────────────────────────────────────────────────────

function emitBlock(b: BlockSpec, parent: string, y: number, th: Theme, add: (n: Node) => void): number {
  const W = SCREEN_W - PAD * 2;
  switch (b.t) {
    case "statusBar":
      add(text(parent, "Status bar", PAD, 14, 60, "9:41", 13, 600, th.ink));
      return 54;
    case "navBar":
      if (b.back) add(text(parent, "Back", PAD, y + 14, 24, "‹", 24, 400, th.accent));
      add(text(parent, "Nav title", 0, y + 16, SCREEN_W, b.title, 17, 600, th.ink, "center"));
      add(rect(parent, "Nav divider", 0, y + 52, SCREEN_W, 1, th.line));
      return y + 64;
    case "hero":
      add(text(parent, "Hero title", PAD, y + 16, W, b.title, 30, 700, th.ink));
      if (b.subtitle) add(text(parent, "Hero subtitle", PAD, y + 64, W, b.subtitle, 16, 400, th.muted));
      return y + (b.subtitle ? 120 : 76);
    case "title":
      add(text(parent, "Title", PAD, y + 16, W, b.text, 22, 700, th.ink));
      return y + 60;
    case "paragraph":
      add(text(parent, "Paragraph", PAD, y + 12, W, b.text, 14, 400, th.muted));
      return y + 44;
    case "input":
      add(text(parent, "Input label", PAD, y + 12, W, b.label, 12, 500, th.muted));
      add(rect(parent, `Input · ${b.label}`, PAD, y + 30, W, 44, th.surf, th.line, 10));
      return y + 86;
    case "button": {
      const primary = b.primary !== false && b.primary;
      add(rect(parent, `Button · ${b.label}`, PAD, y + 12, W, 48, primary ? th.accent : th.surf, primary ? th.accent : th.line, 12));
      add(text(parent, "Button label", PAD, y + 28, W, b.label, 16, 600, primary ? th.onAccent : th.ink, "center"));
      return y + 72;
    }
    case "card":
      add(rect(parent, `Card · ${b.title}`, PAD, y + 12, W, 92, th.surf, th.line, 14));
      add(text(parent, "Card title", PAD + 16, y + 28, W - 32, b.title, 16, 600, th.ink));
      if (b.body) add(text(parent, "Card body", PAD + 16, y + 52, W - 32, b.body, 13, 400, th.muted));
      return y + 116;
    case "list": {
      let yy = y + 12;
      b.rows.forEach((r, i) => {
        add(rect(parent, `Row ${i + 1}`, PAD, yy, W, 52, th.surf, th.line, 10));
        add(text(parent, "Row label", PAD + 16, yy + 18, W - 48, r, 15, 400, th.ink));
        add(text(parent, "Row chevron", PAD + W - 24, yy + 16, 16, "›", 18, 400, th.muted));
        yy += 60;
      });
      return yy;
    }
    case "image":
      add(rect(parent, b.label ? `Image · ${b.label}` : "Image", PAD, y + 12, W, 180, th.line, th.line, 14));
      add(text(parent, "Image label", PAD, y + 92, W, b.label ?? "Image", 13, 500, th.muted, "center"));
      return y + 204;
    case "stat":
      add(text(parent, "Stat label", PAD, y + 14, W, b.label, 13, 500, th.muted));
      add(text(parent, "Stat value", PAD, y + 32, W, b.value, 28, 700, th.ink));
      return y + 80;
  }
}

function emitTabBar(parent: string, th: Theme, add: (n: Node) => void): void {
  const top = SCREEN_H - 68;
  add(rect(parent, "Tab bar", 0, top, SCREEN_W, 68, th.surf, th.line, 0));
  const tabs = ["Home", "Search", "Activity", "Profile"];
  const w = SCREEN_W / tabs.length;
  tabs.forEach((t, i) => {
    add(rect(parent, `Tab icon ${i + 1}`, i * w + w / 2 - 11, top + 12, 22, 22, i === 0 ? th.accent : th.muted, i === 0 ? th.accent : th.muted, 6));
    add(text(parent, `Tab ${t}`, i * w, top + 40, w, t, 10, 500, i === 0 ? th.accent : th.muted, "center"));
  });
}

// ── helpers ──────────────────────────────────────────────────────────────────

function resolveTheme(vibe: string | undefined, seed: string): Theme {
  const tokens = generateTokens({ brand: seed, style: vibe });
  const c = (k: string) => tokens.colors?.[k];
  const dark = /\bdark|night|midnight\b/.test((vibe ?? "").toLowerCase());
  const accent = c("brand.500") ?? "#3d6b5f";
  if (dark) return { ink: "#f4f4f2", muted: "#9aa0a6", line: "#2d3136", accent: c("brand.300") ?? accent, surf: "#1b1e22", onAccent: "#0b0b0d", bg: "#121417" };
  return { ink: "#1d1d1b", muted: "#8e8d88", line: "#e7e6e2", accent, surf: "#ffffff", onAccent: "#ffffff", bg: "#f6f6f4" };
}

/** A short subject noun from the intent, for titles ("fitness onboarding" → "Fitness"). */
function subject(intent: string): string {
  const stop = /\b(a|an|the|for|flow|app|of|to|with|screen|screens|wireframe|ui|ux|design|onboarding|signup|sign|up|login|in|checkout|dashboard|settings|page|mobile)\b/gi;
  const words = intent.replace(stop, " ").replace(/[^a-z0-9 ]/gi, " ").trim().split(/\s+/).filter(Boolean);
  const w = words[0] ?? "App";
  return w.charAt(0).toUpperCase() + w.slice(1);
}

function text(parent: string, name: string, x: number, y: number, w: number, content: string, size: number, weight: number, color: string, align: "left" | "center" | "right" = "left"): Node {
  return {
    id: crypto.randomUUID(), type: "text", name,
    frame: { x, y, width: w, height: size * 1.4 },
    text: content, fills: [{ kind: "solid", color }],
    style: { fontFamily: "Inter", fontSize: size, fontWeight: weight, lineHeight: 1.3, align },
    parentId: parent,
  } as Node;
}

function rect(parent: string, name: string, x: number, y: number, w: number, h: number, fill: string, stroke?: string, radius = 0): Node {
  return {
    id: crypto.randomUUID(), type: "rectangle", name,
    frame: { x, y, width: w, height: h },
    fills: [{ kind: "solid", color: fill }],
    ...(stroke ? { stroke: { paint: { kind: "solid", color: stroke }, width: 1 } } : {}),
    ...(radius ? { cornerRadius: radius } : {}),
    parentId: parent,
  } as Node;
}
