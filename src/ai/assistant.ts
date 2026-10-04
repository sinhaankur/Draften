/**
 * assistant — the conversational design assistant (claude.ai/design-grade).
 *
 * This is the brain behind the ✦ panel: a prompt (optionally with an attached
 * document) goes in; the active AiProvider streams a reply; the reply carries a
 * STRUCTURED ACTION LIST (never an opaque blob); we apply those actions to the one
 * shared document and record them in the changelog so every edit is reviewable and
 * undoable. Provider-agnostic — local LLM, Apple Intelligence, or cloud all plug in
 * behind `AiProvider`. Keyless + on-device by default.
 *
 * Honest by construction: if the model returns no valid actions, we say so and
 * change nothing — we never fabricate a design the user can't trust.
 *
 * © Ankur Sinha.
 */

import type { AiProvider, AiMessage } from "./provider";
import { useChangelog, type ChangeAction } from "../state/changelog";

/** The action schema the model is asked to emit (a compact, reviewable DSL). */
export interface DraftenAction {
  /** create | update | delete | style | move | component | tokens | layout | note */
  op: string;
  /** target node/component id, or a well-known key ("tokens", "selection") */
  target?: string;
  /** a short human sentence describing this action (shown in the changelog) */
  detail?: string;
  /** structured payload: node fields, token patch, component ref, etc. */
  payload?: Record<string, unknown>;
}

export interface AssistantReply {
  /** the model's prose answer (what it says it did / asks) */
  message: string;
  /** the structured actions it wants to apply */
  actions: DraftenAction[];
}

export interface DocContext {
  /** a compact summary of the live document the model edits (boards, selection,
   *  tokens) so edits are grounded in THIS doc, not a generic one. */
  summary: string;
  /** optional extracted text from an attached document (PDF/Word/…) */
  attachment?: { name: string; text: string };
  /** RAG: the passages retrieved as relevant to the prompt (doc + design system
   *  + UX laws), already formatted. Grounds edits + "why" answers. */
  retrieved?: string;
}

const SYSTEM = `You are Draften's design assistant. You edit ONE shared design document by returning STRUCTURED ACTIONS, never prose-only.
Reply with a short message, then a fenced JSON block of actions:
\`\`\`json
{"actions":[{"op":"create","detail":"a primary button","payload":{"type":"button","label":"Get started"}}]}
\`\`\`
Rules: use ONLY the document + retrieved context given; never invent data; prefer the design system's tokens; keep each action small and reviewable; if you can't help, return an empty actions array and say why. When you make a layout/placement/grouping decision, GROUND it in the retrieved UX laws and name the law (e.g. Proximity, Fitts's, Hick's). Ops: create, update, delete, style, move, component, tokens, layout, note.`;

/** Build the messages for the provider from the user's ask + doc context. */
export function buildMessages(prompt: string, ctx: DocContext): AiMessage[] {
  const parts: string[] = [`# Document\n${ctx.summary}`];
  if (ctx.retrieved) {
    // RAG: only the passages relevant to this prompt (doc + design system + UX laws).
    parts.push(`# Relevant context (retrieved)\n${ctx.retrieved}`);
  } else if (ctx.attachment) {
    // fallback when retrieval isn't available: the old blind slice
    parts.push(`# Attached: ${ctx.attachment.name}\n${ctx.attachment.text.slice(0, 8000)}`);
  }
  parts.push(`# Request\n${prompt}`);
  return [
    { role: "system", content: SYSTEM },
    { role: "user", content: parts.join("\n\n") },
  ];
}

/** Parse the model's reply into a message + actions. Tolerant: accepts a fenced
 *  ```json block, a bare {...}, or no JSON (→ empty actions). Never throws. */
export function parseReply(raw: string): AssistantReply {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonText = fence ? fence[1] : (raw.match(/\{[\s\S]*\}/)?.[0] ?? "");
  let actions: DraftenAction[] = [];
  if (jsonText) {
    try {
      const obj = JSON.parse(jsonText);
      const list = Array.isArray(obj) ? obj : obj.actions;
      if (Array.isArray(list)) {
        actions = list.filter((a) => a && typeof a.op === "string");
      }
    } catch {
      // malformed JSON → no actions; keep the prose. Honest, never a crash.
    }
  }
  // the human message = everything before the JSON block (or the whole thing)
  const message = (fence ? raw.slice(0, fence.index).trim() : raw.trim()) || "Done.";
  return { message, actions };
}

export interface RunResult extends AssistantReply {
  /** the changelog entry recorded for this turn (null if no actions applied) */
  entryId: string | null;
}

/**
 * Run one assistant turn: prompt → provider.chat (streamed) → parse → record in
 * the changelog. The caller (UI) subscribes via `onToken` for streaming, and
 * applies `reply.actions` to the canvas. Recording here keeps every AI edit in the
 * reviewable history by construction.
 */
export async function runAssistant(
  provider: AiProvider,
  prompt: string,
  ctx: DocContext,
  opts?: { onToken?: (t: string) => void; signal?: AbortSignal; apply?: (actions: DraftenAction[]) => void },
): Promise<RunResult> {
  const messages = buildMessages(prompt, ctx);
  const raw = await provider.chat(messages, { onToken: opts?.onToken, signal: opts?.signal });
  const reply = parseReply(raw);

  let entryId: string | null = null;
  if (reply.actions.length > 0) {
    // apply to the document (the UI supplies the applier that mutates the store)
    opts?.apply?.(reply.actions);
    // record a reviewable, undoable changelog entry
    const entry = useChangelog.getState().record({
      author: "ai",
      via: provider.info.id + (provider.info.models[0] ? `/${provider.info.models[0]}` : ""),
      summary: summarize(prompt, reply.actions),
      actions: reply.actions as ChangeAction[],
    });
    entryId = entry.id;
  }
  return { ...reply, entryId };
}

/** A plain-language one-liner for the History panel. */
function summarize(prompt: string, actions: DraftenAction[]): string {
  if (actions.length === 1 && actions[0].detail) return `AI: ${actions[0].detail}`;
  const ops = new Set(actions.map((a) => a.op));
  const verb = ops.has("create") ? "added" : ops.has("delete") ? "removed" : "updated";
  return `AI ${verb} ${actions.length} element${actions.length === 1 ? "" : "s"} · "${prompt.slice(0, 48)}"`;
}
