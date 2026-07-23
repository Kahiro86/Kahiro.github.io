// ── Trading Intelligence & Research System — shell ───────────────────
// Methodology-agnostic journal + research engine. Holds the storage, seeds
// the editable libraries once, tracks the active account, and routes between
// the log, the entry form, the detail view, analytics, accounts and library.
import { useEffect, useMemo, useState } from "react";
import { FileText, BarChart2, Wallet, Library as LibIcon, Calculator, Star, ClipboardCheck } from "lucide-react";
import { BD, T1, T2, T3, GL, GR, RE, AM, CY } from "../../../shared/designTokens.js";
import { useStorageState } from "../../../shared/useStorageState.js";
import { useToast } from "../../../shared/toast.jsx";
import { Hydrating, Card } from "../../../shared/ui.jsx";
import { ModuleTabs } from "../../../shared/ModuleTabs.jsx";
import { AK, Lbl, Seg, NumInp, AutoCalc } from "./fields.jsx";
import {
  uid, sanitizeTrades, sanitizeAccounts, sanitizeInstruments, sanitizeSessions,
  sanitizeConditions, sanitizeConfluences, sanitizeStrategies, sanitizeMistakes,
  sanitizeEmotions, sanitizeReflectionQs, sanitizeLessons, sanitizeReminders, accountMetrics, fmtMoney, tiToLegacyTrades,
} from "./tradingIntel.js";
import { ReviewsTab } from "../ReviewsTab.jsx";
import { pendingReviews, sanitizeReviews } from "../reviews.js";
import { AccountsTab } from "./AccountsTab.jsx";
import { LibraryTab } from "./LibraryTab.jsx";
import { TradeForm } from "./TradeForm.jsx";
import { TradeLog } from "./TradeLog.jsx";
import { TradeDetail } from "./TradeDetail.jsx";
import { IntelAnalytics } from "./IntelAnalytics.jsx";

// Seed an editable library into storage once, then read it sanitized.
function useSeededLib(key, sanitize) {
  const [raw, setRaw, loaded] = useStorageState(key, null);
  useEffect(() => { if (loaded && raw == null) setRaw(sanitize(null)); }, [loaded, raw]); // eslint-disable-line
  const value = useMemo(() => sanitize(raw), [raw]); // eslint-disable-line
  return [value, setRaw, loaded];
}

// Compact position-size calculator (uses the active account's risk plan).
function RiskTab({ instruments, account }) {
  const [symbol, setSymbol] = useState(instruments[0]?.symbol || "");
  const [riskPct, setRiskPct] = useState(account ? String(account.riskPct) : "1");
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const inst = instruments.find((i) => i.symbol === symbol);
  const bal = account?.startBalance || 0;
  const perPip = inst && inst.pipSize > 0 ? inst.valuePerPipPerLot / inst.pipSize : 0;
  const dist = Math.abs((+entry || 0) - (+stop || 0));
  const riskAmt = bal * ((+riskPct || 0) / 100);
  const lots = perPip > 0 && dist > 0 ? +(riskAmt / (dist * perPip)).toFixed(2) : 0;
  return (
    <div style={{ padding: "20px 22px", maxWidth: 560 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: T1, marginBottom: 3 }}>Risk Calculator</div>
      <div style={{ fontSize: 12, color: T3, marginBottom: 16 }}>{account ? `Sized against ${account.name} — ${fmtMoney(bal)}` : "Create an account to size positions against its balance."}</div>
      <Card style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 13 }}>
        <div><Lbl>Instrument</Lbl>{instruments.length ? <Seg options={instruments.map((i) => i.symbol)} value={symbol} onChange={setSymbol} /> : <span style={{ fontSize: 11.5, color: AM }}>Add instruments in Library.</span>}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
          <div><Lbl>Risk %</Lbl><NumInp value={riskPct} onChange={setRiskPct} placeholder="1" /></div>
          <div><Lbl>Entry</Lbl><NumInp value={entry} onChange={setEntry} placeholder="0" /></div>
          <div><Lbl>Stop</Lbl><NumInp value={stop} onChange={setStop} placeholder="0" /></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 9 }}>
          <AutoCalc label="Risk amount" value={riskAmt ? fmtMoney(riskAmt) : "—"} color={AK} />
          <AutoCalc label="Stop distance" value={dist ? dist.toFixed(inst?.decimals || 2) : "—"} />
          <AutoCalc label="Position (Lots)" value={lots || "—"} color={GR} />
        </div>
      </Card>
    </div>
  );
}

