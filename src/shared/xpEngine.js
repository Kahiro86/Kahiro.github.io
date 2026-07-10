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
import { sanitizePurity } from "../modules/life/purity.js";
import { sanitizeReviews } from "../modules/trading/reviews.js";

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
};

// Consistency pays more the longer it runs — applied to habit AND purity runs.
const STREAK_LADDER = { 3: 15, 7: 35, 14: 60, 21: 80, 30: 120, 60: 200, 90: 300, 180: 500, 365: 1000 };

// Per-day caps stop any single pillar from being farmable.
const CAPS = { trades: 5, workouts: 3, income: 3, mindNotes: 5, prs: 2 };

const levelOfXp = (xp) => Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
export const xpForLevel = (lvl) => (lvl - 1) * (lvl - 1) * 100;

const TITLES = [
  [40, "Legend"], [30, "Grandmaster"], [25, "Sage"], [20, "Master"], [16, "Veteran"],
  [12, "Architect"], [8, "Operator"], [5, "Disciplined"], [3, "Apprentice"], [1, "Beginner"],
];
const titleOf = (lvl) => (TITLES.find(([l]) => lvl >= l) || TITLES[TITLES.length - 1])[1];

export const CAT_LABEL = {
  life: "Life", trading: "Trading", fitness: "Fitness", finance: "Finance",
  faith: "Faith", mind: "Mind", awards: "Achievements",
};

// Cross-pillar achievements — unlock automatically, each worth bonus XP.
// `test` runs against the aggregate stats collected while deriving events.
export const ACHIEVEMENTS = [
  { id: "first_rep",     icon: "🌱", name: "First Rep",              desc: "Complete your first habit",        xp: 50,   test: (s) => s.habitCompletions >= 1 },
  { id: "first_journal", icon: "📓", name: "First Reflection",       desc: "Write your first journal entry",   xp: 50,   test: (s) => s.journalDays >= 1 },
  { id: "first_workout", icon: "💪", name: "First Workout",          desc: "Log your first session",           xp: 100,  test: (s) => s.workoutCount >= 1 },
  { id: "first_trade",   icon: "📈", name: "First Trade Logged",     desc: "Journal your first trade",         xp: 100,  test: (s) => s.tradeCount >= 1 },
  { id: "perfect_7",     icon: "⭐", name: "Seven Perfect Days",     desc: "7 days with every habit done",     xp: 250,  test: (s) => s.perfectCount >= 7 },
  { id: "habits_100",    icon: "💯", name: "Century Club",           desc: "100 habit completions",            xp: 250,  test: (s) => s.habitCompletions >= 100 },
  { id: "workouts_50",   icon: "🏋️", name: "Fifty Sessions",         desc: "50 workouts logged",               xp: 300,  test: (s) => s.workoutCount >= 50 },
  { id: "trades_100",    icon: "📊", name: "Hundred Trades",         desc: "100 trades journaled",             xp: 500,  test: (s) => s.tradeCount >= 100 },
  { id: "reviews_10",    icon: "📋", name: "Review Ritual",          desc: "10 trading reviews written",       xp: 200,  test: (s) => s.reviewCount >= 10 },
  { id: "clean_30",      icon: "🌿", name: "Thirty Clean Days",      desc: "30 pure days logged",              xp: 300,  test: (s) => s.cleanDays >= 30 },
  { id: "books_5",       icon: "📚", name: "Five Books Deep",        desc: "Finish 5 books or courses",        xp: 300,  test: (s) => s.booksFinished >= 5 },
  { id: "church_12",     icon: "⛪", name: "Twelve Sundays",         desc: "12 church attendances",            xp: 200,  test: (s) => s.churchCount >= 12 },
  { id: "month_consist", icon: "⚙️", name: "One Month Consistent",   desc: "Any 30-day streak",                xp: 500,  test: (s) => s.bestStreak >= 30 },
  { id: "quarter_disc",  icon: "🛡️", name: "Three Months Disciplined", desc: "Any 90-day streak",              xp: 1000, test: (s) => s.bestStreak >= 90 },
  { id: "year_consist",  icon: "👑", name: "A Year of Consistency",  desc: "Any 365-day streak",               xp: 2000, test: (s) => s.bestStreak >= 365 },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const arr = (x) => (Array.isArray(x) ? x.filter(Boolean) : []);
const dOf = (v) => (typeof v === "string" && DATE_RE.test(v.slice(0, 10)) ? v.slice(0, 10) : null);

export function sanitizeUnlocked(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
  const out = {};
  for (const [k, v] of Object.entries(raw)) if (ids.has(k) && dOf(v)) out[k] = v.slice(0, 10);
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
    booksFinished: 0, bestStreak: 0,
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

  // Achievements — bonus XP lands on the auto-stamped unlock date.
  const unlocked = sanitizeUnlocked(deps.unlocked);
  for (const a of ACHIEVEMENTS) if (unlocked[a.id]) push(unlocked[a.id], a.xp, "awards");

  // ── Aggregate ───────────────────────────────────────────────────────
  let total = 0, streakXp = 0;
  const byDay = {}, byCat = {};
  for (const e of events) {
    total += e.xp;
    byDay[e.d] = (byDay[e.d] || 0) + e.xp;
    byCat[e.c] = (byCat[e.c] || 0) + e.xp;
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

  return {
    total, level, title: titleOf(level), prevLevelXp, nextLevelXp,
    pctToNext: Math.min(100, Math.round(((total - prevLevelXp) / Math.max(1, nextLevelXp - prevLevelXp)) * 100)),
    byCat, byDay, streakXp, weekly, achievements, newly,
    today: byDay[today] || 0,
    week: sumSince(daysAgoStr(6)),
    month: sumSince(`${today.slice(0, 7)}-01`),
    year: sumSince(`${today.slice(0, 4)}-01-01`),
    bestDay,
    avg30: Math.round(sumSince(daysAgoStr(29)) / 30),
  };
}
