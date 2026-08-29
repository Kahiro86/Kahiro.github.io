// ── Gate 1 · Discipline migration ────────────────────────────────────
// Purity and Journal are already habits — a daily binary with a streak, and a
// daily binary with attached text. This maps them onto the habit engine as
// subtypes so scheduling, scoring, streaks and the calendar all run through
// ONE engine (spec §3.2), instead of three parallel implementations.
//
// Non-negotiable 3 — no data loss, migrate never re-key:
//   · every purity day becomes an entry on its ORIGINAL date (pure → 1,
//     relapse → 0, which is exactly the tracker's tri-state)
//   · every journal entry becomes an entry on its ORIGINAL date
//   · purity_log and journal_entries are left completely untouched. They stay
//     the source of truth for CONTENT (triggers, reflections, text, mood) and
//     double as an untouched safety copy. Only the completion signal moves.
//
// Idempotent: keyed on a per-source date set, so re-running adds nothing and
// a day logged after the migration is never duplicated or overwritten.
import { localDateStr } from "../../shared/dates.js";

export const PURITY_HABIT_ID = "sys_purity";
export const JOURNAL_HABIT_ID = "sys_journal";
const PREFIX = "architect:";
// Ids of pinned system habits already created once, so archiving or deleting
// one is the user's decision and boot does not undo it.
const PINNED_KEY = "kahiro_discipline_pinned";

