import { useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";

import { useChangelog } from "../state/changelog";
import { useAnnotations } from "../state/annotations-store";

/**
 * ReviewPanel — a real, working review flow.
 *
 * You can add comments (kept in local state, persisted to localStorage so they
 * survive reloads) and set a verdict (Approve / Request changes / Pending). The
 * verdict is RECORDED to the changelog so it shows in the Console + History as a
 * real event — honest provenance, not a decorative button. Comments resolve/unresolve.
 */

type Comment = { id: string; text: string; at: number; resolved: boolean };
type Verdict = "pending" | "approved" | "changes";

const KEY = "draften-review";
function load(): { comments: Comment[]; verdict: Verdict } {
  try { const r = JSON.parse(localStorage.getItem(KEY) || ""); if (r && Array.isArray(r.comments)) return r; } catch { /* fresh */ }
  return { comments: [], verdict: "pending" };
}
function save(s: { comments: Comment[]; verdict: Verdict }) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage off */ }
}

export function ReviewPanel({ boardName }: { boardName: string }) {
  const init = load();
  const [comments, setComments] = useState<Comment[]>(init.comments);
  const [verdict, setVerdict] = useState<Verdict>(init.verdict);
  const [draft, setDraft] = useState("");
  const record = useChangelog((s) => s.record);

  const persist = (c: Comment[], v: Verdict) => { setComments(c); setVerdict(v); save({ comments: c, verdict: v }); };

  const add = () => {
    const text = draft.trim();
    if (!text) return;
    const next = [...comments, { id: crypto.randomUUID(), text, at: Date.now(), resolved: false }];
    persist(next, verdict);
    setDraft("");
    record({ author: "you", summary: `Review comment: "${text.slice(0, 60)}"`, actions: [] });
  };

  const toggle = (id: string) => persist(comments.map((c) => (c.id === id ? { ...c, resolved: !c.resolved } : c)), verdict);
  const remove = (id: string) => persist(comments.filter((c) => c.id !== id), verdict);

  const setV = (v: Verdict) => {
    persist(comments, v);
    record({ author: "you", summary: v === "approved" ? `Approved "${boardName}"` : v === "changes" ? `Requested changes on "${boardName}"` : `Reset review on "${boardName}"`, actions: [] });
  };

  const open = comments.filter((c) => !c.resolved).length;

  return (
    <div className="pane-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <AnnotationsList />

      <div>
        <div style={{ fontSize: 13, fontWeight: 600 }}>{boardName}</div>
        <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, padding: "2px 10px", fontSize: 11.5, fontWeight: 600,
          background: verdict === "approved" ? "#e7f3ee" : verdict === "changes" ? "#fdedeb" : "var(--canvas, #efeeeb)",
          color: verdict === "approved" ? "#2f7d5b" : verdict === "changes" ? "#b23b3b" : "var(--text-3, #8e8d88)" }}>
          {verdict === "approved" ? "✓ Approved" : verdict === "changes" ? "● Changes requested" : "○ In review"}
          <span style={{ opacity: 0.7 }}>· {open} open</span>
        </div>
      </div>

      {/* add a comment */}
      <div style={{ display: "flex", gap: 6 }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          placeholder="Add a review comment…"
          style={{ flex: 1, minWidth: 0, borderRadius: 8, border: "1px solid var(--line, #e7e6e2)", padding: "7px 10px", fontSize: 12.5, background: "var(--surf, #fff)", color: "var(--t1, #1d1d1b)" }}
        />
        <button onClick={add} disabled={!draft.trim()}
          style={{ border: 0, borderRadius: 8, padding: "0 12px", fontSize: 12.5, fontWeight: 600, cursor: draft.trim() ? "pointer" : "not-allowed",
            background: draft.trim() ? "var(--accent, #3d6b5f)" : "var(--canvas, #efeeeb)", color: draft.trim() ? "#fff" : "var(--text-3, #8e8d88)" }}>
          Add
        </button>
      </div>

      {/* comments */}
      {comments.length === 0 ? (
        <div style={{ fontSize: 12, color: "var(--text-3, #8e8d88)" }}>No comments yet. Add one above — it logs to the Console too.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {comments.map((c) => (
            <div key={c.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", borderRadius: 8, border: "1px solid var(--line, #e7e6e2)", background: "var(--surf, #fff)", opacity: c.resolved ? 0.55 : 1 }}>
              <button onClick={() => toggle(c.id)} title={c.resolved ? "Reopen" : "Resolve"}
                style={{ flex: "none", width: 18, height: 18, borderRadius: 5, border: "1px solid var(--line, #e7e6e2)", cursor: "pointer", background: c.resolved ? "var(--accent, #3d6b5f)" : "transparent", color: "#fff", fontSize: 11, lineHeight: "16px" }}>
                {c.resolved ? "✓" : ""}
              </button>
              <span style={{ flex: 1, fontSize: 12.5, textDecoration: c.resolved ? "line-through" : "none", color: "var(--t1, #1d1d1b)" }}>{c.text}</span>
              <button onClick={() => remove(c.id)} title="Delete" aria-label="Delete comment" style={{ flex: "none", border: 0, background: "transparent", color: "var(--text-3, #8e8d88)", cursor: "pointer", fontSize: 14, minWidth: 28, minHeight: 28 }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* verdict */}
      <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
        <button onClick={() => setV("changes")}
          style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid var(--line, #e7e6e2)", background: "var(--surf, #fff)", color: "var(--t1, #1d1d1b)", cursor: "pointer", fontSize: 12.5, fontWeight: 600 }}>
          Request changes
        </button>
        <button onClick={() => setV("approved")} className="ai-btn" style={{ flex: 1, justifyContent: "center" }}>Approve</button>
      </div>
      {verdict !== "pending" && (
        <button onClick={() => setV("pending")} style={{ border: 0, background: "transparent", color: "var(--text-3, #8e8d88)", cursor: "pointer", fontSize: 11.5, textDecoration: "underline" }}>
          Reset to in-review
        </button>
      )}
    </div>
  );
}

/**
 * AnnotationsList — the side list of the canvas annotation pins (the numbered
 * notes dropped with the toolbar's "Add a note" tool). Shows each note, lets you
 * arm the drop tool, edit text, or delete. The pins themselves live on the canvas
 * (AnnotationLayer); this is the readable index of them.
 */
function AnnotationsList() {
  const items = useAnnotations((s) => s.items);
  const dropping = useAnnotations((s) => s.dropping);
  const setDropping = useAnnotations((s) => s.setDropping);
  const update = useAnnotations((s) => s.update);
  const remove = useAnnotations((s) => s.remove);
  const clear = useAnnotations((s) => s.clear);

  return (
    <div style={{ border: "1px solid var(--line, #e7e6e2)", borderRadius: 10, padding: 10, background: "var(--surf,#fff)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <MapPin size={14} style={{ color: "#e5a000" }} />
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>Annotations</span>
        <span style={{ fontSize: 11, color: "var(--text-3,#8e8d88)" }}>{items.length}</span>
        {items.length > 0 && <button onClick={clear} style={{ marginLeft: "auto", border: 0, background: "transparent", color: "var(--text-3,#8e8d88)", fontSize: 11, cursor: "pointer" }}>Clear</button>}
      </div>

      <button onClick={() => setDropping(!dropping)}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", border: `1px solid ${dropping ? "var(--accent,#3d6b5f)" : "var(--line,#e7e6e2)"}`, borderRadius: 8, padding: "7px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", background: dropping ? "var(--accent-soft,#e2ebe7)" : "transparent", color: dropping ? "var(--accent,#3d6b5f)" : "var(--t1,#1d1d1b)" }}>
        <Plus size={14} /> {dropping ? "Click the canvas to place… (Esc to cancel)" : "Add note on canvas"}
      </button>

      {items.length === 0 ? (
        <p style={{ fontSize: 11.5, color: "var(--text-3,#8e8d88)", margin: "8px 0 0", lineHeight: 1.5 }}>Drop numbered pins on the canvas for specs or review feedback.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
          {items.map((p) => (
            <div key={p.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <span style={{ flex: "none", width: 20, height: 20, borderRadius: "50%", background: "#e5a000", color: "#1d1d1b", fontSize: 11, fontWeight: 700, display: "grid", placeItems: "center", marginTop: 2 }}>{p.n}</span>
              <input value={p.text} onChange={(e) => update(p.id, { text: e.target.value })} placeholder="Add a note…"
                style={{ flex: 1, minWidth: 0, border: "1px solid var(--line,#e7e6e2)", borderRadius: 6, padding: "5px 8px", fontSize: 12, background: "var(--surf,#fff)", color: "var(--t1,#1d1d1b)" }} />
              <button onClick={() => remove(p.id)} title="Delete" aria-label="Delete annotation" className="row-icon-btn"
                style={{ flex: "none", width: 28, height: 28, border: 0, background: "transparent", color: "var(--text-3,#8e8d88)", cursor: "pointer", display: "grid", placeItems: "center", borderRadius: 6 }}><Trash2 size={13} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
