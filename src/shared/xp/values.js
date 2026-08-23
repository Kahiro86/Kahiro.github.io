// ── The XP table — one file, one set of numbers ──────────────────────
// Every value the reward system can pay lives here. No module awards XP
// directly; modules emit events and the engine prices them from this table
// (spec §4.1b). If a number is not in this file, nothing pays it.
//
// The ordering principle is the time and difficulty of the REAL-WORLD action,
// not how many taps it takes in the app. A 45-minute session is not a
// checkbox. Amounts that the §4.1 audit found already sensible are kept as
// they were rather than moved for the sake of moving them.

/** Domains. A daily cap and a balance factor apply per domain. */
export const DOMAINS = {
  discipline: { l: "Discipline", cap: 120 },
  body: { l: "Body", cap: 100 },
  sleep: { l: "Sleep", cap: 15 },
  firm: { l: "The Firm", cap: 120 },
  reviews: { l: "Reviews", cap: 80 },
  faith: { l: "Faith", cap: 80 },
  mind: { l: "Mind", cap: 80 },
  growth: { l: "Growth", cap: 150 },
  finance: { l: "Finance", cap: 60 },
};

// `uncapped` marks rare, condition-gated awards that a daily cap would gut —
// a 400-point campaign quarter cannot survive a 120-point cap, and none of
// these can be produced by repeating a tap. Everything else is capped.
// `flat` marks awards that take no difficulty or consistency multiplier,
// because they are milestones rather than daily effort.
const E = (domain, base, opts = {}) => ({ domain, base, ...opts });

export const EVENTS = {
  // ── Discipline ────────────────────────────────────────────────────
  "habit.completed": E("discipline", 10),
  "habit.numericTarget": E("discipline", 12),
  "purity.dayClaimed": E("discipline", 15),
  "journal.entry": E("discipline", 15, { minWords: 15 }),
  "purity.milestone": E("discipline", 0, { uncapped: true, flat: true, scale: "purityMilestone" }),

  // ── Body ──────────────────────────────────────────────────────────
  "workout.logged": E("body", 30),
  "workout.partial": E("body", 12),
  "workout.pr": E("body", 15, { flat: true }),
  "meals.dayComplete": E("body", 12),
  "protein.hit": E("body", 15),
  "calories.inBand": E("body", 10),
  "water.hit": E("body", 5),

  // ── Sleep ─────────────────────────────────────────────────────────
  "sleep.floorHeld": E("sleep", 15),

  // ── The Firm ──────────────────────────────────────────────────────
  "vault.contribution": E("firm", 20),
  "trading.dayReview": E("firm", 15),
  "gate.monthCleared": E("firm", 100, { uncapped: true, flat: true }),
  "campaign.quarterCleared": E("firm", 400, { uncapped: true, flat: true }),

  // ── Reviews ───────────────────────────────────────────────────────
  "review.weekly": E("reviews", 40),
  "review.monthly": E("reviews", 80, { uncapped: true }),

  // ── Faith ─────────────────────────────────────────────────────────
  "faith.church": E("faith", 20),
  "faith.verseAdded": E("faith", 10),
  "faith.verseReviewed": E("faith", 8),
  "faith.devotional": E("faith", 15),
  "faith.missionDay": E("faith", 5),
  "faith.missionWeek": E("faith", 15),
  "faith.missionMonth": E("faith", 40),
  "faith.missionQuarter": E("faith", 100, { uncapped: true, flat: true }),
  "faith.missionYear": E("faith", 250, { uncapped: true, flat: true }),

  // ── Mind ──────────────────────────────────────────────────────────
  "mind.note": E("mind", 5),
  "mind.decisionLogged": E("mind", 15),
  "mind.decisionReviewed": E("mind", 25),
  "mind.bookFinished": E("mind", 100, { uncapped: true, flat: true }),

  // ── Growth — goals and the want list ──────────────────────────────
  "goal.checkpoint": E("growth", 25),
  "goal.completed": E("growth", 150, { uncapped: true, flat: true }),
  "want.savedToday": E("growth", 8),
  "want.purchased": E("growth", 120, { uncapped: true, flat: true }),
  "want.gift": E("growth", 60, { uncapped: true, flat: true }),

  // ── Finance ───────────────────────────────────────────────────────
  "income.logged": E("finance", 10),
  "bill.paid": E("finance", 15),
};

// Purity milestones — the one scaling ladder that survives, because these are
// genuinely rare and genuinely hard. Everything else that used a streak
// ladder now uses the bounded consistency multiplier instead.
export const PURITY_MILESTONES = { 3: 30, 7: 50, 14: 80, 30: 120, 90: 180, 180: 240, 365: 300 };

/**
 * Actions that award NOTHING, ever, listed explicitly so the absence is a
 * decision on the record rather than an oversight. The engine refuses these
 * by name — see `priceEvent`.
 */
export const NEVER_PAID = {
  "app.opened": "Presence is not effort (§4.4, criterion 11).",
  "app.tabViewed": "Presence is not effort (§4.4, criterion 11).",
  "app.notificationDismissed": "Presence is not effort (§4.4, criterion 11).",
  "trade.logged": "Trading is excluded by policy (§4.4). The day-review still pays.",
  "trade.checklistClean": "Trading is excluded by policy (§4.4).",
  "trade.screenshots": "Trading is excluded by policy (§4.4).",
  "trade.emotionsLogged": "Trading is excluded by policy (§4.4).",
};

