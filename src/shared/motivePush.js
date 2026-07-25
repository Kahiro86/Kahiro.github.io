// ── Motive Push — a calm mentor, one line at a time ──────────────────
// A universal, context-aware library of short motivational lines surfaced
// across the app. Pure and data-driven: the component owns storage (recent /
// favourites / history) and passes state in; this file only holds the library
// and the selection logic. Adding lines is trivial — the library is the API.
//
// Each push: { id, text, cat, ctx } where `cat` is a tone category and `ctx`
// is the list of contexts it fits. `id` is a stable hash of the text, so
// favourites and history survive edits and reordering of the library.

const hash = (s) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return "mp" + (h >>> 0).toString(36); };
const P = (text, cat, ...ctx) => ({ id: hash(text), text, cat, ctx: ctx.length ? ctx : ["general"] });

// Tone categories (for labelling / future filtering).
export const CATEGORIES = ["discipline", "consistency", "patience", "courage", "focus", "recovery", "growth", "faith", "leadership", "wealth", "fitness", "trading", "purpose", "gratitude", "resilience"];

// The hand-written library. Grouped by context for readability; a line can
// serve several. Combined with the procedurally-generated set below into the
// exported PUSHES, so the rotation is effectively endless.
const CURATED = [
  // ── General / anytime ──────────────────────────────────────────────
  P("Small victories build legendary lives.", "growth", "general", "day-start"),
  P("You don't have to be extreme, just consistent.", "consistency", "general"),
  P("Discipline is choosing what you want most over what you want now.", "discipline", "general"),
  P("The standard you walk past is the standard you accept.", "discipline", "general", "leadership"),
  P("Become the kind of person your goals require.", "growth", "general"),
  P("Quiet consistency outlasts loud motivation.", "consistency", "general"),
  P("You are always one decision away from a different life.", "courage", "general"),
  P("Do it tired. Do it unsure. Just don't skip it.", "resilience", "general"),
  P("The work you avoid is usually the work that frees you.", "courage", "general"),
  P("Show up before you feel ready — readiness follows.", "courage", "general"),

  // ── Beginning of the day ───────────────────────────────────────────
  P("The day hasn't been won yet. Start with one action.", "discipline", "day-start"),
  P("Momentum begins with the first checkbox.", "consistency", "day-start"),
  P("Win the morning and the day tends to follow.", "focus", "day-start"),
  P("One honest hour now beats a perfect plan later.", "focus", "day-start"),
  P("Set the tone before the world sets it for you.", "leadership", "day-start"),
  P("Today is a blank page. Write something you'd re-read.", "purpose", "day-start"),
  P("Begin badly if you must — just begin.", "courage", "day-start"),

  // ── During logging ─────────────────────────────────────────────────
  P("Every log is another brick in your future.", "consistency", "logging"),
  P("Consistency compounds.", "consistency", "logging"),
  P("Today's effort is tomorrow's advantage.", "growth", "logging"),
  P("What gets measured gets mastered.", "focus", "logging"),
  P("You're not tracking numbers — you're building proof.", "purpose", "logging"),
  P("Another rep for the person you're becoming.", "growth", "logging"),

  // ── Missed habits / recovery ───────────────────────────────────────
  P("One missed day changes nothing. Two begins a habit.", "resilience", "missed"),
  P("Resume. Don't restart.", "resilience", "missed"),
  P("Progress doesn't require perfection.", "growth", "missed"),
  P("Miss a day, not a week. Get the next one.", "consistency", "missed"),
  P("The comeback is always stronger than the setback.", "resilience", "missed"),
  P("Guilt is heavy and useless. Drop it and continue.", "recovery", "missed"),
  P("You're one rep from being back on track.", "resilience", "missed"),

  // ── Streak milestones ──────────────────────────────────────────────
  P("The streak isn't luck anymore.", "consistency", "streak"),
  P("Days like these become who you are.", "discipline", "streak"),
  P("You kept the promise you made to yourself.", "discipline", "streak"),
  P("This is what identity looks like being built.", "growth", "streak"),
  P("Momentum is on your side now — protect it.", "consistency", "streak"),

  // ── Workout complete ───────────────────────────────────────────────
  P("Someone weaker than yesterday no longer exists.", "fitness", "workout"),
  P("Your future self noticed this workout.", "fitness", "workout"),
  P("Discipline leaves evidence.", "discipline", "workout"),
  P("You negotiated with the resistance and won.", "resilience", "workout"),
  P("Strength is a decision you just made again.", "fitness", "workout"),
  P("Recovery starts now — you earned it.", "recovery", "workout"),

  // ── Trading ────────────────────────────────────────────────────────
  P("Protect capital first.", "trading", "trade-before"),
  P("Patience pays better than impulse.", "patience", "trade-before"),
  P("Trade your edge — not your emotions.", "trading", "trade-before"),
  P("The market rewards the prepared and punishes the eager.", "patience", "trade-before"),
  P("No setup, no trade. Boredom is not a signal.", "discipline", "trade-before"),
  P("Stay humble. Follow the process.", "trading", "trade-win"),
  P("A win by the rules is worth more than the profit.", "discipline", "trade-win"),
  P("Bank the lesson, not just the gain.", "growth", "trade-win"),
  P("A good loss is cheaper than a bad habit.", "trading", "trade-loss"),
  P("Judge execution, not outcome.", "trading", "trade-loss"),
  P("The loss is tuition. Make sure you learned.", "resilience", "trade-loss"),
  P("Discipline includes choosing not to trade.", "patience", "no-trade"),
  P("Sitting on your hands is a position too.", "patience", "no-trade"),
  P("Cash is a stance, not a failure.", "patience", "no-trade"),

  // ── Finance ────────────────────────────────────────────────────────
  P("Every shilling saved buys future freedom.", "wealth", "savings"),
  P("Pay your future self first.", "wealth", "savings"),
  P("Tell your money where to go.", "wealth", "budget"),
  P("A budget is permission to spend without guilt.", "wealth", "budget"),
  P("Freedom grows with every payment.", "wealth", "debt"),
  P("Every payment is a chain link removed.", "resilience", "debt"),
  P("Time multiplies disciplined decisions.", "wealth", "invest"),
  P("Invest boredom now; harvest freedom later.", "patience", "invest"),

  // ── Nutrition ──────────────────────────────────────────────────────
  P("Fuel determines performance.", "fitness", "meal"),
  P("You don't crave discipline, you build it — one meal at a time.", "discipline", "meal"),
  P("Recovery starts with nutrition.", "recovery", "protein"),
  P("Protein now is muscle later.", "fitness", "protein"),
  P("Hydration fuels consistency.", "fitness", "water"),
  P("Water first. Everything runs better hydrated.", "recovery", "water"),

  // ── Sleep ──────────────────────────────────────────────────────────
  P("Recovery is training.", "recovery", "sleep-before"),
  P("Protect the night and the day repays you.", "recovery", "sleep-before"),
  P("Discipline includes knowing when to stop.", "discipline", "sleep-before"),
  P("Today's energy was earned last night.", "recovery", "sleep-hit"),
  P("Rested is the strongest version of you.", "recovery", "sleep-hit"),

  // ── Purity ─────────────────────────────────────────────────────────
  P("Freedom is built in the moment you'd normally fold.", "discipline", "purity"),
  P("The urge passes whether you feed it or not. Wait it out.", "patience", "purity"),
  P("Every clean day is a vote for the man you're becoming.", "growth", "purity"),
  P("Strength today, gratitude tomorrow.", "discipline", "purity"),
  P("You are not your urges — you are your response.", "resilience", "purity"),
  P("Guard your eyes and your future thanks you.", "focus", "purity"),

  // ── Goals ──────────────────────────────────────────────────────────
  P("Every percent matters.", "growth", "goal-progress"),
  P("Slow progress is still progress the quitters won't have.", "resilience", "goal-progress"),
  P("Inch by inch, it's a cinch.", "consistency", "goal-progress"),
  P("Celebrate briefly. Then aim higher.", "growth", "goal-done"),
  P("You proved it's possible. Now raise the bar.", "courage", "goal-done"),

  // ── Want List ──────────────────────────────────────────────────────
  P("Every contribution brings it closer.", "patience", "want-saving"),
  P("Delayed, not denied — you're funding the dream.", "patience", "want-saving"),
  P("Enjoy it — you earned it.", "gratitude", "want-bought"),
  P("Reward received. The discipline is the real prize.", "gratitude", "want-bought"),

  // ── Reviews ────────────────────────────────────────────────────────
  P("Measure. Learn. Improve.", "focus", "review-week"),
  P("A week reviewed is a week that teaches.", "growth", "review-week"),
  P("Consistency beats intensity.", "consistency", "review-month"),
  P("A month of small right choices is a different life.", "growth", "review-month"),
  P("Look how far you've come.", "gratitude", "review-year"),
  P("A year of showing up rewrites who you are.", "purpose", "review-year"),

  // ── Faith / purpose ────────────────────────────────────────────────
  P("Do your part; trust the process with the rest.", "faith", "general", "day-start"),
  P("Steward today well and tomorrow takes care of itself.", "faith", "general"),
  P("You were made for more than comfort.", "purpose", "general"),
  P("Gratitude turns what you have into enough.", "gratitude", "general"),

  // ── Legendary — surfaced on major milestones ───────────────────────
  P("This is who you are now. The old you couldn't do this.", "growth", "legendary"),
  P("Legends are just people who refused to quit on an ordinary Tuesday.", "resilience", "legendary"),
  P("Remember this feeling. You built it with your own consistency.", "purpose", "legendary"),
  P("The discipline became identity. That's the whole game.", "discipline", "legendary"),
  P("Few make it this far. Fewer keep going. Be the fewer.", "courage", "legendary"),

  // ── Wave 11 batch — more of the same voice, every context ───────────
  P("The person you're becoming is watching how you act today.", "purpose", "general"),
  P("Comfort is a slow thief. Choose the hard, good thing.", "courage", "general"),
  P("You can't complain your way to a life you love — build it.", "growth", "general"),
  P("Standards, not moods, run a great life.", "discipline", "general", "leadership"),
  P("Boring consistency is a superpower disguised as nothing.", "consistency", "general"),
  P("Motivation gets you started; systems keep you going.", "focus", "general"),
  P("Do the next right thing and leave the outcome.", "faith", "general"),
  P("You are being built, not just kept busy.", "purpose", "general"),
  P("Enough is a decision, not an amount.", "gratitude", "general"),
  P("Feet on the floor, mind on the mission.", "focus", "day-start"),
  P("Your best hour is the one you protect first.", "focus", "day-start"),
  P("Decide the day now, before it decides you.", "leadership", "day-start"),
  P("Logged is real. Real is progress.", "consistency", "logging"),
  P("Proof beats promises — you just added some.", "growth", "logging"),
  P("This is the paper trail of a serious person.", "discipline", "logging"),
  P("A gap is not a collapse. Step back in.", "recovery", "missed"),
  P("Yesterday's miss gets no vote on today.", "resilience", "missed"),
  P("Down is not out. Log the next one.", "resilience", "missed"),
  P("The chain is long now — don't be the one to break it.", "consistency", "streak"),
  P("Anyone can start. You kept going.", "discipline", "streak"),
  P("You met the resistance and didn't blink.", "fitness", "workout"),
  P("Sweat is just weakness leaving on schedule.", "fitness", "workout"),
  P("The body keeps the receipts. You just earned one.", "discipline", "workout"),
  P("The setup either speaks or it doesn't. Wait for the voice.", "patience", "trade-before"),
  P("Risk defined, ego parked. Execute.", "trading", "trade-before"),
  P("Green by the rules today; green by the rules for life.", "discipline", "trade-win"),
  P("The loss already happened. Protect the next decision.", "trading", "trade-loss"),
  P("Flat and patient beats busy and wrong.", "patience", "no-trade"),
  P("Spend on the life you want, not the one you're escaping.", "wealth", "budget"),
  P("Every automated transfer is a promise you don't have to remember.", "wealth", "savings"),
  P("Debt shrinks the same way it grew — one decision at a time.", "resilience", "debt"),
  P("Patience is the interest that pays you.", "patience", "invest"),
  P("Eat like you respect the goal.", "fitness", "meal"),
  P("Protein is a promise to tomorrow's strength.", "fitness", "protein"),
  P("Hydrate first; the cravings quiet down.", "recovery", "water"),
  P("The night shift builds tomorrow's champion.", "recovery", "sleep-before"),
  P("Close the day on purpose.", "discipline", "sleep-before"),
  P("Great days are downloaded overnight.", "recovery", "sleep-hit"),
  P("The urge is loud but temporary; you are the constant.", "resilience", "purity"),
  P("Win the ten hard seconds; the rest gets easier.", "discipline", "purity"),
  P("Clean again today — that's a man keeping his word.", "growth", "purity"),
  P("A goal is a decision you keep re-making.", "consistency", "goal-progress"),
  P("The summit is a stack of small steps you refused to skip.", "resilience", "goal-progress"),
  P("Done is a doorway, not a finish line.", "growth", "goal-done"),
  P("The wait is part of the reward.", "patience", "want-saving"),
  P("You bought it with discipline before you paid with money.", "gratitude", "want-bought"),
  P("Honest review, honest growth.", "growth", "review-week"),
  P("Name the lesson or repeat the class.", "focus", "review-month"),
  P("A reviewed year is a year you actually keep.", "purpose", "review-year"),
  P("Ordinary days, an extraordinary refusal to quit — that's you now.", "resilience", "legendary"),
  P("You didn't find discipline. You forged it, rep by rep.", "discipline", "legendary"),
];

