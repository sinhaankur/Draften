import { useRef, useState } from "react";
import { GitBranch } from "lucide-react";
import { signInWithGitHub, type DeviceCodeResponse } from "../git/github-auth";
import { useGitSession } from "../git/session";

/**
 * GitHubSignIn — "Sign in with GitHub" via the device flow.
 *
 * Signed out: a button that starts the flow and shows the short code + URL to enter
 * it at (we also open GitHub's device page). Signed in: the user's avatar + login,
 * with sign-out. Keyless, on-device, no token-pasting.
 */
export function GitHubSignIn() {
  const { user, token, setToken, signOut, signingIn, setSigningIn } = useGitSession();
  const [code, setCode] = useState<DeviceCodeResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  async function start() {
    setErr(null);
    setSigningIn(true);
    abort.current = new AbortController();
    try {
      const tok = await signInWithGitHub({
        signal: abort.current.signal,
        onCode: (d) => {
          setCode(d);
          // open GitHub's device page so the user just pastes the code
          try { window.open(d.verification_uri, "_blank"); } catch { /* ignore */ }
        },
      });
      await setToken(tok);
      setCode(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSigningIn(false);
    }
  }

  function cancel() {
    abort.current?.abort();
    setCode(null);
    setSigningIn(false);
  }

  if (token && user) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {user.avatar_url && <img src={user.avatar_url} alt="" width={20} height={20} style={{ borderRadius: "50%" }} />}
        <span style={{ fontSize: 12 }}>{user.login}</span>
        <button className="tb-btn" onClick={signOut} title="Sign out">Sign out</button>
      </div>
    );
  }

  return (
    <>
      <button className="tb-btn" onClick={start} disabled={signingIn} title="Sign in with GitHub">
        <GitBranch size={14} /> {signingIn ? "Signing in…" : "Sign in"}
      </button>

      {code && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9998, display: "grid", placeItems: "center", background: "rgba(20,18,14,.4)" }}
          onClick={cancel}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "var(--raised)", border: "1px solid var(--border)", borderRadius: 14, padding: 24, width: 360, boxShadow: "var(--shadow-3)", textAlign: "center" }}>
            <div style={{ display: "inline-grid", placeItems: "center", width: 40, height: 40, borderRadius: 10, background: "var(--acc-soft)", color: "var(--accent)", marginBottom: 12 }}>
              <GitBranch size={20} />
            </div>
            <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Sign in with GitHub</div>
            <div style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 16 }}>
              Enter this code at <strong>{code.verification_uri.replace("https://", "")}</strong> (opened in your browser):
            </div>
            <div style={{ fontFamily: "var(--font-code)", fontSize: 26, fontWeight: 600, letterSpacing: 4, padding: "10px 0", color: "var(--accent)" }}>
              {code.user_code}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-3)", marginTop: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <span className="spin" style={{ width: 12, height: 12, border: "2px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", display: "inline-block", animation: "dtspin 1s linear infinite" }} />
              Waiting for you to authorise…
            </div>
            <button className="tb-btn" onClick={cancel} style={{ marginTop: 16 }}>Cancel</button>
          </div>
        </div>
      )}

      {err && <span style={{ fontSize: 11, color: "var(--danger)" }}>{err}</span>}
    </>
  );
}
