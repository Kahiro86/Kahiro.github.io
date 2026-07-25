import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { ArrowUpRight, Compass, Camera, TrendingUp, TrendingDown } from "lucide-react";
import { BD, T1, T2, T3, GL, CY, PU, GR, RE, AM } from "../../shared/designTokens.js";
import { Card, SH, Meter } from "../../shared/ui.jsx";
import { DonutChart, Ring } from "../../shared/charts.jsx";
import { mkTT } from "../../shared/ChartTooltip.jsx";
import { MotivePush } from "../../shared/MotivePush.jsx";
import { FirewallsCard } from "./FirewallsCard.jsx";

const kShort = (n) => { const v = Math.round(+n || 0); return v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${Math.round(v / 1e3)}k` : `${v}`; };

export function OverviewTab({
  fmtKES, netWorthKES, totalLiquid, totalInvested, monthlyPassive,
  efBal, savBal, opBal, personalDebt, setPersonalDebt, debtTotal = 0, debtCount = 0, onManageDebt,
  xRate, fw, firewalls = [], setFirewalls, accounts = [], unfiledCountsNW, setUnfiledCountsNW,
  freedom, trajectory = [], trajStats, onCaptureSnapshot,
}) {
  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
      <MotivePush context={["savings", "invest", "budget", ...(debtTotal > 0 ? ["debt"] : [])]} accent={CY} />

      {/* ── THE MISSION — money exists to buy freedom ── */}
      {freedom && (
        <Card style={{ padding: "20px 22px", background: `linear-gradient(110deg,${AM}0E,transparent)`, borderColor: `${AM}33`, display: "flex", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
          <Ring pct={freedom.freedomPct} size={98} stroke={9} color={AM}>
            <div style={{ fontSize: 19, fontWeight: 900, color: AM, fontFamily: "monospace" }}>{freedom.freedomPct}%</div>
            <div style={{ fontSize: 7.5, color: T3, letterSpacing: 1, marginTop: 2 }}>FREEDOM</div>
          </Ring>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase", color: AM, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><Compass size={12} /> The Mission · Freedom</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: T1, marginTop: 3 }}>
              {freedom.yearsOut === 0 ? "The line is crossed." : freedom.yearsOut == null ? "Build the engines." : `≈ ${freedom.yearsOut} years to freedom`}
            </div>
            <div style={{ display: "flex", gap: 22, marginTop: 12, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: freedom.freedomPct >= 100 ? GR : T1, fontFamily: "monospace" }}>{fmtKES(freedom.passiveMonthly)}<span style={{ fontSize: 10, color: T3, fontWeight: 500 }}> /mo</span></div>
                <div style={{ fontSize: 9, color: T3, letterSpacing: 1, textTransform: "uppercase", marginTop: 3 }}>Passive · goal {fmtKES(freedom.freedomNumber)}</div>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: T1, fontFamily: "monospace" }}>{fmtKES(freedom.capital)}</div>
                <div style={{ fontSize: 9, color: T3, letterSpacing: 1, textTransform: "uppercase", marginTop: 3 }}>Capital · line {fmtKES(freedom.target)}</div>
              </div>
            </div>
          </div>
        </Card>
      )}
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

      {/* ── WEALTH TRAJECTORY — where the money is heading, not just where it stands ── */}
      <Card style={{ padding: "22px" }}>
        <SH title="Wealth Trajectory" sub={trajStats?.monthsTracked > 1 ? `${trajStats.monthsTracked} months tracked` : "Captured monthly — automatically"} action={
          onCaptureSnapshot ? <button onClick={onCaptureSnapshot} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: `1px solid ${BD}`, borderRadius: 8, padding: "5px 10px", color: T2, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}><Camera size={12} /> Capture now</button> : null
        } />
        {trajectory.length >= 2 ? (
          <>
            {trajStats && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 11, marginBottom: 16 }}>
                {[
                  { l: "Net worth change", v: `${trajStats.netWorthDelta >= 0 ? "+" : "−"}${fmtKES(Math.abs(trajStats.netWorthDelta))}`, up: trajStats.netWorthDelta >= 0, note: "since first snapshot" },
                  { l: "Passive income change", v: `${trajStats.passiveDelta >= 0 ? "+" : "−"}${fmtKES(Math.abs(trajStats.passiveDelta))}`, up: trajStats.passiveDelta >= 0, note: "monthly, since start" },
                  ...(trajStats.velocity != null ? [{ l: "Freedom velocity", v: `${trajStats.velocity <= 0 ? "" : "+"}${trajStats.velocity}y`, up: trajStats.velocity <= 0, note: trajStats.velocity <= 0 ? "line getting closer" : "line moved out" }] : []),
                ].map((x) => (
                  <div key={x.l} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: "12px 14px" }}>
                    <div style={{ fontSize: 9.5, color: T3, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 5 }}>{x.l}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {x.up ? <TrendingUp size={14} color={GR} /> : <TrendingDown size={14} color={RE} />}
                      <span style={{ fontSize: 16, fontWeight: 800, color: x.up ? GR : RE, fontFamily: "monospace" }}>{x.v}</span>
                    </div>
                    <div style={{ fontSize: 9.5, color: T3, marginTop: 3 }}>{x.note}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 18 }}>
              <div>
                <div style={{ fontSize: 11, color: T2, fontWeight: 600, marginBottom: 8 }}>Net worth over time</div>
                <ResponsiveContainer width="100%" height={170}>
                  <AreaChart data={trajectory} margin={{ top: 4, right: 6, bottom: 0, left: -6 }}>
                    <defs><linearGradient id="nwG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={GR} stopOpacity={0.28} /><stop offset="95%" stopColor={GR} stopOpacity={0.02} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={BD} />
                    <XAxis dataKey="label" stroke={T3} fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke={T3} fontSize={10} tickLine={false} axisLine={false} tickFormatter={kShort} width={40} />
                    <Tooltip content={mkTT("KES ", "")} />
                    <Area type="monotone" dataKey="netWorth" stroke={GR} strokeWidth={2.5} fill="url(#nwG)" dot={{ fill: GR, r: 2.5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div>
                <div style={{ fontSize: 11, color: T2, fontWeight: 600, marginBottom: 8 }}>Savings rate</div>
                <ResponsiveContainer width="100%" height={170}>
                  <LineChart data={trajectory} margin={{ top: 4, right: 6, bottom: 0, left: -14 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={BD} />
                    <XAxis dataKey="label" stroke={T3} fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke={T3} fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} width={34} />
                    <Tooltip content={mkTT("", "%")} />
                    <Line type="monotone" dataKey="savingsRate" stroke={CY} strokeWidth={2} dot={{ fill: CY, r: 2.5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div>
                <div style={{ fontSize: 11, color: T2, fontWeight: 600, marginBottom: 8 }}>Passive income toward freedom{freedom ? ` (${fmtKES(freedom.freedomNumber)}/mo)` : ""}</div>
                <ResponsiveContainer width="100%" height={170}>
                  <AreaChart data={trajectory} margin={{ top: 4, right: 6, bottom: 0, left: -6 }}>
                    <defs><linearGradient id="paG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={AM} stopOpacity={0.28} /><stop offset="95%" stopColor={AM} stopOpacity={0.02} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={BD} />
                    <XAxis dataKey="label" stroke={T3} fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke={T3} fontSize={10} tickLine={false} axisLine={false} tickFormatter={kShort} width={40} />
                    <Tooltip content={mkTT("KES ", "")} />
                    <Area type="monotone" dataKey="passive" stroke={AM} strokeWidth={2.5} fill="url(#paG)" dot={{ fill: AM, r: 2.5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        ) : (
          <div style={{ padding: "20px 4px", fontSize: 12, color: T3, lineHeight: 1.6 }}>
            Your wealth is snapshotted automatically each month. The trajectory charts — net worth, savings rate and passive-income growth toward freedom — appear once there's a second month to compare. Keep your balances current and the line draws itself.
          </div>
        )}
      </Card>

      {/* ── TRADING FIREWALLS — your own accounts, walled off from net worth ── */}
      <FirewallsCard fw={fw} firewalls={firewalls} setFirewalls={setFirewalls} accounts={accounts}
        unfiledCountsNW={unfiledCountsNW} setUnfiledCountsNW={setUnfiledCountsNW} xRate={xRate} fmtKES={fmtKES} />

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
