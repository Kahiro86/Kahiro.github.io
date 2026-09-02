// ── Trading Intelligence & Research System — shell ───────────────────
// Methodology-agnostic journal + research engine. Holds the storage, seeds
// the editable libraries once, tracks the active account, and routes between
// the log, the entry form, the detail view, analytics, accounts and library.
import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, BarChart2, Wallet, Library as LibIcon, Calculator, Star, ClipboardCheck, Lock, Moon } from "lucide-react";
import { BD, T1, T2, T3, GL, GR, RE, AM, CY } from "../../../shared/designTokens.js";
import { useStorageState } from "../../../shared/useStorageState.js";
import { localDateStr } from "../../../shared/dates.js";
import { DEFAULT_GATES, sanitizeSleep, evalGates } from "../../../shared/tradeGates.js";
import { PreTradeGate } from "./PreTradeGate.jsx";
import { useToast } from "../../../shared/toast.jsx";
import { Hydrating, Card } from "../../../shared/ui.jsx";
import { ModuleTabs } from "../../../shared/ModuleTabs.jsx";
import { AK, Lbl, Seg, NumInp, AutoCalc } from "./fields.jsx";
import {
  uid, sanitizeTrades, sanitizeAccounts, sanitizeInstruments, sanitizeSessions,
  sanitizeConditions, sanitizeConfluences, sanitizeStrategies, sanitizeMistakes,
  sanitizeEmotions, sanitizeReflectionQs, sanitizeReviewFields, sanitizePsychFields, sanitizeLessons, sanitizeReminders, sanitizePresets, newPreset, accountMetrics, fmtMoney, tiToLegacyTrades, netPnl,
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

// The enforcement banner above the journal: sleep input, the day's cap, and
// any active lock — locks are the loudest element, data is quiet.
function GateBanner({ gate, sleepHours, onSleep }) {
  const hard = gate.blocks.filter((b) => b.id !== "checklist");
  return (
    <div style={{ margin: "14px 20px 8px", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Moon size={14} color={T3} />
          <span style={{ fontSize: 11.5, color: T3 }}>Slept</span>
          <input type="number" inputMode="decimal" step="0.5" value={sleepHours ?? ""} onChange={(e) => onSleep(e.target.value)} placeholder="—"
            aria-label="Hours slept last night" style={{ width: 58, background: GL, border: `1px solid ${BD}`, borderRadius: 8, padding: "6px 8px", fontSize: 12.5, color: T1, outline: "none", fontFamily: "monospace", textAlign: "right" }} />
          <span style={{ fontSize: 11.5, color: T3 }}>h</span>
        </div>
        <div style={{ fontSize: 11.5, color: T3 }}>Today: <b style={{ color: gate.count >= gate.cap ? RE : T2, fontFamily: "monospace" }}>{gate.count}/{gate.cap}</b> logged</div>
        {gate.sleep === "HALF SIZE" && <span style={{ fontSize: 11, fontWeight: 800, color: AM, letterSpacing: 1, padding: "3px 9px", border: `1px solid ${AM}55`, borderRadius: 20 }}>HALF SIZE</span>}
      </div>
      {hard.map((b) => (
        <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 9, padding: "11px 14px", background: `${RE}14`, border: `1px solid ${RE}55`, borderRadius: 11 }}>
          <Lock size={15} color={RE} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: RE }}>{b.reason}</div>
            <div style={{ fontSize: 11, color: T3 }}>Lifts: {b.lifts}</div>
          </div>
        </div>
      ))}
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
  const [rawPresets, setPresets] = useStorageState("ti_presets", []);
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

  // ── Enforcement gates (Phase 2 rules engine) ───────────────────────
  const [rawGates] = useStorageState("trade_gates", DEFAULT_GATES);
  const [rawSleep, setSleep] = useStorageState("trade_sleep", {});
  const [checklistLog, setChecklistLog] = useStorageState("trade_checklists", {});
  const [checklistDone, setChecklistDone] = useState(false); // per-session, reset after each log
  const [gateModal, setGateModal] = useState(false);
  const checklistRef = useRef([]);
  const [nowTick, setNowTick] = useState(Date.now());
  const todayDs = localDateStr();
  const sleepMap = useMemo(() => sanitizeSleep(rawSleep), [rawSleep]);
  const sleepHours = sleepMap[todayDs];
  const gate = useMemo(() => evalGates({ trades, cfg: rawGates, sleepHours, checklistDone, netPnlOf: netPnl, now: nowTick, ds: todayDs }),
    [trades, rawGates, sleepHours, checklistDone, nowTick, todayDs]);
  // Tick only while a cooldown is counting down (keeps the minute display live
  // without a permanent 1s render loop).
  useEffect(() => {
    if (gate.cooldownMs <= 0) return;
    const id = setInterval(() => setNowTick(Date.now()), 15000);
    return () => clearInterval(id);
  }, [gate.cooldownMs]);

  const accounts = useMemo(() => sanitizeAccounts(rawAccounts), [rawAccounts]);
  const lessons = useMemo(() => sanitizeLessons(rawLessons), [rawLessons]);
  const reminders = useMemo(() => sanitizeReminders(rawReminders), [rawReminders]);
  const presets = useMemo(() => sanitizePresets(rawPresets), [rawPresets]);
  const reflectionQs = useMemo(() => sanitizeReflectionQs(settings?.reflectionQs), [settings]);
  const reviewFields = useMemo(() => sanitizeReviewFields(settings?.reviewFields), [settings]);
  const psychFields = useMemo(() => sanitizePsychFields(settings?.psychFields), [settings]);
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

  const libs = { instruments, sessions, conditions, confluences, strategies, mistakes, emotions, lessons, reminders, presets };
  const set = { instruments: setInstruments, sessions: setSessions, conditions: setConditions, confluences: setConfluences, strategies: setStrategies, mistakes: setMistakes, emotions: setEmotions, lessons: setLessons, reminders: setReminders, presets: setPresets };
  const savePreset = (name, patch) => setPresets((prev) => [newPreset(name, patch), ...sanitizePresets(prev)]);

  // Editable form-field lists (review dimensions, psychology dimensions,
  // reflection questions) live in ti_settings so nothing is hardcoded — the
  // trade form and detail read whatever the trader configured, and the Library
  // "Forms" editor writes them back. Ratings themselves are stored
  // field-agnostically, so old trades keep what they were rated on.
  const forms = { reviewFields, psychFields, reflectionQs };
  const setForms = {
    reviewFields: (next) => setSettings((p) => ({ ...(p || {}), reviewFields: sanitizeReviewFields(typeof next === "function" ? next(reviewFields) : next) })),
    psychFields: (next) => setSettings((p) => ({ ...(p || {}), psychFields: sanitizePsychFields(typeof next === "function" ? next(psychFields) : next) })),
    reflectionQs: (next) => setSettings((p) => ({ ...(p || {}), reflectionQs: sanitizeReflectionQs(typeof next === "function" ? next(reflectionQs) : next) })),
  };

  const setActive = (id) => setSettings((p) => ({ ...(p || {}), activeAccountId: id }));

  // Library portability: export every editable library as one JSON file, or
  // import one (merge-append — imported items get fresh ids so nothing
  // existing is overwritten). Trades and accounts are data, not templates,
  // and are deliberately excluded — Settings → backup covers those.
  const LIB_SANITIZE = { instruments: sanitizeInstruments, sessions: sanitizeSessions, conditions: sanitizeConditions, confluences: sanitizeConfluences, strategies: sanitizeStrategies, mistakes: sanitizeMistakes, emotions: sanitizeEmotions, lessons: sanitizeLessons, reminders: sanitizeReminders };
  const exportLibrary = () => {
    const data = { kind: "kahiro-trading-library", version: 1, exportedAt: new Date().toISOString() };
    for (const k of Object.keys(LIB_SANITIZE)) data[k] = libs[k];
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `trading-library-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
    toast("Library exported", { tone: "success" });
  };
  const importLibrary = (parsed) => {
    if (!parsed || typeof parsed !== "object" || parsed.kind !== "kahiro-trading-library") { toast("Not a trading-library file", { tone: "danger" }); return; }
    let added = 0;
    for (const k of Object.keys(LIB_SANITIZE)) {
      if (!Array.isArray(parsed[k])) continue;
      const fresh = LIB_SANITIZE[k](parsed[k].map((x) => (x && typeof x === "object" && !Array.isArray(x) ? { ...x, id: undefined } : x)));
      if (!fresh.length) continue;
      set[k]((prev) => [...LIB_SANITIZE[k](prev), ...fresh]);
      added += fresh.length;
    }
    toast(added ? `Imported ${added} library item${added === 1 ? "" : "s"}` : "Nothing to import", { tone: added ? "success" : "danger" });
  };
  // Reinforce a lesson from the entry form: bump its count and link the trade.
  const reinforceLesson = (lessonId, tradeId) => setLessons((prev) => sanitizeLessons(prev).map((l) =>
    l.id === lessonId ? { ...l, reinforcementCount: l.reinforcementCount + 1, linkedTrades: l.linkedTrades.includes(tradeId) ? l.linkedTrades : [...l.linkedTrades, tradeId] } : l));

  const saveTrade = (t) => {
    const isNew = !sanitizeTrades(rawTrades).some((x) => x.id === t.id);
    setTrades((prev) => { const s = sanitizeTrades(prev); const i = s.findIndex((x) => x.id === t.id); return i >= 0 ? s.map((x) => (x.id === t.id ? t : x)) : [t, ...s]; });
    // Store the pre-trade checklist that unlocked this trade (per-trade record).
    if (isNew && checklistRef.current.length) {
      setChecklistLog((p) => ({ ...(p && typeof p === "object" && !Array.isArray(p) ? p : {}), [t.id]: checklistRef.current }));
    }
    setChecklistDone(false); checklistRef.current = []; // next trade must clear the gate again
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
  // Gated entry to logging. Hard blocks (cap / cooldown / sleep) refuse
  // outright; if only the checklist remains, open it. Editing an existing
  // trade is never gated — the gate is about opening NEW risk.
  const requestNew = () => {
    const hard = gate.blocks.filter((b) => b.id !== "checklist");
    if (hard.length) { toast(hard[0].reason, { tone: "danger" }); return; }
    if (!checklistDone) { setGateModal(true); return; }
    startNew();
  };
  const proceedChecklist = (items) => { checklistRef.current = items; setChecklistDone(true); setGateModal(false); startNew(); };
  const setSleepHours = (h) => setSleep((p) => ({ ...(p && typeof p === "object" && !Array.isArray(p) ? p : {}), [todayDs]: Math.max(0, Math.min(24, +h || 0)) }));
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
          { id: "analytics", l: pendingCount ? `Analytics (${pendingCount})` : "Analytics", i: BarChart2 },
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
            {tab === "journal" && view === "list" && (
              <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
                <GateBanner gate={gate} sleepHours={sleepHours} onSleep={setSleepHours} />
                <div style={{ flex: 1, overflow: "hidden" }}>
                  <TradeLog trades={trades} accounts={accounts} activeId={activeId} onNew={requestNew} logLocked={!gate.canLog} showCurrency={gate.cfg.showCurrency} onView={openDetail} onEdit={startEdit} onDuplicate={dupTrade} onDelete={delTrade} />
                </div>
              </div>
            )}
            {tab === "journal" && view === "form" && <TradeForm initial={editing} libs={libs} accounts={accounts} activeId={activeId} reflectionQs={reflectionQs} reviewFields={reviewFields} psychFields={psychFields} lessons={lessons} reminders={reminders} presets={presets} onSavePreset={savePreset} onReinforceLesson={reinforceLesson} onSave={saveTrade} onCancel={() => { setView("list"); setEditing(null); }} />}
            {tab === "journal" && view === "detail" && detail && <TradeDetail trade={trades.find((x) => x.id === detail.id) || detail} reviewFields={reviewFields} psychFields={psychFields} onBack={() => { setView("list"); setDetail(null); }} onEdit={startEdit} />}
            {tab === "analytics" && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                {pendingCount > 0 && (
                  <div style={{ margin: "18px 24px 0", display: "flex", alignItems: "center", gap: 10, padding: "11px 15px", borderRadius: 11, background: `${AM}12`, border: `1px solid ${AM}44`, flexWrap: "wrap" }}>
                    <ClipboardCheck size={15} color={AM} />
                    <span style={{ fontSize: 12.5, color: T1, fontWeight: 700 }}>{pendingCount} review{pendingCount === 1 ? "" : "s"} pending</span>
                    <span style={{ fontSize: 11.5, color: T3 }}>— the numbers below tell you what happened; close the loop with a write-up further down.</span>
                  </div>
                )}
                <IntelAnalytics trades={trades} accounts={accounts} activeId={activeId} />
                <div style={{ height: 1, background: BD, margin: "6px 24px 0" }} />
                <ReviewsTab trades={reviewTrades} reviews={rawReviews} setReviews={setReviews} />
              </div>
            )}
            {tab === "accounts" && <AccountsTab accounts={accounts} setAccounts={setAccounts} trades={trades} activeId={activeId} onActivate={setActive} toast={toast} />}
            {tab === "library" && <LibraryTab libs={libs} set={set} forms={forms} setForms={setForms} accounts={accounts} onExport={exportLibrary} onImport={importLibrary} />}
            {tab === "risk" && <RiskTab instruments={instruments.filter((i) => !i.archived)} account={activeAcct} />}
          </>
        )}
      </div>
      {gateModal && <PreTradeGate items={gate.cfg.checklist} onProceed={proceedChecklist} onClose={() => setGateModal(false)} />}
    </div>
  );
}
