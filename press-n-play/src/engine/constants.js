// ── PRESS 'N' PLAY vocabulary ────────────────────────────────────────
// The option lists the charts group by. Taken verbatim from the Notion
// Trade Journal so a value logged there means the same thing here.
//
// These are fixed, not user-editable libraries, because every one of them
// is a *chart axis*. A user-added "Setup Grade" of "A++" would silently
// create a bucket of one that no threshold could ever validate. The
// editable libraries (instruments, sessions, confluences, strategies) stay
// where they already live, in ti_* stores.

export const SETUP_GRADES = ["A+", "A", "B", "C", "Invalid"];

export const MANAGEMENT_STYLES = ["Set & Forget", "Active Management", "Hybrid"];

/** The 13 process rules. Rule Adherence % is ticked ÷ 13. */
export const RULE_CHECKLIST = [
  "Correct Session",
  "Correct Setup",
  "Correct Market Conditions",
  "HTF Bias Confirmed",
  "Liquidity Confirmed",
  "Entry Confirmation Present",
  "Risk Within Limits",
  "SL Correctly Placed",
  "TP Planned",
  "No FOMO",
  "No Revenge",
  "No Overtrading",
  "Taken Within Trading Plan",
];

/** The state you entered in. Chart 34 sums R against these. */
export const PRE_TRADE_FLAGS = [
  "FOMO", "Revenge", "Boredom", "Impatience", "Fear",
  "Greed", "Overconfidence", "Hesitation", "Chasing", "Forced Setup",
];

/**
 * The two flags the spec singles out: "Given how the last accounts went,
 * Revenge and FOMO are the two bars to watch. If either is deeply
 * negative, that is a hard stand-down rule — not a thing to manage
 * better." The stand-down gate reads this list.
 */
export const TILT_FLAGS = ["Revenge", "FOMO"];

export const WICK_OUT_CLASSES = [
  "SL Too Tight",
  "Poor SL Placement",
  "Correct Invalidation",
  "Normal Volatility",
  "News Volatility",
  "Spread/Execution Issue",
  "Early Entry",
  "Incorrect Setup",
  "Unknown",
];

/**
 * Of these, only the first two are fixable by changing stop placement.
 * "Correct Invalidation" is the system working — the spec is explicit
 * that those should be left alone.
 */
export const FIXABLE_WICK_OUTS = ["SL Too Tight", "Poor SL Placement"];

export const LOSS_CAUSES = [
  "Strategy", "Execution", "Management", "Psychology",
  "Market Randomness", "Unknown", "N/A (Win)",
];

/**
 * "Market Randomness is an acceptable slice. Psychology and Execution are
 * not — those are the ones that end accounts."
 */
export const SELF_INFLICTED_CAUSES = ["Psychology", "Execution"];

export const MISSED_R_REASONS = [
  "Early Exit", "Partial Close", "Premature Management",
  "SL Movement", "After Wick-Out", "Other", "None (Planned)",
];

export const YES_NO = ["Yes", "No"];
export const YES_NO_NA = ["Yes", "No", "N/A"];

// ── Sample-size thresholds (spec §8) ─────────────────────────────────
// "An invented pattern is worse than no pattern, because you would trade
// on it." These drive every chart's confidence state.
export const SAMPLE_NONE = 20;   // below this: say nothing
export const SAMPLE_HINT = 50;   // below this: directional only
