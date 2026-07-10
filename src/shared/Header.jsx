import { useState, useEffect, useMemo } from "react";
import { Bell, Flame, Cpu, Sprout, Menu } from "lucide-react";
import { B1, BD, T1, T2, T3, GL, CY, PU, GR, AM } from "./designTokens.js";
import { getActiveKillzone, getEATTimeStr } from "../modules/trading/timezone.js";
import { nudgeOfTheDay } from "./kaizen.js";
import { useStorageState } from "./useStorageState.js";
import { migrateHabits } from "./habitEngine.js";
import { buildNudges } from "./insights.js";
import { NAV } from "./nav.js";
import { Meter } from "./ui.jsx";

function NudgeBell({ onNavigate }) {
  const [open, setOpen] = useState(false);
  // Live reads of every store the nudge rules need. All cheap, memoized.
  const [rawHabits] = useStorageState("habits", []);
  const [trades] = useStorageState("ict_trades", []);
  const [reviews] = useStorageState("ict_reviews", []);
  const [finance] = useStorageState("finance_state", null);
  const [verses] = useStorageState("faith_scripture", []);
  const [decisions] = useStorageState("mind_decisions", []);
  const [purity] = useStorageState("purity_log", {});
  const [nutrition] = useStorageState("nutrition_log", {});
  const [nutritionProfile] = useStorageState("nutrition_profile", null);
  const nudges = useMemo(() => buildNudges({
    habits: migrateHabits(rawHabits),
    trades: (Array.isArray(trades) ? trades : []).filter((t) => t && t.id),
    reviews,
    bills: finance?.bills,
    verses: Array.isArray(verses) ? verses : [],
    decisions: (Array.isArray(decisions) ? decisions : []).filter((d) => d && d.id),
    purity, nutrition, nutritionProfile,
  }), [rawHabits, trades, reviews, finance, verses, decisions, purity, nutrition, nutritionProfile]);
  const urgent = nudges.filter((n) => n.tone === "urgent").length;
  const TONE = { urgent: AM, celebrate: GR, info: T3 };

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} aria-label={`Notifications${nudges.length ? ` (${nudges.length})` : ""}`}
        style={{ width: 34, height: 34, borderRadius: 10, background: open ? `${GR}18` : GL, border: `1px solid ${open ? GR + "55" : BD}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Bell size={13} color={open ? GR : T2} />
      </button>
      {nudges.length > 0 && (
        <div style={{ position: "absolute", top: 4, right: 4, minWidth: 13, height: 13, borderRadius: 7, background: urgent ? AM : GR, border: `1.5px solid ${B1}`, fontSize: 8.5, fontWeight: 800, color: "#000", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", pointerEvents: "none" }}>
          {nudges.length}
        </div>
      )}
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div style={{ position: "absolute", top: 42, right: 0, width: 300, maxWidth: "calc(100vw - 28px)", background: B1, border: `1px solid ${BD}`, borderRadius: 12, padding: 14, zIndex: 41, boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 11 }}>
              <Sprout size={13} color={GR} />
              <span style={{ fontSize: 11, fontWeight: 700, color: GR, letterSpacing: 1.5 }}>WHAT MATTERS NOW</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {nudges.length === 0 && (
                <div style={{ padding: "16px 10px", textAlign: "center", fontSize: 12, color: T2, lineHeight: 1.6 }}>
                  All clear — nothing owed, nothing at risk. 🌿
                </div>
              )}
              {nudges.map((n) => (
                <button key={n.id} onClick={() => { onNavigate?.(n.nav); setOpen(false); }}
                  style={{ display: "flex", gap: 9, padding: "10px 11px", background: GL, border: `1px solid ${TONE[n.tone]}33`, borderRadius: 9, cursor: "pointer", textAlign: "left", fontFamily: "inherit", width: "100%" }}>
                  <span style={{ fontSize: 12, flexShrink: 0 }}>{n.icon}</span>
                  <span style={{ fontSize: 12, color: T2, lineHeight: 1.5 }}>{n.text}</span>
                </button>
              ))}
            </div>
            <div style={{ fontSize: 10, color: T3, marginTop: 11, lineHeight: 1.5, textAlign: "center" }}>{nudgeOfTheDay(0)}</div>
          </div>
        </>
      )}
    </div>
  );
}

export function Header({ module, aiOpen, onAIToggle, isMobile, onMenu, onNavigate, streak = 0, xp = 0, level = 1, xpTitle = "", pctToNext = 0, toNext = 0 }) {
  const label = NAV.find((n) => n.id === module)?.label || "Command Center";
  const [kz, setKz] = useState(getActiveKillzone);
  const [eatTime, setEatTime] = useState(getEATTimeStr);

  useEffect(() => {
    const t = setInterval(() => { setKz(getActiveKillzone()); setEatTime(getEATTimeStr()); }, 30000);
    return () => clearInterval(t);
  }, []);

  if (isMobile) {
    return (
      <div style={{ position: "relative", zIndex: 30, height: 56, background: "rgba(9,13,24,0.6)", backdropFilter: "blur(15px) saturate(125%)", WebkitBackdropFilter: "blur(15px) saturate(125%)", borderBottom: `1px solid ${BD}`, display: "flex", alignItems: "center", padding: "0 12px", gap: 10, flexShrink: 0 }}>
        <button onClick={onMenu} aria-label="Open menu" style={{ width: 36, height: 36, borderRadius: 10, background: GL, border: `1px solid ${BD}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Menu size={18} color={T2} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: T1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
          <div style={{ fontSize: 9.5, color: kz.color, display: "flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            <span style={{ width: 5, height: 5, borderRadius: "50%", background: kz.active ? kz.color : T3, flexShrink: 0 }} />
            {kz.label.split("(")[0].trim()} · {eatTime} EAT
          </div>
        </div>
        <NudgeBell onNavigate={onNavigate} />
        <button onClick={onAIToggle} aria-label="KAHIRO AI" style={{ width: 36, height: 36, borderRadius: 10, border: `1px solid ${aiOpen ? CY + "55" : BD}`, cursor: "pointer", background: aiOpen ? `linear-gradient(135deg,${CY}22,${PU}22)` : GL, color: aiOpen ? CY : T2, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Cpu size={15} />
        </button>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", zIndex: 30, height: 60, background: "rgba(9,13,24,0.6)", backdropFilter: "blur(15px) saturate(125%)", WebkitBackdropFilter: "blur(15px) saturate(125%)", borderBottom: `1px solid ${BD}`, display: "flex", alignItems: "center", padding: "0 22px", gap: 16, flexShrink: 0 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T1 }}>{label}</div>
        <div style={{ fontSize: 10, color: T3 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 11px", background: `${kz.color}11`, border: `1px solid ${kz.color}33`, borderRadius: 20 }}>
        <div style={{ width: 6, height: 6, borderRadius: "50%", background: kz.active ? kz.color : T3, boxShadow: kz.active ? `0 0 6px ${kz.color}` : undefined }} />
        <span style={{ fontSize: 10, color: kz.color, fontWeight: 600, letterSpacing: 0.5 }}>{kz.label.split("(")[0].trim()}</span>
        <span style={{ fontSize: 10, color: T3 }}>{eatTime} EAT</span>
      </div>

      {xp > 0 && (
        <div title={`${xpTitle ? xpTitle + " · " : ""}${xp.toLocaleString()} lifetime XP · ${toNext.toLocaleString()} XP to level ${level + 1} — earned from real completions across every pillar`}
          style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 11px", background: `${AM}11`, borderRadius: 10, border: `1px solid ${AM}22` }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, color: AM, letterSpacing: 0.5 }}>LVL {level}</span>
          <Meter pct={pctToNext} height={4} fill={`linear-gradient(90deg,${AM}88,${AM})`} style={{ width: 52 }} />
          <span style={{ fontSize: 10, color: T3, fontFamily: "monospace" }}>{xp.toLocaleString()} XP</span>
        </div>
      )}

      {streak > 0 && (
        <div title="Longest active habit streak" style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", background: GL, borderRadius: 10, border: `1px solid ${BD}` }}>
          <Flame size={12} color={AM} />
          <span style={{ fontSize: 13, fontWeight: 700, color: T1, fontFamily: "monospace" }}>{streak}</span>
          <span style={{ fontSize: 10, color: T3 }}>day streak</span>
        </div>
      )}

      <NudgeBell onNavigate={onNavigate} />

      <button onClick={onAIToggle} style={{ height: 34, padding: "0 13px", borderRadius: 10, border: `1px solid ${aiOpen ? CY + "55" : BD}`, cursor: "pointer", background: aiOpen ? `linear-gradient(135deg,${CY}22,${PU}22)` : GL, color: aiOpen ? CY : T2, fontSize: 11.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 7, transition: "all 0.2s", fontFamily: "inherit" }}>
        <Cpu size={13} />KAHIRO
      </button>
    </div>
  );
}
