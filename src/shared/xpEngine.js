// ── XP engine — the hidden progression core ─────────────────────────
// XP is never stored as a number anywhere. It derives, identically on
// every device, from the same synced records the modules already write
// (habit logs, trades, workouts, journal entries, …). That single rule
// buys every hard guarantee for free:
//   · no duplicate awards — recomputation is idempotent, double-taps
//     just toggle the underlying record
//   · no drift after offline use or restarts — the data syncs, XP follows
//   · no way to edit XP without doing the actual work — there is nothing
//     to edit, and no UI ever exposes these values or formulas
// The only stored pieces are xp_achievements ({id: unlockDate}) and
// xp_logins ({date: 1}) — both auto-stamped, never user-editable.
import { localDateStr, daysAgoStr, daysBetween } from "./dates.js";
import { migrateHabits, isScheduled, isDone, isSkipped, perfectDays } from "./habitEngine.js";
import { sanitizeGoals, CHECKPOINTS } from "./goals.js";
import { sanitizePurity } from "../modules/life/purity.js";
import { sanitizeReviews } from "../modules/trading/reviews.js";
import { sanitizeNutrition, dayTotals, nutritionScore, calcTargets } from "../modules/athlete/nutrition.js";

// Internal value table — tune freely for balance; the UI never shows it.
const V = {
  habitDone: 10, perfectDay: 25, login: 5,
  purityClean: 10, purityHonest: 5,
  journalDay: 15,
  tradeLogged: 20, tradeChecklist: 10, tradeNotes: 5, tradeShots: 5, tradeEmotions: 5,
  reviewDaily: 30, reviewWeekly: 50, reviewMonthly: 100,
  strength: 30, cardio: 25, mobility: 15, recovery: 15, pr: 50, measurement: 10,
  incomeLog: 10, billPaid: 15,
  church: 20, verseAdded: 10, verseReview: 8, devotional: 15,
  mindNote: 5, decisionLogged: 15, decisionReviewed: 25, bookFinished: 100,
  mission: { day: 5, week: 15, month: 40, quarter: 100, year: 250 },
  mealDay: 10, proteinHit: 10, healthyDay: 15,
  reminderDone: 5,
  goalCheckpoint: 25, goalDone: 150,
};

// Consistency pays more the longer it runs — applied to habit AND purity runs.
const STREAK_LADDER = { 3: 15, 7: 35, 14: 60, 21: 80, 30: 120, 60: 200, 90: 300, 180: 500, 365: 1000 };

// Per-day caps stop any single pillar from being farmable.
const CAPS = { trades: 5, workouts: 3, income: 3, mindNotes: 5, prs: 2, reminders: 10 };

const levelOfXp = (xp) => Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
export const xpForLevel = (lvl) => (lvl - 1) * (lvl - 1) * 100;

export const TITLES = [
  [40, "Legend"], [30, "Grandmaster"], [25, "Sage"], [20, "Master"], [16, "Veteran"],
  [12, "Architect"], [8, "Operator"], [5, "Disciplined"], [3, "Apprentice"], [1, "Beginner"],
];
const titleOf = (lvl) => (TITLES.find(([l]) => lvl >= l) || TITLES[TITLES.length - 1])[1];

export const CAT_LABEL = {
  life: "Life", trading: "Trading", fitness: "Fitness", finance: "Finance",
  faith: "Faith", mind: "Mind", awards: "Achievements",
};

