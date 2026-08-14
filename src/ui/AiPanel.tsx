import { useState } from "react";

import { generateDesignSystem } from "../ai/design-gen";
import { useEditor } from "../state/store";

/**
 * The ✦ AI panel — generates a real design system from a brand brief.
 *
 * This is the honest version of the AI button: it calls the deterministic
 * generator (no key, no model, offline) to produce actual tokens + atomic
 * components with code, then loads them into the store so the design-system
 * panel renders the real result. A tiny on-device LLM can refine this later, but
 * the baseline already works and never shows a hollow shell.
 */
export function AiPanel({ onClose }: { onClose: () => void }) {
  const setDesignSystem = useEditor((s) => s.setDesignSystem);
  const rename = useEditor((s) => s.rename);
  const [brand, setBrand] = useState("Northwind");
  const [style, setStyle] = useState("calm");
  const [busy, setBusy] = useState(false);

  const generate = () => {
    setBusy(true);
    // deterministic + synchronous, but keep the async shape so a real LLM tier
    // can slot in without changing callers
    const ds = generateDesignSystem({ brand: brand.trim() || "Brand", style });
    setDesignSystem(ds);
    rename(brand.trim() || "Brand");
    setBusy(false);
    onClose();
  };

  return (
    <div className="ai-overlay" onClick={onClose}>
      <div className="ai-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="ai-title">✦ Generate a design system</div>
        <p className="muted small">
          Brand + vibe → design tokens and an atomic component library (atoms →
          organisms), with real code. Runs on-device, no key.
        </p>

        <label className="ai-field">
          <span>Brand name</span>
          <input value={brand} onChange={(e) => setBrand(e.target.value)} autoFocus />
        </label>

        <label className="ai-field">
          <span>Vibe</span>
          <select value={style} onChange={(e) => setStyle(e.target.value)}>
            <option value="calm">Calm</option>
            <option value="playful">Playful</option>
            <option value="brutalist">Brutalist</option>
            <option value="editorial">Editorial</option>
            <option value="bold">Bold</option>
            <option value="minimal">Minimal</option>
          </select>
        </label>

        <div className="ai-actions">
          <button className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="ai-btn" onClick={generate} disabled={busy}>
            {busy ? "Generating…" : "Generate"}
          </button>
        </div>
      </div>
    </div>
  );
}
