// ── PRESS 'N' PLAY — shell ───────────────────────────────────────────
// The analytics and discipline layer over the trade journal.
//
// Deliberately NOT a second journal. Trades are read from `ti_trades`, the
// same store Trading OS writes and eight other modules read, so a trade is
// logged once and appears everywhere. This module owns only what did not
// exist before: R-based analytics, session phases, and period reviews with
// numbers that compute themselves.
import { useMemo, useState } from "react";
import { BarChart3, Clock, ClipboardCheck, BookOpen } from "lucide-react";
import { useStorageState } from "../../shared/useStorageState.js";
import { ModuleTabs } from "../../shared/ModuleTabs.jsx";
import { Hydrating } from "../../shared/ui.jsx";
import { sanitizeTrades, sanitizeAccounts } from "../trading/intel/tradingIntel.js";
import { sanitizePhases, seedPhases } from "./engine/phases.js";
import { DashboardTab } from "./DashboardTab.jsx";
import { PhasesTab } from "./PhasesTab.jsx";
import { ReviewTab } from "./ReviewTab.jsx";
import { JournalTab } from "./JournalTab.jsx";
import { SeedCard } from "./SeedCard.jsx";
import { SEED_FLAG } from "./engine/seed.js";

const TABS = [
  { id: "journal", l: "Journal", i: BookOpen },
  { id: "dashboard", l: "Dashboard", i: BarChart3 },
  { id: "phases", l: "Session Phases", i: Clock },
  { id: "reviews", l: "Reviews", i: ClipboardCheck },
];

export function PnpModule() {
  const [tab, setTab] = useState("journal");
  const [rawTrades, , tradesLoaded] = useStorageState("ti_trades", []);
  const [rawPhases, setPhases, phasesLoaded] = useStorageState("pnp_phases", null);
  const [settings] = useStorageState("ti_settings", {});
  // The same review store Trading OS writes, so a review written here
  // is the one the XP engine and the Firm doctrine already read.
  const [rawReviews, setReviews] = useStorageState("ict_reviews", []);
  const [rawAccounts, setAccounts] = useStorageState("ti_accounts", []);
  const [seeded, setSeeded] = useStorageState(SEED_FLAG, false);
  const [, setTrades] = useStorageState("ti_trades", []);
  const [rawInstruments] = useStorageState("ti_instruments", null);

  const trades = useMemo(() => sanitizeTrades(rawTrades), [rawTrades]);
  const phases = useMemo(
    () => sanitizePhases(rawPhases == null ? seedPhases() : rawPhases),
    [rawPhases],
  );
  const accounts = useMemo(() => sanitizeAccounts(rawAccounts), [rawAccounts]);
  const accountId = settings?.activeAccountId || "";

  // Appends only. An account already named the same, or a trade already
  // carrying the seeded id, is skipped by buildSeed before we get here.
  const applySeed = (plan) => {
    if (plan.accounts.length) setAccounts((prev) => [...(Array.isArray(prev) ? prev : []), ...plan.accounts]);
    if (plan.trades.length) setTrades((prev) => [...plan.trades, ...(Array.isArray(prev) ? prev : [])]);
    setSeeded(true);
  };

  if (!tradesLoaded || !phasesLoaded) return <Hydrating />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0 }}>
      <ModuleTabs
        tabs={TABS}
        active={tab}
        onSelect={setTab}
        activeBg="rgba(120,200,255,0.14)"
        activeColor="#78C8FF"
      />
      <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px 40px" }}>
        {tab === "journal" && (
          <JournalTab
            trades={trades} setTrades={setTrades} accounts={accounts}
            accountId={accountId} phases={phases}
            instruments={Array.isArray(rawInstruments) ? rawInstruments : null}
          />
        )}
        {tab === "dashboard" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {!seeded && (
              <SeedCard
                accounts={accounts} trades={trades}
                onSeed={applySeed} onDismiss={() => setSeeded(true)}
              />
            )}
            <DashboardTab trades={trades} phases={phases} accountId={accountId} />
          </div>
        )}
        {tab === "phases" && (
          <PhasesTab phases={phases} setPhases={setPhases} trades={trades} />
        )}
        {tab === "reviews" && (
          <ReviewTab trades={trades} reviews={rawReviews} setReviews={setReviews} accountId={accountId} />
        )}
      </div>
    </div>
  );
}