const readKey = (k, fb) => {
  try {
    const raw = localStorage.getItem(PREFIX + k);
    if (raw == null) return fb;
    const v = JSON.parse(raw);
    if (Array.isArray(fb)) return Array.isArray(v) ? v.filter((x) => x != null) : fb;
    return v && typeof v === "object" ? v : fb;
  } catch { return fb; }
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const iso = (ds) => `${ds}T12:00:00.000Z`;

function systemHabit(id, name, icon, subtype, question, createdDate) {
  return {
    id, name, subtype, icon, question,
    type: "boolean", unit: null, target: null, targetDirection: "at_least",
    frequencyType: "daily", frequencyDays: null, frequencyCount: null,
    routineId: null, sortOrder: subtype === "abstinence" ? -2 : -1,
    color: null, reminderTime: null, archivedAt: null,
    createdAt: iso(createdDate), updatedAt: iso(createdDate),
  };
}

/**
 * Pure planner: given the current stores, returns the habits to add, the
 * entries to add, and a count report. Writes nothing — so it can be tested,
 * and so a dry run can report before anything changes.
 */
export function planDisciplineMigration({ purity, journal, htHabits, htEntries, everPinned = [] }) {
  const habits = Array.isArray(htHabits) ? htHabits : [];
  const entries = Array.isArray(htEntries) ? htEntries : [];
  const addHabits = [];
  const addEntries = [];
  const fixEntries = [];
  const report = { purityDays: 0, purityPure: 0, purityRelapse: 0, journalEntries: 0,
                   skippedDays: 0, alreadyPresent: 0, corrected: 0, habitsCreated: 0 };

  // Dates already carried for each system habit, WITH their values. The
  // idempotency key used to be the date alone, which made the migration blind
  // to a correction: a day flipped from clean to relapse in the Purity screen
  // was "already present", so nothing updated and XP kept paying for the claim
  // the user had retracted. Keying on the value catches that.
  const seen = (habitId) => {
    const m = new Map();
    for (const e of entries) if (e && e.habitId === habitId) m.set(String(e.date).slice(0, 10), e);
    return m;
  };

  // ── Purity → abstinence subtype ──────────────────────────────────
  const pLog = purity && typeof purity === "object" && !Array.isArray(purity) ? purity : {};
  const pDates = Object.keys(pLog).filter((d) => DATE_RE.test(d) && (pLog[d]?.s === "pure" || pLog[d]?.s === "relapse")).sort();
  {
    const have = seen(PURITY_HABIT_ID);
    // The pinned row exists for everyone, data or not — a fresh user still
    // needs somewhere to claim a clean day (spec §3.1). `everPinned` means a
    // habit the user later archived or deleted is not resurrected on boot.
    if (!habits.some((h) => h.id === PURITY_HABIT_ID) && !everPinned.includes(PURITY_HABIT_ID)) {
      addHabits.push(systemHabit(PURITY_HABIT_ID, "Purity", "🌿", "abstinence", "Did you stay clean today?", pDates[0] || localDateStr()));
      report.habitsCreated++;
    }
    for (const d of pDates) {
      const s = pLog[d].s;
      const want = s === "pure" ? 1 : 0;
      if (s === "pure") report.purityPure++; else report.purityRelapse++;
      report.purityDays++;
      const existing = have.get(d);
      if (existing) {
        if (Number(existing.value) === want) { report.alreadyPresent++; continue; }
        // Present but disagreeing: purity_log is the authority on what the day
        // was, so the tracker entry is corrected rather than duplicated.
        fixEntries.push({ ...existing, value: want, updatedAt: new Date().toISOString() });
        report.corrected++;
        continue;
      }
      addEntries.push({ id: `mig_p_${d}`, habitId: PURITY_HABIT_ID, date: d,
        value: want, note: null, createdAt: iso(d), updatedAt: iso(d) });
    }
  }

  // ── Journal → journal subtype ────────────────────────────────────
  const jList = Array.isArray(journal) ? journal.filter((e) => e && e.id) : [];
  const jDates = [...new Set(jList.map((e) => (e.date || "").slice(0, 10)).filter((d) => DATE_RE.test(d)))].sort();
  {
    const have = seen(JOURNAL_HABIT_ID);
    if (!habits.some((h) => h.id === JOURNAL_HABIT_ID) && !everPinned.includes(JOURNAL_HABIT_ID)) {
      addHabits.push(systemHabit(JOURNAL_HABIT_ID, "Journal", "📓", "journal", "Did you write today?", jDates[0] || localDateStr()));
      report.habitsCreated++;
    }
    report.journalEntries = jList.length;
    for (const d of jDates) {
      // Journal has no value to disagree about — an entry exists or it does
      // not — so the date remains the whole key here.
      if (have.has(d)) { report.alreadyPresent++; continue; }
      addEntries.push({ id: `mig_j_${d}`, habitId: JOURNAL_HABIT_ID, date: d,
        value: 1, note: null, createdAt: iso(d), updatedAt: iso(d) });
    }
  }

  // ── §3.6 skipped days ────────────────────────────────────────────
  // The legacy habit engine had a streak-safe skip (log[ds].s === true). If any
  // survive in the old `habits` store they must be preserved, not converted.
  const legacy = readKeySafe("habits");
  for (const h of legacy) {
    for (const [d, e] of Object.entries(h?.log || {})) {
      if (DATE_RE.test(d) && e && e.s === true) report.skippedDays++;
    }
  }

  return { addHabits, addEntries, fixEntries, report };
}

function readKeySafe(k) { try { return readKey(k, []); } catch { return []; } }

/**
 * Runs the migration against localStorage. Safe to call on every boot: it
 * plans first and writes only what is genuinely missing.
 */
export function runDisciplineMigration(writeFn) {
  let everPinned = [];
  try { everPinned = JSON.parse(localStorage.getItem(PINNED_KEY) || "[]"); } catch { everPinned = []; }
  if (!Array.isArray(everPinned)) everPinned = [];
  const plan = planDisciplineMigration({
    purity: readKey("purity_log", {}),
    journal: readKey("journal_entries", []),
    htHabits: readKey("ht_habits", []),
    htEntries: readKey("ht_entries", []),
    everPinned,
  });
  if (!plan.addHabits.length && !plan.addEntries.length && !plan.fixEntries.length) return plan.report;

  if (plan.addHabits.length) {
    writeFn("ht_habits", [...readKey("ht_habits", []), ...plan.addHabits]);
    try {
      const ids = [...new Set([...everPinned, ...plan.addHabits.map((h) => h.id)])];
      localStorage.setItem(PINNED_KEY, JSON.stringify(ids));
    } catch { /* best effort */ }
  }
  if (plan.addEntries.length || plan.fixEntries.length) {
    const fixById = new Map(plan.fixEntries.map((e) => [e.id, e]));
    const current = readKey("ht_entries", []).map((e) => (e && fixById.has(e.id) ? fixById.get(e.id) : e));
    writeFn("ht_entries", [...current, ...plan.addEntries]);
  }
  try { localStorage.setItem("kahiro_discipline_migrated", localDateStr()); } catch { /* best effort */ }
  return plan.report;
}
