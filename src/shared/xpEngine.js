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
import { sanitizeGoals, CHECKPOINTS } from "./goals.js";
import { sanitizeWants, savedOf, bestContribStreak } from "./wants.js";
import { tiTradeStats } from "../modules/trading/intel/tradingIntel.js";
import { sanitizePurity } from "../modules/life/purity.js";
import { sanitizeReviews } from "../modules/trading/reviews.js";
import { sanitizeNutrition, dayTotals, nutritionScore, calcTargets } from "../modules/athlete/nutrition.js";
import { habitFeed } from "../modules/habits/xpFeed.js";
import { DOMAINS } from "./xp/values.js";

// The value table, the streak ladder and the per-source caps that used to
// live here are gone. Every number the reward system can pay is in
// src/shared/xp/values.js, and only src/shared/xp/engine.js may price an
// action. What remains in this file is activity counting: how many habits
// were completed, how many workouts logged — the inputs to the journeys and
// the Hall of Fame, which carry no XP of their own.

// Domain labels for anything rendering the ledger's per-domain split. The
// source of truth is DOMAINS in xp/values.js; this re-exports it in the shape
// the existing views already consume, so there is still one definition.
export const CAT_LABEL = Object.fromEntries(Object.entries(DOMAINS).map(([k, v]) => [k, v.l]));

// ── Hall of Fame — lifelong tiered journeys ──────────────────────────
// Every pillar is a journey that never ends: each milestone reached
// reveals the next one. Tiers are [threshold, bonus XP] over the same
// aggregate stats collected while deriving events, so unlocks stay fully
// derived and idempotent — exactly like the old flat achievements.
export const RANKS = ["First Step", "Bronze", "Silver", "Gold", "Platinum", "Diamond", "Master", "Grandmaster", "Immortal"];

// Rank name for tier index `i`. Past the named ranks the journey keeps going —
// "Immortal II", "Immortal III", … — so tiers never run out of names.
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX"];
export function rankName(i) {
  if (i < RANKS.length) return RANKS[i];
  const over = i - RANKS.length + 2; // first extended tier = II
  return `${RANKS[RANKS.length - 1]} ${ROMAN[over] || `×${over}`}`;
}

// Round to one significant-ish figure so generated thresholds read cleanly.
const niceRound = (n) => { const mag = Math.pow(10, Math.floor(Math.log10(Math.max(1, n)))); return Math.round(n / mag) * mag; };
// Extend a journey's hand-crafted tiers with generated ones so no journey ever
// "runs out": each new milestone ≈1.7× the last with XP climbing ~1.35×, out
// to a deep cap — effectively endless at any realistic pace. Pure + idempotent.
const PROC_TIERS = 12;
function extendTiers(base) {
  const out = base.map((t) => [...t]);
  let [t, xp] = base[base.length - 1];
  for (let i = 0; i < PROC_TIERS; i++) {
    t = niceRound(t * 1.7); if (t <= out[out.length - 1][0]) t = out[out.length - 1][0] + 1;
    xp = Math.max(50, Math.round((xp * 1.35) / 50) * 50);
    out.push([t, xp]);
  }
  return out;
}

