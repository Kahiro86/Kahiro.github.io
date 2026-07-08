import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Cpu, FileText, ArrowUp, ArrowDown } from "lucide-react";
import { BD, GL, T1, T2, T3, CY, PU, GR, RE, AM } from "../../shared/designTokens.js";
import { Card, SH, Chip } from "../../shared/ui.jsx";
import { DonutChart, ChartLegend } from "../../shared/charts.jsx";
import { mkTT } from "../../shared/ChartTooltip.jsx";
import { callClaude } from "../../shared/anthropic.js";
import { KAIZEN_COACH_PREAMBLE } from "../../shared/kaizen.js";
import { ym, monthKey, monthLabel } from "./income.js";
import { calcPnl } from "../trading/helpers.js";
import { sourceColor } from "./constants.js";

const PERIODS = [
  { id: "month", l: "Monthly", months: 1 },
  { id: "quarter", l: "Quarterly", months: 3 },
  { id: "half", l: "Half-Year", months: 6 },
  { id: "year", l: "Annual", months: 12 },
];

function monthKeysBack(n, offset = 0) {
  const keys = [];
  const now = new Date();
  for (let i = n - 1 + offset; i >= offset; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push({ key: ym(d), label: d.toLocaleString("en-US", { month: "short" }) });
  }
  return keys;
}

