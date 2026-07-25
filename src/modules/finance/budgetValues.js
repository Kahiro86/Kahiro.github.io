// ── Budget × Doctrine — spend grouped by the value each category serves ──
// Ties the Money Doctrine's values into the budget. Each category can carry an
// optional `value` tag (one of the doctrine's values); this rolls budget/spend
// up by value so you can see where the money actually goes against what you
// say matters. Pure — the Budget tab owns storage, the coach reads the drift.

// Group budgeted + spent by the value tag each category serves. Any non-empty
// tag forms its own group (even one no longer in the doctrine, so nothing the
// user tagged silently vanishes); untagged categories collect in their own
// bucket. Returns groups sorted by spend, plus the untagged remainder.
export function spendByValue(budgets) {
  const list = Array.isArray(budgets) ? budgets : [];
  const map = new Map(); // value -> { value, budget, spent, cats }
  let uBudget = 0, uSpent = 0; const uCats = [];
  for (const b of list) {
    if (!b || typeof b !== "object") continue;
    const v = typeof b.value === "string" ? b.value.trim() : "";
    const budget = +b.budget || 0, spent = +b.spent || 0;
    if (!v) { uBudget += budget; uSpent += spent; if (b.cat) uCats.push(b.cat); continue; }
    const row = map.get(v) || { value: v, budget: 0, spent: 0, cats: [] };
    row.budget += budget; row.spent += spent; if (b.cat) row.cats.push(b.cat);
    map.set(v, row);
  }
  const groups = [...map.values()].sort((a, b) => b.spent - a.spent);
  return { groups, untagged: { budget: uBudget, spent: uSpent, cats: uCats } };
}

// The tagged categories whose spend has run meaningfully past their budget —
// what the coach flags as drift from the value they're meant to serve. A 10%
// tolerance keeps small overruns from nagging.
export function budgetDrift(budgets) {
  const out = [];
  for (const b of (Array.isArray(budgets) ? budgets : [])) {
    if (!b || typeof b !== "object") continue;
    const v = typeof b.value === "string" ? b.value.trim() : "";
    const budget = +b.budget || 0, spent = +b.spent || 0;
    if (v && budget > 0 && spent > budget * 1.1) out.push({ cat: b.cat || "A category", value: v, over: spent - budget });
  }
  return out.sort((a, b) => b.over - a.over);
}
