import { localDateStr } from "./dates.js";

// ── Kaizen — continuous improvement layer ──────────────────────────
// The invisible foundation: 1% better every day, measured against your
// own past self. Small, consistent, compassionate. Never guilt.

// Shared coaching identity appended to every AI system prompt.
export const KAIZEN_COACH_PREAMBLE = `You are also a Kaizen coach. Kaizen means continuous improvement — tiny, consistent 1%-better steps that compound over time. Always:
- Favor the smallest meaningful action the user can take today over ambitious plans.
- Break large goals into a single next step that takes only a few minutes.
- Measure progress against their past self, never against other people.
- Treat a missed day as normal — focus on returning, never on a broken streak.
- Frame setbacks as learning, not failure. Be compassionate and practical.
- When useful, show how small repeated actions compound (1% better daily ≈ 37× in a year).
Never use guilt, shame, or pressure. End with ONE concrete, achievable next action for today.`;

// Calm, action-oriented nudges — never guilt-based.
const KAIZEN_NUDGES = [
  "What's one small win you can achieve today?",
  "One minute of progress still counts.",
  "Every small improvement compounds.",
  "Small steps today create remarkable results tomorrow.",
  "Consistency beats intensity. Just show up.",
  "1% better than yesterday is enough.",
  "Missed a day? The only step that matters is the next one.",
  "Progress is measured against your past self, not anyone else.",
  "The smallest action you finish beats the biggest one you plan.",
  "Returning after a setback is the habit. Keep returning.",
];

// Lightweight reflection prompts — learning, not judging.
export const REFLECTION_PROMPTS = [
  "What improved today, even a little?",
  "What was difficult — and what did it teach you?",
  "What tiny adjustment could make tomorrow 1% easier?",
  "What did you learn about yourself today?",
];

// Deterministic per-day rotation so a nudge feels stable within a day.
export function nudgeOfTheDay(offset = 0) {
  const day = Math.floor(Date.now() / 86400000);
  return KAIZEN_NUDGES[((day + offset) % KAIZEN_NUDGES.length + KAIZEN_NUDGES.length) % KAIZEN_NUDGES.length];
}

// A warm, time-aware line for the Command Center greeting. It adapts to the
// real state of the day — morning leads with the plan, midday with progress,
// evening with reflection — so the home screen feels like it knows where the
// day is. Honest and compassionate; never guilt, never pressure.
export function dayGreetingLine({
  hour = new Date().getHours(), scheduled = 0, done = 0, openNonNegs = 0,
  workoutPlanned = false, workoutDone = false, journaled = false,
} = {}) {
  const left = Math.max(0, scheduled - done);
  const perfect = scheduled > 0 && left === 0;

  // Evening (17:00+): close the day with reflection.
  if (hour >= 17) {
    if (perfect && journaled) return "A complete day. Rest well — you earned it. 🌙";
    if (!journaled) return "Winding down — one honest line in the journal closes the day.";
    if (left > 0) return `${left} habit${left === 1 ? "" : "s"} still open — a small rep still counts tonight.`;
    return "Good evening. Note one thing that improved today.";
  }
  // Morning (before noon): lead with the plan.
  if (hour < 12) {
    if (openNonNegs > 0) return `${openNonNegs} non-negotiable${openNonNegs === 1 ? "" : "s"} to protect first${workoutPlanned && !workoutDone ? ", plus today's session" : ""}.`;
    if (scheduled > 0 && done === 0) return `${scheduled} habit${scheduled === 1 ? "" : "s"} on today's plan. Start with the easiest one.`;
    if (perfect) return "Habits already done — a rare, strong morning. ⭐";
    return "A fresh day. Pick one small win to start with.";
  }
  // Afternoon: reflect the day's progress.
  if (perfect) return "Every habit done. Now protect the momentum.";
  if (scheduled > 0) return `${done}/${scheduled} habits done — ${left} to go before the day closes.`;
  if (workoutPlanned && !workoutDone) return "Today's session is still on the plan — even a short one counts.";
  return "Midday check-in: one small step keeps things moving.";
}

// Compounding factor for `days` at `rate`/day (default 1%). 365d ≈ 37.8×.
export function compound(days, rate = 0.01) {
  return Math.pow(1 + rate, days);
}

// The single smallest meaningful action for today, derived from state.
// Answers the one question every screen should: "what moves this person
// forward today?" — always achievable in a few minutes.
export function nextSmallAction({ habits = [], workouts = [], trades = [] } = {}) {
  const todayISO = localDateStr();
  const undone = habits.find((h) => !h.done);
  const workedOutToday = workouts.some((w) => w.date === todayISO);
  const tradedToday = trades.some((t) => t.date === todayISO);

  if (undone) {
    return { icon: undone.icon || "✅", area: "Habits", text: `Do just one small rep of “${undone.name}.” Even a two-minute version is a full win.` };
  }
  if (!workedOutToday) {
    return { icon: "🏃", area: "Body", text: "Move for 10 minutes today — a short walk or a stretch counts completely." };
  }
  if (!tradedToday) {
    return { icon: "📊", area: "Trading", text: "Spend two minutes reviewing one past trade. Note a single thing to repeat or adjust." };
  }
  return { icon: "📓", area: "Reflection", text: "Take two minutes to note one thing that improved today. That's momentum." };
}
