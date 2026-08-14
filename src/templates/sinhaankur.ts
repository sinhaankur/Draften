/**
 * Template: sinhaankur.com — a real design system + screen for testing Draften.
 *
 * Built from Ankur's actual site language (not invented): the near-black ground
 * (#050505), warm off-white ink (#f5f5f0), amber/gold accent (#e9b545), and the
 * Inter / Fraunces / JetBrains type ramp. Ships a full DesignSystem (tokens +
 * atomic component library) plus a canvas screen (the "DESIGN × ENGINEERING × AI"
 * hero) as an Excalidraw skeleton. Loading it exercises the whole pipeline:
 * tokens → component panel → canvas — end to end, in one click.
 */

import type { DesignSystem, Component } from "../model/design-system";

// ── real palette + type from sinhaankur.com ──────────────────────────────────
const INK = "#050505";
const PAPER = "#f5f5f0";
const GOLD = "#e9b545";
const GOLD_DK = "#cf9a2c";

let n = 0;
const cid = (name: string) => `tmpl-${name}-${(n++).toString(36)}`;

function comp(
  name: string,
  level: Component["level"],
  props: Component["props"],
  code: string,
  composedOf?: string[],
): Component {
  return {
    id: cid(name),
    name,
    level,
    props,
    code: { react: code },
    version: "1.0.0",
    origin: "manual",
    description: `From sinhaankur.com — ${name}`,
    composedOf,
  };
}

/** The design system, faithful to the site. */
export const sinhaankurDesignSystem: DesignSystem = {
  brand: {
    name: "sinhaankur.com",
    tagline: "Design × Engineering × AI",
    primaryColorTokens: ["ink.900", "gold.500", "paper.100"],
  },
  tokens: {
    colors: {
      "ink.900": INK,
      "ink.800": "#0a0a0a",
      "ink.700": "#141414",
      "paper.100": PAPER,
      "paper.0": "#ffffff",
      "gold.500": GOLD,
      "gold.600": GOLD_DK,
      "text.primary": PAPER,
      "text.muted": "#9a9a92",
    },
    typography: {
      "display.xl": { fontFamily: "Fraunces", fontSize: 72, fontWeight: 300, lineHeight: 0.95, letterSpacing: -1 },
      "display.italic": { fontFamily: "Instrument Serif", fontSize: 64, fontWeight: 400, lineHeight: 1.0 },
      "heading.lg": { fontFamily: "Inter", fontSize: 28, fontWeight: 300, lineHeight: 1.2 },
      "body.md": { fontFamily: "Inter", fontSize: 16, fontWeight: 400, lineHeight: 1.6 },
      "eyebrow.mono": { fontFamily: "JetBrains Mono", fontSize: 12, fontWeight: 400, lineHeight: 1.2, letterSpacing: 1.5 },
    },
    spacing: { "1": 4, "2": 8, "3": 12, "4": 16, "6": 24, "8": 32, "12": 48 },
    radii: { none: 0, sm: 6, md: 12, pill: 999 },
    shadows: { sm: "0 1px 2px rgba(0,0,0,0.4)", lg: "0 20px 60px rgba(0,0,0,0.5)" },
  },
  components: [
    comp(
      "NavLink",
      "atom",
      [{ name: "label", type: "string", default: "Works" }],
      `export function NavLink({ label = "Works" }: { label?: string }) {
  return <a className="navlink">{label}</a>;
}`,
    ),
    comp(
      "PillButton",
      "atom",
      [
        { name: "label", type: "string", default: "View my work" },
        { name: "variant", type: "enum", options: ["solid", "outline"], default: "solid" },
      ],
      `export function PillButton({ label = "View my work", variant = "solid" }: {
  label?: string; variant?: "solid" | "outline";
}) {
  return <button className={\`pill pill-\${variant}\`}>{label}</button>;
}`,
    ),
    comp(
      "Eyebrow",
      "atom",
      [{ name: "text", type: "string", default: "02 — DOMAIN" }],
      `export function Eyebrow({ text = "02 — DOMAIN" }: { text?: string }) {
  return <span className="eyebrow">{text}</span>;
}`,
    ),
    comp(
      "Navbar",
      "organism",
      [],
      `import { NavLink } from "./NavLink";
export function Navbar() {
  return (
    <nav className="navbar">
      <span className="brand">Ankur Sinha</span>
      {["Works","Lab","Framework","Skills","Games","Contact"].map(l => <NavLink key={l} label={l} />)}
    </nav>
  );
}`,
      [/* NavLink id filled at runtime; kept simple for the template */],
    ),
    comp(
      "Hero",
      "organism",
      [{ name: "headline", type: "string", default: "DESIGN × ENGINEERING × AI" }],
      `import { PillButton } from "./PillButton";
export function Hero({ headline = "DESIGN × ENGINEERING × AI" }: { headline?: string }) {
  return (
    <header className="hero">
      <h1 className="hero-title">{headline}</h1>
      <p className="hero-sub">Principal UX Designer at Oracle, working at the human–AI seam.</p>
      <div className="hero-cta"><PillButton label="View my work" /><PillButton label="Résumé" variant="outline" /></div>
    </header>
  );
}`,
    ),
    comp(
      "CaseCard",
      "molecule",
      [
        { name: "title", type: "string", default: "Oracle" },
        { name: "kicker", type: "string", default: "Case study" },
      ],
      `export function CaseCard({ title = "Oracle", kicker = "Case study" }: {
  title?: string; kicker?: string;
}) {
  return (
    <article className="case-card">
      <span className="case-kicker">{kicker}</span>
      <h3 className="case-title">{title}</h3>
    </article>
  );
}`,
    ),
    comp(
      "Footer",
      "organism",
      [],
      `export function Footer() {
  return <footer className="footer">© Ankur Sinha · Design × Engineering × AI</footer>;
}`,
    ),
  ],
};

