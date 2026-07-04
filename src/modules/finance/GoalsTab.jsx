import { useState } from "react";
import { Plus, Pencil, Archive, ArchiveRestore, Trash2, Check, X, TrendingUp, Cpu } from "lucide-react";
import { T1, T2, T3, BD, BD2, GL, B2, CY, PU, GR, RE, AM, OR } from "../../shared/designTokens.js";
import { Card } from "../../shared/ui.jsx";
import { localDateStr } from "../../shared/dates.js";
import { useToast } from "../../shared/toast.jsx";

const GOAL_COLORS = [GR, CY, PU, AM, OR, RE];
const GOAL_ICONS = ["🎯", "🛡️", "📈", "💰", "⚡", "🏠", "🚗", "✈️", "🎓", "💍"];
const today = () => localDateStr();
const addMonths = (n) => { const d = new Date(); d.setMonth(d.getMonth() + n); return d; };
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");
const monthsBetween = (a, b) => (new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24 * 30.44);

// Derived analytics for a single goal.
function analyse(g) {
  const target = +g.target || 0;
  const current = +g.current || 0;
  const monthly = +g.monthly || 0;
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const remaining = Math.max(0, target - current);
  const done = pct >= 100;
  const monthsToGo = monthly > 0 && remaining > 0 ? Math.ceil(remaining / monthly) : null;
  const eta = monthsToGo != null ? addMonths(monthsToGo) : null;
  const totalContributed = (g.history || []).reduce((s, h) => s + (+h.amount || 0), 0);

  // Ahead/behind schedule vs a linear path from createdAt → deadline.
  let schedule = null;
  const created = g.createdAt || null;
  if (g.deadline && created && target > 0 && !done) {
    const totalMonths = monthsBetween(created, g.deadline);
    const elapsed = monthsBetween(created, today());
    if (totalMonths > 0) {
      const expectedPct = Math.min(100, Math.max(0, (elapsed / totalMonths) * 100));
      const diff = Math.round(pct - expectedPct);
      schedule = { expectedPct: Math.round(expectedPct), diff, state: diff >= 5 ? "ahead" : diff <= -5 ? "behind" : "ontrack" };
    }
    if (eta) schedule = { ...schedule, willMeetDeadline: eta <= new Date(g.deadline) };
  }
  return { pct, remaining, done, monthsToGo, eta, totalContributed, schedule };
}

