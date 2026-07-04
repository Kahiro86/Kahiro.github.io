// Real habit engine. Each habit keeps a history of completed dates; "done
// today" and streaks are DERIVED from history, so checkmarks reset naturally
// at local midnight and streaks are earned, never hardcoded.
import { localDateStr, daysAgoStr } from "./dates.js";

// Streak of consecutive completed days ending today — or, if today isn't done
// yet, ending yesterday (an unfinished today never breaks a streak).
export function habitStreak(history) {
  const set = new Set(history || []);
  let start = 0;
  if (!set.has(localDateStr())) start = 1; // grace: today still in progress
  let streak = 0;
  for (let i = start; i < 3650; i++) {
    if (set.has(daysAgoStr(i))) streak++;
    else break;
  }
  return streak;
}

// Materialize derived fields (done, streak) from history. Also migrates the
// legacy shape ({done, streak} with no history): a legacy "done" seeds today,
// and legacy streak numbers are dropped — they were demo values, not earned.
export function materializeHabits(habits) {
  const today = localDateStr();
  return (habits || []).map((h) => {
    const history = Array.isArray(h.history) ? h.history : h.done ? [today] : [];
    return { name: h.name, icon: h.icon, history, done: history.includes(today), streak: habitStreak(history) };
  });
}

// Toggle today's completion for one habit; returns the storable array.
export function toggleHabitToday(habits, name) {
  const today = localDateStr();
  return materializeHabits(habits).map((h) => {
    if (h.name !== name) return h;
    const history = h.done ? h.history.filter((d) => d !== today) : [...h.history, today];
    return { ...h, history, done: !h.done, streak: habitStreak(history) };
  });
}
