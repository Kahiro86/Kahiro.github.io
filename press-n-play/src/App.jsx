// ── PRESS 'N' PLAY ───────────────────────────────────────────────────
// A trading journal. Log the trade, grade it honestly, and let the
// dashboard tell you whether the edge is real — and refuse to tell you
// anything it does not have the trades to support.
import { useMemo, useState } from "react";
import { BookOpen, BarChart3, Clock, ClipboardCheck } from "lucide-react";
import { B0, BD, T1, T2, T3, AC2, SANS, MONO } from "./ui/tokens.js";
import { ModuleTabs } from "./ui/ModuleTabs.jsx";
import { ErrorBoundary } from "./ui/ErrorBoundary.jsx";
import { useStore } from "./ui/useStore.js";
import { sanitizeTrades, sanitizeAccounts } from "./engine/trade.js";
import { sanitizePhases, seedPhases } from "./engine/phases.js";
import { SEED_FLAG } from "./engine/seed.js";
import { JournalTab } from "./screens/JournalTab.jsx";
import { DashboardTab } from "./screens/DashboardTab.jsx";
import { PhasesTab } from "./screens/PhasesTab.jsx";
import { ReviewTab } from "./screens/ReviewTab.jsx";
import { SeedCard } from "./screens/SeedCard.jsx";

const TABS = [
  { id: "journal", l: "Journal", i: BookOpen },
  { id: "dashboard", l: "Dashboard", i: BarChart3 },
  { id: "phases", l: "Session Phases", i: Clock },
  { id: "reviews", l: "Reviews", i: ClipboardCheck },
];

export function App() {
  const [tab, setTab] = useState("journal");
  const [rawTrades, setTrades] = useStore("trades", []);
  const [rawAccounts, setAccounts] = useStore("accounts", []);
  const [rawPhases, setPhases] = useStore("phases", null);
  const [rawReviews, setReviews] = useStore("reviews", []);
  const [seeded, setSeeded] = useStore(SEED_FLAG, false);

  const trades = useMemo(() => sanitizeTrades(rawTrades), [rawTrades]);
  const accounts = useMemo(() => sanitizeAccounts(rawAccounts), [rawAccounts]);
  const phases = useMemo(
    () => sanitizePhases(rawPhases == null ? seedPhases() : rawPhases),
    [rawPhases],
  );
  const accountId = accounts[0]?.id || "";

  const applySeed = (plan) => {
    if (plan.accounts.length) setAccounts((p) => [...(Array.isArray(p) ? p : []), ...plan.accounts]);
    if (plan.trades.length) setTrades((p) => [...plan.trades, ...(Array.isArray(p) ? p : [])]);
    setSeeded(true);
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", height: "100vh",
      background: B0, color: T1, fontFamily: SANS, overflow: "hidden",
    }}>
      <header style={{
        display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap",
        padding: "14px 22px 12px", borderBottom: `1px solid ${BD}`, flexShrink: 0,
      }}>
        <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 800, letterSpacing: 1.5, color: AC2 }}>
          PRESS 'N' PLAY
        </span>
        <span style={{ fontSize: 11, color: T3 }}>Trading journal</span>
        <span style={{ marginLeft: "auto", fontSize: 11, color: T3, fontFamily: MONO }}>
          {trades.length} trade{trades.length === 1 ? "" : "s"}
        </span>
      </header>

      <ModuleTabs
        tabs={TABS} active={tab} onSelect={setTab}
        activeBg="rgba(240,180,41,0.16)" activeColor={AC2}
      />

      <div data-app-content style={{ flex: 1, overflowY: "auto", padding: "18px 22px 44px" }}>
        <ErrorBoundary>
          {tab === "journal" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {!seeded && (
                <SeedCard accounts={accounts} trades={trades}
                  onSeed={applySeed} onDismiss={() => setSeeded(true)} />
              )}
              <JournalTab
                trades={trades} setTrades={setTrades} accounts={accounts}
                accountId={accountId} phases={phases} instruments={null}
              />
            </div>
          )}
          {tab === "dashboard" && (
            <DashboardTab trades={trades} phases={phases} accountId="" />
          )}
          {tab === "phases" && (
            <PhasesTab phases={phases} setPhases={setPhases} trades={trades} />
          )}
          {tab === "reviews" && (
            <ReviewTab trades={trades} reviews={rawReviews} setReviews={setReviews} accountId="" />
          )}
        </ErrorBoundary>
      </div>
    </div>
  );
}
