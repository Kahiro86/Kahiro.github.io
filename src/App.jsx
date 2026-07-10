import { useState, useEffect, useMemo, useCallback } from "react";
import { T1 } from "./shared/designTokens.js";
import { storage } from "./shared/storage.js";
import { useStorageState } from "./shared/useStorageState.js";
import { useIsMobile } from "./shared/useIsMobile.js";
import { migrateHabits, toLegacy, tapHabit } from "./shared/habitEngine.js";
import { useXp } from "./shared/useXp.js";
import { XPCelebration } from "./shared/XPCelebration.jsx";
import { localDateStr } from "./shared/dates.js";
import { ToastProvider } from "./shared/toast.jsx";
import { ErrorBoundary } from "./shared/ErrorBoundary.jsx";
import { QuickLog } from "./shared/QuickLog.jsx";
import { AmbientBackground } from "./shared/AmbientBackground.jsx";
import { getStats } from "./modules/trading/helpers.js";
import { financeSummary } from "./modules/finance/summary.js";
import { HABITS_DEF } from "./modules/dashboard/domains.js";
import { Dashboard } from "./modules/dashboard/Dashboard.jsx";
import { TradingModule } from "./modules/trading/TradingModule.jsx";
import { AthleteOS } from "./modules/athlete/AthleteOS.jsx";
import { FinanceOS } from "./modules/finance/FinanceOS.jsx";
import { LifeOSModule } from "./modules/life/LifeOSModule.jsx";
import { FaithOS } from "./modules/faith/FaithOS.jsx";
import { MindOS } from "./modules/mind/MindOS.jsx";
import { AnalyticsOS } from "./modules/analytics/AnalyticsOS.jsx";
import { Sidebar } from "./shared/Sidebar.jsx";
import { Header } from "./shared/Header.jsx";
import { AIPanel } from "./shared/AIPanel.jsx";
import { SettingsPanel } from "./shared/SettingsPanel.jsx";

