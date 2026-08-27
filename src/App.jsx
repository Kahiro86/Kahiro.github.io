import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from "react";
import { T1 } from "./shared/designTokens.js";
import { storage } from "./shared/storage.js";
import { gymSessionsToWorkouts } from "./modules/gym/gymSessions.js";
import { useStorageState } from "./shared/useStorageState.js";
import { useIsMobile } from "./shared/useIsMobile.js";
import { migrateHabits, toLegacy, tapHabit } from "./shared/habitEngine.js";
import { htToLegacyHabits } from "./modules/habits/legacyAdapter.js";
import { db as localDb } from "./modules/habits/localDb.js";
import { toggleEntry } from "./modules/habits/logic/index";
const QuickLog = lazy(() => import("./shared/QuickLog.jsx").then((m) => ({ default: m.QuickLog })));
import { useXp } from "./shared/useXp.js";
import { XPCelebration } from "./shared/XPCelebration.jsx";
import { NotifTicker } from "./shared/NotifTicker.jsx";
import { usePushQueueSync } from "./shared/push.js";
import { AutoGoalSync } from "./shared/AutoGoalSync.jsx";
import { WeeklyReviewGate } from "./shared/WeeklyReview.jsx";
import { hasLock } from "./shared/lock.js";
import { LockScreen } from "./shared/LockScreen.jsx";
import { localDateStr } from "./shared/dates.js";
import { ToastProvider } from "./shared/toast.jsx";
import { ErrorBoundary } from "./shared/ErrorBoundary.jsx";
import { AmbientBackground } from "./shared/AmbientBackground.jsx";
import { getStats } from "./modules/trading/helpers.js";
import { financeSummary } from "./modules/finance/summary.js";
import { HABITS_DEF } from "./modules/dashboard/domains.js";
// Route-level code splitting: every module is its own lazy chunk, so first
// paint ships only the shell + the landing module. Heavy deps that live
// only inside modules (recharts, the AI/finance code) leave the initial
// bundle entirely. Conditionally-rendered panels lazy-load on first open.
const Dashboard = lazy(() => import("./modules/dashboard/Dashboard.jsx").then((m) => ({ default: m.Dashboard })));
const FaithOS = lazy(() => import("./modules/faith/FaithOS.jsx").then((m) => ({ default: m.FaithOS })));
const AnalyticsOS = lazy(() => import("./modules/analytics/AnalyticsOS.jsx").then((m) => ({ default: m.AnalyticsOS })));
const FirmOS = lazy(() => import("./modules/firm/FirmOS.jsx").then((m) => ({ default: m.FirmOS })));
const NutritionOS = lazy(() => import("./modules/athlete/NutritionOS.jsx").then((m) => ({ default: m.NutritionOS })));
const CalendarModule = lazy(() => import("./modules/calendar/CalendarModule.jsx").then((m) => ({ default: m.CalendarModule })));
const BodyOS = lazy(() => import("./modules/gym/BodyOS.jsx").then((m) => ({ default: m.BodyOS })));
const HabitsOS = lazy(() => import("./modules/habits/HabitTracker.tsx").then((m) => ({ default: m.HabitTracker })));
import { Sidebar } from "./shared/Sidebar.jsx";
import { Header } from "./shared/Header.jsx";
const AIPanel = lazy(() => import("./shared/AIPanel.jsx").then((m) => ({ default: m.AIPanel })));
const SettingsPanel = lazy(() => import("./shared/SettingsPanel.jsx").then((m) => ({ default: m.SettingsPanel })));
import { getApiKey } from "./shared/anthropic.js";
const GuidedTour = lazy(() => import("./shared/GuidedTour.jsx").then((m) => ({ default: m.GuidedTour })));
const HelpCenter = lazy(() => import("./shared/HelpCenter.jsx").then((m) => ({ default: m.HelpCenter })));
const WhatsNew = lazy(() => import("./shared/WhatsNew.jsx").then((m) => ({ default: m.WhatsNew })));
const WhoIAm = lazy(() => import("./shared/WhoIAm.jsx").then((m) => ({ default: m.WhoIAm })));
const GlobalSearch = lazy(() => import("./shared/GlobalSearch.jsx").then((m) => ({ default: m.GlobalSearch })));
const EveningReview = lazy(() => import("./shared/EveningReview.jsx").then((m) => ({ default: m.EveningReview })));
const StreakInsurance = lazy(() => import("./shared/StreakInsurance.jsx").then((m) => ({ default: m.StreakInsurance })));
const FocusTimer = lazy(() => import("./shared/FocusTimer.jsx").then((m) => ({ default: m.FocusTimer })));
const WeeklyPlan = lazy(() => import("./shared/WeeklyPlan.jsx").then((m) => ({ default: m.WeeklyPlan })));
const GoalCascade = lazy(() => import("./shared/GoalCascade.jsx").then((m) => ({ default: m.GoalCascade })));
const HabitIntel = lazy(() => import("./shared/HabitIntel.jsx").then((m) => ({ default: m.HabitIntel })));
const RiskCalculator = lazy(() => import("./shared/RiskCalculator.jsx").then((m) => ({ default: m.RiskCalculator })));
const OverheadLedger = lazy(() => import("./shared/OverheadLedger.jsx").then((m) => ({ default: m.OverheadLedger })));
const PrayerList = lazy(() => import("./shared/PrayerList.jsx").then((m) => ({ default: m.PrayerList })));
const Flashcards = lazy(() => import("./shared/Flashcards.jsx").then((m) => ({ default: m.Flashcards })));
const QuickJournal = lazy(() => import("./shared/QuickJournal.jsx").then((m) => ({ default: m.QuickJournal })));
const Correlations = lazy(() => import("./shared/Correlations.jsx").then((m) => ({ default: m.Correlations })));
import { TOUR_OVERVIEW } from "./shared/help.js";
import { computeChecklist, WHATS_NEW } from "./shared/onboarding.js";
import { useIdentity } from "./shared/identity.jsx";
import { NameYourSystem } from "./shared/NameYourSystem.jsx";
import { WHO_KEY, WHO_META_KEY, shouldAutoShow, todayVisionLine } from "./shared/whoIAm.js";
import { whenNotTyping } from "./shared/typing.js";

