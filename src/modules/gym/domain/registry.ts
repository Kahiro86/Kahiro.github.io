import { EXERCISE_CATALOG } from "./catalog";
import { EXTENDED_CATALOG } from "./catalogExtended";
import { getCompoundExercise, listCompoundExercises } from "./compound";
import type { Exercise } from "./types";

// Unified lookup across the seeded catalog and runtime-registered compound
// exercises. computeSessionXp / aggregate.ts / search.ts all resolve through
// here so a compound behaves exactly like any other exercise once created.

const SEEDED: Exercise[] = [...EXERCISE_CATALOG, ...EXTENDED_CATALOG];
const SEEDED_BY_ID = new Map(SEEDED.map((e) => [e.id, e]));

export function getExercise(id: string): Exercise | undefined {
  return getCompoundExercise(id) ?? SEEDED_BY_ID.get(id);
}

export function requireExercise(id: string): Exercise {
  const exercise = getExercise(id);
  if (!exercise) {
    throw new Error(`Unknown exercise id: ${id}`);
  }
  return exercise;
}

export function allExercises(): Exercise[] {
  return [...SEEDED, ...listCompoundExercises()];
}
