// ── Body · one timeline (spec §2.1 B) ────────────────────────────────
// Weight, waist, strength, calorie adherence and protein adherence, bucketed
// into the same weeks so correlation is visible instead of inferred. Pure and
// derive-only — every series is recomputed from the stores it reads.
import { localDateStr } from "../../shared/dates.js";
import { dayEntries, dayTotals } from "../athlete/nutrition.js";
import { dayTargets } from "../athlete/bodyTargets.js";
import { sessionToLoggedSets } from "./gymSessions.js";

const ds10 = (v) => String(v || "").slice(0, 10);
const back = (today, n) => { const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() - n); return localDateStr(d); };
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);

// Tonnage: the only strength proxy that survives mixed exercises. Bodyweight
// and timed work contribute nothing here rather than a fabricated number.
function sessionTonnage(session) {
  let kg = 0;
  for (const set of sessionToLoggedSets(session)) {
    const w = Number(set.weightKg ?? set.weight);
    const reps = Number(set.reps);
    if (Number.isFinite(w) && w > 0 && Number.isFinite(reps) && reps > 0) kg += w * reps;
  }
  return Math.round(kg);
}

/**
 * `weeks` buckets ending with the week containing `today`, oldest first.
 * A bucket with no data for a series carries null for it — never zero, so a
 * gap reads as a gap on the chart instead of a crash to the floor.
 */
export function bodyTimeline({ log, profile, sessions, measurements, today = localDateStr(), weeks = 12 } = {}) {
  const meas = (Array.isArray(measurements) ? measurements : []).filter((m) => m && m.date);
  const sess = (Array.isArray(sessions) ? sessions.filter(Boolean) : []);
  const out = [];

  for (let w = weeks - 1; w >= 0; w--) {
    const end = back(today, w * 7);
    const start = back(today, w * 7 + 6);
    const days = [];
    for (let i = 0; i < 7; i++) days.push(back(today, w * 7 + i));

    const kcalRatio = [], pRatio = [];
    let loggedDays = 0;
    for (const ds of days) {
      const entries = dayEntries(log || {}, ds);
      if (!entries.length) continue;
      loggedDays++;
      const t = dayTotals(entries);
      const target = dayTargets({ profile, sessions: sess, ds, today }).targets;
      if (target.kcal > 0) kcalRatio.push(Math.round(((t.kcal || 0) / target.kcal) * 100));
      if (target.p > 0) pRatio.push(Math.round(((t.p || 0) / target.p) * 100));
    }

    const inWeek = sess.filter((s) => ds10(s.date) >= start && ds10(s.date) <= end);
    const tonnage = inWeek.map(sessionTonnage).filter((x) => x > 0);
    const mw = meas.filter((m) => ds10(m.date) >= start && ds10(m.date) <= end);
    const weight = avg(mw.map((m) => +m.weightKg).filter(Number.isFinite));
    const waist = avg(mw.map((m) => +m.waistCm).filter(Number.isFinite));

    out.push({
      start, end,
      label: end.slice(5).replace("-", "/"),
      loggedDays,
      sessions: inWeek.length,
      kcalAdherence: kcalRatio.length ? Math.round(avg(kcalRatio)) : null,
      proteinAdherence: pRatio.length ? Math.round(avg(pRatio)) : null,
      tonnage: tonnage.length ? Math.round(avg(tonnage)) : null,
      weightKg: weight == null ? null : Math.round(weight * 10) / 10,
      waistCm: waist == null ? null : Math.round(waist * 10) / 10,
    });
  }
  return out;
}

/** Which series actually have enough points to plot. Honesty over decoration. */
export function plottable(timeline) {
  const count = (k) => timeline.filter((b) => b[k] != null).length;
  return {
    weightKg: count("weightKg") >= 2,
    waistCm: count("waistCm") >= 2,
    tonnage: count("tonnage") >= 2,
    kcalAdherence: count("kcalAdherence") >= 2,
    proteinAdherence: count("proteinAdherence") >= 2,
  };
}
