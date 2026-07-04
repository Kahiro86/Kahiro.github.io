import { useState } from "react";
import { Filter, Plus, Edit3, Trash2, Copy, Archive, ArchiveRestore } from "lucide-react";
import { B2, BD, BD2, T1, T2, T3, GL, GL2, CY, PU, GR, RE, AM } from "../../shared/designTokens.js";
import { Chip } from "../../shared/ui.jsx";
import { OUTCOMES, INSTRUMENTS, GRADES } from "./constants.js";
import { calcPnl, gcol, ocol } from "./helpers.js";

export function LogView({ trades, onView, onEdit, onDelete, onDuplicate, onArchive, onNew, stats, balance }) {
  const [fo, setFo] = useState("");
  const [fi, setFi] = useState("");
  const [fg, setFg] = useState("");
  const [showArch, setShowArch] = useState(false);

  const archivedCount = trades.filter((t) => t.archived).length;
  const filtered = trades.filter((t) =>
    (showArch || !t.archived) &&
    (!fo || t.outcome === fo) &&
    (!fi || t.instrument === fi) &&
    (!fg || t.grade === fg)
  );
  const COLS = "62px 68px 55px 150px 66px 68px 56px 60px 96px";
  const netPnl = stats?.totalPnl || 0;
  const ss = { background: B2, border: `1px solid ${BD}`, borderRadius: 8, padding: "6px 10px", fontSize: 11.5, color: T2, outline: "none", fontFamily: "inherit", cursor: "pointer" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "14px 22px", borderBottom: `1px solid ${BD}`, display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 11 }}>
        <Chip label="Running Balance" value={`$${(balance + netPnl).toLocaleString()}`} color={netPnl >= 0 ? GR : RE} />
        <Chip label="Net P&L"         value={`${netPnl >= 0 ? "+" : ""}$${netPnl.toLocaleString()}`} color={netPnl >= 0 ? GR : RE} />
        <Chip label="Win Rate"         value={`${stats?.wr || 0}%`}   color={CY} />
        <Chip label="Profit Factor"    value={stats?.pf || "—"}        color={PU} />
        <Chip label="Avg R:R (W)"      value={stats?.avgRR ? `${stats.avgRR}R` : "—"} color={AM} />
      </div>
      <div style={{ padding: "11px 22px", borderBottom: `1px solid ${BD}`, display: "flex", gap: 9, alignItems: "center" }}>
        <Filter size={13} color={T3} />
        <select value={fo} onChange={(e) => setFo(e.target.value)} style={ss}><option value="">All Outcomes</option>{OUTCOMES.map((o) => <option key={o} value={o}>{o}</option>)}</select>
        <select value={fi} onChange={(e) => setFi(e.target.value)} style={ss}><option value="">All Pairs</option>{INSTRUMENTS.map((i) => <option key={i.l} value={i.l}>{i.l}</option>)}</select>
        <select value={fg} onChange={(e) => setFg(e.target.value)} style={ss}><option value="">All Grades</option>{GRADES.map((g) => <option key={g} value={g}>{g}</option>)}</select>
        <span style={{ fontSize: 11, color: T3, marginLeft: 4 }}>{filtered.length} trades</span>
        {archivedCount > 0 && (
          <button onClick={() => setShowArch((s) => !s)} style={{ display: "flex", alignItems: "center", gap: 5, background: showArch ? `${AM}18` : GL, border: `1px solid ${showArch ? AM + "44" : BD}`, borderRadius: 8, padding: "6px 10px", color: showArch ? AM : T3, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
            <Archive size={11} />{showArch ? "Hide archived" : `Show archived (${archivedCount})`}
          </button>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={onNew} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 15px", background: `linear-gradient(135deg,${CY},${PU})`, border: "none", borderRadius: 10, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          <Plus size={14} />Log Trade
        </button>
      </div>
      <div style={{ padding: "6px 22px", display: "grid", gridTemplateColumns: COLS, gap: 7 }}>
        {["Date", "Pair", "Dir", "Models", "Session", "P&L", "R:R", "Grade", ""].map((h) => (
          <div key={h} style={{ fontSize: 9.5, color: T3, letterSpacing: 1, textTransform: "uppercase" }}>{h}</div>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "0 22px 22px" }}>
        {filtered.length === 0 && (
          <div style={{ padding: "40px", textAlign: "center", color: T3, fontSize: 13 }}>
            No trades found. Log your first ICT trade to begin tracking your edge.
          </div>
        )}
        {filtered.map((t) => {
          const pnl = calcPnl(t);
          return (
            <div
              key={t.id}
              onClick={() => onView(t)}
              style={{ display: "grid", gridTemplateColumns: COLS, gap: 7, padding: "10px 11px", borderRadius: 10, marginBottom: 5, background: GL, border: `1px solid ${BD}`, borderLeft: `3px solid ${t.outcome ? ocol(t.outcome) : BD2}`, cursor: "pointer", transition: "background 0.15s", opacity: t.archived ? 0.5 : 1 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = GL2; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = GL; }}
            >
              <span style={{ fontSize: 11, color: T2 }}>{t.date?.slice(5)}</span>
              <span style={{ fontSize: 11.5, color: T1, fontWeight: 700, fontFamily: "monospace" }}>{t.instrument}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: t.direction === "LONG" ? GR : RE }}>{t.direction}</span>
              <span style={{ fontSize: 10.5, color: T2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {(t.models || []).slice(0, 2).map((x) => x.split("(")[0].trim()).join(", ")}
                {(t.models || []).length > 2 ? "…" : ""}
              </span>
              <span style={{ fontSize: 10, color: T3 }}>{(t.session || "").split(" (")[0]?.substring(0, 10)}</span>
              <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: pnl > 0 ? GR : pnl < 0 ? RE : AM }}>
                {t.status === "OPEN" ? <span style={{ color: CY, fontSize: 10 }}>OPEN</span> : `${pnl >= 0 ? "+" : ""}$${Math.abs(pnl)}`}
              </span>
              <span style={{ fontSize: 11, color: T2, fontFamily: "monospace" }}>{t.actualRR ? `${t.actualRR}R` : "—"}</span>
              <span>
                {t.grade && (
                  <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 7px", borderRadius: 5, background: `${gcol(t.grade)}22`, color: gcol(t.grade), border: `1px solid ${gcol(t.grade)}44` }}>
                    {t.grade}
                  </span>
                )}
              </span>
              <div style={{ display: "flex", gap: 4 }} onClick={(e) => e.stopPropagation()}>
                <button onClick={() => onEdit(t)} title="Edit" style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 6, padding: "4px 5px", cursor: "pointer", color: T2, display: "flex" }}><Edit3 size={11} /></button>
                {onDuplicate && <button onClick={() => onDuplicate(t.id)} title="Duplicate" style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 6, padding: "4px 5px", cursor: "pointer", color: CY, display: "flex" }}><Copy size={11} /></button>}
                {onArchive && <button onClick={() => onArchive(t.id)} title={t.archived ? "Restore" : "Archive"} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 6, padding: "4px 5px", cursor: "pointer", color: t.archived ? GR : AM, display: "flex" }}>{t.archived ? <ArchiveRestore size={11} /> : <Archive size={11} />}</button>}
                <button onClick={() => onDelete(t.id)} title="Delete" style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 6, padding: "4px 5px", cursor: "pointer", color: RE, display: "flex" }}><Trash2 size={11} /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
