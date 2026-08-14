/**
 * Deterministic design-system generator — the model-free core of the AI feature.
 *
 * A full atomic design system (tokens + atoms → organisms, with React code) is a
 * *structured* problem, not a creative-writing one: given a brand brief you can
 * derive a coherent color scale, type ramp, spacing, and a standard component set
 * with real props + code — no LLM required. That's the reliable baseline.
 *
 * A tiny on-device LLM (see webllm-provider.ts) then *enhances* this: nicer
 * names, a palette matched to a described vibe, extra component ideas. But the
 * feature works fully offline with no model, no key, no subscription — which is
 * exactly Draften's free/open ethos. Small model in, big value out.
 */

import type {
  Component,
  ComponentProp,
  DesignSystem,
  DesignTokens,
  TypographyToken,
} from "../model/design-system";

export interface BrandBrief {
  brand: string;
  /** a vibe: "calm fintech", "playful", "editorial", "brutalist"… */
  style?: string;
  /** seed hue 0..360 for the primary; derived from the name if absent */
  primaryHue?: number;
  framework?: "react" | "vue" | "svelte";
}

export interface GeneratedSystem {
  tokens: DesignTokens;
  components: Component[];
  notes: string[];
}

// ── tokens ─────────────────────────────────────────────────────────────────

/** Derive a stable hue (0..360) from a string so a brand gets a consistent color. */
function hueFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}

