import { useEffect, useRef, useState } from "react";
import { User, LogOut, GitBranch, Key, Settings as SettingsIcon, IdCard } from "lucide-react";

import { useGitSession } from "../git/session";
import { signInWithGitHub } from "../git/github-auth";

/**
 * RailAccount — the user account at the bottom of the left icon rail (v2's "MK"
 * avatar). Signed in → the GitHub avatar + initials; click for a small menu
 * (name · open on GitHub · sign out). Signed out → an account icon that starts
 * the GitHub device-flow sign-in.
 */
export function RailAccount() {
  const user = useGitSession((s) => s.user);
  const token = useGitSession((s) => s.token);
  const setToken = useGitSession((s) => s.setToken);
  const signOut = useGitSession((s) => s.signOut);
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState<{ user_code: string; verification_uri: string } | null>(null);
  const [sub, setSub] = useState<null | "identity" | "pat">(null);
  const [pat, setPat] = useState("");
  // Git identity for commit authorship (persisted on-device).
  const [gitName, setGitName] = useState(() => { try { return localStorage.getItem("draften-git-name") || ""; } catch { return ""; } });
  const [gitEmail, setGitEmail] = useState(() => { try { return localStorage.getItem("draften-git-email") || ""; } catch { return ""; } });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const away = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, []);

  const initials = (user?.name || user?.login || "?").split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

  const startSignIn = async () => {
    setOpen(false);
    try {
      const tok = await signInWithGitHub({ onCode: (c) => setCode({ user_code: c.user_code, verification_uri: c.verification_uri }) });
      if (tok) { await setToken(tok); setCode(null); }
    } catch { setCode(null); }
  };

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={token ? (user?.login ?? "Account") : "Account — connect GitHub"}
        style={{
          width: 34, height: 34, borderRadius: "50%", border: 0, cursor: "pointer", overflow: "hidden",
          display: "grid", placeItems: "center", padding: 0,
          background: token ? "var(--accent, #3d6b5f)" : "var(--hover, #f0efec)",
          color: token ? "#fff" : "var(--text-3, #8e8d88)", fontSize: 12, fontWeight: 700,
        }}
      >
        {user?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : token ? initials : <User size={16} />}
      </button>

      {/* device-code prompt while signing in */}
      {code && (
        <div style={menu}>
          <p style={{ fontSize: 12, color: "var(--t1, #1d1d1b)", margin: "0 0 6px" }}>At <b>{code.verification_uri.replace("https://", "")}</b>, enter:</p>
          <p style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 18, fontWeight: 700, letterSpacing: 2, textAlign: "center", color: "var(--accent, #3d6b5f)" }}>{code.user_code}</p>
          <a href={code.verification_uri} target="_blank" rel="noreferrer" style={{ display: "block", textAlign: "center", fontSize: 12, color: "var(--accent, #3d6b5f)", marginTop: 4 }}>Open GitHub →</a>
        </div>
      )}

      {/* account menu (signed in OR signed out — v2 shows account either way) */}
      {open && (
        <div style={menu}>
          {/* identity header */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 2px 8px", borderBottom: "1px solid var(--line, #e7e6e2)" }}>
            <span style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", background: token ? "var(--accent, #3d6b5f)" : "var(--hover, #f0efec)", color: token ? "#fff" : "var(--text-3,#8e8d88)", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700 }}>
              {user?.avatar_url ? <img src={user.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : token ? initials : <User size={14} />}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--t1, #1d1d1b)" }}>{token ? (user?.name ?? user?.login ?? "Account") : "Not signed in"}</div>
              {token && user?.login && <div style={{ fontSize: 11, color: "var(--text-3, #8e8d88)" }}>@{user.login}</div>}
            </div>
          </div>

          {sub === "identity" ? (
            <div style={{ padding: "8px 2px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Git identity</div>
              <input value={gitName} onChange={(e) => setGitName(e.target.value)} placeholder="Name (for commits)" style={inp} />
              <input value={gitEmail} onChange={(e) => setGitEmail(e.target.value)} placeholder="Email" style={{ ...inp, marginTop: 6 }} />
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button onClick={() => { try { localStorage.setItem("draften-git-name", gitName); localStorage.setItem("draften-git-email", gitEmail); } catch { /* ok */ } setSub(null); }} style={btnPrimary}>Save</button>
                <button onClick={() => setSub(null)} style={btnGhost}>Back</button>
              </div>
            </div>
          ) : sub === "pat" ? (
            <div style={{ padding: "8px 2px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 2 }}>Personal access token</div>
              <p style={{ fontSize: 11, color: "var(--text-3,#8e8d88)", margin: "0 0 6px", lineHeight: 1.5 }}>Paste a GitHub PAT (repo scope) to connect without the device flow.</p>
              <input value={pat} onChange={(e) => setPat(e.target.value)} type="password" placeholder="ghp_…" style={inp} autoComplete="off" />
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                <button onClick={async () => { if (pat.trim()) { await setToken(pat.trim()); setPat(""); setSub(null); setOpen(false); } }} style={btnPrimary} disabled={!pat.trim()}>Connect</button>
                <button onClick={() => setSub(null)} style={btnGhost}>Back</button>
              </div>
            </div>
          ) : (
            <>
              {!token && (
                <button onClick={startSignIn} style={{ ...item, ...itemBtn, color: "var(--accent,#3d6b5f)", fontWeight: 600 }}>
                  <GitBranch size={14} /> Continue on GitHub
                </button>
              )}
              {token && user?.login && (
                <a href={`https://github.com/${user.login}`} target="_blank" rel="noreferrer" style={item}>
                  <GitBranch size={14} /> Open on GitHub
                </a>
              )}
              <button onClick={() => setSub("identity")} style={{ ...item, ...itemBtn }}><IdCard size={14} /> Git identity</button>
              <button onClick={() => setSub("pat")} style={{ ...item, ...itemBtn }}><Key size={14} /> Personal access token</button>
              <button style={{ ...item, ...itemBtn }}><SettingsIcon size={14} /> Settings</button>
              {token && (
                <button onClick={() => { signOut(); setOpen(false); }} style={{ ...item, ...itemBtn, color: "#b23b3b" }}>
                  <LogOut size={14} /> Sign out
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const menu: React.CSSProperties = {
  position: "absolute", bottom: 0, left: "calc(100% + 8px)", zIndex: 100, width: 220,
  background: "var(--panel, #fbfbfa)", border: "1px solid var(--line, #e7e6e2)", borderRadius: 10,
  boxShadow: "0 10px 30px -10px rgba(0,0,0,.25)", padding: 10,
};
const item: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 8, padding: "7px 4px", fontSize: 12.5,
  color: "var(--t1, #1d1d1b)", textDecoration: "none",
};
const itemBtn: React.CSSProperties = { border: 0, background: "transparent", width: "100%", cursor: "pointer", textAlign: "left" };
const inp: React.CSSProperties = { width: "100%", borderRadius: 7, border: "1px solid var(--line,#e7e6e2)", padding: "6px 9px", fontSize: 12.5, background: "var(--surf,#fff)", color: "var(--t1,#1d1d1b)" };
const btnPrimary: React.CSSProperties = { flex: 1, border: 0, borderRadius: 7, padding: "6px", background: "var(--accent,#3d6b5f)", color: "#fff", fontSize: 12.5, fontWeight: 600, cursor: "pointer" };
const btnGhost: React.CSSProperties = { flex: 1, border: "1px solid var(--line,#e7e6e2)", borderRadius: 7, padding: "6px", background: "transparent", color: "var(--t1,#1d1d1b)", fontSize: 12.5, cursor: "pointer" };
