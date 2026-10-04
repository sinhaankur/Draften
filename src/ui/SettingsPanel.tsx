import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { User, GitBranch, Palette, PenTool, Sparkles, Key, Check, X, LogOut } from "lucide-react";

import { overlay, scrim } from "./motion";
import { useGitSession } from "../git/session";

/**
 * SettingsPanel — a VS Code–style settings surface.
 *
 * VS Code's settings are a left category list + a right scrollable content pane.
 * This mirrors that: Account · Git identity · Appearance · Editor · AI. It
 * consolidates what used to be scattered in the account popover into one real
 * place (the "Settings" the earlier audit found dead now exists for real). All
 * values persist on-device (localStorage); account actions use the git session.
 */

type Section = "account" | "identity" | "appearance" | "editor" | "ai";

const SECTIONS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: "account", label: "Account", icon: <User size={15} /> },
  { id: "identity", label: "Git identity", icon: <GitBranch size={15} /> },
  { id: "appearance", label: "Appearance", icon: <Palette size={15} /> },
  { id: "editor", label: "Editor", icon: <PenTool size={15} /> },
  { id: "ai", label: "AI", icon: <Sparkles size={15} /> },
];

export interface SettingsValues {
  theme: "light" | "dark";
  dotGrid: boolean;
  snap: boolean;
  aiProvider: string;
}

