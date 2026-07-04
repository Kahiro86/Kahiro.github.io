import { useState } from "react";
import { localDateStr } from "../../shared/dates.js";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Plus, Trash2, Edit3, Check, Repeat, ChevronDown, ChevronRight } from "lucide-react";
import { BD, GL, T1, T2, T3, CY, PU, GR, RE, AM, OR } from "../../shared/designTokens.js";
import { Card, SH, Chip, Fld, Inp, Sel, Radio } from "../../shared/ui.jsx";
import { DonutChart, ChartLegend } from "../../shared/charts.jsx";
import { mkTT } from "../../shared/ChartTooltip.jsx";
import { useToast } from "../../shared/toast.jsx";
import { INCOME_SOURCES, INCOME_CATEGORIES, sourceColor } from "./constants.js";
import { incomeAnalytics, monthLabel } from "./income.js";

const emptyForm = () => ({
  amount: "", date: localDateStr(),
  source: "Salary", customSource: "", category: "Active", notes: "", recurring: false,
});

export function IncomeTab({ income, setIncome, fmtKES, gross, setGross, g, paye, nssf, shif, ahl, totalDed, netPay }) {
  const toast = useToast();
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [showSalary, setShowSalary] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const entries = [...(income || [])].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const a = incomeAnalytics(income);

  const resolveSource = () => (form.source === "Other" ? (form.customSource.trim() || "Other") : form.source);

  const save = () => {
    if (!(+form.amount > 0)) return;
    const entry = {
      id: editingId || `inc${Date.now().toString(36)}`,
      amount: +form.amount, date: form.date, source: resolveSource(),
      category: form.category, notes: form.notes.trim(), recurring: form.recurring,
    };
    setIncome((prev) => (editingId ? prev.map((e) => (e.id === editingId ? entry : e)) : [entry, ...prev]));
    setForm(emptyForm());
    setEditingId(null);
  };

  const edit = (e) => {
    const known = INCOME_SOURCES.includes(e.source);
    setForm({
      amount: String(e.amount), date: e.date,
      source: known ? e.source : "Other", customSource: known ? "" : e.source,
      category: e.category || "Active", notes: e.notes || "", recurring: !!e.recurring,
    });
    setEditingId(e.id);
  };

  const remove = (id) => {
    const entry = income.find((e) => e.id === id);
    setIncome((prev) => prev.filter((e) => e.id !== id));
    toast("Income entry deleted", { action: "Undo", onAction: () => setIncome((p) => [entry, ...p]), tone: "danger" });
    if (editingId === id) { setForm(emptyForm()); setEditingId(null); }
  };

  const pieData = a.bySource.map((s) => ({ name: s.source, value: s.total, color: sourceColor(s.source) }));

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: T1 }}>Income</div>
        <div style={{ fontSize: 13, color: T3, marginTop: 3 }}>Variable income tracking · unlimited sources · adapts to changing cash flow</div>
      </div>

      {/* Analytics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <Chip label="This Month" value={fmtKES(a.thisMonth)} color={CY} delta={a.momGrowth !== 0 && isFinite(a.momGrowth) ? Math.round(a.momGrowth) : undefined} />
        <Chip label="Avg / Month" value={fmtKES(a.avgMonthly)} color={PU} />
        <Chip label="Recurring" value={fmtKES(a.recurringTotal)} color={GR} />
        <Chip label="Income Sources" value={a.diversification} color={AM} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
        <Card style={{ padding: "18px" }}>
          <SH title="Income Trend" sub="Last 8 months — every month adapts to what you logged" />
          {a.totalAll > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={a.trend} margin={{ top: 4, right: 0, bottom: 0, left: -12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={BD} />
                <XAxis dataKey="label" stroke={T3} fontSize={10.5} tickLine={false} axisLine={false} />
                <YAxis stroke={T3} fontSize={10.5} tickLine={false} axisLine={false} tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} />
                <Tooltip content={mkTT("KES ")} />
                <Bar dataKey="total" radius={[5, 5, 0, 0]} fill={CY} fillOpacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ padding: "50px 0", textAlign: "center", color: T3, fontSize: 13 }}>Log your first income entry to see trends.</div>
          )}
          <div style={{ display: "flex", gap: 16, marginTop: 12, flexWrap: "wrap" }}>
            <div style={{ fontSize: 11, color: T3 }}>
              <span style={{ color: GR, fontWeight: 700 }}>▲ Best: </span>{a.highest ? `${monthLabel(a.highest.month)} · ${fmtKES(a.highest.total)}` : "—"}
            </div>
            <div style={{ fontSize: 11, color: T3 }}>
              <span style={{ color: AM, fontWeight: 700 }}>▼ Lowest: </span>{a.lowest ? `${monthLabel(a.lowest.month)} · ${fmtKES(a.lowest.total)}` : "—"}
            </div>
          </div>
        </Card>

        <Card style={{ padding: "18px" }}>
          <SH title="Source Contribution" sub="Share of total income by source — track diversification" />
          {pieData.length > 0 ? (
            <>
              <DonutChart data={pieData} height={190} centerLabel={a.diversification} centerSub="Sources" />
              <ChartLegend data={pieData} fmt={(v) => fmtKES(v)} />
            </>
          ) : (
            <div style={{ padding: "50px 0", textAlign: "center", color: T3, fontSize: 13 }}>Add income from a few sources to see the breakdown.</div>
          )}
        </Card>
      </div>

      {/* Add / edit entry */}
      <Card style={{ padding: "20px", borderColor: editingId ? CY + "44" : BD }}>
        <SH title={editingId ? "Edit Income Entry" : "Log Income"} sub="Record any income — salary, trading, freelance, gifts, anything" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 13 }}>
          <Fld label="Amount" required><Inp type="number" value={form.amount} onChange={(v) => set("amount", v)} placeholder="0" mono /></Fld>
          <Fld label="Date Received" required><Inp type="date" value={form.date} onChange={(v) => set("date", v)} /></Fld>
          <Fld label="Source" required><Sel value={form.source} onChange={(v) => set("source", v)} options={INCOME_SOURCES} /></Fld>
          <Fld label="Category"><Sel value={form.category} onChange={(v) => set("category", v)} options={INCOME_CATEGORIES} /></Fld>
        </div>
        {form.source === "Other" && (
          <Fld label="Custom Source Name"><Inp value={form.customSource} onChange={(v) => set("customSource", v)} placeholder="e.g. Rental income" /></Fld>
        )}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 13 }}>
          <Fld label="Recurring?" hint="Repeats each period">
            <Radio value={form.recurring ? "YES" : "NO"} onChange={(v) => set("recurring", v === "YES")} options={["YES", "NO"]} color={GR} />
          </Fld>
          <Fld label="Notes"><Inp value={form.notes} onChange={(v) => set("notes", v)} placeholder="Optional note" /></Fld>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button onClick={save} disabled={!(+form.amount > 0)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 18px", background: +form.amount > 0 ? `linear-gradient(135deg,${CY},${PU})` : GL, border: "none", borderRadius: 10, color: +form.amount > 0 ? "#000" : T3, fontSize: 13, fontWeight: 700, cursor: +form.amount > 0 ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
            {editingId ? <Check size={14} /> : <Plus size={14} />}{editingId ? "Update Entry" : "Add Income"}
          </button>
          {editingId && (
            <button onClick={() => { setForm(emptyForm()); setEditingId(null); }} style={{ padding: "9px 16px", background: GL, border: `1px solid ${BD}`, borderRadius: 10, color: T2, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
          )}
        </div>
      </Card>

      {/* Ledger */}
      <Card style={{ padding: "20px" }}>
        <SH title="Income Ledger" sub={`${entries.length} ${entries.length === 1 ? "entry" : "entries"} · newest first`} />
        {entries.length === 0 ? (
          <div style={{ padding: "30px 0", textAlign: "center", color: T3, fontSize: 13 }}>No income logged yet. Add your first entry above.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {entries.map((e) => {
              const col = sourceColor(e.source);
              return (
                <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 13px", background: GL, border: `1px solid ${BD}`, borderLeft: `3px solid ${col}`, borderRadius: 10 }}>
                  <div style={{ minWidth: 78 }}>
                    <div style={{ fontSize: 11.5, color: T1, fontFamily: "monospace" }}>{e.date?.slice(5)}</div>
                    <div style={{ fontSize: 9.5, color: T3 }}>{e.date?.slice(0, 4)}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                      <span style={{ fontSize: 12.5, color: T1, fontWeight: 600 }}>{e.source}</span>
                      <span style={{ fontSize: 9.5, padding: "1px 7px", borderRadius: 10, background: `${col}22`, color: col, border: `1px solid ${col}44` }}>{e.category}</span>
                      {e.recurring && <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9.5, color: GR }}><Repeat size={9} />recurring</span>}
                    </div>
                    {e.notes && <div style={{ fontSize: 10.5, color: T3, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.notes}</div>}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: GR, fontFamily: "monospace", whiteSpace: "nowrap" }}>+{fmtKES(e.amount)}</div>
                  <div style={{ display: "flex", gap: 5 }}>
                    <button onClick={() => edit(e)} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 6, padding: "5px 6px", cursor: "pointer", color: T2, display: "flex" }}><Edit3 size={12} /></button>
                    <button onClick={() => remove(e.id)} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 6, padding: "5px 6px", cursor: "pointer", color: RE, display: "flex" }}><Trash2 size={12} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Kenya statutory salary calculator — secondary, optional */}
      <Card style={{ padding: showSalary ? "20px" : "14px 20px" }}>
        <div onClick={() => setShowSalary((s) => !s)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: T1 }}>Salary & Statutory Deductions (Kenya)</div>
            <div style={{ fontSize: 11, color: T3, marginTop: 2 }}>Optional — PAYE · NSSF · SHIF · AHL for salaried income</div>
          </div>
          {showSalary ? <ChevronDown size={16} color={T3} /> : <ChevronRight size={16} color={T3} />}
        </div>

        {showSalary && (
          <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 22 }}>
              <div>
                <div style={{ fontSize: 10, color: T3, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>Gross Monthly Salary</div>
                <input type="number" value={gross} onChange={(e) => setGross(e.target.value)} placeholder="e.g. 80000"
                  style={{ width: "100%", background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: "14px 16px", fontSize: 24, color: T1, outline: "none", fontFamily: "monospace", fontWeight: 800, boxSizing: "border-box" }} />
                {g > 0 && (
                  <div style={{ marginTop: 12, padding: "12px", background: `${CY}0A`, border: `1px solid ${CY}22`, borderRadius: 10, fontSize: 12, color: T2, lineHeight: 1.7 }}>
                    Personal relief KES 2,400/month auto-applied. Effective rate {((totalDed / g) * 100).toFixed(1)}%.
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: 10, color: T3, letterSpacing: 1, marginBottom: 8, textTransform: "uppercase" }}>Deductions</div>
                {[
                  { l: "PAYE Tax", v: paye, c: RE },
                  { l: "NSSF Tier I + II", v: nssf, c: AM },
                  { l: "SHIF (2.75%)", v: shif, c: OR },
                  { l: "Housing Levy (1.5%)", v: ahl, c: PU },
                ].map((x) => (
                  <div key={x.l} style={{ display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: `1px solid ${BD}` }}>
                    <span style={{ fontSize: 12.5, color: T1 }}>{x.l}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: x.c, fontFamily: "monospace" }}>KES {x.v.toLocaleString()}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "11px 0 0" }}>
                  <span style={{ fontSize: 13, color: GR, fontWeight: 700 }}>Take-Home</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: GR, fontFamily: "monospace" }}>KES {netPay.toLocaleString()}</span>
                </div>
              </div>
            </div>
            {netPay > 0 && (
              <div>
                <div style={{ fontSize: 12, color: T3, marginBottom: 10 }}>Recommended pay-yourself-first split:</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10 }}>
                  {[
                    { l: "Emergency (5%)", v: Math.round(netPay * 0.05), c: GR },
                    { l: "Savings (15%)", v: Math.round(netPay * 0.15), c: CY },
                    { l: "Investments (20%)", v: Math.round(netPay * 0.20), c: PU },
                    { l: "Living (60%)", v: Math.round(netPay * 0.60), c: AM },
                  ].map((x) => (
                    <div key={x.l} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: "13px" }}>
                      <div style={{ fontSize: 10, color: T3, marginBottom: 6 }}>{x.l}</div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: x.c, fontFamily: "monospace" }}>KES {x.v.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
                <div style={{ marginTop: 10, fontSize: 11, color: T3 }}>
                  Tip: add your take-home as a <strong style={{ color: T2 }}>Salary</strong> income entry above so it counts toward your monthly totals and trends.
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
