// ── Layer 1 for Kaizen: a localStorage-backed Db ─────────────────────
// The vendored habit-tracker `logic/` is storage-agnostic — it depends only
// on the `Db` interface in logic/dbTypes.ts, never on SQL or a Worker. The
// original ships a SQLite-WASM Db; this is the same interface implemented over
// localStorage, so the whole pure domain runs unchanged inside Kaizen.
//
// Storage model. Three arrays and a meta object, each one `architect:` key:
//   architect:ht_habits    Habit[]
//   architect:ht_entries   Entry[]
//   architect:ht_routines  Routine[]
//   architect:ht_meta      { [key]: string }
// Kaizen's sync engine mirrors every `architect:` key to the cloud with
// last-write-wins per key, so one blob per table is exactly the granularity
// the rest of the app already uses (journal, purity, nutrition all store an
// array under one key). That is why this Db can hard-delete rows instead of
// carrying the original's tombstone + sync-queue machinery: cross-device
// convergence happens at the blob level, one layer up, not per row.
//
// Every method is async to honour the Db contract (the original crosses a
// Worker boundary); here the awaits resolve synchronously off localStorage.
import { writeStore } from "../../shared/useStorageState.js";
import {
  ValidationError, NotFoundError, ConfirmationRequiredError, IllegalStateChangeError,
} from "./logic/errors";
import { assertDateString } from "./logic/dbDates";

const K_HABITS = "ht_habits";
const K_ENTRIES = "ht_entries";
const K_ROUTINES = "ht_routines";
const K_META = "ht_meta";
const PREFIX = "architect:";

const uuid = () =>
  (crypto?.randomUUID ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      }));
const stamp = () => new Date().toISOString();
const pad2 = (n) => String(n).padStart(2, "0");
const localDateStr = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

// Synchronous read straight off localStorage; the value is always an array or
// object we own, so a corrupt record falls back to the empty default rather
// than throwing mid-render.
function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    if (Array.isArray(fallback)) return Array.isArray(parsed) ? parsed.filter((x) => x != null) : fallback;
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch { return fallback; }
}
// Write-through the same path a useStorageState setter uses: disk + meta stamp
// + in-tab broadcast + sync push. Mounted hooks on the same key update live.
function write(key, value) { writeStore(key, value); }

// ── Validation (mirrors the SQLite Repository, kept as the authority) ─
const FREQUENCY_TYPES = ["daily", "specific_days", "times_per_week", "times_per_month"];

function assertName(field, value) {
  if (typeof value !== "string" || !value.trim()) {
    throw new ValidationError(field, value, "is required and cannot be blank");
  }
  return value;
}

function assertEntryValue(value) {
  if (typeof value !== "number") throw new ValidationError("value", value, "must be a number");
  if (Number.isNaN(value)) throw new ValidationError("value", value, "must be a number, and NaN is not one");
  if (!Number.isFinite(value)) throw new ValidationError("value", value, "must be finite — Infinity cannot be summed or averaged");
  if (value < 0) throw new ValidationError("value", value, "must not be negative — a day not done is 0, and an unlogged day has no row at all");
  return value;
}

function validateHabitShape(h) {
  if (h.type !== "boolean" && h.type !== "numeric") {
    throw new ValidationError("type", h.type, "must be 'boolean' or 'numeric'");
  }
  if (h.targetDirection !== "at_least" && h.targetDirection !== "at_most") {
    throw new ValidationError("targetDirection", h.targetDirection, "must be 'at_least' or 'at_most'");
  }
  if (h.type === "numeric") {
    if (h.target == null) throw new ValidationError("target", h.target, "numeric habits require a target");
    if (typeof h.target !== "number" || Number.isNaN(h.target)) throw new ValidationError("target", h.target, "must be a number");
  } else {
    if (h.target != null) throw new ValidationError("target", h.target, "boolean habits must not have a target");
    if (h.unit != null) throw new ValidationError("unit", h.unit, "boolean habits must not have a unit");
  }
  if (!FREQUENCY_TYPES.includes(h.frequencyType)) {
    throw new ValidationError("frequencyType", h.frequencyType, `must be one of ${FREQUENCY_TYPES.join(", ")}`);
  }
  if (h.frequencyType === "specific_days") {
    const d = h.frequencyDays;
    const ok = Array.isArray(d) && d.length >= 1
      && d.every((x) => Number.isInteger(x) && x >= 0 && x <= 6)
      && new Set(d).size === d.length;
    if (!ok) throw new ValidationError("frequencyDays", d, "specific_days requires a non-empty array of unique integers 0-6");
  } else if (h.frequencyDays != null) {
    throw new ValidationError("frequencyDays", h.frequencyDays, "must be null unless frequencyType is 'specific_days'");
  }
  if (h.frequencyType === "times_per_week" || h.frequencyType === "times_per_month") {
    if (!Number.isInteger(h.frequencyCount) || h.frequencyCount < 1) {
      throw new ValidationError("frequencyCount", h.frequencyCount, `${h.frequencyType} requires an integer >= 1`);
    }
  } else if (h.frequencyCount != null) {
    throw new ValidationError("frequencyCount", h.frequencyCount, "must be null unless frequencyType is times_per_week/times_per_month");
  }
}

