import { Lock, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { BD, T1, T2, T3, GL, CY, PU, GR, RE, AM } from "../../shared/designTokens.js";
import { Card, SH, Meter } from "../../shared/ui.jsx";
import { DonutChart } from "../../shared/charts.jsx";

const usd = (n) => `$${Math.round(+n || 0).toLocaleString()}`;

export function OverviewTab({
  fmtKES, netWorthKES, totalLiquid, totalInvested, monthlyPassive,
  efBal, savBal, opBal, personalDebt, setPersonalDebt, debtTotal = 0, debtCount = 0, onManageDebt,
  tMetrics, tradingWithdrawals, setTradingWithdrawals, profitSplit, setProfitSplit,
}) {
  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14 }}>
        {[
          { l: "Net Worth",       v: fmtKES(netWorthKES),   c: netWorthKES >= 0 ? GR : RE, note: "Personal assets − debt (excl. trading)" },
          { l: "Liquid Assets",   v: fmtKES(totalLiquid),   c: CY,  note: "Operating + Savings + EF" },
          { l: "Invested",        v: fmtKES(totalInvested), c: PU,  note: "MMF · T-bills · NSE · SACCO" },
          { l: "Monthly Passive", v: fmtKES(monthlyPassive),c: AM,  note: "Investment income projected" },
        ].map((x) => (
          <Card key={x.l} style={{ padding: "20px", borderColor: x.c + "33" }}>
            <div style={{ fontSize: 10, color: T3, letterSpacing: 1.5, marginBottom: 8, textTransform: "uppercase" }}>{x.l}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: x.c, fontFamily: "monospace" }}>{x.v}</div>
            <div style={{ fontSize: 11, color: T3, marginTop: 5 }}>{x.note}</div>
          </Card>
        ))}
      </div>

      {/* ── TRADING ACCOUNT — firewalled from personal wealth ── */}
      <Card style={{ padding: "22px", borderColor: CY + "33", background: `linear-gradient(180deg,${CY}08,transparent)` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4, flexWrap: "wrap", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Lock size={13} color={CY} />
            <div style={{ fontSize: 15, fontWeight: 800, color: T1 }}>Trading Account</div>
            <span style={{ fontSize: 9.5, letterSpacing: 0.5, padding: "2px 8px", borderRadius: 8, background: `${CY}18`, color: CY, border: `1px solid ${CY}33` }}>FIREWALLED · USD</span>
          </div>
          <div style={{ fontSize: 10.5, color: T3 }}>Not included in Net Worth or Assets</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 11, marginTop: 14 }}>
          {[
            { l: "Funded Size",    v: usd(tMetrics.fundedSize), c: T1 },
            { l: "Current Equity", v: usd(tMetrics.equity),     c: tMetrics.equity >= tMetrics.fundedSize ? GR : RE },
            { l: "Total Profit",   v: `${tMetrics.totalProfit >= 0 ? "+" : ""}${usd(tMetrics.totalProfit)}`, c: tMetrics.totalProfit >= 0 ? GR : RE },
            { l: "Win Rate",       v: `${tMetrics.winRate}%`,   c: tMetrics.winRate >= 50 ? GR : AM },
            { l: "Profit Factor",  v: tMetrics.pf || "—",       c: PU },
          ].map((x) => (
            <div key={x.l} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: "12px 13px" }}>
              <div style={{ fontSize: 9.5, color: T3, letterSpacing: 1, marginBottom: 5, textTransform: "uppercase" }}>{x.l}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: x.c, fontFamily: "monospace" }}>{x.v}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 11, marginTop: 11 }}>
          {[
            { l: "Daily P&L",   v: tMetrics.dailyPnl },
            { l: "Weekly P&L",  v: tMetrics.weeklyPnl },
            { l: "Monthly P&L", v: tMetrics.monthlyPnl },
          ].map((x) => (
            <div key={x.l} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: "11px 13px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 9.5, color: T3, letterSpacing: 1, textTransform: "uppercase" }}>{x.l}</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: x.v > 0 ? GR : x.v < 0 ? RE : T2, fontFamily: "monospace" }}>{x.v >= 0 ? "+" : ""}{usd(x.v)}</div>
              </div>
              {x.v > 0 ? <ArrowUpRight size={15} color={GR} /> : x.v < 0 ? <ArrowDownRight size={15} color={RE} /> : null}
            </div>
          ))}
          <div style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: "11px 13px" }}>
            <div style={{ fontSize: 9.5, color: T3, letterSpacing: 1, textTransform: "uppercase" }}>Open Risk</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: tMetrics.openRiskPct > 2 ? RE : tMetrics.openRiskPct > 0 ? AM : T2, fontFamily: "monospace" }}>{usd(tMetrics.openRisk)} · {tMetrics.openRiskPct}%</div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 11, marginTop: 11 }}>
          <div style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: "11px 13px" }}>
            <div style={{ fontSize: 9.5, color: T3, letterSpacing: 1, textTransform: "uppercase", marginBottom: 5 }}>Withdrawals ($)</div>
            <input type="text" inputMode="numeric" value={tradingWithdrawals ? (+tradingWithdrawals).toLocaleString("en-US") : ""} onChange={(e) => setTradingWithdrawals(+e.target.value.replace(/[^0-9]/g, "") || 0)} placeholder="0"
              style={{ width: "100%", background: "transparent", border: `1px solid ${BD}`, borderRadius: 6, padding: "5px 8px", fontSize: 14, color: T1, outline: "none", fontFamily: "monospace", fontWeight: 700 }} />
          </div>
          <div style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: "11px 13px" }}>
            <div style={{ fontSize: 9.5, color: T3, letterSpacing: 1, textTransform: "uppercase", marginBottom: 5 }}>Profit Split (%)</div>
            <input type="number" value={profitSplit} onChange={(e) => setProfitSplit(+e.target.value || 0)}
              style={{ width: "100%", background: "transparent", border: `1px solid ${BD}`, borderRadius: 6, padding: "5px 8px", fontSize: 14, color: AM, outline: "none", fontFamily: "monospace", fontWeight: 700 }} />
          </div>
          <div style={{ background: `${GR}0C`, border: `1px solid ${GR}22`, borderRadius: 10, padding: "11px 13px" }}>
            <div style={{ fontSize: 9.5, color: T3, letterSpacing: 1, textTransform: "uppercase", marginBottom: 5 }}>Your Share</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: GR, fontFamily: "monospace" }}>{usd(tMetrics.yourShare)}</div>
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: 20 }}>
        <Card style={{ padding: "22px" }}>
          <SH title="Asset Allocation" sub="Personal holdings in KES — trading excluded" />
          {(() => {
            const items = [
              { l: "Investments (Kenya)", v: totalInvested,  c: PU },
              { l: "Emergency Fund",      v: +efBal || 0,    c: GR },
              { l: "Savings Account",     v: +savBal || 0,   c: AM },
              { l: "Operating Account",   v: +opBal || 0,    c: T2 },
            ];
            const total = Math.max(totalInvested + totalLiquid, 1);
            const pieData = items.filter((x) => x.v > 0).map((x) => ({ name: x.l.split(" (")[0], value: x.v, color: x.c }));
            return (
              <div style={{ display: "flex", gap: 20, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ width: 190, flexShrink: 0 }}>
                  <DonutChart data={pieData.length ? pieData : [{ name: "None", value: 1, color: BD }]} height={190} centerLabel={total >= 1e6 ? `${(total / 1e6).toFixed(1)}M` : total >= 1e3 ? `${Math.round(total / 1e3)}k` : Math.round(total)} centerSub="Total KES" unit="KES " />
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  {items.map((x) => {
                    const pct = Math.round((x.v / total) * 100);
                    return (
                      <div key={x.l} style={{ marginBottom: 14 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                          <span style={{ fontSize: 12, color: T2 }}>{x.l}</span>
                          <div style={{ display: "flex", gap: 10 }}>
                            <span style={{ fontSize: 10.5, color: T3 }}>{pct}%</span>
                            <span style={{ fontSize: 12, color: x.c, fontFamily: "monospace", fontWeight: 700 }}>{fmtKES(x.v)}</span>
                          </div>
                        </div>
                        <Meter pct={pct} fill={`linear-gradient(90deg,${x.c}77,${x.c})`} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Card style={{ padding: "20px", borderColor: RE + "33" }}>
            <SH title="Liabilities" sub="Total debt position" action={
              debtCount > 0 ? <button onClick={onManageDebt} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: CY, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>Manage<ArrowUpRight size={12} /></button> : null
            } />
            <div style={{ padding: "12px", background: `${RE}0D`, border: `1px solid ${RE}22`, borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, color: T1, fontWeight: 600 }}>{debtCount > 0 ? `${debtCount} debt${debtCount > 1 ? "s" : ""}` : "Personal debt"}</div>
                <div style={{ fontSize: 10.5, color: T3 }}>{debtCount > 0 ? "Tracked with repayments & payoff dates" : "Add in the Debt tab for full tracking"}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: RE, fontFamily: "monospace" }}>{fmtKES(debtCount > 0 ? debtTotal : (+personalDebt || 0))}</div>
                {debtCount === 0 && (
                  <input type="text" inputMode="numeric" value={personalDebt ? (+personalDebt).toLocaleString("en-US") : ""} onChange={(e) => setPersonalDebt(+e.target.value.replace(/[^0-9]/g, "") || 0)} placeholder="0"
                    style={{ width: 100, background: "transparent", border: `1px solid ${BD}`, borderRadius: 5, padding: "2px 6px", fontSize: 10, color: T3, outline: "none", fontFamily: "monospace", textAlign: "right", marginTop: 3 }} />
                )}
              </div>
            </div>
          </Card>

          <Card style={{ padding: "20px" }}>
            <SH title="Passive Income Progress" sub="Monthly income from investments" />
            <div style={{ fontSize: 28, fontWeight: 900, color: AM, fontFamily: "monospace", marginBottom: 6 }}>{fmtKES(monthlyPassive)}</div>
            <div style={{ fontSize: 11, color: T3, marginBottom: 10 }}>Target: KES 20,000/month</div>
            <Meter pct={(monthlyPassive / 20000) * 100} height={6} fill={`linear-gradient(90deg,${AM}77,${AM})`} style={{ marginBottom: 6 }} />
            <div style={{ fontSize: 11, color: T3 }}>{Math.round((monthlyPassive / 20000) * 100)}% of target</div>
          </Card>
        </div>
      </div>
    </div>
  );
}
