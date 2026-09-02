// ── Storage ──────────────────────────────────────────────────────────
// A localStorage-backed state hook, and the source of truth for the
// running app. Optional Supabase sync (src/sync/) mirrors these same keys
// to the cloud in the background; the UI never waits on the network and
// works identically with sync switched off.
//
// Three properties:
//
//  · a read that cannot throw. Private mode, a cleared origin and a
//    hand-edited value all have to end in a usable default rather than a
//    white screen.
//  · a shape guard. If the stored value is the wrong shape for what the
//    caller asked for — an object where a list belongs — the default wins.
//    Half-parsed state is harder to debug than none.
//  · a timestamp per key. Sync resolves conflicts by comparing when each
//    side was actually edited, so the answer cannot depend on which device
//    happened to reconnect last. The timestamps live outside PREFIX and
//    are therefore never themselves synced or exported.
import { useCallback, useEffect, useState } from "react";
import { isCollection, removedIds } from "../sync/merge.js";

const PREFIX = "pnp:";
const META_KEY = "pnp_meta"; // outside PREFIX: never synced, never exported

// The sync engine registers here at start-up. Until it does — and it never
// does when sync is unconfigured — every write is a plain local write.
let syncNotify = null;
export const registerSyncNotify = (fn) => { syncNotify = fn; };

export function readMeta() {
  try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch { return {}; }
}
function stamp(key, iso) {
  try {
    const meta = readMeta();
    meta[key] = iso;
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch { /* quota — the value itself still landed, which matters more */ }
}

const sameShape = (a, b) =>
  Array.isArray(a) === Array.isArray(b) &&
  (a === null) === (b === null) &&
  typeof a === typeof b;

export function read(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw == null) return fallback;
    const v = JSON.parse(raw);
    if (v == null) return fallback;
    if (fallback != null && !sameShape(v, fallback)) return fallback;
    return v;
  } catch {
    return fallback;   // private mode, quota, or somebody else's key
  }
}

/** Deletions are recorded, not inferred. A record simply missing from one
 *  device is indistinguishable from one that never reached it, so without
 *  this a deleted trade would come back on the next sync. Diffing the
 *  array here — rather than at each delete button — means every path that
 *  removes a record is covered, including ones written later. */
function recordDeletions(key, next) {
  const prev = read(key, null);
  if (!Array.isArray(prev) || !Array.isArray(next)) return;
  const gone = removedIds(prev, next);
  if (!gone.length) return;
  const all = read("tombstones", {}) || {};
  const forKey = { ...(all[key] || {}) };
  const now = new Date().toISOString();
  for (const id of gone) forKey[id] = now;
  // Plain write: `tombstones` is not itself a collection, so this cannot
  // recurse, and it must sync like any other key.
  write("tombstones", { ...all, [key]: forKey });
}

export function write(key, value, { tombstone = true } = {}) {
  try {
    if (tombstone && isCollection(key)) recordDeletions(key, value);
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    stamp(key, new Date().toISOString());
    // Other tabs of the same app should not show stale trades.
    window.dispatchEvent(new CustomEvent("pnp:kv", { detail: { key } }));
    // Only after the value is actually durable. The sync engine pushes by
    // re-reading localStorage, so queuing a key that failed to store would
    // upload the previous value under a fresh timestamp — worse than not
    // syncing at all, because it would then win against the good copy.
    syncNotify?.(key);
  } catch { /* nothing useful to do — the UI already holds the value */ }
}

/** A write that came from the cloud. Carries the remote edit time rather
 *  than "now", so it does not look locally-edited and bounce straight back
 *  up, and it deliberately does not notify the sync engine. */
export function applyExternal(key, value, updatedAtIso) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    stamp(key, updatedAtIso || new Date().toISOString());
    window.dispatchEvent(new CustomEvent("pnp:kv", { detail: { key, origin: "remote" } }));
  } catch { /* quota */ }
}

export function useStore(key, fallback) {
  const [value, setValue] = useState(() => read(key, fallback));

  const set = useCallback((next) => {
    setValue((prev) => {
      const v = typeof next === "function" ? next(prev) : next;
      write(key, v);
      return v;
    });
  }, [key]);

  // Follow the same key in another tab, and across devices via the
  // browser's own storage event.
  useEffect(() => {
    const reread = (e) => {
      if (e.detail && e.detail.key !== key) return;
      if (e.key && e.key !== PREFIX + key) return;
      setValue(read(key, fallback));
    };
    window.addEventListener("pnp:kv", reread);
    window.addEventListener("storage", reread);
    return () => {
      window.removeEventListener("pnp:kv", reread);
      window.removeEventListener("storage", reread);
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return [value, set];
}

/** Everything the app holds, for backup. */
export const KEYS = ["trades", "accounts", "phases", "reviews", "gates", "seeded"];

/** Everything sync mirrors: the user's data plus the deletion record that
 *  makes removals stick across devices. Exports deliberately omit
 *  tombstones — restoring a backup should bring records back, not carry a
 *  list of things to delete again. */
export const SYNC_KEYS = [...KEYS, "tombstones"];

export function exportAll() {
  const out = { app: "PRESS_N_PLAY", exportedAt: new Date().toISOString(), version: 1 };
  for (const k of KEYS) {
    const v = read(k, null);
    if (v != null) out[k] = v;
  }
  return out;
}

export function importAll(data) {
  if (!data || data.app !== "PRESS_N_PLAY") throw new Error("Not a Press 'n' Play backup file.");
  const written = [];
  for (const k of KEYS) {
    if (data[k] !== undefined) { write(k, data[k], { tombstone: false }); written.push(k); }
  }
  return written;
}
