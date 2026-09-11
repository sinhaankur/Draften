// github-plugins.ts — install Draften plugins straight from GitHub.
//
// A plugin is just a JS module that default-exports a DraftenPlugin (id, name,
// activate(ctx)). Installing from GitHub = resolve a repo/URL to the raw module,
// import it, and run it through the same enablePlugin() lifecycle the built-ins
// use. This is the "GitHub plugin support" — the ecosystem grows the Blender way,
// with GitHub as the free distribution (no store to run).
//
// Trust note: a plugin is code. We only fetch when the user explicitly installs a
// URL they chose, surface what it is, and keep an installed-list they can remove.
//
// © Ankur Sinha. MIT.

import { enablePlugin, disablePlugin, type DraftenPlugin } from "./draften";

const STORE_KEY = "draften.installedPlugins.v1";

export interface InstalledRef {
  id: string;
  name: string;
  source: string;   // the URL/repo the user installed from
  addedAt: string;
}

// ── resolve various GitHub inputs → a raw ESM URL ─────────────────────────────
// Accepts:
//   • https://raw.githubusercontent.com/owner/repo/branch/path/plugin.js  (as-is)
//   • https://github.com/owner/repo/blob/branch/path/plugin.js            → raw
//   • owner/repo                        → main/draften-plugin.js (convention)
//   • owner/repo@branch                 → that branch's draften-plugin.js
export function resolvePluginUrl(input: string): string {
  const s = input.trim();
  if (/^https?:\/\/raw\.githubusercontent\.com\//.test(s)) return s;
  const blob = s.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/(.+)$/);
  if (blob) return `https://raw.githubusercontent.com/${blob[1]}/${blob[2]}/${blob[3]}`;
  const shorthand = s.match(/^([\w.-]+)\/([\w.-]+)(?:@([\w.\-/]+))?$/);
  if (shorthand) {
    const [, owner, repo, branch = "main"] = shorthand;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/draften-plugin.js`;
  }
  if (/^https?:\/\//.test(s)) return s; // any other direct module URL
  throw new Error(`Can't resolve a plugin from "${input}". Use owner/repo, a github.com blob URL, or a raw module URL.`);
}

// ── fetch + import a module, validate it's a DraftenPlugin ─────────────────────
export async function loadPluginModule(url: string): Promise<DraftenPlugin> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed (${res.status}) for ${url}`);
  const code = await res.text();
  // import as a module via a blob URL (works in browser + Tauri webview)
  const blobUrl = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));
  try {
    const mod = await import(/* @vite-ignore */ blobUrl);
    const plugin: DraftenPlugin = mod.default ?? mod.plugin ?? mod;
    validatePlugin(plugin);
    return plugin;
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}

export function validatePlugin(p: unknown): asserts p is DraftenPlugin {
  const o = p as Record<string, unknown>;
  if (!o || typeof o !== "object") throw new Error("Plugin module has no export.");
  if (typeof o.id !== "string" || !o.id) throw new Error("Plugin is missing a string `id`.");
  if (typeof o.name !== "string" || !o.name) throw new Error("Plugin is missing a string `name`.");
  if (typeof o.activate !== "function") throw new Error("Plugin is missing an `activate(ctx)` function.");
}

// ── install / uninstall (persisted list) ──────────────────────────────────────
export async function installFromGitHub(input: string): Promise<InstalledRef> {
  const url = resolvePluginUrl(input);
  const plugin = await loadPluginModule(url);
  await enablePlugin(plugin);
  const ref: InstalledRef = { id: plugin.id, name: plugin.name, source: input, addedAt: new Date().toISOString() };
  const list = loadInstalled().filter((r) => r.id !== ref.id);
  list.push(ref);
  saveInstalled(list);
  return ref;
}

export function uninstall(id: string): void {
  disablePlugin(id);
  saveInstalled(loadInstalled().filter((r) => r.id !== id));
}

export function loadInstalled(): InstalledRef[] {
  if (typeof localStorage === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || "[]"); } catch { return []; }
}
function saveInstalled(list: InstalledRef[]) {
  try { localStorage?.setItem(STORE_KEY, JSON.stringify(list)); } catch { /* private mode */ }
}

/** Re-install every persisted plugin (call at startup). Failures don't block boot. */
export async function restoreInstalled(): Promise<void> {
  for (const ref of loadInstalled()) {
    try { await enablePlugin(await loadPluginModule(resolvePluginUrl(ref.source))); }
    catch (e) { console.warn(`[draften] couldn't restore plugin ${ref.id}:`, e); }
  }
}
