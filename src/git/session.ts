/**
 * session — the signed-in GitHub session (token + user), on-device only.
 *
 * The token is persisted so sign-in sticks across launches. On web it lives in
 * localStorage; on desktop (Tauri) the keychain is the right home — this module
 * centralises storage so that upgrade is one place to change. The token never
 * leaves the machine; Draften talks to GitHub directly from the client.
 *
 * © Ankur Sinha.
 */

import { create } from "zustand";
import { fetchGitHubUser, type GitHubUser } from "./github-auth";

const TOKEN_KEY = "draften-gh-token";
const USER_KEY = "draften-gh-user";

export interface GitSessionState {
  token: string | null;
  user: GitHubUser | null;
  /** True while a sign-in is in flight (UI shows the code + spinner). */
  signingIn: boolean;

  /** Persist a freshly-acquired token + load the user. */
  setToken: (token: string) => Promise<void>;
  /** Sign out: forget the token + user on this device. */
  signOut: () => void;
  setSigningIn: (v: boolean) => void;
  isSignedIn: () => boolean;
}

function loadToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function loadUser(): GitHubUser | null {
  try { const r = localStorage.getItem(USER_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}

export const useGitSession = create<GitSessionState>((set, get) => ({
  token: loadToken(),
  user: loadUser(),
  signingIn: false,

  setToken: async (token) => {
    try { localStorage.setItem(TOKEN_KEY, token); } catch { /* ignore */ }
    set({ token });
    try {
      const user = await fetchGitHubUser(token);
      try { localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch { /* ignore */ }
      set({ user });
    } catch {
      // token works for API calls even if the /user fetch hiccups; leave user null
    }
  },

  signOut: () => {
    try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); } catch { /* ignore */ }
    set({ token: null, user: null });
  },

  setSigningIn: (v) => set({ signingIn: v }),
  isSignedIn: () => !!get().token,
}));
