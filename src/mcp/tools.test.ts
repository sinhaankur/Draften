import { describe, expect, it } from "vitest";
import { MCP_TOOLS, mcpClientConfig, runMcpTool } from "./tools";

describe("MCP — Draften as an MCP server", () => {
  it("exposes named, documented tools with input schemas", () => {
    expect(MCP_TOOLS.length).toBeGreaterThanOrEqual(4);
    for (const t of MCP_TOOLS) {
      expect(t.name).toMatch(/^[a-z_]+$/);
      expect(t.description.length).toBeGreaterThan(5);
      expect(t.inputSchema.type).toBe("object");
    }
    expect(MCP_TOOLS.map((t) => t.name)).toEqual(expect.arrayContaining(["get_design", "export_html", "add_rectangle", "add_text"]));
  });

  it("add_rectangle requires geometry", () => {
    const t = MCP_TOOLS.find((x) => x.name === "add_rectangle")!;
    expect(t.inputSchema.required).toEqual(expect.arrayContaining(["x", "y", "width", "height"]));
  });

  it("emits a valid client config naming the draften server", () => {
    const cfg = JSON.parse(mcpClientConfig());
    expect(cfg.mcpServers.draften).toBeDefined();
    expect(cfg.mcpServers.draften.args).toContain("--mcp");
  });

  it("runMcpTool throws on an unknown tool", async () => {
    await expect(runMcpTool({} as never, "nope")).rejects.toThrow(/Unknown MCP tool/);
  });
});
