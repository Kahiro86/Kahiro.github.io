// ── Evening Shutdown ritual — close the day with intention ───────────
// An honest end-of-day mirror: what actually got done, a rating, a win, a
// lesson, and the three things that matter tomorrow. Tomorrow's three come
// back as the next morning's focus. Opened from the command palette. Lazy.
import { useMemo, useState } from "react";
import { X, Moon, Check, Sunrise } from "lucide-react";
import { B1, B2, BD, BD2, T1, T2, T3, GL, AC2, GR, AM } from "./designTokens.js";
import { useStorageState } from "./useStorageState.js";
import { focusThisWeek, isDismissed } from "./review.js";
import { CHECKIN_KEY, CHECKIN_CFG_KEY, ANSWERS, getCheckin, setCheckin, getCadence } from "./focusCheckin.js";
import { useWorkouts } from "./useWorkouts.js";
import { localDateStr } from "./dates.js";
import { isScheduled, isDone } from "./habitEngine.js";
import { sanitizeNutrition, dayEntries, dayTotals } from "../modules/athlete/nutrition.js";
import { REVIEW_KEY, getReview, todayFocus, shutdownStreak } from "./eveningReview.js";

const RATINGS = [
  { n: 1, l: "Rough", c: "#F85149" },
  { n: 2, l: "Off", c: "#E3B341" },
  { n: 3, l: "Okay", c: "#B8B8B8" },
  { n: 4, l: "Good", c: "#4C8DFF" },
  { n: 5, l: "Excellent", c: "#3FB950" },
];

