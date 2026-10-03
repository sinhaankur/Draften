# GitHub sign-in — one-time setup

Draften signs in with GitHub using the **OAuth device flow** (no server, no
token-pasting; the token stays on your Mac). To activate it you register a GitHub
OAuth app once and give Draften its public **Client ID**.

## 1. Register the OAuth app (2 minutes)

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**
   (direct link: https://github.com/settings/developers)
2. Fill in:
   - **Application name**: `Draften`
   - **Homepage URL**: `https://github.com/sinhaankur/Draften`
   - **Authorization callback URL**: `https://github.com/sinhaankur/Draften`
     (the device flow doesn't use a redirect, but the field is required)
3. **Create**, then on the app page tick **"Enable Device Flow"** and Save.
4. Copy the **Client ID** (looks like `Iv1.abc123…` or `Ov23li…`). It is **public**
   — safe to commit/ship.

## 2. Give it to Draften

Create a `.env` file in the repo root:

```
VITE_GITHUB_CLIENT_ID=your_client_id_here
```

Then rebuild (`pnpm build` / `pnpm tauri build`). The **Sign in** button in the
topbar now works: click it → GitHub opens with a short code → enter the code →
you're signed in (avatar + username appear).

## Scopes
Draften requests `repo` (read/write your repos, incl. private — needed for
commit/push/PR) and `read:user` (to show who's signed in). You approve these on the
GitHub device page; you can revoke anytime at
**Settings → Applications → Authorized OAuth Apps**.

## Where the token lives
On this device only — `localStorage` today, the macOS **Keychain** on desktop is the
planned upgrade (one place: `src/git/session.ts`). The token is never sent anywhere
but GitHub's own API, directly from the app.
