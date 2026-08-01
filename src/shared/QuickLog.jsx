// Floating quick-log: log the day's real work from anywhere in one tap —
// habits, a frequent meal, or a repeat of your last workout. The button
// itself is a live progress ring for the day's habits. Meals and workouts
// are written straight into their own stores (nutrition_log /
// athlete_workouts), so XP, streaks and every module pick them up exactly
// as if logged from inside the Athlete tab — with an Undo on each.
import { useState, useMemo, useEffect } from "react";
import { Zap, Check, X, Utensils, Dumbbell, Copy, RotateCcw } from "lucide-react";
import { B1, BD, BD2, T1, T2, T3, GL, CY, GR, AM } from "./designTokens.js";
import { localDateStr, daysAgoStr } from "./dates.js";
import { isScheduled, isDone, isSkipped, valueOn } from "./habitEngine.js";
import { useStorageState } from "./useStorageState.js";
import { useToast } from "./toast.jsx";
import { sanitizeNutrition, frequentEntries, slotForNow, dayEntries } from "../modules/athlete/nutrition.js";

const nowTime = () => new Date().toTimeString().slice(0, 5);
const rid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`;

const SectionHead = ({ icon, children }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "12px 0 7px", fontSize: 9.5, color: T3, letterSpacing: 1.5, textTransform: "uppercase" }}>
    {icon}{children}
  </div>
);

export function QuickLog({ habits, onTap, hidden, offsetRight = 24, openSignal = 0 }) {
  const [open, setOpen] = useState(false);
  const ds = localDateStr();
  const toast = useToast();

  const [rawLog, setLog] = useStorageState("nutrition_log", {});
  const [rawWorkouts, setWorkouts] = useStorageState("athlete_workouts", []);
  const log = useMemo(() => sanitizeNutrition(rawLog), [rawLog]);
  const workouts = Array.isArray(rawWorkouts) ? rawWorkouts : [];

  // The command palette can open the sheet from anywhere (openSignal ticks up).
  useEffect(() => { if (openSignal) setOpen(true); }, [openSignal]);

  const scheduled = habits.filter((h) => !h.archived && !h.paused && isScheduled(h, ds));
  // Nothing scheduled → nothing to quick-log. Otherwise keep the FAB hidden
  // where it should be, but still let a command-opened sheet show through.
  if (!scheduled.length) return null;
  if (hidden && !open) return null;

  const done = scheduled.filter((h) => isDone(h, ds));
  const pct = Math.round((done.length / scheduled.length) * 100);
  const remaining = scheduled.filter((h) => !isDone(h, ds) && !isSkipped(h, ds));

  const frequents = frequentEntries(log);
  const yesterdayMeals = dayEntries(log, daysAgoStr(1));
  const lastWorkout = workouts.find((w) => w && w.id);
  const showMeals = frequents.length > 0 || yesterdayMeals.length > 0;
  const showWorkout = !!lastWorkout;

  const logMeal = (r) => {
    const entry = { id: rid("m"), slot: slotForNow(), time: nowTime(), name: r.name, grams: r.grams, proc: r.proc, n: r.n };
    setLog((prev) => { const p = sanitizeNutrition(prev); return { ...p, [ds]: [...(p[ds] || []), entry] }; });
    toast(`${r.name} logged`, { tone: "success", action: "Undo", onAction: () => setLog((prev) => { const p = sanitizeNutrition(prev); return { ...p, [ds]: (p[ds] || []).filter((e) => e.id !== entry.id) }; }) });
  };
  const copyYesterday = () => {
    if (!yesterdayMeals.length) return;
    const clones = yesterdayMeals.map((e, i) => ({ ...e, id: rid(`m${i}`) }));
    const ids = new Set(clones.map((cl) => cl.id));
    setLog((prev) => { const p = sanitizeNutrition(prev); return { ...p, [ds]: [...(p[ds] || []), ...clones] }; });
    toast(`Copied ${clones.length} item${clones.length > 1 ? "s" : ""} from yesterday`, { tone: "success", action: "Undo", onAction: () => setLog((prev) => { const p = sanitizeNutrition(prev); return { ...p, [ds]: (p[ds] || []).filter((e) => !ids.has(e.id)) }; }) });
  };
  const repeatWorkout = () => {
    if (!lastWorkout) return;
    const w = { ...lastWorkout, id: rid("w"), date: ds, createdAt: new Date().toISOString() };
    delete w.editedAt;
    setWorkouts((prev) => [w, ...(Array.isArray(prev) ? prev : [])]);
    toast(`Repeated: ${w.name} 💪`, { tone: "success", action: "Undo", onAction: () => setWorkouts((prev) => (Array.isArray(prev) ? prev : []).filter((x) => x.id !== w.id)) });
  };

  const size = 52, stroke = 3.5, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const row = { display: "flex", alignItems: "center", gap: 9, padding: "9px 11px", background: GL, border: `1px solid ${BD}`, borderRadius: 10, cursor: "pointer", textAlign: "left", fontFamily: "inherit", width: "100%" };

  return (
    <>
      {open && <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 88 }} />}
      {open && (
        <div style={{ position: "fixed", bottom: 86, right: offsetRight, width: "min(320px, calc(100vw - 32px))", maxHeight: "62vh", overflowY: "auto", background: B1, border: `1px solid ${BD2}`, borderRadius: 16, padding: "14px", zIndex: 89, boxShadow: "0 18px 60px rgba(0,0,0,0.6)", animation: "fadeIn 0.18s ease" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: T1, letterSpacing: 0.5 }}>⚡ Quick Log · {done.length}/{scheduled.length} today</span>
            <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><X size={14} /></button>
          </div>

          {remaining.length === 0 ? (
            <div style={{ padding: "12px 10px 4px", textAlign: "center", fontSize: 12.5, color: GR }}>⭐ Every habit done. Perfect day.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 11 }}>
              {remaining.map((h) => {
                const v = valueOn(h, ds), target = h.target || 1;
                return (
                  <button key={h.id} onClick={() => onTap(h.id)} style={row}>
                    <span style={{ fontSize: 15 }}>{h.icon}</span>
                    <span style={{ flex: 1, fontSize: 12.5, color: T1 }}>{h.name}</span>
                    {target > 1
                      ? <span style={{ fontSize: 10.5, color: h.color, fontFamily: "monospace" }}>{v}/{target}{h.unit ? ` ${h.unit}` : ""} +1</span>
                      : <Check size={13} color={h.color} />}
                  </button>
                );
              })}
            </div>
          )}

          {showMeals && (
            <>
              <SectionHead icon={<Utensils size={11} color={GR} />}>Meals · one tap</SectionHead>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {frequents.map((r) => (
                  <button key={`${r.name}|${r.grams}`} onClick={() => logMeal(r)} aria-label={`Log ${r.name}`} style={row}>
                    <span style={{ fontSize: 14 }}>🍽️</span>
                    <span style={{ flex: 1, fontSize: 12.5, color: T1 }}>{r.name}</span>
                    <span style={{ fontSize: 10.5, color: T3, fontFamily: "monospace" }}>{r.grams}g</span>
                  </button>
                ))}
                {yesterdayMeals.length > 0 && (
                  <button onClick={copyYesterday} style={{ ...row, justifyContent: "center", gap: 6, color: CY, border: `1px solid ${CY}44` }}>
                    <Copy size={12} /><span style={{ fontSize: 12, fontWeight: 600 }}>Copy yesterday</span>
                  </button>
                )}
              </div>
            </>
          )}

          {showWorkout && (
            <>
              <SectionHead icon={<Dumbbell size={11} color={AM} />}>Workout</SectionHead>
              <button onClick={repeatWorkout} style={{ ...row, gap: 8 }}>
                <RotateCcw size={13} color={AM} />
                <span style={{ flex: 1, fontSize: 12.5, color: T1 }}>Repeat last session</span>
                <span style={{ fontSize: 10.5, color: T3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 110 }}>{lastWorkout.name}</span>
              </button>
            </>
          )}
        </div>
      )}

      <button onClick={() => setOpen((o) => !o)} title="Quick log" aria-label="Quick log"
        style={{ position: "fixed", bottom: 22, right: offsetRight, width: size, height: size, borderRadius: "50%", background: B1, border: `1px solid ${BD2}`, cursor: "pointer", zIndex: 89, boxShadow: "0 8px 28px rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>
        <svg width={size} height={size} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={BD} strokeWidth={stroke} />
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={pct === 100 ? GR : CY} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * c} ${c}`} style={{ transition: "stroke-dasharray 0.4s ease" }} />
        </svg>
        {pct === 100 ? <Check size={20} color={GR} /> : <Zap size={18} color={CY} />}
      </button>
    </>
  );
}
