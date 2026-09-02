// ── The journal ──────────────────────────────────────────────────────
// Every trade, newest first, with the numbers that decide whether it was
// a good trade rather than just a winning one.
//
// The R column is the point. A journal that leads with currency teaches
// you to feel a £400 day and a £40 day differently when they were the
// same 2R; leading with R is what makes the rest of the dashboard mean
// anything.
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { BD, T1, T2, T3, AC, AC2, GR, RE, AM, MONO } from "../ui/tokens.js";
import { Card, Empty } from "../ui/primitives.jsx";
import { RESULT_COLORS, fmtMoney, netPnl } from "../engine/trade.js";
import { netR, outcome, isClosed } from "../engine/metrics.js";
import { TradeEditor } from "./TradeEditor.jsx";

const FILTERS = ["All", "Win", "Loss", "BE", "Open"];

const rTone = (v) => (v > 0 ? GR : v < 0 ? RE : T3);

export function JournalTab({ trades, setTrades, accounts, accountId, phases, instruments }) {
  const [editing, setEditing] = useState(null);   // trade | "new" | null
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");

  const rows = useMemo(() => {
    const list = [...trades].sort((a, b) =>
      (b.date === a.date ? String(b.time).localeCompare(String(a.time)) : b.date.localeCompare(a.date)));
    return list.filter((t) => {
      if (filter === "Open" && isClosed(t)) return false;
      if (["Win", "Loss", "BE"].includes(filter) && outcome(t) !== filter) return false;
      if (!q.trim()) return true;
      const hay = `${t.instrument} ${t.direction} ${t.date} ${t.setupGrade} ${(t.preTradeFlags || []).join(" ")}`.toLowerCase();
      return hay.includes(q.trim().toLowerCase());
    });
  }, [trades, q, filter]);

  const save = (t) => {
    setTrades((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const i = list.findIndex((x) => x.id === t.id);
      return i >= 0 ? list.map((x) => (x.id === t.id ? t : x)) : [t, ...list];
    });
    setEditing(null);
  };

  const remove = (id) => {
    setTrades((prev) => (Array.isArray(prev) ? prev : []).filter((x) => x.id !== id));
    setEditing(null);
  };

  if (editing) {
    return (
      <TradeEditor
        initial={editing === "new" ? null : editing}
        accounts={accounts} accountId={accountId} phases={phases} instruments={instruments}
        onSave={save} onCancel={() => setEditing(null)}
      />
    );
  }

  const phaseName = Object.fromEntries(phases.map((p) => [p.id, p.phase]));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" onClick={() => setEditing("new")} style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "8px 15px", borderRadius: 9, fontSize: 12, fontWeight: 700,
          fontFamily: "inherit", cursor: "pointer", background: AC2, color: "#000", border: "none",
        }}><Plus size={13} /> Log a trade</button>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${BD}`, borderRadius: 9, padding: "0 10px" }}>
          <Search size={12} style={{ color: T3 }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search"
            style={{ background: "transparent", border: "none", outline: "none", color: T1, padding: "8px 0", fontSize: 11.5, fontFamily: "inherit", width: 130 }} />
        </div>
        <div style={{ display: "flex", gap: 4, marginLeft: "auto", flexWrap: "wrap" }}>
          {FILTERS.map((k) => (
            <button key={k} type="button" onClick={() => setFilter(k)} style={{
              padding: "6px 11px", borderRadius: 8, fontSize: 11, fontFamily: "inherit", cursor: "pointer",
              fontWeight: filter === k ? 700 : 500,
              background: filter === k ? "rgba(120,200,255,0.14)" : "transparent",
              color: filter === k ? AC : T3,
              border: `1px solid ${filter === k ? AC : BD}`,
            }}>{k}</button>
          ))}
        </div>
      </div>

      {!rows.length ? (
        <Empty
          title={trades.length ? "Nothing matches that filter" : "No trades yet"}
          body={trades.length ? "Clear the search or pick another filter." : "Log your first trade and the dashboard starts filling in."}
        />
      ) : (
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: 640 }}>
              <thead>
                <tr style={{ color: T3, fontSize: 9.5, textTransform: "uppercase", letterSpacing: 0.7 }}>
                  {["Date", "Instrument", "Dir", "Phase", "Grade", "R", "P&L", "Result", ""].map((h) => (
                    <th key={h} style={{ textAlign: h === "R" || h === "P&L" ? "right" : "left", padding: "10px 12px", borderBottom: `1px solid ${BD}`, fontWeight: 600, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => {
                  const res = outcome(t);
                  const r = netR(t);
                  return (
                    <tr key={t.id} onClick={() => setEditing(t)}
                      style={{ borderBottom: `1px solid ${BD}`, cursor: "pointer" }}>
                      <td style={{ padding: "9px 12px", fontFamily: MONO, color: T2, whiteSpace: "nowrap" }}>
                        {t.date}{t.time ? <span style={{ color: T3 }}> {t.time}</span> : null}
                      </td>
                      <td style={{ padding: "9px 12px", color: T1, fontWeight: 600 }}>{t.instrument || "—"}</td>
                      <td style={{ padding: "9px 12px", color: t.direction === "Buy" ? GR : RE, fontWeight: 600 }}>{t.direction}</td>
                      <td style={{ padding: "9px 12px", color: T3, fontFamily: MONO }}>{phaseName[t.phaseId] || "—"}</td>
                      <td style={{ padding: "9px 12px", color: t.setupGrade ? AC2 : T3, fontWeight: 600 }}>{t.setupGrade || "—"}</td>
                      <td style={{ padding: "9px 12px", textAlign: "right", fontFamily: MONO, fontWeight: 700, color: isClosed(t) ? rTone(r) : T3 }}>
                        {isClosed(t) ? `${r > 0 ? "+" : ""}${r}R` : "—"}
                      </td>
                      <td style={{ padding: "9px 12px", textAlign: "right", fontFamily: MONO, color: T3 }}>
                        {isClosed(t) ? fmtMoney(netPnl(t)) : "—"}
                      </td>
                      <td style={{ padding: "9px 12px" }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 6,
                          color: res ? RESULT_COLORS[res] : AM,
                          background: `${res ? RESULT_COLORS[res] : AM}18`,
                        }}>{res || "Open"}</span>
                      </td>
                      <td style={{ padding: "9px 12px", textAlign: "right" }}>
                        <button type="button" onClick={(e) => { e.stopPropagation(); remove(t.id); }}
                          style={{ background: "none", border: "none", color: T3, cursor: "pointer", fontSize: 11, fontFamily: "inherit" }}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
