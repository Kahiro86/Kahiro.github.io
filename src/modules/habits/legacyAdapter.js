// ── New tracker → legacy habit shape, for the shared analytical views ─
// Analytics, the Calendar month grid, Correlations and the daily/weekly
// Reviews all read habits in the old v2 shape (a `.log` of {date:{v}} plus
// weekday scheduling) through habitEngine's isScheduled/isDone. Rather than
// rewrite each of them, this maps the new tracker's ht_* records into that
// shape so a habit logged in the new tracker shows up everywhere the old one
// did — the same adapter pattern the gym facet uses to feed the XP pipeline.
//
// Kept OUT of FaithCore's world: every produced habit is category
// "Personal Growth", never "Spiritual", so the spiritual-habits screen (which
// still owns the old key) never picks these up.
import { newHabit } from "../../shared/habitEngine.js";

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const arr = (x) => (Array.isArray(x) ? x.filter(Boolean) : []);

export function htToLegacyHabits(htHabits, htEntries) {
  const habits = arr(htHabits).filter((h) => h && h.id
    // at_most numeric habits ("no more than N") can't express "done" as
    // value ≥ target, so they're left out rather than counted wrongly.
    && !(h.type === "numeric" && h.targetDirection === "at_most"));
  if (!habits.length) return [];

  const logs = new Map();      // habitId → { date: { v } }
  const firstDate = new Map(); // habitId → earliest entry date
  for (const e of arr(htEntries)) {
    if (!e.habitId || !e.date) continue;
    let log = logs.get(e.habitId);
    if (!log) logs.set(e.habitId, (log = {}));
    log[e.date] = { v: Number(e.value) || 0 };
    const cur = firstDate.get(e.habitId);
    if (cur == null || e.date < cur) firstDate.set(e.habitId, e.date);
  }

  return habits.map((h) => {
    const quota = h.frequencyType === "times_per_week" || h.frequencyType === "times_per_month";
    const days = h.frequencyType === "specific_days" && Array.isArray(h.frequencyDays) && h.frequencyDays.length
      ? [...h.frequencyDays].sort((a, b) => a - b)
      : ALL_DAYS;
    const target = h.type === "numeric" && h.target != null ? Number(h.target) : 1;
    // Effective start: the earlier of the habit's creation date and its first
    // logged day (a backfilled entry can predate creation), so historical
    // days are scheduled and counted — never dropped to "today".
    const created = typeof h.createdAt === "string" ? h.createdAt.slice(0, 10) : null;
    const first = firstDate.get(h.id) || null;
    const createdAt = created && first ? (first < created ? first : created) : (created || first || undefined);

    return newHabit({
      id: `ht_${h.id}`,
      name: h.name || "Habit",
      icon: h.icon || "✅",
      category: "Personal Growth",
      freq: quota ? "weekly" : "daily",
      days,
      weeklyTarget: quota ? (Number(h.frequencyCount) || 3) : 3,
      target,
      unit: h.unit || "",
      archived: h.archivedAt != null,
      ...(createdAt ? { createdAt } : {}),
      log: logs.get(h.id) || {},
    });
  });
}
