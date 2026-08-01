// ── Weekly Plan — name the week, set three priorities ────────────────
// Forward-looking companion to Week in Review: a theme for the week and the
// three things that must move. Last week's priorities appear for carry-over.
// Opened from the command palette. Lazy.
import { useMemo, useState } from "react";
import { X, CalendarRange, ArrowDown } from "lucide-react";
import { B1, B2, BD, BD2, T1, T2, T3, GL, AC2 } from "./designTokens.js";
import { useStorageState } from "./useStorageState.js";
import { WEEKLY_KEY, mondayOf, prevMonday, weekLabel, getPlan } from "./weeklyPlan.js";

export function WeeklyPlan({ onClose }) {
  const [plans, setPlans] = useStorageState(WEEKLY_KEY, {});
  const monday = useMemo(() => mondayOf(), []);
  const existing = getPlan(plans, monday);
  const lastWeek = useMemo(() => getPlan(plans, prevMonday(monday)), [plans, monday]);

  const [theme, setTheme] = useState(existing?.theme || "");
  const [priorities, setPriorities] = useState(() => {
    const p = existing?.priorities || [];
    return [p[0] || "", p[1] || "", p[2] || ""];
  });

  const setP = (i, v) => setPriorities((prev) => prev.map((x, j) => (j === i ? v : x)));
  const carryOver = (text) => setPriorities((prev) => {
    const idx = prev.findIndex((x) => !x.trim());
    if (idx < 0 || prev.some((x) => x.trim() === text.trim())) return prev;
    return prev.map((x, j) => (j === idx ? text : x));
  });

  const save = () => {
    const entry = { theme: theme.trim(), priorities: priorities.map((s) => s.trim()).filter(Boolean), at: new Date().toISOString() };
    setPlans((prev) => ({ ...(prev && typeof prev === "object" && !Array.isArray(prev) ? prev : {}), [monday]: entry }));
    onClose();
  };

  const input = { width: "100%", background: B2, border: `1px solid ${BD}`, borderRadius: 9, padding: "9px 12px", fontSize: 13, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  const label = { fontSize: 10.5, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 700, color: T3, margin: "0 0 7px" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 4200, background: "rgba(0,0,0,0.66)", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "8vh 16px 24px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 460, background: B1, border: `1px solid ${BD2}`, borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", borderBottom: `1px solid ${BD}` }}>
          <CalendarRange size={18} color={AC2} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T1 }}>Weekly Plan</div>
            <div style={{ fontSize: 11, color: T3 }}>Week of {weekLabel(monday)}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><X size={17} /></button>
        </div>

        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
          {lastWeek && (lastWeek.theme || lastWeek.priorities.length > 0) && (
            <div style={{ background: B2, border: `1px solid ${BD}`, borderRadius: 11, padding: "11px 13px" }}>
              <div style={{ ...label, marginBottom: 6 }}>Last week{lastWeek.theme ? ` · ${lastWeek.theme}` : ""}</div>
              {lastWeek.priorities.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0" }}>
                  <span style={{ flex: 1, fontSize: 12.5, color: T2 }}>• {p}</span>
                  <button onClick={() => carryOver(p)} title="Carry over"
                    style={{ display: "flex", alignItems: "center", gap: 3, padding: "3px 8px", borderRadius: 7, cursor: "pointer", fontFamily: "inherit", fontSize: 10.5, fontWeight: 700, background: `${AC2}18`, border: `1px solid ${AC2}44`, color: AC2 }}>
                    <ArrowDown size={11} /> Carry
                  </button>
                </div>
              ))}
            </div>
          )}

          <div>
            <div style={label}>This week's theme</div>
            <input value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="One phrase to steer the week…" style={input} />
          </div>

          <div>
            <div style={label}>The three that matter</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 18, height: 18, borderRadius: 5, background: B2, border: `1px solid ${BD}`, fontSize: 10, fontWeight: 700, color: T3, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                  <input value={priorities[i]} onChange={(e) => setP(i, e.target.value)} placeholder={i === 0 ? "The one that matters most…" : "…"} style={input} />
                </div>
              ))}
            </div>
          </div>

          <button onClick={save}
            style={{ padding: "12px", borderRadius: 11, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700, background: `linear-gradient(135deg,${AC2},#4C8DFF)`, color: "#000" }}>
            Set the week
          </button>
        </div>
      </div>
    </div>
  );
}
