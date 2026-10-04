import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * ErrorBoundary — catches any render/runtime error in the tree and shows it
 * on-screen instead of leaving a blank or half-broken app. Critical for the
 * packaged desktop app, where there's no visible console: a single thrown error
 * would otherwise make "everything feel broken". Here it's contained and named,
 * with a one-click reload, so we always know what actually failed.
 */
type Props = { children: ReactNode };
type State = { error: Error | null; info: string };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: "" };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep a readable trace in state so it's visible even without devtools.
    this.setState({ info: (info.componentStack || "").split("\n").slice(0, 6).join("\n") });
    // eslint-disable-next-line no-console
    console.error("Draften caught an error:", error, info);
  }

  render() {
    const { error, info } = this.state;
    if (!error) return this.props.children;
    return (
      <div style={wrap}>
        <div style={card}>
          <div style={{ fontFamily: "var(--font-serif, Georgia), serif", fontSize: 22, fontWeight: 500, marginBottom: 8 }}>
            Something hit a snag
          </div>
          <p style={{ color: "var(--text-2, #5d5c58)", fontSize: 14, margin: "0 0 14px", lineHeight: 1.5 }}>
            Draften caught an error and stopped it from breaking the rest of the app.
            Your work is saved automatically — reloading is safe.
          </p>
          <pre style={pre}>{error.message}{info ? "\n" + info : ""}</pre>
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={() => location.reload()} style={primaryBtn}>Reload Draften</button>
            <button onClick={() => this.setState({ error: null, info: "" })} style={ghostBtn}>Try to continue</button>
          </div>
        </div>
      </div>
    );
  }
}

const wrap: React.CSSProperties = { position: "fixed", inset: 0, display: "grid", placeItems: "center", background: "var(--bg, #f6f6f4)", padding: 24, zIndex: 9999 };
const card: React.CSSProperties = { maxWidth: 560, width: "100%", background: "var(--raised, #fff)", border: "1px solid var(--border, #e7e6e2)", borderRadius: 14, padding: 28, boxShadow: "0 20px 50px -24px rgba(0,0,0,.3)" };
const pre: React.CSSProperties = { fontFamily: "var(--font-code, monospace)", fontSize: 12, background: "var(--canvas, #efeeeb)", border: "1px solid var(--border, #e7e6e2)", borderRadius: 8, padding: "12px 14px", overflow: "auto", maxHeight: 220, whiteSpace: "pre-wrap", color: "var(--text, #1d1d1b)", margin: 0 };
const primaryBtn: React.CSSProperties = { background: "var(--accent, #3d6b5f)", color: "#fff", border: 0, borderRadius: 9, padding: "9px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer" };
const ghostBtn: React.CSSProperties = { background: "transparent", color: "var(--text, #1d1d1b)", border: "1px solid var(--border, #e7e6e2)", borderRadius: 9, padding: "9px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer" };
