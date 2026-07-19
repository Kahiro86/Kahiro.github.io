// ── Fleet — the accounts, real and earned ────────────────────────────
// Account #1 is your live funded account, drawn entirely from real trades.
// Accounts #2/#3 are locked slots that unlock only when the scaling gate is
// passed — shown with real gate progress, never mocked balances. Above them,
// the aggregate-exposure cap: the correlation defence that keeps one bad day
// from breaching the whole fleet.
import { useMemo } from "react";
import { Lock } from "lucide-react";
import { BD, T1, T2, T3, GL, AC, GR, AM, RE } from "../../shared/designTokens.js";
import { Card } from "../../shared/ui.jsx";
import { Ring } from "../../shared/charts.jsx";
import { tradingMetrics, getStats } from "../trading/helpers.js";
import { scalingGate, withdrawalsTotal, sanitizeFirmConfig } from "../../shared/firm.js";

const big = { fontFamily: "'JetBrains Mono',monospace", fontWeight: 900, color: T1, lineHeight: 1 };
const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const ddColor = (p) => (p < 60 ? GR : p < 90 ? AM : RE);

const Label = ({ children }) => (
  <div style={{ fontSize: 10, fontWeight: 700, color: T3, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>{children}</div>
);

export function FleetTab({ trades, rawBal, finance, reviews, withdrawals, config }) {
  const bal = Number.isFinite(+rawBal) && +rawBal > 0 ? +rawBal : 15000;
  const cfg = useMemo(() => sanitizeFirmConfig(config), [config]);
  const wdTotal = withdrawalsTotal(withdrawals) + (+finance?.tradingWithdrawals || 0);
  const tm = useMemo(() => tradingMetrics(trades, bal, wdTotal, finance?.profitSplit || 80), [trades, bal, wdTotal, finance]);
  const stats = useMemo(() => getStats(trades), [trades]);
  const gate = useMemo(() => scalingGate(trades, reviews, withdrawals), [trades, reviews, withdrawals]);

  const cap = cfg.aggregateExposureCap;
  const exposure = +tm.openRiskPct || 0;
  const overCap = exposure > cap;

  // Drawdown buffers consumed (of the prop-firm limits): daily 5%, max 10%.
  const dailyUsed = tm.dailyPnl < 0 ? clamp((Math.abs(tm.dailyPnl) / (bal * 0.05)) * 100) : 0;
  const maxUsed = tm.equity < bal ? clamp(((bal - tm.equity) / (bal * 0.10)) * 100) : 0;

  return (
    <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 980 }}>
      {/* Aggregate exposure */}
      <Card style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 9 }}>
          <Label>Aggregate Exposure</Label>
          <span style={{ ...big, fontSize: 14, color: overCap ? RE : GR }}>{exposure.toFixed(2)}% / {cap}%</span>
        </div>
        <div style={{ height: 7, background: GL, borderRadius: 4, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${clamp((exposure / cap) * 100)}%`, background: overCap ? RE : AC, borderRadius: 4 }} />
        </div>
        <div style={{ fontSize: 10.5, color: T3, marginTop: 7 }}>Correlated open risk across the fleet. The cap is the correlation defence — one event must never breach every account at once.</div>
      </Card>

      {/* Account #1 — real */}
      <Card style={{ padding: "18px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: T1 }}>Account #1</div>
            <div style={{ fontSize: 11, color: T3, fontFamily: "monospace", marginTop: 2 }}>Funded · ${bal.toLocaleString()}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ ...big, fontSize: 20, color: tm.equity >= bal ? GR : RE }}>${Math.round(tm.equity).toLocaleString()}</div>
            <div style={{ fontSize: 10, color: T3, fontFamily: "monospace" }}>{tm.totalProfit >= 0 ? "+" : ""}{Math.round(tm.totalProfit).toLocaleString()} to date</div>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-around", marginTop: 14, gap: 12, flexWrap: "wrap" }}>
          <Ring pct={dailyUsed} size={96} stroke={9} color={ddColor(dailyUsed)}>
            <div style={{ ...big, fontSize: 15, color: ddColor(dailyUsed) }}>{dailyUsed}%</div>
            <div style={{ fontSize: 7.5, color: T3, letterSpacing: 1, marginTop: 2 }}>DAILY 5%</div>
          </Ring>
          <Ring pct={maxUsed} size={96} stroke={9} color={ddColor(maxUsed)}>
            <div style={{ ...big, fontSize: 15, color: ddColor(maxUsed) }}>{maxUsed}%</div>
            <div style={{ fontSize: 7.5, color: T3, letterSpacing: 1, marginTop: 2 }}>MAX 10%</div>
          </Ring>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, paddingTop: 12, borderTop: `1px solid ${BD}` }}>
          {[
            ["WIN RATE", `${stats.wr}%`],
            ["THIS MONTH", `${tm.monthlyPnl >= 0 ? "+" : "−"}$${Math.abs(Math.round(tm.monthlyPnl)).toLocaleString()}`],
            ["TRADES", `${stats.total}`],
            ["YOUR SPLIT", `$${(tm.yourShare || 0).toLocaleString()}`],
          ].map(([l, v]) => (
            <div key={l} style={{ textAlign: "center", flex: 1 }}>
              <div style={{ ...big, fontSize: 14 }}>{v}</div>
              <div style={{ fontSize: 8.5, color: T3, letterSpacing: 0.5, marginTop: 3 }}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 9.5, color: T3, marginTop: 8 }}>Includes Finance-logged withdrawals (Wealth → Net Worth)</div>
      </Card>

      {/* Locked slots */}
      {cfg.accounts.map((a) => (
        <Card key={a.id} style={{ padding: "16px 18px", opacity: 0.9 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{ fontSize: 14.5, fontWeight: 700, color: T2 }}>Account #{a.id}</span>
              <Lock size={12} color={T3} />
            </div>
            <span style={{ fontSize: 10.5, color: T3, fontFamily: "monospace" }}>{a.firm ? a.firm : "Not yet funded"}</span>
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: T2, marginBottom: 5 }}>
              <span>Clean withdrawal months</span>
              <span style={{ fontFamily: "monospace", color: gate.met ? GR : AM }}>{gate.have} / {gate.need}</span>
            </div>
            <div style={{ height: 6, background: GL, borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${clamp((gate.have / gate.need) * 100)}%`, background: gate.met ? GR : AC, borderRadius: 4 }} />
            </div>
            <div style={{ fontSize: 9.5, color: T3, marginTop: 7, fontStyle: "italic" }}>
              {gate.met ? "Gate passed — this slot is ready to fund from the fleet fund." : "Unlocks automatically when Account #1 clears the gate."}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