/**
 * The canvas screen — the site hero as an Excalidraw element skeleton. Dark
 * artboard, gold headline accent, the two CTA pills, on the near-black ground.
 * Returned as a skeleton so ExcalidrawCanvas can convertToExcalidrawElements it.
 */
export function sinhaankurScreenSkeleton() {
  // fillStyle solid so the dark artboard + gold pill render as flat color, not
  // Excalidraw's default sparse hachure (which reads as near-empty on dark).
  const base = { roughness: 0 as const, strokeWidth: 1, fillStyle: "solid" as const };
  return [
    // the dark artboard
    {
      ...base,
      type: "rectangle" as const,
      id: "screen",
      x: 60,
      y: 60,
      width: 900,
      height: 560,
      strokeColor: "#2a2a2a",
      backgroundColor: INK,
      roundness: { type: 3 as const },
    },
    // nav row (mono eyebrow strip)
    {
      ...base,
      type: "text" as const,
      x: 100,
      y: 96,
      strokeColor: PAPER,
      fontFamily: 3, // code/mono
      fontSize: 14,
      text: "Ankur Sinha        Works   Lab   Framework   Skills   Games   Contact",
    },
    // big display headline
    {
      ...base,
      type: "text" as const,
      x: 100,
      y: 200,
      strokeColor: PAPER,
      fontFamily: 2,
      fontSize: 64,
      text: "DESIGN ×\nENGINEERING",
    },
    {
      ...base,
      type: "text" as const,
      x: 100,
      y: 350,
      strokeColor: GOLD,
      fontFamily: 2,
      fontSize: 64,
      text: "× AI",
    },
    // sub copy
    {
      ...base,
      type: "text" as const,
      x: 100,
      y: 448,
      strokeColor: "#9a9a92",
      fontFamily: 2,
      fontSize: 18,
      text: "Principal UX Designer at Oracle, working at the human–AI seam.",
    },
    // CTA pill: solid gold "View my work"
    {
      ...base,
      type: "rectangle" as const,
      id: "cta1",
      x: 100,
      y: 500,
      width: 180,
      height: 44,
      strokeColor: GOLD,
      backgroundColor: GOLD,
      roundness: { type: 3 as const },
      label: { text: "View my work", fontSize: 16, fontFamily: 2, strokeColor: INK },
    },
    // CTA pill: outline "Résumé"
    {
      ...base,
      type: "rectangle" as const,
      id: "cta2",
      x: 296,
      y: 500,
      width: 120,
      height: 44,
      strokeColor: PAPER,
      backgroundColor: "transparent",
      roundness: { type: 3 as const },
      label: { text: "Résumé", fontSize: 16, fontFamily: 2, strokeColor: PAPER },
    },
  ];
}
