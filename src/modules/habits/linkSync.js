// ── Runtime for linked metrics ───────────────────────────────────────
// linkedMetrics.js is pure — it decides what SHOULD happen. This file is the
// part that touches storage: it registers the Db's entry hook, mirrors a
// habit tick into the metric's canonical store, and runs the reverse pass
// that turns hours and millilitres already recorded elsewhere into habit
// entries.
//
// Re-entrancy. Mirroring writes stores; reverse-syncing writes habit entries,
// which fires the hook, which would mirror again. Two things stop the loop:
// planMirror returns null when nothing would change, and `busy` suppresses
// the hook for the duration of a reverse pass.
import { writeStore } from "../../shared/useStorageState.js";
import { db } from "./localDb.js";
import { setEntryHook } from "./localDb.js";
import {
  METRICS, LINK_WRITES_KEY, resolveLinks, metricById, readEntry,
  planMirror, reverseEntries, claimDays, sanitizeLinkWrites,
} from "./linkedMetrics.js";

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

const pad2 = (n) => String(n).padStart(2, "0");
const dstr = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const back = (today, n) => { const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() - n); return dstr(d); };

/**
 * The metric's day-by-day map, whatever shape its stores are in.
 * A map store (trade_sleep, hydration_log) is read straight through. A list
 * store (workouts, gym sessions) collapses to one row per day it happened on,
 * and nutrition_log to one row per day anything was eaten — which is all a
 * "did this happen today" link needs to know.
 */
function canonicalFor(metric) {
  if (!metric.readOnly) return read(metric.store, {});
  const out = {};
  for (const key of metric.stores) {
    const raw = read(key, key === "nutrition_log" ? {} : []);
    if (Array.isArray(raw)) {
      for (const r of raw) {
        const d = typeof r?.date === "string" ? r.date.slice(0, 10) : null;
        if (d) out[d] = 1;
      }
    } else {
      for (const [d, v] of Object.entries(raw)) {
        if (Array.isArray(v) && v.length) out[d] = 1;
      }
    }
  }
  return out;
}

let busy = false;

const state = () => ({
  habits: read("ht_habits", []),
  entries: read("ht_entries", []),
  meta: read("ht_meta", {}),
  writes: sanitizeLinkWrites(read(LINK_WRITES_KEY, {})),
});

/** The habit standing for a metric right now, or null. */
export function linkedHabit(metricId, snap = state()) {
  const id = resolveLinks(snap.habits, snap.meta)[metricId];
  return id ? snap.habits.find((h) => h && h.id === id) || null : null;
}

/** Which metric this habit is linked to, or null. */
function metricForHabit(habitId, snap) {
  const links = resolveLinks(snap.habits, snap.meta);
  for (const [metricId, id] of Object.entries(links)) if (id === habitId) return metricById(metricId);
  return null;
}

/**
 * habit → canonical. `value` is the new entry value, or null when the day's
 * entry was removed. Silent no-op for habits that aren't linked, which is
 * almost all of them, so the hook stays cheap on the common path.
 */
export function mirrorHabitEntry(habitId, date, value) {
  if (busy) return;
  const snap = state();
  const metric = metricForHabit(habitId, snap);
  if (!metric || metric.readOnly) return;
  const habit = snap.habits.find((h) => h && h.id === habitId);
  const reading = value == null ? null : readEntry(metric, habit, value);
  const plan = planMirror(metric, read(metric.store, {}), snap.writes, date, reading);
  if (!plan) return;
  writeStore(metric.store, plan.canonical);
  writeStore(LINK_WRITES_KEY, plan.writes);
}

/**
 * canonical → habit, over the last `days` days. Runs at boot and whenever a
 * canonical store changes, so hours typed into the trading module or a
 * beverage logged as food show up on the habit that stands for them.
 * Returns the number of entries written.
 */
export async function reconcileLinks({ today = dstr(new Date()), days = 60 } = {}) {
  const snap = state();
  const dates = Array.from({ length: days }, (_, i) => back(today, days - 1 - i));
  const plan = [];
  for (const metric of METRICS) {
    const habit = linkedHabit(metric.id, snap);
    if (!habit) continue;
    plan.push(...reverseEntries({
      metric, habit, canonical: canonicalFor(metric), writes: snap.writes, dates, entries: snap.entries,
    }));
  }
  if (!plan.length) return 0;
  busy = true;
  try {
    for (const { habitId, date, value } of plan) {
      try { await db.setEntry(habitId, date, value); } catch { /* habit vanished mid-pass */ }
    }
  } finally { busy = false; }
  return plan.length;
}

/** Claim maps per metric, for the wellbeing series. { sleep: {date:bool}, … } */
export function linkedClaims(snap = state()) {
  const out = {};
  for (const metric of METRICS) {
    const habit = linkedHabit(metric.id, snap);
    if (!habit) continue;
    const days = claimDays({ metric, habit, entries: snap.entries });
    if (Object.keys(days).length) out[metric.id] = days;
  }
  return out;
}

/** Registers the Db hook. Idempotent; safe to call on every boot. */
export function installLinkSync() {
  setEntryHook(mirrorHabitEntry);
}
