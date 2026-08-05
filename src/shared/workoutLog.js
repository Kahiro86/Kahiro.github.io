// ── Workout log helpers — one store, one write per completed exercise ──
// Ticking an exercise done on the split checklist IS the log entry. Both the
// checklist and the Quick Logger write here, into athlete_workouts, so there
// is a single source of truth: an exercise is "done" iff it exists in today's
// session for that split. There is no separate checklist store.
const rid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`;

// Today's session for a split — matched by the stamped splitId, or by name for
// sessions created before the stamp (or via the full Log-Workout form).
export function findSession(workouts, ds, split) {
  const arr = Array.isArray(workouts) ? workouts : [];
  return arr.find((w) => w && w.date === ds && (w.splitId === split?.id || (split && w.name === split.name))) || null;
}

// The logged exercise matching a template exercise, by its stamped tplId.
export function loggedForTpl(session, tplId) {
  return (session?.exercises || []).find((e) => e && e.tplId === tplId) || null;
}

// Most recent top-set weight logged for an exercise (by name) — the pre-fill
// default so re-logging a lift starts from what you last did.
export function lastWeightFor(workouts, name) {
  const arr = (Array.isArray(workouts) ? workouts : [])
    .filter((w) => w && w.type === "strength")
    .slice()
    .sort((a, b) => ((a.date || "") < (b.date || "") ? 1 : -1)); // newest first
  for (const w of arr) {
    for (const e of (w.exercises || [])) {
      if (e && e.name === name) {
        const top = (e.sets || []).reduce((m, s) => Math.max(m, +s?.weight || 0), 0);
        if (top > 0) return top;
      }
    }
  }
  return null;
}

// Seed a logged exercise from its template row. Set count comes from the
// template's `sets` (min 1), reps from the template, weight pre-filled
// (last-logged → template suggestion → blank). Only weighted exercises carry
// a weight; bodyweight/cardio/mobility log reps/sets only.
export function seedLoggedExercise(tplEx, lastWeight = null) {
  const weighted = tplEx.type === "weighted";
  const count = Math.min(12, Math.max(1, parseInt(tplEx.sets, 10) || 1));
  const reps = tplEx.reps != null ? String(tplEx.reps) : "";
  const w = weighted ? (lastWeight != null ? String(lastWeight) : (tplEx.weight ? String(tplEx.weight) : "")) : "";
  return {
    id: rid("le"), tplId: tplEx.id, name: tplEx.name || "Exercise",
    exType: tplEx.type, muscle: tplEx.muscle || "",
    sets: Array.from({ length: count }, () => ({ reps, weight: w })),
  };
}

// A fresh session for a split, optionally with its first logged exercise.
export function newSession(split, ds, loggedEx = null) {
  return {
    id: rid("w"), type: "strength", name: split.name, splitId: split.id,
    date: ds, duration: 0, distance: 0, intensity: "Moderate", notes: "",
    createdAt: new Date().toISOString(),
    exercises: loggedEx ? [loggedEx] : [], totalVolume: loggedEx ? exerciseVolume(loggedEx) : 0,
  };
}

// Volume = Σ reps × weight, per exercise and per session.
export const exerciseVolume = (ex) => (ex?.sets || []).reduce((s, st) => s + (+st.reps || 0) * (+st.weight || 0), 0);
export const sessionVolume = (session) => (session?.exercises || []).reduce((s, e) => s + exerciseVolume(e), 0);

// Recompute and stamp the session's total volume — call after any set edit.
export const withVolume = (session) => ({ ...session, totalVolume: sessionVolume(session) });

// Unique, non-empty muscle groups worked in a session (for the body map).
export function sessionMuscles(session) {
  return [...new Set((session?.exercises || []).map((e) => e && e.muscle).filter(Boolean))];
}

// Commit a session into the workouts array (replace by id, or prepend).
export function commitSession(workouts, session) {
  const arr = Array.isArray(workouts) ? [...workouts] : [];
  const next = withVolume(session);
  const i = arr.findIndex((w) => w && w.id === next.id);
  if (i >= 0) arr[i] = next; else arr.unshift(next);
  return arr;
}

// Remove a session entirely (used when its last exercise is un-ticked).
export function dropSession(workouts, sessionId) {
  return (Array.isArray(workouts) ? workouts : []).filter((w) => w && w.id !== sessionId);
}
