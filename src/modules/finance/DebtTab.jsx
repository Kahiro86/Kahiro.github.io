import { useState } from "react";
import { Plus, Pencil, Trash2, Check, X, CalendarClock, TrendingDown, ChevronDown } from "lucide-react";
import { T1, T2, T3, BD, B2, GL, CY, PU, GR, RE, AM } from "../../shared/designTokens.js";
import { Card, SH, Chip, MoneyInp } from "../../shared/ui.jsx";
import { useToast } from "../../shared/toast.jsx";
import { localDateStr } from "../../shared/dates.js";
import { debtId, paidOf, remainingOf, progressOf, payoffMonths, daysUntilDue } from "./debt.js";

const monthsLabel = (m) => (m == null ? "—" : m < 12 ? `${m} mo` : `${Math.floor(m / 12)}y ${m % 12}m`);
const etaDate = (m) => { const d = new Date(); d.setMonth(d.getMonth() + m); return d.toLocaleDateString("en-US", { month: "short", year: "numeric" }); };

export function DebtTab({ debts = [], setDebts, fmtKES, legacyDebt = 0 }) {
  const [editing, setEditing] = useState(null); // debt id | "new"
  const [draft, setDraft] = useState(null);
  const [payFor, setPayFor] = useState(null);
  const [payAmt, setPayAmt] = useState("");
  const [expanded, setExpanded] = useState(null);
  const toast = useToast();

  const totalRemaining = debts.reduce((s, d) => s + remainingOf(d), 0);
  const totalMin = debts.reduce((s, d) => s + (+d.minPayment || 0), 0);
  const ym = localDateStr().slice(0, 7);
  const paidThisMonth = debts.reduce((s, d) => s + (d.payments || []).filter((p) => (p.date || "").slice(0, 7) === ym).reduce((a, p) => a + (+p.amount || 0), 0), 0);
  const longest = debts.reduce((m, d) => { const pm = payoffMonths(d); return pm == null ? m : Math.max(m, pm); }, 0);

  const startNew = () => { setEditing("new"); setDraft({ id: debtId(), name: "", original: "", apr: "", minPayment: "", dueDay: "", payments: [], createdAt: localDateStr() }); };
  const startEdit = (d) => { setEditing(d.id); setDraft({ ...d }); };
  const cancel = () => { setEditing(null); setDraft(null); };
  const save = () => {
    if (!draft.name.trim() || !(+draft.original > 0)) return;
    const clean = { ...draft, name: draft.name.trim(), original: +draft.original || 0, apr: +draft.apr || 0, minPayment: +draft.minPayment || 0, dueDay: +draft.dueDay || 0 };
    setDebts((prev) => (prev.some((x) => x.id === clean.id) ? prev.map((x) => (x.id === clean.id ? clean : x)) : [...prev, clean]));
    cancel();
  };
  const del = (id) => {
    const d = debts.find((x) => x.id === id);
    setDebts((prev) => prev.filter((x) => x.id !== id));
    toast(`"${d?.name}" removed`, { action: "Undo", onAction: () => setDebts((p) => [...p, d]), tone: "danger" });
  };
  const recordPayment = (d) => {
    const amt = +payAmt;
    setPayFor(null); setPayAmt("");
    if (!amt) return;
    setDebts((prev) => prev.map((x) => (x.id === d.id ? { ...x, payments: [...(x.payments || []), { id: debtId(), date: localDateStr(), amount: amt }] } : x)));
    toast(`${fmtKES(amt)} paid toward "${d.name}"`, { tone: "success" });
  };

  const inp = { width: "100%", background: B2, border: `1px solid ${BD}`, borderRadius: 8, padding: "9px 11px", fontSize: 13, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  const lbl = { fontSize: 10, color: T3, letterSpacing: 0.5, textTransform: "uppercase", display: "block", marginBottom: 4 };

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T1 }}>Debt</div>
          <div style={{ fontSize: 13, color: T3, marginTop: 3 }}>Track balances, log repayments, watch the payoff date move closer</div>
        </div>
        {editing == null && <button onClick={startNew} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: `linear-gradient(135deg,${RE},${AM})`, border: "none", borderRadius: 10, color: "#000", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}><Plus size={14} />Add Debt</button>}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
        <Chip label="Total Debt" value={fmtKES(totalRemaining)} color={totalRemaining > 0 ? RE : GR} />
        <Chip label="Min / month" value={fmtKES(totalMin)} color={AM} />
        <Chip label="Paid this month" value={fmtKES(paidThisMonth)} color={GR} />
        <Chip label="Debt-free in" value={debts.length ? monthsLabel(longest) : "—"} color={CY} />
      </div>

      {editing != null && draft && (
        <Card style={{ padding: "20px", borderColor: RE + "44" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T1, marginBottom: 14 }}>{editing === "new" ? "New Debt" : "Edit Debt"}</div>
          <input autoFocus value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Name (e.g. Personal loan, Card)" style={{ ...inp, marginBottom: 12 }} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 11, marginBottom: 14 }}>
            <label><span style={lbl}>Original balance</span><MoneyInp value={draft.original} onChange={(v) => setDraft((d) => ({ ...d, original: v }))} placeholder="0" /></label>
            <label><span style={lbl}>APR %</span><input type="number" value={draft.apr} onChange={(e) => setDraft((d) => ({ ...d, apr: e.target.value }))} placeholder="0" style={{ ...inp, fontFamily: "monospace" }} /></label>
            <label><span style={lbl}>Min payment / mo</span><MoneyInp value={draft.minPayment} onChange={(v) => setDraft((d) => ({ ...d, minPayment: v }))} placeholder="0" /></label>
            <label><span style={lbl}>Due day (1–31)</span><input type="number" min="1" max="31" value={draft.dueDay} onChange={(e) => setDraft((d) => ({ ...d, dueDay: e.target.value }))} placeholder="—" style={{ ...inp, fontFamily: "monospace" }} /></label>
          </div>
          <div style={{ display: "flex", gap: 9, justifyContent: "flex-end" }}>
            <button onClick={cancel} style={{ padding: "8px 15px", background: GL, border: `1px solid ${BD}`, borderRadius: 9, color: T2, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
            <button onClick={save} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", background: `linear-gradient(135deg,${GR},${CY})`, border: "none", borderRadius: 9, color: "#000", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}><Check size={13} />Save Debt</button>
          </div>
        </Card>
      )}

      {debts.length === 0 && editing == null ? (
        <Card style={{ padding: "38px", textAlign: "center" }}>
          <div style={{ fontSize: 28, marginBottom: 10 }}>🎯</div>
          <div style={{ fontSize: 14, color: T2, marginBottom: 6 }}>{legacyDebt > 0 ? `You have ${fmtKES(legacyDebt)} recorded as a single figure` : "No debts tracked"}</div>
          <div style={{ fontSize: 12, color: T3, marginBottom: 14 }}>{legacyDebt > 0 ? "Add it here to get repayment tracking, history and a payoff date." : "Add a debt to track repayments and see your payoff timeline."}</div>
          <button onClick={startNew} style={{ padding: "9px 18px", background: `${RE}18`, border: `1px solid ${RE}44`, borderRadius: 10, color: RE, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Add your first debt</button>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 14 }}>
          {debts.map((d) => {
            const remaining = remainingOf(d), paid = paidOf(d), pct = progressOf(d), pm = payoffMonths(d);
            const due = daysUntilDue(d.dueDay), cleared = remaining <= 0;
            const recent = (d.payments || []).slice(-4).reverse();
            return (
              <Card key={d.id} style={{ padding: "18px", borderColor: cleared ? GR + "55" : RE + "22" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T1 }}>{d.name}</div>
                    <div style={{ fontSize: 10.5, color: T3, marginTop: 2 }}>
                      {d.apr > 0 ? `${d.apr}% APR` : "0% APR"}{d.minPayment > 0 ? ` · min ${fmtKES(d.minPayment)}/mo` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => { setPayFor(payFor === d.id ? null : d.id); setPayAmt(""); }} title="Record payment" style={{ background: `${GR}12`, border: `1px solid ${GR}44`, borderRadius: 7, padding: "4px 8px", cursor: "pointer", color: GR, fontSize: 11, fontWeight: 700, fontFamily: "inherit" }}>Pay</button>
                    <button onClick={() => startEdit(d)} title="Edit" style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 7, padding: "4px 6px", cursor: "pointer", color: T2, display: "flex" }}><Pencil size={12} /></button>
                    <button onClick={() => del(d.id)} title="Delete" style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 7, padding: "4px 6px", cursor: "pointer", color: RE, display: "flex" }}><Trash2 size={12} /></button>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 7 }}>
                  <span style={{ fontSize: 22, fontWeight: 900, color: cleared ? GR : RE, fontFamily: "monospace" }}>{fmtKES(remaining)}</span>
                  <span style={{ fontSize: 11, color: T3 }}>left of {fmtKES(+d.original || 0)}</span>
                </div>
                <div style={{ height: 7, background: BD, borderRadius: 4, marginBottom: 6, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: cleared ? GR : `linear-gradient(90deg,${GR}77,${GR})`, borderRadius: 4, transition: "width 0.6s ease" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: T3, marginBottom: 11 }}>
                  <span>{pct}% paid · {fmtKES(paid)}</span>
                  {cleared ? <span style={{ color: GR, fontWeight: 700 }}>✓ Cleared</span>
                    : <span style={{ display: "flex", alignItems: "center", gap: 4, color: pm == null ? RE : CY }}><TrendingDown size={11} />{pm == null ? "raise payment" : `${monthsLabel(pm)} · ${etaDate(pm)}`}</span>}
                </div>

                {payFor === d.id && (
                  <div style={{ display: "flex", gap: 7, marginBottom: 11 }}>
                    <input type="number" autoFocus value={payAmt} onChange={(e) => setPayAmt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") recordPayment(d); if (e.key === "Escape") setPayFor(null); }} placeholder="Payment amount (KES)"
                      style={{ flex: 1, background: B2, border: `1px solid ${GR}44`, borderRadius: 8, padding: "8px 10px", fontSize: 12.5, color: T1, outline: "none", fontFamily: "monospace", minWidth: 0 }} />
                    <button onClick={() => recordPayment(d)} style={{ padding: "0 13px", background: `${GR}22`, border: `1px solid ${GR}55`, borderRadius: 8, color: GR, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Log</button>
                  </div>
                )}

                {due != null && !cleared && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: due <= 3 ? AM : T3, marginBottom: recent.length ? 10 : 0 }}>
                    <CalendarClock size={12} />{due === 0 ? "Payment due today" : due === 1 ? "Due tomorrow" : `Next payment due in ${due} days`}
                  </div>
                )}

                {recent.length > 0 && (
                  <div style={{ paddingTop: 10, borderTop: `1px solid ${BD}` }}>
                    <button onClick={() => setExpanded(expanded === d.id ? null : d.id)} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", color: T3, fontSize: 10.5, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                      <ChevronDown size={12} style={{ transform: expanded === d.id ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />Payment history ({(d.payments || []).length})
                    </button>
                    {(expanded === d.id ? [...(d.payments || [])].reverse() : recent).map((p) => (
                      <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T3, marginTop: 5 }}>
                        <span>{new Date(`${p.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                        <span style={{ color: GR, fontFamily: "monospace" }}>−{fmtKES(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
