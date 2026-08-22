// ── Writers for the merged Discipline surface ────────────────────────
// Journal and Purity keep their own stores as the source of truth for
// CONTENT — the reflection text, mood, tags, triggers. The habit engine owns
// only the completion signal. These writers keep the two in step so a single
// tap on the Discipline screen updates both, and neither store is ever
// re-keyed (non-negotiable 3).
import { writeStore } from "../../shared/useStorageState.js";
import { db } from "./localDb.js";
import { JOURNAL_HABIT_ID } from "./migrateDiscipline.js";

const PREFIX = "architect:";
const read = (k, fb) => {
  try {
    const raw = localStorage.getItem(PREFIX + k);
    if (raw == null) return fb;
    const v = JSON.parse(raw);
    if (Array.isArray(fb)) return Array.isArray(v) ? v.filter((x) => x != null) : fb;
    return v && typeof v === "object" ? v : fb;
  } catch { return fb; }
};

/** Saves (or updates) the journal entry for a date. Returns the entry. */
export function saveJournalEntry(date, { text, title = "", mood = null, tags = [], stamp = {} }) {
  const list = read("journal_entries", []);
  const existing = list.find((e) => e && (e.date || "").slice(0, 10) === date && e.fromDiscipline);
  let entry;
  if (existing) {
    entry = { ...existing, title, text, mood, tags, ...stamp, editedAt: new Date().toISOString() };
    writeStore("journal_entries", list.map((e) => (e.id === existing.id ? entry : e)));
  } else {
    entry = { id: `j${Date.now()}`, date, title, text, mood, tags, fromDiscipline: true, ...stamp };
    writeStore("journal_entries", [entry, ...list]);
  }
  return entry;
}

/** The journal text already written for a date, if any. */
export function journalFor(date) {
  return read("journal_entries", []).find((e) => e && (e.date || "").slice(0, 10) === date) || null;
}

/**
 * Mirrors an abstinence claim into purity_log, so the Purity detail view's
 * triggers, reflections and risk window keep working off the same days.
 * value 1 → a clean day, 0 → a relapse, null → unlogged.
 */
export function mirrorPurityDay(date, value) {
  const log = read("purity_log", {});
  const next = { ...log };
  if (value == null) delete next[date];
  else if (value === 1) next[date] = { ...(next[date] || { triggers: [] }), s: "pure" };
  else next[date] = { ...(next[date] || { triggers: [] }), s: "relapse", t: next[date]?.t ?? new Date().getHours() };
  writeStore("purity_log", next);
}

/** Trigger tags on a relapse day (§3.4) — user-extensible, multi-select. */
export function togglePurityTrigger(date, tag) {
  const log = read("purity_log", {});
  const day = log[date];
  if (!day) return;
  const cur = Array.isArray(day.triggers) ? day.triggers : [];
  const triggers = cur.includes(tag) ? cur.filter((t) => t !== tag) : [...cur, tag];
  writeStore("purity_log", { ...log, [date]: { ...day, triggers } });
}

/**
 * Ticks the pinned Journal habit for a date. Reflect (the palette's quick
 * journal) writes content straight to journal_entries, so without this the
 * day would only appear on the Discipline list after the next boot's
 * backfill. No-op if the user removed the pinned habit — their call, not
 * something a write should undo.
 */
export function markJournalDay(date) {
  db.getHabit(JOURNAL_HABIT_ID)
    .then((h) => (h ? db.setEntry(JOURNAL_HABIT_ID, date, 1) : null))
    .catch(() => { /* content is already saved; the tick is a convenience */ });
}