const BASE_JOURNEYS = [
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
  { key: "wants",    name: "Dream Vault",    icon: "🗝️", stat: "wantsCompleted", unit: "wants fulfilled",
    tiers: [[1, 100], [3, 200], [5, 350], [10, 600], [25, 1200], [50, 2500]] },
  { key: "saver",    name: "Disciplined Saver", icon: "💎", stat: "wantSaved", unit: "KSh saved toward wants",
    tiers: [[10000, 50], [50000, 200], [100000, 400], [250000, 700], [500000, 1200], [1000000, 2500]] },
  // ── Curated batch (Wave 10) — new journeys over already-tracked stats ──
  { key: "consistency", name: "Year of Consistency", icon: "📆", stat: "consistencyDays", unit: "days shown up",
    tiers: [[7, 100], [30, 300], [90, 600], [180, 1000], [365, 2000], [730, 3500]] },
  { key: "generous", name: "Generous Heart",   icon: "🎁", stat: "giftsCompleted", unit: "gifts given",
    tiers: [[1, 100], [3, 250], [5, 400], [10, 700], [25, 1500]] },
  { key: "savestreak", name: "Saving Streak",  icon: "🏦", stat: "wantStreakBest", unit: "days saving in a row",
    tiers: [[3, 50], [7, 150], [14, 300], [30, 600], [60, 1000], [90, 1500]] },
  { key: "judgment", name: "Clear Judgment",   icon: "⚖️", stat: "decisionsReviewed", unit: "decisions reviewed",
    tiers: [[1, 50], [5, 200], [15, 400], [30, 700], [60, 1200]] },
  { key: "word",     name: "Word Keeper",      icon: "📖", stat: "versesAdded", unit: "verses memorising",
    tiers: [[1, 50], [5, 150], [15, 350], [30, 600], [60, 1000], [100, 1800]] },
  { key: "notes",    name: "Note Taker",       icon: "🗒️", stat: "mindNotesCount", unit: "notes captured",
    tiers: [[10, 50], [50, 150], [150, 350], [400, 700], [1000, 1500]] },
  { key: "earner",   name: "Earner's Log",     icon: "💵", stat: "incomeLogs", unit: "income entries",
    tiers: [[1, 50], [10, 150], [50, 350], [150, 700], [365, 1500]] },
  { key: "measured", name: "Body Tracker",     icon: "📏", stat: "measureDays", unit: "measurement days",
    tiers: [[1, 50], [10, 150], [30, 350], [90, 700], [180, 1200]] },
  { key: "photos",   name: "Progress Captured", icon: "📸", stat: "photoCount", unit: "progress photos",
    tiers: [[1, 50], [5, 150], [15, 350], [30, 600], [60, 1200]] },
];

// Every journey's tiers extended with endless procedural milestones so the
// Hall of Fame never caps out — reach the last hand-crafted rank and the
// ladder keeps climbing (Immortal II, III, …).
export const JOURNEYS = BASE_JOURNEYS.map((j) => ({ ...j, tiers: extendTiers(j.tiers) }));

