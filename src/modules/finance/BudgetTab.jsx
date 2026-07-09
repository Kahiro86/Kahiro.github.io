import { useMemo, useState } from "react";
import { Plus, Check, Trash2 } from "lucide-react";
import { B2, BD, GL, T1, T2, T3, CY, GR, RE, AM } from "../../shared/designTokens.js";
import { Card, SH, Chip, MoneyInp } from "../../shared/ui.jsx";
import { useIsMobile } from "../../shared/useIsMobile.js";
import { localDateStr } from "../../shared/dates.js";
import { newBill, sanitizeBills, daysUntilDue, isPaidThisCycle, billsDueSoon, monthlyBillsTotal } from "./bills.js";

export function BudgetTab({ netPay, budgets, setBudgets, totalBudgeted, totalSpent, bills, setBills, income }) {
  const isMobile = useIsMobile();
  const setB = (i, key, v) => setBudgets((prev) => prev.map((x, j) => (j === i ? { ...x, [key]: +v || 0 } : x)));

  // ── Bills ────────────────────────────────────────────────────────
  const list = useMemo(() => sanitizeBills(bills), [bills]);
  const [billDraft, setBillDraft] = useState(null); // { name, amount, dueDay }
  const today = localDateStr();
  const ym = today.slice(0, 7);
  const dueSoon = billsDueSoon(list, today);
  const billsTotal = monthlyBillsTotal(list);
  const saveBill = () => {
    if (!billDraft?.name?.trim()) return;
    setBills((prev) => [newBill({ name: billDraft.name.trim(), amount: +billDraft.amount || 0, dueDay: Math.min(31, Math.max(1, +billDraft.dueDay || 1)) }), ...sanitizeBills(prev)]);
    setBillDraft(null);
  };
  const markPaid = (b) => setBills((prev) => sanitizeBills(prev).map((x) => (x.id === b.id ? { ...x, lastPaidMonth: isPaidThisCycle(x, today) ? "" : ym } : x)));
  const deleteBill = (b) => setBills((prev) => sanitizeBills(prev).filter((x) => x.id !== b.id));

  // ── Cash flow this month (dated income vs planned outflow) ────────
  const incomeThisMonth = (Array.isArray(income) ? income : []).filter((e) => e && (e.date || "").slice(0, 7) === ym)
    .reduce((s, e) => s + (+e.amount || 0), 0);
  const plannedOut = totalBudgeted + billsTotal;
  const netFlow = incomeThisMonth - plannedOut;
  const billInp = { background: B2, border: `1px solid ${BD}`, borderRadius: 9, padding: "8px 11px", fontSize: 12.5, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };

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

      <Card style={{ padding: isMobile ? "16px 14px" : "20px 22px" }}>
        <SH title="Cash Flow · this month" sub="Logged income vs planned outflow (budget + bills)" />
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(3,1fr)", gap: 12 }}>
          <Chip label="Income logged" value={`KES ${Math.round(incomeThisMonth).toLocaleString()}`} color={GR} />
          <Chip label="Planned out"   value={`KES ${Math.round(plannedOut).toLocaleString()}`} color={AM} />
          <Chip label="Net flow"      value={`${netFlow >= 0 ? "+" : "−"}KES ${Math.abs(Math.round(netFlow)).toLocaleString()}`} color={netFlow >= 0 ? GR : RE} />
        </div>
        <div style={{ height: 6, background: BD, borderRadius: 3, marginTop: 12, overflow: "hidden", display: "flex" }}>
          <div style={{ width: `${incomeThisMonth + plannedOut > 0 ? Math.round((incomeThisMonth / Math.max(incomeThisMonth, plannedOut)) * 100) : 0}%`, background: GR }} />
        </div>
        <div style={{ fontSize: 10, color: T3, marginTop: 6 }}>Income covers {plannedOut > 0 ? Math.round((incomeThisMonth / plannedOut) * 100) : 0}% of this month's planned outflow.</div>
      </Card>

      <Card style={{ padding: isMobile ? "16px 14px" : "20px 22px" }}>
        <SH title="Bills" sub={`KES ${billsTotal.toLocaleString()}/month across ${list.length} bill${list.length === 1 ? "" : "s"}${dueSoon.length ? ` · ${dueSoon.length} due soon` : ""}`}
          action={!billDraft && (
            <button onClick={() => setBillDraft({ name: "", amount: "", dueDay: "" })}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: `${AM}14`, border: `1px solid ${AM}44`, borderRadius: 9, color: AM, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
              <Plus size={12} />Add bill
            </button>
          )} />
        {billDraft && (
          <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            <input autoFocus value={billDraft.name} onChange={(e) => setBillDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Bill (rent, wifi, tithe…)" style={{ ...billInp, flex: 2, minWidth: 140 }} />
            <input value={billDraft.amount} onChange={(e) => setBillDraft((d) => ({ ...d, amount: e.target.value.replace(/[^0-9]/g, "") }))} placeholder="KES" inputMode="numeric" style={{ ...billInp, flex: 1, minWidth: 80 }} />
            <input value={billDraft.dueDay} onChange={(e) => setBillDraft((d) => ({ ...d, dueDay: e.target.value.replace(/[^0-9]/g, "") }))} placeholder="Due day" inputMode="numeric" style={{ ...billInp, width: 80 }} />
            <button onClick={saveBill} disabled={!billDraft.name.trim()} style={{ padding: "8px 15px", background: billDraft.name.trim() ? `${AM}18` : GL, border: `1px solid ${billDraft.name.trim() ? AM + "55" : BD}`, borderRadius: 9, color: billDraft.name.trim() ? AM : T3, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Save</button>
            <button onClick={() => setBillDraft(null)} style={{ padding: "8px 12px", background: GL, border: `1px solid ${BD}`, borderRadius: 9, color: T2, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          </div>
        )}
        {list.length === 0 && !billDraft && (
          <div style={{ padding: "16px 6px", fontSize: 12, color: T3, textAlign: "center" }}>No bills yet. Add rent, wifi, subscriptions — due-soon reminders reach the Command Center.</div>
        )}
        {[...list].sort((a2, b2) => daysUntilDue(a2, today) - daysUntilDue(b2, today)).map((b) => {
          const paid = isPaidThisCycle(b, today);
          const days = daysUntilDue(b, today);
          const urgent = !paid && days <= 7;
          return (
            <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", background: paid ? `${GR}08` : urgent ? `${AM}0A` : GL, border: `1px solid ${paid ? GR + "33" : urgent ? AM + "44" : BD}`, borderRadius: 10, marginBottom: 7, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 130 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: T1 }}>{b.name}</div>
                <div style={{ fontSize: 10.5, color: paid ? GR : urgent ? AM : T3 }}>
                  {paid ? "Paid this month ✓" : days === 0 ? "Due TODAY" : `Due in ${days}d (day ${b.dueDay})`}
                </div>
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 800, color: T1, fontFamily: "monospace" }}>KES {(+b.amount || 0).toLocaleString()}</span>
              <button onClick={() => markPaid(b)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", background: paid ? GL : `${GR}14`, border: `1px solid ${paid ? BD : GR + "44"}`, borderRadius: 9, color: paid ? T3 : GR, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {paid ? "Unmark" : <><Check size={11} />Mark paid</>}
              </button>
              <button onClick={() => deleteBill(b)} aria-label={`Delete ${b.name}`} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: RE, display: "flex" }}><Trash2 size={11} /></button>
            </div>
          );
        })}
      </Card>

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