export function TradingIntelModule() {
  const [tab, setTab] = useState("journal");
  const [view, setView] = useState("list"); // list | form | detail
  const [editing, setEditing] = useState(null);
  const [detail, setDetail] = useState(null);
  const toast = useToast();

  const [rawTrades, setTrades, tLoaded] = useStorageState("ti_trades", []);
  const [rawAccounts, setAccounts, aLoaded] = useStorageState("ti_accounts", []);
  const [rawLessons, setLessons] = useStorageState("ti_lessons", []);
  const [rawReminders, setReminders] = useStorageState("ti_reminders", []);
  const [rawReviews, setReviews] = useStorageState("ict_reviews", []);
  const [settings, setSettings] = useStorageState("ti_settings", {});

  const [instruments, setInstruments] = useSeededLib("ti_instruments", sanitizeInstruments);
  const [sessions, setSessions] = useSeededLib("ti_sessions", sanitizeSessions);
  const [conditions, setConditions] = useSeededLib("ti_conditions", sanitizeConditions);
  const [confluences, setConfluences] = useSeededLib("ti_confluences", sanitizeConfluences);
  const [strategies, setStrategies] = useSeededLib("ti_strategies", sanitizeStrategies);
  const [mistakes, setMistakes] = useSeededLib("ti_mistakes", sanitizeMistakes);
  const [emotions, setEmotions] = useSeededLib("ti_emotions", sanitizeEmotions);

  const trades = useMemo(() => sanitizeTrades(rawTrades), [rawTrades]);
  const accounts = useMemo(() => sanitizeAccounts(rawAccounts), [rawAccounts]);
  const lessons = useMemo(() => sanitizeLessons(rawLessons), [rawLessons]);
  const reminders = useMemo(() => sanitizeReminders(rawReminders), [rawReminders]);
  const reflectionQs = useMemo(() => sanitizeReflectionQs(settings?.reflectionQs), [settings]);
  const activeId = useMemo(() => {
    const wanted = settings?.activeAccountId;
    if (wanted && accounts.some((a) => a.id === wanted && !a.archived)) return wanted;
    return accounts.find((a) => !a.archived)?.id || "";
  }, [settings, accounts]);
  const activeAcct = accounts.find((a) => a.id === activeId) || null;
  const activeMetrics = activeAcct ? accountMetrics(activeAcct, trades) : null;

  // The review cadence + the Firm's gate run off real-money trading (Live /
  // Evaluation / Funded), projected into the legacy trade shape reviews.js
  // consumes. Reviews are written to ict_reviews — the store the gate, XP and
  // insights already read.
  const reviewTrades = useMemo(() => {
    const realIds = new Set(accounts.filter((a) => !a.archived && ["Live", "Evaluation", "Funded"].includes(a.type)).map((a) => a.id));
    return tiToLegacyTrades(rawTrades, realIds);
  }, [rawTrades, accounts]);
  const pendingCount = useMemo(() => pendingReviews(reviewTrades, sanitizeReviews(rawReviews)).length, [reviewTrades, rawReviews]);

  const libs = { instruments, sessions, conditions, confluences, strategies, mistakes, emotions, lessons, reminders };
  const set = { instruments: setInstruments, sessions: setSessions, conditions: setConditions, confluences: setConfluences, strategies: setStrategies, mistakes: setMistakes, emotions: setEmotions, lessons: setLessons, reminders: setReminders };

  const setActive = (id) => setSettings((p) => ({ ...(p || {}), activeAccountId: id }));
  // Reinforce a lesson from the entry form: bump its count and link the trade.
  const reinforceLesson = (lessonId, tradeId) => setLessons((prev) => sanitizeLessons(prev).map((l) =>
    l.id === lessonId ? { ...l, reinforcementCount: l.reinforcementCount + 1, linkedTrades: l.linkedTrades.includes(tradeId) ? l.linkedTrades : [...l.linkedTrades, tradeId] } : l));

  const saveTrade = (t) => {
    setTrades((prev) => { const s = sanitizeTrades(prev); const i = s.findIndex((x) => x.id === t.id); return i >= 0 ? s.map((x) => (x.id === t.id ? t : x)) : [t, ...s]; });
    setView("list"); setEditing(null); setTab("journal");
    toast(t.editedAt ? "Trade updated" : "Trade logged 📈", { tone: "success" });
  };
  const delTrade = (t) => {
    setTrades((prev) => sanitizeTrades(prev).filter((x) => x.id !== t.id));
    if (detail?.id === t.id) { setView("list"); setDetail(null); }
    toast("Trade deleted", { action: "Undo", onAction: () => setTrades((prev) => [t, ...sanitizeTrades(prev)]), tone: "danger" });
  };
  const dupTrade = (id) => setTrades((prev) => { const s = sanitizeTrades(prev); const o = s.find((x) => x.id === id); if (!o) return s; return [{ ...o, id: uid("t"), status: "OPEN", exit: "", createdAt: new Date().toISOString(), editedAt: null }, ...s]; });

  const startNew = () => { setEditing(null); setView("form"); };
  const startEdit = (t) => { setEditing(t); setView("form"); };
  const openDetail = (t) => { setDetail(t); setView("detail"); };

  const loaded = tLoaded && aLoaded;
  const onTab = (id) => { setTab(id); setView("list"); setEditing(null); setDetail(null); };

  const headStat = (l, v, c) => <div style={{ textAlign: "center", padding: "4px 10px" }}><div style={{ fontSize: 8.5, color: T3, letterSpacing: 0.8 }}>{l}</div><div style={{ fontSize: 12.5, fontWeight: 800, color: c, fontFamily: "'JetBrains Mono',monospace" }}>{v}</div></div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ModuleTabs gap={14} activeBg={`${AK}22`} activeColor={CY} topBorder={`${CY}44`} active={tab} onSelect={onTab}
        tabs={[
          { id: "journal", l: "Journal", i: FileText },
          { id: "analytics", l: "Analytics", i: BarChart2 },
          { id: "reviews", l: pendingCount ? `Reviews (${pendingCount})` : "Reviews", i: ClipboardCheck },
          { id: "accounts", l: "Accounts", i: Wallet },
          { id: "library", l: "Library", i: LibIcon },
          { id: "risk", l: "Risk", i: Calculator },
        ]}
        left={activeAcct ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 12px", background: GL, border: `1px solid ${BD}`, borderRadius: 10 }}>
            <Star size={11} color={AK} fill={AK} />
            <div style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, fontWeight: 700, color: T1 }}>{activeAcct.name}</div>
            <span style={{ fontSize: 12, fontWeight: 700, color: activeMetrics.netPnl >= 0 ? GR : RE, fontFamily: "monospace" }}>{fmtMoney(activeMetrics.currentBalance)}</span>
          </div>
        ) : null}>
        <div style={{ flex: 1 }} />
        {activeMetrics && (
          <div style={{ display: "flex", gap: 1, background: GL, border: `1px solid ${BD}`, borderRadius: 9, overflow: "hidden" }}>
            {headStat("WR", `${activeMetrics.wr}%`, CY)}
            {headStat("RR", activeMetrics.avgRR ? `${activeMetrics.avgRR}R` : "—", AM)}
            {headStat("NET", `${activeMetrics.netPnl >= 0 ? "+" : ""}${fmtMoney(activeMetrics.netPnl)}`, activeMetrics.netPnl >= 0 ? GR : RE)}
            {headStat("TRADES", activeMetrics.closed, T2)}
          </div>
        )}
      </ModuleTabs>

      <div style={{ flex: 1, overflow: view === "list" && tab === "journal" ? "hidden" : "auto" }}>
        {!loaded ? <Hydrating label="Loading your trading intelligence…" /> : (
          <>
            {tab === "journal" && view === "list" && <TradeLog trades={trades} accounts={accounts} activeId={activeId} onNew={startNew} onView={openDetail} onEdit={startEdit} onDuplicate={dupTrade} onDelete={delTrade} />}
            {tab === "journal" && view === "form" && <TradeForm initial={editing} libs={libs} accounts={accounts} activeId={activeId} reflectionQs={reflectionQs} lessons={lessons} reminders={reminders} onReinforceLesson={reinforceLesson} onSave={saveTrade} onCancel={() => { setView("list"); setEditing(null); }} />}
            {tab === "journal" && view === "detail" && detail && <TradeDetail trade={trades.find((x) => x.id === detail.id) || detail} onBack={() => { setView("list"); setDetail(null); }} onEdit={startEdit} />}
            {tab === "analytics" && <IntelAnalytics trades={trades} accounts={accounts} activeId={activeId} />}
            {tab === "reviews" && <ReviewsTab trades={reviewTrades} reviews={rawReviews} setReviews={setReviews} />}
            {tab === "accounts" && <AccountsTab accounts={accounts} setAccounts={setAccounts} trades={trades} activeId={activeId} onActivate={setActive} toast={toast} />}
            {tab === "library" && <LibraryTab libs={libs} set={set} accounts={accounts} />}
            {tab === "risk" && <RiskTab instruments={instruments.filter((i) => !i.archived)} account={activeAcct} />}
          </>
        )}
      </div>
    </div>
  );
}
