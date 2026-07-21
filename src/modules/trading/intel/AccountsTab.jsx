// ── Accounts — labels for organization + analytics (no broker link) ──
import { useState } from "react";
import { Plus, Pencil, Archive, Trash2, Star } from "lucide-react";
import { BD, T1, T2, T3, GL, GR, RE, AM, CY } from "../../../shared/designTokens.js";
import { Card, SH, Empty, MoneyInp } from "../../../shared/ui.jsx";
import { Meter } from "../../../shared/ui.jsx";
import { AK, Lbl, Seg, NumInp } from "./fields.jsx";
import { ACCOUNT_TYPES, ACCOUNT_STATUSES } from "./defaults.js";
import { uid, accountMetrics, fmtMoney } from "./tradingIntel.js";

const TYPE_COLOR = { Backtesting: "#8A8A8A", Replay: "#9B7CE0", Demo: CY, Live: GR, Evaluation: AM, Funded: "#F0B429" };
const STATUS_COLOR = { Active: CY, Passed: GR, Funded: GR, Failed: RE, Breached: RE, Paused: AM, Archived: T3 };

function AccountForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || "");
  const [type, setType] = useState(initial?.type || "Demo");
  const [startBalance, setStart] = useState(initial ? String(initial.startBalance) : "");
  const [goalBalance, setGoal] = useState(initial ? String(initial.goalBalance) : "");
  const [riskPct, setRisk] = useState(initial ? String(initial.riskPct) : "1");
  const [status, setStatus] = useState(initial?.status || "Active");
  const can = name.trim() && +startBalance > 0;
  return (
    <Card style={{ padding: "16px 18px", borderColor: `${AK}33` }}>
      <SH title={initial ? "Edit account" : "New account"} sub="A label for one trading environment — its metrics come from the journal" />
      <div style={{ display: "flex", flexDirection: "column", gap: 13 }}>
        <div><Lbl>Account name</Lbl><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. FTMO 100K Phase 1" style={{ width: "100%", background: GL, border: `1px solid ${BD}`, borderRadius: 9, padding: "9px 12px", fontSize: 12.5, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} /></div>
        <div><Lbl>Type</Lbl><Seg options={ACCOUNT_TYPES} value={type} onChange={setType} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div><Lbl>Starting balance</Lbl><MoneyInp value={startBalance} onChange={setStart} placeholder="10000" /></div>
          <div><Lbl>Goal balance</Lbl><MoneyInp value={goalBalance} onChange={setGoal} placeholder="12000" /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "120px 1fr", gap: 10 }}>
          <div><Lbl>Risk %</Lbl><NumInp value={riskPct} onChange={setRisk} placeholder="1" /></div>
          <div><Lbl>Status</Lbl><Seg options={ACCOUNT_STATUSES} value={status} onChange={setStatus} /></div>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 15 }}>
        <button onClick={() => can && onSave({ name, type, startBalance: +startBalance, goalBalance: +goalBalance || 0, riskPct: +riskPct || 1, status })} disabled={!can}
          style={{ flex: 1, padding: "10px", background: can ? `${AK}1E` : GL, border: `1px solid ${can ? AK + "55" : BD}`, borderRadius: 10, color: can ? "#FFFFFF" : T3, fontSize: 12.5, fontWeight: 700, cursor: can ? "pointer" : "default", fontFamily: "inherit" }}>
          {initial ? "Save changes" : "Create account"}
        </button>
        <button onClick={onCancel} style={{ padding: "10px 16px", background: GL, border: `1px solid ${BD}`, borderRadius: 10, color: T3, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
      </div>
    </Card>
  );
}

