// ── Fuel ↔ Gym link ──────────────────────────────────────────────────
// The nutrition screen always published its side of a training link; the gym
// module it was waiting for now exists (the Gym facet, gym_sessions), so this
// reads it. On a day a workout is logged, the body has earned more fuel — a
// training-day calorie shift and a protein bump — and the "gym session" XP row
// unlocks. Pure and derive-only: it reads the same sessions the Gym facet and
// the XP engine already use, and stores nothing of its own.
import { localDateStr } from "../../shared/dates.js";
import { gymSessionsToWorkouts } from "../gym/gymSessions.js";

export const TRAINING_KCAL_SHIFT = 300; // extra allowance on a training day
export const TRAINING_PROTEIN_BUMP = 20; // g, guidance only

export function gymLink(gymSessions, ds = localDateStr()) {
  const sessions = Array.isArray(gymSessions) ? gymSessions.filter(Boolean) : [];
  const connected = sessions.length > 0;
  const workouts = gymSessionsToWorkouts(sessions);
  const todays = workouts.filter((w) => (w.date || "").slice(0, 10) === ds);
  const trainedToday = todays.length > 0;
  const last = workouts.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""))[0] || null;
  return {
    connected,
    trainedToday,
    kcalShift: trainedToday ? TRAINING_KCAL_SHIFT : 0,
    proteinBump: trainedToday ? TRAINING_PROTEIN_BUMP : 0,
    sessionsToday: todays.length,
    lastDate: last ? (last.date || "").slice(0, 10) : null,
    lastSets: last ? last.exercises.reduce((s, e) => s + (Array.isArray(e.sets) ? e.sets.length : 0), 0) : 0,
  };
}
