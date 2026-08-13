/**
 * AI provider contract — "Claude or any LLM."
 *
 * Draften's AI is provider-agnostic: Claude, a local model, or anything else
 * plugs in behind this interface. The app talks to `AiProvider`; concrete
 * providers (Anthropic, OpenAI-compatible, Ollama) live in ai/providers/.
 *
 * The headline capabilities the vision calls for — "create a component library",
 * "git library", generate diagrams — are expressed as high-level actions that
 * return structured edits to the document model, never opaque blobs. Every AI
 * action produces reviewable changes to the one shared model.
 */

import type { Component } from "../model/design-system";
import type { Node } from "../model/node";

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiProviderInfo {
  id: string; // "anthropic" | "openai" | "ollama" | …
  label: string;
  /** models the provider offers; first is default */
  models: string[];
  /** true if it runs on-device / self-hosted (no key, offline) */
  local?: boolean;
}

export interface AiProvider {
  info: AiProviderInfo;
  /** raw chat, streamed token-by-token via onToken; returns the full text. */
  chat(
    messages: AiMessage[],
    opts?: { model?: string; onToken?: (t: string) => void; signal?: AbortSignal },
  ): Promise<string>;
}

/**
 * Structured AI actions built on top of a provider. These are what the UI calls.
 * Each returns edits to the document model (components/nodes/tokens), so results
 * are reviewable + undoable — not magic.
 */
export interface AiActions {
  /** "Create a component library" — generate an atomic-design component set from
   *  a brand/brief. Returns components (with code + props) for review. */
  generateComponentLibrary(brief: {
    brand: string;
    style?: string;
    /** which atomic levels to produce */
    levels?: Array<Component["level"]>;
    framework?: "react" | "vue" | "svelte";
  }): Promise<{ components: Component[]; notes: string[] }>;

  /** Generate the code view for an existing component from its visual + props. */
  generateComponentCode(component: Component): Promise<string>;

  /** Turn a prose description into diagram nodes (flow/journey/ideas). */
  generateDiagram(prompt: string, kind: "flow" | "journey" | "ideas"): Promise<Node[]>;

  /** Suggest design tokens (color/type/spacing scales) from a brand description. */
  suggestTokens(brandDescription: string): Promise<{
    colors: Record<string, string>;
    typography: Record<string, unknown>;
  }>;
}

/** Registry so providers are pluggable (open-source, add your own LLM). */
export class AiProviderRegistry {
  private providers = new Map<string, AiProvider>();
  private activeId?: string;

  register(p: AiProvider): void {
    this.providers.set(p.info.id, p);
    this.activeId ??= p.info.id;
  }

  list(): AiProviderInfo[] {
    return [...this.providers.values()].map((p) => p.info);
  }

  setActive(id: string): void {
    if (!this.providers.has(id)) throw new Error(`No AI provider "${id}"`);
    this.activeId = id;
  }

  active(): AiProvider | undefined {
    return this.activeId ? this.providers.get(this.activeId) : undefined;
  }
}

export const aiProviders = new AiProviderRegistry();
