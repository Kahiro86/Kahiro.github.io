// ── Analytics — the research engine ──────────────────────────────────
// Turns the journal into evidence: overall performance, an equity/drawdown
// curve, and ranked breakdowns by strategy / pair / session / condition /
// confluence / mistake, plus a psychology correlation. Every number derives
// from closed trades — nothing can be edited into existence.
import { useMemo, useState } from "react";
import { BD, T1, T2, T3, GL, GR, RE, AM, CY } from "../../../shared/designTokens.js";
import { Card, Chip, Empty } from "../../../shared/ui.jsx";
import { AK } from "./fields.jsx";
import {
  overallStats, equityCurve, byStrategy, byPair, bySession, byCondition, byConfluence, byMistake,
  psychCorrelation, fmtMoney,
} from "./tradingIntel.js";

const pf = (v) => (v === Infinity ? "∞" : v || "—");
const min2 = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

function EquityCurve({ points, maxDD }) {
  if (points.length < 2) return null;
  const w = 640, h = 150, pad = 6;
  const ys = points.map((p) => p.equity);
  const min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1;
  const x = (i) => pad + (i / (points.length - 1)) * (w - pad * 2);
  const y = (v) => pad + (1 - (v - min) / span) * (h - pad * 2);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.equity).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${h - pad} L${x(0).toFixed(1)},${h - pad} Z`;
  const up = points[points.length - 1].equity >= points[0].equity;
  const col = up ? GR : RE;
  return (
    <div style={{ width: "100%", overflow: "hidden" }}>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{ display: "block" }}>
        <defs><linearGradient id="eqg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={col} stopOpacity="0.25" /><stop offset="100%" stopColor={col} stopOpacity="0" /></linearGradient></defs>
        <path d={area} fill="url(#eqg)" />
        <path d={line} fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round" />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: T3, marginTop: 4 }}>
        <span>Start {fmtMoney(points[0].equity)}</span>
        <span style={{ color: AM }}>Max drawdown {fmtMoney(maxDD)}</span>
        <span style={{ color: col }}>Now {fmtMoney(points[points.length - 1].equity)}</span>
      </div>
    </div>
  );
}

function BreakdownTable({ rows, unit }) {
  if (!rows.length) return <div style={{ fontSize: 11.5, color: T3, padding: "6px 2px" }}>Not enough closed trades yet.</div>;
  const maxNet = Math.max(1, ...rows.map((r) => Math.abs(r.net)));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 0.7fr 0.7fr 0.7fr 1.2fr", gap: 8, fontSize: 8.5, color: T3, letterSpacing: 0.6, textTransform: "uppercase", padding: "0 2px" }}>
        <span>{unit}</span><span style={{ textAlign: "right" }}>WR</span><span style={{ textAlign: "right" }}>Avg R</span><span style={{ textAlign: "right" }}>n</span><span style={{ textAlign: "right" }}>Net</span>
      </div>
      {rows.map((r) => (
        <div key={r.key} style={{ display: "grid", gridTemplateColumns: "1.6fr 0.7fr 0.7fr 0.7fr 1.2fr", gap: 8, alignItems: "center", padding: "6px 8px", background: GL, borderRadius: 8, position: "relative", overflow: "hidden" }}>
          <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${(Math.abs(r.net) / maxNet) * 100}%`, background: r.net >= 0 ? `${GR}12` : `${RE}12`, zIndex: 0 }} />
          <span style={{ fontSize: 11.5, color: T1, fontWeight: 600, zIndex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.key}</span>
          <span style={{ fontSize: 11.5, textAlign: "right", color: r.wr >= 50 ? GR : T2, fontFamily: "monospace", zIndex: 1 }}>{r.wr}%</span>
          <span style={{ fontSize: 11.5, textAlign: "right", color: r.avgRR >= 1 ? AK : T2, fontFamily: "monospace", zIndex: 1 }}>{r.avgRR || "—"}</span>
          <span style={{ fontSize: 11, textAlign: "right", color: T3, fontFamily: "monospace", zIndex: 1 }}>{r.sample}</span>
          <span style={{ fontSize: 11.5, textAlign: "right", color: r.net >= 0 ? GR : RE, fontFamily: "monospace", fontWeight: 700, zIndex: 1 }}>{r.net >= 0 ? "+" : ""}{fmtMoney(r.net)}</span>
        </div>
      ))}
    </div>
  );
}

const DIMS = [
  { id: "strategy", l: "Strategy" }, { id: "pair", l: "Pair" }, { id: "session", l: "Session" },
  { id: "condition", l: "Condition" }, { id: "confluence", l: "Confluence" }, { id: "mistake", l: "Mistake" },
];

