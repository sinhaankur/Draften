# Draften AI — claude.ai/design-grade assistant (spec)

> Goal (Ankur): make Draften's AI as good as **claude.ai / Claude design** — same
> skillset, "each detail the same": a real prompt→design assistant that **reads
> documents (PDF/Word/…)**, runs on **any LLM (local / Apple / cloud)**, keeps a
> **changelog** of every change, exposes **skills**, and stays a polished **desktop
> app** (Tauri). Open, on-device-first, honest.

## What exists (strong base — reuse, don't rebuild)
- `ai/provider.ts` — `AiProvider` (chat, streamed) + `AiActions` (generate library/
  code/diagram/tokens → structured edits) + `AiProviderRegistry`. The right contract.
- `ai/providers.ts` — tiered: Deterministic (tier 0), **Apple Intelligence** (Rust
  bridge), **WebLLM** (in-browser), `pickBestAvailable()`.
- `ai/design-gen.ts` — deterministic tokens + atomic component ladder (real code).
- `import/pdf.ts` (stub), `import/paste.ts`, `import/sketch.ts`, importer registry.
- `api/draften.ts` — unified API (`draften.ai`, commands, events, document, plugins).
- `ui/AiPanel.tsx` — the ✦ panel, but it only calls the deterministic generator.

## The gap = turn ✦ into a real assistant (the "powered by AI like claude.ai/design")
Today ✦ = a one-shot "generate a design system." We make it a **conversational design
assistant** that edits the one shared document through reviewable actions.

### 1. The assistant loop (core)
- A **chat panel**: prompt in → the active `AiProvider.chat()` (streamed) → the model
  returns **structured actions** (a JSON action list), which Draften **applies to the
  canvas** as reviewable edits. Same "actions, never opaque blobs" the contract
  already promises.
- **Action vocabulary** (extend `AiActions`): create/edit/move/style nodes, add a
  component/instance, generate a library, lay out a screen, apply tokens, make a
  diagram. Every action is a pure mutation through the store (undoable).
- **Grounded in the live document**: the model is given the current document summary
  (boards, selection, tokens) so "make this card match the brand" works on *this* doc.

### 2. Document ingest (PDF / Word / any) — "same power of reading a PDF/word"
- Finish `pdf.ts` with **pdf.js** (web) / the Rust side (desktop): page → board,
  text runs → text nodes, images → image nodes. (Mirrors Ankur's PDF-to-Figma work.)
- Add **Word (.docx)** via mammoth/docx → structured text → nodes; plaintext/markdown.
- **Attach-to-prompt**: drop a doc into the ✦ panel → its extracted content becomes
  context, so "turn this spec into a landing page" / "build a form from this PDF" works.
- On-device extraction; nothing uploaded.

### 3. Any LLM (local / Apple / cloud) — "works with local LLM or anything"
- Finish the tiers behind one picker: **WebLLM** (keyless, in-browser), **Apple
  Intelligence** (on-device, Rust bridge), **Ollama / OpenAI-compatible** (local or a
  user's own key), optional **Anthropic (Claude)** when a key is added.
- `pickBestAvailable()` is the default; a provider dropdown in the ✦ panel lets the
  user choose. Keyless + on-device by default (doctrine).

### 4. Changelog management — "changelog management so on"
- Every AI (and manual) mutation records a **change entry**: `{ id, time, author:
  "ai"|"you", summary, actions[], before/after refs }`.
- A **History panel**: timeline of changes, each with a plain-language summary ("AI
  added a 3-field sign-up form"), **undo/redo**, and **revert to any point**.
- The AI's structured actions make this honest + precise — you see exactly what it
  changed and can roll back. (This is also real changelog/versioning for the doc.)

### 5. Skills — "replicate skills too"
Like Claude's skills: named, composable capabilities the assistant can invoke.
- Code them as the extended `AiActions` + registerable **skill plugins** (reuse the
  existing plugin lifecycle): `design-system`, `wireframe`, `componentize`, `diagram`,
  `doc→design`, `tokens`, `copy`, `redline/spec`. Each = a deterministic core + a
  prompt the model fills; each shows in the assistant as a capability.
- Open: anyone can add a skill via the plugin API (the Blender-bpy strategy).

### 6. Desktop polish — "keep it a desktop app, as good as the screenshot"
- Stay **Tauri**. Match the referenced UI (awaiting the screenshot): a clean
  three-pane shell (canvas · assistant · inspector/history), the house motion
  (`ui/motion.ts`), sinhaankur.com craft (type ramp, restraint). Streaming responses,
  attach chips for docs, provider badge, a visible changelog.

## Build order
1. **Assistant loop** — ✦ chat → provider.chat (streamed) → parse action JSON → apply
   to the store (reviewable). The heart of "powered by AI."
2. **Changelog** — record every mutation + a History panel (undo/redo/revert). (Pairs
   with #1 so AI edits are safe from day one.)
3. **Document ingest** — real pdf.js extraction + docx; attach-to-prompt.
4. **Providers** — finish WebLLM/Apple/Ollama/Claude behind the picker.
5. **Skills** — formalise the action set as named skills + plugin-addable.
6. **Desktop UX pass** — match the screenshot; polish the shell + motion.

## Principles (don't drift)
On-device + keyless by default; every AI change is a reviewable action (no opaque
blobs) and lands in the changelog; open + pluggable; desktop-first; honest about what
each tier can do. © Ankur Sinha.
