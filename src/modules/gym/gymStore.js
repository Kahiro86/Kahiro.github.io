// ── Gym facet store — domain-backed derivations ──────────────────────────
// Builds the XP/PR/muscle summaries the Gym facet shows, from the raw sessions
// stored in `architect:gym_sessions`. Everything here is recomputed from those
// records (never stored), the same "no stored derived numbers" rule the rest
// of Kaizen's XP engine follows. Pure, catalog-free session helpers live in
// gymSessions.js; this module adds the GymXP domain math on top.
import {
  getExercise,
  computeSessionXp,
  aggregateSessionTotals,
  recordSetIntoHistory,
  recordBodyweightIntoHistory,
  emptyBodyweightHistory,
} from "./engine.js";
import { sanitizeSessions, sortedByDate, sessionToLoggedSets, firstBodyweight } from "./gymSessions.js";

// Only sets whose exercise exists in the catalog can be scored (computeSessionXp
// throws on an unknown id) — drop the rest defensively.
function knownLoggedSets(session) {
  return sessionToLoggedSets(session).filter((s) => getExercise(s.exerciseId));
}

// Rebuild the PR/history context the XP engine needs by replaying every set
// from all prior sessions (chronologically) through the domain's recorders,
// so PRs, first-log discovery and bodyweight highs/lows are detected against
// real history without any of it being stored.
export function buildHistoryContext(priorSessions, { targetDate, streakWeeks = 0 } = {}) {
  const exerciseHistory = {};
  let bodyweightHistory = emptyBodyweightHistory();

  for (const session of sortedByDate(priorSessions)) {
    const bw = firstBodyweight(session);
    if (bw !== undefined) bodyweightHistory = recordBodyweightIntoHistory(bw, bodyweightHistory);
    for (const set of knownLoggedSets(session)) {
      exerciseHistory[set.exerciseId] = recordSetIntoHistory(getExercise(set.exerciseId), set, exerciseHistory[set.exerciseId]);
    }
  }

  const isFirstSessionOfDay = !priorSessions.some((s) => s.date === targetDate);
  return { exerciseHistory, bodyweightHistory, isFirstSessionOfDay, streakWeeks };
}

// Full XP/PR/muscle summary for one session given everything before it —
// used for a one-off recompute; the facet uses computeAllSummaries instead.
export function summarizeSession(session, priorSessions, streakWeeks = 0) {
  const sets = knownLoggedSets(session);
  if (!sets.length) return null;
  const history = buildHistoryContext(priorSessions, { targetDate: session.date, streakWeeks });
  const xp = computeSessionXp({ sets }, history);
  const totals = aggregateSessionTotals(sets);
  return summaryOf(xp, totals);
}

// One chronological pass over every session: computes each session's summary
// against the history accumulated up to (not including) it, folding it into
// that running history — O(total sets), not O(n²). Returns per-session
// summaries keyed by id, lifetime gym XP, and lifetime per-muscle XP.
// streakWeeks stays 0 here (the multiplier is a small late-game bonus not
// worth an O(n²) recompute for a display value).
export function computeAllSummaries(sessions) {
  const sorted = sortedByDate(sanitizeSessions(sessions));
  const exerciseHistory = {};
  let bwHistory = emptyBodyweightHistory();
  const seenDates = new Set();
  const byId = {};
  let lifetimeXp = 0;
  const muscleTotals = {};

  for (const session of sorted) {
    const sets = knownLoggedSets(session);
    if (!sets.length) { byId[session.id] = summaryOf(null, null); continue; }
    const history = {
      exerciseHistory,
      bodyweightHistory: bwHistory,
      isFirstSessionOfDay: !seenDates.has(session.date),
      streakWeeks: 0,
    };
    const xp = computeSessionXp({ sets }, history);
    const totals = aggregateSessionTotals(sets);
    const summary = summaryOf(xp, totals);
    byId[session.id] = summary;
    lifetimeXp += summary.xpTotal;
    for (const [m, v] of Object.entries(xp.muscleXp)) muscleTotals[m] = (muscleTotals[m] || 0) + v;

    // fold this session into the running history for the next one
    const bw = firstBodyweight(session);
    if (bw !== undefined) bwHistory = recordBodyweightIntoHistory(bw, bwHistory);
    for (const set of sets) exerciseHistory[set.exerciseId] = recordSetIntoHistory(getExercise(set.exerciseId), set, exerciseHistory[set.exerciseId]);
    seenDates.add(session.date);
  }

  return { byId, lifetimeXp, muscleTotals };
}

function summaryOf(xp, totals) {
  if (!xp) return { xpTotal: 0, muscleXp: {}, prs: [], setBreakdowns: [], sessionBonusComponents: [], totalVolume: 0, totalSets: 0 };
  return {
    xpTotal: Math.round(xp.total),
    muscleXp: xp.muscleXp,
    prs: xp.prs,
    setBreakdowns: xp.setBreakdowns,
    sessionBonusComponents: xp.sessionBonusComponents,
    totalVolume: Math.round(totals.totalVolume),
    totalSets: totals.totalSets,
  };
}
