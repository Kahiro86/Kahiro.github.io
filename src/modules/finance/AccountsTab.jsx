import { Lock } from "lucide-react";
import { BD, GL, T1, T3, CY, PU, GR, RE } from "../../shared/designTokens.js";
import { Card, SH } from "../../shared/ui.jsx";

export function AccountsTab({ g, netPay, fmtKES, opBal, setOpBal, savBal, setSavBal }) {
  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: T1 }}>Account Architecture</div>
        <div style={{ fontSize: 13, color: T3, marginTop: 3 }}>Three-account system · Complete trading firewall · Structural financial discipline</div>
      </div>

      <Card style={{ padding: "22px" }}>
        <SH title="Money Flow Diagram" sub="Structure enforces discipline automatically" />
        <div style={{ display: "flex", alignItems: "center", overflowX: "auto", paddingBottom: 6, gap: 0 }}>
          {[
            { title: "GROSS SALARY", v: g > 0 ? `KES ${g.toLocaleString()}` : "Enter salary →", sub: "Minus statutory deductions", color: GR, w: 130 },
            "arrow",
            { title: "OPERATING ACCOUNT", v: fmtKES(+opBal || 0), sub: "Bills · Food · Transport · Living", color: CY, w: 155 },
            "arrow",
            { title: "SAVINGS + INVESTMENT", v: fmtKES(+savBal || 0), sub: "MMF · T-bills · NSE · SACCO · EF", color: PU, w: 170 },
            "firewall",
            { title: "TRADING ACCOUNT", v: "$15,000 USD", sub: "FundedNext · Capital at risk", color: CY, w: 155, dashed: true, lock: true },
          ].map((x, i) => {
            if (x === "arrow") return <div key={i} style={{ fontSize: 22, color: T3, padding: "0 6px", marginTop: -8 }}>→</div>;
            if (x === "firewall") return (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "0 14px" }}>
                <div style={{ fontSize: 10, color: RE, fontWeight: 700, marginBottom: 4 }}>FIREWALL</div>
                <div style={{ width: 2, height: 50, background: `repeating-linear-gradient(0deg,${RE} 0,${RE} 5px,transparent 5px,transparent 10px)` }} />
                <div style={{ fontSize: 10, color: RE, fontWeight: 700, marginTop: 4 }}>NO CROSSOVER</div>
              </div>
            );
            return (
              <div key={i} style={{ width: x.w, background: `${x.color}1A`, border: x.dashed ? `2px dashed ${x.color}44` : `1px solid ${x.color}44`, borderRadius: 12, padding: "14px 10px", textAlign: "center", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginBottom: 5 }}>
                  {x.lock && <Lock size={9} color={x.color} />}
                  <div style={{ fontSize: 9, color: T3, letterSpacing: 1 }}>{x.title}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: x.color, fontFamily: "monospace", marginBottom: 4 }}>{x.v}</div>
                <div style={{ fontSize: 10, color: T3 }}>{x.sub}</div>
              </div>
            );
          })}
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        {[
          {
            title: "Operating Account", color: CY, lock: false,
            bal: opBal, setBal: setOpBal,
            rules: ["Day-to-day transactions only", "Rent, utilities, groceries, transport", "No investing from this account", "Keep 1 month expenses minimum"],
            rec: netPay > 0 ? `KES ${Math.round(netPay * 0.60).toLocaleString()}/month (60%)` : null,
          },
          {
            title: "Savings & Investment", color: PU, lock: false,
            bal: savBal, setBal: setSavBal,
            rules: ["Transfer on salary day — pay yourself first", "Feeds MMFs, T-bills, NSE, SACCO", "Emergency fund held here", "Never dip below emergency fund amount"],
            rec: netPay > 0 ? `KES ${Math.round(netPay * 0.40).toLocaleString()}/month (40%)` : null,
          },
          {
            title: "Trading Account", color: RE, lock: true,
            bal: null, setBal: null,
            rules: ["Completely separate from personal finances", "Funded once — never replenished personally", "Withdrawals only after consistent profitability", "Does not fund your lifestyle"],
            rec: null,
          },
        ].map((ac) => (
          <Card key={ac.title} style={{ padding: "20px", borderColor: ac.color + "33" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 12 }}>
              {ac.lock && <Lock size={12} color={ac.color} />}
              <div style={{ fontSize: 10, color: ac.color, letterSpacing: 1.5, fontWeight: 700, textTransform: "uppercase" }}>{ac.title}</div>
            </div>
            {ac.bal !== null ? (
              <>
                <div style={{ fontSize: 10, color: T3, marginBottom: 5 }}>Current Balance (KES)</div>
                <input type="number" value={ac.bal || ""} onChange={(e) => ac.setBal(+e.target.value || 0)} placeholder="0"
                  style={{ width: "100%", background: GL, border: `1px solid ${BD}`, borderRadius: 9, padding: "10px 12px", fontSize: 20, color: ac.color, outline: "none", fontFamily: "monospace", fontWeight: 700, boxSizing: "border-box", marginBottom: 14 }} />
              </>
            ) : (
              <div style={{ fontSize: 22, fontWeight: 900, color: CY, fontFamily: "monospace", marginBottom: 14 }}>$15,000 USD</div>
            )}
            {ac.rules.map((r, i) => (
              <div key={i} style={{ display: "flex", gap: 7, marginBottom: 6, fontSize: 11.5, color: T3 }}>
                <span style={{ color: ac.lock ? RE : ac.color }}>{ac.lock ? "⛔" : "→"}</span>{r}
              </div>
            ))}
            {ac.rec && (
              <div style={{ marginTop: 10, padding: "8px 10px", background: `${ac.color}0A`, border: `1px solid ${ac.color}22`, borderRadius: 8, fontSize: 11, color: ac.color }}>
                Recommended: {ac.rec}
              </div>
            )}
            {ac.lock && (
              <div style={{ marginTop: 10, padding: "8px 10px", background: `${RE}0A`, border: `1px solid ${RE}22`, borderRadius: 8, fontSize: 11, color: RE, fontWeight: 600 }}>
                FIREWALL — No personal money crosses here
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
