import { useState, useEffect } from "react";
import { B0, T1 } from "./shared/designTokens.js";
import { storage } from "./shared/storage.js";
import { useStorageState } from "./shared/useStorageState.js";
import { getStats } from "./modules/trading/helpers.js";
import { HABITS_DEF } from "./modules/dashboard/domains.js";
import { Dashboard } from "./modules/dashboard/Dashboard.jsx";
import { TradingModule } from "./modules/trading/TradingModule.jsx";
import { AthleteOS } from "./modules/athlete/AthleteOS.jsx";
import { FinanceOS } from "./modules/finance/FinanceOS.jsx";
import { LifeOSModule } from "./modules/life/LifeOSModule.jsx";
import { PlaceholderModule } from "./shared/PlaceholderModule.jsx";
import { Sidebar } from "./shared/Sidebar.jsx";
import { Header } from "./shared/Header.jsx";
import { AIPanel } from "./shared/AIPanel.jsx";
import { SettingsPanel } from "./shared/SettingsPanel.jsx";

export default function App() {
  const [module, setModule] = useState("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [aiOpen, setAiOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [habits, setHabits] = useStorageState("habits", HABITS_DEF);
  const [tradingStats, setTradingStats] = useState({ wr: 0, total: 0, pf: 0, avgRR: 0, totalPnl: 0 });

  useEffect(() => {
    (async () => {
      const raw = await storage.get("ict_trades");
      if (raw) setTradingStats(getStats(JSON.parse(raw)));
    })();
  }, [module]);

  const renderModule = () => {
    switch (module) {
      case "dashboard": return <Dashboard onNavigate={setModule} habits={habits} setHabits={setHabits} />;
      case "trading": return <TradingModule />;
      case "athlete": return <AthleteOS />;
      case "finance": return <FinanceOS />;
      case "life": return <LifeOSModule habits={habits} setHabits={setHabits} />;
      case "relations": return <PlaceholderModule title="Relationship System" sub="Quality Time · Shared Goals · Connection" features={[{ name: "Date Planner", icon: "💕", desc: "Schedule and plan meaningful experiences." }, { name: "Important Dates", icon: "📅", desc: "Never miss anniversaries or milestones." }, { name: "Relationship Journal", icon: "📝", desc: "Log shared moments and reflections." }, { name: "Shared Goals", icon: "🎯", desc: "Set and track goals together." }, { name: "Conversation Prompts", icon: "💬", desc: "Deep questions to strengthen connection." }, { name: "AI Coach", icon: "🤖", desc: "Relationship intelligence and guidance." }]} />;
      case "knowledge": return <PlaceholderModule title="Knowledge Base" sub="Second Brain · Reading · Ideas · Learning" features={[{ name: "Note Capture", icon: "📄", desc: "Capture and organise ideas and insights." }, { name: "Reading Tracker", icon: "📚", desc: "Track books, articles, and materials." }, { name: "Idea Vault", icon: "💡", desc: "Store and develop your best ideas." }, { name: "Book Summaries", icon: "🗂️", desc: "Synthesise key lessons from reading." }, { name: "Learning Tracker", icon: "🎓", desc: "Monitor skills and knowledge acquisition." }, { name: "AI Assistant", icon: "🤖", desc: "Search and expand your knowledge base." }]} />;
      case "productivity": return <PlaceholderModule title="Productivity OS" sub="Tasks · Projects · Deep Work · Focus" features={[{ name: "Task Manager", icon: "✅", desc: "Capture, prioritise, and execute tasks." }, { name: "Deep Work Timer", icon: "⏱️", desc: "Structured focus sessions with Pomodoro." }, { name: "Project Tracker", icon: "📊", desc: "Manage multi-step projects end-to-end." }, { name: "Daily Priorities", icon: "🎯", desc: "Select your 1–3 MITs each morning." }, { name: "Focus Mode", icon: "🔇", desc: "Distraction-free peak performance mode." }, { name: "Habit Streaks", icon: "🔥", desc: "Visual streak tracking for daily behaviours." }]} />;
      case "health": return <PlaceholderModule title="Health OS" sub="Mental · Physical · Recovery · Vitals" features={[{ name: "Hydration", icon: "💧", desc: "Monitor water intake and electrolytes." }, { name: "Supplement Stack", icon: "💊", desc: "Log creatine, omega-3, Vitamin D, etc." }, { name: "Mood Tracking", icon: "😊", desc: "Monitor emotional states and stress." }, { name: "Sleep Analysis", icon: "😴", desc: "Track sleep quality and recovery." }, { name: "Stress Monitor", icon: "🧠", desc: "Identify patterns and apply interventions." }, { name: "Medical", icon: "🏥", desc: "Secure health data and appointments." }]} />;
      default: return <Dashboard onNavigate={setModule} habits={habits} setHabits={setHabits} />;
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: B0, fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif", color: T1, overflow: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.10); border-radius: 2px; }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.4; }
        input::placeholder, textarea::placeholder { color: rgba(136,151,179,0.45); }
        input:focus, textarea:focus, select:focus { border-color: rgba(0,212,255,0.4) !important; box-shadow: 0 0 0 3px rgba(0,212,255,0.07); }
        button { font-family: inherit; }
        button:active { transform: scale(0.97); }
        @keyframes dp { 0%,100% { opacity: 0.3; transform: scale(0.85); } 50% { opacity: 1; transform: scale(1.2); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>

      <Sidebar active={module} onNavigate={setModule} collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} onOpenSettings={() => setShowSettings(true)} />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <Header module={module} aiOpen={aiOpen} onAIToggle={() => setAiOpen((o) => !o)} />
        <div key={module} style={{ flex: 1, overflowY: module === "trading" ? "hidden" : "auto", overflow: module === "trading" ? "hidden" : "auto", animation: "fadeIn 0.25s ease" }}>
          {renderModule()}
        </div>
      </div>

      {aiOpen && <AIPanel onClose={() => setAiOpen(false)} tradingStats={tradingStats} />}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  );
}
