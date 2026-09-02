// ── Cloud sync engine (Supabase) ─────────────────────────────────────
// Mirrors every synced key to a per-user `pnp_kv` table. The shape of the
// thing:
//
//  · localStorage stays the source of truth for the running app. The UI
//    never waits on the network and is fully usable with sync off, or on
//    and offline.
//  · A write marks its key dirty and schedules a debounced, batched push.
//  · A realtime subscription applies another device's writes in about a
//    second; pulls on start, on focus, on reconnect and every 60s are the
//    fallback for when that socket is down.
//  · Conflicts resolve through merge.js, which unions collections by
//    record id rather than letting one device's array replace another's.
//  · One row per (user, key), so duplicates are structurally impossible,
//    and Row Level Security confines each user to their own rows — the
//    anon key in the page source grants nothing without a session.
//
// The table is `pnp_kv`, deliberately not the `kv` table another app of
// mine syncs to. Sharing one table would work, but that app pulls every
// row it can see and mirrors it into its own storage, so this app's
// trades would accumulate inside it as dead keys. Separate tables in the
// same project keep one account and one login without the cross-talk.
import { read, readMeta, applyExternal, registerSyncNotify, SYNC_KEYS } from "../ui/useStore.js";
import { mergeValue } from "./merge.js";
import { supabase, getSyncConfig, getSession, onAuth, ensureSdk } from "./supabase.js";

export { getSyncConfig, testConnection } from "./supabase.js";

const TABLE = "pnp_kv";
const DIRTY_KEY = "pnp_dirty"; // outside the "pnp:" prefix: queue state, not data

// ── Status ───────────────────────────────────────────────────────────
let status = "off"; // off | auth | idle | syncing | live | error | offline
let lastError = "";
let lastSyncAt = null;
let realtimeUp = false;
const listeners = new Set();

export const getSyncStatus = () => ({ status, lastError, lastSyncAt, realtimeUp });
export function onSyncStatus(fn) { listeners.add(fn); return () => listeners.delete(fn); }
function setStatus(s, err = "") {
  status = s; lastError = err;
  listeners.forEach((fn) => fn(getSyncStatus()));
}

// ── Dirty queue, persisted so a pending push survives a reload ───────
function getDirty() {
  try { return new Set(JSON.parse(localStorage.getItem(DIRTY_KEY)) || []); } catch { return new Set(); }
}
function saveDirty(set) {
  try { localStorage.setItem(DIRTY_KEY, JSON.stringify([...set])); } catch { /* quota */ }
}
function markDirty(key) { const d = getDirty(); d.add(key); saveDirty(d); }

let pushTimer = null;
function schedulePush(delay = 1200) {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(flush, delay);
}

async function ready() {
  if (!getSyncConfig()) { setStatus("off"); return null; }
  const session = await getSession();
  if (!session) { setStatus("auth"); return null; }
  if (!navigator.onLine) { setStatus("offline"); return null; }
  return session;
}

// Tombstones are merged before anything that consults them, so a deletion
// that arrived in the same round is already known when the collections
// are reconciled — otherwise a record deleted elsewhere would be kept for
// one more sync and pushed back up as if it were new.
const syncOrder = (keys) => [...keys].sort((a, b) => (a === "tombstones" ? -1 : b === "tombstones" ? 1 : 0));

/**
 * Reconcile one key against the cloud's version of it.
 * @returns { store, push, value, ts } — whether the merged result differs
 *          from what each side holds, and so which of them needs updating.
 */
function reconcile(key, remoteValue, remoteTs, meta = readMeta()) {
  const local = read(key, null);
  const localTs = meta[key] || "";
  const tombstones = read("tombstones", {}) || {};
  const merged = mergeValue(key, local, remoteValue, localTs, remoteTs || "", tombstones);
  const ts = localTs > (remoteTs || "") ? localTs : (remoteTs || "");
  const j = JSON.stringify;
  return {
    value: merged,
    ts: ts || new Date().toISOString(),
    store: j(merged) !== j(local),
    push: j(merged) !== j(remoteValue),
  };
}

function applyRemote(key, remoteValue, remoteTs, meta) {
  const r = reconcile(key, remoteValue, remoteTs, meta);
  if (r.store) applyExternal(key, r.value, r.ts);
  if (r.push) markDirty(key);
  return r;
}