export function GoalsTab({ goals = [], setGoals, fmtKES, liveMetrics }) {
  const [editing, setEditing] = useState(null); // goal id being edited, or "new"
  const [draft, setDraft] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [contribFor, setContribFor] = useState(null); // goal id with the inline contribution field open
  const [contribAmt, setContribAmt] = useState("");
  const toast = useToast();

  const active = goals.filter((g) => !g.archived);
  const archived = goals.filter((g) => g.archived);

  const startEdit = (g) => { setEditing(g.id); setDraft({ ...g }); };
  const startNew = () => {
    setEditing("new");
    setDraft({ id: `g_${Date.now().toString(36)}`, name: "", icon: "🎯", target: "", current: "", monthly: "", deadline: "", color: GOAL_COLORS[goals.length % GOAL_COLORS.length], archived: false, createdAt: today(), history: [] });
  };
  const cancel = () => { setEditing(null); setDraft(null); };
  const saveDraft = () => {
    if (!draft.name.trim()) return;
    const clean = { ...draft, target: +draft.target || 0, current: +draft.current || 0, monthly: +draft.monthly || 0, createdAt: draft.createdAt || today() };
    setGoals((prev) => (prev.some((x) => x.id === clean.id) ? prev.map((x) => (x.id === clean.id ? clean : x)) : [...prev, clean]));
    cancel();
  };
  const update = (id, patch) => setGoals((prev) => prev.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const del = (id) => {
    const g = goals.find((x) => x.id === id);
    setGoals((prev) => prev.filter((x) => x.id !== id));
    toast(`"${g?.name}" deleted`, { action: "Undo", onAction: () => setGoals((p) => [...p, g]), tone: "danger" });
  };
  const submitContribution = (g) => {
    const amt = +contribAmt;
    setContribFor(null);
    setContribAmt("");
    if (!amt) return;
    update(g.id, { current: Math.max(0, (+g.current || 0) + amt), history: [...(g.history || []), { date: today(), amount: amt }] });
    toast(`${fmtKES(Math.abs(amt))} ${amt > 0 ? "added to" : "corrected on"} "${g.name}"`, { tone: "success" });
  };

  const editForm = draft && (
    <Card style={{ padding: "20px", borderColor: CY + "44" }}>
      <div style={{ fontSize: 14, fontWeight: 700, color: T1, marginBottom: 14 }}>{editing === "new" ? "New Goal" : "Edit Goal"}</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        {GOAL_ICONS.map((ic) => (
          <button key={ic} onClick={() => setDraft((d) => ({ ...d, icon: ic }))} style={{ width: 34, height: 34, borderRadius: 9, fontSize: 16, cursor: "pointer", background: draft.icon === ic ? `${CY}22` : GL, border: `1px solid ${draft.icon === ic ? CY + "66" : BD}` }}>{ic}</button>
        ))}
      </div>
      <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Goal name (e.g. House Deposit)"
        style={{ width: "100%", background: B2, border: `1px solid ${BD}`, borderRadius: 8, padding: "9px 11px", fontSize: 13, color: T1, outline: "none", fontFamily: "inherit", marginBottom: 11, boxSizing: "border-box" }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11, marginBottom: 11 }}>
        {[
          { k: "target", ph: "Target amount (KES)", lbl: "Target" },
          { k: "current", ph: "Current amount (KES)", lbl: "Current progress" },
          { k: "monthly", ph: "Monthly contribution (KES)", lbl: "Monthly saving" },
        ].map((f) => (
          <label key={f.k} style={{ display: "block" }}>
            <span style={{ fontSize: 10, color: T3, letterSpacing: 0.5, textTransform: "uppercase" }}>{f.lbl}</span>
            <input type="number" value={draft[f.k]} onChange={(e) => setDraft((d) => ({ ...d, [f.k]: e.target.value }))} placeholder={f.ph}
              style={{ width: "100%", background: B2, border: `1px solid ${BD}`, borderRadius: 8, padding: "8px 11px", fontSize: 13, color: T1, outline: "none", fontFamily: "monospace", marginTop: 4, boxSizing: "border-box" }} />
          </label>
        ))}
        <label style={{ display: "block" }}>
          <span style={{ fontSize: 10, color: T3, letterSpacing: 0.5, textTransform: "uppercase" }}>Deadline</span>
          <input type="date" value={draft.deadline} onChange={(e) => setDraft((d) => ({ ...d, deadline: e.target.value }))}
            style={{ width: "100%", background: B2, border: `1px solid ${BD}`, borderRadius: 8, padding: "8px 11px", fontSize: 13, color: T1, outline: "none", fontFamily: "inherit", marginTop: 4, boxSizing: "border-box" }} />
        </label>
      </div>
      <div style={{ display: "flex", gap: 7, marginBottom: 14 }}>
        {GOAL_COLORS.map((c) => (
          <button key={c} onClick={() => setDraft((d) => ({ ...d, color: c }))} style={{ width: 26, height: 26, borderRadius: "50%", background: c, cursor: "pointer", border: draft.color === c ? `2px solid ${T1}` : `2px solid transparent` }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 9, justifyContent: "flex-end" }}>
        <button onClick={cancel} style={{ padding: "8px 15px", background: GL, border: `1px solid ${BD}`, borderRadius: 9, color: T2, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
        <button onClick={saveDraft} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", background: `linear-gradient(135deg,${GR},${CY})`, border: "none", borderRadius: 9, color: "#000", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}><Check size={13} />Save Goal</button>
      </div>
    </Card>
  );

  const GoalCard = ({ g }) => {
    const a = analyse(g);
    const recent = (g.history || []).slice(-4).reverse();
    return (
      <Card style={{ padding: "18px", borderColor: a.done ? GR + "55" : g.color + "22", opacity: g.archived ? 0.62 : 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
          <div style={{ fontSize: 22 }}>{g.icon}</div>
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => { setContribFor(contribFor === g.id ? null : g.id); setContribAmt(""); }} title="Add contribution" style={{ background: contribFor === g.id ? `${GR}18` : GL, border: `1px solid ${contribFor === g.id ? GR + "55" : BD}`, borderRadius: 7, padding: "4px 6px", cursor: "pointer", color: GR, display: "flex" }}><Plus size={12} /></button>
            <button onClick={() => startEdit(g)} title="Edit" style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 7, padding: "4px 6px", cursor: "pointer", color: T2, display: "flex" }}><Pencil size={12} /></button>
            <button onClick={() => update(g.id, { archived: !g.archived })} title={g.archived ? "Restore" : "Archive"} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 7, padding: "4px 6px", cursor: "pointer", color: g.archived ? GR : AM, display: "flex" }}>{g.archived ? <ArchiveRestore size={12} /> : <Archive size={12} />}</button>
            <button onClick={() => del(g.id)} title="Delete" style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 7, padding: "4px 6px", cursor: "pointer", color: RE, display: "flex" }}><Trash2 size={12} /></button>
          </div>
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: T1, marginBottom: 6, lineHeight: 1.35 }}>{g.name}</div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: T3, fontFamily: "monospace" }}>{fmtKES(+g.current || 0)} / {fmtKES(+g.target || 0)}</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: g.color, fontFamily: "monospace" }}>{a.pct}%</span>
        </div>
        <div style={{ height: 7, background: BD, borderRadius: 4, marginBottom: 11, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${a.pct}%`, background: `linear-gradient(90deg,${g.color}77,${g.color})`, borderRadius: 4, boxShadow: `0 0 6px ${g.color}44`, transition: "width 0.8s ease" }} />
        </div>

        {contribFor === g.id && (
          <div style={{ display: "flex", gap: 7, marginBottom: 11 }}>
            <input
              type="number" autoFocus value={contribAmt}
              onChange={(e) => setContribAmt(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitContribution(g); if (e.key === "Escape") setContribFor(null); }}
              placeholder="Amount (KES) — negative to correct"
              style={{ flex: 1, background: B2, border: `1px solid ${GR}44`, borderRadius: 8, padding: "8px 10px", fontSize: 12.5, color: T1, outline: "none", fontFamily: "monospace", boxSizing: "border-box", minWidth: 0 }}
            />
            <button onClick={() => submitContribution(g)} style={{ padding: "0 13px", background: `${GR}22`, border: `1px solid ${GR}55`, borderRadius: 8, color: GR, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Add</button>
          </div>
        )}

        {a.done ? (
          <div style={{ padding: "7px 10px", background: `${GR}18`, border: `1px solid ${GR}44`, borderRadius: 8, fontSize: 11.5, color: GR, fontWeight: 700, textAlign: "center" }}>✓ ACHIEVED — archive to tidy up</div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 9 }}>
              <div><div style={{ fontSize: 9, color: T3, letterSpacing: 0.5, textTransform: "uppercase" }}>Remaining</div><div style={{ fontSize: 12.5, color: T2, fontFamily: "monospace", fontWeight: 700 }}>{fmtKES(a.remaining)}</div></div>
              <div><div style={{ fontSize: 9, color: T3, letterSpacing: 0.5, textTransform: "uppercase" }}>Est. completion</div><div style={{ fontSize: 12.5, color: a.eta ? T2 : T3, fontWeight: 700 }}>{a.eta ? fmtDate(a.eta) : "set monthly"}</div></div>
            </div>
            {a.monthsToGo != null && (
              <div style={{ fontSize: 10.5, color: T3, marginBottom: a.schedule ? 8 : 0 }}>{fmtKES(+g.monthly || 0)}/mo → {a.monthsToGo} month{a.monthsToGo === 1 ? "" : "s"} to target</div>
            )}
            {a.schedule && a.schedule.state && (
              <div style={{ padding: "6px 9px", borderRadius: 8, fontSize: 10.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6,
                background: a.schedule.state === "ahead" ? `${GR}14` : a.schedule.state === "behind" ? `${RE}14` : `${AM}14`,
                border: `1px solid ${a.schedule.state === "ahead" ? GR : a.schedule.state === "behind" ? RE : AM}33`,
                color: a.schedule.state === "ahead" ? GR : a.schedule.state === "behind" ? RE : AM }}>
                <TrendingUp size={11} />
                {a.schedule.state === "ahead" ? `Ahead of schedule (+${a.schedule.diff}%)` : a.schedule.state === "behind" ? `Behind schedule (${a.schedule.diff}%)` : "On track"}
                {a.schedule.willMeetDeadline === false && " · deadline at risk"}
              </div>
            )}
          </>
        )}

        {recent.length > 0 && (
          <div style={{ marginTop: 11, paddingTop: 10, borderTop: `1px solid ${BD}` }}>
            <div style={{ fontSize: 9, color: T3, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6 }}>Recent contributions</div>
            {recent.map((h, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T3, marginBottom: 3 }}>
                <span>{fmtDate(h.date)}</span>
                <span style={{ color: h.amount >= 0 ? GR : RE, fontFamily: "monospace" }}>{h.amount >= 0 ? "+" : ""}{fmtKES(h.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  };

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: T1 }}>Financial Goals</div>
          <div style={{ fontSize: 13, color: T3, marginTop: 3 }}>Fully editable targets · progress analytics · schedule tracking</div>
        </div>
        {editing == null && (
          <button onClick={startNew} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: `linear-gradient(135deg,${GR},${CY})`, border: "none", borderRadius: 10, color: "#000", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}><Plus size={14} />New Goal</button>
        )}
      </div>

      {editing != null && draft && editForm}

      {active.length === 0 && editing == null ? (
        <Card style={{ padding: "40px", textAlign: "center" }}>
          <div style={{ fontSize: 30, marginBottom: 10 }}>🎯</div>
          <div style={{ fontSize: 14, color: T2, marginBottom: 6 }}>No active goals yet</div>
          <div style={{ fontSize: 12, color: T3 }}>Create your first goal to start tracking progress and timelines.</div>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
          {active.map((g) => <GoalCard key={g.id} g={g} />)}
        </div>
      )}

      {archived.length > 0 && (
        <div>
          <button onClick={() => setShowArchived((s) => !s)} style={{ display: "flex", alignItems: "center", gap: 6, background: GL, border: `1px solid ${BD}`, borderRadius: 9, padding: "8px 13px", color: T2, fontSize: 12, cursor: "pointer", fontFamily: "inherit", marginBottom: showArchived ? 14 : 0 }}>
            <Archive size={12} />{showArchived ? "Hide" : "Show"} archived ({archived.length})
          </button>
          {showArchived && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 14 }}>
              {archived.map((g) => <GoalCard key={g.id} g={g} />)}
            </div>
          )}
        </div>
      )}

      <Card style={{ padding: "20px", borderColor: CY + "22" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <Cpu size={15} color={CY} />
          <div style={{ fontSize: 14, fontWeight: 700, color: CY }}>Kaizen Priority Stack</div>
        </div>
        {[
          { n: "1", text: "Clear high-interest personal debt first. A guaranteed return no investment reliably beats.", c: RE },
          { n: "2", text: "Fund a 3-month emergency buffer before investing — it stops a crisis forcing you to sell.", c: AM },
          { n: "3", text: "Then MMFs & T-bills: the best risk-adjusted, fully-liquid return available in Kenya.", c: GR },
          { n: "4", text: "Scale into NSE equities and SACCO once liquid investments pass KES 100k.", c: CY },
          { n: "5", text: "Keep the trading firewall permanent — prop profits compound in the account, not lifestyle.", c: PU },
        ].map((x) => (
          <div key={x.n} style={{ display: "flex", gap: 12, padding: "9px 12px", background: `${x.c}0A`, borderRadius: 10, border: `1px solid ${x.c}22`, marginBottom: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: "50%", background: `${x.c}33`, border: `1px solid ${x.c}66`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: x.c, flexShrink: 0 }}>{x.n}</div>
            <span style={{ fontSize: 12, color: T2, lineHeight: 1.55 }}>{x.text}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
