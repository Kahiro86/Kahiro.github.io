import { useCallback, useMemo, useState } from "react";
import { DollarSign, Edit3, Check, X, FileText, BarChart2, Shield, Star, AlertCircle, ClipboardCheck } from "lucide-react";
import { B1, BD, T1, T2, T3, GL, CY, PU, GR, RE, AM } from "../../shared/designTokens.js";
import { useStorageState } from "../../shared/useStorageState.js";
import { useToast } from "../../shared/toast.jsx";
import { getStats, genId } from "./helpers.js";
import { DEFAULT_CHECKLIST_TEMPLATES } from "./checklists.js";
import { Hydrating } from "../../shared/ui.jsx";
import { LogView } from "./LogView.jsx";
import { TradingAnalytics } from "./TradingAnalytics.jsx";
import { RiskCalculator } from "./RiskCalculator.jsx";
import { PlaybookBuilder } from "./PlaybookBuilder.jsx";
import { TradingReports } from "./TradingReports.jsx";
import { ReviewsTab } from "./ReviewsTab.jsx";
import { pendingReviews, sanitizeReviews } from "./reviews.js";
import { EntryForm } from "./EntryForm.jsx";
import { DetailView } from "./DetailView.jsx";
import { PreTradeChecklist } from "./PreTradeChecklist.jsx";

