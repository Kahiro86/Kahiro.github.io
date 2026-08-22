// ── Body · training-day ↔ fuel target linkage (spec §2.2) ────────────
// The whole reason Gym and Nutrition became one domain: the day's training
// decision moves the day's fuel targets. This module owns that rule, and
// nothing else in the app is allowed to invent a second one.
//
// THE RULE, written down (rendered verbatim in the UI so it is never a
// hidden number):
//
//   base            = the configured daily target (TDEE × goal adjustment)
//   allowance       = what today's session actually cost, estimated from its
//                     duration and the lifter's bodyweight
//   training day    = base + allowance
//   rest day        = base − allowance × t / (7 − t)
//                     where t = training days per week, measured from the
//                     last 4 weeks of logged sessions (1–6)
//
// The rest-day subtraction is what keeps the week honest. `base` already has
// the user's activity multiplier baked in, so simply adding an allowance on
// training days would quietly raise the weekly total every time they train —
// intake inflation dressed up as a feature. Redistributing instead keeps the
// weekly total identical to `base × 7` and only moves calories to the days
// that earned them.
//
// Protein never moves (spec §2.2). Fat never moves. Carbs absorb the entire
// calorie delta, because carbohydrate is the fuel the training actually
// spent. A rest day is floored at BMR-ish so the rule can never push intake
// into genuinely under-eating territory.
import { localDateStr } from "../../shared/dates.js";
import { calcTargets, sanitizeProfile } from "./nutrition.js";

export const TRAINING_RULE = [
  "Training day = base + session allowance",
  "Rest day = base − allowance × t/(7−t), t = your training days per week",
  "Protein and fat never move. Carbs carry the whole difference.",
];

// Resistance training runs ≈7 kcal/min at 75 kg; scaled by bodyweight.
const KCAL_PER_MIN_AT_75 = 7;
const MIN_ALLOWANCE = 150;
const MAX_ALLOWANCE = 600;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const round25 = (v) => Math.round(v / 25) * 25;
const ds10 = (v) => String(v || "").slice(0, 10);

/**
 * What a logged session cost, in kcal. Duration is the honest input we
 * actually have; set counts vary too much by exercise to estimate from.
 * A session with no usable timestamps falls back to 45 minutes.
 */
export function sessionKcalAllowance(session, fallbackBodyweightKg = 75) {
  if (!session) return 0;
  const bw = Number(session.bodyweightKg) > 0 ? Number(session.bodyweightKg)
    : (Number(fallbackBodyweightKg) > 0 ? Number(fallbackBodyweightKg) : 75);
  const start = Number(session.startedAt), end = Number(session.finishedAt);
  const mins = Number.isFinite(start) && Number.isFinite(end) && end > start
    ? clamp((end - start) / 60000, 20, 120)
    : 45;
  return round25(clamp(mins * KCAL_PER_MIN_AT_75 * (bw / 75), MIN_ALLOWANCE, MAX_ALLOWANCE));
}

/**
 * Training days per week, measured — not declared. Counts distinct days with
 * a session over the last `weeks` weeks. Clamped to 1–6: at 0 there is
 * nothing to redistribute, and at 7 the rest-day formula divides by zero.
 */
export function trainingDaysPerWeek(sessions, today = localDateStr(), weeks = 4) {
  const list = Array.isArray(sessions) ? sessions.filter(Boolean) : [];
  // An inclusive window of exactly `weeks * 7` days ending yesterday-or-today,
  // so 16 sessions across 4 weeks reads as 4.0/wk and not 3.8.
  const cut = new Date(`${today}T12:00:00`);
  cut.setDate(cut.getDate() - (weeks * 7 - 1));
  const cutDs = localDateStr(cut);
  const days = new Set(list.map((s) => ds10(s.date)).filter((d) => d && d >= cutDs && d <= today));
  if (!days.size) return 0;
  return clamp(Math.round((days.size / weeks) * 10) / 10, 1, 6);
}

/** Did a session land on this date? */
export function sessionsOn(sessions, ds) {
  return (Array.isArray(sessions) ? sessions.filter(Boolean) : []).filter((s) => ds10(s.date) === ds);
}