export function IntelAnalytics({ trades, accounts, activeId }) {
  const [scope, setScope] = useState("active");
  const [dim, setDim] = useState("strategy");
  const accId = scope === "active" ? activeId : "";
  const acct = accounts.find((a) => a.id === activeId);
  const base = scope === "active" && acct ? acct.startBalance : accounts.reduce((s, a) => s + a.startBalance, 0);

  const o = useMemo(() => overallStats(trades, accId), [trades, accId]);
  const eq = useMemo(() => equityCurve(trades, base, accId), [trades, base, accId]);
  const rows = useMemo(() => {
    const fn = { strategy: byStrategy, pair: byPair, session: bySession, condition: byCondition, confluence: byConfluence, mistake: byMistake }[dim];
    return fn(trades, { accountId: accId });
  }, [trades, dim, accId]);
  const psych = useMemo(() => psychCorrelation(trades, accId), [trades, accId]);

  const pill = (on) => ({ padding: "6px 12px", borderRadius: 8, border: `1px solid ${on ? AK + "55" : BD}`, background: on ? `${AK}1a` : GL, color: on ? "#FFFFFF" : T2, fontSize: 11.5, fontWeight: on ? 700 : 500, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" });

  return (
    <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 15, maxWidth: 960 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T1 }}>Analytics</div>
          <div style={{ fontSize: 12, color: T3, marginTop: 2 }}>Where your edge is — and isn't.</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setScope("active")} style={pill(scope === "active")}>Active</button>
          <button onClick={() => setScope("all")} style={pill(scope === "all")}>All accounts</button>
        </div>
      </div>

      {o.count === 0 ? (
        <Empty icon="📊" title="No closed trades yet" sub="Log and close trades and this becomes a research dashboard — win rate, expectancy, and which strategies, pairs, sessions and confluences actually carry your edge." />
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 9 }}>
            <Chip label="Win rate" value={`${o.wr}%`} color={CY} />
            <Chip label="Avg RR" value={o.avgRR ? `${o.avgRR}R` : "—"} color={AM} />
            <Chip label="Expectancy" value={fmtMoney(o.expectancy)} color={o.expectancy >= 0 ? GR : RE} />
            <Chip label="Profit factor" value={pf(o.profitFactor)} color={AK} />
            <Chip label="Net PnL" value={fmtMoney(o.net)} color={o.net >= 0 ? GR : RE} />
            <Chip label="Trades" value={String(o.count)} color={T1} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 9 }}>
            <Chip label="Avg win" value={fmtMoney(o.avgWin)} color={GR} />
            <Chip label="Avg loss" value={fmtMoney(o.avgLoss)} color={RE} />
            <Chip label="Largest win" value={fmtMoney(o.largestWin)} color={GR} />
            <Chip label="Largest loss" value={fmtMoney(o.largestLoss)} color={RE} />
            <Chip label="Avg hold" value={o.avgHold ? min2(o.avgHold) : "—"} color={T2} />
          </div>

          <Card style={{ padding: "15px 17px" }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: T1, marginBottom: 10 }}>Equity curve</div>
            <EquityCurve points={eq.points} maxDD={eq.maxDD} />
          </Card>

          <Card style={{ padding: "15px 17px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T1 }}>Breakdown</div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>{DIMS.map((d) => <button key={d.id} onClick={() => setDim(d.id)} style={pill(dim === d.id)}>{d.l}</button>)}</div>
            </div>
            <BreakdownTable rows={rows} unit={DIMS.find((d) => d.id === dim).l} />
          </Card>

          {psych.length > 0 && (
            <Card style={{ padding: "15px 17px" }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T1, marginBottom: 3 }}>Psychology correlation</div>
              <div style={{ fontSize: 10.5, color: T3, marginBottom: 12 }}>Win rate when you rated yourself high (≥7) vs low (≤4) before the trade.</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {psych.map((p) => (
                  <div key={p.dim} style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 8, alignItems: "center", padding: "6px 8px", background: GL, borderRadius: 8 }}>
                    <span style={{ fontSize: 11.5, color: T1, fontWeight: 600 }}>{p.dim}</span>
                    <span style={{ fontSize: 11, color: T2, textAlign: "right" }}>High: <b style={{ color: p.hiWr >= 50 ? GR : T2, fontFamily: "monospace" }}>{p.hiWr == null ? "—" : `${p.hiWr}%`}</b></span>
                    <span style={{ fontSize: 11, color: T2, textAlign: "right" }}>Low: <b style={{ color: p.loWr != null && p.loWr < 50 ? RE : T2, fontFamily: "monospace" }}>{p.loWr == null ? "—" : `${p.loWr}%`}</b></span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
