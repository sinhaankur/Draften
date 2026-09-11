// draften.ts — the ONE API surface, like Blender's `bpy`.
//
// Everything — the app itself, AI actions, importers, plugins, and (later) the MCP
// server — goes through this single object. There is no private "core-only" power:
// a plugin can do anything the app can. That uniformity is what let Blender grow a
// thousand add-ons, and it's the architecture Draften copies.
//
// Design borrows deliberately from the tools we admire:
//   • Blender bpy   → one module: document, actions (operators), props, panels.
//   • VS Code       → registerCommand / executeCommand + an events bus + activate(ctx).
//   • Godot         → a plugin lifecycle (enable/disable) with a passed-in context.
//   • Excalidraw    → an open, serialisable document (export/import JSON).
//   • Penpot        → components/tokens are first-class in the model.
//
// © Ankur Sinha. MIT.

import { useEditor } from "../state/store";
import { importers } from "../import/importer";
import { aiProviders } from "../ai/provider";
import { pickBestAvailable } from "../ai/providers";
import type { DraftenDocument, BoardKind } from "../model/document";
import type { DesignSystem, Component } from "../model/design-system";
import type { Importer, ImportInput } from "../import/importer";

// ── events (VS Code-style bus) ────────────────────────────────────────────────
export type DraftenEvent =
  | "document:changed"
  | "board:added"
  | "board:activated"
  | "designSystem:changed"
  | "selection:changed"
  | "import:done"
  | "command:ran";

type Handler = (payload?: unknown) => void;

class EventBus {
  private map = new Map<DraftenEvent, Set<Handler>>();
  on(evt: DraftenEvent, h: Handler): () => void {
    const set = this.map.get(evt) ?? new Set();
    set.add(h); this.map.set(evt, set);
    return () => set.delete(h); // disposable, VS Code style
  }
  emit(evt: DraftenEvent, payload?: unknown) {
    this.map.get(evt)?.forEach((h) => { try { h(payload); } catch (e) { console.error(`[draften] handler for ${evt} threw`, e); } });
  }
}

// ── commands (VS Code-style registry) ─────────────────────────────────────────
export interface Command {
  id: string;                 // "draften.addBoard"
  title: string;              // "Add board"
  run: (arg?: unknown) => unknown | Promise<unknown>;
}

class CommandRegistry {
  private map = new Map<string, Command>();
  register(cmd: Command): () => void {
    if (this.map.has(cmd.id)) console.warn(`[draften] command ${cmd.id} re-registered`);
    this.map.set(cmd.id, cmd);
    return () => this.map.delete(cmd.id);
  }
  async execute(id: string, arg?: unknown) {
    const cmd = this.map.get(id);
    if (!cmd) throw new Error(`[draften] no command: ${id}`);
    const out = await cmd.run(arg);
    bus.emit("command:ran", { id, arg });
    return out;
  }
  list(): Command[] { return [...this.map.values()]; }
}

// ── panels (contributed UI, Blender/Godot style) ──────────────────────────────
export interface PanelContribution {
  id: string;
  title: string;
  where: "left" | "right" | "inspector";
  /** returns an element to mount; kept framework-light (React node or DOM). */
  render: () => unknown;
}
class PanelRegistry {
  private map = new Map<string, PanelContribution>();
  register(p: PanelContribution): () => void { this.map.set(p.id, p); bus.emit("document:changed"); return () => this.map.delete(p.id); }
  list(where?: PanelContribution["where"]): PanelContribution[] {
    return [...this.map.values()].filter((p) => !where || p.where === where);
  }
}

const bus = new EventBus();
const commands = new CommandRegistry();
const panels = new PanelRegistry();

// ── the document facade (bpy.data + bpy.ops, unified) ─────────────────────────
const s = () => useEditor.getState();

