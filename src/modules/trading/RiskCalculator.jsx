import { useState } from "react";
import { localDateStr } from "../../shared/dates.js";
import { BD, T1, T2, T3, GL, CY, GR, RE, AM } from "../../shared/designTokens.js";
import { Card, SH, Fld, Inp, Sel } from "../../shared/ui.jsx";
import { INSTRUMENTS } from "./constants.js";
import { calcPnl, getPV } from "./helpers.js";

export function RiskCalculator({ trades, balance }) {
  const [riskPct, setRiskPct] = useState(1.0);
  const [customRisk, setCustomRisk] = useState(false);
  const [instrument, setInstrument] = useState("NQ1!");
  const [entryPrice, setEntryPrice] = useState("");
  const [stopPrice, setStopPrice] = useState("");
  const [targetPrice, setTargetPrice] = useState("");

  // FundedNext limits (external)
  const DAILY_LIMIT = Math.round(balance * 0.05); // 5% daily loss limit
  const MAX_DD_LIMIT = Math.round(balance * 0.10); // 10% max trailing DD
  // Internal limits (ARCHITECT best practice — half of external)
  const INT_DAILY = Math.round(DAILY_LIMIT * 0.5);
  const INT_DD = Math.round(MAX_DD_LIMIT * 0.5);

  // Today P&L from closed trades
  const todayStr = localDateStr();
  const todayPnl = trades.filter((t) => t.date === todayStr && t.status === "CLOSED").reduce((s, t) => s + calcPnl(t), 0);
  const dailyLoss = Math.abs(Math.min(todayPnl, 0));

  // Position calculations
  const pv = getPV(instrument);
  const en = +entryPrice || 0;
  const st = +stopPrice || 0;
  const tg = +targetPrice || 0;
  const stopDist = Math.abs(en - st);
  const riskDollars = (balance * riskPct) / 100;
  const contracts = stopDist > 0 && pv > 0 ? Math.max(1, Math.floor(riskDollars / (stopDist * pv))) : 0;
  const actualRisk = contracts * stopDist * pv;
  const actualPct = balance > 0 ? ((actualRisk / balance) * 100).toFixed(2) : "0.00";
  const projRR = stopDist > 0 && tg > 0 ? (Math.abs(tg - en) / stopDist).toFixed(2) : null;
  const projProfit = projRR && contracts > 0 ? Math.round(contracts * Math.abs(tg - en) * pv) : null;

  const LimitBar = ({ label, used, limit, intLimit }) => {
    const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
    const intPct = intLimit > 0 ? Math.min((used / intLimit) * 100, 100) : 0;
    const col = intPct >= 100 ? RE : intPct >= 70 ? AM : GR;
    return (
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 12, color: T2 }}>{label}</span>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: 10.5, color: T3 }}>Int. limit: ${intLimit.toLocaleString()}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: col, fontFamily: "monospace" }}>
              ${used.toLocaleString()} / ${limit.toLocaleString()}
            </span>
          </div>
        </div>
        <div style={{ height: 8, background: BD, borderRadius: 4, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, height: "100%", width: `${pct}%`, background: `linear-gradient(90deg,${col}77,${col})`, borderRadius: 4, transition: "width 0.5s ease", boxShadow: `0 0 8px ${col}66` }} />
          <div style={{ position: "absolute", top: 0, left: `${(intLimit / limit) * 100}%`, width: 2, height: "100%", background: AM, opacity: 0.8 }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 9.5, color: T3 }}>
          <span>$0</span>
          <span style={{ color: AM }}>⚠ Internal ${intLimit.toLocaleString()}</span>
          <span>🔴 External ${limit.toLocaleString()}</span>
        </div>
        {intPct >= 70 && (
          <div style={{ marginTop: 7, padding: "6px 10px", background: `${col}11`, border: `1px solid ${col}33`, borderRadius: 7, fontSize: 11, color: col }}>
            {intPct >= 100 ? "⛔ Internal daily limit hit — STOP TRADING TODAY" : `⚠ ${Math.round(intPct)}% of internal daily limit used`}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 22 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: T1 }}>Risk & Position Sizing</div>
        <div style={{ fontSize: 13, color: T3, marginTop: 3 }}>FundedNext Challenge · Real-time capital protection · Run before every trade</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ padding: "22px" }}>
            <SH title="Trade Parameters" sub="Enter your setup details" />

            <Fld label="Instrument">
              <Sel value={instrument} onChange={setInstrument} options={INSTRUMENTS.map((i) => i.l)} />
            </Fld>

            <Fld label={`Risk % — $${Math.round((balance * riskPct) / 100).toLocaleString()} at risk`}>
              <div style={{ display: "flex", gap: 6, marginBottom: customRisk ? 8 : 0 }}>
                {[0.25, 0.5, 0.75, 1.0].map((p) => (
                  <button key={p} onClick={() => { setRiskPct(p); setCustomRisk(false); }} style={{ flex: 1, padding: "8px 4px", borderRadius: 9, border: `1px solid ${!customRisk && riskPct === p ? CY + "66" : BD}`, background: !customRisk && riskPct === p ? `${CY}22` : GL, color: !customRisk && riskPct === p ? CY : T2, fontSize: 12, fontWeight: !customRisk && riskPct === p ? 700 : 400, cursor: "pointer", fontFamily: "monospace" }}>
                    {p}%
                  </button>
                ))}
                <button onClick={() => setCustomRisk(true)} style={{ flex: 1, padding: "8px 4px", borderRadius: 9, border: `1px solid ${customRisk ? AM + "66" : BD}`, background: customRisk ? `${AM}22` : GL, color: customRisk ? AM : T2, fontSize: 12, fontWeight: customRisk ? 700 : 400, cursor: "pointer", fontFamily: "inherit" }}>
                  Custom
                </button>
              </div>
              {customRisk && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Inp type="number" value={riskPct} onChange={(v) => setRiskPct(Math.min(+v || 0, 2))} placeholder="0.5" mono />
                  <span style={{ fontSize: 12, color: T3, whiteSpace: "nowrap" }}>% (max 2%)</span>
                </div>
              )}
            </Fld>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <Fld label="Entry Price"><Inp type="number" value={entryPrice} onChange={setEntryPrice} placeholder="21480" mono /></Fld>
              <Fld label="Stop Loss"><Inp type="number" value={stopPrice} onChange={setStopPrice} placeholder="21455" mono /></Fld>
              <Fld label="Target Price"><Inp type="number" value={targetPrice} onChange={setTargetPrice} placeholder="21535" mono /></Fld>
            </div>

            <div style={{ padding: "12px", background: `${CY}0A`, border: `1px solid ${CY}22`, borderRadius: 10, fontSize: 11, color: T2, lineHeight: 1.6 }}>
              Point value for <strong style={{ color: CY }}>{instrument}</strong>: ${pv}/pt · Stop distance: <strong style={{ color: AM }}>{stopDist > 0 ? `${stopDist.toFixed(2)} pts` : "—"}</strong>
            </div>
          </Card>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Card style={{ padding: "22px", borderColor: contracts > 0 ? GR + "44" : BD }}>
            <SH title="Position Size Output" sub="Calculated for your risk parameters" />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              {[
                { l: "Contracts / Lots", v: contracts > 0 ? contracts.toString() : "—", c: contracts > 0 ? GR : T3, big: true },
                { l: "Dollar Risk",      v: actualRisk > 0 ? `$${actualRisk.toLocaleString()}` : "—", c: +actualPct > 1 ? RE : +actualPct > 0.5 ? AM : GR, big: true },
                { l: "Actual Risk %",    v: actualRisk > 0 ? `${actualPct}%` : "—", c: +actualPct > 1 ? RE : +actualPct > 0.5 ? AM : GR, big: false },
                { l: "Point Value",      v: `$${pv}/pt`, c: CY, big: false },
              ].map((x) => (
                <div key={x.l} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 11, padding: "14px" }}>
                  <div style={{ fontSize: 10, color: T3, letterSpacing: 1, marginBottom: 7, textTransform: "uppercase" }}>{x.l}</div>
                  <div style={{ fontSize: x.big ? 28 : 20, fontWeight: 800, color: x.c, fontFamily: "monospace" }}>{x.v}</div>
                </div>
              ))}
            </div>

            {projRR && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div style={{ background: GL, border: `1px solid ${+projRR >= 2 ? GR + "44" : BD}`, borderRadius: 11, padding: "14px" }}>
                  <div style={{ fontSize: 10, color: T3, letterSpacing: 1, marginBottom: 7, textTransform: "uppercase" }}>Projected R:R</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: +projRR >= 2 ? GR : +projRR >= 1 ? CY : RE, fontFamily: "monospace" }}>{projRR}R</div>
                </div>
                <div style={{ background: GL, border: `1px solid ${GR}44`, borderRadius: 11, padding: "14px" }}>
                  <div style={{ fontSize: 10, color: T3, letterSpacing: 1, marginBottom: 7, textTransform: "uppercase" }}>Projected Profit</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: GR, fontFamily: "monospace" }}>+${projProfit?.toLocaleString()}</div>
                </div>
              </div>
            )}

            {contracts > 0 && (
              <div style={{ padding: "12px 14px", background: `${GR}12`, border: `1px solid ${GR}33`, borderRadius: 10, fontSize: 13, color: T1 }}>
                <strong style={{ color: GR }}>Trade size: {contracts} contract{contracts > 1 ? "s" : ""}</strong>
                {" "}on {instrument} · Stop {stopDist.toFixed(2)} pts from entry ·{" "}
                <span style={{ color: +actualPct > 1 ? RE : AM }}>Risking ${actualRisk.toLocaleString()} ({actualPct}%)</span>
              </div>
            )}
          </Card>

          <Card style={{ padding: "18px" }}>
            <SH title="Quick Size Reference" sub={`${instrument} · Current balance $${balance.toLocaleString()}`} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {[0.25, 0.5, 0.75, 1.0].map((p) => {
                const risk = Math.round((balance * p) / 100);
                const cts = stopDist > 0 ? Math.max(1, Math.floor(risk / (stopDist * pv))) : "—";
                return (
                  <div key={p} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: "12px", textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: T3, marginBottom: 5 }}>{p}%</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: CY, fontFamily: "monospace", marginBottom: 3 }}>{typeof cts === "number" ? `${cts}ct` : "—"}</div>
                    <div style={{ fontSize: 10, color: T3 }}>${risk.toLocaleString()}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      <Card style={{ padding: "22px" }}>
        <SH title="FundedNext Limits Dashboard" sub="External limits · Internal ARCHITECT limits (50% of external) · Live daily usage" action={
          <div style={{ padding: "4px 10px", background: `${dailyLoss === 0 ? GR : dailyLoss < INT_DAILY ? AM : RE}22`, border: `1px solid ${dailyLoss === 0 ? GR : dailyLoss < INT_DAILY ? AM : RE}44`, borderRadius: 8, fontSize: 11, color: dailyLoss === 0 ? GR : dailyLoss < INT_DAILY ? AM : RE, fontWeight: 700 }}>
            Today: {todayPnl >= 0 ? "+" : ""}${todayPnl.toLocaleString()} P&L
          </div>
        } />
        <LimitBar label="Daily Loss Limit" used={dailyLoss} limit={DAILY_LIMIT} intLimit={INT_DAILY} />
        <LimitBar label="Max Trailing Drawdown" used={0} limit={MAX_DD_LIMIT} intLimit={INT_DD} />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 4 }}>
          {[
            { l: "Daily Remaining (Int.)", v: `$${Math.max(0, INT_DAILY - dailyLoss).toLocaleString()}`,   c: dailyLoss > INT_DAILY * 0.7 ? RE : GR },
            { l: "Daily Remaining (Ext.)", v: `$${Math.max(0, DAILY_LIMIT - dailyLoss).toLocaleString()}`, c: dailyLoss > DAILY_LIMIT * 0.7 ? RE : CY },
            { l: "Trades Today",           v: trades.filter((t) => t.date === todayStr && t.status === "CLOSED").length.toString(), c: T2 },
            { l: "Account Health",         v: dailyLoss === 0 ? "Healthy" : dailyLoss < INT_DAILY ? "Watch" : "STOP", c: dailyLoss === 0 ? GR : dailyLoss < INT_DAILY ? AM : RE },
          ].map((x) => (
            <div key={x.l} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: "12px" }}>
              <div style={{ fontSize: 9.5, color: T3, letterSpacing: 1, marginBottom: 5, textTransform: "uppercase" }}>{x.l}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: x.c, fontFamily: "monospace" }}>{x.v}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