// Rebuilds a macro split around a calorie delta, moving carbs only. The
// calorie figure is derived FROM the rounded carb number rather than rounded
// separately, so "carbs carry the whole difference" is exactly true on screen
// and the ring never disagrees with the bars by a stray gram.
function shiftCarbs(base, deltaKcal) {
  const c = Math.max(0, Math.round(base.c + deltaKcal / 4));
  return { ...base, c, kcal: Math.max(0, base.kcal + (c - base.c) * 4) };
}

/**
 * The day's fuel targets, resolved against the day's training.
 *
 * `resolved` is how the day is being scored:
 *   "training"    — a session is logged for this date
 *   "rest"        — the date is past and no session was logged; final
 *   "provisional" — the date is today and nothing is logged yet, so it is
 *                   being SCORED as a rest day but can still become a
 *                   training day. Nothing is written either way — the logged
 *                   food is never touched (spec §2.2).
 */
export function dayTargets({ profile, sessions, ds = localDateStr(), today = localDateStr() } = {}) {
  const p = sanitizeProfile(profile);
  const base = calcTargets(p);
  const todays = sessionsOn(sessions, ds);
  const trained = todays.length > 0;
  const t = trainingDaysPerWeek(sessions, today);

  // On a trained day the allowance is what the session actually cost. On an
  // untrained day it is what a typical recent session costs, so the rest-day
  // subtraction matches the training-day addition.
  const recent = (Array.isArray(sessions) ? sessions.filter(Boolean) : [])
    .slice().sort((a, b) => ds10(b.date).localeCompare(ds10(a.date))).slice(0, 8);
  const typical = recent.length
    ? round25(recent.reduce((s, x) => s + sessionKcalAllowance(x, p.weightKg), 0) / recent.length)
    : 0;
  const allowance = trained
    ? round25(todays.reduce((s, x) => s + sessionKcalAllowance(x, p.weightKg), 0))
    : typical;

  // With no training history at all there is nothing to redistribute and the
  // base target stands as-is for every day.
  const linked = t > 0 && allowance > 0;
  // Not rounded to 25 — carb rounding is the only quantisation, which keeps
  // the weekly total within a few kcal of base × 7 instead of tens.
  const restDrop = linked ? allowance * (t / (7 - t)) : 0;

  const trainingTargets = linked ? shiftCarbs(base, allowance) : base;
  // Floor: never push a rest day below BMR, whatever the arithmetic says. A
  // rule that can talk someone into under-eating is not a rule worth having.
  const floor = Math.round(10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === "male" ? 5 : -161));
  let restTargets = linked ? shiftCarbs(base, -restDrop) : base;
  if (restTargets.kcal < floor) {
    const bump = Math.ceil((floor - restTargets.kcal) / 4);
    restTargets = { ...restTargets, c: restTargets.c + bump, kcal: restTargets.kcal + bump * 4 };
  }

  const resolved = trained ? "training" : (ds < today ? "rest" : (ds > today ? "rest" : "provisional"));
  return {
    base, trained, resolved, linked,
    trainingDaysPerWeek: t,
    allowance, restDrop: base.kcal - restTargets.kcal,
    trainingTargets, restTargets,
    // What the day is actually scored against right now.
    targets: trained ? trainingTargets : restTargets,
    rule: TRAINING_RULE,
    sessionsToday: todays.length,
  };
}

/**
 * Back-compat shim for the old Fuel↔Gym card. Same shape the nutrition
 * screen already consumed, now backed by the real rule instead of the two
 * hard-coded constants it used to carry.
 */
export function gymLink(gymSessions, ds = localDateStr(), profile = null) {
  const sessions = Array.isArray(gymSessions) ? gymSessions.filter(Boolean) : [];
  const d = dayTargets({ profile, sessions, ds });
  const last = sessions.slice().sort((a, b) => ds10(b.date).localeCompare(ds10(a.date)))[0] || null;
  return {
    connected: sessions.length > 0,
    trainedToday: d.trained,
    kcalShift: d.trained ? d.targets.kcal - d.base.kcal : 0,
    proteinBump: 0, // protein does not move — spec §2.2
    sessionsToday: d.sessionsToday,
    lastDate: last ? ds10(last.date) : null,
    lastSets: last && Array.isArray(last.entries)
      ? last.entries.reduce((s, e) => s + (Array.isArray(e.sets) ? e.sets.length : 0), 0) : 0,
  };
}