function AccountCard({ a, trades, isActive, onActivate, onEdit, onArchive, onDelete }) {
  const m = accountMetrics(a, trades);
  const tc = TYPE_COLOR[a.type] || CY;
  return (
    <Card style={{ padding: "15px 17px", borderColor: isActive ? `${AK}55` : a.archived ? BD : `${tc}22` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 9, marginBottom: 11 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13.5, fontWeight: 800, color: T1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
            {isActive && <span title="Active account" style={{ display: "inline-flex" }}><Star size={12} color={AK} fill={AK} /></span>}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, padding: "2px 8px", borderRadius: 7, background: `${tc}18`, border: `1px solid ${tc}44`, color: tc }}>{a.type}</span>
            <span style={{ fontSize: 9.5, fontWeight: 600, padding: "2px 8px", borderRadius: 7, background: GL, border: `1px solid ${BD}`, color: STATUS_COLOR[a.status] || T3 }}>{a.status}</span>
          </div>
        </div>
        {!isActive && !a.archived && <button onClick={() => onActivate(a.id)} title="Set active" style={{ background: "none", border: "none", color: T3, cursor: "pointer", padding: 3 }}><Star size={13} /></button>}
        <button onClick={() => onEdit(a)} style={{ background: "none", border: "none", color: T3, cursor: "pointer", padding: 3 }}><Pencil size={13} /></button>
        <button onClick={() => onArchive(a.id)} style={{ background: "none", border: "none", color: T3, cursor: "pointer", padding: 3 }}><Archive size={13} /></button>
        <button onClick={() => onDelete(a)} style={{ background: "none", border: "none", color: T3, cursor: "pointer", padding: 3 }}><Trash2 size={13} /></button>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 19, fontWeight: 800, color: T1, fontFamily: "'JetBrains Mono',monospace" }}>{fmtMoney(m.currentBalance)}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: m.netPnl >= 0 ? GR : RE, fontFamily: "'JetBrains Mono',monospace" }}>{m.netPnl >= 0 ? "+" : ""}{fmtMoney(m.netPnl)}</span>
      </div>
      {a.goalBalance > a.startBalance && (
        <>
          <Meter pct={m.progress} height={6} color={m.progress >= 100 ? GR : AK} style={{ marginBottom: 5 }} />
          <div style={{ fontSize: 10, color: T3, marginBottom: 10 }}>{m.progress}% to {fmtMoney(a.goalBalance)} goal</div>
        </>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 }}>
        {[["Win rate", `${m.wr}%`, CY], ["Avg RR", m.avgRR ? `${m.avgRR}R` : "—", AM], ["Trades", m.closed, T2], ["Open", m.open, T3]].map(([l, v, c]) => (
          <div key={l} style={{ textAlign: "center", padding: "6px 4px", background: GL, borderRadius: 8 }}>
            <div style={{ fontSize: 8.5, color: T3, letterSpacing: 0.5, textTransform: "uppercase" }}>{l}</div>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: c, fontFamily: "'JetBrains Mono',monospace" }}>{v}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export function AccountsTab({ accounts, setAccounts, trades, activeId, onActivate, toast }) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const live = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);

  const save = (draft) => {
    if (editing) setAccounts((prev) => prev.map((a) => (a.id === editing.id ? { ...a, ...draft } : a)));
    else {
      const acc = { id: uid("a"), createdAt: new Date().toISOString().slice(0, 10), archived: false, ...draft };
      setAccounts((prev) => [...prev, acc]);
      if (!activeId) onActivate(acc.id);
    }
    setFormOpen(false); setEditing(null);
    toast(editing ? "Account updated" : "Account created", { tone: "success" });
  };
  const archive = (id) => setAccounts((prev) => prev.map((a) => (a.id === id ? { ...a, archived: !a.archived } : a)));
  const del = (a) => {
    setAccounts((prev) => prev.filter((x) => x.id !== a.id));
    toast(`"${a.name}" deleted`, { action: "Undo", onAction: () => setAccounts((prev) => [...prev, a]), tone: "danger" });
  };

  return (
    <div style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 15, maxWidth: 1000 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: T1 }}>Accounts</div>
          <div style={{ fontSize: 12, color: T3, marginTop: 2 }}>Every metric updates automatically from your journal.</div>
        </div>
        {!formOpen && <button onClick={() => { setEditing(null); setFormOpen(true); }} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 15px", background: `${AK}1E`, border: `1px solid ${AK}55`, borderRadius: 10, color: "#FFFFFF", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}><Plus size={14} /> New account</button>}
      </div>

      {formOpen && <AccountForm initial={editing} onSave={save} onCancel={() => { setFormOpen(false); setEditing(null); }} />}

      {live.length === 0 && !formOpen ? (
        <Empty icon="🏦" title="No accounts yet" sub="Create one for each environment — Backtesting, Demo, a prop-firm evaluation, a funded account. Trades attach to an account and its stats build themselves.">
          <button onClick={() => setFormOpen(true)} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", background: `${AK}1E`, border: `1px solid ${AK}55`, borderRadius: 10, color: "#FFFFFF", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: 10 }}><Plus size={14} /> Create your first account</button>
        </Empty>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 13 }}>
          {live.map((a) => <AccountCard key={a.id} a={a} trades={trades} isActive={a.id === activeId} onActivate={onActivate} onEdit={(x) => { setEditing(x); setFormOpen(true); }} onArchive={archive} onDelete={del} />)}
        </div>
      )}

      {archived.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: T3, letterSpacing: 1, textTransform: "uppercase", margin: "6px 0 8px" }}>Archived</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 13, opacity: 0.6 }}>
            {archived.map((a) => <AccountCard key={a.id} a={a} trades={trades} isActive={false} onActivate={onActivate} onEdit={(x) => { setEditing(x); setFormOpen(true); }} onArchive={archive} onDelete={del} />)}
          </div>
        </div>
      )}
    </div>
  );
}
