// ── Training XP + level — derived, not stored ────────────────────────
// XP is always recomputed from athlete_workouts, so there is no separate
// log to keep in sync: it reflects whatever's logged, and travels with the
// same useStorageState key everyone else already syncs.
const TITLES = [
  "Rookie", "Novice", "Trainee", "Grinder", "Lifter", "Contender",
  "Veteran", "Specialist", "Elite", "Champion", "Vanguard", "Legend",
];

function xpForSession(w, isPr) {
  if (!w) return 0;
  let xp = 20; // showing up counts
  if (w.type === "strength") xp += Math.round((+w.totalVolume || 0) / 40);
  else if (w.type === "cardio") xp += Math.round((+w.duration || 0) * 1.5);
  else xp += Math.round((+w.duration || 0) * 0.8); // mobility / recovery
  if (isPr) xp += 50;
  return xp;
}

// Cumulative XP required to reach level n — early levels come fast, later
// ones stretch out.
const xpForLevel = (n) => Math.round(100 * Math.pow(n, 1.5));

// A session "hits a PR" if any set in it beats every prior set for that
// exercise, walked oldest → newest.
function detectPrSessionIds(strengthWorkoutsAsc) {
  const best = {};
  const ids = new Set();
  for (const w of strengthWorkoutsAsc) {
    let hit = false;
    for (const ex of Array.isArray(w.exercises) ? w.exercises : []) {
      if (!ex || !ex.name) continue;
      for (const s of Array.isArray(ex.sets) ? ex.sets : []) {
        const wt = +s?.weight || 0;
        if (wt > 0 && wt > (best[ex.name] || 0)) { best[ex.name] = wt; hit = true; }
      }
    }
    if (hit) ids.add(w.id);
  }
  return ids;
}

export function computeXp(workouts) {
  const arr = (Array.isArray(workouts) ? workouts : []).filter(Boolean);
  const strengthAsc = arr.filter((w) => w.type === "strength").slice().sort((a, b) => ((a.date || "") < (b.date || "") ? -1 : 1));
  const prIds = detectPrSessionIds(strengthAsc);

  const totalXp = arr.reduce((sum, w) => sum + xpForSession(w, prIds.has(w.id)), 0);

  let level = 1;
  while (level < TITLES.length && totalXp >= xpForLevel(level + 1)) level++;
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  const maxed = level >= TITLES.length;

  return {
    totalXp,
    level,
    title: TITLES[level - 1],
    xpIntoLevel: totalXp - base,
    xpForNext: maxed ? 0 : next - base,
    pct: maxed ? 100 : Math.max(0, Math.min(100, Math.round(((totalXp - base) / (next - base)) * 100))),
  };
}