export default function App() {
  const isMobile = useIsMobile();
  usePushQueueSync(); // keep the closed-app push queue fresh when set up
  const [module, setModule] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // AI panel starts open on desktop only once the coach is activated (an API
  // key exists) — a fresh install shouldn't burn a quarter of the screen on a
  // "not activated" notice. Closed on phones either way (full overlay there).
  const [aiOpen, setAiOpen] = useState(() => (typeof window !== "undefined" ? window.innerWidth > 820 && !!getApiKey() : false));
  const [showSettings, setShowSettings] = useState(false);
  const [reviewSignal, setReviewSignal] = useState(0); // ticks to open Week in Review
  // Onboarding & help layer: a replayable spotlight tour, a searchable Help
  // Centre, and Help Mode (persisted, shown app-wide via (?) markers).
  const [helpOpen, setHelpOpen] = useState(false);
  const [tourOn, setTourOn] = useState(false);
  const [wnOpen, setWnOpen] = useState(false);
  const [helpMode, setHelpMode] = useStorageState("help_mode", false);
  const [onboard, setOnboard, onboardLoaded] = useStorageState("onboarding", {});
  const [wnSeen, setWnSeen, wnLoaded] = useStorageState("whatsnew_seen", "");
  const patchOnboard = useCallback((patch) => setOnboard((o) => ({ ...(o && typeof o === "object" ? o : {}), ...patch })), [setOnboard]);
  // Personalizable identity (app name / owner name). The "Name your system"
  // card shows first on a fresh install; the tour waits until it's answered.
  const identity = useIdentity();
  const showNaming = identity.loaded && !identity.configured;
  // First launch: auto-run the app tour once (after naming), then never again.
  useEffect(() => {
    if (onboardLoaded && identity.loaded && identity.configured && !onboard?.overviewSeen) {
      // Passive auto-open — never over an active input (see typing.js).
      const t = setTimeout(() => whenNotTyping(() => setTourOn(true)), 700);
      return () => clearTimeout(t);
    }
  }, [onboardLoaded, onboard, identity.loaded, identity.configured]);
  // What's New: once per version bump, but only for returning users — a new
  // user's first-run tour already covers it (endTour marks it seen). Deferred
  // while typing so it can't steal focus mid-entry.
  useEffect(() => {
    if (onboardLoaded && wnLoaded && onboard?.overviewSeen && wnSeen !== WHATS_NEW.version) {
      return whenNotTyping(() => setWnOpen(true));
    }
  }, [onboardLoaded, wnLoaded, onboard, wnSeen]);
  const closeWhatsNew = () => { setWnOpen(false); setWnSeen(WHATS_NEW.version); };
  // Light interaction flags that feed the getting-started checklist.
  useEffect(() => { if (helpOpen && onboardLoaded && !onboard?.helpBrowsed) patchOnboard({ helpBrowsed: true }); }, [helpOpen, onboardLoaded]); // eslint-disable-line
  useEffect(() => {
    if (!onboardLoaded || module === "dashboard") return;
    const ex = Array.isArray(onboard?.explored) ? onboard.explored : [];
    if (!ex.includes(module)) patchOnboard({ explored: [...ex, module] });
  }, [module, onboardLoaded]); // eslint-disable-line
  const endTour = () => { setTourOn(false); patchOnboard({ overviewSeen: true }); setWnSeen(WHATS_NEW.version); };
  const startTour = () => { setHelpOpen(false); setModule("dashboard"); setTourOn(true); };
  // Nav that also understands non-module destinations (e.g. the backup nudge
  // links to "settings", which is a panel, not a module) and compound ids
  // like "firm:wealth" — a merged module's outer shell plus which of its
  // inner groups a deep link should land on. navHint carries the group (a
  // nonce forces the shell's effect to re-fire even when clicked twice in a
  // row for the same group, same idea as reviewSignal below).
  const [navHint, setNavHint] = useState(null); // { module, group, nonce }
  // Retired facets, forwarded rather than broken: Nutrition and the Athlete
  // shell folded into Body (Gate 2), Purity and Journal into Discipline
  // (Gate 1). Saved reminders and old links still carry these ids.
  const RETIRED = {
    life: "gym:today", "life:athlete": "gym:today", "life:nutrition": "nutrition",
    "life:purity": "habits", "life:journal": "habits",
    athlete: "gym:today",
    "gym:workout": "gym:today", "gym:progress": "gym:trends",
    // Fuel left Body and became its own facet, so every link that used to
    // land on the Body screen expecting food now goes where the food is.
    "gym:fuel": "nutrition", "gym:nutrition": "nutrition",
    // The Record absorbed Journey, and Mind moved in as Library.
    journey: "analytics:progress", "journey:goals": "analytics:goals",
    "journey:wants": "analytics:goals", "journey:fame": "analytics:progress",
    "faith:mind": "analytics:library", mind: "analytics:library",
  };
  const navTo = useCallback((id) => {
    if (id === "settings") return setShowSettings(true);
    const target = RETIRED[id] || id;
    const [base, group] = target.split(":");
    setModule(base);
    if (group) setNavHint({ module: base, group, nonce: Date.now() });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // A push that opens the app from CLOSED arrives as a URL with the
  // destination in its hash (index.html is the only document, so a fragment
  // is the only thing that can carry one). Read it once, then clear it —
  // leaving it behind would re-route every later reload to the same screen.
  useEffect(() => {
    const id = (window.location.hash || "").replace(/^#/, "");
    if (!id) return;
    try { history.replaceState(null, "", window.location.pathname + window.location.search); } catch { /* fine */ }
    navTo(id);
  }, [navTo]);

  // A push tapped while the app is already OPEN focuses this window; the
  // service worker sends the destination alongside so the tap lands on the
  // screen the notification was about instead of wherever the app happened
  // to be left. Accepts either a bare module id ("gym:today") or a URL whose
  // hash carries one.
  useEffect(() => {
    const sw = navigator.serviceWorker;
    if (!sw) return undefined;
    const onMessage = (e) => {
      if (e?.data?.type !== "notification-click") return;
      const raw = String(e.data.url || "");
      if (!raw || raw === "./") return;
      const id = raw.includes("#") ? raw.slice(raw.indexOf("#") + 1) : raw;
      if (id) navTo(id);
    };
    sw.addEventListener("message", onMessage);
    return () => sw.removeEventListener("message", onMessage);
  }, [navTo]);

  // App lock: gate the UI on open when a PIN is set, and re-lock after the
  // tab has been in the background for 5+ minutes.
  const [locked, setLocked] = useState(hasLock);
  useEffect(() => {
    let hiddenAt = null;
    const onVis = () => {
      if (document.hidden) hiddenAt = Date.now();
      else if (hiddenAt && Date.now() - hiddenAt > 5 * 60 * 1000 && hasLock()) setLocked(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Habits: engine v2 — per-date logs with schedules, targets and skips.
  // Completion + streaks derive from the log, so everything resets at local
  // midnight and every streak is earned. Legacy v1 data migrates in place.
  const [rawHabits, setRawHabits, habitsLoaded] = useStorageState("habits", HABITS_DEF);
  const habitsV2 = useMemo(() => migrateHabits(rawHabits), [rawHabits]);
  const setHabitsV2 = useCallback(
    (updater) => setRawHabits((prev) => (typeof updater === "function" ? updater(migrateHabits(prev)) : updater)),
    [setRawHabits]
  );
  // Legacy shape ({name, icon, done, streak}) for Dashboard / AI / kaizen.
  const habits = useMemo(() => toLegacy(habitsV2), [habitsV2]);
  // The new habit tracker (ht_* stores), mapped into the legacy habit shape so
  // the shared analytical views (Analytics, Calendar, Correlations, Reviews)
  // count new-tracker habits alongside any old spiritual ones. FaithCore and
  // Life keep the untouched habitsV2 — they still own the old key.
  const [htHabits] = useStorageState("ht_habits", []);
  const [htEntries] = useStorageState("ht_entries", []);
  const habitsAll = useMemo(
    () => [...habitsV2, ...htToLegacyHabits(htHabits, htEntries)],
    [habitsV2, htHabits, htEntries]
  );
  // Getting-started checklist — derived from real data, nothing extra tracked.
  const [goals] = useStorageState("goals", []);
  // ── Quick log ────────────────────────────────────────────────────
  // The day's habits and meals, logged from any screen. `habitsAll` merges
  // both stores, and the adapter prefixes tracker ids with "ht_", so a tap
  // routes itself — no second list to keep in step.
  const quickTap = useCallback((id) => {
    if (typeof id === "string" && id.startsWith("ht_")) {
      const habitId = id.slice(3);
      // toggleEntry writes through the tracker's Db, which broadcasts on the
      // same store channel useStorageState listens to — so ht_entries updates
      // and the ring re-renders without a second source of truth here.
      toggleEntry(localDb, habitId, localDateStr()).catch(() => { /* the row stays as it was */ });
      return;
    }
    setHabitsV2((prev) => tapHabit(prev, id));
  }, [setHabitsV2]);

  const checklist = useMemo(() => computeChecklist({ onboard, habits: habitsV2, goals }), [onboard, habitsV2, goals]);
  const topStreak = habits.reduce((m, h) => Math.max(m, h.streak), 0);
  // Global progression: XP derives from every store, never stored directly.
  const xpInfo = useXp();
  const xp = xpInfo.total;
  const level = xpInfo.level;

  // "Who I Am" — the five-year identity panel. Opens from a crest in the
  // header (manual) and auto-shows once per day on the first command-center
  // open, but only after the owner has actually written a vision, and never
  // over the lock/naming gates. Nothing here gates any functionality.
  const [whoOpen, setWhoOpen] = useState(false);
  const [whoAuto, setWhoAuto] = useState(false);
  // Global search (command palette) — opens from the header or Cmd/Ctrl+K / "/".
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickSignal, setQuickSignal] = useState(0); // ticks to open Quick Log from the palette
  const [eveningOpen, setEveningOpen] = useState(false);
  const [streakOpen, setStreakOpen] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const [cascadeOpen, setCascadeOpen] = useState(false);
  const [habitIntelOpen, setHabitIntelOpen] = useState(false);
  const [riskOpen, setRiskOpen] = useState(false);
  const [overheadOpen, setOverheadOpen] = useState(false);
  const [prayerOpen, setPrayerOpen] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(false);
  const [reflectOpen, setReflectOpen] = useState(false);
  const [corrOpen, setCorrOpen] = useState(false);
  // Command-palette actions → app intents.
  const onSearchAction = useCallback((act) => {
    if (act === "quicklog") setQuickSignal((n) => n + 1);
    else if (act === "review") setReviewSignal((n) => n + 1);
    else if (act === "ai") setAiOpen(true);
    else if (act === "help") setHelpOpen(true);
    else if (act === "tour") startTour();
    else if (act === "shutdown") setEveningOpen(true);
    else if (act === "streak") setStreakOpen(true);
    else if (act === "focus") setFocusOpen(true);
    else if (act === "weekly") setWeeklyOpen(true);
    else if (act === "cascade") setCascadeOpen(true);
    else if (act === "habitintel") setHabitIntelOpen(true);
    else if (act === "risk") setRiskOpen(true);
    else if (act === "overhead") setOverheadOpen(true);
    else if (act === "prayer") setPrayerOpen(true);
    else if (act === "cards") setCardsOpen(true);
    else if (act === "reflect") setReflectOpen(true);
    else if (act === "correlations") setCorrOpen(true);
  }, [startTour]);
  useEffect(() => {
    const onKey = (e) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "k" || e.key === "K")) { e.preventDefault(); setSearchOpen(true); return; }
      const t = e.target;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (e.key === "/" && !typing && !mod) { e.preventDefault(); setSearchOpen(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const [rawWho] = useStorageState(WHO_KEY, { text: "", updatedAt: null });
  const [whoMeta, setWhoMeta] = useStorageState(WHO_META_KEY, { lastShownDs: "" });
  useEffect(() => {
    if (locked || showNaming || !habitsLoaded) return;
    if (shouldAutoShow(rawWho, whoMeta)) {
      // Passive daily auto-show — defer while an input is focused so it can't
      // interrupt typing (regression scope of the Week-in-Review fix).
      return whenNotTyping(() => {
        setWhoAuto(true);
        setWhoMeta({ lastShownDs: localDateStr() });
      });
    }
  }, [locked, showNaming, habitsLoaded]); // eslint-disable-line
  const whoTodayLine = useMemo(() => todayVisionLine({ streak: topStreak }), [topStreak]);
  const closeWho = () => { setWhoOpen(false); setWhoAuto(false); };
  const whoVisible = whoOpen || whoAuto;

  // Live cross-module context for the AI panel — real numbers only.
  const [aiCtx, setAiCtx] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const [tRaw, wRaw, gRaw, fRaw, bRaw] = await Promise.all([
          storage.get("ict_trades"), storage.get("athlete_workouts"), storage.get("gym_sessions"),
          storage.get("finance_state"), storage.get("ict_balance"),
        ]);
        const trades = tRaw ? JSON.parse(tRaw) : [];
        // Both training stores, same merge as useWorkouts — otherwise the AI
        // panel is told the user never trains.
        const legacyWorkouts = wRaw ? JSON.parse(wRaw) : [];
        const gymSessions = gRaw ? JSON.parse(gRaw) : [];
        const workouts = [...(Array.isArray(legacyWorkouts) ? legacyWorkouts.filter(Boolean) : []),
          ...gymSessionsToWorkouts(gymSessions)];
        const finance = fRaw ? JSON.parse(fRaw) : null;
        const stats = getStats(trades);
        const fin = financeSummary(finance || {});
        const now = new Date();
        const ws = new Date(now); ws.setDate(now.getDate() - now.getDay());
        const sessionsWk = workouts.filter((w) => new Date(w.date) >= ws).length;
        const workedToday = workouts.some((w) => w.date === localDateStr());
        setAiCtx({ tradingStats: stats, sessionsWk, workedToday, netWorth: fin.personalNetWorth, monthlyPassive: fin.monthlyPassive, thisMonthIncome: fin.thisMonthIncome });
      } catch { /* context is best-effort; the panel degrades gracefully */ }
    })();
  }, [module, aiOpen]);

  const renderModule = () => {
    switch (module) {
      case "dashboard": return <Dashboard onNavigate={navTo} onOpenSettings={() => setShowSettings(true)} onOpenReview={() => setReviewSignal((n) => n + 1)} habits={habitsV2} setHabits={setHabitsV2} loaded={habitsLoaded} xp={xpInfo} />;
      case "firm": return <FirmOS navHint={navHint?.module === "firm" ? navHint : null} />;
      case "faith": return <FaithOS habits={habitsV2} setHabits={setHabitsV2} loaded={habitsLoaded} />;
      case "nutrition": return <NutritionOS navHint={navHint?.module === "nutrition" ? navHint : null} />;
      case "gym": return <BodyOS navHint={navHint?.module === "gym" ? navHint : null} />;
      case "habits": return <HabitsOS />;
      case "calendar": return <CalendarModule onNavigate={navTo} />;
      case "analytics": return <AnalyticsOS habits={habitsAll} onNavigate={navTo} xpInfo={xpInfo} navHint={navHint?.module === "analytics" ? navHint : null} />;
      default: return <Dashboard onNavigate={navTo} onOpenSettings={() => setShowSettings(true)} onOpenReview={() => setReviewSignal((n) => n + 1)} habits={habitsV2} setHabits={setHabitsV2} loaded={habitsLoaded} xp={xpInfo} />;
    }
  };

  const globalStyle = (
    <style>{`
      /* Fonts are self-hosted + latin-subset, loaded via <link> in index.html —
         no render-blocking @import, works fully offline. */
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html, body { max-width: 100%; overflow-x: hidden; background: #000000; }
      body { font-feature-settings: "cv11", "ss01"; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
      /* tabular figures everywhere numbers matter — dashboards & finance line up */
      [style*="monospace"], input { font-variant-numeric: tabular-nums; }
      ::selection { background: rgba(229,72,77,0.30); }
      ::-webkit-scrollbar { width: 5px; height: 5px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.10); border-radius: 3px; }
      ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }
      input[type=number]::-webkit-inner-spin-button { opacity: 0.4; }
      input::placeholder, textarea::placeholder { color: rgba(136,151,179,0.45); }
      input, textarea, select { transition: border-color 0.25s ease, box-shadow 0.25s ease, background 0.25s ease; }
      input:focus, textarea:focus, select:focus { border-color: rgba(229,72,77,0.55) !important; box-shadow: 0 0 0 3px rgba(229,72,77,0.10); }
      button { font-family: inherit; transition: transform 0.14s cubic-bezier(0.34,1.4,0.64,1), background 0.22s ease, border-color 0.22s ease, color 0.22s ease, box-shadow 0.22s ease; }
      button:active { transform: scale(0.97); }
      /* frosted cards float and gently lift toward the pointer */
      .glass-card { transition: transform 0.3s cubic-bezier(0.4,0,0.2,1), box-shadow 0.3s cubic-bezier(0.4,0,0.2,1), border-color 0.3s ease; will-change: transform; }
      .glass-card:hover { transform: translateY(-2px); box-shadow: 0 16px 44px rgba(0,0,0,0.46), inset 0 1px 0 rgba(255,255,255,0.08); }
      @media (hover: none) { .glass-card:hover { transform: none; } }
      @keyframes dp { 0%,100% { opacity: 0.3; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.2); } }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes moduleIn { from { opacity: 0; transform: translateY(14px) scale(0.995); filter: blur(3px); } to { opacity: 1; transform: none; filter: none; } }
      @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
      @keyframes ambientDrift { 0%,100% { transform: translate(0,0); } 50% { transform: translate(6vw,4vh); } }
      @keyframes ambientDrift2 { 0%,100% { transform: translate(0,0); } 50% { transform: translate(-5vw,-3vh); } }
      @keyframes ambientScan { 0% { transform: translateY(-40%); opacity: 0; } 12% { opacity: 1; } 88% { opacity: 1; } 100% { transform: translateY(280%); opacity: 0; } }
      @keyframes ambientRays { 0% { opacity: 0.35; } 100% { opacity: 0.62; } }
      @keyframes ambientSpin { to { transform: rotate(360deg); } }
      @keyframes ambientSpinRev { to { transform: rotate(-360deg); } }
      /* live collage moodboard: slow ken-burns drift + rising embers */
      @keyframes kenburns { 0% { transform: scale(1) translate(0,0); } 100% { transform: scale(1.14) translate(-2%,-2%); } }
      @keyframes emberRise { 0% { transform: translateY(0) translateX(0); opacity: 0; } 12% { opacity: 0.9; } 80% { opacity: 0.7; } 100% { transform: translateY(-92vh) translateX(3vw); opacity: 0; } }
      @keyframes purityGlow { 0% { box-shadow: 0 0 0 rgba(140,224,166,0); } 30% { box-shadow: 0 0 34px rgba(140,224,166,0.35); } 100% { box-shadow: 0 0 0 rgba(140,224,166,0); } }
      @keyframes xpPill { 0% { opacity: 0; transform: translateY(8px) scale(0.94); } 12% { opacity: 1; transform: none; } 82% { opacity: 1; } 100% { opacity: 0; transform: translateY(-10px); } }
      @keyframes levelUp { 0% { opacity: 0; transform: scale(0.55); } 16% { opacity: 1; transform: scale(1.07); } 28% { transform: scale(1); } 80% { opacity: 1; } 100% { opacity: 0; transform: translateY(-16px) scale(0.98); } }
      @keyframes levelGlow { 0% { opacity: 0; transform: scale(0.5); } 20% { opacity: 1; } 75% { opacity: 0.9; } 100% { opacity: 0; transform: scale(1.25); } }
      @keyframes lockShake { 0%, 100% { transform: translateX(0); } 20% { transform: translateX(-7px); } 40% { transform: translateX(6px); } 60% { transform: translateX(-4px); } 80% { transform: translateX(3px); } }
      /* cockpit sections rise + fade in, staggered so it assembles top-down */
      @keyframes cockpitRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
      .cockpit > * { animation: cockpitRise 0.42s cubic-bezier(0.22,0.8,0.3,1) both; }
      .cockpit > *:nth-child(2) { animation-delay: 0.05s; }
      .cockpit > *:nth-child(3) { animation-delay: 0.10s; }
      .cockpit > *:nth-child(4) { animation-delay: 0.15s; }
      .cockpit > *:nth-child(5) { animation-delay: 0.20s; }
      .cockpit > *:nth-child(6) { animation-delay: 0.25s; }
      .cockpit > *:nth-child(7) { animation-delay: 0.30s; }
      .cockpit > *:nth-child(8) { animation-delay: 0.35s; }
      .cockpit > *:nth-child(9) { animation-delay: 0.40s; }
      .cockpit > *:nth-child(10) { animation-delay: 0.45s; }
      /* a slow warm pulse for the perfect-day hero */
      @keyframes emberPulse { 0%,100% { box-shadow: 0 0 0 rgba(240,180,41,0.0), inset 0 0 0 rgba(240,180,41,0); } 50% { box-shadow: 0 0 46px rgba(240,180,41,0.22), inset 0 0 40px rgba(240,180,41,0.06); } }
      /* Week in Review modal entrance */
      @keyframes reviewRise { from { opacity: 0; transform: translateY(16px) scale(0.98); } to { opacity: 1; transform: none; } }
      /* Want List — milestone confetti burst + progress-bar sheen */
      @keyframes confettiPop { 0% { opacity: 0; transform: translate(0,0) scale(0.4) rotate(0deg); } 12% { opacity: 1; } 100% { opacity: 0; transform: translate(var(--cx,0), var(--cy,80px)) scale(1) rotate(var(--cr,180deg)); } }
      @keyframes wantGlow { 0% { box-shadow: 0 0 0 rgba(63,185,80,0); } 30% { box-shadow: 0 0 40px rgba(63,185,80,0.4); } 100% { box-shadow: 0 0 0 rgba(63,185,80,0); } }
      @keyframes barShimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(300%); } }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
      }
    `}</style>
  );

  if (locked) {
    return (
      <>
        {globalStyle}
        <AmbientBackground module="dashboard" animate={!isMobile} />
        <LockScreen onUnlock={() => setLocked(false)} />
      </>
    );
  }

  if (isMobile) {
    return (
      <ToastProvider>
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "transparent", position: "relative", zIndex: 1, fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif", color: T1, overflow: "hidden" }}>
        {globalStyle}
        <AmbientBackground module={module} animate={!isMobile} />
        <Header module={module} aiOpen={aiOpen} onAIToggle={() => setAiOpen((o) => !o)} isMobile onMenu={() => setMobileNavOpen(true)} onNavigate={navTo} onOpenHelp={() => setHelpOpen(true)} onOpenSettings={() => setShowSettings(true)} onOpenWhoIAm={() => setWhoOpen(true)} onOpenSearch={() => setSearchOpen(true)} streak={topStreak} xp={xp} level={level} xpTitle={xpInfo.title} pctToNext={xpInfo.pctToNext} toNext={xpInfo.nextLevelXp - xp} />
        <div key={module} style={{ flex: 1, overflowY: "auto", overflowX: "auto", WebkitOverflowScrolling: "touch", animation: "moduleIn 0.5s cubic-bezier(0.4,0,0.2,1)" }}>
          <ErrorBoundary key={module}><Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: T1, opacity: 0.3, fontSize: 13 }}>…</div>}>{renderModule()}</Suspense></ErrorBoundary>
        </div>

        {mobileNavOpen && (
          <>
            <div onClick={() => setMobileNavOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 45 }} />
            <Sidebar
              overlay
              active={module}
              onNavigate={(id) => { navTo(id); setMobileNavOpen(false); }}
              collapsed={false}
              onToggle={() => setMobileNavOpen(false)}
              onOpenSettings={() => { setShowSettings(true); setMobileNavOpen(false); }}
            />
          </>
        )}

        {aiOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 44 }}>
            <Suspense fallback={null}><AIPanel mobile onClose={() => setAiOpen(false)} onOpenSettings={() => { setShowSettings(true); setAiOpen(false); }} ctx={aiCtx} habits={habits} /></Suspense>
          </div>
        )}
        <XPCelebration xp={xpInfo} />
        <NotifTicker />
        {/* The day's habits and meals, from wherever you happen to be. Hidden
            while a full-screen overlay owns the view. */}
        <Suspense fallback={null}>
          <QuickLog habits={habitsAll} onTap={quickTap} hidden={aiOpen || showSettings || helpOpen || searchOpen || tourOn} />
        </Suspense>
        <AutoGoalSync xp={xpInfo} />
        <WeeklyReviewGate habits={habitsAll} openSignal={reviewSignal} />
        <Suspense fallback={null}>
        {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} onStartTour={startTour} onOpenHelp={() => setShowSettings(false) || setHelpOpen(true)} helpMode={helpMode} setHelpMode={setHelpMode} />}
        {helpOpen && <HelpCenter onClose={() => setHelpOpen(false)} onStartTour={startTour} helpMode={helpMode} setHelpMode={setHelpMode} checklist={checklist} />}
        {wnOpen && <WhatsNew onClose={closeWhatsNew} onStartTour={startTour} />}
        {tourOn && <GuidedTour steps={TOUR_OVERVIEW.steps} onNavigate={(m) => setModule(m)} onClose={endTour} onFinish={endTour} />}
        {whoVisible && <WhoIAm autoShow={whoAuto && !whoOpen} todayLine={whoTodayLine} onClose={closeWho} />}
        {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} onNavigate={navTo} onOpenWhoIAm={() => setWhoOpen(true)} onAction={onSearchAction} />}
        {eveningOpen && <EveningReview onClose={() => setEveningOpen(false)} habits={habitsAll} />}
        {streakOpen && <StreakInsurance onClose={() => setStreakOpen(false)} byDay={xpInfo.byDay} />}
        {focusOpen && <FocusTimer onClose={() => setFocusOpen(false)} />}
        {weeklyOpen && <WeeklyPlan onClose={() => setWeeklyOpen(false)} />}
        {cascadeOpen && <GoalCascade onClose={() => setCascadeOpen(false)} />}
        {habitIntelOpen && <HabitIntel onClose={() => setHabitIntelOpen(false)} habits={habitsV2} />}
        {riskOpen && <RiskCalculator onClose={() => setRiskOpen(false)} />}
        {overheadOpen && <OverheadLedger onClose={() => setOverheadOpen(false)} />}
        {prayerOpen && <PrayerList onClose={() => setPrayerOpen(false)} />}
        {cardsOpen && <Flashcards onClose={() => setCardsOpen(false)} />}
        {reflectOpen && <QuickJournal onClose={() => setReflectOpen(false)} />}
        {corrOpen && <Correlations onClose={() => setCorrOpen(false)} byDay={xpInfo.byDay} habits={habitsAll} />}
        </Suspense>
        {showNaming && <NameYourSystem onDone={(vals) => identity.save(vals || {})} />}
      </div>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
    <div style={{ display: "flex", height: "100vh", background: "transparent", position: "relative", zIndex: 1, fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif", color: T1, overflow: "hidden" }}>
      {globalStyle}
      <AmbientBackground module={module} animate={!isMobile} />

      <Sidebar active={module} onNavigate={navTo} collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} onOpenSettings={() => setShowSettings(true)} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <Header module={module} aiOpen={aiOpen} onAIToggle={() => setAiOpen((o) => !o)} onNavigate={navTo} onOpenHelp={() => setHelpOpen(true)} onOpenSettings={() => setShowSettings(true)} onOpenWhoIAm={() => setWhoOpen(true)} onOpenSearch={() => setSearchOpen(true)} streak={topStreak} xp={xp} level={level} xpTitle={xpInfo.title} pctToNext={xpInfo.pctToNext} toNext={xpInfo.nextLevelXp - xp} xpToday={xpInfo.today} xpTodayByCat={xpInfo.todayByCat} />
        <div key={module} style={{ flex: 1, overflowY: module === "firm" ? "hidden" : "auto", overflow: module === "firm" ? "hidden" : "auto", animation: "moduleIn 0.5s cubic-bezier(0.4,0,0.2,1)" }}>
          <ErrorBoundary key={module}><Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: T1, opacity: 0.3, fontSize: 13 }}>…</div>}>{renderModule()}</Suspense></ErrorBoundary>
        </div>
      </div>

      {aiOpen && <Suspense fallback={null}><AIPanel onClose={() => setAiOpen(false)} onOpenSettings={() => setShowSettings(true)} ctx={aiCtx} habits={habits} /></Suspense>}
      <XPCelebration xp={xpInfo} />
        <NotifTicker />
        <AutoGoalSync xp={xpInfo} />
        {/* The day's habits and meals, from wherever you happen to be. Hidden
            while a full-screen overlay owns the view. */}
        <Suspense fallback={null}>
          <QuickLog habits={habitsAll} onTap={quickTap} hidden={aiOpen || showSettings || helpOpen || searchOpen || tourOn} />
        </Suspense>
        <WeeklyReviewGate habits={habitsAll} openSignal={reviewSignal} />
      <Suspense fallback={null}>
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} onStartTour={startTour} onOpenHelp={() => setShowSettings(false) || setHelpOpen(true)} helpMode={helpMode} setHelpMode={setHelpMode} />}
      {helpOpen && <HelpCenter onClose={() => setHelpOpen(false)} onStartTour={startTour} helpMode={helpMode} setHelpMode={setHelpMode} checklist={checklist} />}
      {wnOpen && <WhatsNew onClose={closeWhatsNew} onStartTour={startTour} />}
      {tourOn && <GuidedTour steps={TOUR_OVERVIEW.steps} onNavigate={(m) => setModule(m)} onClose={endTour} onFinish={endTour} />}
      {whoVisible && <WhoIAm autoShow={whoAuto && !whoOpen} todayLine={whoTodayLine} onClose={closeWho} />}
        {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} onNavigate={navTo} onOpenWhoIAm={() => setWhoOpen(true)} onAction={onSearchAction} />}
        {eveningOpen && <EveningReview onClose={() => setEveningOpen(false)} habits={habitsAll} />}
        {streakOpen && <StreakInsurance onClose={() => setStreakOpen(false)} byDay={xpInfo.byDay} />}
        {focusOpen && <FocusTimer onClose={() => setFocusOpen(false)} />}
        {weeklyOpen && <WeeklyPlan onClose={() => setWeeklyOpen(false)} />}
        {cascadeOpen && <GoalCascade onClose={() => setCascadeOpen(false)} />}
        {habitIntelOpen && <HabitIntel onClose={() => setHabitIntelOpen(false)} habits={habitsV2} />}
        {riskOpen && <RiskCalculator onClose={() => setRiskOpen(false)} />}
        {overheadOpen && <OverheadLedger onClose={() => setOverheadOpen(false)} />}
        {prayerOpen && <PrayerList onClose={() => setPrayerOpen(false)} />}
        {cardsOpen && <Flashcards onClose={() => setCardsOpen(false)} />}
        {reflectOpen && <QuickJournal onClose={() => setReflectOpen(false)} />}
        {corrOpen && <Correlations onClose={() => setCorrOpen(false)} byDay={xpInfo.byDay} habits={habitsAll} />}
      </Suspense>
      {showNaming && <NameYourSystem onDone={(vals) => identity.save(vals || {})} />}
    </div>
    </ToastProvider>
  );
}
