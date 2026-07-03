import { Cpu } from "lucide-react";
import { T1, T2, T3, BD, CY, PU, GR, RE, AM } from "../../shared/designTokens.js";
import { Card } from "../../shared/ui.jsx";

export function GoalsTab({ efTarget6, efBal, efContrib, totalInvested, netWorthKES, monthlyPassive, personalDebt, netPay }) {
  const goals = [
    { id: "ef",      icon: "🛡️", name: "Emergency Fund (6 months)",    target: efTarget6, current: +efBal || 0,                             monthly: efContrib,                                      color: GR },
    { id: "port",    icon: "📈", name: "Investment Portfolio KES 500k", target: 500000,    current: totalInvested,                            monthly: netPay > 0 ? Math.round(netPay * 0.15) : 10000, color: CY },
    { id: "nw",      icon: "💰", name: "Net Worth KES 5M",              target: 5000000,   current: Math.max(netWorthKES, 0),                 monthly: netPay > 0 ? Math.round(netPay * 0.35) : 20000, color: PU },
    { id: "passive", icon: "⚡", name: "Passive Income 20k/month",      target: 20000,     current: monthlyPassive,                           monthly: 0,                                               color: AM },
    { id: "debt",    icon: "🎯", name: "Clear Personal Debt",           target: 10000,     current: Math.max(0, 10000 - (+personalDebt || 0)), monthly: 5000,                                            color: RE },
    { id: "trading", icon: "📊", name: "Trading Profitability",         target: 100,       current: 22,                                       monthly: 0, isPct: true,                                   color: CY },
  ];

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: T1 }}>Financial Goals</div>
        <div style={{ fontSize: 13, color: T3, marginTop: 3 }}>Long-term wealth targets · Timeline projections · Monthly contribution tracking</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        {goals.map((g) => {
          const pct = g.isPct ? g.current : g.target > 0 ? Math.min(Math.round((g.current / g.target) * 100), 100) : 0;
          const remaining = Math.max(0, g.target - g.current);
          const months = g.monthly > 0 ? Math.ceil(remaining / g.monthly) : null;
          return (
            <Card key={g.id} style={{ padding: "20px", borderColor: pct >= 100 ? GR + "44" : g.color + "22" }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>{g.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T1, marginBottom: 4, lineHeight: 1.4 }}>{g.name}</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: T3 }}>
                  {g.isPct ? `${g.current}% → ${g.target}%` : `KES ${Math.round(g.current).toLocaleString()} / ${g.target.toLocaleString()}`}
                </span>
                <span style={{ fontSize: 13, fontWeight: 800, color: g.color, fontFamily: "monospace" }}>{pct}%</span>
              </div>
              <div style={{ height: 6, background: BD, borderRadius: 3, marginBottom: 10 }}>
                <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg,${g.color}77,${g.color})`, borderRadius: 3, boxShadow: `0 0 6px ${g.color}44`, transition: "width 0.8s ease" }} />
              </div>
              {months !== null && pct < 100 && (
                <div style={{ padding: "7px 10px", background: `${g.color}0A`, border: `1px solid ${g.color}22`, borderRadius: 8, fontSize: 11, color: g.color }}>
                  KES {g.monthly.toLocaleString()}/mo → {months} months to target
                </div>
              )}
              {pct >= 100 && (
                <div style={{ padding: "7px 10px", background: `${GR}22`, border: `1px solid ${GR}44`, borderRadius: 8, fontSize: 11, color: GR, fontWeight: 700 }}>
                  ✓ ACHIEVED
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Card style={{ padding: "22px", borderColor: CY + "22" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <Cpu size={15} color={CY} />
          <div style={{ fontSize: 14, fontWeight: 700, color: CY }}>ARCHITECT — Kenya Financial Priority Stack</div>
        </div>
        {[
          { n: "1", text: "Clear the KES 10,000 personal debt immediately. Guaranteed return — no investment beats paying off debt first.", c: RE },
          { n: "2", text: "Build emergency fund to 3-month target before any investing. Prevents forced selling of investments in a crisis.", c: AM },
          { n: "3", text: "Once debt-free and 3M EF funded: MMFs and T-bills first. Highest risk-adjusted return with full liquidity in Kenya.", c: GR },
          { n: "4", text: "Scale into NSE equities and SACCO once liquid investments hit KES 100k. Diversification without overexposure.", c: CY },
          { n: "5", text: "Trading firewall is permanent. Prop firm profits stay in the account until you demonstrate 6+ months consistent profitability.", c: PU },
        ].map((x) => (
          <div key={x.n} style={{ display: "flex", gap: 12, padding: "10px 12px", background: `${x.c}0A`, borderRadius: 10, border: `1px solid ${x.c}22`, marginBottom: 9 }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${x.c}33`, border: `1px solid ${x.c}66`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: x.c, flexShrink: 0 }}>{x.n}</div>
            <span style={{ fontSize: 12, color: T2, lineHeight: 1.6 }}>{x.text}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
