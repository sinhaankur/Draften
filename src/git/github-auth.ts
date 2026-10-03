/**
 * github-auth — "Sign in with GitHub" via the OAuth DEVICE FLOW.
 *
 * Draften lives in your git repo, so it needs to talk to GitHub (private repos,
 * push/pull, PRs). The device flow is the right fit for a desktop app with no
 * server: we ask GitHub for a device code, show the user a short code + a URL to
 * enter it at, then poll until they authorise — no token-pasting, no redirect, no
 * backend. The resulting token is stored on-device only.
 *
 * Needs a registered GitHub OAuth app's client_id (public — safe to ship). Scopes
 * default to `repo` (private repos + push) + `read:user`.
 *
 * Refs: https://docs.github.com/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow
 * © Ankur Sinha.
 */

const DEVICE_CODE_URL = "https://github.com/login/device/code";
const TOKEN_URL = "https://github.com/login/oauth/access_token";

/** The OAuth app client id. Public by design; replace with Draften's real app id. */
export const GITHUB_CLIENT_ID =
  (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_GITHUB_CLIENT_ID ||
  "Iv1.draften0000000000"; // placeholder — register a GitHub OAuth app, set VITE_GITHUB_CLIENT_ID

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;       // the short code the user types, e.g. "WDJB-MJHT"
  verification_uri: string; // where to type it, e.g. https://github.com/login/device
  expires_in: number;      // seconds
  interval: number;        // min seconds between polls
}

export interface GitHubUser {
  login: string;
  name?: string;
  avatar_url?: string;
}

/** Step 1 — ask GitHub for a device + user code. */
export async function requestDeviceCode(
  scope = "repo read:user",
  clientId = GITHUB_CLIENT_ID,
): Promise<DeviceCodeResponse> {
  const res = await fetch(DEVICE_CODE_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, scope }),
  });
  if (!res.ok) throw new Error(`GitHub device-code request failed (${res.status})`);
  return res.json();
}

/** One poll for the token. Returns the token, or a status to keep/ stop polling. */
export async function pollForToken(
  deviceCode: string,
  clientId = GITHUB_CLIENT_ID,
): Promise<
  | { status: "ok"; token: string }
  | { status: "pending" }
  | { status: "slow_down" }
  | { status: "error"; error: string }
> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      device_code: deviceCode,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    }),
  });
  const data = (await res.json()) as { access_token?: string; error?: string };
  if (data.access_token) return { status: "ok", token: data.access_token };
  if (data.error === "authorization_pending") return { status: "pending" };
  if (data.error === "slow_down") return { status: "slow_down" };
  return { status: "error", error: data.error || "unknown_error" };
}

/**
 * Full flow helper: request a code, hand it to the UI via onCode, then poll until
 * authorised (or expired). Returns the access token. Abortable.
 */
export async function signInWithGitHub(opts: {
  onCode: (d: DeviceCodeResponse) => void;
  signal?: AbortSignal;
  scope?: string;
  clientId?: string;
}): Promise<string> {
  const dc = await requestDeviceCode(opts.scope, opts.clientId);
  opts.onCode(dc);

  const deadline = Date.now() + dc.expires_in * 1000;
  let interval = Math.max(1, dc.interval) * 1000;

  while (Date.now() < deadline) {
    if (opts.signal?.aborted) throw new Error("Sign-in cancelled");
    await new Promise((r) => setTimeout(r, interval));
    const r = await pollForToken(dc.device_code, opts.clientId);
    if (r.status === "ok") return r.token;
    if (r.status === "slow_down") interval += 5000; // back off, per GitHub
    if (r.status === "error") throw new Error(`GitHub sign-in failed: ${r.error}`);
    // "pending" → keep polling
  }
  throw new Error("Sign-in timed out — the code expired.");
}

/** Fetch the authenticated user (to show who's signed in). */
export async function fetchGitHubUser(token: string): Promise<GitHubUser> {
  const res = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`Couldn't load GitHub user (${res.status})`);
  return res.json();
}
