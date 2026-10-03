---
name: draften-add-a-feature
description: The repeatable loop for adding a REAL, tested feature to Draften
when-to-use: Whenever you implement any new Draften capability (panel, tool, importer, export).
---

# Skill: Add a real feature to Draften

Draften's bar: as good as **Sketch + Figma + OmniGraffle**, but **free, open-format,
git-backed, on-device AI**. Every addition must be genuinely functional.

## The loop
1. **Read first.** Check `src/App.tsx` (the shell), the relevant `src/ui/*`, and the
   canvas API (`src/canvas/ExcalidrawCanvas.tsx`). Don't duplicate existing real work.
2. **Build on the scene graph.** The canvas is Excalidraw. Read/write via its API:
   `getSceneElements()`, `updateScene({ elements })`, `getAppState()`, `exportToSvg()`,
   `serializeAsJSON()`. New panels read the live scene; they don't keep a shadow copy.
   - `updateScene` elements need the cast `as Parameters<typeof api.updateScene>[0]["elements"]`.
3. **Match the design system** → follow `design-system.md` (tokens, lucide@1.5).
4. **Log real changes** to `useChangelog` (author/summary/actions) so Console + History
   stay honest.
5. **Persist.** Canvas auto-saves via `src/io/persist.ts` — don't break the `onChange`
   autosave or the restore-on-load path. Work is never lost.
6. **Test.** Add vitest for pure logic (`*.test.ts`). `pnpm test` (74+ green) AND
   `pnpm build` (tsc strict catches what vitest misses).
7. **Smoke it.** Playwright-render the preview and click the feature end-to-end; assert
   zero console/page errors before calling it done.
8. **Commit + push.** No `Co-Authored-By` trailers. Then rebuild the desktop app
   (`pnpm tauri build --bundles app`) only if everything is green + verified.

## Formats stay open
Saving/exporting is `.draften.json` / `.excalidraw` / SVG / PNG (see `src/io/files.ts`).
Never a proprietary format. "Your file stays yours" + git-committable.

## Collaboration = git (provider-agnostic)
GitHub is the testing ground now; keep the git layer (`src/git/*`) abstract so GitLab /
Bitbucket / any-git slot in later without a rewrite.
