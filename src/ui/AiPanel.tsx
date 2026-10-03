import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

import { generateDesignSystem } from "../ai/design-gen";
import { pickBestAvailable } from "../ai/providers";
import { runAssistant, type DraftenAction, type DocContext } from "../ai/assistant";
import type { AiProvider } from "../ai/provider";
import { useEditor } from "../state/store";
import { useChangelog } from "../state/changelog";
import { overlay, scrim } from "./motion";

/**
 * The ✦ AI assistant — a conversational design assistant (claude.ai/design-grade).
 *
 * You type what you want (optionally attach a PDF/Word doc); the best available
 * provider — Apple Intelligence, an in-browser LLM, or the deterministic tier —
 * streams a reply and returns STRUCTURED ACTIONS that edit the one shared document.
 * Every change lands in the changelog (right here), so it's reviewable + undoable,
 * never a hollow shell. Keyless + on-device by default.
 */
export function AiPanel({ onClose }: { onClose: () => void }) {
  const setDesignSystem = useEditor((s) => s.setDesignSystem);
  const doc = useEditor((s) => s.doc);

  const entries = useChangelog((s) => s.entries);
  const cursor = useChangelog((s) => s.cursor);
  const undo = useChangelog((s) => s.undo);
  const redo = useChangelog((s) => s.redo);

  const [prompt, setPrompt] = useState("");
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState(false);
  const [attachment, setAttachment] = useState<{ name: string; text: string } | null>(null);
  const [provider, setProvider] = useState<AiProvider | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Pick the best on-device provider once, so the badge + runs use it.
  useEffect(() => { pickBestAvailable().then(setProvider).catch(() => {}); }, []);

  // A compact summary of the live document so edits are grounded in THIS doc.
  function docContext(): DocContext {
    const boards = doc.boards.map((b) => `${b.name} (${b.kind})`).join(", ");
    const comps = doc.designSystem?.components?.length ?? 0;
    return {
      summary: `Document "${doc.name}". Boards: ${boards || "none"}. ` +
        `Design system: ${comps} component${comps === 1 ? "" : "s"}.`,
      attachment: attachment ?? undefined,
    };
  }

  // Apply the AI's structured actions to the document. For now the design-system
  // ops run through the store; node/layout ops are handed to the canvas layer.
  function applyActions(actions: DraftenAction[]) {
    for (const a of actions) {
      if (a.op === "tokens" || a.op === "component") {
        // (re)generate / extend the design system from the intent
        const brand = (a.payload?.brand as string) || doc.name || "Brand";
        setDesignSystem(generateDesignSystem({ brand, style: (a.payload?.style as string) }));
      }
      // create/update/move/style/layout → dispatched to the canvas applier
      // (window.draften API) so Excalidraw-backed boards receive the edit.
      try {
        (window as unknown as { draften?: { ai?: { applyAction?: (x: DraftenAction) => void } } })
          .draften?.ai?.applyAction?.(a);
      } catch { /* no-op: the canvas applier is optional until wired */ }
    }
  }

  async function send() {
    const p = prompt.trim();
    if (!p || busy || !provider) return;
    setBusy(true);
    setStreaming("");
    try {
      const res = await runAssistant(provider, p, docContext(), {
        onToken: (t) => setStreaming((s) => s + t),
        apply: applyActions,
      });
      setStreaming(res.message);
      setPrompt("");
      setAttachment(null);
    } catch (e) {
      setStreaming(`Couldn't complete that: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  // Quick deterministic design system (the old one-click path, kept as a chip).
  function quickSystem() {
    const ds = generateDesignSystem({ brand: doc.name || "Brand", style: "calm" });
    setDesignSystem(ds);
    useChangelog.getState().record({
      author: "ai", via: "deterministic",
      summary: "Generated a design system (tokens + atomic components)",
      actions: [{ op: "tokens", detail: "design system" }],
    });
  }

  async function onAttach(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Read as text for now (txt/md/json/csv). Real PDF/Word extraction lands with
    // the pdf.js + docx importers; this already lets you attach + ground a prompt.
    const text = await file.text().catch(() => "");
    setAttachment({ name: file.name, text });
  }

  const active = entries.slice(0, cursor);

  return (
    <motion.div className="ai-overlay" onClick={onClose} {...scrim}>
      <motion.div className="ai-dialog ai-assistant" onClick={(e) => e.stopPropagation()} {...overlay}>
        <div className="ai-head">
          <div className="ai-title">✦ Design assistant</div>
          <span className="ai-provider muted small">
            {provider ? provider.info.label : "loading…"}{provider?.info.local ? " · on-device" : ""}
          </span>
        </div>

        {/* streaming reply / status */}
        {streaming && (
          <div className="ai-reply small" aria-live="polite">{streaming}</div>
        )}

        {/* the prompt */}
        <label className="ai-field">
          <span>What do you want to design?</span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }}
            placeholder="e.g. a sign-up screen with our tokens, or: turn the attached PDF into a landing page"
            rows={3}
            autoFocus
          />
        </label>

        {/* attachment + quick action */}
        <div className="ai-row">
          <input ref={fileRef} type="file" hidden onChange={onAttach}
            accept=".txt,.md,.json,.csv,.pdf,.docx" />
          <button className="ghost small" onClick={() => fileRef.current?.click()}>
            {attachment ? `📎 ${attachment.name}` : "Attach a document"}
          </button>
          <button className="ghost small" onClick={quickSystem}>Quick design system</button>
        </div>

        <div className="ai-actions">
          <button className="ghost" onClick={onClose}>Close</button>
          <button className="ai-btn" onClick={send} disabled={busy || !prompt.trim() || !provider}>
            {busy ? "Thinking…" : "Send"}
          </button>
        </div>

        {/* changelog / history — every edit, reviewable + undoable */}
        {entries.length > 0 && (
          <div className="ai-history">
            <div className="ai-history-head">
              <span className="muted small">History</span>
              <span className="ai-history-ctrls">
                <button className="ghost small" onClick={() => undo()} disabled={cursor <= 0}>Undo</button>
                <button className="ghost small" onClick={() => redo()} disabled={cursor >= entries.length}>Redo</button>
              </span>
            </div>
            <ul className="ai-history-list">
              {entries.map((e, i) => (
                <li key={e.id} className={`small ${i < cursor ? "" : "ai-undone"}`}>
                  <span className={`ai-dot ${e.author === "ai" ? "ai-dot-ai" : ""}`} />
                  {e.summary}
                  {e.via && <span className="muted"> · {e.via}</span>}
                </li>
              ))}
            </ul>
            <p className="muted small">{active.length} of {entries.length} applied</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
