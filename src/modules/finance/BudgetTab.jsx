import { BD, GL, T1, T3, CY, GR, RE, AM } from "../../shared/designTokens.js";
import { Card, SH, Chip } from "../../shared/ui.jsx";

export function BudgetTab({ netPay, budgets, setBudgets, totalBudgeted, totalSpent }) {
  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        <Chip label="Total Budgeted" value={`KES ${totalBudgeted.toLocaleString()}`} color={CY} />
        <Chip label="Total Spent"    value={`KES ${totalSpent.toLocaleString()}`}    color={totalSpent > totalBudgeted ? RE : GR} />
        <Chip label="Remaining"      value={`KES ${Math.max(0, totalBudgeted - totalSpent).toLocaleString()}`} color={AM} />
        <Chip label="Net Surplus"    value={netPay > 0 ? `KES ${(netPay - totalBudgeted).toLocaleString()}` : "—"} color={netPay > totalBudgeted ? GR : RE} />
      </div>

      <Card style={{ padding: "22px" }}>
        <SH title="Monthly Category Budget" sub="Set budget and track actual spend" />
        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr 1fr 100px", gap: 10, paddingBottom: 10, marginBottom: 8, borderBottom: `1px solid ${BD}` }}>
          {["Category", "Budget (KES)", "Spent (KES)", "Status"].map((h) => (
            <div key={h} style={{ fontSize: 9.5, color: T3, letterSpacing: 1, textTransform: "uppercase" }}>{h}</div>
          ))}
        </div>
        {budgets.map((b, i) => {
          const pct = +b.budget > 0 ? Math.min(Math.round((+b.spent / +b.budget) * 100), 100) : 0;
          const over = +b.spent > +b.budget && +b.budget > 0;
          return (
            <div key={b.id} style={{ display: "grid", gridTemplateColumns: "160px 1fr 1fr 100px", gap: 10, alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${BD}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: b.color, flexShrink: 0 }} />
                <span style={{ fontSize: 13, color: T1 }}>{b.cat}</span>
              </div>
              <input type="number" value={b.budget || ""} onChange={(e) => setBudgets((prev) => prev.map((x, j) => (j === i ? { ...x, budget: +e.target.value || 0 } : x)))} placeholder="0"
                style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, color: T1, outline: "none", fontFamily: "monospace", width: "100%", boxSizing: "border-box" }} />
              <input type="number" value={b.spent || ""} onChange={(e) => setBudgets((prev) => prev.map((x, j) => (j === i ? { ...x, spent: +e.target.value || 0 } : x)))} placeholder="0"
                style={{ background: GL, border: `1px solid ${over ? RE + "66" : BD}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, color: over ? RE : T1, outline: "none", fontFamily: "monospace", width: "100%", boxSizing: "border-box" }} />
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