export function EveningReview({ onClose, habits = [] }) {
  const ds = localDateStr();
  const [reviews, setReviews] = useStorageState(REVIEW_KEY, {});
  const [log] = useStorageState("nutrition_log", {});
  const workouts = useWorkouts();
  const [entries] = useStorageState("journal_entries", []);
  const [trades] = useStorageState("ti_trades", []);
  // The week's focus and today's answer to it. This lived on the Command
  // Centre until that block was removed at the user's request, which left
  // focus_checkins with no writer at all — a Settings cadence for a check-in
  // that could never happen, and a Weekly Review section that could never
  // populate. "Did today serve it?" is an end-of-day question, so this is
  // where it belongs; the Command Centre stays clean either way.
  const [focusRaw] = useStorageState("weekly_focus", {});
  const [checkins, setCheckins] = useStorageState(CHECKIN_KEY, {});
  const [checkinCfg] = useStorageState(CHECKIN_CFG_KEY, { cadence: "daily" });
  const weekFocus = focusThisWeek(focusRaw);
  const focusOn = getCadence(checkinCfg) !== "off" && weekFocus && !isDismissed(weekFocus);
  const answeredToday = getCheckin(checkins, ds);

  const existing = getReview(reviews, ds);
  const [rating, setRating] = useState(existing?.rating || 0);
  const [win, setWin] = useState(existing?.win || "");
  const [lesson, setLesson] = useState(existing?.lesson || "");
  const [tomorrow, setTomorrow] = useState(() => {
    const t = existing?.tomorrow || [];
    return [t[0] || "", t[1] || "", t[2] || ""];
  });

  const focus = useMemo(() => todayFocus(reviews), [reviews]);
  const streak = useMemo(() => shutdownStreak(reviews), [reviews]);

  // Honest day summary from the real stores.
  const summary = useMemo(() => {
    const sched = (Array.isArray(habits) ? habits : []).filter((h) => h && !h.archived && !h.paused && isScheduled(h, ds));
    const hDone = sched.filter((h) => isDone(h, ds)).length;
    const nutrition = sanitizeNutrition(log);
    const kcal = Math.round(dayTotals(dayEntries(nutrition, ds)).kcal || 0);
    const workedOut = (Array.isArray(workouts) ? workouts : []).some((w) => w && w.date === ds);
    const journaled = (Array.isArray(entries) ? entries : []).some((e) => e && (e.date || "").slice(0, 10) === ds);
    const nTrades = (Array.isArray(trades) ? trades : []).filter((t) => t && (t.date || "").slice(0, 10) === ds).length;
    return [
      sched.length > 0 && { k: "Habits", v: `${hDone}/${sched.length}`, ok: hDone >= sched.length },
      { k: "Nutrition", v: kcal > 0 ? `${kcal.toLocaleString()} kcal` : "—", ok: kcal > 0 },
      { k: "Workout", v: workedOut ? "Done" : "—", ok: workedOut },
      { k: "Journal", v: journaled ? "Written" : "—", ok: journaled },
      nTrades > 0 && { k: "Trades", v: String(nTrades), ok: true },
    ].filter(Boolean);
  }, [habits, log, workouts, entries, trades, ds]);

  const save = () => {
    const entry = { rating, win: win.trim(), lesson: lesson.trim(), tomorrow: tomorrow.map((s) => s.trim()).filter(Boolean), at: new Date().toISOString() };
    setReviews((prev) => ({ ...(prev && typeof prev === "object" && !Array.isArray(prev) ? prev : {}), [ds]: entry }));
    onClose();
  };

  const input = { width: "100%", background: B2, border: `1px solid ${BD}`, borderRadius: 9, padding: "9px 12px", fontSize: 13, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  const label = { fontSize: 10.5, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 700, color: T3, margin: "0 0 7px" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 4200, background: "rgba(0,0,0,0.66)", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "6vh 16px 24px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 480, background: B1, border: `1px solid ${BD2}`, borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", borderBottom: `1px solid ${BD}` }}>
          <Moon size={18} color={AC2} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T1 }}>Evening Shutdown</div>
            <div style={{ fontSize: 11, color: T3 }}>{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}{streak > 0 ? ` · ${streak}-day streak` : ""}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><X size={17} /></button>
        </div>

        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
          {focus.length > 0 && (
            <div style={{ background: `${AC2}0E`, border: `1px solid ${AC2}33`, borderRadius: 11, padding: "11px 13px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, ...label, color: AC2, marginBottom: 6 }}><Sunrise size={12} /> Today's focus — set last night</div>
              {focus.map((f, i) => <div key={i} style={{ fontSize: 12.5, color: T2, padding: "2px 0" }}>• {f}</div>)}
            </div>
          )}

          {focusOn && (
            <div style={{ background: B2, border: `1px solid ${BD}`, borderRadius: 11, padding: "11px 13px" }}>
              <div style={{ ...label, marginBottom: 5 }}>This week's focus</div>
              <div style={{ fontSize: 13, color: T1, marginBottom: 9 }}>{weekFocus}</div>
              <div style={{ fontSize: 11.5, color: T3, marginBottom: 7 }}>Did today serve it?</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {ANSWERS.map((a) => {
                  const on = answeredToday === a.id;
                  return (
                    <button key={a.id} onClick={() => setCheckins((prev) => setCheckin(prev, ds, on ? null : a.id))}
                      aria-pressed={on} aria-label={`${a.l} — did today serve this week's focus`}
                      style={{ padding: "5px 13px", borderRadius: 10, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit",
                        border: `1px solid ${on ? AC2 + "66" : BD}`, background: on ? `${AC2}18` : "none", color: on ? AC2 : T3 }}>
                      {a.l}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <div style={label}>How the day actually went</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(80px,1fr))", gap: 7 }}>
              {summary.map((s) => (
                <div key={s.k} style={{ background: B2, border: `1px solid ${BD}`, borderRadius: 9, padding: "8px 10px" }}>
                  <div style={{ fontSize: 9.5, color: T3, textTransform: "uppercase", letterSpacing: 0.6 }}>{s.k}</div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: s.ok ? GR : T2, marginTop: 2 }}>{s.v}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div style={label}>Rate the day</div>
            <div style={{ display: "flex", gap: 7 }}>
              {RATINGS.map((r) => (
                <button key={r.n} onClick={() => setRating(r.n)}
                  style={{ flex: 1, padding: "8px 4px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", fontSize: 10.5, fontWeight: 700,
                    background: rating === r.n ? `${r.c}22` : GL, border: `1px solid ${rating === r.n ? r.c : BD}`, color: rating === r.n ? r.c : T3 }}>
                  {r.n}<div style={{ fontSize: 8.5, fontWeight: 600, marginTop: 1 }}>{r.l}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={label}>A win from today</div>
            <input value={win} onChange={(e) => setWin(e.target.value)} placeholder="One thing that went right…" style={input} />
          </div>
          <div>
            <div style={label}>A lesson</div>
            <input value={lesson} onChange={(e) => setLesson(e.target.value)} placeholder="One thing to do better…" style={input} />
          </div>

          <div>
            <div style={label}>Tomorrow's top 3</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 18, height: 18, borderRadius: 5, background: B2, border: `1px solid ${BD}`, fontSize: 10, fontWeight: 700, color: T3, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                  <input value={tomorrow[i]} onChange={(e) => setTomorrow((t) => t.map((v, j) => (j === i ? e.target.value : v)))}
                    placeholder={i === 0 ? "The one that matters most…" : "…"} style={input} />
                </div>
              ))}
            </div>
          </div>

          <button onClick={save}
            style={{ padding: "12px", borderRadius: 11, border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: 13.5, fontWeight: 700,
              background: `linear-gradient(135deg,${AC2},${AM})`, color: "#000", display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
            <Check size={16} /> Close the day
          </button>
        </div>
      </div>
    </div>
  );
}
