// ── Trading Intelligence — seed libraries ────────────────────────────
// Everything here is an *editable example*, never a hardcoded assumption.
// The system ships populated so it's usable on day one, but every instrument,
// session, condition, confluence, strategy, mistake, emotion and question can
// be renamed, added to, archived or deleted. Nothing is methodology-specific
// beyond the removable samples — the journal is designed to become the user's
// own over years, not any mentor's.

// Account types are labels for organization + analytics (no broker connection).
export const ACCOUNT_TYPES = ["Backtesting", "Replay", "Demo", "Live", "Evaluation", "Funded"];
export const ACCOUNT_STATUSES = ["Active", "Passed", "Failed", "Breached", "Paused", "Archived"];

// Instruments carry a generic value model so risk/RR/PnL work for forex,
// metals, indices or futures: `valuePerPipPerLot` = money per `pipSize` move
// per 1.0 lot. Users correct these to match their broker.
export const DEFAULT_INSTRUMENTS = [
  { symbol: "EURUSD", pipSize: 0.0001, valuePerPipPerLot: 10, decimals: 5 },
  { symbol: "GBPUSD", pipSize: 0.0001, valuePerPipPerLot: 10, decimals: 5 },
  { symbol: "USDJPY", pipSize: 0.01, valuePerPipPerLot: 9.1, decimals: 3 },
  { symbol: "XAUUSD", pipSize: 0.1, valuePerPipPerLot: 10, decimals: 2 },
  { symbol: "NAS100", pipSize: 1, valuePerPipPerLot: 1, decimals: 2 },
  { symbol: "US30", pipSize: 1, valuePerPipPerLot: 1, decimals: 2 },
];

// Sessions have windows in 24h local (platform) time — the trade's time is
// matched against them to auto-select session(s) and detect overlaps.
export const DEFAULT_SESSIONS = [
  { name: "Asian", start: "01:00", end: "10:00" },
  { name: "London", start: "10:00", end: "17:00" },
  { name: "New York", start: "15:00", end: "24:00" },
];

export const DEFAULT_CONDITIONS = [
  "Trending", "Ranging", "Expansion", "Distribution", "Accumulation",
  "Manipulation", "High Volatility", "Low Volatility", "High Impact News", "Low Liquidity",
];

export const DEFAULT_CONFLUENCES = [
  "Structure", "Liquidity", "HTF Bias", "BOS", "MSS", "Trendline",
  "EMA", "VWAP", "Volume", "Session", "SMT", "Supply", "Demand", "Order Flow",
];

// The ONLY default strategy — with an empty rule set the user fills in. Every
// strategy is versioned so it can evolve without losing old-version analytics.
export const DEFAULT_STRATEGIES = [
  {
    name: "Press 'N' Play",
    activeVersion: 1,
    versions: [{ version: 1, notes: "", rules: "", confluences: [], checklist: [], createdAt: null }],
  },
];

export const DEFAULT_MISTAKES = [
  "Early Entry", "Late Entry", "Revenge Trading", "FOMO", "Ignored HTF",
  "Ignored News", "Closed Early", "Over Risked", "Moved Stop", "Forced Trade",
];

// Psychology: pre-trade ratings, in-trade emotions (multi-select), post-trade.
export const PSYCH_BEFORE = ["Confidence", "Focus", "Patience", "Fear", "Stress", "Discipline"];
export const DEFAULT_EMOTIONS = [
  "Calm", "Confident", "Patient", "Disciplined", "Anxious", "Fearful",
  "Greedy", "Impatient", "Frustrated", "Revengeful", "Bored", "Overconfident",
];

export const DEFAULT_REFLECTION_QUESTIONS = [
  "What did this trade teach me?",
  "Would I take this trade again?",
  "Did I follow my plan?",
  "Did emotions interfere?",
  "What would the professional version of me have done?",
];

// Structured-review rating dimensions (1–10 each).
export const REVIEW_FIELDS = [
  "Execution", "Discipline", "Confidence", "Patience",
  "Emotional Control", "Rule Adherence", "Risk Management", "Trade Quality",
];

// Entry-timeframe suggestions (editable dropdown in the form).
export const DEFAULT_TIMEFRAMES = ["Daily", "H4", "H1", "M30", "M15", "M5", "M1"];

// Media slots — categorized chart uploads / links.
export const MEDIA_CATEGORIES = ["HTF Chart", "MTF Chart", "LTF Chart", "Entry Chart", "Exit Chart", "Replay", "Other"];

// Reminder scopes — a reminder shows automatically when its scope matches the
// trade being logged (global always; strategy/pair/session/account by match).
export const REMINDER_SCOPES = ["global", "strategy", "pair", "session", "account"];
