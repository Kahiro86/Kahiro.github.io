export * from "./types";
export type { Muscle, Group, GroupId } from "./muscles";
export { MUSCLES, GROUPS, DEFAULT_TAU_DAYS, DEFAULT_VOLUME_FLOOR, getMuscle, musclesInGroup, musclesInView } from "./muscles";
export { EXERCISE_CATALOG } from "./catalog";
export { getExercise, requireExercise, allExercises } from "./registry";
export {
  createCompoundExercise,
  getCompoundExercise,
  listCompoundExercises,
  clearCompoundRegistry,
} from "./compound";
export type { CompoundComponentSpec } from "./compound";
export { searchExercises, scoreExerciseMatch } from "./search";
export type { ExerciseSearchOptions } from "./search";
export { resolveEffectiveLoad, computeSetVolume, DISTANCE_SCALE } from "./load";
export { computeSessionXp, streakMultiplier, XP_CONSTANT } from "./xp";
export { xpRequiredForLevel, levelFromTotalXp, rankForMuscleXp } from "./progression";
export type { LevelProgress } from "./progression";
export { detectPrs, recordSetIntoHistory } from "./prs";
export { detectBodyweightPrs, recordBodyweightIntoHistory, BODYWEIGHT_PR_SUBJECT } from "./bodyweight";
export { aggregateMuscleXp, aggregateMuscleVolume, aggregateSessionTotals } from "./aggregate";
export type { SessionTotals } from "./aggregate";
export type { CardioModalityId, CardioModality, CardioLog } from "./cardio";
export { CARDIO_MODALITIES, CARDIO_CAP, getCardioModality, computeCardioVolume, computeCardioMuscleVolume } from "./cardio";
export {
  ACHIEVEMENTS,
  getAchievementDefinition,
  evaluateAchievements,
  resolveAchievementRewards,
  emptyPrCounts,
} from "./achievements";
export type {
  Reward,
  PlayerStats,
  AchievementDefinition,
  UnlockedAchievement,
  AchievementUnlockResult,
} from "./achievements";
