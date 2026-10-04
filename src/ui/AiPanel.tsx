import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

import { generateDesignSystem } from "../ai/design-gen";
import {
  pickBestAvailable, DeterministicProvider, WebLlmProvider,
  LmStudioProvider, AppleIntelligenceProvider,
} from "../ai/providers";
import { runAssistant, type DraftenAction, type DocContext } from "../ai/assistant";
import type { AiProvider } from "../ai/provider";
import { useEditor } from "../state/store";
import { useChangelog } from "../state/changelog";
import { automate, AUTOMATIONS } from "../ai/automate";
import { drawSkeletonOnCanvas } from "../canvas/apply-action";
import { outline, buildPresentation } from "../ai/presentation";
import { planFlow, buildWireframe } from "../ai/wireframe";
import { autoNameLayers } from "../ai/layer-namer";
import { documentToSkeleton } from "../import/to-canvas";
import { overlay, scrim } from "./motion";

// Prompt starters — so a designer isn't staring at a blank box. Easy to use:
// tap one to fill the prompt, or write your own. The AUTOMATIONS run keyless.
const STARTERS = [
  "A sign-up screen using our design tokens",
  "A pricing section with three cards",
  "Turn the attached document into a landing page",
  "A mobile onboarding flow, 3 screens",
  "A dashboard header with search and avatar",
  ...AUTOMATIONS,
];

/**
 * The ✦ AI assistant — a conversational design assistant (claude.ai/design-grade).
 *
 * You type what you want (optionally attach a PDF/Word doc); the best available
 * provider — Apple Intelligence, an in-browser LLM, or the deterministic tier —
 * streams a reply and returns STRUCTURED ACTIONS that edit the one shared document.
 * Every change lands in the changelog (right here), so it's reviewable + undoable,
 * never a hollow shell. Keyless + on-device by default.
 */
