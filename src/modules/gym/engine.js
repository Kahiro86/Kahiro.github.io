// Kaizen ⇄ GymXP boundary. The `domain/` folder is GymXP's Layer-1 core,
// vendored verbatim (TypeScript, comments intact) and imported here via the
// `.js` specifiers Vite resolves to the `.ts` sources. Everything the Kaizen
// UI needs from the gym engine flows through this one JS module, so the rest
// of the app never reaches into domain internals directly.
//
// The math (per-set weighted-binary XP, PR detection, muscle compression,
// level curve, ranks) is locked by tests/gym/run.mjs — 138 ported GymXP
// domain tests. Do not fork the domain files; re-vendor from the Gym- repo
// if they change upstream.

export {
  // catalog + lookup
  EXERCISE_CATALOG,
  getExercise,
  requireExercise,
  allExercises,
  // search
  searchExercises,
  scoreExerciseMatch,
  // muscles / groups taxonomy
  MUSCLES,
  GROUPS,
  MUSCLE_IDS,
  getMuscle,
  musclesInGroup,
  musclesInView,
  // load / volume
  resolveEffectiveLoad,
  computeSetVolume,
  DISTANCE_SCALE,
  // XP engine
  computeSessionXp,
  streakMultiplier,
  XP_CONSTANT,
  // aggregation (history-free previews for the heatmap)
  aggregateMuscleXp,
  aggregateMuscleVolume,
  aggregateSessionTotals,
  // progression / ranks
  xpRequiredForLevel,
  levelFromTotalXp,
  rankForMuscleXp,
  // PRs + history recording (replayed to rebuild PR context from sessions)
  detectPrs,
  detectBodyweightPrs,
  recordSetIntoHistory,
  recordBodyweightIntoHistory,
  // compound (user-defined multi-movement exercises)
  createCompoundExercise,
  getCompoundExercise,
  listCompoundExercises,
  // history helpers
  emptyExerciseHistory,
  emptyBodyweightHistory,
  // cardio
  CARDIO_MODALITIES,
  getCardioModality,
  computeCardioVolume,
} from "./domain/index";

import { levelFromTotalXp, rankForMuscleXp } from "./domain/index";
import { MUSCLES } from "./domain/index";

// ── Kaizen-side conveniences ─────────────────────────────────────────────

// A muscle id → its display group, for rolling per-muscle XP up into the six
// body regions the Kaizen body-map and weekly rollup speak in.
export const MUSCLE_GROUP = Object.fromEntries(MUSCLES.map((m) => [m.id, m.groupId]));
export const MUSCLE_NAME = Object.fromEntries(MUSCLES.map((m) => [m.id, m.displayName]));

// Lifetime gym level from a running total of session XP — the number the
// Gym facet shows and the value that feeds Kaizen's shared progression.
export function gymLevel(totalXp) {
  return levelFromTotalXp(Math.max(0, totalXp || 0));
}

// Roll a per-muscle XP record up into the six groups, each carrying its rank.
export function groupRollup(muscleXp = {}) {
  const groups = {};
  for (const [muscle, xp] of Object.entries(muscleXp)) {
    const g = MUSCLE_GROUP[muscle];
    if (!g) continue;
    groups[g] = (groups[g] || 0) + (xp || 0);
  }
  return Object.entries(groups).map(([id, xp]) => ({ id, xp, rank: rankForMuscleXp(xp) }));
}
