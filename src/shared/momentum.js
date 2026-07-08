// ── Momentum Engine (Kaizen phase 13) ───────────────────────────────
// A 0–100 read on the last 30 days where recent days matter most:
// geometric decay with a ~10-day half-life. Missing one day dents the
// number slightly; it never resets. Sustainable consistency > streaks.
import { isScheduled, isDone } from "./habitEngine.js";
import { daysAgoStr } from "./dates.js";

function windowMomentum(habits, offsetDays, daysBack = 30, halfLife = 10) {
  let num = 0, den = 0;
  for (let i = 0; i < daysBack; i++) {
    const ds = daysAgoStr(i + offsetDays);
    let sched = 0, done = 0;
    for (const h of habits) {
      if (!isScheduled(h, ds)) continue;
      sched++;
      if (isDone(h, ds)) done++;
    }
    if (!sched) continue; // rest days neither help nor hurt
    const w = Math.pow(0.5, i / halfLife);
    num += w * (done / sched);
    den += w;
  }
  return den ? Math.round((num / den) * 100) : 0;
}

export function momentum(habitsRaw) {
  const habits = (habitsRaw || []).filter((h) => h && !h.archived && !h.paused);
  const now = windowMomentum(habits, 0);
  const weekAgo = windowMomentum(habits, 7);
  return { value: now, delta: now - weekAgo }; // delta > 0 = building
}