// ── Difficulty weight (§4.3) ─────────────────────────────────────────
// Derived from the user's own trailing completion rate, never from a
// self-assessed setting. Shown in the UI so the number is never mysterious.
export const DIFFICULTY_BANDS = [
  { min: 0.90, w: 0.6, l: "Mastered", why: "You hit this almost every time it comes up." },
  { min: 0.70, w: 1.0, l: "Baseline", why: "A normal, holding habit." },
  { min: 0.50, w: 1.4, l: "Hard", why: "You miss this often enough that landing it counts." },
  { min: 0.00, w: 1.8, l: "Frontier", why: "You lose this more often than you win it." },
];
export const DIFFICULTY_MIN_OCCURRENCES = 14;
export const DIFFICULTY_WINDOW_DAYS = 60;

// ── Consistency multiplier (§4.5) ────────────────────────────────────
// Capped at 1.5 on purpose: a long streak should be meaningfully better than
// none, but breaking one must stay survivable. An uncapped multiplier makes a
// broken 100-day run catastrophic, which produces quitting, not recovery.
export const CONSISTENCY_BANDS = [
  { min: 60, m: 1.5, l: "60+ days" },
  { min: 21, m: 1.3, l: "21–59 days" },
  { min: 7, m: 1.15, l: "7–20 days" },
  { min: 0, m: 1.0, l: "under a week" },
];
export const CONSISTENCY_CEILING = 1.5;

// Returning is the hardest moment in any habit system, and most designs
// punish it. This one pays for it.
export const RECOVERY_BONUS = 1.5;
export const RECOVERY_DAYS = 3;

// ── Anti-farming (§4.6) ──────────────────────────────────────────────
// A domain producing more than this share of the last 7 days' XP is dialled
// back until balance returns. Grinding one easy axis stops being the best
// move without anything being taken away.
// Difficulty weighting alone does not stop count-farming: it drags a trivial
// habit to 0.6, but twelve of them still out-earn five hard ones, because XP
// scaled linearly with how many rows exist. Additional completions within one
// domain on one day therefore pay a declining share.
//
// The first FULL_RATE_ACTIONS are paid in full, so nobody with an ordinary
// habit load is touched at all. Past that each one pays 1/(1 + DECAY×(k−n)).
// Lines are priced highest-first, so the slots that pay full always go to the
// user's hardest habits rather than whichever row happens to be first.
export const FULL_RATE_ACTIONS = 4;
export const MARGINAL_DECAY = 0.35;

export const BALANCE_THRESHOLD = 0.6;
export const BALANCE_FACTOR = 0.8;
export const BALANCE_WINDOW_DAYS = 7;

// ── Levels (§4.7) ────────────────────────────────────────────────────
// Cumulative XP to reach a level: 500 × level^1.35, exactly as specified.
// L5 4,390 · L10 11,195 · L20 28,551 — the spec's own figures.
//
// One deviation: the spec lists level 1 at 500, which would put a brand-new
// user below their own starting level. Level 1 is therefore free and every
// threshold from 2 up is the formula verbatim.
export const xpForLevel = (level) => (level <= 1 ? 0 : Math.round(500 * Math.pow(level, 1.35)));

export function levelFromXp(xp) {
  const total = Math.max(0, Math.floor(xp || 0));
  let level = 1;
  while (level < 200 && xpForLevel(level + 1) <= total) level++;
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, xpIntoLevel: total - floor, xpForNext: next - floor, toNext: next - total, nextAt: next };
}

// Ranks drawn from the Covenant's own language — "prove one, then multiply",
// "protect the floor", "sovereign over rented", "a season with an exit". A
// generic RPG ladder would say nothing about this particular system.
export const RANKS = [
  { at: 1, l: "Signatory", from: "You signed the covenant." },
  { at: 3, l: "Floor Holder", from: "Protect the floor — sleep, budget, vault — above every ceiling." },
  { at: 5, l: "Rule Keeper", from: "Judge yourself by rules held, not money made." },
  { at: 8, l: "Operator", from: "Audit like a firm. Numbers before feelings." },
  { at: 12, l: "Clean Quarter", from: "Daily card, weekly audit, monthly review, quarterly gate." },
  { at: 16, l: "Proven One", from: "Prove one before you multiply." },
  { at: 21, l: "Multiplier", from: "Prove one, then multiply." },
  { at: 27, l: "Fleet Commander", from: "One event must never breach the fleet." },
  { at: 34, l: "Sovereign", from: "Sovereign over rented — weight migrates to your capital." },
  { at: 42, l: "Season's End", from: "A season with an exit, and the date is named by you." },
];

export const rankFor = (level) =>
  [...RANKS].reverse().find((r) => level >= r.at) || RANKS[0];

/** The next rank not yet held, and the XP still needed to reach it. */
export function nextRankFor(level, totalXp) {
  const next = RANKS.find((r) => r.at > level);
  if (!next) return null;
  return { ...next, atXp: xpForLevel(next.at), toGo: Math.max(0, xpForLevel(next.at) - Math.max(0, totalXp || 0)) };
}
