import { useCallback, useState } from "react";
import { DollarSign, Edit3, Check, X, FileText, BarChart2, Shield, Star, AlertCircle } from "lucide-react";
import { B1, BD, T1, T2, T3, GL, CY, PU, GR, RE, AM } from "../../shared/designTokens.js";
import { useStorageState } from "../../shared/useStorageState.js";
import { SEED_TRADES } from "./seedTrades.js";
import { getStats } from "./helpers.js";
import { LogView } from "./LogView.jsx";
import { TradingAnalytics } from "./TradingAnalytics.jsx";
import { RiskCalculator } from "./RiskCalculator.jsx";
import { PlaybookBuilder } from "./PlaybookBuilder.jsx";
import { TradingReports } from "./TradingReports.jsx";
import { EntryForm } from "./EntryForm.jsx";
import { DetailView } from "./DetailView.jsx";

export function TradingModule() {
  const [tv, setTv] = useState("log");
  const [trades, setTrades] = useStorageState("ict_trades", SEED_TRADES);
  const [sel, setSel] = useState(null);
  const [editT, setEditT] = useState(null);
  const [bal, setBal] = useStorageState("ict_balance", 15000);
  const [editBal, setEditBal] = useState(false);
  const [balI, setBalI] = useState(String(bal));

  const saveTrade = useCallback((t) => {
    setTrades((prev) => {
      const idx = prev.findIndex((x) => x.id === t.id);
      return idx >= 0 ? prev.map((x) => (x.id === t.id ? t : x)) : [t, ...prev];
    });
    setTv("log");
    setEditT(null);
  }, [setTrades]);

  const delTrade = useCallback((id) => {
    if (window.confirm("Delete this trade?")) {
      setTrades((prev) => prev.filter((t) => t.id !== id));
    }
  }, [setTrades]);

  const saveBal = () => {
    const n = +balI;
    if (!isNaN(n) && n > 0) setBal(n);
    setEditBal(false);
  };

  const stats = getStats(trades);
  const netPnl = stats.totalPnl;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ background: B1, borderBottom: `1px solid ${BD}`, padding: "10px 24px", display: "flex", alignItems: "center", gap: 14, flexShrink: 0, overflowX: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", background: GL, border: `1px solid ${BD}`, borderRadius: 10 }}>
          <DollarSign size={12} color={GR} />
          {editBal ? (
            <div style={{ display: "flex", gap: 6 }}>
              <input value={balI} onChange={(e) => setBalI(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveBal()}
                style={{ width: 88, background: "transparent", border: "none", fontSize: 13, color: T1, outline: "none", fontFamily: "monospace", fontWeight: 700 }} autoFocus />
              <button onClick={saveBal} style={{ background: "none", border: "none", cursor: "pointer", color: GR, display: "flex" }}><Check size={12} /></button>
              <button onClick={() => setEditBal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: RE, display: "flex" }}><X size={12} /></button>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} onClick={() => { setBalI(String(bal)); setEditBal(true); }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T1, fontFamily: "monospace" }}>${(bal + netPnl).toLocaleString()}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: netPnl >= 0 ? GR : RE, fontFamily: "monospace" }}>({netPnl >= 0 ? "+" : ""}${netPnl.toLocaleString()})</span>
              <Edit3 size={10} color={T3} />
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 3, background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: 3 }}>
          {[
            { id: "log",       l: "Trade Log",  i: FileText    },
            { id: "analytics", l: "Analytics",  i: BarChart2   },
            { id: "risk",      l: "Risk Calc",  i: Shield      },
            { id: "playbook",  l: "Playbook",   i: Star        },
            { id: "reports",   l: "Reports",    i: AlertCircle },
          ].map(({ id, l, i: Icon }) => (
            <button key={id} onClick={() => setTv(id)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer", background: tv === id ? `linear-gradient(135deg,${CY}22,${PU}22)` : "transparent", color: tv === id ? CY : T2, fontSize: 12, fontWeight: tv === id ? 600 : 400, fontFamily: "inherit", borderTop: tv === id ? `1px solid ${CY}44` : "1px solid transparent", whiteSpace: "nowrap" }}>
              <Icon size={11} />{l}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 11px", background: `${GR}11`, border: `1px solid ${GR}22`, borderRadius: 9 }}>
          <Shield size={11} color={GR} />
          <div>
            <div style={{ fontSize: 9, color: T3, letterSpacing: 1 }}>DAILY LIMIT</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: GR, fontFamily: "monospace" }}>$0 / $750</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 1, background: GL, border: `1px solid ${BD}`, borderRadius: 9, overflow: "hidden" }}>
          {[
            { l: "WR",     v: `${stats.wr}%`,              c: CY },
            { l: "PF",     v: stats.pf || "—",             c: PU },
            { l: "RR",     v: stats.avgRR ? `${stats.avgRR}R` : "—", c: AM },
            { l: "TRADES", v: stats.total,                  c: T2 },
          ].map((x, i) => (
            <div key={x.l} style={{ textAlign: "center", padding: "5px 11px", borderRight: i < 3 ? `1px solid ${BD}` : "none" }}>
              <div style={{ fontSize: 9, color: T3, letterSpacing: 1 }}>{x.l}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: x.c, fontFamily: "monospace" }}>{x.v}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflow: tv === "log" || tv === "form" ? "hidden" : "auto" }} key={tv}>
        {tv === "log" && <div style={{ height: "100%", display: "flex", flexDirection: "column" }}><LogView trades={trades} onView={(t) => { setSel(t); setTv("detail"); }} onEdit={(t) => { setEditT(t); setTv("form"); }} onDelete={delTrade} onNew={() => { setEditT(null); setTv("form"); }} stats={stats} balance={bal} /></div>}
        {tv === "analytics" && <TradingAnalytics trades={trades} balance={bal} />}
        {tv === "risk" && <RiskCalculator trades={trades} balance={bal + netPnl} />}
        {tv === "playbook" && <PlaybookBuilder trades={trades} />}
        {tv === "reports" && <TradingReports trades={trades} balance={bal + netPnl} />}
        {tv === "form" && <div style={{ height: "100%" }}><EntryForm onSubmit={saveTrade} onCancel={() => { setTv("log"); setEditT(null); }} editTrade={editT} accountBalance={bal} /></div>}
        {tv === "detail" && sel && <div style={{ overflowY: "auto", height: "100%" }}><DetailView trade={trades.find((t) => t.id === sel.id) || sel} onBack={() => setTv("log")} onEdit={(t) => { setEditT(t); setTv("form"); }} /></div>}
      </div>
    </div>
  );
}
