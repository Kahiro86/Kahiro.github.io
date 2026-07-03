import { useState } from "react";
import { Cpu, ArrowUp, ArrowDown } from "lucide-react";
import { BD, T1, T2, T3, GL, CY, PU, GR, RE, AM } from "../../shared/designTokens.js";
import { Card, SH, Chip } from "../../shared/ui.jsx";
import { callClaude } from "../../shared/anthropic.js";
import { PSYCH, GRADES } from "./constants.js";
import { getStats, gcol } from "./helpers.js";

export function TradingReports({ trades, balance }) {
  const [period, setPeriod] = useState("week");
  const [aiReport, setAiReport] = useState("");
  const [ldReport, setLdReport] = useState(false);

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
  const monthAgo = new Date(now); monthAgo.setDate(monthAgo.getDate() - 30);

  const getRange = (p) => {
    const cl = trades.filter((t) => t.status === "CLOSED");
    if (p === "today") return cl.filter((t) => t.date === todayStr);
    if (p === "week") return cl.filter((t) => new Date(t.createdAt) >= weekAgo);
    return cl.filter((t) => new Date(t.createdAt) >= monthAgo);
  };

  const periodTrades = getRange(period);
  const periodStats = getStats(periodTrades.map((t) => ({ ...t })));
  const prevTrades = period === "today" ? [] : period === "week"
    ? trades.filter((t) => t.status === "CLOSED" && new Date(t.createdAt) < weekAgo && new Date(t.createdAt) >= new Date(weekAgo.getTime() - 7 * 86400000))
    : trades.filter((t) => t.status === "CLOSED" && new Date(t.createdAt) < monthAgo && new Date(t.createdAt) >= new Date(monthAgo.getTime() - 30 * 86400000));
  const prevStats = getStats(prevTrades.map((t) => ({ ...t })));

  const psychBreak = PSYCH.map((p) => {
    const pt = periodTrades.filter((t) => t.psychologyTag === p);
    const pw = pt.filter((t) => t.outcome === "WIN" || t.outcome === "PARTIAL");
    return { tag: p, count: pt.length, wr: pt.length ? Math.round((pw.length / pt.length) * 100) : 0 };
  }).filter((p) => p.count > 0).sort((a, b) => b.count - a.count);

  const gradeBreak = GRADES.map((g) => ({
    grade: g,
    count: periodTrades.filter((t) => t.grade === g).length,
    color: gcol(g),
  })).filter((g) => g.count > 0);

  const generateReport = async () => {
    setLdReport(true); setAiReport("");
    try {
      const reply = await callClaude({
        system: `You are ARCHITECT — master ICT trading coach generating a performance report for Irisu (Nairobi). Use expert ICT methodology. Be direct, data-driven, specific. Format as a structured report with clear sections. Under 400 words total.`,
        messages: [{
          role: "user",
          content: `Generate a ${period} trading performance report:
PERIOD: ${period === "today" ? "Today" : period === "week" ? "Last 7 Days" : "Last 30 Days"}
TRADES: ${periodStats.total} total · ${periodStats.wins}W / ${periodStats.losses}L
WIN RATE: ${periodStats.wr}% (prev: ${prevStats.wr}%)
NET P&L: $${periodStats.totalPnl} (prev: $${prevStats.totalPnl})
PROFIT FACTOR: ${periodStats.pf} (prev: ${prevStats.pf})
AVG RR: ${periodStats.avgRR}R
GRADE DIST: ${gradeBreak.map((g) => `${g.grade}×${g.count}`).join(", ") || "none"}
PSYCH TAGS: ${psychBreak.slice(0, 5).map((p) => `${p.tag}(${p.count}, ${p.wr}%WR)`).join(", ") || "none"}
ACCOUNT BALANCE: $${balance.toLocaleString()}

Include: Performance verdict, what went right, what to fix, specific action items for next period.`,
        }],
        maxTokens: 1200,
      });
      setAiReport(reply || "Unable to generate report.");
    } catch (err) {
      setAiReport(`Error: ${err.message}`);
    } finally {
      setLdReport(false);
    }
  };

  const scorecards = [7, 30, 90].map((days) => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
    const pt = trades.filter((t) => t.status === "CLOSED" && new Date(t.createdAt) >= cutoff);
    const prevCutoff = new Date(cutoff); prevCutoff.setDate(prevCutoff.getDate() - days);
    const prevPt = trades.filter((t) => t.status === "CLOSED" && new Date(t.createdAt) >= prevCutoff && new Date(t.createdAt) < cutoff);
    const st = getStats(pt.map((t) => ({ ...t })));
    const pSt = getStats(prevPt.map((t) => ({ ...t })));
    return { days, ...st, prevWr: pSt.wr, prevPf: pSt.pf, prevPnl: pSt.totalPnl, prevRR: pSt.avgRR };
  });

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 22 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T1 }}>Reports & Scorecards</div>
          <div style={{ fontSize: 13, color: T3, marginTop: 3 }}>Period analysis · Rolling scorecards · ARCHITECT review</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {[{ v: "today", l: "Today" }, { v: "week", l: "7 Days" }, { v: "month", l: "30 Days" }].map((p) => (
            <button key={p.v} onClick={() => { setPeriod(p.v); setAiReport(""); }} style={{ padding: "7px 13px", borderRadius: 9, border: `1px solid ${period === p.v ? CY + "66" : BD}`, background: period === p.v ? `${CY}22` : GL, color: period === p.v ? CY : T2, fontSize: 12, fontWeight: period === p.v ? 700 : 400, cursor: "pointer", fontFamily: "inherit" }}>
              {p.l}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
        {[
          { l: "Trades",  v: periodStats.total, c: T2, delta: undefined },
          { l: "Win Rate",v: `${periodStats.wr}%`, c: periodStats.wr >= 60 ? GR : periodStats.wr >= 50 ? CY : AM, delta: periodStats.wr - prevStats.wr },
          { l: "Net P&L", v: `${periodStats.totalPnl >= 0 ? "+" : ""}$${periodStats.totalPnl}`, c: periodStats.totalPnl >= 0 ? GR : RE, delta: undefined },
          { l: "Prof. Factor", v: periodStats.pf || "—", c: +periodStats.pf >= 1.5 ? GR : +periodStats.pf >= 1 ? CY : RE, delta: periodStats.pf - prevStats.pf },
          { l: "Avg R:R",  v: periodStats.avgRR ? `${periodStats.avgRR}R` : "—", c: PU, delta: undefined },
        ].map((x) => <Chip key={x.l} label={x.l} value={x.v} color={x.c} delta={x.delta !== undefined && !isNaN(x.delta) && x.delta !== 0 ? Math.round(x.delta) : undefined} />)}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <Card style={{ padding: "20px" }}>
          <SH title="Grade Distribution" sub={`${period === "today" ? "Today" : period === "week" ? "Last 7 Days" : "Last 30 Days"}`} />
          {gradeBreak.length === 0
            ? <div style={{ fontSize: 13, color: T3, padding: "20px 0" }}>No graded trades in this period.</div>
            : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {gradeBreak.map((g) => (
                  <div key={g.grade} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, width: 28, padding: "2px 6px", borderRadius: 5, background: `${g.color}22`, color: g.color, border: `1px solid ${g.color}44`, textAlign: "center" }}>{g.grade}</span>
                    <div style={{ flex: 1, height: 5, background: BD, borderRadius: 3 }}>
                      <div style={{ height: "100%", width: `${(g.count / periodTrades.length) * 100}%`, background: `linear-gradient(90deg,${g.color}77,${g.color})`, borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 12, color: g.color, fontFamily: "monospace", fontWeight: 700, width: 20, textAlign: "right" }}>{g.count}</span>
                  </div>
                ))}
                <div style={{ marginTop: 8, padding: "10px 12px", background: GL, borderRadius: 9, fontSize: 12, color: T2 }}>
                  A/A+ trades: <strong style={{ color: GR }}>{gradeBreak.filter((g) => g.grade === "A+" || g.grade === "A").reduce((s, g) => s + g.count, 0)}</strong> / {periodTrades.length} ({Math.round(gradeBreak.filter((g) => g.grade === "A+" || g.grade === "A").reduce((s, g) => s + g.count, 0) / Math.max(periodTrades.length, 1) * 100)}%)
                  {" — "}{Math.round(gradeBreak.filter((g) => g.grade === "A+" || g.grade === "A").reduce((s, g) => s + g.count, 0) / Math.max(periodTrades.length, 1) * 100) >= 60
                    ? <span style={{ color: GR }}>target hit ✓</span>
                    : <span style={{ color: AM }}>target: 60%</span>}
                </div>
              </div>
            )}
        </Card>

        <Card style={{ padding: "20px" }}>
          <SH title="Psychology Breakdown" sub="Mental state frequency and win rate" />
          {psychBreak.length === 0
            ? <div style={{ fontSize: 13, color: T3, padding: "20px 0" }}>No tagged trades in this period.</div>
            : (
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {psychBreak.map((p) => {
                  const pos = ["Disciplined", "Patient", "Confident", "Process-Focused"].includes(p.tag);
                  return (
                    <div key={p.tag} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: GL, borderRadius: 9, border: `1px solid ${pos ? GR + "22" : p.wr < 40 ? RE + "22" : BD}` }}>
                      <span style={{ fontSize: 12, color: T1, fontWeight: 600, flex: 1 }}>{p.tag}</span>
                      <span style={{ fontSize: 11, color: T3 }}>{p.count}×</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: p.wr >= 60 ? GR : p.wr >= 50 ? CY : p.wr >= 40 ? AM : RE, fontFamily: "monospace", width: 36, textAlign: "right" }}>{p.wr}%</span>
                    </div>
                  );
                })}
              </div>
            )}
        </Card>
      </div>

      <Card style={{ padding: "22px", borderColor: `${CY}22` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: aiReport ? 16 : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Cpu size={16} color={CY} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: CY }}>ARCHITECT {period === "today" ? "Daily" : period === "week" ? "Weekly" : "Monthly"} Report</div>
              <div style={{ fontSize: 11, color: T3 }}>AI-generated performance analysis and action plan</div>
            </div>
          </div>
          {!ldReport && (
            <button onClick={generateReport} style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 16px", background: `linear-gradient(135deg,${CY}22,${PU}22)`, border: `1px solid ${CY}44`, borderRadius: 9, color: CY, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              <Cpu size={13} />{aiReport ? "Regenerate" : "Generate Report"}
            </button>
          )}
          {ldReport && <div style={{ fontSize: 12, color: T2, display: "flex", gap: 5, alignItems: "center" }}><Cpu size={12} color={CY} />Generating…</div>}
        </div>
        {aiReport && <div style={{ fontSize: 13, color: T2, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{aiReport}</div>}
        {!aiReport && !ldReport && (
          <div style={{ padding: "20px", textAlign: "center", color: T3, fontSize: 13 }}>
            Click "Generate Report" for an expert ICT analysis of your {period} performance.
          </div>
        )}
      </Card>

      <div>
        <div style={{ fontSize: 11, color: T3, letterSpacing: 3, marginBottom: 14, textTransform: "uppercase" }}>Rolling Performance Scorecards</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {scorecards.map((sc) => (
            <Card key={sc.days} style={{ padding: "20px", borderColor: sc.totalPnl >= 0 ? GR + "22" : RE + "22" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: T1 }}>{sc.days}-Day</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: sc.totalPnl >= 0 ? GR : RE, fontFamily: "monospace" }}>
                  {sc.totalPnl >= 0 ? "+" : ""}${sc.totalPnl.toLocaleString()}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { l: "Trades",  v: sc.total, prev: undefined, c: T2 },
                  { l: "Win Rate",v: `${sc.wr}%`, prev: sc.prevWr, c: sc.wr >= 60 ? GR : sc.wr >= 50 ? CY : AM },
                  { l: "Prof. Factor", v: sc.pf || "—", prev: sc.prevPf, c: +sc.pf >= 1.5 ? GR : +sc.pf >= 1 ? CY : RE },
                  { l: "Avg R:R", v: sc.avgRR ? `${sc.avgRR}R` : "—", prev: undefined, c: PU },
                ].map((x) => {
                  const delta = x.prev !== undefined && sc.total > 0 ? x.v.toString().replace(/[^0-9.-]/g, "") - x.prev : null;
                  return (
                    <div key={x.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: `1px solid ${BD}` }}>
                      <span style={{ fontSize: 12, color: T3 }}>{x.l}</span>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        {delta !== null && !isNaN(delta) && delta !== 0 && (
                          <span style={{ fontSize: 10, color: delta > 0 ? GR : RE, display: "flex", alignItems: "center", gap: 2 }}>
                            {delta > 0 ? <ArrowUp size={9} /> : <ArrowDown size={9} />}{Math.abs(Math.round(delta))}
                          </span>
                        )}
                        <span style={{ fontSize: 13, fontWeight: 700, color: x.c, fontFamily: "monospace" }}>{x.v}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
