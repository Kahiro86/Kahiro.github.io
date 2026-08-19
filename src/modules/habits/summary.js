// ── Habit summary for cross-feature surfaces (dashboard, agenda) ─────
// A synchronous read of the new tracker's stores that produces the small
// facts other modules used to get from the old habit array: each habit's
// current streak, and today's scheduled/done counts. Every number comes
// through the tracker's OWN logic — computeCurrentStreak, isScheduled,
// isCompleted — so a streak shown on the dashboard is the exact streak the
// habit's detail screen shows. Pure; safe to call every render.
import { toEntryMap, computeCurrentStreak } from "./logic/core";
import { isScheduled } from "./logic/schedule";
import { isCompleted } from "./logic/completion";
import { effectiveStart } from "./logic/period";

const arr = (x) => (Array.isArray(x) ? x.filter(Boolean) : []);

export function habitSummary(htHabits, htEntries, today) {
  const habits = arr(htHabits).filter((h) => h && h.id && !h.archivedAt);
  const byHabit = new Map();
  for (const e of arr(htEntries)) {
    if (!e || !e.habitId) continue;
    let l = byHabit.get(e.habitId);
    if (!l) byHabit.set(e.habitId, (l = []));
    l.push(e);
  }

  const streaks = [];
  let todayScheduled = 0, todayDone = 0;
  const rows = habits.map((h) => {
    const list = byHabit.get(h.id) || [];
    const map = toEntryMap(list);
    let first = null;
    for (const e of list) if (first == null || e.date < first) first = e.date;
    const start = effectiveStart(h, first);
    streaks.push({ id: h.id, icon: h.icon || "✅", label: h.name, days: computeCurrentStreak(h, start, map, today) });
    if (isScheduled(h, today)) { todayScheduled++; if (isCompleted(h, map.get(today))) todayDone++; }
    return { h, map };
  });
  streaks.sort((a, b) => b.days - a.days || a.label.localeCompare(b.label));

  // done/scheduled for any date, or null when nothing is scheduled that day —
  // the shape the dashboard's Life Score expects.
  const ratioOn = (d) => {
    let sched = 0, done = 0;
    for (const { h, map } of rows) {
      if (!isScheduled(h, d)) continue;
      sched++;
      if (isCompleted(h, map.get(d))) done++;
    }
    return sched ? done / sched : null;
  };

  return { activeCount: habits.length, streaks, todayScheduled, todayDone, ratioOn };
}
