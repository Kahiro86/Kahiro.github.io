// ── Gym sessions — pure helpers, no domain import ────────────────────────
// Deliberately free of the GymXP domain/catalog so the eagerly-loaded XP hook
// (useXp → gymSessionsToWorkouts) can map gym data into the shared engine
// without pulling the 2,000-line exercise catalog into the initial bundle.
// Anything needing the domain (XP/PR/muscle math) lives in gymStore.js, which
// is only reached from the lazily-loaded Gym facet.
import { localDateStr } from "../../shared/dates.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const arr = (x) => (Array.isArray(x) ? x : []);

// Shape-only sanitise (does not validate exercise ids against the catalog —
// that check lives in gymStore where the catalog is available).
export function sanitizeSessions(raw) {
  return arr(raw)
    .filter((s) => s && typeof s === "object" && s.id && DATE_RE.test(String(s.date).slice(0, 10)))
    .map((s) => ({
      ...s,
      date: String(s.date).slice(0, 10),
      entries: arr(s.entries)
        .filter((e) => e && e.exerciseId)
        .map((e) => ({ ...e, sets: arr(e.sets).filter((x) => x && typeof x === "object") })),
    }))
    .filter((s) => s.entries.some((e) => e.sets.length > 0));
}

// Chronological (oldest first) — the order XP replay and PR history need.
export function sortedByDate(sessions) {
  return [...sessions].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.startedAt || 0) - (b.startedAt || 0)));
}

export function numOrUndef(v) {
  const n = Number(v);
  return v === undefined || v === null || v === "" || Number.isNaN(n) ? undefined : n;
}

export function firstBodyweight(session) {
  const bw = Number(session.bodyweightKg);
  return Number.isFinite(bw) && bw > 0 ? bw : undefined;
}

// Flatten a session's entries into the domain's flat LoggedSet[] (order
// preserved — marginal XP and the first-set-of-day bonus are order-sensitive).
export function sessionToLoggedSets(session) {
  const out = [];
  for (const e of arr(session.entries)) {
    for (const set of arr(e.sets)) {
      out.push({
        exerciseId: e.exerciseId,
        weightKg: numOrUndef(set.weightKg),
        reps: numOrUndef(set.reps),
        durationSec: numOrUndef(set.durationSec),
        distanceM: numOrUndef(set.distanceM),
        bodyweightKg: Number(set.bodyweightKg ?? session.bodyweightKg ?? 0),
        timestamp: Number(set.timestamp ?? session.startedAt ?? 0),
      });
    }
  }
  return out;
}

// Map gym sessions into the legacy `workouts` shape the shared XP engine
// already scores (type "strength", exercises→sets→weight). This is how a
// logged workout feeds the header level, the Iron Body journey and the
// consistency engine's fitness-day — with no XP-engine changes.
export function gymSessionsToWorkouts(sessions) {
  return sanitizeSessions(sessions).map((s) => ({
    date: s.date,
    type: "strength",
    exercises: arr(s.entries).map((e) => ({
      name: e.name || e.exerciseId,
      sets: arr(e.sets).map((x) => ({ weight: Number(x.weightKg ?? 0), reps: Number(x.reps ?? 0) })),
    })),
  }));
}

// Consecutive ISO-week buckets with a session, counting back from now — the
// streakWeeks the GymXP multiplier wants (it caps at 4 internally).
export function weeklyStreak(sessions, today = localDateStr()) {
  const weeks = new Set(sanitizeSessions(sessions).map((s) => isoWeekKey(s.date)));
  if (!weeks.size) return 0;
  let cursor = isoWeekKey(today);
  if (!weeks.has(cursor)) cursor = prevIsoWeek(cursor); // current week may be empty
  let streak = 0;
  while (weeks.has(cursor)) { streak++; cursor = prevIsoWeek(cursor); }
  return streak;
}

export function newSetFrom(prevSet, bodyweightKg) {
  return {
    weightKg: prevSet?.weightKg ?? undefined,
    reps: prevSet?.reps ?? undefined,
    durationSec: prevSet?.durationSec ?? undefined,
    distanceM: prevSet?.distanceM ?? undefined,
    bodyweightKg,
    timestamp: Date.now(),
  };
}

function isoWeekKey(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  const day = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - day);
  return localDateStr(d);
}
function prevIsoWeek(weekKey) {
  const d = new Date(`${weekKey}T12:00:00`);
  d.setDate(d.getDate() - 7);
  return localDateStr(d);
}