export function FinanceReports({ income, incomeStats, health, fmtKES, budgets, totalSpent, efBal, savBal, totalInvested, monthlyPassive, personalDebt, trades, tradingStats }) {
  const [period, setPeriod] = useState("month");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);
  const cfg = PERIODS.find((p) => p.id === period);
  const N = cfg.months;

  const cur = monthKeysBack(N);
  const prev = monthKeysBack(N, N);
  const curKeys = new Set(cur.map((m) => m.key));
  const prevKeys = new Set(prev.map((m) => m.key));

  const sumIncome = (keys) => (income || []).filter((e) => keys.has(monthKey(e.date))).reduce((s, e) => s + (+e.amount || 0), 0);
  const periodIncome = sumIncome(curKeys);
  const prevIncome = sumIncome(prevKeys);
  const incomeGrowth = prevIncome > 0 ? ((periodIncome - prevIncome) / prevIncome) * 100 : periodIncome > 0 ? 100 : 0;

  // Expenses estimated from current monthly budget spend (no expense ledger yet).
  const expensesEst = (+totalSpent || 0) * N;
  const netCashFlow = periodIncome - expensesEst;

  // Trading within the window (by trade date).
  const startDate = cur.length ? `${cur[0].key}-01` : ym(new Date()) + "-01";
  const periodTrades = (trades || []).filter((t) => t.status === "CLOSED" && (t.date || "") >= startDate);
  const prevStart = prev.length ? `${prev[0].key}-01` : startDate;
  const prevTrades = (trades || []).filter((t) => t.status === "CLOSED" && (t.date || "") >= prevStart && (t.date || "") < startDate);
  const tradePnl = periodTrades.reduce((s, t) => s + calcPnl(t), 0);
  const prevTradePnl = prevTrades.reduce((s, t) => s + calcPnl(t), 0);

  // Income by source within the window.
  const srcMap = {};
  (income || []).filter((e) => curKeys.has(monthKey(e.date))).forEach((e) => { srcMap[e.source || "Other"] = (srcMap[e.source || "Other"] || 0) + (+e.amount || 0); });
  const bySource = Object.entries(srcMap).map(([source, total]) => ({ source, total })).sort((a, b) => b.total - a.total);
  const pieData = bySource.map((s) => ({ name: s.source, value: s.total, color: sourceColor(s.source) }));
  const bestSource = bySource[0];

  const trend = cur.map((m) => ({ label: m.label, income: incomeStats.byMonth?.[m.key] || 0 }));

  const generate = async () => {
    setLoading(true); setSummary("");
    try {
      const reply = await callClaude({
        system: `You are KAHIRO — a Kaizen personal-finance analyst for Irisu (Nairobi, KES). ${KAIZEN_COACH_PREAMBLE}
Write a concise ${cfg.l} financial report. Sections: Executive summary · Income · Cash flow · What improved vs the previous period · Risks/watch-outs · Recommendations for next period (each a small, achievable step). Under 380 words. Measure against the prior period, never other people.`,
        messages: [{
          role: "user",
          content: `${cfg.l} report data (KES):
Window: last ${N} month(s)
Income this period: ${Math.round(periodIncome)} (prev: ${Math.round(prevIncome)}, ${incomeGrowth >= 0 ? "+" : ""}${incomeGrowth.toFixed(1)}%)
Estimated expenses: ${Math.round(expensesEst)} · Net cash flow: ${Math.round(netCashFlow)}
Best income source: ${bestSource ? `${bestSource.source} (${fmtKES(bestSource.total)})` : "none"}
Income sources: ${bySource.map((s) => s.source).join(", ") || "none"}
Trading P&L: ${tradePnl} (prev ${prevTradePnl}) · Win rate ${tradingStats?.wr || 0}%
Savings snapshot: ${Math.round((+efBal || 0) + (+savBal || 0))} · Invested: ${Math.round(totalInvested)} · Monthly passive: ${Math.round(monthlyPassive)} · Debt: ${Math.round(personalDebt)}
Financial health score: ${health.overall}/100 (${health.band})`,
        }],
        maxTokens: 1200,
      });
      setSummary(reply || "No summary returned.");
    } catch (err) {
      setSummary(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const Delta = ({ v }) => (v !== 0 && isFinite(v) ? (
    <span style={{ fontSize: 11, color: v > 0 ? GR : RE, display: "inline-flex", alignItems: "center", gap: 2 }}>
      {v > 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />}{Math.abs(Math.round(v))}%
    </span>
  ) : null);

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T1 }}>Financial Reports</div>
          <div style={{ fontSize: 13, color: T3, marginTop: 3 }}>Automated {cfg.l.toLowerCase()} overview · trends · comparisons · AI summary</div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PERIODS.map((p) => (
            <button key={p.id} onClick={() => { setPeriod(p.id); setSummary(""); }} style={{ padding: "7px 13px", borderRadius: 9, border: `1px solid ${period === p.id ? CY + "66" : BD}`, background: period === p.id ? `${CY}22` : GL, color: period === p.id ? CY : T2, fontSize: 12, fontWeight: period === p.id ? 700 : 400, cursor: "pointer", fontFamily: "inherit" }}>
              {p.l}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <Chip label={`Income (${N}mo)`} value={fmtKES(periodIncome)} color={CY} delta={incomeGrowth !== 0 && isFinite(incomeGrowth) ? Math.round(incomeGrowth) : undefined} />
        <Chip label="Est. Expenses" value={fmtKES(expensesEst)} color={AM} />
        <Chip label="Net Cash Flow" value={fmtKES(netCashFlow)} color={netCashFlow >= 0 ? GR : RE} />
        <Chip label="Trading P&L" value={`${tradePnl >= 0 ? "+" : ""}$${tradePnl.toLocaleString()}`} color={tradePnl >= 0 ? GR : RE} />
        <Chip label="Health Score" value={`${health.overall}`} color={health.overall >= 65 ? GR : health.overall >= 50 ? AM : RE} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
        <Card style={{ padding: "18px" }}>
          <SH title="Income Over Period" sub={`Monthly income across the last ${N} month(s)`} />
          {periodIncome > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={trend} margin={{ top: 4, right: 0, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={BD} />
                <XAxis dataKey="label" stroke={T3} fontSize={10.5} tickLine={false} axisLine={false} />
                <YAxis stroke={T3} fontSize={10.5} tickLine={false} axisLine={false} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                <Tooltip content={mkTT("KES ")} />
                <Bar dataKey="income" radius={[5, 5, 0, 0]} fill={CY} fillOpacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ padding: "50px 0", textAlign: "center", color: T3, fontSize: 13 }}>No income logged in this period.</div>
          )}
        </Card>

        <Card style={{ padding: "18px" }}>
          <SH title="Income Breakdown" sub="Best-performing source this period" action={bestSource ? <span style={{ fontSize: 11, color: GR }}>★ {bestSource.source}</span> : null} />
          {pieData.length > 0 ? (
            <>
              <DonutChart data={pieData} height={190} centerLabel={bySource.length} centerSub="Sources" />
              <ChartLegend data={pieData} fmt={(v) => fmtKES(v)} />
            </>
          ) : (
            <div style={{ padding: "50px 0", textAlign: "center", color: T3, fontSize: 13 }}>No income sources this period.</div>
          )}
        </Card>
      </div>

      <Card style={{ padding: "20px" }}>
        <SH title="Period Comparison" sub="This period vs the previous equivalent period" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
          {[
            { l: "Income", now: periodIncome, prev: prevIncome, money: true },
            { l: "Trading P&L", now: tradePnl, prev: prevTradePnl, money: false },
          ].map((x) => {
            const delta = x.prev !== 0 ? ((x.now - x.prev) / Math.abs(x.prev)) * 100 : x.now !== 0 ? 100 : 0;
            return (
              <div key={x.l} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 11, padding: "14px" }}>
                <div style={{ fontSize: 10, color: T3, letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>{x.l}</div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: T1, fontFamily: "monospace" }}>{x.money ? fmtKES(x.now) : `${x.now >= 0 ? "+" : ""}$${x.now.toLocaleString()}`}</div>
                  <Delta v={delta} />
                </div>
                <div style={{ fontSize: 10.5, color: T3, marginTop: 3 }}>prev: {x.money ? fmtKES(x.prev) : `$${x.prev.toLocaleString()}`}</div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card style={{ padding: "22px", borderColor: `${CY}22` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: summary ? 16 : 0, gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Cpu size={16} color={CY} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: CY }}>KAHIRO {cfg.l} Executive Summary</div>
              <div style={{ fontSize: 11, color: T3 }}>AI-generated report with Kaizen recommendations</div>
            </div>
          </div>
          {!loading && (
            <button onClick={generate} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", background: `linear-gradient(135deg,${CY}22,${PU}22)`, border: `1px solid ${CY}44`, borderRadius: 9, color: CY, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              <FileText size={13} />{summary ? "Regenerate" : "Generate Report"}
            </button>
          )}
          {loading && <div style={{ fontSize: 12, color: T2, display: "flex", gap: 5, alignItems: "center" }}><Cpu size={12} color={CY} />Generating…</div>}
        </div>
        {summary && <div style={{ fontSize: 13, color: T2, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{summary}</div>}
        {!summary && !loading && (
          <div style={{ padding: "18px", textAlign: "center", color: T3, fontSize: 13 }}>Generate an AI {cfg.l.toLowerCase()} report. (Requires your Anthropic key in Settings.)</div>
        )}
      </Card>

      <div style={{ fontSize: 10.5, color: T3, lineHeight: 1.6 }}>
        Income and trading figures are computed from your logged entries. Expenses are estimated from your current monthly budget spend × {N} — add per-transaction expenses later for exact multi-month expense history.
      </div>
    </div>
  );
}