const document = {
  /** the live document (read). */
  get(): DraftenDocument { return s().doc; },
  /** replace the whole document (importers use this). */
  load(doc: DraftenDocument) { s().loadDocument(doc); bus.emit("document:changed"); },
  /** rename the document. */
  rename(name: string) { s().rename(name); bus.emit("document:changed"); },
  /** export the document as JSON (Excalidraw-style open format). */
  toJSON(): string { return JSON.stringify(s().doc, null, 2); },
  /** import a document from JSON. */
  fromJSON(json: string) { this.load(JSON.parse(json) as DraftenDocument); },

  boards: {
    list() { return s().doc.boards; },
    active() { return s().activeBoard(); },
    add(kind: BoardKind = "design") { s().addBoard(kind); bus.emit("board:added"); },
    activate(id: string) { s().setActiveBoard(id); bus.emit("board:activated", id); },
  },

  designSystem: {
    get(): DesignSystem { return s().doc.designSystem; },
    set(ds: DesignSystem) { s().setDesignSystem(ds); bus.emit("designSystem:changed"); },
    components(): Component[] { return s().doc.designSystem.components; },
    tokens() { return s().doc.designSystem.tokens; },
  },
};

// ── the public API object ─────────────────────────────────────────────────────
export const draften = {
  version: "0.1.0",

  // data + actions
  document,

  // extension points
  commands: {
    register: (c: Command) => commands.register(c),
    execute: (id: string, arg?: unknown) => commands.execute(id, arg),
    list: () => commands.list(),
  },
  panels: {
    register: (p: PanelContribution) => panels.register(p),
    list: (where?: PanelContribution["where"]) => panels.list(where),
  },
  events: {
    on: (evt: DraftenEvent, h: Handler) => bus.on(evt, h),
    emit: (evt: DraftenEvent, payload?: unknown) => bus.emit(evt, payload),
  },

  // importers (any tool's files → the model)
  importers: {
    register: (imp: Importer) => importers.register(imp),
    list: () => importers.all(),
    pick: (input: ImportInput) => importers.pick(input),
  },

  // AI providers (deterministic / on-device / cloud)
  ai: {
    providers: () => aiProviders.list(),
    best: () => pickBestAvailable(),
  },
} as const;

export type DraftenAPI = typeof draften;

// ── plugin lifecycle (Godot/VS Code style) ────────────────────────────────────
export interface DraftenPlugin {
  id: string;
  name: string;
  /** called when enabled; register commands/panels/importers here. Return a
   *  cleanup fn or push disposables to ctx.subscriptions (VS Code pattern). */
  activate: (ctx: PluginContext) => void | (() => void) | Promise<void | (() => void)>;
  deactivate?: () => void;
}
export interface PluginContext {
  api: DraftenAPI;
  /** disposables auto-cleaned on deactivate. */
  subscriptions: Array<() => void>;
}

const enabled = new Map<string, { plugin: DraftenPlugin; ctx: PluginContext; cleanup?: () => void }>();

export async function enablePlugin(plugin: DraftenPlugin) {
  if (enabled.has(plugin.id)) return;
  const ctx: PluginContext = { api: draften, subscriptions: [] };
  const cleanup = await plugin.activate(ctx);
  enabled.set(plugin.id, { plugin, ctx, cleanup: typeof cleanup === "function" ? cleanup : undefined });
  console.info(`[draften] plugin enabled: ${plugin.name}`);
}
export function disablePlugin(id: string) {
  const e = enabled.get(id);
  if (!e) return;
  e.cleanup?.();
  e.ctx.subscriptions.forEach((d) => { try { d(); } catch {} });
  e.plugin.deactivate?.();
  enabled.delete(id);
  console.info(`[draften] plugin disabled: ${id}`);
}
export function listPlugins() { return [...enabled.values()].map((e) => ({ id: e.plugin.id, name: e.plugin.name })); }

// Expose on window for the console + external tools (like bpy in Blender's console).
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).draften = draften;
}
