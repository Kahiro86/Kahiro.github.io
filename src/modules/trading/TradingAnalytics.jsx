import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { B2, BD, BD2, T1, T2, T3, GL, CY, PU, GR, RE, AM } from "../../shared/designTokens.js";
import { Card, SH, Chip } from "../../shared/ui.jsx";
import { mkTT } from "../../shared/ChartTooltip.jsx";
import { SESSION_CONFIG, ICT_MODELS, GRADES, PSYCH } from "./constants.js";
import { calcPnl, getStats, gcol } from "./helpers.js";

export function TradingAnalytics({ trades, balance }) {
  const cl = trades.filter((t) => t.status === "CLOSED");
  const stats = getStats(trades);

  let run = balance;
  const equity = [...cl]
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((t) => { run += calcPnl(t); return { date: (t.date || "").slice(5), bal: Math.round(run) }; });

  const sessData = SESSION_CONFIG.map((s) => {
    const st = cl.filter((t) => t.session === s.label);
    const sw = st.filter((t) => t.outcome === "WIN" || t.outcome === "PARTIAL");
    return { name: s.label.substring(0, 12), trades: st.length, wr: st.length ? Math.round((sw.length / st.length) * 100) : 0 };
  }).filter((s) => s.trades > 0);

  const modData = ICT_MODELS.map((mm) => {
    const mt = cl.filter((t) => (t.models || []).includes(mm));
    const mw = mt.filter((t) => t.outcome === "WIN" || t.outcome === "PARTIAL");
    return { name: mm.split("(")[0].trim(), full: mm, trades: mt.length, wr: mt.length ? Math.round((mw.length / mt.length) * 100) : 0 };
  }).filter((m) => m.trades > 0).sort((a, b) => b.wr - a.wr);

  const gradeData = GRADES.map((g) => {
    const gt = cl.filter((t) => t.grade === g);
    const gw = gt.filter((t) => t.outcome === "WIN" || t.outcome === "PARTIAL");
    return { grade: g, trades: gt.length, wr: gt.length ? Math.round((gw.length / gt.length) * 100) : 0, color: gcol(g) };
  }).filter((g) => g.trades > 0);

  const psychData = PSYCH.map((p) => {
    const pt = cl.filter((t) => t.psychologyTag === p);
    const pw = pt.filter((t) => t.outcome === "WIN" || t.outcome === "PARTIAL");
    return { tag: p, trades: pt.length, wr: pt.length ? Math.round((pw.length / pt.length) * 100) : 0 };
  }).filter((p) => p.trades > 0).sort((a, b) => b.trades - a.trades);

  const macroTrades = cl.filter((t) => t.ictMacro && t.ictMacro !== "");
  const macroWins = macroTrades.filter((t) => t.outcome === "WIN" || t.outcome === "PARTIAL");
  const nonMacro = cl.filter((t) => !t.ictMacro || t.ictMacro === "");
  const nonMacroWins = nonMacro.filter((t) => t.outcome === "WIN" || t.outcome === "PARTIAL");

  return (
    <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 11 }}>
        <Chip label="Total Trades"  value={stats.total}     color={T2} />
        <Chip label="Win Rate"      value={`${stats.wr}%`}  color={stats.wr >= 60 ? GR : stats.wr >= 50 ? CY : AM} />
        <Chip label="Profit Factor" value={stats.pf}        color={+stats.pf >= 1.5 ? GR : +stats.pf >= 1 ? CY : RE} />
        <Chip label="Avg Win"       value={`$${stats.avgWin}`} color={GR} />
        <Chip label="Net P&L"       value={`${stats.totalPnl >= 0 ? "+" : ""}$${stats.totalPnl}`} color={stats.totalPnl >= 0 ? GR : RE} />
        <Chip label="Avg R:R (W)"   value={`${stats.avgRR}R`} color={PU} />
      </div>

      {(macroTrades.length > 0 || nonMacro.length > 0) && (
        <Card style={{ padding: "18px" }}>
          <SH title="ICT Macro Edge" sub="Win rate inside vs outside macro windows — your highest probability windows" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {[
              { label: "Inside ICT Macro", data: macroTrades, wins: macroWins, color: GR },
              { label: "Outside Macro",    data: nonMacro,    wins: nonMacroWins, color: AM },
            ].map((x) => (
              <div key={x.label} style={{ padding: "14px", background: GL, border: `1px solid ${BD}`, borderRadius: 12 }}>
                <div style={{ fontSize: 12, color: T2, marginBottom: 9 }}>{x.label}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: x.color, fontFamily: "monospace", marginBottom: 6 }}>
                  {x.data.length ? Math.round((x.wins.length / x.data.length) * 100) : 0}%
                </div>
                <div style={{ fontSize: 11, color: T3 }}>{x.wins.length}W / {x.data.length - x.wins.length}L · {x.data.length} trades</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {equity.length > 1 && (
        <Card style={{ padding: "18px" }}>
          <SH title="Equity Curve" sub={`Running from $${balance.toLocaleString()} baseline`} />
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={equity} margin={{ top: 0, right: 0, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="eqG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GR} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={GR} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={BD} />
              <XAxis dataKey="date" stroke={T3} fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke={T3} fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} />
              <Tooltip content={mkTT("$")} />
              <Area type="monotone" dataKey="bal" stroke={GR} strokeWidth={2.5} fill="url(#eqG)" dot={false} activeDot={{ r: 5, fill: GR, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        {sessData.length > 0 && (
          <Card style={{ padding: "18px" }}>
            <SH title="Win Rate by Session" sub="Where your ICT edge is strongest" />
            <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
              {sessData.map((s) => (
                <div key={s.name}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: T2 }}>{s.name}</span>
                    <div style={{ display: "flex", gap: 10 }}>
                      <span style={{ fontSize: 10.5, color: T3 }}>{s.trades}t</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: s.wr >= 60 ? GR : s.wr >= 50 ? CY : AM, fontFamily: "monospace" }}>{s.wr}%</span>
                    </div>
                  </div>
                  <div style={{ height: 4, background: BD, borderRadius: 3 }}>
                    <div style={{ height: "100%", width: `${s.wr}%`, background: s.wr >= 60 ? GR : s.wr >= 50 ? CY : AM, borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {gradeData.length > 0 && (
          <Card style={{ padding: "18px" }}>
            <SH title="Win Rate by Setup Grade" sub="Grade calibration check" />
            <ResponsiveContainer width="100%" height={165}>
              <BarChart data={gradeData} margin={{ top: 0, right: 0, bottom: 0, left: -22 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={BD} />
                <XAxis dataKey="grade" stroke={T3} fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke={T3} fontSize={11} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                <Tooltip content={({ active, payload }) =>
                  active && payload?.length
                    ? <div style={{ background: B2, border: `1px solid ${BD2}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: T1 }}>{payload[0].value}% win rate</div>
                    : null
                } />
                <Bar dataKey="wr" radius={[5, 5, 0, 0]}>
                  {gradeData.map((g, i) => <Cell key={i} fill={g.color} fillOpacity={0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        )}
      </div>

      {modData.length > 0 && (
        <Card style={{ padding: "18px" }}>
          <SH title="ICT Model Performance" sub="Win rate by setup type — discover your highest edge models" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 9 }}>
            {modData.map((mm) => (
              <div key={mm.name} style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", background: GL, borderRadius: 10, border: `1px solid ${BD}` }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: T1, marginBottom: 4 }}>{mm.full.split("(")[0].trim()}</div>
                  <div style={{ height: 3, background: BD, borderRadius: 2 }}>
                    <div style={{ height: "100%", width: `${mm.wr}%`, background: mm.wr >= 60 ? GR : mm.wr >= 50 ? CY : AM, borderRadius: 2 }} />
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: mm.wr >= 60 ? GR : mm.wr >= 50 ? CY : AM, fontFamily: "monospace" }}>{mm.wr}%</div>
                  <div style={{ fontSize: 10, color: T3 }}>{mm.trades}t</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {psychData.length > 0 && (
        <Card style={{ padding: "18px" }}>
          <SH title="Psychology Performance Map" sub="Win rate by mental state — edge and leaks" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 9 }}>
            {psychData.map((p) => {
              const pos = ["Disciplined", "Patient", "Confident", "Process-Focused"].includes(p.tag);
              return (
                <div key={p.tag} style={{ padding: "12px", background: GL, border: `1px solid ${pos ? GR + "33" : p.wr < 40 ? RE + "33" : BD}`, borderRadius: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: T1, fontWeight: 600 }}>{p.tag}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: p.wr >= 60 ? GR : p.wr >= 50 ? CY : p.wr >= 40 ? AM : RE, fontFamily: "monospace" }}>{p.wr}%</span>
                  </div>
                  <div style={{ height: 3, background: BD, borderRadius: 2, marginBottom: 5 }}>
                    <div style={{ height: "100%", width: `${p.wr}%`, background: p.wr >= 60 ? GR : p.wr >= 50 ? CY : RE, borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: 10, color: T3 }}>{p.trades} trades</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
