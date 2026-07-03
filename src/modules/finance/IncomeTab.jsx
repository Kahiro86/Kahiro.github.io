import { BD, T1, T2, T3, GL, CY, PU, GR, RE, AM, OR } from "../../shared/designTokens.js";
import { Card, SH } from "../../shared/ui.jsx";

export function IncomeTab({ gross, setGross, g, paye, nssf, shif, ahl, totalDed, netPay }) {
  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: T1 }}>Income & Statutory Deductions</div>
        <div style={{ fontSize: 13, color: T3, marginTop: 3 }}>Kenya PAYE · NSSF Act 2013 · SHIF 2.75% · Affordable Housing Levy 1.5%</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 22 }}>
        <Card style={{ padding: "22px" }}>
          <SH title="Gross Monthly Salary" sub="Enter gross — all deductions auto-calculated" />
          <input type="number" value={gross} onChange={(e) => setGross(e.target.value)} placeholder="e.g. 80000"
            style={{ width: "100%", background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: "14px 16px", fontSize: 24, color: T1, outline: "none", fontFamily: "monospace", fontWeight: 800, boxSizing: "border-box", marginBottom: 14 }} />
          {g > 0 && (
            <div style={{ padding: "12px", background: `${CY}0A`, border: `1px solid ${CY}22`, borderRadius: 10, fontSize: 12, color: T2, lineHeight: 1.7 }}>
              <div style={{ fontWeight: 600, color: CY, marginBottom: 4 }}>Tax bracket:</div>
              {g <= 24000 && <span>First band — 10% marginal rate</span>}
              {g > 24000 && g <= 32333 && <span>Second band — 25% marginal rate</span>}
              {g > 32333 && g <= 500000 && <span>30% band — primary bracket for most earners</span>}
              {g > 500000 && <span>32.5%+ band — high income bracket</span>}
              <div style={{ marginTop: 4, color: T3 }}>Personal relief KES 2,400/month auto-applied</div>
            </div>
          )}
        </Card>

        <Card style={{ padding: "22px" }}>
          <SH title="Deductions Breakdown" sub="All mandatory statutory deductions" />
          {[
            { l: "PAYE Tax",               v: paye, note: "Progressive 10–35% — personal relief applied", c: RE },
            { l: "NSSF Tier I + II",        v: nssf, note: "6% employee contribution (Act 2013)",         c: AM },
            { l: "SHIF",                    v: shif, note: "2.75% of gross — Social Health Insurance",    c: OR },
            { l: "Affordable Housing Levy", v: ahl,  note: "1.5% of gross — employer matches",            c: PU },
          ].map((x) => (
            <div key={x.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: `1px solid ${BD}` }}>
              <div>
                <div style={{ fontSize: 13, color: T1 }}>{x.l}</div>
                <div style={{ fontSize: 10.5, color: T3, marginTop: 2 }}>{x.note}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: x.c, fontFamily: "monospace" }}>KES {x.v.toLocaleString()}</div>
                {g > 0 && <div style={{ fontSize: 10, color: T3 }}>{((x.v / g) * 100).toFixed(1)}% of gross</div>}
              </div>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 0 0" }}>
            <span style={{ fontSize: 13, color: T2, fontWeight: 600 }}>Total Deductions</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: RE, fontFamily: "monospace" }}>KES {totalDed.toLocaleString()}</span>
          </div>
        </Card>
      </div>

      <Card style={{ padding: "22px", borderColor: GR + "33" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 13, color: T3 }}>Effective tax rate: {g > 0 ? ((totalDed / g) * 100).toFixed(1) : 0}%</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: GR, fontFamily: "monospace", marginTop: 4 }}>
              Take-Home: KES {netPay.toLocaleString()}
            </div>
          </div>
          {g > 0 && (
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, color: T3 }}>Net / Gross</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: GR, fontFamily: "monospace" }}>{((netPay / g) * 100).toFixed(0)}%</div>
            </div>
          )}
        </div>
        {netPay > 0 ? (
          <>
            <div style={{ fontSize: 12, color: T3, marginBottom: 12 }}>Recommended allocation — pay yourself first:</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {[
                { l: "Emergency Fund (5%)",   v: Math.round(netPay * 0.05), c: GR },
                { l: "Savings (15%)",          v: Math.round(netPay * 0.15), c: CY },
                { l: "Investments (20%)",      v: Math.round(netPay * 0.20), c: PU },
                { l: "Living Expenses (60%)",  v: Math.round(netPay * 0.60), c: AM },
              ].map((x) => (
                <div key={x.l} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: "14px" }}>
                  <div style={{ fontSize: 10, color: T3, marginBottom: 6 }}>{x.l}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: x.c, fontFamily: "monospace" }}>KES {x.v.toLocaleString()}</div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "20px 0", color: T3, fontSize: 13 }}>
            Enter your gross salary above to see take-home pay and allocations.
          </div>
        )}
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Card style={{ padding: "18px" }}>
          <SH title="NSSF Breakdown" sub="National Social Security Fund — Act 2013" />
          {[
            { l: "Tier I (employee)",  v: `KES ${Math.round(Math.min(g, 6000) * 0.06)}/mo`,                        note: "6% × first KES 6,000" },
            { l: "Tier II (employee)", v: `KES ${Math.round(g > 6000 ? Math.min(g - 6000, 30000) * 0.06 : 0)}/mo`, note: "6% × (gross − 6k), capped KES 30k" },
            { l: "Employee Total",     v: `KES ${nssf.toLocaleString()}/mo`,                                        note: "Your deduction from payslip" },
            { l: "Employer Match",     v: `KES ${nssf.toLocaleString()}/mo`,                                        note: "Equal employer contribution" },
          ].map((x) => (
            <div key={x.l} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${BD}` }}>
              <div><div style={{ fontSize: 12, color: T1 }}>{x.l}</div><div style={{ fontSize: 10.5, color: T3 }}>{x.note}</div></div>
              <div style={{ fontSize: 12, color: AM, fontFamily: "monospace" }}>{x.v}</div>
            </div>
          ))}
        </Card>
        <Card style={{ padding: "18px" }}>
          <SH title="SHIF & Housing Levy" sub="Replaced NHIF — effective October 2024" />
          {[
            { l: "SHIF Rate",    v: "2.75% of gross",              note: "Social Health Insurance Fund" },
            { l: "AHL Rate",     v: "1.5% of gross",                note: "Affordable Housing Levy" },
            { l: "SHIF Monthly", v: `KES ${shif.toLocaleString()}`, note: "No income cap applied" },
            { l: "AHL Monthly",  v: `KES ${ahl.toLocaleString()}`,  note: "Employer matches AHL" },
          ].map((x) => (
            <div key={x.l} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${BD}` }}>
              <div><div style={{ fontSize: 12, color: T1 }}>{x.l}</div><div style={{ fontSize: 10.5, color: T3 }}>{x.note}</div></div>
              <div style={{ fontSize: 12, color: OR, fontFamily: "monospace" }}>{x.v}</div>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );
}
