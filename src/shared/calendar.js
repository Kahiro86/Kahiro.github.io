// ── Calendar engine — one month, every module on each day ────────────
// A read-only aggregator: given the app's synced stores, it reports what
// happened (or is due) on each date, so the Calendar module can render a
// month grid and a per-day breakdown without any module-specific plumbing.
// Everything derives from the same records the modules already write —
// nothing new is stored.
import { localDateStr } from "./dates.js";
import { isScheduled, isDone } from "./habitEngine.js";
import { dayEntries, dayTotals } from "../modules/athlete/nutrition.js";
import { daysUntilDue, isPaidThisCycle } from "../modules/finance/bills.js";

// The domains a day can carry, each with a stable colour + label for dots
// and the legend. Order here is the order dots render in.
export const CAL_DOMAINS = [
  { key: "habits",  label: "Habits",       color: "#3FB950", icon: "✅" },
  { key: "workout", label: "Workout",      color: "#E3B341", icon: "🏋️" },
  { key: "meal",    label: "Nutrition",    color: "#2DD4BF", icon: "🍽️" },
  { key: "trade",   label: "Trades",       color: "#78C8FF", icon: "📈" },
  { key: "journal", label: "Journal",      color: "#B98AFF", icon: "📝" },
  { key: "measure", label: "Measurements", color: "#F472B6", icon: "📏" },
  { key: "purity",  label: "Purity",       color: "#9C9C9C", icon: "🌿" },
  { key: "bill",    label: "Bill due",     color: "#F85149", icon: "💸" },
];

// A 6-row × 7-col grid of dates for `month` (0-based), padded with the
// trailing/leading days of the neighbouring months (Sunday-first).
export function calendarGrid(year, month) {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  const weeks = [];
  for (let w = 0; w < 6; w++) {
    const row = [];
    for (let d = 0; d < 7; d++) {
      const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d);
      row.push({ ds: localDateStr(cur), day: cur.getDate(), inMonth: cur.getMonth() === month });
    }
    weeks.push(row);
  }
  return weeks;
}

// What each domain reports for a single date. `S` is the bundle of already-
// sanitized stores (see CalendarModule). Values are counts (or a status for
// purity), plus habitsTotal for the "x/y" habit summary.
export function dayDomains(ds, S) {
  const sched = S.habits.filter((h) => h && !h.archived && !h.paused && isScheduled(h, ds));
  const habitsDone = sched.filter((h) => isDone(h, ds)).length;
  const kcal = Math.round(dayTotals(dayEntries(S.nutrition, ds)).kcal || 0);
  const billsDue = S.bills.filter((b) => daysUntilDue(b, ds) === 0 && !isPaidThisCycle(b, ds)).length;
  return {
    habitsDone, habitsTotal: sched.length,
    workout: S.workouts.filter((w) => w && w.date === ds).length,
    meal: kcal,
    trade: S.trades.filter((t) => t && t.date === ds).length,
    journal: S.entries.filter((e) => e && (e.date || "").slice(0, 10) === ds).length,
    measure: S.measurements.filter((m) => m && m.date === ds).length,
    purity: S.purity[ds]?.s || null,
    bill: billsDue,
  };
}

// Which domain dots to show for a cell — a domain "fires" when it has any
// activity that day (habits only once fully done, so partial days read as
// in-progress via the count, not a green tick).
export function activeDots(dom) {
  const on = [];
  if (dom.habitsTotal > 0 && dom.habitsDone >= dom.habitsTotal) on.push("habits");
  if (dom.workout > 0) on.push("workout");
  if (dom.meal > 0) on.push("meal");
  if (dom.trade > 0) on.push("trade");
  if (dom.journal > 0) on.push("journal");
  if (dom.measure > 0) on.push("measure");
  if (dom.purity === "clean") on.push("purity");
  if (dom.bill > 0) on.push("bill");
  return on;
}

// Human-readable lines for the day drawer: [{ key, icon, label, detail, nav }]
export function dayLines(ds, S) {
  const d = dayDomains(ds, S);
  const lines = [];
  if (d.habitsTotal > 0) lines.push({ key: "habits", icon: "✅", label: "Habits", detail: `${d.habitsDone}/${d.habitsTotal} done`, nav: "habits" });
  if (d.workout > 0) lines.push({ key: "workout", icon: "🏋️", label: "Workout", detail: `${d.workout} session${d.workout > 1 ? "s" : ""}`, nav: "gym:today" });
  if (d.meal > 0) lines.push({ key: "meal", icon: "🍽️", label: "Fuel", detail: `${d.meal.toLocaleString()} kcal logged`, nav: "gym:today" });
  if (d.trade > 0) lines.push({ key: "trade", icon: "📈", label: "Trades", detail: `${d.trade} journaled`, nav: "firm" });
  if (d.journal > 0) lines.push({ key: "journal", icon: "📝", label: "Journal", detail: `${d.journal} entr${d.journal > 1 ? "ies" : "y"}`, nav: "habits" });
  if (d.measure > 0) lines.push({ key: "measure", icon: "📏", label: "Measurements", detail: "logged", nav: "gym:trends" });
  if (d.purity) lines.push({ key: "purity", icon: d.purity === "clean" ? "🌿" : "⚠️", label: "Purity", detail: d.purity === "clean" ? "clean day" : d.purity, nav: "habits" });
  if (d.bill > 0) lines.push({ key: "bill", icon: "💸", label: "Bill due", detail: `${d.bill} due`, nav: "firm" });
  return lines;
}
