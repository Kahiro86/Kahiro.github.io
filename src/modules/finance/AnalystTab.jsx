import { useState, useMemo } from "react";
import { Cpu, Activity, Compass, Check, AlertCircle, ArrowRight, MoonStar, TrendingDown, ShieldCheck, Sparkles, FileText } from "lucide-react";
import { B2, BD, GL, T1, T2, T3, CY, PU, GR, RE, AM } from "../../shared/designTokens.js";
import { useIdentity, ownerRef } from "../../shared/identity.jsx";
import { Card, SH, Chip, Meter } from "../../shared/ui.jsx";
import { useStorageState } from "../../shared/useStorageState.js";
import { DEFAULT_FINANCE_STATE } from "./constants.js";
import { crossModulePatterns } from "./patterns.js";
import { callClaude } from "../../shared/anthropic.js";
import { KAIZEN_COACH_PREAMBLE } from "../../shared/kaizen.js";
import { SUBSCORE_META } from "./financeHealth.js";
import { financeNarrative } from "./coach.js";
import { DoctrineTab } from "./DoctrineTab.jsx";

const scoreColor = (n) => (n >= 80 ? GR : n >= 65 ? CY : n >= 50 ? AM : RE);

export function AnalystTab({ health, fmtKES, bySource, budgets, monthlyPassive, trajStats, doctrine, setDoctrine, freedom }) {
  const { appName, ownerName } = useIdentity();
  const owner = ownerRef(ownerName);
  const coach = financeNarrative(health, trajStats, doctrine, freedom, fmtKES, budgets);
  // Cross-module signals live in other stores; read them here for the pattern engine.
  const [purity] = useStorageState("purity_log", {});
  const [sleep] = useStorageState("trade_sleep", {});
  const [snapshots] = useStorageState("finance_snapshots", []);
  const [tiTrades] = useStorageState("ti_trades", []);
  const [tiAccounts] = useStorageState("ti_accounts", []);
  const [firmConfig] = useStorageState("firm_config", null);
  const [financeState] = useStorageState("finance_state", DEFAULT_FINANCE_STATE);
  const patterns = useMemo(
    () => crossModulePatterns({ purity, sleep, snapshots, tiTrades, tiAccounts, income: financeState?.income, firmConfig }),
    [purity, sleep, snapshots, tiTrades, tiAccounts, financeState, firmConfig]
  );
  const [analysis, setAnalysis] = useState("");
  const [loading, setLoading] = useState(false);
  const col = scoreColor(health.overall);

  const generate = async () => {
    setLoading(true); setAnalysis("");
    try {
      const srcLine = bySource.length ? bySource.map((s) => `${s.source} ${Math.round(s.pct)}%`).join(", ") : "none logged";
      const overBudget = budgets.filter((b) => +b.spent > +b.budget && +b.budget > 0).map((b) => b.cat);
      const reply = await callClaude({
        system: `You are ${appName} — a Kaizen personal-finance analyst for ${owner} (Nairobi, Kenya; KES). ${KAIZEN_COACH_PREAMBLE}
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

      {/* ── PATTERNS — cross-module correlations, each citing a Law ── */}
      {patterns.length > 0 && (() => {
        const TONE = { bad: RE, warn: AM, good: GR };
        const ICON = { sleep_breach: MoonStar, savings_trend: TrendingDown, fleet_risk: ShieldCheck, more_data: FileText };
        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <SH title="Patterns" sub="Cross-module correlations — the thing no single tab can see" action={<Sparkles size={13} color={AM} />} />
            {patterns.map((p) => {
              const c = TONE[p.tone] || AM;
              const Icon = ICON[p.id] || Activity;
              if (p.isGate) {
                return (
                  <Card key={p.id} style={{ padding: "14px 16px", borderColor: `${AM}33` }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T1, marginBottom: 4 }}>{p.title}</div>
                    <div style={{ fontSize: 11.5, color: T2, lineHeight: 1.6 }}>{p.detail}</div>
                  </Card>
                );
              }
              return (
                <div key={p.id} style={{ position: "relative", overflow: "hidden", background: B2, border: `1px solid ${BD}`, borderRadius: 13, padding: "13px 15px 13px 17px" }}>
                  <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: c }} />
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7 }}>
                    <Icon size={15} color={c} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: T1, flex: 1 }}>{p.title}</span>
                    <span style={{ fontSize: 8, letterSpacing: 0.5, textTransform: "uppercase", color: T3, border: `1px solid ${BD}`, padding: "2px 6px", borderRadius: 5 }}>{p.tag}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: T2, lineHeight: 1.6 }}>{p.detail}</div>
                  {p.bars && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
                      {p.bars.map((b, i) => (
                        <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 9, alignItems: "center" }}>
                          <span style={{ fontSize: 10.5, color: T3, minWidth: 42 }}>{b.l}</span>
                          <Meter pct={b.v} height={14} color={i === 0 ? AM : `${AM}88`} />
                          <span style={{ fontSize: 10.5, color: T2, fontFamily: "monospace" }}>~{b.v}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {p.law && (
                    <div style={{ fontSize: 10, color: AM, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${GL}`, display: "flex", alignItems: "center", gap: 5 }}>
                      <FileText size={11} />{p.law}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ── YOUR COACH — always-on, reads your trajectory + principles ── */}
      <Card style={{ padding: "20px 22px", borderColor: `${col}33`, background: `linear-gradient(120deg,${col}0C,transparent)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
          <Compass size={15} color={col} />
          <div style={{ fontSize: 14, fontWeight: 800, color: T1 }}>Your Coach</div>
          <span style={{ fontSize: 15, fontWeight: 800, color: col }}>· {coach.verdict}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 }}>
          {coach.wins.length > 0 && (
            <div>
              <div style={{ fontSize: 9.5, color: GR, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, marginBottom: 7 }}>What's working</div>
              {coach.wins.map((w, i) => (
                <div key={i} style={{ display: "flex", gap: 7, marginBottom: 6, fontSize: 12, color: T2, lineHeight: 1.5 }}><Check size={13} color={GR} style={{ flexShrink: 0, marginTop: 2 }} />{w}</div>
              ))}
            </div>
          )}
          {coach.watch.length > 0 && (
            <div>
              <div style={{ fontSize: 9.5, color: AM, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, marginBottom: 7 }}>What to watch</div>
              {coach.watch.slice(0, 3).map((w, i) => (
                <div key={i} style={{ display: "flex", gap: 7, marginBottom: 6, fontSize: 12, color: T2, lineHeight: 1.5 }}><AlertCircle size={13} color={AM} style={{ flexShrink: 0, marginTop: 2 }} />{w}</div>
              ))}
            </div>
          )}
        </div>
        {coach.creed.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 13, borderTop: `1px solid ${BD}` }}>
            <div style={{ fontSize: 9.5, color: PU, letterSpacing: 1, textTransform: "uppercase", fontWeight: 700, marginBottom: 7 }}>Your principles, measured</div>
            {coach.creed.map((c, i) => (
              <div key={i} style={{ display: "flex", gap: 7, marginBottom: 5, fontSize: 12, color: c.ok ? T1 : T2, lineHeight: 1.5 }}>
                <span style={{ color: c.ok ? GR : AM, flexShrink: 0 }}>{c.ok ? "✓" : "○"}</span>{c.text}
              </div>
            ))}
          </div>
        )}
        <div style={{ marginTop: 14, padding: "11px 14px", background: `${col}12`, border: `1px solid ${col}33`, borderRadius: 10, display: "flex", gap: 9, alignItems: "center" }}>
          <ArrowRight size={14} color={col} style={{ flexShrink: 0 }} />
          <div><span style={{ fontSize: 10, color: T3, letterSpacing: 1, textTransform: "uppercase", marginRight: 7 }}>This week</span><span style={{ fontSize: 12.5, color: T1, fontWeight: 600 }}>{coach.step}</span></div>
        </div>
      </Card>

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
              <div style={{ fontSize: 14, fontWeight: 700, color: CY }}>{appName} — Financial Analysis</div>
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

      {/* ── YOUR MONEY DOCTRINE — the identity layer, dissolved in here ── */}
      <div style={{ borderTop: `1px solid ${BD}`, paddingTop: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <Compass size={16} color={PU} />
          <div style={{ fontSize: 18, fontWeight: 800, color: T1 }}>Your Money Doctrine</div>
        </div>
        <div style={{ fontSize: 12.5, color: T3, marginTop: 4 }}>The identity behind the numbers — your why, the principles you're measured against above, and the values every shilling serves.</div>
      </div>
      <DoctrineTab doctrine={doctrine} setDoctrine={setDoctrine} freedom={freedom} fmtKES={fmtKES} embedded />
    </div>
  );
}

function OR_OR_AM(health) {
  return health.monthlyExpenses > health.monthlyIncome && health.monthlyIncome > 0 ? RE : AM;
}
