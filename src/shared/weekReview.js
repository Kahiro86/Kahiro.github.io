// ── Week in Review — the retention bookend ───────────────────────────
// The reflective counterpart to the daily directive: once a week (Sundays,
// or on demand) it answers "did I win?" in one screen — the week's score
// against last week's, which habits held and which slipped, a few real
// wins, and the weakest area to aim next week's single focus at. Pure:
// every number derives from the same stores the cockpit already reads.
import { localDateStr } from "./dates.js";
import { isScheduled, isDone, currentStreak } from "./habitEngine.js";
import { isRestDay } from "./directive.js";
import { sanitizeNutrition, dayEntries } from "../modules/athlete/nutrition.js";
import { weakestArea } from "./review.js";

const addDaysStr = (ds, n) => { const d = new Date(`${ds}T12:00:00`); d.setDate(d.getDate() + n); return localDateStr(d); };
const monthDay = (ds) => new Date(`${ds}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });

// deps: { habits, workouts, nutrition, entries, purity, ds? }
export function buildWeekReview(deps = {}) {
  const ds = deps.ds || localDateStr();
  const arr = (x) => (Array.isArray(x) ? x : []);
  const active = arr(deps.habits).filter((h) => h && !h.archived && !h.paused);
  const workouts = arr(deps.workouts).filter((w) => w && w.date);
  const nutrition = sanitizeNutrition(deps.nutrition);
  const entries = arr(deps.entries).filter((e) => e && e.id);
  const purity = deps.purity && typeof deps.purity === "object" && !Array.isArray(deps.purity) ? deps.purity : {};

  const workoutOn = (d) => workouts.some((w) => w.date === d);
  const mealsOn = (d) => dayEntries(nutrition, d).length > 0;
  const journaledOn = (d) => entries.some((e) => (e.date || "").slice(0, 10) === d);

  // Composite daily score — same four parts the cockpit's Life Score uses.
  const dayScore = (d) => {
    const parts = [];
    const sched = active.filter((h) => isScheduled(h, d));
    if (sched.length) parts.push(sched.filter((h) => isDone(h, d)).length / sched.length);
    parts.push(workoutOn(d) || isRestDay(d) ? 1 : 0);
    parts.push(mealsOn(d) ? 1 : 0);
    parts.push(journaledOn(d) ? 1 : 0);
    return parts.length ? (parts.reduce((s, x) => s + x, 0) / parts.length) * 100 : 0;
  };

  // This week (Mon→today) and last week (full Mon→Sun).
  const monOffset = (new Date(`${ds}T12:00:00`).getDay() + 6) % 7;
  const monday = addDaysStr(ds, -monOffset);
  const thisWeek = [];
  for (let i = 0; i <= monOffset; i++) thisWeek.push(addDaysStr(monday, i));
  const prevWeek = [];
  for (let i = 0; i < 7; i++) prevWeek.push(addDaysStr(monday, -7 + i));

  const avg = (days) => (days.length ? Math.round(days.reduce((s, d) => s + dayScore(d), 0) / days.length) : 0);
  const score = avg(thisWeek);
  const prevScore = avg(prevWeek);
  const delta = score - prevScore;

  // Per-habit hold vs slip across the elapsed week.
  const inWeek = new Set(thisWeek);
  const habitRows = active.map((h) => {
    let sched = 0, done = 0;
    for (const d of thisWeek) { if (isScheduled(h, d)) { sched++; if (isDone(h, d)) done++; } }
    return { name: h.name, icon: h.icon || "✅", sched, done, pct: sched ? Math.round((done / sched) * 100) : null };
  }).filter((r) => r.sched > 0);
  const kept = habitRows.filter((r) => r.pct === 100).sort((a, b) => b.sched - a.sched);
  const slipped = habitRows.filter((r) => r.pct !== null && r.pct < 50).sort((a, b) => a.pct - b.pct);

  // A few honest wins — only what actually happened.
  const wo = thisWeek.filter(workoutOn).length;
  const jn = thisWeek.filter(journaledOn).length;
  const ml = thisWeek.filter(mealsOn).length;
  const pure = Object.keys(purity).length ? thisWeek.filter((d) => purity[d]?.s === "pure").length : 0;
  const topStreak = active.map((h) => ({ name: h.name, icon: h.icon || "✅", d: currentStreak(h) }))
    .sort((a, b) => b.d - a.d)[0];
  const wins = [];
  if (wo > 0) wins.push({ icon: "🏋️", text: `${wo} workout${wo > 1 ? "s" : ""} logged` });
  if (kept.length) wins.push({ icon: "✅", text: `${kept.length} habit${kept.length > 1 ? "s" : ""} kept every day` });
  if (topStreak && topStreak.d >= 3) wins.push({ icon: "🔥", text: `${topStreak.name} streak at ${topStreak.d} days` });
  if (jn > 0) wins.push({ icon: "📓", text: `Journaled ${jn} day${jn > 1 ? "s" : ""}` });
  if (Object.keys(purity).length && pure > 0) wins.push({ icon: "🌿", text: `${pure}/${thisWeek.length} clean days` });
  if (ml >= 4) wins.push({ icon: "🍽️", text: `Nutrition logged ${ml} days` });

  return {
    rangeLabel: `${monthDay(monday)} – ${monthDay(addDaysStr(monday, 6))}`,
    daysCounted: thisWeek.length,
    complete: monOffset === 6, // the week is over (Sunday)
    score, prevScore, delta,
    kept, slipped, keptTotal: habitRows.length,
    wins: wins.slice(0, 5),
    weakest: weakestArea(active), // { cat, pct } | null — seeds next week's focus
  };
}

// A ready-made focus suggestion from the weakest area (or a gentle default).
export const suggestFocus = (weakest) =>
  weakest ? `Show up for ${weakest.cat}` : "Win the morning, every day";
