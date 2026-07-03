import { Lock } from "lucide-react";
import { BD, T1, T2, T3, GL, CY, PU, GR, RE, AM } from "../../shared/designTokens.js";
import { Card, SH } from "../../shared/ui.jsx";

export function OverviewTab({ fmtKES, netWorthKES, totalLiquid, totalInvested, monthlyPassive, tradingKES, efBal, savBal, opBal, personalDebt, setPersonalDebt }) {
  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 14 }}>
        {[
          { l: "Net Worth",       v: fmtKES(netWorthKES),   c: netWorthKES >= 0 ? GR : RE, note: "Assets − Liabilities" },
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

      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 20 }}>
        <Card style={{ padding: "22px" }}>
          <SH title="Asset Allocation" sub="All positions in KES equivalent" />
          {[
            { l: "Trading Account (Firewall)", v: tradingKES,    c: CY, note: `$15,000 USD — READ ONLY`, lock: true },
            { l: "Investments (Kenya)",        v: totalInvested,  c: PU, note: null },
            { l: "Emergency Fund",             v: +efBal || 0,    c: GR, note: null },
            { l: "Savings Account",            v: +savBal || 0,   c: AM, note: null },
            { l: "Operating Account",          v: +opBal || 0,    c: T2, note: null },
          ].map((x) => {
            const total = Math.max(tradingKES + totalInvested + totalLiquid, 1);
            const pct = Math.round((x.v / total) * 100);
            return (
              <div key={x.l} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {x.lock && <Lock size={10} color={CY} />}
                    <span style={{ fontSize: 12, color: T2 }}>{x.l}</span>
                    {x.note && <span style={{ fontSize: 10, color: T3 }}>({x.note})</span>}
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <span style={{ fontSize: 10.5, color: T3 }}>{pct}%</span>
                    <span style={{ fontSize: 12, color: x.c, fontFamily: "monospace", fontWeight: 700 }}>{fmtKES(x.v)}</span>
                  </div>
                </div>
                <div style={{ height: 5, background: BD, borderRadius: 3 }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: x.lock ? `repeating-linear-gradient(45deg,${x.c}33 0,${x.c}33 4px,transparent 4px,transparent 8px)` : `linear-gradient(90deg,${x.c}77,${x.c})`, borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Card style={{ padding: "20px", borderColor: RE + "33" }}>
            <SH title="Liabilities" sub="Total debt position" />
            <div style={{ padding: "12px", background: `${RE}0D`, border: `1px solid ${RE}22`, borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, color: T1, fontWeight: 600 }}>Personal Loan</div>
                <div style={{ fontSize: 10.5, color: T3 }}>Unsecured personal debt</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: RE, fontFamily: "monospace" }}>KES {(+personalDebt || 0).toLocaleString()}</div>
                <input type="number" value={personalDebt} onChange={(e) => setPersonalDebt(+e.target.value || 0)}
                  style={{ width: 100, background: "transparent", border: `1px solid ${BD}`, borderRadius: 5, padding: "2px 6px", fontSize: 10, color: T3, outline: "none", fontFamily: "monospace", textAlign: "right", marginTop: 3 }} />
              </div>
            </div>
          </Card>

          <Card style={{ padding: "20px" }}>
            <SH title="Passive Income Progress" sub="Monthly income from investments" />
            <div style={{ fontSize: 28, fontWeight: 900, color: AM, fontFamily: "monospace", marginBottom: 6 }}>{fmtKES(monthlyPassive)}</div>
            <div style={{ fontSize: 11, color: T3, marginBottom: 10 }}>Target: KES 20,000/month</div>
            <div style={{ height: 6, background: BD, borderRadius: 3, marginBottom: 6 }}>
              <div style={{ height: "100%", width: `${Math.min((monthlyPassive / 20000) * 100, 100)}%`, background: `linear-gradient(90deg,${AM}77,${AM})`, borderRadius: 3 }} />
            </div>
            <div style={{ fontSize: 11, color: T3 }}>{Math.round((monthlyPassive / 20000) * 100)}% of target</div>
          </Card>
        </div>
      </div>
    </div>
  );
}
