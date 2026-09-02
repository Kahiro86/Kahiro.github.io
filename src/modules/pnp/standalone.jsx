// ── PRESS 'N' PLAY on its own ────────────────────────────────────────
// The trading journal as a standalone app — its own page, its own shell,
// none of the OS app's sidebar, header, ambient background or onboarding.
//
// It still runs on the same `architect:` storage contract, which matters
// more than it looks: served from the same origin as the OS app, it reads
// the very same ti_trades and ict_reviews, and inherits Supabase sync,
// offline and cross-tab updates without a line of its own plumbing. Open
// it on its own or open it in the OS app; there is one set of trades.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ToastProvider } from "../../shared/toast.jsx";
import { ErrorBoundary } from "../../shared/ErrorBoundary.jsx";
import { B0, T1, T3, AC2, SANS, MONO } from "../../shared/designTokens.js";
import { PnpModule } from "./PnpModule.jsx";
import "./standalone.css";

function Standalone() {
  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh",
      background: B0, color: T1, fontFamily: SANS, overflow: "hidden",
    }}>
      <header style={{
        display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap",
        padding: "14px 22px 12px", borderBottom: "1px solid #2A2A2A", flexShrink: 0,
      }}>
        <span style={{
          fontFamily: MONO, fontSize: 15, fontWeight: 800,
          letterSpacing: 1.5, color: AC2,
        }}>PRESS 'N' PLAY</span>
        <span style={{ fontSize: 11, color: T3 }}>Trading journal · analytics</span>
      </header>
      <div data-module-content style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <ErrorBoundary>
          <PnpModule />
        </ErrorBoundary>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ToastProvider>
      <Standalone />
    </ToastProvider>
  </StrictMode>,
);