export default function App() {
  const isMobile = useIsMobile();
  const [module, setModule] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // AI panel starts open on desktop, closed on phones (it's a full overlay there).
  const [aiOpen, setAiOpen] = useState(() => (typeof window !== "undefined" ? window.innerWidth > 820 : true));
  const [showSettings, setShowSettings] = useState(false);

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
  const topStreak = habits.reduce((m, h) => Math.max(m, h.streak), 0);
  // Global progression: XP derives from every store, never stored directly.
  const xpInfo = useXp();
  const xp = xpInfo.total;
  const level = xpInfo.level;

  // Live cross-module context for the AI panel — real numbers only.
  const [aiCtx, setAiCtx] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const [tRaw, wRaw, fRaw, bRaw] = await Promise.all([
          storage.get("ict_trades"), storage.get("athlete_workouts"),
          storage.get("finance_state"), storage.get("ict_balance"),
        ]);
        const trades = tRaw ? JSON.parse(tRaw) : [];
        const workouts = wRaw ? JSON.parse(wRaw) : [];
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
      case "dashboard": return <Dashboard onNavigate={setModule} habits={habitsV2} setHabits={setHabitsV2} loaded={habitsLoaded} />;
      case "trading": return <TradingModule />;
      case "athlete": return <AthleteOS />;
      case "finance": return <FinanceOS />;
      case "life": return <LifeOSModule habits={habitsV2} setHabits={setHabitsV2} loaded={habitsLoaded} onNavigate={setModule} xpInfo={xpInfo} />;
      case "mind": return <MindOS />;
      case "faith": return <FaithOS habits={habitsV2} setHabits={setHabitsV2} loaded={habitsLoaded} />;
      case "analytics": return <AnalyticsOS habits={habitsV2} />;
      default: return <Dashboard onNavigate={setModule} habits={habitsV2} setHabits={setHabitsV2} loaded={habitsLoaded} />;
    }
  };

  const globalStyle = (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html, body { max-width: 100%; overflow-x: hidden; background: #05060d; }
      body { font-feature-settings: "cv11", "ss01"; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
      /* tabular figures everywhere numbers matter — dashboards & finance line up */
      [style*="monospace"], input { font-variant-numeric: tabular-nums; }
      ::selection { background: rgba(143,211,255,0.25); }
      ::-webkit-scrollbar { width: 5px; height: 5px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.10); border-radius: 3px; }
      ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }
      input[type=number]::-webkit-inner-spin-button { opacity: 0.4; }
      input::placeholder, textarea::placeholder { color: rgba(136,151,179,0.45); }
      input, textarea, select { transition: border-color 0.25s ease, box-shadow 0.25s ease, background 0.25s ease; }
      input:focus, textarea:focus, select:focus { border-color: rgba(143,211,255,0.45) !important; box-shadow: 0 0 0 3px rgba(143,211,255,0.08); }
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
      @keyframes purityGlow { 0% { box-shadow: 0 0 0 rgba(140,224,166,0); } 30% { box-shadow: 0 0 34px rgba(140,224,166,0.35); } 100% { box-shadow: 0 0 0 rgba(140,224,166,0); } }
      @keyframes xpPill { 0% { opacity: 0; transform: translateY(8px) scale(0.94); } 12% { opacity: 1; transform: none; } 82% { opacity: 1; } 100% { opacity: 0; transform: translateY(-10px); } }
      @keyframes levelUp { 0% { opacity: 0; transform: scale(0.55); } 16% { opacity: 1; transform: scale(1.07); } 28% { transform: scale(1); } 80% { opacity: 1; } 100% { opacity: 0; transform: translateY(-16px) scale(0.98); } }
      @keyframes levelGlow { 0% { opacity: 0; transform: scale(0.5); } 20% { opacity: 1; } 75% { opacity: 0.9; } 100% { opacity: 0; transform: scale(1.25); } }
      @media (prefers-reduced-motion: reduce) {
        *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
      }
    `}</style>
  );

  if (isMobile) {
    return (
      <ToastProvider>
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "transparent", position: "relative", zIndex: 1, fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif", color: T1, overflow: "hidden" }}>
        {globalStyle}
        <AmbientBackground module={module} animate={!isMobile} />
        <Header module={module} aiOpen={aiOpen} onAIToggle={() => setAiOpen((o) => !o)} isMobile onMenu={() => setMobileNavOpen(true)} onNavigate={setModule} streak={topStreak} xp={xp} level={level} xpTitle={xpInfo.title} pctToNext={xpInfo.pctToNext} toNext={xpInfo.nextLevelXp - xp} />
        <div key={module} style={{ flex: 1, overflowY: "auto", overflowX: "auto", WebkitOverflowScrolling: "touch", animation: "moduleIn 0.5s cubic-bezier(0.4,0,0.2,1)" }}>
          <ErrorBoundary key={module}>{renderModule()}</ErrorBoundary>
        </div>

        {mobileNavOpen && (
          <>
            <div onClick={() => setMobileNavOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 45 }} />
            <Sidebar
              overlay
              active={module}
              onNavigate={(id) => { setModule(id); setMobileNavOpen(false); }}
              collapsed={false}
              onToggle={() => setMobileNavOpen(false)}
              onOpenSettings={() => { setShowSettings(true); setMobileNavOpen(false); }}
            />
          </>
        )}

        {aiOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 44 }}>
            <AIPanel mobile onClose={() => setAiOpen(false)} ctx={aiCtx} habits={habits} />
          </div>
        )}
        <QuickLog habits={habitsV2} onTap={(id) => setHabitsV2((p) => tapHabit(p, id))} hidden={module === "life" || aiOpen || mobileNavOpen} offsetRight={16} />
        <XPCelebration xp={xpInfo} />
        {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
      </div>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
    <div style={{ display: "flex", height: "100vh", background: "transparent", position: "relative", zIndex: 1, fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif", color: T1, overflow: "hidden" }}>
      {globalStyle}
      <AmbientBackground module={module} animate={!isMobile} />

      <Sidebar active={module} onNavigate={setModule} collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} onOpenSettings={() => setShowSettings(true)} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <Header module={module} aiOpen={aiOpen} onAIToggle={() => setAiOpen((o) => !o)} onNavigate={setModule} streak={topStreak} xp={xp} level={level} xpTitle={xpInfo.title} pctToNext={xpInfo.pctToNext} toNext={xpInfo.nextLevelXp - xp} />
        <div key={module} style={{ flex: 1, overflowY: module === "trading" ? "hidden" : "auto", overflow: module === "trading" ? "hidden" : "auto", animation: "moduleIn 0.5s cubic-bezier(0.4,0,0.2,1)" }}>
          <ErrorBoundary key={module}>{renderModule()}</ErrorBoundary>
        </div>
      </div>

      {aiOpen && <AIPanel onClose={() => setAiOpen(false)} ctx={aiCtx} habits={habits} />}
      <QuickLog habits={habitsV2} onTap={(id) => setHabitsV2((p) => tapHabit(p, id))} hidden={module === "life"} offsetRight={aiOpen ? 364 : 24} />
      <XPCelebration xp={xpInfo} />
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
    </ToastProvider>
  );
}