export function TradingModule() {
  const [tv, setTv] = useState("log");
  const [rawTrades, setTrades, tradesLoaded] = useStorageState("ict_trades", []);
  // Sanitise at the read point: a single corrupt record (null, missing id)
  // must never take down the journal, analytics or reports.
  const trades = useMemo(
    () => (Array.isArray(rawTrades) ? rawTrades : []).filter((t) => t && typeof t === "object" && t.id),
    [rawTrades]
  );
  const [sel, setSel] = useState(null);
  const [editT, setEditT] = useState(null);
  const [rawBal, setBal] = useStorageState("ict_balance", 15000);
  const bal = Number.isFinite(+rawBal) && +rawBal > 0 ? +rawBal : 15000;
  const [editBal, setEditBal] = useState(false);
  const [balI, setBalI] = useState(String(bal));

  // Checklist templates + gate settings (persisted, customizable).
  const [templates, setTemplates] = useStorageState("ict_checklist_templates", DEFAULT_CHECKLIST_TEMPLATES);
  const [reviews, setReviews] = useStorageState("ict_reviews", []);
  const reviewsDue = useMemo(() => pendingReviews(trades, sanitizeReviews(reviews)).length, [trades, reviews]);
  const [activeChecklist, setActiveChecklist] = useStorageState("ict_active_checklist", "ict");
  const [allowSkip, setAllowSkip] = useStorageState("ict_checklist_skip", false);
  const [pendingChecklist, setPendingChecklist] = useState(null);

  const saveTrade = useCallback((t) => {
    setTrades((prev) => {
      const idx = prev.findIndex((x) => x.id === t.id);
      return idx >= 0 ? prev.map((x) => (x.id === t.id ? t : x)) : [t, ...prev];
    });
    setTv("log");
    setEditT(null);
    setPendingChecklist(null);
  }, [setTrades]);

  const toast = useToast();

  const delTrade = useCallback((id) => {
    setTrades((prev) => {
      const t = prev.find((x) => x.id === id);
      if (t) toast("Trade deleted", { action: "Undo", onAction: () => setTrades((p) => [t, ...p.filter((x) => x.id !== id)]), tone: "danger" });
      return prev.filter((x) => x.id !== id);
    });
  }, [setTrades, toast]);

  // Legacy demo trades (t001–t005) may still exist on devices that stored the
  // old seed data. They pollute every stat and AI insight, so surface a
  // one-tap cleanup. Fresh installs start empty and never see this.
  const demoTrades = trades.filter((t) => /^t00\d$/.test(t.id));
  const clearDemo = useCallback(() => {
    const removed = trades.filter((t) => /^t00\d$/.test(t.id));
    setTrades((prev) => prev.filter((t) => !/^t00\d$/.test(t.id)));
    toast(`${removed.length} demo trades cleared`, { action: "Undo", onAction: () => setTrades((p) => [...removed, ...p]), tone: "success" });
  }, [trades, setTrades, toast]);

  const duplicateTrade = useCallback((id) => {
    setTrades((prev) => {
      const orig = prev.find((t) => t.id === id);
      if (!orig) return prev;
      const copy = { ...orig, id: genId(), status: "OPEN", outcome: "", grade: "", pnl: 0, actualRR: null, exitPrice: "", createdAt: new Date().toISOString(), archived: false, notes: `(copy) ${orig.notes || ""}`.trim() };
      return [copy, ...prev];
    });
  }, [setTrades]);

  const archiveTrade = useCallback((id) => {
    setTrades((prev) => prev.map((t) => (t.id === id ? { ...t, archived: !t.archived } : t)));
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
      <div style={{ background: "rgba(9,13,24,0.5)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", borderBottom: `1px solid ${BD}`, padding: "10px 24px", display: "flex", alignItems: "center", gap: 14, flexShrink: 0, overflowX: "auto" }}>
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
            { id: "reviews",   l: reviewsDue ? `Reviews (${reviewsDue})` : "Reviews", i: ClipboardCheck },
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

      <div style={{ flex: 1, overflow: tv === "log" || tv === "form" || tv === "checklist" ? "hidden" : "auto" }} key={tv}>
        {!tradesLoaded && <Hydrating label="Loading your trade journal…" />}
        {tradesLoaded && tv === "log" && <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
          {demoTrades.length > 0 && (
            <div style={{ margin: "10px 22px 0", padding: "9px 14px", background: `${AM}0D`, border: `1px solid ${AM}33`, borderRadius: 10, display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: T2, flex: 1, lineHeight: 1.45 }}>
                <strong style={{ color: AM }}>{demoTrades.length} demo trades</strong> are included so you can explore. Clear them before logging real trades — they affect your stats.
              </span>
              <button onClick={clearDemo} style={{ padding: "6px 13px", background: `${AM}18`, border: `1px solid ${AM}44`, borderRadius: 8, color: AM, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
                Clear demo data
              </button>
            </div>
          )}
          <LogView trades={trades} onView={(t) => { setSel(t); setTv("detail"); }} onEdit={(t) => { setEditT(t); setPendingChecklist(null); setTv("form"); }} onDelete={delTrade} onDuplicate={duplicateTrade} onArchive={archiveTrade} onNew={() => { setEditT(null); setPendingChecklist(null); setTv("checklist"); }} stats={stats} balance={bal} /></div>}
        {tradesLoaded && tv === "checklist" && <div style={{ height: "100%" }}><PreTradeChecklist templates={templates} setTemplates={setTemplates} activeId={activeChecklist} setActiveId={setActiveChecklist} allowSkip={allowSkip} setAllowSkip={setAllowSkip} onComplete={(res) => { setPendingChecklist(res); setTv("form"); }} onCancel={() => setTv("log")} /></div>}
        {tradesLoaded && tv === "analytics" && <TradingAnalytics trades={trades} balance={bal} />}
        {tradesLoaded && tv === "risk" && <RiskCalculator trades={trades} balance={bal + netPnl} />}
        {tradesLoaded && tv === "playbook" && <PlaybookBuilder trades={trades} />}
        {tradesLoaded && tv === "reports" && <TradingReports trades={trades} balance={bal + netPnl} />}
        {tradesLoaded && tv === "reviews" && <div style={{ overflowY: "auto", height: "100%" }}><ReviewsTab trades={trades} reviews={reviews} setReviews={setReviews} /></div>}
        {tv === "form" && <div style={{ height: "100%" }}><EntryForm onSubmit={saveTrade} onCancel={() => { setTv("log"); setEditT(null); setPendingChecklist(null); }} editTrade={editT} accountBalance={bal} checklistResult={pendingChecklist} /></div>}
        {tv === "detail" && sel && <div style={{ overflowY: "auto", height: "100%" }}><DetailView trade={trades.find((t) => t.id === sel.id) || sel} trades={trades} onBack={() => setTv("log")} onEdit={(t) => { setEditT(t); setPendingChecklist(null); setTv("form"); }} /></div>}
      </div>
    </div>
  );
}
