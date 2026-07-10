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
