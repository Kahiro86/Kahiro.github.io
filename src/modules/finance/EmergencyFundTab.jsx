import { AlertTriangle } from "lucide-react";
import { BD, GL, T1, T2, T3, CY, GR, RE, AM } from "../../shared/designTokens.js";
import { Card, SH, Fld, Sel } from "../../shared/ui.jsx";

export function EmergencyFundTab({ efBal, setEfBal, efTarget3, efTarget6, efMMF, setEfMMF, mmfs, efYield, efMonthInt, efContrib, efRemaining, efMonths }) {
  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: T1 }}>Emergency Fund</div>
        <div style={{ fontSize: 13, color: T3, marginTop: 3 }}>Financial insurance · Not an investment · Touch only for genuine emergencies</div>
      </div>
      <div style={{ padding: "13px 18px", background: `${RE}0A`, border: `1px solid ${RE}22`, borderRadius: 12, display: "flex", gap: 14, alignItems: "flex-start" }}>
        <AlertTriangle size={16} color={RE} style={{ marginTop: 1, flexShrink: 0 }} />
        <div style={{ fontSize: 12, color: T2, lineHeight: 1.7 }}>
          <strong style={{ color: RE }}>Ironclad rule: </strong>
          This fund is not an investment. It is insurance against job loss, medical emergency, or large unexpected expense. It lives in a Money Market Fund for yield and liquidity while waiting. Never deploy it for investing or trading.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
        <Card style={{ padding: "22px" }}>
          <SH title="Current Balance" sub="Update monthly after MMF statement" />
          <div style={{ fontSize: 10, color: T3, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Balance (KES)</div>
          <input type="number" value={efBal || ""} onChange={(e) => setEfBal(+e.target.value || 0)} placeholder="0"
            style={{ width: "100%", background: GL, border: `1px solid ${GR}44`, borderRadius: 10, padding: "14px 16px", fontSize: 24, color: GR, outline: "none", fontFamily: "monospace", fontWeight: 800, boxSizing: "border-box", marginBottom: 20 }} />
          {[
            { label: "3-Month Target", target: efTarget3, color: CY },
            { label: "6-Month Target (Full)", target: efTarget6, color: GR },
          ].map((x) => (
            <div key={x.label} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: T2 }}>{x.label}</span>
                <span style={{ fontSize: 12, color: x.color, fontFamily: "monospace" }}>KES {x.target.toLocaleString()}</span>
              </div>
              <div style={{ height: 8, background: BD, borderRadius: 4 }}>
                <div style={{ height: "100%", width: `${Math.min(x.target > 0 ? (+efBal / x.target) * 100 : 0, 100)}%`, background: `linear-gradient(90deg,${x.color}77,${x.color})`, borderRadius: 4, boxShadow: `0 0 8px ${x.color}44`, transition: "width 0.8s ease" }} />
              </div>
              <div style={{ fontSize: 10, color: T3, marginTop: 3 }}>
                {x.target > 0 ? Math.min(Math.round((+efBal / x.target) * 100), 100) : 0}% funded
              </div>
            </div>
          ))}
        </Card>

        <Card style={{ padding: "22px" }}>
          <SH title="MMF Vehicle" sub="Where your emergency fund is held" />
          <Fld label="Selected MMF Provider">
            <Sel value={efMMF} onChange={setEfMMF} options={mmfs.map((m) => ({ v: m.name, l: `${m.name} — ${m.yield}% p.a.` }))} />
          </Fld>
          <div style={{ display: "flex", flexDirection: "column", marginTop: 4 }}>
            {[
              { l: "Current Yield",          v: `${efYield}% p.a.`,                               c: GR },
              { l: "Monthly Interest",        v: `KES ${Math.round(efMonthInt).toLocaleString()}`,  c: GR },
              { l: "Recommended Contrib.",    v: `KES ${efContrib.toLocaleString()}/mo (5% net)`,   c: CY },
              { l: "Months to 6M Target",    v: efMonths !== null ? `${efMonths} months` : "—",     c: AM },
              { l: "Remaining to Full Fund", v: `KES ${efRemaining.toLocaleString()}`,              c: efRemaining > 0 ? RE : GR },
            ].map((x) => (
              <div key={x.l} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${BD}` }}>
                <span style={{ fontSize: 12, color: T3 }}>{x.l}</span>
                <span style={{ fontSize: 12, color: x.c, fontFamily: "monospace", fontWeight: 700 }}>{x.v}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, padding: "10px 12px", background: `${CY}0A`, border: `1px solid ${CY}22`, borderRadius: 9, fontSize: 11, color: T2, lineHeight: 1.6 }}>
            <strong style={{ color: CY }}>Why MMF? </strong>
            Liquid (withdraw same day), earning {efYield}% p.a., no lock-in. Better than savings account, safer than NSE, more accessible than T-bills for emergency use.
          </div>
        </Card>
      </div>
    </div>
  );
}
