/**
 * project — turn a design into a REAL, runnable app (Draften = app builder).
 *
 * Not a snippet: a complete Vite + React + TypeScript project the user can
 * unzip, `npm install && npm run dev`, and see their design running. The same
 * files can be committed to a repo (git-backed). "Design → runnable app."
 *
 * Also emits a single self-contained index.html (zero build) for instant preview
 * and the simplest possible "it just runs" artifact.
 */

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { toHtml, toReact } from "./codegen";

export type ProjectFile = { path: string; content: string };

/** Zip the full project and download it — the runnable app, ready to ship. */
export async function downloadProject(api: ExcalidrawImperativeAPI, name: string): Promise<void> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const f of buildProject(api, name)) zip.file(f.path, f.content);
  const blob = await zip.generateAsync({ type: "blob" });
  triggerDownload(`${safe(name)}.zip`, blob);
}

/** Download the single self-contained HTML (instant run, no build). */
export function downloadStandaloneHtml(api: ExcalidrawImperativeAPI, name: string): void {
  triggerDownload(`${safe(name)}.html`, new Blob([buildStandaloneHtml(api, name)], { type: "text/html" }));
}

function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The full file set for a runnable Vite + React + TS app. */
export function buildProject(api: ExcalidrawImperativeAPI, name: string): ProjectFile[] {
  const els = api.getSceneElements();
  const appName = safe(name);
  const screen = toReact(els);
  const bg = (api.getAppState().viewBackgroundColor as string) || "#ffffff";

  return [
    { path: "package.json", content: pkg(appName) },
    { path: "index.html", content: viteIndexHtml(name) },
    { path: "vite.config.ts", content: viteConfig() },
    { path: "tsconfig.json", content: tsconfig() },
    { path: "src/main.tsx", content: mainTsx() },
    { path: "src/Screen.tsx", content: screen },
    { path: "src/index.css", content: `:root { color-scheme: light } * { box-sizing: border-box } body { margin: 0; background: ${bg}; font-family: Inter, system-ui, sans-serif }` },
    { path: "README.md", content: readme(name) },
    { path: ".gitignore", content: "node_modules\ndist\n.DS_Store\n" },
  ];
}

/** A single self-contained HTML file (no build) — the instant-run artifact. */
export function buildStandaloneHtml(api: ExcalidrawImperativeAPI, name: string): string {
  const body = toHtml(api.getSceneElements());
  const bg = (api.getAppState().viewBackgroundColor as string) || "#ffffff";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(name)}</title>
<style>:root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:${bg};font-family:Inter,system-ui,sans-serif}</style>
</head>
<body>
${body}
</body>
</html>`;
}

/* ── file templates ─────────────────────────────────────────────────────── */

function pkg(appName: string): string {
  return JSON.stringify({
    name: appName,
    private: true,
    version: "0.1.0",
    type: "module",
    scripts: { dev: "vite", build: "tsc && vite build", preview: "vite preview" },
    dependencies: { react: "^19.0.0", "react-dom": "^19.0.0" },
    devDependencies: { "@vitejs/plugin-react": "^4.3.0", typescript: "^5.6.0", vite: "^6.0.0", "@types/react": "^19.0.0", "@types/react-dom": "^19.0.0" },
  }, null, 2);
}

function viteIndexHtml(name: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(name)}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;
}

function viteConfig(): string {
  return `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({ plugins: [react()] });`;
}

function tsconfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: "ES2020", useDefineForClassFields: true, lib: ["ES2020", "DOM", "DOM.Iterable"],
      module: "ESNext", skipLibCheck: true, moduleResolution: "bundler", resolveJsonModule: true,
      isolatedModules: true, noEmit: true, jsx: "react-jsx", strict: true,
    },
    include: ["src"],
  }, null, 2);
}

function mainTsx(): string {
  return `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Screen } from "./Screen";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Screen />
  </StrictMode>,
);`;
}

function readme(name: string): string {
  return `# ${name}

Generated by **Draften** — design → runnable app.

\`\`\`bash
npm install
npm run dev     # open the local URL it prints
\`\`\`

The design lives in \`src/Screen.tsx\`. Edit it, or round-trip it back through
Draften. Build for production with \`npm run build\`.
`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const safe = (name: string) => (name || "draften-app").replace(/[^a-z0-9-]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase() || "draften-app";
