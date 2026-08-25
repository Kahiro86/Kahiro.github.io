// ── One-time: open the ledger with the historical total intact ───────
// Criterion 21 — existing XP is preserved through the revamp. The ledger's
// opening balance is that historical number, written once.
//
// This runs at boot, before React, and only when the ledger has no opening
// row yet. The frozen engine it needs is imported dynamically, so a migrated
// user never downloads it.
import { LEDGER_KEY, sanitizeLedger, openLedger } from "./ledger.js";

const PREFIX = "architect:";
const read = (k, fb) => {
  try {
    const raw = localStorage.getItem(PREFIX + k);
    if (raw == null) return fb;
    const v = JSON.parse(raw);
    if (Array.isArray(fb)) return Array.isArray(v) ? v : fb;
    return v && typeof v === "object" ? v : fb;
  } catch { return fb; }
};

/**
 * @param writeFn same writer every store uses, so the ledger lands on the
 *        normal sync path rather than being written behind its back.
 * @returns { opened, xp } — what happened, for the caller to log or ignore.
 */
export async function openLedgerWithHistory(writeFn) {
  const existing = sanitizeLedger(read(LEDGER_KEY, null));
  if (existing.opening) return { opened: false, xp: existing.opening.xp };

  // Nothing on disk to carry forward: a genuinely new user opens at zero,
  // and there is no reason to pull the frozen engine in for them.
  const hasHistory = ["ht_entries", "habits", "purity_log", "journal_entries", "athlete_workouts",
    "gym_sessions", "nutrition_log", "ict_trades", "ti_trades", "faith_scripture", "mind_decisions"]
    .some((k) => { const v = read(k, null); return Array.isArray(v) ? v.length > 0 : v && Object.keys(v).length > 0; });
  if (!hasHistory) {
    const { ledger } = openLedger(existing, 0);
    writeFn(LEDGER_KEY, ledger);
    return { opened: true, xp: 0 };
  }

  const { legacyDerivedTotal } = await import("./legacyTotal.js");
  const total = legacyDerivedTotal({
    habits: read("habits", []), purity: read("purity_log", {}), trades: read("ict_trades", []),
    reviews: read("ict_reviews", []), workouts: read("athlete_workouts", []),
    measurements: read("athlete_measurements", []), nutrition: read("nutrition_log", {}),
    nutritionProfile: read("nutrition_profile", null), finance: read("finance_state", null),
    entries: read("journal_entries", []), missions: read("missions", []),
    church: read("faith_church", []), verses: read("faith_scripture", []),
    faithNotes: read("faith_notes", []), library: read("mind_library", []),
    mindNotes: read("mind_notes", []), decisions: read("mind_decisions", []),
    unlocked: read("xp_achievements", {}), logins: read("xp_logins", {}),
    notifLog: read("notif_log", []), goals: read("goals", []), wants: read("wants", []),
    tiTrades: read("ti_trades", []), photos: read("athlete_photos", []),
    htHabits: read("ht_habits", []), htEntries: read("ht_entries", []),
  });

  const { ledger } = openLedger(existing, total);
  writeFn(LEDGER_KEY, ledger);
  return { opened: true, xp: total };
}
