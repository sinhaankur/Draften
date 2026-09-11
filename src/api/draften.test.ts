import { describe, it, expect, vi } from "vitest";

import { draften, enablePlugin, disablePlugin, listPlugins, type DraftenPlugin } from "./draften";

describe("draften API — the unified surface", () => {
  it("exposes version + document facade", () => {
    expect(draften.version).toBeTruthy();
    expect(draften.document.get()).toBeTruthy();
    expect(Array.isArray(draften.document.boards.list())).toBe(true);
  });

  it("commands register, execute, and list", async () => {
    const ran = vi.fn();
    const off = draften.commands.register({ id: "test.hello", title: "Hello", run: () => { ran(); return 42; } });
    expect(draften.commands.list().some((c) => c.id === "test.hello")).toBe(true);
    const out = await draften.commands.execute("test.hello");
    expect(ran).toHaveBeenCalledOnce();
    expect(out).toBe(42);
    off();
    expect(draften.commands.list().some((c) => c.id === "test.hello")).toBe(false);
  });

  it("executing an unknown command throws", async () => {
    await expect(draften.commands.execute("nope.missing")).rejects.toThrow(/no command/);
  });

  it("events fire on emit and can be unsubscribed", () => {
    const h = vi.fn();
    const off = draften.events.on("document:changed", h);
    draften.events.emit("document:changed");
    expect(h).toHaveBeenCalledOnce();
    off();
    draften.events.emit("document:changed");
    expect(h).toHaveBeenCalledOnce(); // no second call after unsubscribe
  });

  it("document actions mutate + fire events", () => {
    const h = vi.fn();
    const off = draften.events.on("board:added", h);
    const before = draften.document.boards.list().length;
    draften.document.boards.add("diagram");
    expect(draften.document.boards.list().length).toBe(before + 1);
    expect(h).toHaveBeenCalled();
    off();
  });

  it("document round-trips through JSON (open format)", () => {
    draften.document.rename("Round Trip");
    const json = draften.document.toJSON();
    draften.document.rename("Changed");
    draften.document.fromJSON(json);
    expect(draften.document.get().name).toBe("Round Trip");
  });

  it("panels register + list by area", () => {
    const off = draften.panels.register({ id: "p1", title: "Mine", where: "right", render: () => null });
    expect(draften.panels.list("right").some((p) => p.id === "p1")).toBe(true);
    expect(draften.panels.list("left").some((p) => p.id === "p1")).toBe(false);
    off();
  });

  it("exposes importers + AI provider registries", () => {
    expect(Array.isArray(draften.importers.list())).toBe(true);
    expect(Array.isArray(draften.ai.providers())).toBe(true);
  });

  it("plugin lifecycle: enable runs activate, disable cleans up (VS Code/Godot style)", async () => {
    const activated = vi.fn();
    const cleaned = vi.fn();
    const plugin: DraftenPlugin = {
      id: "demo.plugin",
      name: "Demo",
      activate: (ctx) => {
        activated();
        ctx.subscriptions.push(draften.commands.register({ id: "demo.cmd", title: "Demo", run: () => "ok" }));
        return cleaned; // returned cleanup
      },
    };
    await enablePlugin(plugin);
    expect(activated).toHaveBeenCalledOnce();
    expect(listPlugins().some((p) => p.id === "demo.plugin")).toBe(true);
    expect(draften.commands.list().some((c) => c.id === "demo.cmd")).toBe(true);

    disablePlugin("demo.plugin");
    expect(cleaned).toHaveBeenCalledOnce();
    expect(listPlugins().some((p) => p.id === "demo.plugin")).toBe(false);
    // the command it registered via ctx.subscriptions is gone too
    expect(draften.commands.list().some((c) => c.id === "demo.cmd")).toBe(false);
  });
});