export function SettingsPanel({
  onClose, values, onChange,
}: {
  onClose: () => void;
  values: SettingsValues;
  onChange: (patch: Partial<SettingsValues>) => void;
}) {
  const [section, setSection] = useState<Section>("account");
  const [query, setQuery] = useState("");

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  // filter the sidebar by the search box (VS Code settings search)
  const visible = SECTIONS.filter((s) => s.label.toLowerCase().includes(query.toLowerCase()));

  return (
    <motion.div className="ai-overlay" onClick={onClose} {...scrim}>
      <motion.div className="ai-dialog" onClick={(e) => e.stopPropagation()} {...overlay}
        style={{ maxWidth: 760, width: "92vw", padding: 0, overflow: "hidden" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid var(--line,#e7e6e2)" }}>
          <div className="ai-title" style={{ margin: 0 }}>Settings</div>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search settings"
            style={{ flex: 1, maxWidth: 260, marginLeft: 8, borderRadius: 7, border: "1px solid var(--line,#e7e6e2)", padding: "6px 10px", fontSize: 12.5, background: "var(--surf,#fff)", color: "var(--t1,#1d1d1b)" }} />
          <button onClick={onClose} title="Close (Esc)" aria-label="Close settings" style={{ marginLeft: "auto", border: 0, background: "transparent", cursor: "pointer", color: "var(--text-3,#8e8d88)", display: "grid", placeItems: "center", width: 28, height: 28 }}><X size={16} /></button>
        </div>

        {/* VS Code layout: sidebar + content */}
        <div style={{ display: "flex", minHeight: 360, maxHeight: "68vh" }}>
          <nav style={{ width: 190, flex: "none", borderRight: "1px solid var(--line,#e7e6e2)", padding: 8, overflowY: "auto" }}>
            {visible.map((s) => (
              <button key={s.id} onClick={() => setSection(s.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 9, width: "100%", textAlign: "left",
                  border: 0, borderRadius: 7, padding: "8px 10px", cursor: "pointer", fontSize: 13,
                  background: section === s.id ? "var(--accent-soft, #e2ebe7)" : "transparent",
                  color: section === s.id ? "var(--accent, #3d6b5f)" : "var(--t1, #1d1d1b)",
                  fontWeight: section === s.id ? 600 : 400,
                }}>
                <span style={{ flex: "none", display: "grid", placeItems: "center" }}>{s.icon}</span>
                {s.label}
              </button>
            ))}
            {!visible.length && <div style={{ padding: 10, fontSize: 12, color: "var(--text-3,#8e8d88)" }}>No match.</div>}
          </nav>

          <div style={{ flex: 1, padding: "18px 22px", overflowY: "auto" }}>
            {section === "account" && <AccountSettings />}
            {section === "identity" && <IdentitySettings />}
            {section === "appearance" && <AppearanceSettings values={values} onChange={onChange} />}
            {section === "editor" && <EditorSettings values={values} onChange={onChange} />}
            {section === "ai" && <AiSettings values={values} onChange={onChange} />}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── sections ──────────────────────────────────────────────────────────────── */

function Group({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--t1,#1d1d1b)" }}>{title}</div>
      {desc && <div style={{ fontSize: 12, color: "var(--text-3,#8e8d88)", margin: "2px 0 8px", lineHeight: 1.5 }}>{desc}</div>}
      <div style={{ marginTop: desc ? 0 : 8 }}>{children}</div>
    </div>
  );
}

function AccountSettings() {
  const user = useGitSession((s) => s.user);
  const token = useGitSession((s) => s.token);
  const setToken = useGitSession((s) => s.setToken);
  const signOut = useGitSession((s) => s.signOut);
  const [pat, setPat] = useState("");
  const [err, setErr] = useState<string | null>(null);

  if (token) {
    return (
      <Group title="GitHub account" desc="Your designs can live in your repos — commit, clone, pull and open PRs from Source Control.">
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", border: "1px solid var(--line,#e7e6e2)", borderRadius: 10, background: "var(--surf,#fff)" }}>
          <span style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", background: "var(--accent,#3d6b5f)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700 }}>
            {user?.avatar_url ? <img src={user.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (user?.login?.[0]?.toUpperCase() ?? "?")}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{user?.name ?? user?.login ?? "Connected"}</div>
            {user?.login && <div style={{ fontSize: 11.5, color: "var(--text-3,#8e8d88)" }}>@{user.login}</div>}
          </div>
          <button onClick={signOut} style={{ marginLeft: "auto", ...btnGhost, color: "#b23b3b", display: "inline-flex", alignItems: "center", gap: 6 }}><LogOut size={13} /> Disconnect</button>
        </div>
      </Group>
    );
  }
  return (
    <Group title="Connect GitHub" desc="Paste a token with repo scope — the reliable way to connect from the app.">
      <p style={{ fontSize: 12, color: "var(--text-3,#8e8d88)", margin: "0 0 8px" }}>
        <a href="https://github.com/settings/tokens/new?scopes=repo&description=Draften" target="_blank" rel="noreferrer" style={{ color: "var(--accent,#3d6b5f)" }}>Create a token →</a>
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <input value={pat} type="password" placeholder="ghp_… or github_pat_…" autoComplete="off"
          onChange={(e) => setPat(e.target.value)}
          onPaste={(e) => { e.stopPropagation(); setPat(e.clipboardData.getData("text").trim()); e.preventDefault(); }}
          style={{ ...inp, flex: 1 }} />
        <button disabled={!pat.trim()} style={btnPrimary} onClick={async () => {
          setErr(null);
          try { await setToken(pat.trim()); if (!useGitSession.getState().user) setErr("Couldn't verify that token — check it has repo scope."); else setPat(""); }
          catch { setErr("Couldn't connect — check the token."); }
        }}><Key size={13} /> Connect</button>
      </div>
      {err && <p style={{ fontSize: 11.5, color: "#b23b3b", margin: "6px 0 0" }}>{err}</p>}
    </Group>
  );
}

function IdentitySettings() {
  const [name, setName] = useState(() => get("draften-git-name"));
  const [email, setEmail] = useState(() => get("draften-git-email"));
  const [saved, setSaved] = useState(false);
  return (
    <Group title="Git identity" desc="Used as the author on commits you make from Draften.">
      <label style={label}>Name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" style={inp} />
      <label style={{ ...label, marginTop: 10 }}>Email</label>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" style={inp} />
      <div style={{ marginTop: 12 }}>
        <button style={btnPrimary} onClick={() => { set("draften-git-name", name); set("draften-git-email", email); setSaved(true); setTimeout(() => setSaved(false), 1400); }}>
          {saved ? <><Check size={13} /> Saved</> : "Save identity"}
        </button>
      </div>
    </Group>
  );
}

function AppearanceSettings({ values, onChange }: { values: SettingsValues; onChange: (p: Partial<SettingsValues>) => void }) {
  return (
    <Group title="Appearance" desc="How Draften looks. Follows the system font on each OS.">
      <Seg label="Theme" value={values.theme} options={[["light", "Light"], ["dark", "Dark"]]} onPick={(v) => onChange({ theme: v as "light" | "dark" })} />
    </Group>
  );
}

function EditorSettings({ values, onChange }: { values: SettingsValues; onChange: (p: Partial<SettingsValues>) => void }) {
  return (
    <Group title="Canvas" desc="Editing behaviour on the design canvas.">
      <Toggle label="Dot grid" checked={values.dotGrid} onChange={(v) => onChange({ dotGrid: v })} />
      <Toggle label="Snap to objects" checked={values.snap} onChange={(v) => onChange({ snap: v })} />
    </Group>
  );
}

function AiSettings({ values, onChange }: { values: SettingsValues; onChange: (p: Partial<SettingsValues>) => void }) {
  return (
    <Group title="AI assistant" desc="Keyless + on-device by default. Pick the provider the assistant uses first.">
      <Seg label="Default provider" value={values.aiProvider}
        options={[["deterministic", "Built-in (no model)"], ["webllm", "On-device LLM"], ["apple", "Apple Intelligence"], ["lmstudio", "LM Studio"]]}
        onPick={(v) => onChange({ aiProvider: v })} />
    </Group>
  );
}

/* ── controls ──────────────────────────────────────────────────────────────── */

function Seg({ label: lbl, value, options, onPick }: { label: string; value: string; options: [string, string][]; onPick: (v: string) => void }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <label style={label}>{lbl}</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
        {options.map(([v, l]) => (
          <button key={v} onClick={() => onPick(v)}
            style={{ border: "1px solid " + (value === v ? "var(--accent,#3d6b5f)" : "var(--line,#e7e6e2)"), background: value === v ? "var(--accent-soft,#e2ebe7)" : "var(--surf,#fff)", color: value === v ? "var(--accent,#3d6b5f)" : "var(--t1,#1d1d1b)", borderRadius: 8, padding: "7px 12px", fontSize: 12.5, cursor: "pointer", fontWeight: value === v ? 600 : 400 }}>
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label: lbl, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", cursor: "pointer", fontSize: 13 }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ width: 16, height: 16, accentColor: "var(--accent,#3d6b5f)" }} />
      {lbl}
    </label>
  );
}

/* ── storage + styles ────────────────────────────────────────────────────────*/

function get(k: string): string { try { return localStorage.getItem(k) || ""; } catch { return ""; } }
function set(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }

const label: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: "var(--text-3,#8e8d88)", textTransform: "uppercase", letterSpacing: ".04em" };
const inp: React.CSSProperties = { width: "100%", borderRadius: 8, border: "1px solid var(--line,#e7e6e2)", padding: "8px 10px", fontSize: 13, background: "var(--surf,#fff)", color: "var(--t1,#1d1d1b)" };
const btnPrimary: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 6, border: 0, borderRadius: 8, padding: "8px 14px", background: "var(--accent,#3d6b5f)", color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer" };
const btnGhost: React.CSSProperties = { border: "1px solid var(--line,#e7e6e2)", borderRadius: 8, padding: "7px 12px", background: "transparent", color: "var(--t1,#1d1d1b)", fontSize: 12.5, cursor: "pointer" };
