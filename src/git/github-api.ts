/**
 * github-api — the GitHub REST calls the Source-control panel needs.
 *
 * Draften lives in your git repo, so once signed in (github-auth) it talks to
 * GitHub's API directly from the client: list your repos + branches, read the
 * recent commits, create a commit (a file write on a branch), and open a pull
 * request. All authenticated with the on-device token; nothing goes through a
 * server. Each call is small + typed + honest about failures.
 *
 * © Ankur Sinha.
 */

const API = "https://api.github.com";

function headers(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" };
}

async function gh<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...init, headers: { ...headers(token), ...(init?.headers || {}) } });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`GitHub ${res.status}: ${msg.slice(0, 160) || path}`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export interface Repo { full_name: string; name: string; default_branch: string; private: boolean; }
export interface Branch { name: string; }
export interface Commit { sha: string; message: string; author: string; date: string; }
export interface PullRequest { number: number; title: string; html_url: string; state: string; }

/** The signed-in user's repos (most recently pushed first). */
export function listRepos(token: string): Promise<Repo[]> {
  return gh<Repo[]>(token, "/user/repos?sort=pushed&per_page=50&affiliation=owner,collaborator");
}

export function listBranches(token: string, repo: string): Promise<Branch[]> {
  return gh<Branch[]>(token, `/repos/${repo}/branches?per_page=50`);
}

/** Recent commits on a branch, flattened to what the panel shows. */
export async function listCommits(token: string, repo: string, branch: string): Promise<Commit[]> {
  const raw = await gh<Array<{ sha: string; commit: { message: string; author: { name: string; date: string } } }>>(
    token, `/repos/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=20`,
  );
  return raw.map((c) => ({
    sha: c.sha.slice(0, 7), message: c.commit.message.split("\n")[0],
    author: c.commit.author.name, date: c.commit.author.date,
  }));
}

export function listPulls(token: string, repo: string): Promise<PullRequest[]> {
  return gh<PullRequest[]>(token, `/repos/${repo}/pulls?state=open&per_page=20`);
}

/**
 * Commit a file to a branch (create or update). This is how Draften "commits" a
 * saved document to the repo — path + content (string) + message. Returns the new
 * commit sha. Fetches the existing file's sha first so an update doesn't 409.
 */
export async function commitFile(
  token: string, repo: string, branch: string, path: string, content: string, message: string,
): Promise<string> {
  // does the file already exist on this branch? (need its sha to update)
  let sha: string | undefined;
  try {
    const existing = await gh<{ sha: string }>(token, `/repos/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`);
    sha = existing.sha;
  } catch { /* new file — no sha */ }

  const body = {
    message, branch, sha,
    content: btoa(unescape(encodeURIComponent(content))), // base64, UTF-8 safe
  };
  const res = await gh<{ commit: { sha: string } }>(
    token, `/repos/${repo}/contents/${encodeURIComponent(path)}`,
    { method: "PUT", body: JSON.stringify(body) },
  );
  return res.commit.sha;
}

/**
 * Clone / Pull — read a Draften document out of a repo. Finds the first
 * `draften/*.draften.json` on the branch (or a given path) and returns its
 * parsed content + sha. This is how "Clone a repository" + "Pull" open/refresh
 * a design that lives in git. Returns null if the repo has no Draften document.
 */
export async function readDraftenFromRepo(
  token: string, repo: string, branch: string, path?: string,
): Promise<{ path: string; content: unknown; sha: string } | null> {
  let target = path;
  if (!target) {
    // list the draften/ folder and pick the first .draften.json
    try {
      const entries = await gh<Array<{ name: string; path: string; type: string }>>(
        token, `/repos/${repo}/contents/draften?ref=${branch}`,
      );
      const file = entries.find((e) => e.type === "file" && e.name.endsWith(".draften.json"));
      if (!file) return null;
      target = file.path;
    } catch { return null; } // no draften/ folder
  }
  try {
    const f = await gh<{ content: string; sha: string }>(
      token, `/repos/${repo}/contents/${encodeURIComponent(target)}?ref=${branch}`,
    );
    const text = decodeURIComponent(escape(atob(f.content.replace(/\n/g, ""))));
    return { path: target, content: JSON.parse(text), sha: f.sha };
  } catch { return null; }
}

/** List the Draften design files in a repo's draften/ folder (for the project view). */
export async function listDraftenFiles(token: string, repo: string, branch: string): Promise<{ name: string; path: string }[]> {
  try {
    const entries = await gh<Array<{ name: string; path: string; type: string }>>(
      token, `/repos/${repo}/contents/draften?ref=${branch}`,
    );
    return entries.filter((e) => e.type === "file" && e.name.endsWith(".draften.json")).map((e) => ({ name: e.name.replace(/\.draften\.json$/, ""), path: e.path }));
  } catch { return []; } // no draften/ folder yet
}

/** Open a pull request from `head` into `base`. */
export function openPull(
  token: string, repo: string, title: string, head: string, base: string, body = "",
): Promise<PullRequest> {
  return gh<PullRequest>(token, `/repos/${repo}/pulls`, {
    method: "POST", body: JSON.stringify({ title, head, base, body }),
  });
}