// ── Push ─────────────────────────────────────────────────────────────
export async function flush() {
  const session = await ready();
  const dirty = getDirty();
  if (!session || !dirty.size) return;
  setStatus("syncing");

  // Always fetch tombstones alongside whatever is dirty, even when this
  // device has not touched them. Merging `trades` against the cloud while
  // consulting only local tombstones would re-add a trade another device
  // deleted — the next pull undoes it, but the round trip is avoidable
  // for the cost of one extra key in the query.
  const keys = syncOrder(new Set([...dirty, "tombstones"]));

  // Read the cloud's current version of exactly these keys first. Pushing
  // blind would let a device that has been offline overwrite edits made
  // elsewhere while it was away; merging against what is actually up there
  // means the result contains both sides.
  let remote = {};
  try {
    const { data } = await supabase().from(TABLE).select("key,value,updated_at").in("key", keys);
    for (const row of data || []) if (row && typeof row.key === "string") remote[row.key] = row;
  } catch { /* offline mid-flight: fall through and push what we have */ }

  const rows = [];
  const handled = new Set();
  const meta = readMeta();
  for (const key of keys) {
    const rt = remote[key];
    const r = reconcile(key, rt ? rt.value : undefined, rt?.updated_at, meta);
    if (r.store) applyExternal(key, r.value, r.ts);
    if (r.value === undefined || r.value === null) { handled.add(key); continue; }
    if (r.push) rows.push({ user_id: session.user.id, key, value: r.value, updated_at: r.ts });
    if (dirty.has(key)) handled.add(key); // tombstones may be here without being queued
  }

  try {
    if (rows.length) {
      const { error } = await supabase().from(TABLE).upsert(rows, { onConflict: "user_id,key" });
      if (error) throw new Error(error.message);
    }
    const remaining = getDirty();
    for (const k of handled) remaining.delete(k);
    saveDirty(remaining);
    lastSyncAt = new Date().toISOString();
    setStatus(realtimeUp ? "live" : "idle");
  } catch (err) {
    setStatus("error", err.message);
    schedulePush(15000); // retry; the queue is still on disk
  }
}

// ── Pull ─────────────────────────────────────────────────────────────
export async function pull() {
  const session = await ready();
  if (!session) return;
  setStatus("syncing");
  try {
    const { data: rows, error } = await supabase().from(TABLE).select("key,value,updated_at");
    if (error) throw new Error(error.message);

    const meta = readMeta();
    const byKey = new Map();
    for (const row of rows || []) if (row && typeof row.key === "string") byKey.set(row.key, row);

    for (const key of syncOrder(byKey.keys())) {
      const row = byKey.get(key);
      applyRemote(key, row.value, row.updated_at, meta);
    }
    // First connection from this device: anything held locally that the
    // cloud has never seen has to go up, or signing in on a second device
    // would look like it had wiped the first.
    for (const key of SYNC_KEYS) {
      if (!byKey.has(key) && read(key, null) != null) markDirty(key);
    }

    lastSyncAt = new Date().toISOString();
    setStatus(realtimeUp ? "live" : "idle");
    if (getDirty().size) schedulePush(400);
  } catch (err) {
    setStatus("error", err.message);
  }
}

// ── Realtime ─────────────────────────────────────────────────────────
let channel = null;
async function startRealtime() {
  const session = await getSession();
  const sb = supabase();
  if (!sb || !session || channel) return;
  channel = sb
    .channel("pnp-kv-sync")
    .on("postgres_changes",
      { event: "*", schema: "public", table: TABLE, filter: `user_id=eq.${session.user.id}` },
      (payload) => {
        const row = payload.new;
        if (!row || typeof row.key !== "string") return;
        if (applyRemote(row.key, row.value, row.updated_at).push) schedulePush(800);
      })
    .subscribe((state) => {
      realtimeUp = state === "SUBSCRIBED";
      if (realtimeUp && (status === "idle" || status === "live")) setStatus("live");
      if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") realtimeUp = false; // polling still covers it
    });
}
function stopRealtime() {
  if (channel) { supabase()?.removeChannel(channel); channel = null; realtimeUp = false; }
}

/** Called after sign-in and sign-out. */
export async function onAuthChanged(signedIn) {
  stopRealtime();
  if (signedIn) { await pull(); await flush(); startRealtime(); }
  else setStatus(getSyncConfig() ? "auth" : "off");
}

/** Forget this device's cloud credentials and queue. Local data is left
 *  alone — disconnecting is not deleting. */
export function disconnect() {
  stopRealtime();
  try { localStorage.removeItem(DIRTY_KEY); } catch { /* ignore */ }
  setStatus("off");
}

// ── Wiring, called once from main.jsx ────────────────────────────────
let started = false;
export function initSync() {
  if (started) return;
  started = true;
  registerSyncNotify((key) => { markDirty(key); schedulePush(); });

  // Pull before pushing on reconnect: a device edited offline against
  // stale data must see what changed while it was away before it sends
  // anything, or the merge has nothing to merge against.
  window.addEventListener("online", () => { pull().then(flush); });
  window.addEventListener("offline", () => setStatus("offline"));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") pull();
  });
  setInterval(() => {
    if (document.visibilityState === "visible" && getSyncConfig()) pull();
  }, 60000);

  // The SDK chunk downloads only once sync is actually configured, so an
  // app nobody has connected never pays for it.
  if (getSyncConfig()) {
    ensureSdk().then(() => {
      onAuth((event) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") { if (!channel) onAuthChanged(true); }
        if (event === "SIGNED_OUT") onAuthChanged(false);
      });
      onAuthChanged(true); // resolves to "auth" when there is no session
    });
  }
}