// ── Hall of Fame — lifelong tiered journeys ──────────────────────────
// Every pillar is a journey that never ends: each milestone reached
// reveals the next one. Tiers are [threshold, bonus XP] over the same
// aggregate stats collected while deriving events, so unlocks stay fully
// derived and idempotent — exactly like the old flat achievements.
export const RANKS = ["First Step", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Master", "Grandmaster", "Immortal"];

export const JOURNEYS = [
  { key: "habits",   name: "Habit Mastery",  icon: "🔁", stat: "habitCompletions", unit: "completions",
    tiers: [[1, 50], [25, 100], [100, 250], [250, 400], [500, 600], [1000, 1000], [2500, 1500], [5000, 2500]] },
  { key: "streak",   name: "The Streak",     icon: "🔥", stat: "bestStreak", unit: "days in a row",
    tiers: [[3, 25], [7, 75], [14, 150], [30, 500], [60, 700], [90, 1000], [180, 1500], [365, 2000], [730, 3000]] },
  { key: "perfect",  name: "Perfect Days",   icon: "⭐", stat: "perfectCount", unit: "perfect days",
    tiers: [[1, 50], [7, 250], [30, 500], [90, 800], [180, 1200], [365, 2000]] },
  { key: "journal",  name: "Written Mind",   icon: "📓", stat: "journalDays", unit: "days journaled",
    tiers: [[1, 50], [7, 100], [30, 250], [100, 500], [250, 800], [500, 1200], [1000, 2000]] },
  { key: "workouts", name: "Iron Body",      icon: "💪", stat: "workoutCount", unit: "sessions",
    tiers: [[1, 100], [10, 150], [50, 300], [100, 500], [250, 800], [500, 1200], [1000, 2500]] },
  { key: "meals",    name: "Fuel Log",       icon: "🍽️", stat: "mealDays", unit: "days logged",
    tiers: [[1, 50], [7, 100], [30, 250], [100, 500], [365, 1000], [730, 2000]] },
  { key: "healthy",  name: "Clean Fuel",     icon: "🥗", stat: "healthyBest", unit: "healthy days straight",
    tiers: [[3, 100], [7, 250], [14, 400], [30, 700], [60, 1000], [90, 1500]] },
  { key: "trades",   name: "Market Craft",   icon: "📈", stat: "tradeCount", unit: "trades journaled",
    tiers: [[1, 100], [10, 150], [50, 300], [100, 500], [250, 800], [500, 1200], [1000, 2500]] },
  { key: "reviews",  name: "Review Ritual",  icon: "📋", stat: "reviewCount", unit: "reviews written",
    tiers: [[1, 50], [10, 200], [25, 350], [50, 500], [100, 800], [250, 1500]] },
  { key: "clean",    name: "Purity Road",    icon: "🌿", stat: "cleanDays", unit: "clean days",
    tiers: [[7, 100], [30, 300], [90, 600], [180, 1000], [365, 1500], [730, 2500]] },
  { key: "books",    name: "Scholar's Path", icon: "📚", stat: "booksFinished", unit: "books & courses",
    tiers: [[1, 100], [5, 300], [10, 500], [25, 800], [50, 1200], [100, 2500]] },
  { key: "church",   name: "Faithful",       icon: "⛪", stat: "churchCount", unit: "services",
    tiers: [[1, 50], [12, 200], [26, 350], [52, 600], [104, 1200]] },
  { key: "goals",    name: "Goal Getter",    icon: "🎯", stat: "goalsDone", unit: "goals completed",
    tiers: [[1, 100], [3, 200], [5, 300], [10, 500], [25, 1000], [50, 2000]] },
];

// Flat view of every tier — same {id, icon, name, desc, xp, test} interface
// the celebration layer and notification history already consume.
export const ACHIEVEMENTS = JOURNEYS.flatMap((j) =>
  j.tiers.map(([threshold, xp], i) => ({
    id: `${j.key}_${threshold}`, icon: j.icon,
    name: `${j.name} · ${RANKS[i]}`,
    desc: `${threshold.toLocaleString()} ${j.unit}`,
    xp, journey: j.key, tier: i, threshold,
    test: (s) => (s[j.stat] || 0) >= threshold,
  }))
);

// Unlock dates stamped under the old flat achievement ids map onto the
// journey tier with the same meaning — nothing already earned is lost.
const LEGACY_IDS = {
  first_rep: "habits_1", first_journal: "journal_1", first_workout: "workouts_1",
  first_trade: "trades_1", first_meal: "meals_1", clean_week: "healthy_7",
  month_consist: "streak_30", quarter_disc: "streak_90", year_consist: "streak_365",
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const arr = (x) => (Array.isArray(x) ? x.filter(Boolean) : []);
const dOf = (v) => (typeof v === "string" && DATE_RE.test(v.slice(0, 10)) ? v.slice(0, 10) : null);

export function sanitizeUnlocked(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
  const out = {};
  for (const [rawK, v] of Object.entries(raw)) {
    const k = LEGACY_IDS[rawK] || rawK;
    if (ids.has(k) && dOf(v) && !out[k]) out[k] = v.slice(0, 10);
  }
  return out;
}

export function sanitizeLogins(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const k of Object.keys(raw)) if (DATE_RE.test(k)) out[k] = 1;
  return out;
}

// ── Event derivation ─────────────────────────────────────────────────
// Every event: { d: "YYYY-MM-DD", xp, c: category, s?: streak-bonus flag }
export function computeXp(deps = {}) {
  const today = localDateStr();
  const events = [];
  const push = (d, xp, c, s) => { if (d && xp) events.push({ d, xp, c, s }); };
  const stats = {
    habitCompletions: 0, perfectCount: 0, journalDays: 0, workoutCount: 0,
    tradeCount: 0, reviewCount: 0, cleanDays: 0, churchCount: 0,
    booksFinished: 0, bestStreak: 0, mealDays: 0, healthyBest: 0, goalsDone: 0,
  };

  // Life — habits: every completed habit-day, perfect days, streak ladder.
  const habits = migrateHabits(deps.habits).filter((h) => h && !h.paused);
  for (const h of habits) {
    const target = h.target || 1;
    for (const [d, e] of Object.entries(h.log || {})) {
      if (DATE_RE.test(d) && (e?.v || 0) >= target) { push(d, V.habitDone, "life"); stats.habitCompletions++; }
    }
  }
  for (const d of perfectDays(habits, 365)) { push(d, V.perfectDay, "life"); stats.perfectCount++; }
  // Streak milestones: walk the last 2 years chronologically per habit. Days a
  // habit isn't scheduled (or was skipped) leave the run untouched — only a
  // scheduled, unlogged day breaks it, same rule the streak display uses.
  for (const h of habits) {
    let run = 0;
    for (let i = 729; i >= 0; i--) {
      const ds = daysAgoStr(i);
      if (!isScheduled(h, ds)) continue;
      if (isDone(h, ds)) {
        run++;
        if (STREAK_LADDER[run]) push(ds, STREAK_LADDER[run], "life", true);
        if (run > stats.bestStreak) stats.bestStreak = run;
      } else if (!isSkipped(h, ds) && ds !== today) run = 0; // pending today never breaks
    }
  }

  // Life — purity: clean days, honest relapse logging, its own streak ladder.
  const purity = sanitizePurity(deps.purity);
  {
    const dates = Object.keys(purity).sort();
    let run = 0, prev = null;
    for (const d of dates) {
      const e = purity[d];
      if (e.s === "pure") {
        push(d, V.purityClean, "life");
        stats.cleanDays++;
        const gap = prev ? daysBetween(prev, d) : null;
        run = prev && gap === 1 ? run + 1 : 1;
        if (STREAK_LADDER[run]) push(d, STREAK_LADDER[run], "life", true);
        if (run > stats.bestStreak) stats.bestStreak = run;
        prev = d;
      } else {
        // a relapse logged with a trigger or reflection is honest data — worth something
        if ((e.triggers || []).length || e.helped || e.trigger || e.improve) push(d, V.purityHonest, "life");
        run = 0; prev = null;
      }
    }
  }

  // Life — journal: once per journaled day.
  const jDays = new Set(arr(deps.entries).map((e) => dOf(e.date)).filter(Boolean));
  for (const d of jDays) push(d, V.journalDay, "life");
  stats.journalDays = jDays.size;

  // Life — missions completed (day → year weighting).
  for (const m of arr(deps.missions)) {
    const d = dOf(m.completedAt);
    if (m.done && d && V.mission[m.level]) push(d, V.mission[m.level], "life");
  }

  // Life — daily check-in (auto-stamped once per app-open day).
  for (const d of Object.keys(sanitizeLogins(deps.logins))) push(d, V.login, "life");

  // Trading — logged trades (capped/day) + process quality + reviews.
  const perDayTrades = {};
  for (const t of arr(deps.trades)) {
    const d = dOf(t.date);
    if (!d || t.status !== "CLOSED" || t.archived) continue;
    stats.tradeCount++;
    if ((perDayTrades[d] = (perDayTrades[d] || 0) + 1) > CAPS.trades) continue;
    let xp = V.tradeLogged;
    if (+t.checklistTotal > 0 && (+t.checklistScore || 0) >= +t.checklistTotal) xp += V.tradeChecklist;
    if (t.notes || t.lessons) xp += V.tradeNotes;
    if (t.screenshots) xp += V.tradeShots;
    if (t.emotionBefore && t.emotionAfter) xp += V.tradeEmotions;
    push(d, xp, "trading");
  }
  for (const r of sanitizeReviews(deps.reviews)) {
    const d = dOf(r.createdAt) || (r.kind === "daily" ? dOf(r.period) : null);
    if (!d) continue;
    stats.reviewCount++;
    push(d, r.kind === "monthly" ? V.reviewMonthly : r.kind === "weekly" ? V.reviewWeekly : V.reviewDaily, "trading");
  }

  // Fitness — sessions (capped/day), personal records, measurements.
  const workouts = arr(deps.workouts).filter((w) => dOf(w.date)).sort((a, b) => (a.date < b.date ? -1 : 1));
  const perDayWo = {}, perDayPr = {}, maxByEx = {};
  for (const w of workouts) {
    const d = w.date.slice(0, 10);
    stats.workoutCount++;
    if ((perDayWo[d] = (perDayWo[d] || 0) + 1) <= CAPS.workouts) {
      push(d, V[w.type] || V.mobility, "fitness");
    }
    if (w.type === "strength") {
      for (const ex of arr(w.exercises)) {
        if (!ex.name) continue;
        const top = arr(ex.sets).reduce((m, s) => Math.max(m, +s?.weight || 0), 0);
        const prevMax = maxByEx[ex.name] || 0;
        if (top > prevMax && prevMax > 0 && (perDayPr[d] = (perDayPr[d] || 0) + 1) <= CAPS.prs) {
          push(d, V.pr, "fitness");
        }
        if (top > prevMax) maxByEx[ex.name] = top;
      }
    }
  }
  const mDays = new Set(arr(deps.measurements).map((m) => dOf(m.date)).filter(Boolean));
  for (const d of mDays) push(d, V.measurement, "fitness");

  // Fitness — nutrition: logging pays, hitting protein pays, a healthy day
  // (score ≥ 70) pays more, and healthy-day runs climb the streak ladder.
  {
    const nlog = sanitizeNutrition(deps.nutrition);
    const nTargets = calcTargets(deps.nutritionProfile);
    const nDates = Object.keys(nlog).sort();
    let run = 0, prevD = null;
    for (const d of nDates) {
      const t = dayTotals(nlog[d]);
      const score = nutritionScore(t, nTargets);
      stats.mealDays++;
      push(d, V.mealDay, "fitness");
      if (t.p >= nTargets.p) push(d, V.proteinHit, "fitness");
      if (score != null && score >= 70) {
        push(d, V.healthyDay, "fitness");
        run = prevD && daysBetween(prevD, d) === 1 ? run + 1 : 1;
        if (STREAK_LADDER[run]) push(d, STREAK_LADDER[run], "fitness", true);
        if (run > stats.healthyBest) stats.healthyBest = run;
        prevD = d;
      } else { run = 0; prevD = null; }
    }
  }

  // Reminders completed in the Notification Center (capped/day; XP already
  // earned is never removed — ignoring reminders just earns nothing).
  {
    const NCAT = { nutrition: "fitness", athlete: "fitness", trading: "trading", finance: "finance", faith: "faith", mind: "mind" };
    const perDayRem = {};
    for (const e of Array.isArray(deps.notifLog) ? deps.notifLog : []) {
      if (!e || e.state !== "done" || !e.remId || !Number.isFinite(+e.doneAt)) continue;
      const d = localDateStr(new Date(+e.doneAt));
      if ((perDayRem[d] = (perDayRem[d] || 0) + 1) <= CAPS.reminders) push(d, V.reminderDone, NCAT[e.cat] || "life");
    }
  }

  // Finance — income logs (capped/day) + bills paid on their recorded month.
  const perDayInc = {};
  for (const e of arr(deps.finance?.income)) {
    const d = dOf(e.date);
    if (d && (perDayInc[d] = (perDayInc[d] || 0) + 1) <= CAPS.income) push(d, V.incomeLog, "finance");
  }
  for (const b of arr(deps.finance?.bills)) {
    // only the latest paid month is stored per bill — award that one, mid-month
    if (typeof b.lastPaidMonth === "string" && /^\d{4}-\d{2}$/.test(b.lastPaidMonth)) {
      push(`${b.lastPaidMonth}-15`, V.billPaid, "finance");
    }
  }

  // Faith — church, scripture memory, devotional notes.
  for (const d of arr(deps.church).map(dOf).filter(Boolean)) { push(d, V.church, "faith"); stats.churchCount++; }
  for (const v of arr(deps.verses)) {
    const added = dOf(v.addedAt);
    if (added) push(added, V.verseAdded, "faith");
    // review counts carry no per-review dates — attribute them to the last review day
    const n = Math.min(+v.reviews || 0, 200);
    if (n > 0) push(dOf(v.lastReviewed) || added, n * V.verseReview, "faith");
  }
  for (const n of arr(deps.faithNotes)) push(dOf(n.date), V.devotional, "faith");

  // Mind — notes (capped/day), decisions, reviewed decisions, finished books.
  const perDayNote = {};
  for (const n of arr(deps.mindNotes)) {
    const d = dOf(n.date);
    if (d && (perDayNote[d] = (perDayNote[d] || 0) + 1) <= CAPS.mindNotes) push(d, V.mindNote, "mind");
  }
  for (const dec of arr(deps.decisions)) {
    push(dOf(dec.date), V.decisionLogged, "mind");
    push(dOf(dec.reviewedAt), V.decisionReviewed, "mind");
  }
  for (const b of arr(deps.library)) {
    const d = dOf(b.finishedAt);
    if (d) { push(d, V.bookFinished, "mind"); stats.booksFinished++; }
  }

  // Goals — checkpoint and completion stamps are permanent dates written by
  // the goals engine (achievements-style), so this derivation is idempotent.
  // Archived goals still count: putting a finished goal away never un-earns it.
  {
    const AREA_CAT = { fitness: "fitness", health: "fitness", trading: "trading", finance: "finance", faith: "faith", learning: "mind", reading: "mind" };
    for (const g of sanitizeGoals(deps.goals)) {
      const c = AREA_CAT[g.area] || "life";
      for (const p of CHECKPOINTS) if (g.ms[p]) push(g.ms[p], V.goalCheckpoint, c);
      if (g.completedAt) { push(g.completedAt, V.goalDone, c); stats.goalsDone++; }
    }
  }

  // Achievements — bonus XP lands on the auto-stamped unlock date.
  const unlocked = sanitizeUnlocked(deps.unlocked);
  for (const a of ACHIEVEMENTS) if (unlocked[a.id]) push(unlocked[a.id], a.xp, "awards");

  // ── Aggregate ───────────────────────────────────────────────────────
  let total = 0, streakXp = 0;
  const byDay = {}, byCat = {}, todayByCat = {};
  for (const e of events) {
    total += e.xp;
    byDay[e.d] = (byDay[e.d] || 0) + e.xp;
    byCat[e.c] = (byCat[e.c] || 0) + e.xp;
    if (e.d === today) todayByCat[e.c] = (todayByCat[e.c] || 0) + e.xp;
    if (e.s) streakXp += e.xp;
  }

  const level = levelOfXp(total);
  const prevLevelXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  const sumSince = (since) => {
    let s = 0;
    for (const [d, xp] of Object.entries(byDay)) if (d >= since && d <= today) s += xp;
    return s;
  };
  let bestDay = null;
  for (const [d, xp] of Object.entries(byDay)) if (!bestDay || xp > bestDay[1]) bestDay = [d, xp];

  const weekly = [];
  for (let w = 11; w >= 0; w--) {
    let s = 0;
    for (let i = w * 7; i < w * 7 + 7; i++) s += byDay[daysAgoStr(i)] || 0;
    weekly.push({ label: w === 0 ? "Now" : `-${w}w`, xp: s });
  }

  const achievements = ACHIEVEMENTS.map((a) => ({
    id: a.id, icon: a.icon, name: a.name, desc: a.desc, xp: a.xp,
    got: !!unlocked[a.id] || a.test(stats), date: unlocked[a.id] || null,
  }));
  const newly = ACHIEVEMENTS.filter((a) => a.test(stats) && !unlocked[a.id]).map((a) => a.id);

  // Hall of Fame view: each journey with its current stat, tier states and
  // the next milestone — every milestone reached reveals the one after it.
  const journeys = JOURNEYS.map((j) => {
    const value = stats[j.stat] || 0;
    const tiers = j.tiers.map(([threshold, xp], i) => {
      const id = `${j.key}_${threshold}`;
      return { id, threshold, xp, rank: RANKS[i], got: !!unlocked[id] || value >= threshold, date: unlocked[id] || null };
    });
    const done = tiers.filter((t) => t.got).length;
    const next = tiers.find((t) => !t.got) || null;
    const floor = done ? tiers[done - 1].threshold : 0;
    return {
      key: j.key, name: j.name, icon: j.icon, unit: j.unit, value, tiers, done, next,
      rank: done ? tiers[done - 1].rank : null,
      pctToNext: next ? Math.min(100, Math.max(0, Math.round(((value - floor) / Math.max(1, next.threshold - floor)) * 100))) : 100,
    };
  });

  return {
    stats, journeys,
    total, level, title: titleOf(level), prevLevelXp, nextLevelXp,
    pctToNext: Math.min(100, Math.round(((total - prevLevelXp) / Math.max(1, nextLevelXp - prevLevelXp)) * 100)),
    byCat, byDay, todayByCat, streakXp, weekly, achievements, newly,
    today: byDay[today] || 0,
    week: sumSince(daysAgoStr(6)),
    month: sumSince(`${today.slice(0, 7)}-01`),
    year: sumSince(`${today.slice(0, 4)}-01-01`),
    bestDay,
    avg30: Math.round(sumSince(daysAgoStr(29)) / 30),
  };
}
