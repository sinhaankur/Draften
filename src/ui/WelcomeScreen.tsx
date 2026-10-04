import { FilePlus2, FolderOpen, GitBranch, Smartphone, Monitor, Code2, Dumbbell, ArrowRight } from "lucide-react";

import { TEMPLATES, type TemplateDef } from "../templates/gallery";

/**
 * WelcomeScreen — the front door.
 *
 * Opening Draften used to drop you straight into a populated canvas with no cue
 * about what to do. This is the calm, V2-quality start screen: one clear choice —
 * start a new design (blank or from a template), open a file (Sketch / Figma /
 * PDF / OmniGraffle), or connect a git repository. Dismisses into the canvas.
 *
 * Intentionally sparse: a title, a short line, three columns, template cards.
 * No duplicated controls, nothing to configure — just "what do you want to do?".
 */

type Props = {
  onBlank: () => void;
  onTemplate: (t: TemplateDef) => void;
  onOpenFile: () => void;
  onConnectGit: () => void;
};

// A small, curated set of starting points (icon + the gallery template id).
const STARTERS: { id: string; label: string; icon: React.ReactNode; sub: string }[] = [
  { id: "mobile", label: "Mobile app", icon: <Smartphone size={18} />, sub: "iPhone onboarding" },
  { id: "dashboard", label: "Desktop app", icon: <Monitor size={18} />, sub: "Dashboard" },
  { id: "vscode", label: "Code editor", icon: <Code2 size={18} />, sub: "VS Code-style" },
  { id: "fitness", label: "Fitness app", icon: <Dumbbell size={18} />, sub: "Mobile UI" },
];

export function WelcomeScreen({ onBlank, onTemplate, onOpenFile, onConnectGit }: Props) {
  const byId = (id: string) => TEMPLATES.find((t) => t.id === id);

  return (
    <div className="welcome">
      <div className="welcome-inner">
        <div className="welcome-head">
          <span className="welcome-logo">
            <svg width="22" height="22" viewBox="0 0 24 24" aria-label="Draften"><path d="M6 4h6.5a7.5 8 0 0 1 0 16H6V4zm3.5 3.2v9.6h2.8a4.8 4.8 0 0 0 0-9.6z" fill="#fff" /></svg>
          </span>
          <h1>Welcome to Draften</h1>
          <p>A free, git-backed design tool. Start something new, open a file, or pick up a repo.</p>
        </div>

        {/* three primary choices */}
        <div className="welcome-actions">
          <button className="welcome-card primary" onClick={onBlank}>
            <span className="wc-icon"><FilePlus2 size={20} /></span>
            <span className="wc-title">New design</span>
            <span className="wc-sub">A blank canvas, ready to draw.</span>
            <span className="wc-go"><ArrowRight size={16} /></span>
          </button>
          <button className="welcome-card" onClick={onOpenFile}>
            <span className="wc-icon"><FolderOpen size={20} /></span>
            <span className="wc-title">Open a file</span>
            <span className="wc-sub">Sketch · Figma · PDF · OmniGraffle · Word.</span>
            <span className="wc-go"><ArrowRight size={16} /></span>
          </button>
          <button className="welcome-card" onClick={onConnectGit}>
            <span className="wc-icon"><GitBranch size={20} /></span>
            <span className="wc-title">Connect a repo</span>
            <span className="wc-sub">Your designs live in your git repo.</span>
            <span className="wc-go"><ArrowRight size={16} /></span>
          </button>
        </div>

        {/* start from a template */}
        <div className="welcome-templates">
          <div className="wt-label">Or start from a template</div>
          <div className="wt-grid">
            {STARTERS.map((s) => {
              const t = byId(s.id);
              return (
                <button key={s.id} className="wt-card" disabled={!t} onClick={() => t && onTemplate(t)}>
                  <span className="wt-ic">{s.icon}</span>
                  <span className="wt-name">{s.label}</span>
                  <span className="wt-sub">{s.sub}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
