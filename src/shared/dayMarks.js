// ── Rest days & cheat days ───────────────────────────────────────────
// Two planned exceptions the body needs: a rest day off training, and a
// cheat day off the nutrition plan. Both are streak-safe — the day is
// passed over, so a deliberate rest or cheat neither breaks a streak nor
// counts against consistency. Stored as one synced key: date strings
// (YYYY-MM-DD) in two lists.
import { useStorageState } from "./useStorageState.js";

export const DAY_MARKS_KEY = "athlete_day_marks";
export const DEFAULT_MARKS = { rest: [], cheat: [] };

const dateArr = (x) => (Array.isArray(x) ? x.filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) : []);

export function sanitizeMarks(raw) {
  const o = raw && typeof raw === "object" ? raw : {};
  return { rest: dateArr(o.rest), cheat: dateArr(o.cheat) };
}

export const hasRest = (marks, ds) => sanitizeMarks(marks).rest.includes(ds);
export const hasCheat = (marks, ds) => sanitizeMarks(marks).cheat.includes(ds);
export const restSet = (marks) => new Set(sanitizeMarks(marks).rest);
export const cheatSet = (marks) => new Set(sanitizeMarks(marks).cheat);

// Toggle a date in one of the two lists. `kind` is "rest" | "cheat".
export function toggleMark(setMarks, kind, ds) {
  setMarks((prev) => {
    const m = sanitizeMarks(prev);
    const list = m[kind];
    return { ...m, [kind]: list.includes(ds) ? list.filter((d) => d !== ds) : [...list, ds] };
  });
}

// Hook: returns [sanitized marks, raw setter, loaded].
export function useDayMarks() {
  const [raw, setRaw, loaded] = useStorageState(DAY_MARKS_KEY, DEFAULT_MARKS);
  return [sanitizeMarks(raw), setRaw, loaded];
}
