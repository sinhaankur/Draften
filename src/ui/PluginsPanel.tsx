import { useEffect, useState } from "react";
import { motion } from "motion/react";

import { installFromGitHub, uninstall, loadInstalled, type InstalledRef } from "../api/github-plugins";
import { listPlugins } from "../api/draften";
import { overlay, scrim } from "./motion";

/**
 * Plugins panel — install a Draften plugin from GitHub, see what's installed,
 * remove it. Plugins run through the unified `draften` API's lifecycle. GitHub is
 * the distribution (no store), the Blender/Godot way.
 */
export function PluginsPanel({ onClose }: { onClose: () => void }) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installed, setInstalled] = useState<InstalledRef[]>([]);

  useEffect(() => { setInstalled(loadInstalled()); }, []);

  const active = new Set(listPlugins().map((p) => p.id));

  const install = async () => {
    if (!input.trim()) return;
    setBusy(true); setError(null);
    try {
      await installFromGitHub(input.trim());
      setInstalled(loadInstalled());
      setInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = (id: string) => { uninstall(id); setInstalled(loadInstalled()); };

  return (
    <motion.div className="ai-overlay" onClick={onClose} {...scrim}>
      <motion.div className="ai-dialog" onClick={(e) => e.stopPropagation()} {...overlay}>
        <div className="ai-title">🧩 Plugins</div>
        <p className="muted small">
          Install a plugin from GitHub. Enter <code>owner/repo</code>, a github.com
          file URL, or a raw module URL. Plugins are code — only install ones you trust.
        </p>

        <label className="ai-field">
          <span>Install from GitHub</span>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. sinhaankur/draften-hello"
            onKeyDown={(e) => e.key === "Enter" && install()}
            autoFocus
          />
        </label>

        {error && <div className="plugin-error">⚠ {error}</div>}

        <div className="ai-actions" style={{ marginTop: 10 }}>
          <button className="ghost" onClick={onClose}>Close</button>
          <button className="ai-btn" onClick={install} disabled={busy || !input.trim()}>
            {busy ? "Installing…" : "Install"}
          </button>
        </div>

        <div className="divider" />

        <div className="section-title">Installed</div>
        {installed.length === 0 ? (
          <div className="muted small">No plugins yet. Try one from the community.</div>
        ) : (
          <div className="plugin-list">
            {installed.map((p) => (
              <div key={p.id} className="plugin-row">
                <div>
                  <div className="plugin-name">
                    {p.name}
                    <span className={active.has(p.id) ? "plugin-dot on" : "plugin-dot"} title={active.has(p.id) ? "active" : "inactive"} />
                  </div>
                  <div className="muted small">{p.source}</div>
                </div>
                <button className="ghost" onClick={() => remove(p.id)}>Remove</button>
              </div>
            ))}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