/** HSL→hex. h in 0..360; s, l accepted as 0..100 (percent) and normalised here. */
function hsl(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const a = sN * Math.min(lN, 1 - lN);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = lN - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    const byte = Math.max(0, Math.min(255, Math.round(255 * c)));
    return byte.toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** A 50→900 tonal ramp around a hue, the way design systems structure color. */
function colorRamp(prefix: string, hue: number, sat: number): Record<string, string> {
  const stops: Array<[string, number]> = [
    ["50", 96],
    ["100", 90],
    ["200", 80],
    ["300", 68],
    ["400", 60],
    ["500", 52],
    ["600", 44],
    ["700", 36],
    ["800", 27],
    ["900", 18],
  ];
  const out: Record<string, string> = {};
  for (const [name, light] of stops) out[`${prefix}.${name}`] = hsl(hue, sat, light);
  return out;
}

export function generateTokens(brief: BrandBrief): DesignTokens {
  const hue = brief.primaryHue ?? hueFromString(brief.brand);
  const accentHue = (hue + 180) % 360; // complementary accent
  const sat = /brutal|bold|playful/i.test(brief.style ?? "") ? 85 : 62;

  const colors: Record<string, string> = {
    ...colorRamp("brand", hue, sat),
    ...colorRamp("accent", accentHue, Math.min(90, sat + 10)),
    ...colorRamp("neutral", hue, 8),
    "text.primary": hsl(hue, 8, 12),
    "text.muted": hsl(hue, 8, 44),
    "surface.base": "#ffffff",
    "surface.raised": hsl(hue, 10, 98),
    "danger.500": hsl(2, 72, 52),
    "success.500": hsl(146, 55, 42),
  };

  const editorial = /editorial|serif|luxury/i.test(brief.style ?? "");
  const sans = editorial ? "Fraunces, Georgia, serif" : "Inter, system-ui, sans-serif";
  const typography: Record<string, TypographyToken> = {
    "display.lg": { fontFamily: sans, fontSize: 48, fontWeight: 700, lineHeight: 1.05, letterSpacing: -0.5 },
    "heading.lg": { fontFamily: sans, fontSize: 28, fontWeight: 700, lineHeight: 1.2 },
    "heading.md": { fontFamily: sans, fontSize: 20, fontWeight: 600, lineHeight: 1.3 },
    "body.md": { fontFamily: "Inter, system-ui, sans-serif", fontSize: 16, fontWeight: 400, lineHeight: 1.5 },
    "body.sm": { fontFamily: "Inter, system-ui, sans-serif", fontSize: 13, fontWeight: 400, lineHeight: 1.4 },
    "label.sm": { fontFamily: "Inter, system-ui, sans-serif", fontSize: 12, fontWeight: 600, lineHeight: 1.2, letterSpacing: 0.4 },
  };

  // 4px base spacing scale
  const spacing: Record<string, number> = { "1": 4, "2": 8, "3": 12, "4": 16, "5": 24, "6": 32, "8": 48, "10": 64 };
  const round = /brutal/i.test(brief.style ?? "") ? 0 : /playful/i.test(brief.style ?? "") ? 16 : 8;
  const radii: Record<string, number> = { none: 0, sm: Math.max(2, round / 2), md: round, lg: round * 2, full: 9999 };
  const shadows: Record<string, string> = {
    sm: "0 1px 2px rgba(0,0,0,0.08)",
    md: "0 4px 12px rgba(0,0,0,0.10)",
    lg: "0 12px 32px rgba(0,0,0,0.14)",
  };

  return { colors, typography, spacing, radii, shadows };
}

// ── components (atomic) ──────────────────────────────────────────────────────

let counter = 0;
const cid = () => `gen-${Date.now().toString(36)}-${(counter++).toString(36)}`;

function comp(
  name: string,
  level: Component["level"],
  props: ComponentProp[],
  code: string,
  composedOf?: string[],
): Component {
  return { id: cid(), name, level, props, code: { react: code }, version: "0.1.0", origin: "ai", composedOf };
}

/** The standard atomic starter set every design system needs, with real code. */
export function generateComponents(brief: BrandBrief): Component[] {
  const fw = brief.framework ?? "react";
  if (fw !== "react") {
    // other frameworks: same structure, code left for the enhancer/codegen pass
  }

  const button = comp(
    "Button",
    "atom",
    [
      { name: "variant", type: "enum", options: ["primary", "secondary", "ghost"], default: "primary" },
      { name: "size", type: "enum", options: ["sm", "md", "lg"], default: "md" },
      { name: "label", type: "string", default: "Button" },
      { name: "disabled", type: "boolean", default: false },
    ],
    `export function Button({ variant = "primary", size = "md", label = "Button", disabled }: {
  variant?: "primary" | "secondary" | "ghost"; size?: "sm" | "md" | "lg"; label?: string; disabled?: boolean;
}) {
  return (
    <button className={\`btn btn-\${variant} btn-\${size}\`} disabled={disabled}>
      {label}
    </button>
  );
}`,
  );

  const input = comp(
    "Input",
    "atom",
    [
      { name: "placeholder", type: "string", default: "" },
      { name: "value", type: "string", default: "" },
      { name: "invalid", type: "boolean", default: false },
    ],
    `export function Input({ placeholder = "", value = "", invalid }: {
  placeholder?: string; value?: string; invalid?: boolean;
}) {
  return <input className={\`input\${invalid ? " input-invalid" : ""}\`} placeholder={placeholder} defaultValue={value} />;
}`,
  );

  const badge = comp(
    "Badge",
    "atom",
    [
      { name: "tone", type: "enum", options: ["neutral", "brand", "success", "danger"], default: "neutral" },
      { name: "text", type: "string", default: "New" },
    ],
    `export function Badge({ tone = "neutral", text = "New" }: {
  tone?: "neutral" | "brand" | "success" | "danger"; text?: string;
}) {
  return <span className={\`badge badge-\${tone}\`}>{text}</span>;
}`,
  );

  const field = comp(
    "Field",
    "molecule",
    [
      { name: "label", type: "string", default: "Label" },
      { name: "hint", type: "string", default: "" },
      { name: "invalid", type: "boolean", default: false },
    ],
    `import { Input } from "./Input";
export function Field({ label = "Label", hint = "", invalid }: {
  label?: string; hint?: string; invalid?: boolean;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <Input invalid={invalid} />
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}`,
    [input.id],
  );

  const card = comp(
    "Card",
    "molecule",
    [
      { name: "title", type: "string", default: "Card title" },
      { name: "body", type: "string", default: "" },
    ],
    `export function Card({ title = "Card title", body = "" }: { title?: string; body?: string }) {
  return (
    <section className="card">
      <h3 className="card-title">{title}</h3>
      {body && <p className="card-body">{body}</p>}
    </section>
  );
}`,
  );

  const form = comp(
    "SignUpForm",
    "organism",
    [{ name: "heading", type: "string", default: "Create your account" }],
    `import { Field } from "./Field";
import { Button } from "./Button";
export function SignUpForm({ heading = "Create your account" }: { heading?: string }) {
  return (
    <form className="signup">
      <h2>{heading}</h2>
      <Field label="Email" />
      <Field label="Password" />
      <Button label="Sign up" />
    </form>
  );
}`,
    [field.id, button.id],
  );

  const navbar = comp(
    "Navbar",
    "organism",
    [{ name: "brand", type: "string", default: brief.brand }],
    `import { Button } from "./Button";
export function Navbar({ brand = "${brief.brand}" }: { brand?: string }) {
  return (
    <header className="navbar">
      <div className="navbar-brand">{brand}</div>
      <nav className="navbar-links"><a>Home</a><a>Docs</a><a>Pricing</a></nav>
      <Button variant="primary" size="sm" label="Get started" />
    </header>
  );
}`,
    [button.id],
  );

  return [button, input, badge, field, card, form, navbar];
}

/** One call: a full, coherent system from a brief — no model needed. */
export function generateSystem(brief: BrandBrief): GeneratedSystem {
  const tokens = generateTokens(brief);
  const components = generateComponents(brief);
  return {
    tokens,
    components,
    notes: [
      `Generated ${components.length} components across atoms → organisms for "${brief.brand}".`,
      "Deterministic baseline (no model). A tiny on-device LLM can refine names, palette, and add ideas.",
    ],
  };
}

/**
 * Produce a full DesignSystem (brand + tokens + components) from a brief — the
 * shape the store + right-hand panel consume. The brand kit points its primary
 * color tokens at the generated ramp so the swatches reflect the real palette.
 */
export function generateDesignSystem(brief: BrandBrief): DesignSystem {
  const { tokens, components } = generateSystem(brief);
  return {
    brand: {
      name: brief.brand,
      primaryColorTokens: ["brand.500", "brand.700", "accent.500"],
    },
    tokens,
    components,
  };
}
