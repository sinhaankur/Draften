/**
 * The design system — Draften's spine.
 *
 * Brand kit → design tokens → components, with components organised by **Atomic
 * Design** (atoms → molecules → organisms → templates → pages). The canvas nodes
 * reference tokens and instantiate components, so the system is the single source
 * of truth: change a token or a component and every usage updates.
 *
 * This is also the unit AI generates ("create a component library") and Git
 * versions ("git library").
 */

/** Brad Frost's atomic-design levels — the library's organising axis. */
export type AtomicLevel = "atom" | "molecule" | "organism" | "template" | "page";

/** A design token: a named, referenceable value. Grouped by kind. */
export interface DesignTokens {
  /** e.g. { "brand.500": "#4C6FFF", "text.primary": "#0B0D12" } */
  colors: Record<string, string>;
  /** e.g. { "heading.lg": { fontFamily, fontSize, fontWeight, lineHeight } } */
  typography: Record<string, TypographyToken>;
  /** spacing scale, e.g. { "2": 8, "3": 12, "4": 16 } */
  spacing: Record<string, number>;
  /** corner radii, e.g. { "sm": 4, "md": 8, "lg": 16 } */
  radii: Record<string, number>;
  /** shadow tokens as CSS box-shadow strings */
  shadows: Record<string, string>;
}

export interface TypographyToken {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing?: number;
}

/** The brand kit — the top of the workflow that everything else derives from. */
export interface BrandKit {
  name: string;
  /** node id of the logo artwork living on a board (so it's editable in canvas) */
  logoNodeId?: string;
  tagline?: string;
  /** primary brand color token ids, in priority order */
  primaryColorTokens?: string[];
}

/**
 * A component in the library. It owns:
 *  - a visual definition (a node subtree, by root node id in the document)
 *  - a typed prop schema (drives instances + the code view + AI)
 *  - a code binding (the VS-Code-level source, generated/edited)
 *  - its atomic level and version (the library is versioned)
 */
export interface Component {
  id: string;
  name: string;
  level: AtomicLevel;
  /** which components this one composes from (molecules ← atoms, etc.) */
  composedOf?: string[];
  /** root node id of the component's visual definition in the document */
  rootNodeId?: string;
  /** typed props — drive instance overrides, code, and AI generation */
  props: ComponentProp[];
  /** the code view: source per target (react first) */
  code?: Partial<Record<CodeTarget, string>>;
  /** semver of this component; the library keeps history via Git */
  version: string;
  description?: string;
  /** provenance: hand-built, imported, or AI-generated */
  origin: "manual" | "imported" | "ai";
}

export type CodeTarget = "react" | "vue" | "svelte" | "html" | "swiftui";

export interface ComponentProp {
  name: string;
  type: "string" | "number" | "boolean" | "color" | "enum" | "node";
  /** for enum props */
  options?: string[];
  default?: unknown;
  description?: string;
}

export interface DesignSystem {
  brand: BrandKit;
  tokens: DesignTokens;
  components: Component[];
}

// ── helpers ──────────────────────────────────────────────────────────────────

/** Group a library by atomic level, in canonical order, for the panel + docs. */
export function byAtomicLevel(components: Component[]): Record<AtomicLevel, Component[]> {
  const order: AtomicLevel[] = ["atom", "molecule", "organism", "template", "page"];
  const out = Object.fromEntries(order.map((l) => [l, [] as Component[]])) as Record<
    AtomicLevel,
    Component[]
  >;
  for (const c of components) out[c.level].push(c);
  return out;
}

/** Resolve a token reference like "color.brand.500" against the tokens. */
export function resolveColorToken(tokens: DesignTokens, ref: string): string | undefined {
  // refs are stored without the leading "color." group prefix in `colors`
  const key = ref.replace(/^color\./, "");
  return tokens.colors[key];
}