// ── Endless generation ───────────────────────────────────────────────
// Coherent motive lines composed from agreeing fragment banks, enumerated
// once at load so every generated line has a stable id (favourites/history
// resolve like any curated line). Two families keep grammar clean: a
// singular-subject "truth" for the general surface, and a day-start pairing.
const GEN_TRUTH_LEADS = [
  ["Discipline", "discipline"], ["Consistency", "consistency"], ["Patience", "patience"],
  ["Focus", "focus"], ["Courage", "courage"], ["Momentum", "consistency"],
  ["Showing up", "consistency"], ["Doing the hard thing", "discipline"],
  ["Quiet, steady effort", "consistency"], ["The daily rep", "discipline"],
  ["Small, honest progress", "growth"], ["Staying the course", "resilience"],
];
const GEN_TRUTH_TAILS = [
  "compounds.", "wins the long game.", "beats motivation every time.",
  "builds the man you're becoming.", "is the whole game.", "outlasts every excuse.",
  "leaves evidence.", "is how identity is built.", "turns ordinary days into destiny.",
  "pays you back in freedom.", "is a promise kept to yourself.", "quietly changes everything.",
];
const GEN_DAY_A = [
  ["Win the first hour", "focus"], ["Take the first step", "courage"], ["Claim the morning", "discipline"],
  ["Start before you feel ready", "courage"], ["Do the hardest thing first", "discipline"], ["Set the tone now", "leadership"],
];
const GEN_DAY_B = [
  "and the day follows.", "— momentum handles the rest.", "and watch the day bend your way.",
  "before the world decides for you.", "and everything after feels lighter.",
];
function buildGenerated() {
  const out = [];
  for (const [lead, cat] of GEN_TRUTH_LEADS) for (const tail of GEN_TRUTH_TAILS) out.push(P(`${lead} ${tail}`, cat, "general"));
  for (const [lead, cat] of GEN_DAY_A) for (const b of GEN_DAY_B) out.push(P(`${lead} ${b}`, cat, "day-start"));
  return out;
}

