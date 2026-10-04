import { useEffect, useState } from "react";
import { GitBranch, GitPullRequest, RefreshCw, Download, GitFork, Network } from "lucide-react";
import { useGitSession } from "../git/session";
import { listRepos, listBranches, listCommits, listPulls, commitFile, openPull, readDraftenFromRepo, listDraftenFiles, listTree, type Repo, type Commit, type PullRequest } from "../git/github-api";
import { useEditor } from "../state/store";
import { buildGitDiagram } from "../ai/gitdiagram";
import { documentToSkeleton } from "../import/to-canvas";
import { drawSkeletonOnCanvas } from "../canvas/apply-action";

/**
 * SourceControlPanel — the "lives in your git repo" panel (from the v2 mockup).
 *
 * Signed in → pick a repo + branch, see recent commits + open PRs, write a commit
 * message and COMMIT the current document to the repo (a real file write via the
 * GitHub API), and open a pull request. Signed out → a prompt to sign in. Honest:
 * every action reports success/failure; nothing is faked.
 */
export function SourceControlPanel() {
  const { token, isSignedIn } = useGitSession();
  const doc = useEditor((s) => s.doc);
  const loadDocument = useEditor((s) => s.loadDocument);
  const [cloneUrl, setCloneUrl] = useState("");

  const [repos, setRepos] = useState<Repo[]>([]);
  const [repo, setRepo] = useState<string>("");
  const [branches, setBranches] = useState<string[]>([]);
  const [branch, setBranch] = useState<string>("");
  const [commits, setCommits] = useState<Commit[]>([]);
  const [pulls, setPulls] = useState<PullRequest[]>([]);
  const [designs, setDesigns] = useState<{ name: string; path: string }[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // load repos on sign-in
  useEffect(() => {
    if (!token) return;
    listRepos(token).then((r) => { setRepos(r); if (r[0]) setRepo(r[0].full_name); }).catch((e) => setStatus(e.message));
  }, [token]);

  // when the repo changes, load its branches (default first) + PRs
  useEffect(() => {
    if (!token || !repo) return;
    const def = repos.find((r) => r.full_name === repo)?.default_branch ?? "main";
    listBranches(token, repo).then((b) => {
      const names = b.map((x) => x.name);
      setBranches(names);
      setBranch(names.includes(def) ? def : names[0] ?? def);
    }).catch((e) => setStatus(e.message));
    listPulls(token, repo).then(setPulls).catch(() => setPulls([]));
  }, [token, repo, repos]);

  // commits + designs for the chosen branch (the project view)
  useEffect(() => {
    if (!token || !repo || !branch) return;
    listCommits(token, repo, branch).then(setCommits).catch(() => setCommits([]));
    listDraftenFiles(token, repo, branch).then(setDesigns).catch(() => setDesigns([]));
  }, [token, repo, branch]);

  // Open a specific design from the selected repo onto the canvas.
  async function openDesign(path: string) {
    if (!token || !repo || !branch) return;
    setBusy(true); setStatus(null);
    try {
      const got = await readDraftenFromRepo(token, repo, branch, path);
      if (got) { loadDocument(got.content as Parameters<typeof loadDocument>[0]); setStatus(`Opened ${path}`); }
      else setStatus("Couldn't read that design.");
    } catch (e) { setStatus((e as Error).message); }
    finally { setBusy(false); }
  }

  async function doCommit() {
    if (!token || !repo || !branch || !msg.trim()) return;
    setBusy(true); setStatus(null);
    try {
      const path = `draften/${doc.name || "document"}.draften.json`;
      await commitFile(token, repo, branch, path, JSON.stringify(doc, null, 2), msg.trim());
      setStatus(`Committed to ${repo}@${branch}`);
      setMsg("");
      listCommits(token, repo, branch).then(setCommits).catch(() => {});
    } catch (e) {
      setStatus((e as Error).message);
    } finally { setBusy(false); }
  }

  // Clone a repository: parse owner/repo from a URL (or owner/repo), load its
  // Draften document onto the canvas.
  async function doClone() {
    if (!token) return;
    const m = cloneUrl.trim().match(/(?:github\.com[/:])?([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/);
    const full = m?.[1];
    if (!full) { setStatus("Enter a repo as owner/name or a github.com URL."); return; }
    setBusy(true); setStatus(null);
    try {
      const b = await listBranches(token, full);
      const def = b[0]?.name ?? "main";
      const got = await readDraftenFromRepo(token, full, def);
      if (!got) { setStatus(`Opened ${full}, but it has no draften/ document yet.`); setRepo(full); }
      else { loadDocument(got.content as Parameters<typeof loadDocument>[0]); setRepo(full); setStatus(`Cloned ${full} · loaded ${got.path}`); }
      setCloneUrl("");
    } catch (e) { setStatus((e as Error).message); }
    finally { setBusy(false); }
  }

  // Pull: refresh this repo's Draften document from the current branch.
  async function doPull() {
    if (!token || !repo || !branch) return;
    setBusy(true); setStatus(null);
    try {
      const got = await readDraftenFromRepo(token, repo, branch);
      if (!got) { setStatus("Nothing to pull — no draften/ document on this branch."); }
      else { loadDocument(got.content as Parameters<typeof loadDocument>[0]); setStatus(`Pulled latest from ${repo}@${branch}`); }
    } catch (e) { setStatus((e as Error).message); }
    finally { setBusy(false); }
  }

  // Diagram this repo: read its file tree and render the architecture as an
  // editable Draften diagram — understand a project at a glance (à la gitdiagram).
  async function doDiagram() {
    if (!token || !repo || !branch) return;
    setBusy(true); setStatus("Reading repo tree…");
    try {
      const { entries, truncated } = await listTree(token, repo, branch);
      if (!entries.length) { setStatus("Repo tree was empty."); return; }
      const diagram = buildGitDiagram(entries, { repo, branch });
      loadDocument(diagram);
      await drawSkeletonOnCanvas(documentToSkeleton(diagram), true);
      const groups = diagram.boards[0]?.children.length ?? 0;
      setStatus(`Diagrammed ${repo}@${branch} · ${entries.filter((e) => e.type === "blob").length} files${truncated ? " (truncated by GitHub)" : ""}`);
      void groups;
    } catch (e) { setStatus((e as Error).message); }
    finally { setBusy(false); }
  }

  async function doPR() {
    if (!token || !repo) return;
    const def = repos.find((r) => r.full_name === repo)?.default_branch ?? "main";
    if (branch === def) { setStatus("Switch to a feature branch to open a PR."); return; }
    setBusy(true);
    try {
      const pr = await openPull(token, repo, msg.trim() || `Draften: ${branch}`, branch, def);
      setStatus(`Opened PR #${pr.number}`);
      setPulls((p) => [pr, ...p]);
    } catch (e) { setStatus((e as Error).message); }
    finally { setBusy(false); }
  }

  const label = (s: string) => <div style={{ fontSize: 11.5, fontWeight: 500, color: "var(--t3)", padding: "8px 0 4px" }}>{s}</div>;

  if (!isSignedIn()) {
    return <div style={{ padding: 16, fontSize: 12.5, color: "var(--t3)", lineHeight: 1.6 }}>Connect GitHub (the account avatar at the bottom of the icon rail) to clone, pull, commit and open pull requests from here.</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "4px 12px", overflow: "auto", minHeight: 0 }}>
      {/* Clone a repository (v2) */}
      {label("Clone a repository")}
      <div style={{ display: "flex", gap: 6 }}>
        <input value={cloneUrl} onChange={(e) => setCloneUrl(e.target.value)} placeholder="owner/repo or github.com URL"
          onKeyDown={(e) => { if (e.key === "Enter") doClone(); }}
          style={{ ...selStyle, flex: 1, minWidth: 0 }} />
        <button className="tb-btn" disabled={busy || !cloneUrl.trim()} onClick={doClone} title="Clone / open"><GitFork size={13} /></button>
      </div>

      {label("Repository")}
      <select value={repo} onChange={(e) => setRepo(e.target.value)} style={selStyle}>
        {repos.map((r) => <option key={r.full_name} value={r.full_name}>{r.full_name}{r.private ? " · private" : ""}</option>)}
      </select>

      {label("Branch")}
      <select value={branch} onChange={(e) => setBranch(e.target.value)} style={selStyle}>
        {branches.map((b) => <option key={b} value={b}>{b}</option>)}
      </select>

      {/* Project view — the designs in the selected repo (click to open) */}
      {repo && (
        <>
          {label(`Designs in ${repo.split("/")[1]}`)}
          {designs.length === 0 ? (
            <div style={{ fontSize: 12, color: "var(--t3)", padding: "2px 0" }}>No designs yet — Commit this one to add it to the repo.</div>
          ) : (
            designs.map((d) => (
              <button key={d.path} onClick={() => openDesign(d.path)} disabled={busy}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", border: "1px solid var(--line)", borderRadius: 8, background: "var(--surf)", cursor: "pointer", padding: "7px 10px", fontSize: 12.5, color: "var(--t1)", textAlign: "left", marginBottom: 4 }}>
                <span style={{ color: "var(--accent)" }}>▦</span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</span>
                <span style={{ fontSize: 11, color: "var(--t3)" }}>open</span>
              </button>
            ))
          )}
        </>
      )}

      {label("Review and commit")}
      <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Describe your changes" rows={2}
        style={{ ...selStyle, resize: "vertical", minHeight: 48 }} />
      <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
        <button className="ai-btn" style={{ flex: 1, justifyContent: "center" }} disabled={busy || !msg.trim()} onClick={doCommit}>
          <GitBranch size={13} /> Commit
        </button>
        <button className="tb-btn" disabled={busy} onClick={doPull} title="Pull latest from this branch"><Download size={13} /> Pull</button>
        <button className="tb-btn" disabled={busy} onClick={doPR} title="Open a pull request"><GitPullRequest size={13} /> PR</button>
        <button className="tb-btn" disabled={busy || !repo} onClick={doDiagram} title="Diagram this repo's architecture on the canvas"><Network size={13} /> Diagram</button>
      </div>

      {status && <div style={{ fontSize: 11.5, color: "var(--t2)", marginTop: 6 }}>{status}</div>}

      {label("Recent commits")}
      {commits.length === 0 ? <div style={{ fontSize: 12, color: "var(--t3)" }}>—</div> :
        commits.slice(0, 8).map((c) => (
          <div key={c.sha} style={{ display: "flex", gap: 8, fontSize: 12, padding: "3px 0", borderBottom: "1px solid var(--line)" }}>
            <span style={{ fontFamily: "var(--font-code)", color: "var(--t3)" }}>{c.sha}</span>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.message}</span>
          </div>
        ))}

      {pulls.length > 0 && <>
        {label("Pull requests")}
        {pulls.map((p) => (
          <a key={p.number} href={p.html_url} target="_blank" rel="noreferrer"
            style={{ fontSize: 12, padding: "3px 0", color: "var(--accent)", textDecoration: "none" }}>
            #{p.number} {p.title}
          </a>
        ))}
      </>}

      <button className="tb-btn" style={{ marginTop: 10, alignSelf: "flex-start" }} onClick={() => { if (token && repo && branch) listCommits(token, repo, branch).then(setCommits); }}>
        <RefreshCw size={12} /> Refresh
      </button>
    </div>
  );
}

const selStyle: React.CSSProperties = {
  width: "100%", background: "var(--surf)", border: "1px solid var(--line)",
  borderRadius: 8, padding: "6px 8px", color: "var(--t1)", fontSize: 12.5,
};
