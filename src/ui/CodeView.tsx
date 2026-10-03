import { useEffect, useState } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { toHtml, toReact } from "../export/codegen";

/**
 * CodeView — real generated code from the live canvas.
 *
 * Reads the current Excalidraw scene and emits HTML or React, refreshing as the
 * canvas changes. A Copy button puts it on the clipboard. This makes the
 * Design/Code segmented control actually do something — "designs in your repo".
 */
export function CodeView({ api }: { api: ExcalidrawImperativeAPI | null }) {
  const [lang, setLang] = useState<"html" | "react">("react");
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!api) return;
    const gen = () => {
      try {
        const els = api.getSceneElements();
        setCode(lang === "html" ? toHtml(els) : toReact(els));
      } catch { /* scene not ready */ }
    };
    gen();
    const id = window.setInterval(gen, 600);
    return () => window.clearInterval(id);
  }, [api, lang]);

  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* clipboard blocked */ }
  };

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", background: "var(--canvas, #efeeeb)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid var(--line, #e7e6e2)", background: "var(--panel, #fbfbfa)" }}>
        <div style={{ display: "flex", gap: 2, background: "var(--canvas, #efeeeb)", borderRadius: 8, padding: 2 }}>
          {(["react", "html"] as const).map((l) => (
            <button key={l} onClick={() => setLang(l)}
              style={{ border: 0, cursor: "pointer", borderRadius: 6, padding: "4px 12px", fontSize: 12.5, fontWeight: 600,
                background: lang === l ? "var(--surf, #fff)" : "transparent", color: lang === l ? "var(--t1, #1d1d1b)" : "var(--text-3, #8e8d88)" }}>
              {l === "react" ? "React" : "HTML"}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: "var(--text-3, #8e8d88)" }}>Generated from the canvas</span>
        <button onClick={copy}
          style={{ marginLeft: "auto", border: "1px solid var(--line, #e7e6e2)", cursor: "pointer", borderRadius: 7, padding: "5px 12px", fontSize: 12.5, fontWeight: 600, background: "var(--surf, #fff)", color: "var(--t1, #1d1d1b)" }}>
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      <pre style={{ flex: 1, margin: 0, overflow: "auto", padding: 16, fontSize: 12.5, lineHeight: 1.6, fontFamily: "var(--font-mono, ui-monospace, monospace)", color: "var(--t1, #1d1d1b)", whiteSpace: "pre" }}>
        <code>{code || "// draw something or pick a template to see code"}</code>
      </pre>
    </div>
  );
}
