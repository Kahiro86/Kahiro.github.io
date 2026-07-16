import { useState, useEffect, useRef } from "react";
import { Flame, Cpu, Menu } from "lucide-react";
import { BD, T1, T2, T3, GL, CY, PU, GR, AM } from "./designTokens.js";
import { getActiveKillzone, getEATTimeStr } from "../modules/trading/timezone.js";
import { NAV } from "./nav.js";
import { Meter } from "./ui.jsx";
import { CAT_LABEL } from "./xpEngine.js";
import { NotificationCenter } from "./NotificationCenter.jsx";

const CAT_COLOR = { life: GR, trading: CY, fitness: PU, finance: AM, faith: "#B09A6F", mind: "#767FA6", awards: AM };

export function Header({ module, aiOpen, onAIToggle, isMobile, onMenu, onNavigate, streak = 0, xp = 0, level = 1, xpTitle = "", pctToNext = 0, toNext = 0, xpToday = 0, xpTodayByCat = {} }) {
  const label = NAV.find((n) => n.id === module)?.label || "Command Center";
  const [kz, setKz] = useState(getActiveKillzone);
  const [eatTime, setEatTime] = useState(getEATTimeStr);
  const [xpOpen, setXpOpen] = useState(false);
  const xpRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => { setKz(getActiveKillzone()); setEatTime(getEATTimeStr()); }, 30000);
    return () => clearInterval(t);
  }, []);

  // Close the XP breakdown on any click outside it. A fixed-position backdrop
  // can't be used here — the header's backdrop-filter makes it the containing
  // block for fixed children, confining inset:0 to the header bar.
  useEffect(() => {
    if (!xpOpen) return;
    const onDown = (e) => { if (xpRef.current && !xpRef.current.contains(e.target)) setXpOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [xpOpen]);

  const todayCats = Object.entries(xpTodayByCat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);

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
        <NotificationCenter onNavigate={onNavigate} />
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
        <div ref={xpRef} style={{ position: "relative" }}>
          <button onClick={() => setXpOpen((o) => !o)} aria-label="XP breakdown"
            title="Tap for today's XP breakdown"
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "5px 11px", background: xpOpen ? `${AM}1E` : `${AM}11`, borderRadius: 10, border: `1px solid ${xpOpen ? AM + "55" : AM + "22"}`, cursor: "pointer", fontFamily: "inherit" }}>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: AM, letterSpacing: 0.5 }}>LVL {level}</span>
            <Meter pct={pctToNext} height={4} fill={`linear-gradient(90deg,${AM}88,${AM})`} style={{ width: 52 }} />
            <span style={{ fontSize: 10, color: T3, fontFamily: "monospace" }}>{xp.toLocaleString()} XP</span>
          </button>
          {xpOpen && (
            <>
              <div onClick={() => setXpOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 39 }} />
              <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 40, width: 244, background: "rgba(12,16,26,0.97)", backdropFilter: "blur(14px)", border: `1px solid ${BD}`, borderRadius: 13, boxShadow: "0 14px 40px rgba(0,0,0,0.5)", padding: "14px 15px" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: T1 }}>{xpTitle || `Level ${level}`}</span>
                  <span style={{ fontSize: 10, color: T3 }}>{toNext.toLocaleString()} XP to L{level + 1}</span>
                </div>
                <Meter pct={pctToNext} height={5} fill={`linear-gradient(90deg,${AM}77,${AM})`} glow={`${AM}44`} style={{ marginBottom: 12 }} />
                <div style={{ fontSize: 9.5, color: T3, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 }}>Earned today{xpToday > 0 ? ` · +${xpToday.toLocaleString()} XP` : ""}</div>
                {todayCats.length === 0 ? (
                  <div style={{ fontSize: 11.5, color: T3, lineHeight: 1.5, padding: "2px 0 4px" }}>Nothing yet today. Complete a habit, log a workout or journal a line — every real action pays in.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {todayCats.map(([c, v]) => (
                      <div key={c} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 7, height: 7, borderRadius: "50%", background: CAT_COLOR[c] || T3, flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 11.5, color: T2 }}>{CAT_LABEL[c] || c}</span>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: CAT_COLOR[c] || T2, fontFamily: "monospace" }}>+{v.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: 9.5, color: T3, marginTop: 11, paddingTop: 9, borderTop: `1px solid ${BD}`, lineHeight: 1.5 }}>
                  XP is earned by doing the work — never edited, always in sync.
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {streak > 0 && (
        <div title="Longest active habit streak" style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", background: GL, borderRadius: 10, border: `1px solid ${BD}` }}>
          <Flame size={12} color={AM} />
          <span style={{ fontSize: 13, fontWeight: 700, color: T1, fontFamily: "monospace" }}>{streak}</span>
          <span style={{ fontSize: 10, color: T3 }}>day streak</span>
        </div>
      )}

      <NotificationCenter onNavigate={onNavigate} />

      <button onClick={onAIToggle} style={{ height: 34, padding: "0 13px", borderRadius: 10, border: `1px solid ${aiOpen ? CY + "55" : BD}`, cursor: "pointer", background: aiOpen ? `linear-gradient(135deg,${CY}22,${PU}22)` : GL, color: aiOpen ? CY : T2, fontSize: 11.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 7, transition: "all 0.2s", fontFamily: "inherit" }}>
        <Cpu size={13} />KAHIRO
      </button>
    </div>
  );
}
