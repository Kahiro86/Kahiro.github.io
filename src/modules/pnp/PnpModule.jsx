// ── PRESS 'N' PLAY — shell ───────────────────────────────────────────
// The analytics and discipline layer over the trade journal.
//
// Deliberately NOT a second journal. Trades are read from `ti_trades`, the
// same store Trading OS writes and eight other modules read, so a trade is
// logged once and appears everywhere. This module owns only what did not
// exist before: R-based analytics, session phases, and period reviews with
// numbers that compute themselves.
import { useMemo, useState } from "react";
import { BarChart3, Clock, ClipboardCheck } from "lucide-react";
import { BD, T2, T3, GL } from "../../shared/designTokens.js";
import { useStorageState } from "../../shared/useStorageState.js";
import { ModuleTabs } from "../../shared/ModuleTabs.jsx";
import { Hydrating } from "../../shared/ui.jsx";
import { sanitizeTrades } from "../trading/intel/tradingIntel.js";
import { sanitizePhases, seedPhases } from "./engine/phases.js";
import { DashboardTab } from "./DashboardTab.jsx";

const TABS = [
  { id: "dashboard", l: "Dashboard", i: BarChart3 },
  { id: "phases", l: "Session Phases", i: Clock },
  { id: "reviews", l: "Reviews", i: ClipboardCheck },
];

export function PnpModule() {
  const [tab, setTab] = useState("dashboard");
  const [rawTrades, , tradesLoaded] = useStorageState("ti_trades", []);
  const [rawPhases, setPhases, phasesLoaded] = useStorageState("pnp_phases", null);
  const [settings] = useStorageState("ti_settings", {});

  const trades = useMemo(() => sanitizeTrades(rawTrades), [rawTrades]);
  const phases = useMemo(
    () => sanitizePhases(rawPhases == null ? seedPhases() : rawPhases),
    [rawPhases],
  );
  const accountId = settings?.activeAccountId || "";

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
        {tab === "dashboard" && (
          <DashboardTab trades={trades} phases={phases} accountId={accountId} />
        )}
        {tab === "phases" && (
          <div style={{ color: T2, fontSize: 12, background: GL, border: `1px solid ${BD}`, borderRadius: 12, padding: 16 }}>
            Session phase editor — next step.
          </div>
        )}
        {tab === "reviews" && (
          <div style={{ color: T2, fontSize: 12, background: GL, border: `1px solid ${BD}`, borderRadius: 12, padding: 16 }}>
            Period reviews — next step.
          </div>
        )}
      </div>
    </div>
  );
}
