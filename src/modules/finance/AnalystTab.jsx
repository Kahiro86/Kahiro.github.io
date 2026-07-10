import { useState } from "react";
import { Cpu, Activity } from "lucide-react";
import { BD, GL, T1, T2, T3, CY, PU, GR, RE, AM } from "../../shared/designTokens.js";
import { Card, SH, Chip, Meter } from "../../shared/ui.jsx";
import { callClaude } from "../../shared/anthropic.js";
import { KAIZEN_COACH_PREAMBLE } from "../../shared/kaizen.js";
import { SUBSCORE_META } from "./financeHealth.js";

const scoreColor = (n) => (n >= 80 ? GR : n >= 65 ? CY : n >= 50 ? AM : RE);

export function AnalystTab({ health, fmtKES, bySource, budgets, monthlyPassive }) {
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const col = scoreColor(health.overall);

  const generate = async () => {
    setLoading(true); setAnalysis("");
    try {
      const srcLine = bySource.length ? bySource.map((s) => `${s.source} ${Math.round(s.pct)}%`).join(", ") : "none logged";
      const overBudget = budgets.filter((b) => +b.spent > +b.budget && +b.budget > 0).map((b) => b.cat);
      const reply = await callClaude({
        system: `You are KAHIRO — a Kaizen personal-finance analyst for Irisu (Nairobi, Kenya; KES). ${KAIZEN_COACH_PREAMBLE}
Analyze the numbers below. Be specific and data-driven. Identify: unnecessary/rising spending, income sources getting stronger or weaker, savings opportunities, risks, and diversification. Give practical, achievable recommendations that improve long-term stability — not generic advice. Under 320 words. Structure: Verdict · What's working · What to watch · This week's one small step.`,
        messages: [{
          role: "user",
          content: `Financial snapshot (KES):
Health score: ${health.overall}/100 (${health.band})
Monthly income: ${Math.round(health.monthlyIncome)} · Monthly expenses: ${Math.round(health.monthlyExpenses)} · Net cash flow: ${Math.round(health.netCashFlow)}
Savings rate: ${health.savingsRate.toFixed(1)}% · Emergency buffer: ${health.emergencyMonths.toFixed(1)} months
Income sources: ${health.diversification} (${srcLine})
Invested: ${Math.round(health.totalInvested)} · Monthly passive: ${Math.round(monthlyPassive)} · Personal debt: ${Math.round(health.personalDebt)}
Trading: ${health.tradingWr}% win rate, net ${health.tradingPnl}
Over-budget categories: ${overBudget.length ? overBudget.join(", ") : "none"}
Sub-scores: ${SUBSCORE_META.map((m) => `${m.label} ${Math.round(health.sub[m.key])}`).join(", ")}`,
        }],
        maxTokens: 1000,
      });
      setAnalysis(reply || "No analysis returned.");
    } catch (err) {
      setAnalysis(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: T1 }}>Financial Analyst</div>
        <div style={{ fontSize: 13, color: T3, marginTop: 3 }}>Continuous analysis of your whole financial picture · Kaizen recommendations</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
        <Card style={{ padding: "22px", borderColor: `${col}44`, display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ width: 108, height: 108, borderRadius: "50%", border: `3px solid ${col}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: `0 0 22px ${col}44`, flexShrink: 0 }}>
            <div style={{ fontSize: 34, fontWeight: 900, color: col, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>{health.overall}</div>
            <div style={{ fontSize: 9, color: T3, letterSpacing: 1.5 }}>/ 100</div>
          </div>
          <div>
            <div style={{ fontSize: 10, color: T3, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Financial Health</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: col }}>{health.band}</div>
            <div style={{ fontSize: 11.5, color: T2, marginTop: 6, lineHeight: 1.5, maxWidth: 200 }}>Measured against your own trajectory — small, consistent gains move this up.</div>
          </div>
        </Card>

        <Card style={{ padding: "20px" }}>
          <SH title="Score Breakdown" sub="Where you're strong and where to focus" />
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {SUBSCORE_META.map((m) => {
              const v = Math.round(health.sub[m.key]);
              const c = scoreColor(v);
              return (
                <div key={m.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 11.5, color: T2 }}>{m.label}</span>
                    <span style={{ fontSize: 11.5, color: c, fontFamily: "monospace", fontWeight: 700 }}>{v}</span>
                  </div>
                  <Meter pct={v} height={4} fill={`linear-gradient(90deg,${c}77,${c})`} />
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <Chip label="Monthly Income" value={fmtKES(health.monthlyIncome)} color={CY} />
        <Chip label="Monthly Expenses" value={fmtKES(health.monthlyExpenses)} color={OR_OR_AM(health)} />
        <Chip label="Net Cash Flow" value={fmtKES(health.netCashFlow)} color={health.netCashFlow >= 0 ? GR : RE} />
        <Chip label="Savings Rate" value={`${health.savingsRate.toFixed(0)}%`} color={health.savingsRate >= 15 ? GR : AM} />
        <Chip label="Emergency Buffer" value={`${health.emergencyMonths.toFixed(1)} mo`} color={health.emergencyMonths >= 3 ? GR : AM} />
      </div>

      <Card style={{ padding: "22px", borderColor: `${CY}22` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: analysis ? 16 : 0, gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Cpu size={16} color={CY} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: CY }}>KAHIRO — Financial Analysis</div>
              <div style={{ fontSize: 11, color: T3 }}>AI review of your habits, risks, and opportunities</div>
            </div>
          </div>
          {!loading && (
            <button onClick={generate} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", background: `linear-gradient(135deg,${CY}22,${PU}22)`, border: `1px solid ${CY}44`, borderRadius: 9, color: CY, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              <Activity size={13} />{analysis ? "Re-analyze" : "Generate Analysis"}
            </button>
          )}
          {loading && <div style={{ fontSize: 12, color: T2, display: "flex", gap: 5, alignItems: "center" }}><Cpu size={12} color={CY} />Analyzing…</div>}
        </div>
        {analysis && <div style={{ fontSize: 13, color: T2, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{analysis}</div>}
        {!analysis && !loading && (
          <div style={{ padding: "18px", textAlign: "center", color: T3, fontSize: 13 }}>Generate an AI analysis of your finances with practical, Kaizen-style next steps. (Requires your Anthropic key in Settings.)</div>
        )}
      </Card>
    </div>
  );
}

function OR_OR_AM(health) {
  return health.monthlyExpenses > health.monthlyIncome && health.monthlyIncome > 0 ? RE : AM;
}