// ── Normalisers: guarantee the full shape regardless of what was stored ─
const normHabit = (h) => ({
  id: String(h.id),
  name: String(h.name),
  icon: h.icon ?? null,
  question: h.question ?? null,
  type: h.type,
  unit: h.unit ?? null,
  target: h.target == null ? null : Number(h.target),
  targetDirection: h.targetDirection ?? "at_least",
  frequencyType: h.frequencyType,
  frequencyDays: h.frequencyDays == null ? null : h.frequencyDays.map(Number),
  frequencyCount: h.frequencyCount == null ? null : Number(h.frequencyCount),
  routineId: h.routineId ?? null,
  sortOrder: Number(h.sortOrder ?? 0),
  color: h.color ?? null,
  reminderTime: h.reminderTime ?? null,
  archivedAt: h.archivedAt ?? null,
  createdAt: String(h.createdAt),
  updatedAt: String(h.updatedAt),
});
const normRoutine = (r) => ({
  id: String(r.id),
  name: String(r.name),
  icon: r.icon ?? null,
  sortOrder: Number(r.sortOrder ?? 0),
  archivedAt: r.archivedAt ?? null,
  createdAt: String(r.createdAt),
  updatedAt: String(r.updatedAt),
});
const normEntry = (e) => ({
  id: String(e.id),
  habitId: String(e.habitId),
  date: String(e.date),
  value: Number(e.value),
  note: e.note ?? null,
  createdAt: String(e.createdAt),
  updatedAt: String(e.updatedAt),
});