// Combined library: hand-written first (favoured by ordering), then the
// generated set. Deduped by id so a generated line can never collide with a
// curated one.
export const PUSHES = (() => {
  const seen = new Set();
  const all = [];
  for (const p of [...CURATED, ...buildGenerated()]) if (!seen.has(p.id)) { seen.add(p.id); all.push(p); }
  return all;
})();

// Fast lookup by id.
const BY_ID = Object.fromEntries(PUSHES.map((p) => [p.id, p]));
export const pushById = (id) => BY_ID[id] || null;

// Resolve a context input (string or array) into an ordered candidate pool,
// most-specific first, always falling back to "general" so there's never an
// empty result.
function candidatesFor(context) {
  const ctxs = (Array.isArray(context) ? context : [context]).filter(Boolean);
  const seen = new Set();
  const pool = [];
  for (const c of [...ctxs, "general"]) {
    for (const p of PUSHES) {
      if (p.ctx.includes(c) && !seen.has(p.id)) { seen.add(p.id); pool.push(p); }
    }
  }
  return pool;
}

// A weighted pick that avoids recently-shown ids and lightly favours the
// user's saved favourites. Deterministic only in that it never repeats what's
// in `recent` unless it has to (pool smaller than the recent window).
function weightedPick(pool, { recent = [], favs = [], avoid = [] } = {}) {
  if (!pool.length) return null;
  const recentSet = new Set(recent);
  const avoidSet = new Set(avoid);
  let fresh = pool.filter((p) => !recentSet.has(p.id) && !avoidSet.has(p.id));
  if (!fresh.length) fresh = pool.filter((p) => !avoidSet.has(p.id));
  if (!fresh.length) fresh = pool;
  const favSet = new Set(favs);
  const weighted = [];
  for (const p of fresh) { weighted.push(p); if (favSet.has(p.id)) weighted.push(p); } // favourites get 2× odds
  return weighted[Math.floor(Math.random() * weighted.length)];
}

// Given live `state`, decide whether to inject a special context (a streak
// milestone or a legendary moment) ahead of the caller's own context.
const MILESTONES = new Set([3, 7, 14, 21, 30, 50, 66, 75, 100, 150, 200, 250, 365, 500, 730, 1000]);
function autoContext(context, state = {}) {
  const base = Array.isArray(context) ? [...context] : [context];
  if (state.legendary) return ["legendary", ...base];
  if (state.streak != null && MILESTONES.has(state.streak)) return ["streak", ...base];
  if (state.missedYesterday) return ["missed", ...base];
  return base;
}

// The one entry point the component calls. Returns a push object (never null
// for a known context) plus the resolved context it was drawn from.
export function pickPush(context = "general", { state = {}, recent = [], favs = [], avoid = [] } = {}) {
  const resolved = autoContext(context, state);
  const pool = candidatesFor(resolved);
  const push = weightedPick(pool, { recent, favs, avoid });
  return push || PUSHES[0];
}

// Ring-buffer helper for the "recently shown" no-repeat window.
export const pushRecent = (recent, id, cap = 30) => [id, ...(Array.isArray(recent) ? recent : []).filter((x) => x !== id)].slice(0, cap);
