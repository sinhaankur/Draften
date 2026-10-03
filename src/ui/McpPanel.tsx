import { useState } from "react";
import { motion } from "motion/react";
import { Server, Copy, Check } from "lucide-react";

import { MCP_TOOLS, mcpClientConfig } from "../mcp/tools";
import { overlay, scrim } from "./motion";

/**
 * McpPanel — "Draften as an MCP server" (v2).
 *
 * Draften exposes its canvas as MCP tools so an external AI (Claude Desktop, an
 * IDE agent) can read + edit your design. This panel lists the exposed tools and
 * gives you the client config to paste into your MCP client. The desktop build
 * runs the actual stdio server (`draften --mcp`); the tools here are the contract.
 */
export function McpPanel({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const config = mcpClientConfig();

  const copy = async () => {
    try { await navigator.clipboard.writeText(config); setCopied(true); setTimeout(() => setCopied(false), 1400); } catch { /* clipboard blocked */ }
  };

  return (
    <motion.div className="ai-overlay" onClick={onClose} {...scrim}>
      <motion.div className="ai-dialog" onClick={(e) => e.stopPropagation()} {...overlay} style={{ maxWidth: 520 }}>
        <div className="ai-title" style={{ display: "flex", alignItems: "center", gap: 7 }}><Server size={16} /> Draften as an MCP server</div>
        <p className="muted small" style={{ lineHeight: 1.6 }}>
          Let an external AI (Claude Desktop, an IDE agent) read and edit this design through
          the Model Context Protocol. Draften exposes its canvas as the tools below.
        </p>

        <div style={{ marginTop: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-3, #8e8d88)", marginBottom: 6 }}>Exposed tools</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {MCP_TOOLS.map((t) => (
              <div key={t.name} style={{ border: "1px solid var(--line, #e7e6e2)", borderRadius: 9, padding: "9px 12px", background: "var(--surf, #fff)" }}>
                <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12.5, fontWeight: 600, color: "var(--accent, #3d6b5f)" }}>{t.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-3, #8e8d88)", marginTop: 2 }}>{t.description}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ flex: 1, fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--text-3, #8e8d88)" }}>Client config</span>
            <button onClick={copy} className="tb-btn" style={{ gap: 6 }}>
              {copied ? <><Check size={13} /> Copied</> : <><Copy size={13} /> Copy</>}
            </button>
          </div>
          <pre style={{ margin: 0, background: "var(--canvas, #efeeeb)", border: "1px solid var(--line, #e7e6e2)", borderRadius: 9, padding: 12, fontSize: 12, fontFamily: "var(--font-mono, monospace)", overflow: "auto", color: "var(--t1, #1d1d1b)" }}>
            <code>{config}</code>
          </pre>
          <p className="muted small" style={{ marginTop: 6, lineHeight: 1.5 }}>
            Paste into your MCP client's config (e.g. Claude Desktop's <code>claude_desktop_config.json</code>).
            The desktop app runs the server; the web build exposes the same tools to the in-app assistant.
          </p>
        </div>

        <div style={{ marginTop: 16, textAlign: "right" }}>
          <button className="btn-ghost" onClick={onClose}>Close</button>
        </div>
      </motion.div>
    </motion.div>
  );
}
