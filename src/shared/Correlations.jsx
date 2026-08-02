// ── Correlations — find what moves together ──────────────────────────
// Pick any two daily signals (XP, habits, meals, workouts, trades, journaling,
// focus) and see whether they rise and fall together over the last 60 days.
// Read-only. Opened from the palette. Lazy.
import { useMemo, useState } from "react";
import { X, GitCompareArrows } from "lucide-react";
import { B1, B2, BD, BD2, T1, T2, T3, GL, AC2, GR, RE } from "./designTokens.js";
import { useStorageState } from "./useStorageState.js";
import { isScheduled, isDone } from "./habitEngine.js";
import { sanitizeNutrition, dayEntries, dayTotals } from "../modules/athlete/nutrition.js";
import { sanitizeSessions } from "./focusSessions.js";
import { lastNDates, correlate } from "./correlations.js";

const WINDOW = 60;

export function Correlations({ onClose, byDay = {}, habits = [] }) {
  const [nutritionLog] = useStorageState("nutrition_log", {});
  const [workouts] = useStorageState("athlete_workouts", []);
  const [trades] = useStorageState("ti_trades", []);
  const [entries] = useStorageState("journal_entries", []);
  const [focus] = useStorageState("focus_sessions", []);

  const metrics = useMemo(() => {
    const dates = lastNDates(WINDOW);
    const dset = new Set(dates);
    const countBy = (list, dateFn) => {
      const m = {};
      for (const it of Array.isArray(list) ? list : []) {
        const ds = dateFn(it);
        if (ds && dset.has(ds)) m[ds] = (m[ds] || 0) + 1;
      }
      return m;
    };
    const activeHabits = (Array.isArray(habits) ? habits : []).filter((h) => h && !h.archived && !h.paused);
    const habitMap = {};
    for (const ds of dates) habitMap[ds] = activeHabits.filter((h) => isScheduled(h, ds) && isDone(h, ds)).length;
    const nutrition = sanitizeNutrition(nutritionLog);
    const kcalMap = {};
    for (const ds of dates) kcalMap[ds] = Math.round(dayTotals(dayEntries(nutrition, ds)).kcal || 0);
    const focusMap = {};
    for (const s of sanitizeSessions(focus)) if (dset.has(s.date)) focusMap[s.date] = (focusMap[s.date] || 0) + s.minutes;

    return [
      { id: "xp", label: "XP earned", map: byDay || {} },
      { id: "habits", label: "Habits done", map: habitMap },
      { id: "kcal", label: "Calories", map: kcalMap },
      { id: "workout", label: "Workouts", map: countBy(workouts, (w) => (w.date || "").slice(0, 10)) },
      { id: "trades", label: "Trades", map: countBy(trades, (t) => (t.date || "").slice(0, 10)) },
      { id: "journal", label: "Journaling", map: countBy(entries, (e) => (e.date || "").slice(0, 10)) },
      { id: "focus", label: "Focus minutes", map: focusMap },
    ];
  }, [byDay, habits, nutritionLog, workouts, trades, entries, focus]);

  const [a, setA] = useState("habits");
  const [b, setB] = useState("xp");
  const mapA = metrics.find((m) => m.id === a)?.map || {};
  const mapB = metrics.find((m) => m.id === b)?.map || {};
  const res = useMemo(() => (a === b ? { r: null, label: "pick two different signals" } : correlate(mapA, mapB, WINDOW)), [a, b, mapA, mapB]);

  const rColor = res.r == null ? T3 : Math.abs(res.r) >= 0.3 ? (res.r > 0 ? GR : RE) : T2;
  const labelA = metrics.find((m) => m.id === a)?.label || "";
  const labelB = metrics.find((m) => m.id === b)?.label || "";
  const sel = { flex: 1, background: B2, border: `1px solid ${BD}`, borderRadius: 9, padding: "9px 11px", fontSize: 13, color: T1, outline: "none", fontFamily: "inherit" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 4200, background: "rgba(0,0,0,0.66)", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "8vh 16px 24px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 440, background: B1, border: `1px solid ${BD2}`, borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", borderBottom: `1px solid ${BD}` }}>
          <GitCompareArrows size={18} color={AC2} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T1 }}>Correlations</div>
            <div style={{ fontSize: 11, color: T3 }}>What moves together · last {WINDOW} days</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><X size={17} /></button>
        </div>

        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <select value={a} onChange={(e) => setA(e.target.value)} style={sel}>{metrics.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
            <span style={{ fontSize: 12, color: T3, fontWeight: 700 }}>vs</span>
            <select value={b} onChange={(e) => setB(e.target.value)} style={sel}>{metrics.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select>
          </div>

          <div style={{ background: B2, border: `1px solid ${BD}`, borderRadius: 14, padding: "22px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 44, fontWeight: 800, color: rColor, fontFamily: "monospace", lineHeight: 1 }}>{res.r == null ? "—" : (res.r >= 0 ? "+" : "") + res.r.toFixed(2)}</div>
            <div style={{ fontSize: 12.5, color: T2, marginTop: 8, textTransform: "capitalize" }}>{res.label}</div>
          </div>

          {res.r != null && (
            <div style={{ fontSize: 12, color: T3, lineHeight: 1.5, textAlign: "center" }}>
              {Math.abs(res.r) < 0.15
                ? `${labelA} and ${labelB} don't track each other much.`
                : `On days with more ${labelA.toLowerCase()}, you tend to have ${res.r > 0 ? "more" : "less"} ${labelB.toLowerCase()}.`}
              <div style={{ marginTop: 6, color: T3, fontSize: 10.5 }}>Correlation isn't causation — it's a lead to test, not a verdict.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
