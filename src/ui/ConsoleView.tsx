import { useChangelog } from "../state/changelog";

/**
 * ConsoleView — the real event log. Shows every recorded change (AI / you /
 * import / plugin) from the changelog store, newest first, with who made it and
 * when. Entries past the undo cursor are dimmed (undone). This is the honest
 * "what happened" surface the Console tab promises — not a fake terminal.
 */
export function ConsoleView() {
  const entries = useChangelog((s) => s.entries);
  const cursor = useChangelog((s) => s.cursor);

  const authorMeta: Record<string, { icon: string; color: string }> = {
    ai: { icon: "✦", color: "#3d6b5f" },
    you: { icon: "✎", color: "#1d1d1b" },
    import: { icon: "⬇", color: "#8a6d3b" },
    plugin: { icon: "🧩", color: "#6b5bbd" },
  };

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "auto", background: "var(--canvas, #efeeeb)", padding: 16, fontSize: 13, fontFamily: "var(--font-mono, ui-monospace, monospace)" }}>
      <div style={{ color: "var(--text-3, #8e8d88)", marginBottom: 12 }}>
        Console — every change, who made it, when. {entries.length} event{entries.length === 1 ? "" : "s"}.
      </div>
      {entries.length === 0 ? (
        <div style={{ color: "var(--text-3, #8e8d88)" }}>Nothing yet. Use the ✦ assistant, draw, import a file, or pick a template — each change logs here.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {entries.slice().reverse().map((e, revIdx) => {
            const idx = entries.length - 1 - revIdx;
            const undone = idx >= cursor;
            const meta = authorMeta[e.author] ?? { icon: "•", color: "#8e8d88" };
            return (
              <div key={e.id} style={{ display: "flex", gap: 10, padding: "6px 8px", borderRadius: 6, opacity: undone ? 0.4 : 1, background: undone ? "transparent" : "var(--surf, #fff)" }}>
                <span style={{ color: "var(--text-3, #8e8d88)", flex: "none", width: 64 }}>{time(e.time)}</span>
                <span style={{ color: meta.color, flex: "none", width: 16 }}>{meta.icon}</span>
                <span style={{ flex: 1, color: "var(--t1, #1d1d1b)" }}>
                  {e.summary}
                  {e.via && <span style={{ color: "var(--text-3, #8e8d88)" }}> · {e.via}</span>}
                  {e.actions?.length ? <span style={{ color: "var(--text-3, #8e8d88)" }}> · {e.actions.length} action{e.actions.length === 1 ? "" : "s"}</span> : null}
                  {undone && <span style={{ color: "#b23b3b" }}> (undone)</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function time(iso: string): string {
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }); }
  catch { return ""; }
}
