// ── Workout split templates + weekly plan ────────────────────────────
// Named day-types (Upper+Core, Lower+Core, Rest, …) each holding an editable
// exercise list. Ships as placeholder STRUCTURE only — no invented exercises;
// the owner fills them in. Exercises can be grouped into giant-set blocks.
// A weekly plan maps each weekday to a split; the one rest day defaults to
// Sunday. Everything is local-first and editable.
const uid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const EX_TYPES = ["bodyweight", "weighted", "cardio", "mobility"];
export const WEEK_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const DAY_LABEL = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

const DEFAULT_NAMES = ["Upper + Core", "Lower + Core", "Rest", "Full Body", "Cardio", "Mobility", "Recovery"];

export const newExercise = (patch = {}) => ({
  id: uid("ex"), name: "", type: "weighted", sets: "", reps: "", duration: "", note: "", giantSetId: null, ...patch,
});
export const newSplit = (name = "New split") => ({ id: uid("sp"), name, exercises: [] });

// Default splits: the 7 named day-types, each with an EMPTY exercise list.
export const DEFAULT_SPLITS = () => DEFAULT_NAMES.map((n) => ({ id: `sp_${n.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`, name: n, exercises: [] }));

export function sanitizeSplits(raw) {
  const list = Array.isArray(raw) && raw.length ? raw : DEFAULT_SPLITS();
  return list.filter((s) => s && typeof s === "object" && typeof s.name === "string").map((s) => ({
    id: typeof s.id === "string" ? s.id : uid("sp"),
    name: s.name.slice(0, 40),
    exercises: (Array.isArray(s.exercises) ? s.exercises : []).filter((e) => e && typeof e === "object").map((e) => ({
      id: typeof e.id === "string" ? e.id : uid("ex"),
      name: typeof e.name === "string" ? e.name.slice(0, 60) : "",
      type: EX_TYPES.includes(e.type) ? e.type : "weighted",
      sets: e.sets == null ? "" : String(e.sets).slice(0, 6),
      reps: e.reps == null ? "" : String(e.reps).slice(0, 12),
      duration: e.duration == null ? "" : String(e.duration).slice(0, 12),
      note: typeof e.note === "string" ? e.note.slice(0, 120) : "",
      giantSetId: typeof e.giantSetId === "string" ? e.giantSetId : null,
    })),
  }));
}

// Weekly plan: weekday → splitId. Default = Rest on Sunday, others unassigned.
export function sanitizeWeek(raw, splits) {
  const ids = new Set((splits || []).map((s) => s.id));
  const rest = (splits || []).find((s) => /rest/i.test(s.name));
  const out = {};
  const p = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  for (const d of WEEK_DAYS) out[d] = ids.has(p[d]) ? p[d] : (d === "sun" && rest ? rest.id : null);
  return out;
}

const jsToKey = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
export const weekdayKey = (dateObj = new Date()) => jsToKey[dateObj.getDay()];
export function splitForDay(week, splits, dateObj = new Date()) {
  const id = sanitizeWeek(week, splits)[weekdayKey(dateObj)];
  return (splits || []).find((s) => s.id === id) || null;
}

// Group a split's exercises for display: giant-set blocks stay together.
export function groupedExercises(split) {
  const ex = split?.exercises || [];
  const blocks = [];
  const byGiant = {};
  for (const e of ex) {
    if (e.giantSetId) {
      if (!byGiant[e.giantSetId]) { byGiant[e.giantSetId] = { giant: e.giantSetId, items: [] }; blocks.push(byGiant[e.giantSetId]); }
      byGiant[e.giantSetId].items.push(e);
    } else {
      blocks.push({ giant: null, items: [e] });
    }
  }
  return blocks;
}
export const newGiantId = () => uid("gs");
