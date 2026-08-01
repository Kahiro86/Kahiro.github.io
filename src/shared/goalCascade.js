// ── Goal cascade — ladder goals from year down to week ───────────────
// Pure helpers over the sanitized goals array. A goal's `horizon` places it on
// the ladder; its `parent` (a higher goal's id) links the rungs. Everything
// here is read-only maths — assignment happens in the overlay.
export const HORIZONS = [
  { id: "year", l: "This Year", short: "Year" },
  { id: "quarter", l: "This Quarter", short: "Quarter" },
  { id: "month", l: "This Month", short: "Month" },
  { id: "week", l: "This Week", short: "Week" },
];
const RANK = { year: 0, quarter: 1, month: 2, week: 3 };

export const goalPct = (g) => {
  const t = +g?.target || 0;
  if (t <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round(((+g.current || 0) / t) * 100)));
};

export const childrenOf = (goals, id) => (Array.isArray(goals) ? goals : []).filter((g) => g && g.parent === id && !g.archived);

// A parent's rolled-up progress = the average of its children's %, or its own
// direct % when it has no children.
export function rollupPct(goal, goals) {
  const kids = childrenOf(goals, goal.id);
  if (!kids.length) return goalPct(goal);
  return Math.round(kids.reduce((a, k) => a + goalPct(k), 0) / kids.length);
}

// Group active goals by horizon; anything unplaced lands in `none`.
export function groupByHorizon(goals) {
  const g = { year: [], quarter: [], month: [], week: [], none: [] };
  for (const goal of Array.isArray(goals) ? goals : []) {
    if (!goal || goal.archived) continue;
    (g[goal.horizon] || g.none).push(goal);
  }
  return g;
}

// Valid parents for a goal = active goals strictly higher on the ladder (never
// itself, never same/lower horizon → no cycles possible).
export function eligibleParents(goals, goal) {
  const myRank = goal.horizon in RANK ? RANK[goal.horizon] : 99;
  return (Array.isArray(goals) ? goals : []).filter((g) => g && !g.archived && g.id !== goal.id && g.horizon in RANK && RANK[g.horizon] < myRank);
}
