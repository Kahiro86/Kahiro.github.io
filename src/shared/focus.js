// ── Focus: what to do more of, and what to avoid ─────────────────────
// Interpretation, not statistics. Every finding is a rule over the activity
// feed, and every rule has an evidence bar it must clear before it is allowed
// to say anything (§7, §8).
//
// The bar is the whole design. A recommendation engine that speaks on thin
// data is worse than none: it invents problems on the weeks somebody was
// busy, and once it has been wrong twice nobody reads it again. So:
//
//   · a rule needs MIN_DAYS of real evidence before it fires at all;
//   · an unlogged day is never counted as a miss, only as an unknown;
//   · nothing fires on a single bad day — the point is a pattern;
//   · findings are ranked by weight and only the top few are shown, because
//     a list of nine things to fix is a list of nothing to fix.
//
// Findings are of two kinds. "more" is something to do more of; "avoid" is a
// pattern to stop. Both are one short sentence — the brief is explicit that
// there is no motivational essay here.
import { localDateStr } from "./dates.js";
import { summarise, windowOf, isDone } from "./activity.js";

/** A rule needs this many logged days in the window before it may speak. */
export const MIN_DAYS = 4;
/** How many findings a person is shown. More than this is noise. */
export const MAX_FINDINGS = 3;

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);

/**
 * A finding. `weight` ranks it; `why` is the evidence, kept alongside so the
 * UI can show the reason and a test can assert the claim matches the data.
 */
const finding = (kind, id, text, weight, why) => ({ kind, id, text, weight, why });

// ── The rules ────────────────────────────────────────────────────────
// Each takes the feed and the window and returns findings or nothing. They
// are deliberately small and independent, so one saying nothing never stops
// another from speaking.

function consistencyRules(feed, days, today) {
  const out = [];
  for (const [type, label] of [["habit", "habits"], ["sleep", "sleep"], ["hydration", "hydration"], ["protein", "protein"]]) {
    const s = summarise(feed, type, days, today);
    if (s.logged < MIN_DAYS) continue;
    if (s.consistency != null && s.consistency < 50) {
      out.push(finding("more", `${type}:consistency`,
        `${cap(label)} met on ${s.met} of the ${s.logged} days you logged.`,
        60 + (50 - s.consistency) / 2,
        { type, logged: s.logged, met: s.met, consistency: s.consistency }));
    }
  }
  return out;
}

/**
 * Habits that keep being started and not finished. This is the finding the
 * partial-completion work exists to make possible — before it, a half-done
 * day was indistinguishable from an untouched one and this rule could not
 * have been written.
 */
function partialRule(feed, days, today) {
  const rows = windowOf(feed, days, today).filter((a) => a.type === "habit" && a.pct != null);
  const byHabit = new Map();
  for (const a of rows) {
    const k = a.meta?.habitId || a.label;
    const e = byHabit.get(k) || { label: a.label, logged: 0, partial: 0, sum: 0 };
    e.logged += 1;
    e.sum += a.pct;
    if (a.status === "partial") e.partial += 1;
    byHabit.set(k, e);
  }
  const out = [];
  for (const e of byHabit.values()) {
    if (e.logged < MIN_DAYS) continue;
    const share = e.partial / e.logged;
    if (share < 0.5) continue;
    const avg = Math.round(e.sum / e.logged);
    out.push(finding("more", `partial:${e.label}`,
      `${e.label} is being started but not finished — averaging ${avg}% of target.`,
      70 + share * 20, { label: e.label, logged: e.logged, partial: e.partial, avgPct: avg }));
  }
  return out;
}

/** Something logged regularly and then dropped. A trend, not a bad day. */
function droppedRule(feed, days, today) {
  const half = Math.floor(days / 2);
  const out = [];
  for (const [type, label] of [["scripture", "Scripture reading"], ["workout", "Training"], ["journal", "Journalling"], ["habit", "Habits"]]) {
    const older = countIn(feed, type, days, half, today);
    const newer = countIn(feed, type, half, 0, today);
    // Both halves need evidence: a habit you have logged twice ever cannot
    // be "trending down".
    if (older < MIN_DAYS) continue;
    const drop = older > 0 ? (older - newer) / older : 0;
    if (drop < 0.5) continue;
    out.push(finding("more", `dropped:${type}`,
      `${label} has dropped off — ${newer} in the last ${half} days, ${older} in the ${half} before.`,
      65 + drop * 20, { type, older, newer, half }));
  }
  return out;
}