// Flat view of every tier — same {id, icon, name, desc, xp, test} interface
// the celebration layer and notification history already consume.
export const ACHIEVEMENTS = JOURNEYS.flatMap((j) =>
  j.tiers.map(([threshold, xp], i) => ({
    id: `${j.key}_${threshold}`, icon: j.icon,
    name: `${j.name} · ${rankName(i)}`,
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
  // `mark` records that a real action happened on a day, in a domain. It
  // carries NO value: since Gate 3 the ledger is the only thing that prices
  // anything (criterion 10). What survives here is the activity record the
  // counters, journeys and the consistency engine read.
  const mark = (d, c, s) => { if (d) events.push({ d, c, s }); };
  const stats = {
    habitCompletions: 0, perfectCount: 0, journalDays: 0, workoutCount: 0,
    tradeCount: 0, reviewCount: 0, cleanDays: 0, churchCount: 0,
    booksFinished: 0, bestStreak: 0, mealDays: 0, healthyBest: 0, goalsDone: 0,
    wantsCompleted: 0, wantSaved: 0, giftsCompleted: 0, wantStreakBest: 0,
    // Wave 10 — stats powering the new curated journeys.
    consistencyDays: 0, decisionsReviewed: 0, versesAdded: 0, mindNotesCount: 0,
    incomeLogs: 0, measureDays: 0, photoCount: 0,
  };

  // Life — habits (the new tracker's ht_* stores): every completed habit-day,
  // perfect days, and the per-habit streak ladder — the same signals the old
  // habit engine fed, now derived through the tracker's own schedule +
  // completion rules. Category "life", so a habit done is also a real
  // life-domain action for the Year of Consistency engine below.
  {
    const hf = habitFeed(deps.htHabits, deps.htEntries, today);
    for (const c of hf.completions) { mark(c.d, "life"); stats.habitCompletions++; }
    for (const d of hf.perfectDays) { mark(d, "life"); stats.perfectCount++; }
    // Streak hits are already marked by the completion that produced them.
    if (hf.bestStreak > stats.bestStreak) stats.bestStreak = hf.bestStreak;
  }

  // Gate 1 — after the Discipline merge, purity and journal are habit
  // subtypes and the habit path above already paid for their completions.
  // These blocks then keep COUNTING (the journeys and stats need the numbers)
  // but stop PAYING, so one real action is never worth twice. Detection is by
  // the system habit's presence, so a user mid-migration is never charged or
  // double-paid either way.
  const migratedIds = new Set((Array.isArray(deps.htHabits) ? deps.htHabits : [])
    .filter(Boolean).map((h) => h.id));
  const purityMerged = migratedIds.has("sys_purity");
  const journalMerged = migratedIds.has("sys_journal");

  // Life — purity: clean days, honest relapse logging, its own streak ladder.
  const purity = sanitizePurity(deps.purity);
  {
    const dates = Object.keys(purity).sort();
    let run = 0, prev = null;
    for (const d of dates) {
      const e = purity[d];
      if (e.s === "pure") {
        if (!purityMerged) mark(d, "life");
        stats.cleanDays++;
        const gap = prev ? daysBetween(prev, d) : null;
        run = prev && gap === 1 ? run + 1 : 1;
        // The clean day itself is already marked above.
        if (run > stats.bestStreak) stats.bestStreak = run;
        prev = d;
      } else {
        // a relapse logged with a trigger or reflection is honest data — worth something
        if ((e.triggers || []).length || e.helped || e.trigger || e.improve) mark(d, "life");
        run = 0; prev = null;
      }
    }
  }

  // Life — journal: once per journaled day.
  const jDays = new Set(arr(deps.entries).map((e) => dOf(e.date)).filter(Boolean));
  if (!journalMerged) for (const d of jDays) mark(d, "life");
  stats.journalDays = jDays.size;

  // Life — missions completed (day → year weighting).
  for (const m of arr(deps.missions)) {
    const d = dOf(m.completedAt);
    if (m.done && d) mark(d, "life");
  }

  // Life — daily check-in (auto-stamped once per app-open day). Flagged
  // `login:true` so it still earns its XP, but the Year of Consistency engine
  // can exclude a bare app-open from counting as real activity.
  // Opening the app is recorded, never rewarded (criterion 11). The stamp
  // exists so the consistency streak knows when the user started; it is
  // explicitly excluded from lifeDays below so presence cannot pass for
  // effort in any metric downstream.
  for (const d of Object.keys(sanitizeLogins(deps.logins))) events.push({ d, c: "life", login: true });

  // Trading — logged trades (capped/day) + process quality + reviews.
  const perDayTrades = {};
  for (const t of arr(deps.trades)) {
    const d = dOf(t.date);
    if (!d || t.status !== "CLOSED" || t.archived) continue;
    stats.tradeCount++;
    mark(d, "trading");
  }
  for (const r of sanitizeReviews(deps.reviews)) {
    const d = dOf(r.createdAt) || (r.kind === "daily" ? dOf(r.period) : null);
    if (!d) continue;
    stats.reviewCount++;
    mark(d, "trading");
  }

  // Trading Intelligence — the new methodology-agnostic journal (ti_trades).
  // Counted ON TOP of the legacy ict_trades above (the two stores are disjoint,
  // so no double-count) — historical XP is preserved while new trades keep
  // earning. XP per closed trade (capped/day) plus a per-day structured-review
  // bonus. All derived from immutable stored records → idempotent.
  {
    const s = tiTradeStats(deps.tiTrades);
    stats.tradeCount += s.tradeCount;
    stats.reviewCount += s.reviewCount;
    for (const [d, { count, reviews }] of Object.entries(s.byDate)) {
      mark(d, "trading");
      if (reviews > 0) mark(d, "trading");
    }
  }

  // Fitness — sessions (capped/day), personal records, measurements.
  const workouts = arr(deps.workouts).filter((w) => dOf(w.date)).sort((a, b) => (a.date < b.date ? -1 : 1));
  const perDayWo = {}, perDayPr = {}, maxByEx = {};
  for (const w of workouts) {
    const d = w.date.slice(0, 10);
    stats.workoutCount++;
    mark(d, "fitness");
    if (w.type === "strength") {
      for (const ex of arr(w.exercises)) {
        if (!ex.name) continue;
        const top = arr(ex.sets).reduce((m, s) => Math.max(m, +s?.weight || 0), 0);
        const prevMax = maxByEx[ex.name] || 0;
        if (top > prevMax && prevMax > 0) mark(d, "fitness");
        if (top > prevMax) maxByEx[ex.name] = top;
      }
    }
  }
  const mDays = new Set(arr(deps.measurements).map((m) => dOf(m.date)).filter(Boolean));
  stats.measureDays = mDays.size;
  for (const d of mDays) mark(d, "fitness");
  // Progress photos — counted for the journey (unlock bonus does the rewarding).
  stats.photoCount = arr(deps.photos).filter((p) => p && p.id && typeof p.dataUrl === "string").length;

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
      mark(d, "fitness");
      if (t.p >= nTargets.p) mark(d, "fitness");
      if (score != null && score >= 70) {
        mark(d, "fitness");
        run = prevD && daysBetween(prevD, d) === 1 ? run + 1 : 1;
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
      mark(d, NCAT[e.cat] || "life");
    }
  }

  // Finance — income logs (capped/day) + bills paid on their recorded month.
  const perDayInc = {};
  for (const e of arr(deps.finance?.income)) {
    const d = dOf(e.date);
    if (!d) continue;
    stats.incomeLogs++;
    mark(d, "finance");
  }
  for (const b of arr(deps.finance?.bills)) {
    // only the latest paid month is stored per bill — award that one, mid-month
    if (typeof b.lastPaidMonth === "string" && /^\d{4}-\d{2}$/.test(b.lastPaidMonth)) {
      mark(`${b.lastPaidMonth}-15`, "finance");
    }
  }

  // Faith — church, scripture memory, devotional notes.
  for (const d of arr(deps.church).map(dOf).filter(Boolean)) { mark(d, "faith"); stats.churchCount++; }
  for (const v of arr(deps.verses)) {
    const added = dOf(v.addedAt);
    if (added) { mark(added, "faith"); stats.versesAdded++; }
    // review counts carry no per-review dates — attribute them to the last review day
    const n = Math.min(+v.reviews || 0, 200);
    if (n > 0) mark(dOf(v.lastReviewed) || added, "faith");
  }
  for (const n of arr(deps.faithNotes)) mark(dOf(n.date), "faith");

  // Mind — notes (capped/day), decisions, reviewed decisions, finished books.
  const perDayNote = {};
  for (const n of arr(deps.mindNotes)) {
    const d = dOf(n.date);
    if (!d) continue;
    stats.mindNotesCount++;
    mark(d, "mind");
  }
  for (const dec of arr(deps.decisions)) {
    mark(dOf(dec.date), "mind");
    if (dOf(dec.reviewedAt)) { mark(dOf(dec.reviewedAt), "mind"); stats.decisionsReviewed++; }
  }
  for (const b of arr(deps.library)) {
    const d = dOf(b.finishedAt);
    if (d) { mark(d, "mind"); stats.booksFinished++; }
  }

  // Goals — checkpoint and completion stamps are permanent dates written by
  // the goals engine (achievements-style), so this derivation is idempotent.
  // Archived goals still count: putting a finished goal away never un-earns it.
  {
    const AREA_CAT = { fitness: "fitness", health: "fitness", trading: "trading", finance: "finance", faith: "faith", learning: "mind", reading: "mind" };
    for (const g of sanitizeGoals(deps.goals)) {
      const c = AREA_CAT[g.area] || "life";
      for (const p of CHECKPOINTS) if (g.ms[p]) mark(g.ms[p], c);
      if (g.completedAt) { mark(g.completedAt, c); stats.goalsDone++; }
    }
  }

  // Want List — the dream vault. XP rewards the saving habit, not spending:
  // a flat award on each distinct day a contribution was made (deduped by
  // date, so logging five in one day pays once and nothing is farmable), a
  // completion bonus on the purchase date, and an extra bump for gifts. All
  // dates are immutable, so this stays idempotent like everything else.
  {
    const wants = sanitizeWants(deps.wants);
    const saveDays = new Set();
    for (const w of wants) {
      for (const c of w.contributions) saveDays.add(c.date);
      stats.wantSaved += savedOf(w);
      if (w.purchasedAt) {
        mark(w.purchasedAt, "finance");
        stats.wantsCompleted++;
        if (w.forWhom === "gift") { mark(w.purchasedAt, "finance"); stats.giftsCompleted++; }
      }
    }
    for (const d of saveDays) mark(d, "finance", true);
    stats.wantStreakBest = bestContribStreak(saveDays);
  }

  // Achievements — bonus XP lands on the auto-stamped unlock date.
  const unlocked = sanitizeUnlocked(deps.unlocked);
  for (const a of ACHIEVEMENTS) if (unlocked[a.id]) mark(unlocked[a.id], "awards");

  // ── Aggregate ───────────────────────────────────────────────────────
  // Activity only. Per-day real-activity sets by domain (app-opens excluded).
  // "Life" = habits, journal, purity, missions; "fitness" = workouts,
  // nutrition, measurements. The Year of Consistency engine reads these to
  // require a genuine action in both domains — never a bare app-open.
  const activeDays = {}, lifeDays = new Set(), fitnessDays = new Set();
  for (const e of events) {
    if (e.login) continue; // presence is recorded, never counted as activity
    (activeDays[e.d] ||= new Set()).add(e.c);
    if (e.c === "life") lifeDays.add(e.d);
    else if (e.c === "fitness") fitnessDays.add(e.d);
  }
  // A "consistency day" = real activity in BOTH Life and Body that day.
  stats.consistencyDays = [...lifeDays].filter((d) => fitnessDays.has(d)).length;

  // No `xp` on the way out. This engine still owns achievements and journeys —
  // moving them onto the ledger is Gate 5 — but the amounts beside them came
  // from the retired value table, and a number the ledger did not pay must not
  // be reachable from a view. Nothing renders them today; the point is that
  // nothing can start to (criterion 10).
  const achievements = ACHIEVEMENTS.map((a) => ({
    id: a.id, icon: a.icon, name: a.name, desc: a.desc,
    got: !!unlocked[a.id] || a.test(stats), date: unlocked[a.id] || null,
  }));
  const newly = ACHIEVEMENTS.filter((a) => a.test(stats) && !unlocked[a.id]).map((a) => a.id);

  // Hall of Fame view: each journey with its current stat, tier states and
  // the next milestone — every milestone reached reveals the one after it.
  const journeys = JOURNEYS.map((j) => {
    const value = stats[j.stat] || 0;
    const tiers = j.tiers.map(([threshold], i) => {
      const id = `${j.key}_${threshold}`;
      return { id, threshold, rank: rankName(i), got: !!unlocked[id] || value >= threshold, date: unlocked[id] || null };
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
    stats, journeys, achievements, newly,
    // Day-level activity, for the consistency engine. No XP is returned from
    // this file at all — src/shared/xp is the only source of a number the
    // user sees as XP (criterion 10).
    lifeDays, fitnessDays,
    activeDays: Object.fromEntries(Object.entries(activeDays).map(([d, set]) => [d, [...set]])),
  };
}
