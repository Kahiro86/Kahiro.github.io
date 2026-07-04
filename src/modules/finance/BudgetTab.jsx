import { BD, GL, T1, T3, CY, GR, RE, AM } from "../../shared/designTokens.js";
import { Card, SH, Chip, MoneyInp } from "../../shared/ui.jsx";
import { useIsMobile } from "../../shared/useIsMobile.js";

export function BudgetTab({ netPay, budgets, setBudgets, totalBudgeted, totalSpent }) {
  const isMobile = useIsMobile();
  const setB = (i, key, v) => setBudgets((prev) => prev.map((x, j) => (j === i ? { ...x, [key]: +v || 0 } : x)));

  return (
    <div style={{ padding: isMobile ? "18px 14px" : "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T1 }}>Budget & Cash Flow</div>
          <div style={{ fontSize: 13, color: T3, marginTop: 3 }}>{new Date().toLocaleString("default", { month: "long", year: "numeric" })} · Pay yourself first</div>
        </div>
        {netPay > 0 && (
          <div style={{ padding: "8px 16px", background: `${GR}11`, border: `1px solid ${GR}22`, borderRadius: 9, fontSize: 13, color: GR, fontWeight: 700, fontFamily: "monospace" }}>
            Take-home: KES {netPay.toLocaleString()}
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(4,1fr)", gap: 12 }}>
        <Chip label="Total Budgeted" value={`KES ${totalBudgeted.toLocaleString()}`} color={CY} />
        <Chip label="Total Spent"    value={`KES ${totalSpent.toLocaleString()}`}    color={totalSpent > totalBudgeted ? RE : GR} />
        <Chip label="Remaining"      value={`KES ${Math.max(0, totalBudgeted - totalSpent).toLocaleString()}`} color={AM} />
        <Chip label="Net Surplus"    value={netPay > 0 ? `KES ${(netPay - totalBudgeted).toLocaleString()}` : "—"} color={netPay > totalBudgeted ? GR : RE} />
      </div>

      <Card style={{ padding: isMobile ? "16px 14px" : "22px" }}>
        <SH title="Monthly Category Budget" sub="Set budget and track actual spend" />

        {!isMobile && (
          <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 1fr 100px", gap: 10, paddingBottom: 10, marginBottom: 8, borderBottom: `1px solid ${BD}` }}>
            {["Category", "Budget (KES)", "Spent (KES)", "Status"].map((h) => (
              <div key={h} style={{ fontSize: 9.5, color: T3, letterSpacing: 1, textTransform: "uppercase" }}>{h}</div>
            ))}
          </div>
        )}

        {budgets.map((b, i) => {
          const pct = +b.budget > 0 ? Math.min(Math.round((+b.spent / +b.budget) * 100), 100) : 0;
          const over = +b.spent > +b.budget && +b.budget > 0;

          if (isMobile) {
            // Card per category — inputs stack, nothing scrolls sideways.
            return (
              <div key={b.id} style={{ padding: "12px", background: GL, border: `1px solid ${over ? RE + "44" : BD}`, borderRadius: 12, marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: b.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: T1, fontWeight: 600 }}>{b.cat}</span>
                  </div>
                  <span style={{ fontSize: 11, color: over ? RE : T3, fontWeight: over ? 700 : 400 }}>
                    {over ? `⚠ over by ${(+b.spent - +b.budget).toLocaleString()}` : `${pct}% used`}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9, marginBottom: 9 }}>
                  <label>
                    <span style={{ fontSize: 9, color: T3, letterSpacing: 0.5, textTransform: "uppercase" }}>Budget</span>
                    <div style={{ marginTop: 3 }}><MoneyInp value={b.budget || ""} onChange={(v) => setB(i, "budget", v)} /></div>
                  </label>
                  <label>
                    <span style={{ fontSize: 9, color: T3, letterSpacing: 0.5, textTransform: "uppercase" }}>Spent</span>
                    <div style={{ marginTop: 3 }}><MoneyInp value={b.spent || ""} onChange={(v) => setB(i, "spent", v)} /></div>
                  </label>
                </div>
                <div style={{ height: 5, background: BD, borderRadius: 3 }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: over ? RE : `linear-gradient(90deg,${b.color}77,${b.color})`, borderRadius: 3 }} />
                </div>
              </div>
            );
          }

          return (
            <div key={b.id} style={{ display: "grid", gridTemplateColumns: "160px 1fr 1fr 100px", gap: 10, alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${BD}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: b.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: T1 }}>{b.cat}</span>
              </div>
              <MoneyInp value={b.budget || ""} onChange={(v) => setB(i, "budget", v)} />
              <MoneyInp value={b.spent || ""} onChange={(v) => setB(i, "spent", v)} />
              <div>
                <div style={{ height: 6, background: BD, borderRadius: 3, marginBottom: 3 }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: over ? RE : `linear-gradient(90deg,${b.color}77,${b.color})`, borderRadius: 3 }} />
                </div>
                <div style={{ fontSize: 10, color: over ? RE : T3 }}>
                  {over ? `⚠ +${(+b.spent - +b.budget).toLocaleString()}` : `${pct}%`}
                </div>
              </div>
            </div>
          );
        })}
      </Card>
    </div>
  );
}