function countIn(feed, type, fromDaysAgo, toDaysAgo, today) {
  const start = shift(today, -(fromDaysAgo - 1));
  const end = shift(today, -toDaysAgo);
  return feed.filter((a) => a.type === type && a.date >= start && a.date <= end && isDone(a)).length;
}

function shift(ds, n) {
  const d = new Date(`${ds}T12:00:00`);
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

/** Something improving. The layer is not only a list of failures. */
function improvingRule(feed, days, today) {
  const half = Math.floor(days / 2);
  const out = [];
  for (const [type, label] of [["workout", "Training consistency"], ["habit", "Habit consistency"]]) {
    const older = countIn(feed, type, days, half, today);
    const newer = countIn(feed, type, half, 0, today);
    if (older < MIN_DAYS || newer <= older) continue;
    out.push(finding("more", `up:${type}`, `${label} is improving — ${newer} in the last ${half} days, up from ${older}.`,
      30, { type, older, newer }));
  }
  return out;
}

/** Patterns to stop, each needing a repeat before it is a pattern. */
function avoidRules(feed, days, today) {
  const out = [];

  const sleep = summarise(feed, "sleep", days, today);
  if (sleep.logged >= MIN_DAYS && sleep.consistency != null && sleep.consistency < 60) {
    out.push(finding("avoid", "avoid:sleep",
      `Avoid missing the sleep floor — under it on ${sleep.logged - sleep.met} of ${sleep.logged} nights.`,
      75, { logged: sleep.logged, met: sleep.met }));
  }

  // Training hard and not recording anything the next day, more than once.
  const rows = windowOf(feed, days, today);
  const workoutDays = new Set(rows.filter((a) => a.type === "workout").map((a) => a.date));
  const logged = new Set(rows.map((a) => a.date));
  let unrecordedAfter = 0;
  for (const d of workoutDays) if (!logged.has(shift(d, 1))) unrecordedAfter += 1;
  if (workoutDays.size >= MIN_DAYS && unrecordedAfter >= 2) {
    out.push(finding("avoid", "avoid:recovery",
      `Avoid letting the day after a session go unrecorded — ${unrecordedAfter} times this month.`,
      55, { sessions: workoutDays.size, unrecordedAfter }));
  }

  const coverage = pct(logged.size, days);
  if (coverage != null && logged.size >= MIN_DAYS && coverage < 50) {
    out.push(finding("avoid", "avoid:gaps",
      `Avoid the recording gaps — nothing logged on ${days - logged.size} of the last ${days} days.`,
      50, { days, loggedDays: logged.size, coverage }));
  }
  return out;
}

// ── The layer ────────────────────────────────────────────────────────
/**
 * The ranked findings, capped. Returns { more, avoid, evidence } where
 * `evidence` says how much data the window actually held — so a caller can
 * tell "nothing to say" from "not enough to say it".
 */
export function focusFindings(feed, { days = 30, today = localDateStr(), limit = MAX_FINDINGS } = {}) {
  const rows = windowOf(feed, days, today);
  const loggedDays = new Set(rows.map((a) => a.date)).size;
  const evidence = { days, activities: rows.length, loggedDays, enough: loggedDays >= MIN_DAYS };

  // Below the bar the honest answer is silence, not a guess.
  if (!evidence.enough) return { more: [], avoid: [], evidence };

  const all = [
    ...partialRule(feed, days, today),
    ...consistencyRules(feed, days, today),
    ...droppedRule(feed, days, today),
    ...improvingRule(feed, days, today),
    ...avoidRules(feed, days, today),
  ];
  const rank = (a, b) => b.weight - a.weight || a.id.localeCompare(b.id);
  return {
    more: all.filter((f) => f.kind === "more").sort(rank).slice(0, limit),
    avoid: all.filter((f) => f.kind === "avoid").sort(rank).slice(0, limit),
    evidence,
  };
}

/** The single most useful thing right now, or null. */
export function topFocus(feed, opts) {
  const { more, avoid } = focusFindings(feed, opts);
  return [...more, ...avoid].sort((a, b) => b.weight - a.weight)[0] || null;
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
