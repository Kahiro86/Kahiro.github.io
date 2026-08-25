// Layer 1 domain types. Pure data — no behavior lives here.

export type { MuscleId, GroupId, BodyView } from "./muscles";
export { MUSCLE_IDS } from "./muscles";
import type { MuscleId } from "./muscles";

export type LoadType =
  | "barbell"
  | "machine"
  | "dumbbell"
  | "cable"
  | "bodyweight"
  | "weighted_bodyweight"
  | "assisted"
  | "time"
  | "distance";

export type Equipment =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "bodyweight"
  | "bench"
  | "pull-up-bar"
  | "dip-bar"
  | "kettlebell"
  | "bar"
  | "none";

// ── Discipline (v2 §3.9) ─────────────────────────────────────────────
// What KIND of training a movement is, independent of what it loads. The
// catalog was built around loaded resistance work, so everything that isn't
// a lift — intervals, jumps, mobility, stretching, restorative work — had
// nowhere to live and simply wasn't in it.
export type Discipline =
  | "strength"      // loaded resistance work
  | "calisthenics"  // bodyweight strength and skill
  | "plyometric"    // elastic, jump and throw work
  | "hiit"          // high-intensity intervals
  | "liit"          // low-intensity steady-state / interval work
  | "hybrid"        // hybrid athleticism: carries, sleds, complexes
  | "mobility"      // active range of motion
  | "stretching"    // passive lengthening
  | "recovery";     // restorative, deliberately low effort

/**
 * How a movement's muscle shares should be read.
 *
 *  "load"    real training volume — heat, XP and progression.
 *  "target"  the muscles the movement ADDRESSES, without training them.
 *            A hamstring stretch targets hamstrings; it does not train
 *            them, and lighting the heatmap for it would be a lie. These
 *            keep honest shares so search and filtering still work, but the
 *            aggregators skip them.
 */
export type TrainingEffect = "load" | "target";

export const DISCIPLINES: ReadonlyArray<{ id: Discipline; label: string; effect: TrainingEffect }> = [
  { id: "strength", label: "Strength", effect: "load" },
  { id: "calisthenics", label: "Calisthenics", effect: "load" },
  { id: "plyometric", label: "Plyometrics", effect: "load" },
  { id: "hiit", label: "HIIT", effect: "load" },
  { id: "liit", label: "LIIT", effect: "load" },
  { id: "hybrid", label: "Hybrid athleticism", effect: "load" },
  { id: "mobility", label: "Mobility", effect: "target" },
  { id: "stretching", label: "Stretching", effect: "target" },
  { id: "recovery", label: "Recovery", effect: "target" },
];

const EFFECT_BY_DISCIPLINE = new Map(DISCIPLINES.map((d) => [d.id, d.effect]));
export function effectOf(discipline: Discipline): TrainingEffect {
  return EFFECT_BY_DISCIPLINE.get(discipline) ?? "load";
}

export interface MuscleContribution {
  muscle: MuscleId;
  share: number; // 0-1; all shares for one exercise sum to 1.0
  // Independent of share (v2 §3.4): drives the binary "trained" state
  // (heatmap outline, "not yet trained" copy). Heat/XP intensity always
  // uses the full weighted share regardless of this flag.
  primaryMover: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  aliases: string[];
  // For a compound exercise (components present), loadType/limbsLoaded are
  // only the first component's values — advisory/display only. Volume and
  // effective load always recurse into `components` instead of using this
  // exercise's own load fields, so a compound can freely mix load types
  // (e.g. a bodyweight pushup + a barbell row).
  loadType: LoadType;
  limbsLoaded: 1 | 2; // dumbbell: implements held, not doubling — see load.ts
  unilateral: boolean; // if true, reps/duration are logged per side
  leverageFactor?: number; // required for bodyweight / weighted_bodyweight / assisted / distance
  intensityFactor?: number; // required for time
  muscles: MuscleContribution[];
  equipment: Equipment[];
  referenceVolume: number;
  defaultRestSeconds: number; // compound lifts ~180s, isolation ~60s
  discipline: Discipline;
  // Derived from `discipline`, carried on the exercise so the aggregators
  // never have to know the taxonomy — they just ask whether this loads.
  trainingEffect: TrainingEffect;
  components?: Exercise[]; // present only for compound (multi-exercise) movements
}

export interface LoggedSet {
  exerciseId: string;
  weightKg?: number;
  reps?: number;
  durationSec?: number;
  distanceM?: number;
  rpe?: number; // optional, 6-10, collected but never scored (see spec §9)
  // Snapshot at time of set, not session-level — recomputing history must
  // never retroactively change past XP/PRs when current bodyweight changes.
  bodyweightKg: number;
  timestamp: number;
}

export interface RepsAtLoad {
  loadKg: number;
  reps: number;
}

export interface ExerciseHistory {
  maxWeightKg: number;
  maxVolumeSingleSet: number;
  repsAtLoad: RepsAtLoad[];
}

export function emptyExerciseHistory(): ExerciseHistory {
  return { maxWeightKg: 0, maxVolumeSingleSet: 0, repsAtLoad: [] };
}

export interface BodyweightHistory {
  maxBodyweightKg: number;
  minBodyweightKg: number;
}

export function emptyBodyweightHistory(): BodyweightHistory {
  return { maxBodyweightKg: 0, minBodyweightKg: Infinity };
}

export interface HistoryContext {
  // A key absent from this record (as opposed to present-but-empty) means
  // the exercise has never been logged before — the signal detectPrs uses
  // to suppress PRs on a first-ever log (v2 §4.6) in favor of the
  // discovery bonus.
  exerciseHistory: Record<string, ExerciseHistory>;
  // Optional — defaults to emptyBodyweightHistory() when omitted, so
  // existing callers that don't care about bodyweight PRs keep working.
  bodyweightHistory?: BodyweightHistory;
  isFirstSessionOfDay: boolean;
  streakWeeks: number;
}

export interface SessionInput {
  sets: LoggedSet[];
}

export interface XpComponent {
  label: string;
  amount: number;
  reason: string;
}

export interface XpBreakdown {
  total: number;
  components: XpComponent[];
}

export type PrType = "weight" | "rep" | "volume" | "bodyweightMax" | "bodyweightMin";

export interface Pr {
  type: PrType;
  // For bodyweightMax/bodyweightMin this is BODYWEIGHT_PR_SUBJECT (see
  // bodyweight.ts), not a real catalog id — bodyweight PRs aren't tied to
  // any exercise.
  exerciseId: string;
  value: number;
  previousBest: number;
}

export interface SessionXpResult {
  total: number;
  setBreakdowns: XpBreakdown[]; // per-set MARGINAL xp — sums exactly to total
  muscleXp: Record<MuscleId, number>;
  prs: Pr[];
  sessionBonusComponents: XpComponent[];
  updatedExerciseHistory: Record<string, ExerciseHistory>;
  updatedBodyweightHistory: BodyweightHistory;
}

export type Rank = "F" | "E" | "D" | "C" | "B" | "A" | "S";
export type RankOrUnranked = Rank | "unranked";
