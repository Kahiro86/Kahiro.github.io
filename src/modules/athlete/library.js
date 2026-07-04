// Persistent exercise library. Users add their own; each exercise stores
// metadata + default set/rep/weight so logging is near-instant.
export const uidE = () => `ex${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

const mk = (name, muscle, equipment, defSets = 3, defReps = 8, defWeight = "") =>
  ({ id: `seed_${name.toLowerCase().replace(/[^a-z]/g, "")}`, name, muscle, equipment, defSets, defReps, defWeight, notes: "" });

export const DEFAULT_EXERCISES = [
  mk("Squat", "Legs", "Barbell", 5, 5),
  mk("Deadlift", "Back", "Barbell", 3, 5),
  mk("Bench Press", "Chest", "Barbell", 5, 5),
  mk("Overhead Press", "Shoulders", "Barbell", 5, 5),
  mk("Pull-up", "Back", "Bodyweight", 3, 8),
  mk("Barbell Row", "Back", "Barbell", 4, 8),
  mk("Hip Thrust", "Glutes", "Barbell", 3, 10),
  mk("Lunges", "Legs", "Dumbbell", 3, 10),
  mk("Dips", "Chest", "Bodyweight", 3, 10),
  mk("Bicep Curl", "Arms", "Dumbbell", 3, 12),
  mk("Tricep Extension", "Arms", "Cable", 3, 12),
  mk("Lat Pulldown", "Back", "Cable", 3, 10),
  mk("Leg Press", "Legs", "Machine", 3, 10),
  mk("Leg Curl", "Legs", "Machine", 3, 12),
  mk("Calf Raise", "Legs", "Machine", 4, 15),
  mk("Shoulder Press", "Shoulders", "Dumbbell", 3, 10),
  mk("Face Pulls", "Shoulders", "Cable", 3, 15),
  mk("Plank", "Core", "Bodyweight", 3, 1),
];

export const MUSCLE_GROUPS = ["Chest", "Back", "Legs", "Glutes", "Shoulders", "Arms", "Core", "Full Body", "Other"];
export const EQUIPMENT = ["Barbell", "Dumbbell", "Machine", "Cable", "Bodyweight", "Kettlebell", "Bands", "Other"];

export const uidT = () => `tpl${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

// Map exercise name → most recent logged sets, for one-tap autofill of prior values.
export function lastValuesByExercise(workouts) {
  const map = {};
  [...workouts]
    .filter((w) => w.type === "strength")
    .sort((a, b) => new Date(a.date) - new Date(b.date)) // oldest→newest so latest wins
    .forEach((w) => {
      (w.exercises || []).forEach((ex) => {
        if (ex.name && (ex.sets || []).length) map[ex.name] = ex.sets.map((s) => ({ reps: s.reps, weight: s.weight }));
      });
    });
  return map;
}

// Per-exercise progressive-overload trend: latest top-set weight vs the one before.
export function overloadTrend(workouts) {
  const byEx = {};
  [...workouts]
    .filter((w) => w.type === "strength")
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .forEach((w) => {
      (w.exercises || []).forEach((ex) => {
        const top = (ex.sets || []).reduce((m, s) => Math.max(m, +s.weight || 0), 0);
        if (!ex.name || top <= 0) return;
        (byEx[ex.name] = byEx[ex.name] || []).push({ date: w.date, top });
      });
    });
  return Object.entries(byEx)
    .map(([name, points]) => {
      const latest = points[points.length - 1];
      const prev = points.length > 1 ? points[points.length - 2] : null;
      return { name, latest: latest.top, prev: prev ? prev.top : null, delta: prev ? latest.top - prev.top : null, sessions: points.length, date: latest.date };
    })
    .sort((a, b) => b.latest - a.latest);
}
