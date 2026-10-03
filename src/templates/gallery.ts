/**
 * Template gallery — real, ready starting points.
 *
 * Each template returns an Excalidraw element *skeleton* (the same shape the
 * canvas seeds and convertToExcalidrawElements expands). Picking one draws a
 * genuine, laid-out screen you can then edit/inspect — not a stub. All are built
 * from plain primitives (rectangle/text/ellipse) so they render crisply and the
 * Inspect panel can edit every piece.
 */

type Skeleton = Array<Record<string, unknown>>;

// A calm, neutral kit shared by the templates (matches Draften's own tokens).
const INK = "#1d1d1b";
const MUTED = "#8e8d88";
const LINE = "#e7e6e2";
const SURF = "#ffffff";
const BG = "#f6f6f4";
const ACC = "#3d6b5f";
const base = { roughness: 0 as const, strokeWidth: 1, fillStyle: "solid" as const };

function rect(x: number, y: number, w: number, h: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...base, type: "rectangle", x, y, width: w, height: h, strokeColor: LINE, backgroundColor: SURF, roundness: { type: 3 }, ...extra };
}
function label(text: string): { text: string; fontSize: number; fontFamily: number; strokeColor: string } {
  return { text, fontSize: 14, fontFamily: 2, strokeColor: INK };
}
function txt(x: number, y: number, text: string, size = 15, color = INK): Record<string, unknown> {
  return { ...base, type: "text", x, y, text, fontSize: size, fontFamily: 2, strokeColor: color };
}
function button(x: number, y: number, w: number, t: string): Record<string, unknown> {
  return rect(x, y, w, 44, { strokeColor: ACC, backgroundColor: ACC, label: { ...label(t), strokeColor: "#ffffff" } });
}
function field(x: number, y: number, w: number, ph: string): Record<string, unknown> {
  return rect(x, y, w, 40, { label: { ...label(ph), fontSize: 13, strokeColor: MUTED } });
}

export type TemplateDef = {
  id: string;
  name: string;
  blurb: string;
  /** A tiny ASCII-ish preview shown on the card. */
  tags: string[];
  build: () => Skeleton;
};

export const TEMPLATES: TemplateDef[] = [
  {
    id: "signin",
    name: "Sign-in screen",
    blurb: "Centered card with email, password and a primary action.",
    tags: ["auth", "web"],
    build: () => [
      rect(60, 60, 520, 560, { backgroundColor: BG, strokeColor: LINE }),
      rect(170, 150, 300, 380, { roundness: { type: 3 } }),
      txt(200, 185, "Welcome back", 24),
      txt(200, 230, "Email", 12, MUTED),
      field(200, 250, 240, "you@studio.dev"),
      txt(200, 310, "Password", 12, MUTED),
      field(200, 330, 240, "••••••••"),
      button(200, 400, 240, "Sign in"),
      txt(200, 470, "No account? Create one", 12, ACC),
    ],
  },
  {
    id: "dashboard",
    name: "Dashboard",
    blurb: "Sidebar + stat cards + a content panel. The classic app shell.",
    tags: ["app", "web"],
    build: () => [
      rect(60, 60, 980, 620, { backgroundColor: BG, strokeColor: LINE }),
      // sidebar
      rect(60, 60, 200, 620, { backgroundColor: "#111110", strokeColor: "#111110", roundness: null }),
      txt(84, 92, "Draften", 18, "#ffffff"),
      ...["Overview", "Projects", "Team", "Settings"].map((t, i) => txt(84, 150 + i * 44, t, 14, i === 0 ? "#ffffff" : "#9a9a92")),
      // topbar
      txt(288, 92, "Overview", 22),
      // stat cards
      ...[0, 1, 2].map((i) => rect(288 + i * 250, 150, 220, 110, {})),
      ...["Revenue", "Active users", "Churn"].map((t, i) => txt(312 + i * 250, 175, t, 12, MUTED)),
      ...["$48.2k", "1,284", "2.1%"].map((t, i) => txt(312 + i * 250, 205, t, 26)),
      // content panel
      rect(288, 300, 720, 350, {}),
      txt(312, 328, "Activity", 14, MUTED),
    ],
  },
  {
    id: "pricing",
    name: "Pricing page",
    blurb: "Three tiers with a highlighted plan and feature lists.",
    tags: ["marketing", "web"],
    build: () => {
      const tiers = [
        { name: "Starter", price: "$0", hi: false },
        { name: "Pro", price: "$12", hi: true },
        { name: "Team", price: "$29", hi: false },
      ];
      const out: Skeleton = [rect(60, 60, 980, 620, { backgroundColor: BG, strokeColor: LINE })];
      out.push(txt(400, 110, "Simple, honest pricing", 28));
      tiers.forEach((t, i) => {
        const x = 150 + i * 280;
        out.push(rect(x, 200, 240, 380, t.hi ? { strokeColor: ACC, strokeWidth: 2 } : {}));
        out.push(txt(x + 28, 232, t.name, 16, MUTED));
        out.push(txt(x + 28, 262, t.price, 40));
        [...Array(4)].forEach((_, j) => out.push(txt(x + 28, 340 + j * 34, "• Feature " + (j + 1), 13, MUTED)));
        out.push(button(x + 28, 510, 184, t.hi ? "Choose Pro" : "Choose"));
      });
      return out;
    },
  },
  {
    id: "mobile",
    name: "Mobile onboarding",
    blurb: "Three phone artboards — welcome, sign up, done.",
    tags: ["mobile", "app"],
    build: () => {
      const out: Skeleton = [];
      const screens = [
        { t: "Welcome", body: () => [txt(0, 0, "Your designs,\nin your repo", 22), button(0, 0, 240, "Get started")] },
        { t: "Create account", body: () => [field(0, 0, 240, "name@studio.dev"), field(0, 0, 240, "••••••••"), button(0, 0, 240, "Continue")] },
        { t: "You're set", body: () => [txt(0, 0, "All connected 🎉", 22), button(0, 0, 240, "Open workspace")] },
      ];
      screens.forEach((s, i) => {
        const x = 60 + i * 340;
        out.push(rect(x, 80, 300, 600, { label: { ...label(s.t), fontSize: 11, strokeColor: MUTED, verticalAlign: "top" } }));
      });
      // place content manually per screen for a real layout
      out.push(txt(90, 430, "Your designs,\nin your repo", 22));
      out.push(button(90, 600, 240, "Get started"));
      out.push(txt(420, 150, "Create account", 22));
      out.push(field(420, 230, 240, "name@studio.dev"));
      out.push(field(420, 300, 240, "••••••••"));
      out.push(button(420, 600, 240, "Continue"));
      out.push(txt(770, 150, "You're set 🎉", 22));
      out.push(button(770, 600, 240, "Open workspace"));
      return out;
    },
  },
  {
    id: "blank",
    name: "Blank frame",
    blurb: "A single empty artboard to start from scratch.",
    tags: ["basic"],
    build: () => [
      rect(80, 80, 390, 844, { label: { ...label("Frame · 390×844"), fontSize: 11, strokeColor: MUTED, verticalAlign: "top" } }),
    ],
  },
  {
    id: "sinhaankur",
    name: "sinhaankur.com",
    blurb: "The full design system — tokens + component library + the hero screen.",
    tags: ["system", "demo"],
    // Special-cased in App.pickTemplate: loads a whole DesignSystem, not a skeleton.
    build: () => [],
  },
];
