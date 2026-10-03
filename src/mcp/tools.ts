/**
 * mcp/tools — Draften AS an MCP server.
 *
 * Draften exposes its canvas as MCP tools so an external AI (Claude Desktop, an
 * IDE agent, etc.) can read and edit the design. The tool SCHEMAS + handlers
 * live here (pure, testable); the transport (how an external client reaches
 * them) is the Tauri desktop side — in the browser build these run against the
 * live Excalidraw API in-process, which also powers the in-app assistant.
 *
 * This is the v2 "Draften as an MCP server" feature. Each tool is a named,
 * documented capability with a JSON-schema input — exactly the MCP contract.
 */

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { toHtml } from "../export/codegen";

export type McpTool = {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
  handler: (api: ExcalidrawImperativeAPI, args: Record<string, unknown>) => Promise<unknown>;
};

const ACC = "#3d6b5f";

export const MCP_TOOLS: McpTool[] = [
  {
    name: "get_design",
    description: "Read the current Draften canvas: a summary of frames (artboards) and layers.",
    inputSchema: { type: "object", properties: {} },
    handler: async (api) => {
      const els = api.getSceneElements().filter((e) => !e.isDeleted);
      const frames = els.filter((e) => e.type === "frame").map((f) => ({ id: f.id, name: (f as { name?: string }).name ?? "Frame", width: Math.round(f.width), height: Math.round(f.height) }));
      const layers = els.filter((e) => e.type !== "frame").length;
      return { frames, layerCount: layers, total: els.length };
    },
  },
  {
    name: "export_html",
    description: "Export the current canvas as HTML markup.",
    inputSchema: { type: "object", properties: {} },
    handler: async (api) => ({ html: toHtml(api.getSceneElements()) }),
  },
  {
    name: "add_rectangle",
    description: "Add a rectangle to the canvas.",
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "number" }, y: { type: "number" },
        width: { type: "number" }, height: { type: "number" },
        color: { type: "string", description: "fill hex, e.g. #3d6b5f" },
      },
      required: ["x", "y", "width", "height"],
    },
    handler: async (api, a) => {
      const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");
      const el = convertToExcalidrawElements([{
        type: "rectangle", x: Number(a.x), y: Number(a.y), width: Number(a.width), height: Number(a.height),
        backgroundColor: String(a.color ?? ACC), strokeColor: String(a.color ?? ACC), roughness: 0, fillStyle: "solid",
      }] as Parameters<typeof convertToExcalidrawElements>[0]);
      api.updateScene({ elements: [...api.getSceneElements(), ...el] });
      return { ok: true, added: el.length };
    },
  },
  {
    name: "add_text",
    description: "Add a text layer to the canvas.",
    inputSchema: {
      type: "object",
      properties: { x: { type: "number" }, y: { type: "number" }, text: { type: "string" }, fontSize: { type: "number" } },
      required: ["x", "y", "text"],
    },
    handler: async (api, a) => {
      const { convertToExcalidrawElements } = await import("@excalidraw/excalidraw");
      const el = convertToExcalidrawElements([{
        type: "text", x: Number(a.x), y: Number(a.y), text: String(a.text), fontSize: Number(a.fontSize ?? 16), roughness: 0,
      }] as Parameters<typeof convertToExcalidrawElements>[0]);
      api.updateScene({ elements: [...api.getSceneElements(), ...el] });
      return { ok: true };
    },
  },
];

/** The MCP client config a user pastes into Claude Desktop / an IDE to connect. */
export function mcpClientConfig(): string {
  return JSON.stringify({
    mcpServers: {
      draften: {
        command: "draften",
        args: ["--mcp"],
        description: "Draften design canvas — read + edit your design from any MCP client",
      },
    },
  }, null, 2);
}

/** Run a tool by name against the live API (used by the in-app bridge + tests). */
export async function runMcpTool(api: ExcalidrawImperativeAPI, name: string, args: Record<string, unknown> = {}): Promise<unknown> {
  const tool = MCP_TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`Unknown MCP tool: ${name}`);
  return tool.handler(api, args);
}