export function AiPanel({ onClose, docked = false }: { onClose: () => void; docked?: boolean }) {
  const setDesignSystem = useEditor((s) => s.setDesignSystem);
  const loadDocument = useEditor((s) => s.loadDocument);
  const doc = useEditor((s) => s.doc);

  const entries = useChangelog((s) => s.entries);
  const cursor = useChangelog((s) => s.cursor);
  const undo = useChangelog((s) => s.undo);
  const redo = useChangelog((s) => s.redo);

  const [prompt, setPrompt] = useState("");
  const [streaming, setStreaming] = useState("");
  const [busy, setBusy] = useState(false);
  // The conversation thread — like Claude Design: each turn builds on the last.
  const [turns, setTurns] = useState<{ role: "you" | "ai"; text: string }[]>([]);
  const threadRef = useRef<HTMLDivElement>(null);
  const [attachment, setAttachment] = useState<{ name: string; text: string } | null>(null);
  const [provider, setProvider] = useState<AiProvider | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Pick the best on-device provider once, so the badge + runs use it.
  useEffect(() => { pickBestAvailable().then(setProvider).catch(() => {}); }, []);

  // Keep the conversation scrolled to the latest turn (Claude Design feel).
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, streaming]);

  // The providers a designer can switch between — all local/keyless by default;
  // LM Studio runs whatever model they've loaded on their machine.
  const PROVIDERS: { id: string; make: () => AiProvider }[] = [
    { id: "lmstudio", make: () => new LmStudioProvider() },
    { id: "webllm", make: () => new WebLlmProvider() },
    { id: "apple", make: () => new AppleIntelligenceProvider() },
    { id: "deterministic", make: () => new DeterministicProvider() },
  ];
  async function chooseProvider(id: string) {
    const made = PROVIDERS.find((p) => p.id === id)?.make();
    if (!made) return;
    if (made instanceof LmStudioProvider) { try { await made.refresh(); } catch { /* server may be off */ } }
    setProvider(made);
  }

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
    setTurns((t) => [...t, { role: "you", text: p }]);   // your message into the thread
    setPrompt("");
    try {
      // FAST, KEYLESS PATH FIRST: deterministic "scripts" (table of contents,
      // grids, flowcharts, nav bars, lists) run instantly with no model — the
      // modern OmniGraffle automation. Only fall through to the LLM if none matches.
      const auto = automate(p);
      if (auto) {
        const drew = await drawSkeletonOnCanvas(auto.skeleton);
        useChangelog.getState().record({
          author: "ai", via: "automation",
          summary: auto.summary,
          actions: [{ op: "layout", detail: auto.summary }],
        });
        setTurns((t) => [...t, { role: "ai", text: drew ? `✓ ${auto.summary} — drawn on the canvas. Ask for a change, or tell me what's next.` : `${auto.summary} — open a canvas to place it.` }]);
        setAttachment(null);
        setBusy(false);
        return;
      }

      const res = await runAssistant(provider, p, docContext(), {
        onToken: (t) => setStreaming((s) => s + t),
        apply: applyActions,
      });
      setTurns((t) => [...t, { role: "ai", text: res.message }]);
      setStreaming("");
      setAttachment(null);
    } catch (e) {
      setTurns((t) => [...t, { role: "ai", text: `Couldn't complete that: ${(e as Error).message}` }]);
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

  // Turn the CURRENT document (an imported PDF/Word) into a themed slide deck.
  // Deterministic — works on any tier — and promptable: the prompt text seeds the
  // theme/vibe. This is the "import a doc, make it a good presentation" path.
  async function makePresentation() {
    const items = outline(doc);
    if (!items.length) {
      setTurns((t) => [...t, { role: "ai", text: "Import a PDF or Word document first (Import file), then I can turn it into a presentation." }]);
      return;
    }
    setBusy(true);
    try {
      const vibe = /\b(dark|bold|night|midnight|editorial|calm|playful|minimal)\b/i.exec(prompt)?.[1];
      const deck = buildPresentation(items, { title: doc.name || "Presentation", theme: vibe, footer: doc.name });
      const renamed = autoNameLayers(deck); // AI-named layers, not "Rectangle"/"Text"
      loadDocument(deck);
      await drawSkeletonOnCanvas(documentToSkeleton(deck), true);
      useChangelog.getState().record({
        author: "ai", via: "deterministic",
        summary: `Built a ${deck.boards.length}-slide presentation${vibe ? ` (${vibe})` : ""} from ${items.length} outline items`,
        actions: [{ op: "layout", detail: "presentation", payload: { slides: deck.boards.length } }],
      });
      setTurns((t) => [...t, { role: "ai", text: `Built a ${deck.boards.length}-slide deck and named ${renamed} layers. Each slide is an editable artboard — edit any text or shape, then File ▸ Export PDF.` }]);
    } finally {
      setBusy(false);
    }
  }

  // Wireframe a UX flow from the prompt (the design-thinking core): intent →
  // multiple linked, editable screens built from real UI blocks, themed.
  async function wireframeFlow() {
    const intent = prompt.trim();
    if (!intent) {
      setTurns((t) => [...t, { role: "ai", text: "Describe a flow to wireframe — e.g. “onboarding flow for a fitness app” or “checkout flow”." }]);
      return;
    }
    setBusy(true);
    try {
      const vibe = /\b(dark|minimal|calm|bold|playful|editorial)\b/i.exec(intent)?.[1];
      const screens = planFlow(intent);
      const wf = buildWireframe(screens, { title: intent.slice(0, 48), theme: vibe });
      autoNameLayers(wf);
      loadDocument(wf);
      await drawSkeletonOnCanvas(documentToSkeleton(wf), true);
      useChangelog.getState().record({
        author: "ai", via: "deterministic",
        summary: `Wireframed “${intent}” as ${screens.length} linked screens`,
        actions: [{ op: "layout", detail: "wireframe", payload: { screens: screens.length } }],
      });
      setTurns((t) => [...t, { role: "ai", text: `Wireframed ${screens.length} screens: ${screens.map((s) => s.name).join(" → ")}. Each is an editable artboard — rework any block, then Present or export. Tell me what to change.` }]);
    } finally {
      setBusy(false);
    }
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

  const inner = (
      <>
        <div className="ai-head">
          <div className="ai-title">✦ Design assistant</div>
          <select className="ai-provider-pick small" value={provider?.info.id ?? ""}
            onChange={(e) => chooseProvider(e.target.value)} title="Choose the AI model">
            {!provider && <option value="">loading…</option>}
            <option value="lmstudio">LM Studio (local)</option>
            <option value="webllm">On-device (tiny LLM)</option>
            <option value="apple">Apple Intelligence</option>
            <option value="deterministic">Built-in (no model)</option>
          </select>
        </div>

        {/* conversation thread — chat with the canvas, like Claude Design */}
        <div className="ai-thread" ref={threadRef}>
          {turns.length === 0 && !streaming ? (
            <div className="ai-welcome">
              <p className="muted small">Describe what you want to design — then keep the conversation going to refine it. Everything you ask lands on the canvas.</p>
              <div className="ai-starters">
                {STARTERS.map((s) => (
                  <button key={s} className="ai-starter small" onClick={() => { setPrompt(s); }}>{s}</button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {turns.map((t, i) => (
                <div key={i} className={`ai-turn ai-turn-${t.role}`}>
                  <span className="ai-turn-who small">{t.role === "you" ? "You" : "✦ Draften"}</span>
                  <div className="ai-turn-text small">{t.text}</div>
                </div>
              ))}
              {streaming && (
                <div className="ai-turn ai-turn-ai">
                  <span className="ai-turn-who small">✦ Draften</span>
                  <div className="ai-turn-text small" aria-live="polite">{streaming}<span className="ai-caret">▍</span></div>
                </div>
              )}
              {busy && !streaming && (
                <div className="ai-turn ai-turn-ai"><span className="ai-turn-who small">✦ Draften</span><div className="ai-turn-text small muted">Thinking…</div></div>
              )}
            </>
          )}
        </div>

        {/* the prompt — pinned at the bottom like a chat composer */}
        <label className="ai-field">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={turns.length ? "Refine it, or ask for the next thing… (Enter to send)" : "Describe what you want to design… (Enter to send)"}
            rows={2}
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
          <button className="ghost small" onClick={wireframeFlow} disabled={busy}>Wireframe a flow</button>
          <button className="ghost small" onClick={quickSystem}>Quick design system</button>
          <button className="ghost small" onClick={makePresentation} disabled={busy}>Make presentation</button>
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
      </>
  );

  // Docked (Claude Design-style): render inline in the right rail, no overlay.
  if (docked) {
    return <div className="ai-assistant ai-docked">{inner}</div>;
  }
  return (
    <motion.div className="ai-overlay" onClick={onClose} {...scrim}>
      <motion.div className="ai-dialog ai-assistant" onClick={(e) => e.stopPropagation()} {...overlay}>
        {inner}
      </motion.div>
    </motion.div>
  );
}
