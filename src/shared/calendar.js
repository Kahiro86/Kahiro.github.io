// ── Calendar engine — one month, every module on each day ────────────
// A read-only aggregator: given the app's synced stores, it reports what
// happened (or is due) on each date, so the Calendar module can render a
// month grid and a per-day breakdown without any module-specific plumbing.
// Everything derives from the same records the modules already write —
// nothing new is stored.
import { localDateStr } from "./dates.js";
import { activitiesOn, isDone as activityDone } from "./activity.js";
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
  { key: "faith",   label: "Faith",        color: "#7FD1B9", icon: "🙏" },
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
  // Habits, workouts, meals, journal, purity and faith all come from the
  // activity feed — the same records the Record and the recommendation layer
  // read. This used to walk the RETIRED legacy habits store, so a habit
  // logged in the tracker never appeared on the calendar at all.
  const acts = activitiesOn(S.feed, ds);
  const habits = acts.filter((a) => a.type === "habit");
  const done = habits.filter(activityDone).length;
  const partial = habits.filter((a) => a.status === "partial").length;
  const kcalRow = acts.find((a) => a.type === "calories");
  const purityRow = acts.find((a) => a.type === "purity");
  const billsDue = S.bills.filter((b) => daysUntilDue(b, ds) === 0 && !isPaidThisCycle(b, ds)).length;

  return {
    // `habitsTotal` is now what was LOGGED that day, not what was scheduled.
    // A calendar reports what happened; what was merely due belongs to the
    // habit screen, which can still say it.
    habitsDone: done,
    habitsTotal: habits.length,
    habitsPartial: partial,
    workout: acts.filter((a) => a.type === "workout").length,
    meal: kcalRow ? kcalRow.actual : 0,
    faith: acts.filter((a) => a.category === "faith").length,
    trade: S.trades.filter((t) => t && t.date === ds).length,
    journal: acts.filter((a) => a.type === "journal").length,
    measure: S.measurements.filter((m) => m && m.date === ds).length,
    purity: purityRow ? (activityDone(purityRow) ? "clean" : "relapse") : null,
    bill: billsDue,
    acts,
  };
}

// Which domain dots to show for a cell — a domain "fires" when it has any
// activity that day (habits only once fully done, so partial days read as
// in-progress via the count, not a green tick).
export function activeDots(dom) {
  const on = [];
  // A day with any habit activity fires the dot, including a partial one:
  // five minutes of a fifteen-minute stretch is something that happened, and
  // an empty cell would say it did not.
  if (dom.habitsTotal > 0) on.push("habits");
  if (dom.workout > 0) on.push("workout");
  if (dom.meal > 0) on.push("meal");
  if (dom.trade > 0) on.push("trade");
  if (dom.journal > 0) on.push("journal");
  if (dom.measure > 0) on.push("measure");
  if (dom.faith > 0) on.push("faith");
  if (dom.purity === "clean") on.push("purity");
  if (dom.bill > 0) on.push("bill");
  return on;
}

// Human-readable lines for the day drawer: [{ key, icon, label, detail, nav }]
export function dayLines(ds, S) {
  const d = dayDomains(ds, S);
  const lines = [];
  if (d.habitsTotal > 0) {
    lines.push({
      key: "habits", icon: "✅", label: "Habits", nav: "habits",
      detail: `${d.habitsDone}/${d.habitsTotal} done${d.habitsPartial ? ` · ${d.habitsPartial} partial` : ""}`,
    });
    // Every partially-done habit gets its own line with the real numbers.
    // "1/3 done" hides which one was half-finished, and half-finished is the
    // state the whole brief is about.
    for (const a of d.acts.filter((x) => x.type === "habit" && x.status === "partial")) {
      lines.push({
        key: `habit:${a.id}`, icon: "◐", label: a.label, nav: "habits",
        detail: `${a.actual}${a.unit ? ` ${a.unit}` : ""} of ${a.target}${a.unit ? ` ${a.unit}` : ""} · ${a.pct}%`,
      });
    }
  }
  if (d.workout > 0) lines.push({ key: "workout", icon: "🏋️", label: "Workout", detail: `${d.workout} session${d.workout > 1 ? "s" : ""}`, nav: "gym:today" });
  if (d.meal > 0) lines.push({ key: "meal", icon: "🍽️", label: "Fuel", detail: `${d.meal.toLocaleString()} kcal logged`, nav: "nutrition:today" });
  if (d.trade > 0) lines.push({ key: "trade", icon: "📈", label: "Trades", detail: `${d.trade} journaled`, nav: "firm" });
  if (d.journal > 0) lines.push({ key: "journal", icon: "📝", label: "Journal", detail: `${d.journal} entr${d.journal > 1 ? "ies" : "y"}`, nav: "habits" });
  if (d.measure > 0) lines.push({ key: "measure", icon: "📏", label: "Measurements", detail: "logged", nav: "gym:trends" });
  if (d.faith > 0) {
    for (const a of d.acts.filter((x) => x.category === "faith")) {
      lines.push({ key: `faith:${a.id}`, icon: "🙏", label: a.label, detail: a.unit ? `${a.actual} ${a.unit}` : "logged", nav: "faith" });
    }
  }
  if (d.purity) lines.push({ key: "purity", icon: d.purity === "clean" ? "🌿" : "⚠️", label: "Purity", detail: d.purity === "clean" ? "clean day" : d.purity, nav: "habits" });
  if (d.bill > 0) lines.push({ key: "bill", icon: "💸", label: "Bill due", detail: `${d.bill} due`, nav: "firm" });
  return lines;
}