// ── Wire format (snake_case) ↔ domain (camelCase) ────────────────────
// exportRows/importData speak the same column names the original SQLite app
// wrote to its backup files, so a backup from either app imports into the
// other. Internally everything else stays camelCase domain objects.
const habitToRow = (h) => ({
  id: h.id, name: h.name, icon: h.icon, question: h.question, type: h.type, unit: h.unit,
  target: h.target, target_direction: h.targetDirection, frequency_type: h.frequencyType,
  frequency_days: h.frequencyDays == null ? null : JSON.stringify(h.frequencyDays),
  frequency_count: h.frequencyCount, routine_id: h.routineId, sort_order: h.sortOrder,
  color: h.color, reminder_time: h.reminderTime, archived_at: h.archivedAt,
  created_at: h.createdAt, updated_at: h.updatedAt,
});
const rowToHabit = (r) => normHabit({
  id: r.id, name: r.name, icon: r.icon, question: r.question, type: r.type, unit: r.unit,
  target: r.target, targetDirection: r.target_direction, frequencyType: r.frequency_type,
  frequencyDays: r.frequency_days == null ? null
    : (typeof r.frequency_days === "string" ? JSON.parse(r.frequency_days) : r.frequency_days),
  frequencyCount: r.frequency_count, routineId: r.routine_id, sortOrder: r.sort_order,
  color: r.color, reminderTime: r.reminder_time, archivedAt: r.archived_at,
  createdAt: r.created_at, updatedAt: r.updated_at,
});
const routineToRow = (r) => ({
  id: r.id, name: r.name, icon: r.icon, sort_order: r.sortOrder,
  archived_at: r.archivedAt, created_at: r.createdAt, updated_at: r.updatedAt,
});
const rowToRoutine = (r) => normRoutine({
  id: r.id, name: r.name, icon: r.icon, sortOrder: r.sort_order,
  archivedAt: r.archived_at, createdAt: r.created_at, updatedAt: r.updated_at,
});
const entryToRow = (e) => ({
  id: e.id, habit_id: e.habitId, date: e.date, value: e.value, note: e.note,
  created_at: e.createdAt, updated_at: e.updatedAt,
});
const rowToEntry = (r) => normEntry({
  id: r.id, habitId: r.habit_id, date: r.date, value: r.value, note: r.note,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

export class LocalDb {
  constructor() {
    // Per-habit write counter, in memory. Layer 2's cache folds these into
    // its keys; bumping on any entry write or habit-row change is exactly
    // what the SQLite version's transaction-scoped counter did. In-memory is
    // sufficient because Layer 2's cache is itself in-memory per session.
    this._counters = {};
  }

  _habits() { return read(K_HABITS, []).map(normHabit); }
  _entries() { return read(K_ENTRIES, []).map(normEntry); }
  _routines() { return read(K_ROUTINES, []).map(normRoutine); }
  _meta() { return read(K_META, {}); }
  _saveHabits(a) { write(K_HABITS, a); }
  _saveEntries(a) { write(K_ENTRIES, a); }
  _saveRoutines(a) { write(K_ROUTINES, a); }
  _saveMeta(m) { write(K_META, m); }
  _bump(habitId) { if (habitId != null) this._counters[habitId] = (this._counters[habitId] || 0) + 1; }

  // ── Routines ────────────────────────────────────────────────────────
  async createRoutine(data) {
    assertName("name", data?.name);
    const ts = stamp();
    const routine = normRoutine({
      id: uuid(), name: data.name, icon: data.icon ?? null,
      sortOrder: data.sortOrder ?? 0, archivedAt: null, createdAt: ts, updatedAt: ts,
    });
    this._saveRoutines([...this._routines(), routine]);
    return routine;
  }

  async getRoutine(id) {
    const r = this._routines().find((x) => x.id === id);
    if (!r) throw new NotFoundError("routine", id);
    return r;
  }

  async listRoutines(opts = {}) {
    return this._routines()
      .filter((r) => opts.includeArchived || r.archivedAt == null)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
  }

  async updateRoutine(id, patch) {
    const all = this._routines();
    const i = all.findIndex((x) => x.id === id);
    if (i < 0) throw new NotFoundError("routine", id);
    if (patch.name !== undefined) assertName("name", patch.name);
    all[i] = normRoutine({ ...all[i], ...patch, updatedAt: stamp() });
    this._saveRoutines(all);
    return all[i];
  }

  async archiveRoutine(id) {
    const all = this._routines();
    const i = all.findIndex((x) => x.id === id);
    if (i < 0) throw new NotFoundError("routine", id);
    const ts = stamp();
    all[i] = normRoutine({ ...all[i], archivedAt: ts, updatedAt: ts });
    this._saveRoutines(all);
    this._releaseHabitsFrom(id, ts); // archiving a routine frees its habits (§5)
  }

  async deleteRoutine(id) {
    const all = this._routines();
    if (!all.some((x) => x.id === id)) throw new NotFoundError("routine", id);
    const ts = stamp();
    this._releaseHabitsFrom(id, ts);
    this._saveRoutines(all.filter((x) => x.id !== id));
  }

  _releaseHabitsFrom(routineId, ts) {
    const all = this._habits();
    let changed = false;
    for (const h of all) {
      if (h.routineId === routineId) { h.routineId = null; h.updatedAt = ts; changed = true; }
    }
    if (changed) this._saveHabits(all);
  }

  async reorderRoutines(orderedIds) {
    const all = this._routines();
    const byId = new Map(all.map((r) => [r.id, r]));
    for (const id of orderedIds) if (!byId.has(id)) throw new NotFoundError("routine", id);
    const ts = stamp();
    orderedIds.forEach((id, idx) => { const r = byId.get(id); r.sortOrder = idx; r.updatedAt = ts; });
    this._saveRoutines(all);
  }

  // ── Habits ──────────────────────────────────────────────────────────
  async createHabit(data) {
    assertName("name", data?.name);
    const targetDirection = data.targetDirection ?? "at_least";
    validateHabitShape({
      type: data.type, unit: data.unit ?? null, target: data.target ?? null, targetDirection,
      frequencyType: data.frequencyType, frequencyDays: data.frequencyDays ?? null,
      frequencyCount: data.frequencyCount ?? null,
    });
    if (data.routineId) await this.getRoutine(data.routineId);
    const ts = stamp();
    const habit = normHabit({
      id: uuid(), name: data.name, icon: data.icon ?? null, question: data.question ?? null,
      type: data.type, unit: data.unit ?? null, target: data.target ?? null, targetDirection,
      frequencyType: data.frequencyType, frequencyDays: data.frequencyDays ?? null,
      frequencyCount: data.frequencyCount ?? null, routineId: data.routineId ?? null,
      sortOrder: data.sortOrder ?? 0, color: data.color ?? null, reminderTime: data.reminderTime ?? null,
      archivedAt: null, createdAt: ts, updatedAt: ts,
    });
    this._saveHabits([...this._habits(), habit]);
    this._bump(habit.id);
    return habit;
  }

  async getHabit(id) {
    const h = this._habits().find((x) => x.id === id);
    if (!h) throw new NotFoundError("habit", id);
    return h;
  }

  async listHabits(opts = {}) {
    return this._habits().filter((h) => {
      if (!opts.includeArchived && h.archivedAt != null) return false;
      if (opts.routineId !== undefined) {
        if (opts.routineId === null) return h.routineId == null;
        return h.routineId === opts.routineId;
      }
      return true;
    }).sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
  }

  async updateHabit(id, patch) {
    const all = this._habits();
    const i = all.findIndex((x) => x.id === id);
    if (i < 0) throw new NotFoundError("habit", id);
    const cur = all[i];
    if (patch.type !== undefined && patch.type !== cur.type && (await this.getEntryCount(id)) > 0) {
      throw new IllegalStateChangeError("type", "cannot change a habit's type while entries exist — archive it and create a new habit instead");
    }
    if (patch.name !== undefined) assertName("name", patch.name);
    if (patch.routineId) await this.getRoutine(patch.routineId);
    const pick = (k, fb) => (patch[k] !== undefined ? patch[k] : fb);
    const shape = {
      type: pick("type", cur.type), unit: pick("unit", cur.unit), target: pick("target", cur.target),
      targetDirection: pick("targetDirection", cur.targetDirection),
      frequencyType: pick("frequencyType", cur.frequencyType),
      frequencyDays: pick("frequencyDays", cur.frequencyDays),
      frequencyCount: pick("frequencyCount", cur.frequencyCount),
    };
    validateHabitShape(shape);
    all[i] = normHabit({
      ...cur, ...shape,
      name: pick("name", cur.name), icon: pick("icon", cur.icon), question: pick("question", cur.question),
      routineId: pick("routineId", cur.routineId), sortOrder: pick("sortOrder", cur.sortOrder),
      color: pick("color", cur.color), reminderTime: pick("reminderTime", cur.reminderTime),
      updatedAt: stamp(),
    });
    this._saveHabits(all);
    this._bump(id); // frequency/target live on the row, so scores can move
    return all[i];
  }

  async archiveHabit(id) {
    const all = this._habits();
    const i = all.findIndex((x) => x.id === id);
    if (i < 0) throw new NotFoundError("habit", id);
    const ts = stamp();
    all[i] = normHabit({ ...all[i], archivedAt: ts, updatedAt: ts });
    this._saveHabits(all);
  }

  async unarchiveHabit(id) {
    const all = this._habits();
    const i = all.findIndex((x) => x.id === id);
    if (i < 0) throw new NotFoundError("habit", id);
    all[i] = normHabit({ ...all[i], archivedAt: null, updatedAt: stamp() });
    this._saveHabits(all);
  }

  async deleteHabit(id, opts = {}) {
    const all = this._habits();
    if (!all.some((x) => x.id === id)) throw new NotFoundError("habit", id);
    if (!opts.confirmed) throw new ConfirmationRequiredError("deleteHabit");
    this._saveHabits(all.filter((x) => x.id !== id));
    this._saveEntries(this._entries().filter((e) => e.habitId !== id)); // cascade
    this._bump(id);
  }

  async reorderHabits(orderedIds) {
    const all = this._habits();
    const byId = new Map(all.map((h) => [h.id, h]));
    for (const id of orderedIds) if (!byId.has(id)) throw new NotFoundError("habit", id);
    const ts = stamp();
    orderedIds.forEach((id, idx) => { const h = byId.get(id); h.sortOrder = idx; h.updatedAt = ts; });
    this._saveHabits(all);
  }

  // ── Entries ─────────────────────────────────────────────────────────
  async getEntry(habitId, date) {
    return this._entries().find((e) => e.habitId === habitId && e.date === date) ?? null;
  }

  async getEntriesForHabit(habitId, startDate, endDate) {
    assertDateString("startDate", startDate);
    assertDateString("endDate", endDate);
    return this._entries()
      .filter((e) => e.habitId === habitId && e.date >= startDate && e.date <= endDate)
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getEntriesForDate(date) {
    assertDateString("date", date);
    return this._entries().filter((e) => e.date === date).sort((a, b) => a.habitId.localeCompare(b.habitId));
  }

  async getEntriesForHabits(habitIds, startDate, endDate) {
    assertDateString("startDate", startDate);
    assertDateString("endDate", endDate);
    if (!habitIds.length) return [];
    const set = new Set(habitIds);
    return this._entries()
      .filter((e) => set.has(e.habitId) && e.date >= startDate && e.date <= endDate)
      .sort((a, b) => a.habitId.localeCompare(b.habitId) || a.date.localeCompare(b.date));
  }

  async setEntry(habitId, date, value, note = null) {
    await this.getHabit(habitId); // NotFoundError if the habit is gone
    assertDateString("date", date);
    assertEntryValue(value);
    const all = this._entries();
    const i = all.findIndex((e) => e.habitId === habitId && e.date === date);
    const ts = stamp();
    let entry;
    if (i >= 0) {
      entry = normEntry({ ...all[i], value, note, updatedAt: ts });
      all[i] = entry;
    } else {
      entry = normEntry({ id: uuid(), habitId, date, value, note, createdAt: ts, updatedAt: ts });
      all.push(entry);
    }
    this._saveEntries(all);
    this._bump(habitId);
    return entry;
  }

  async deleteEntry(habitId, date) {
    assertDateString("date", date);
    const all = this._entries();
    const next = all.filter((e) => !(e.habitId === habitId && e.date === date));
    if (next.length === all.length) return; // nothing logged that day
    this._saveEntries(next);
    this._bump(habitId);
  }

  async getFirstEntryDate(habitId) {
    let min = null;
    for (const e of this._entries()) {
      if (e.habitId === habitId && (min == null || e.date < min)) min = e.date;
    }
    return min;
  }

  async getFirstEntryDates(habitIds) {
    if (!habitIds.length) return {};
    const set = new Set(habitIds);
    const out = {};
    for (const e of this._entries()) {
      if (!set.has(e.habitId)) continue;
      if (out[e.habitId] == null || e.date < out[e.habitId]) out[e.habitId] = e.date;
    }
    return out;
  }

  async getEntryCount(habitId) {
    let n = 0;
    for (const e of this._entries()) if (e.habitId === habitId) n++;
    return n;
  }

  // ── Settings & utility ──────────────────────────────────────────────
  async getDayStartHour() {
    const v = this._meta().day_start_hour;
    return v == null ? 4 : parseInt(String(v), 10);
  }

  async setDayStartHour(hour) {
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      throw new ValidationError("dayStartHour", hour, "must be an integer from 0 to 23");
    }
    await this.setMeta("day_start_hour", String(hour));
  }

  async getMeta(key) {
    const v = this._meta()[key];
    return v == null ? null : String(v);
  }

  async setMeta(key, value) {
    this._saveMeta({ ...this._meta(), [key]: value });
  }

  async getToday() {
    const dayStartHour = await this.getDayStartHour();
    const instant = new Date();
    const effective = new Date(instant);
    if (instant.getHours() < dayStartHour) effective.setDate(effective.getDate() - 1);
    return localDateStr(effective);
  }

  async getStorageInfo() {
    return {
      vfsName: "localStorage",
      files: [PREFIX + K_HABITS, PREFIX + K_ENTRIES, PREFIX + K_ROUTINES],
      persisted: true,
      persistRequested: false,
      counts: {
        habits: this._habits().length,
        routines: this._routines().length,
        entries: this._entries().length,
      },
      evicted: null,
    };
  }

  // ── Backup ──────────────────────────────────────────────────────────
  async exportRows() {
    const meta = this._meta();
    return {
      routines: this._routines().map(routineToRow),
      habits: this._habits().map(habitToRow),
      entries: this._entries().map(entryToRow),
      meta: Object.keys(meta).filter((k) => k === "day_start_hour").map((k) => ({ key: k, value: String(meta[k]) })),
    };
  }

  async importData(rows, opts) {
    if (opts.mode === "replace" && !opts.confirmed) {
      throw new ConfirmationRequiredError("importData in replace mode");
    }
    const counts = { routines: 0, habits: 0, entries: 0, skipped: 0, cleared: false };
    let routines = opts.mode === "replace" ? [] : this._routines();
    let habits = opts.mode === "replace" ? [] : this._habits();
    let entries = opts.mode === "replace" ? [] : this._entries();
    if (opts.mode === "replace") counts.cleared = true;

    const merge = (list, incoming, rowTo, key) => {
      const byId = new Map(list.map((x) => [x.id, x]));
      for (const raw of incoming || []) {
        const row = rowTo(raw);
        const local = byId.get(row.id);
        if (opts.mode === "merge" && local && String(local.updatedAt) >= String(row.updatedAt)) {
          counts.skipped++;
          continue;
        }
        byId.set(row.id, row);
        counts[key]++;
      }
      return [...byId.values()];
    };
    routines = merge(routines, rows.routines, rowToRoutine, "routines");
    habits = merge(habits, rows.habits, rowToHabit, "habits");
    entries = merge(entries, rows.entries, rowToEntry, "entries");

    this._saveRoutines(routines);
    this._saveHabits(habits);
    this._saveEntries(entries);
    const meta = { ...this._meta() };
    for (const { key, value } of rows.meta || []) { if (key !== "schema_version") meta[key] = value; }
    this._saveMeta(meta);
    this._counters = {}; // every habit's arithmetic may have moved
    return counts;
  }

  async getExportTimestamp() { return stamp(); }

  async getWriteCounters() { return { ...this._counters }; }

  // ── Sync facts (Layer 1b §8). Blob-level sync lives one layer up. ────
  async getSyncState() { return "synced"; }
  async getPendingCount() { return 0; }

  // ── Test-only seams (the ported logic tests exercise these) ─────────
  async __rowCounts() {
    return { habits: this._habits().length, routines: this._routines().length, entries: this._entries().length };
  }
  async __dumpEntries() {
    return this._entries().sort((a, b) => a.habitId.localeCompare(b.habitId) || a.date.localeCompare(b.date));
  }
  async runTransaction(ops) {
    // No real transaction over localStorage, but the callers that use this
    // batch independent writes; run them in order and collect results.
    const out = [];
    for (const op of ops) {
      const fn = this[op.method];
      if (typeof fn !== "function" || op.method.startsWith("__") || op.method === "runTransaction") {
        throw new ValidationError("method", op.method, "is not a transactable repository method");
      }
      out.push(await fn.apply(this, op.args));
    }
    return out;
  }
}

// One process-wide instance — the whole app shares a single localStorage.
export const db = new LocalDb();

// ── Sync-pull notification (Layer 2b §6 wiring) ──────────────────────
// A cloud pull can rewrite ht_* rows for habits whose in-memory write counter
// never moved, so Layer 2's memo cache must be dropped when one lands. Kaizen's
// sync engine applies remote rows through applyExternal(), which dispatches an
// `architect:kv` event with origin "remote". We forward exactly those (for our
// keys) to subscribers; local writes (origin "writeStore") already reload.
const HT_KEYS = new Set([K_HABITS, K_ENTRIES, K_ROUTINES, K_META]);
const pullSubs = new Set();
export function onSyncPull(fn) {
  pullSubs.add(fn);
  return () => pullSubs.delete(fn);
}
if (typeof window !== "undefined" && window.addEventListener) {
  window.addEventListener("architect:kv", (e) => {
    const d = e.detail;
    if (!d || d.origin !== "remote" || !HT_KEYS.has(d.key)) return;
    db._counters = {}; // a remote row for any habit invalidates every memo
    pullSubs.forEach((fn) => { try { fn(); } catch { /* subscriber error is not ours */ } });
  });
}
