// ── Trade Log — fast, searchable journal ─────────────────────────────
import { useMemo, useState } from "react";
import { Plus, Search, Eye, Pencil, Copy, Trash2, X, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { BD, T1, T2, T3, GL, GR, RE, AM } from "../../../shared/designTokens.js";
import { Card, Empty } from "../../../shared/ui.jsx";
import { AK } from "./fields.jsx";
import { netPnl, tradeResult, actualRR, fmtMoney, RESULT_COLORS } from "./tradingIntel.js";

const fmtDate = (d) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function Row({ t, account, onView, onEdit, onDuplicate, onDelete }) {
  const r = tradeResult(t);
  const net = netPnl(t);
  const open = t.status !== "CLOSED" || t.exit === "" || t.exit == null;
  const rc = open ? T3 : RESULT_COLORS[r] || T2;
  return (
    <Card style={{ padding: "12px 15px", borderColor: open ? BD : `${rc}33` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 42, flexShrink: 0 }}>
          <span style={{ fontSize: 10, color: T3 }}>{fmtDate(t.date)}</span>
          <span style={{ fontSize: 9, color: T3 }}>{t.time}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: T1 }}>{t.instrument || "—"}</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 10.5, fontWeight: 700, color: t.direction === "Buy" ? GR : RE }}>
              {t.direction === "Buy" ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{t.direction}
            </span>
            {t.strategy && <span style={{ fontSize: 10, color: T3 }}>{t.strategy}{t.strategyVersion ? ` v${t.strategyVersion}` : ""}</span>}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
            {account && <span style={{ fontSize: 9.5, color: T3 }}>{account.name}</span>}
            {t.sessions.slice(0, 2).map((s) => <span key={s} style={{ fontSize: 9, color: T3, padding: "1px 6px", background: GL, borderRadius: 6 }}>{s}</span>)}
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {open ? <span style={{ fontSize: 10.5, fontWeight: 700, color: AM, padding: "3px 9px", background: `${AM}14`, borderRadius: 7, border: `1px solid ${AM}33` }}>OPEN</span>
            : <>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: net >= 0 ? GR : RE, fontFamily: "'JetBrains Mono',monospace" }}>{net >= 0 ? "+" : ""}{fmtMoney(net)}</div>
              <div style={{ fontSize: 9.5, color: rc, fontWeight: 700 }}>{r}{actualRR(t) ? ` · ${actualRR(t)}R` : ""}</div>
            </>}
        </div>
        <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
          <button onClick={() => onView(t)} title="View" style={{ background: "none", border: "none", color: T3, cursor: "pointer", padding: 4 }}><Eye size={13} /></button>
          <button onClick={() => onEdit(t)} title="Edit" style={{ background: "none", border: "none", color: T3, cursor: "pointer", padding: 4 }}><Pencil size={13} /></button>
          <button onClick={() => onDuplicate(t.id)} title="Duplicate" style={{ background: "none", border: "none", color: T3, cursor: "pointer", padding: 4 }}><Copy size={13} /></button>
          <button onClick={() => onDelete(t)} title="Delete" style={{ background: "none", border: "none", color: T3, cursor: "pointer", padding: 4 }}><Trash2 size={13} /></button>
        </div>
      </div>
    </Card>
  );
}

export function TradeLog({ trades, accounts, activeId, onNew, onView, onEdit, onDuplicate, onDelete }) {
  const [q, setQ] = useState("");
  const [scope, setScope] = useState("active"); // active | all
  const [res, setRes] = useState("all");
  const accById = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a])), [accounts]);

  const list = useMemo(() => {
    let l = trades.filter((t) => !t.archived);
    if (scope === "active" && activeId) l = l.filter((t) => t.accountId === activeId);
    if (res !== "all") l = l.filter((t) => (res === "open" ? (t.status !== "CLOSED" || t.exit === "") : tradeResult(t) === res));
    if (q.trim()) { const s = q.trim().toLowerCase(); l = l.filter((t) => `${t.instrument} ${t.strategy} ${t.sessions.join(" ")} ${t.conditions.join(" ")} ${t.confluences.join(" ")} ${t.journalText} ${t.mistakes.join(" ")}`.toLowerCase().includes(s)); }
    return l.sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  }, [trades, scope, activeId, res, q]);

  const pill = (on) => ({ padding: "6px 12px", borderRadius: 8, border: `1px solid ${on ? AK + "55" : BD}`, background: on ? `${AK}1a` : GL, color: on ? "#FFFFFF" : T2, fontSize: 11.5, fontWeight: on ? 700 : 500, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" });

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "16px 22px 12px", display: "flex", flexDirection: "column", gap: 11, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: "7px 12px", flex: 1, minWidth: 200 }}>
            <Search size={14} color={T3} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search instrument, strategy, session, notes…" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: T1, fontSize: 12.5, fontFamily: "inherit" }} />
            {q && <button onClick={() => setQ("")} style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><X size={13} /></button>}
          </div>
          <button onClick={onNew} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: `${AK}1E`, border: `1px solid ${AK}55`, borderRadius: 10, color: "#FFFFFF", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}><Plus size={14} /> New trade</button>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={() => setScope("active")} style={pill(scope === "active")}>Active account</button>
          <button onClick={() => setScope("all")} style={pill(scope === "all")}>All accounts</button>
          <span style={{ width: 1, height: 18, background: BD }} />
          {[["all", "All"], ["Win", "Wins"], ["Loss", "Losses"], ["BE", "BE"], ["open", "Open"]].map(([v, l]) => <button key={v} onClick={() => setRes(v)} style={pill(res === v)}>{l}</button>)}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 22px 22px" }}>
        {list.length === 0 ? (
          <Empty icon="📈" title={trades.length ? "No trades match" : "No trades yet"} sub={trades.length ? "Adjust the filters or search." : "Log your first trade — pick an account, an instrument, and let the system turn it into research."}>
            {!trades.length && <button onClick={onNew} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", background: `${AK}1E`, border: `1px solid ${AK}55`, borderRadius: 10, color: "#FFFFFF", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: 10 }}><Plus size={14} /> Log your first trade</button>}
          </Empty>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 9, maxWidth: 900 }}>
            {list.map((t) => <Row key={t.id} t={t} account={accById[t.accountId]} onView={onView} onEdit={onEdit} onDuplicate={onDuplicate} onDelete={onDelete} />)}
          </div>
        )}
      </div>
    </div>
  );
}
