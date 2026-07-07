// Catches render errors so one broken module can never blank the whole app —
// the failure becomes a contained, recoverable card instead of a white page.
import { Component } from "react";
import { B1, BD, T1, T2, T3, GL, CY, RE } from "./designTokens.js";

export class ErrorBoundary extends Component {
  state = { err: null };
  static getDerivedStateFromError(err) { return { err }; }

  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: "60vh", padding: 24 }}>
        <div style={{ maxWidth: 420, background: B1, border: `1px solid ${RE}33`, borderRadius: 16, padding: "26px 28px", textAlign: "center" }}>
          <div style={{ fontSize: 30, marginBottom: 12 }}>🛠️</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T1, marginBottom: 7 }}>This section hit a snag</div>
          <div style={{ fontSize: 12.5, color: T2, lineHeight: 1.6, marginBottom: 6 }}>
            Your data is safe. Try again, or reload the app if it persists.
          </div>
          <div style={{ fontSize: 10.5, color: T3, fontFamily: "monospace", marginBottom: 18, wordBreak: "break-word" }}>
            {String(this.state.err?.message || this.state.err).slice(0, 140)}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button onClick={() => this.setState({ err: null })}
              style={{ padding: "9px 18px", background: `${CY}22`, border: `1px solid ${CY}44`, borderRadius: 10, color: CY, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              Try again
            </button>
            <button onClick={() => window.location.reload()}
              style={{ padding: "9px 18px", background: GL, border: `1px solid ${BD}`, borderRadius: 10, color: T2, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
              Reload app
            </button>
          </div>
        </div>
      </div>
    );
  }
}
