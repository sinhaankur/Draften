/**
 * Text support — spell-check + light proofing for canvas text nodes.
 *
 * Tiering mirrors the AI stack: the browser's built-in spellchecker (free,
 * offline, per-locale) handles the common case with zero cost, and the on-device
 * LLM (Apple Intelligence / tiny WebLLM) can offer grammar/tone suggestions when
 * available. No cloud, no subscription for the baseline.
 */

/** Config applied to the text-edit overlay so the OS/browser spellchecks it. */
export interface TextEditConfig {
  spellCheck: boolean;
  autoCorrect: "on" | "off";
  autoCapitalize: "off" | "sentences" | "words";
  lang?: string;
}

export const defaultTextEditConfig: TextEditConfig = {
  spellCheck: true,
  autoCorrect: "off", // designers usually want exact copy; suggestions, not edits
  autoCapitalize: "off",
  lang: typeof navigator !== "undefined" ? navigator.language : "en",
};

/** DOM attributes for a contentEditable / textarea text-edit overlay. */
export function textEditAttrs(cfg: TextEditConfig = defaultTextEditConfig): Record<string, string> {
  return {
    spellcheck: String(cfg.spellCheck),
    autocorrect: cfg.autoCorrect,
    autocapitalize: cfg.autoCapitalize,
    ...(cfg.lang ? { lang: cfg.lang } : {}),
  };
}

/** A proofreading suggestion for a text run. */
export interface ProofSuggestion {
  /** character range in the source text */
  start: number;
  end: number;
  original: string;
  suggestion: string;
  kind: "spelling" | "grammar" | "style";
  note?: string;
}

/**
 * Ask the active on-device model to proofread a text run. Returns structured
 * suggestions the UI can show as underlines with accept/dismiss. Falls back to an
 * empty list when no model is available (the browser's own red-squiggle
 * spellcheck still works on the edit overlay, independent of this).
 */
export async function proofread(
  text: string,
  chat: (messages: { role: "system" | "user"; content: string }[]) => Promise<string>,
): Promise<ProofSuggestion[]> {
  if (!text.trim()) return [];
  const prompt =
    `Proofread the text between <t></t>. Return ONLY a JSON array of ` +
    `{start,end,original,suggestion,kind} for spelling/grammar/style fixes, ` +
    `character offsets into the text, no prose.\n<t>${text}</t>`;
  try {
    const out = await chat([
      { role: "system", content: "You are a concise proofreader. Output JSON only." },
      { role: "user", content: prompt },
    ]);
    const json = out.slice(out.indexOf("["), out.lastIndexOf("]") + 1);
    const parsed = JSON.parse(json) as ProofSuggestion[];
    return parsed.filter(
      (s) => typeof s.start === "number" && typeof s.suggestion === "string",
    );
  } catch {
    return []; // model unavailable or bad output → rely on native spellcheck
  }
}
