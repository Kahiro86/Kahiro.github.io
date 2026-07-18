// ── Cloud sync engine (Supabase) ─────────────────────────────────────
// Mirrors every `architect:` record to the per-user `kv` table. Design:
//   · localStorage stays the source of truth for the running app — the UI
//     never waits on the network and works fully offline.
//   · Writes mark the key dirty and push (debounced, batched, retried).
//   · A realtime postgres_changes subscription applies other devices'
//     writes within a second or two; pulls on start/focus/online/60s are
//     the belt-and-braces fallback when the socket is down.
//   · Conflict resolution is last-write-wins per key using the per-key
//     timestamps kept by useStorageState. A pull never overwrites newer
//     local data; newer local data is re-pushed instead.
//   · One row per (user, key) — duplicates are structurally impossible —
//     and Row Level Security means a user can only ever read/write their
//     own rows, even with the anon key public in the page source.
//   · Sync runs only while signed in; signed out, data stays local.
import { storage } from "./storage.js";
import { readMeta, applyExternal, registerSyncNotify } from "./useStorageState.js";
import { supabase, getSyncConfig, getSession, onAuth } from "./supabase.js";

export { getSyncConfig } from "./supabase.js";

const DIRTY_KEY = "architect_dirty";

// ── Status (subscribable — Settings shows it live) ───────────────────
let status = "off"; // off | auth | idle | syncing | live | error | offline
let lastError = "";
let lastSyncAt = null;
let realtimeUp = false;
const statusListeners = new Set();
export const getSyncStatus = () => ({ status, lastError, lastSyncAt, realtimeUp });
export function onSyncStatus(fn) { statusListeners.add(fn); return () => statusListeners.delete(fn); }
function notifyStatus() { statusListeners.forEach((fn) => fn(getSyncStatus())); }
function setStatus(s, err = "") { status = s; lastError = err; notifyStatus(); }

// ── Dirty queue (persisted so pending pushes survive a reload) ───────
function getDirty() {
  try { return new Set(JSON.parse(localStorage.getItem(DIRTY_KEY)) || []); } catch { return new Set(); }
}
function saveDirty(set) {
  try { localStorage.setItem(DIRTY_KEY, JSON.stringify([...set])); } catch { /* quota */ }
}
function markDirty(key) { const d = getDirty(); d.add(key); saveDirty(d); }

async function ready() {
  if (!getSyncConfig()) { setStatus("off"); return null; }
  const session = await getSession();
  if (!session) { setStatus("auth"); return null; }
  if (!navigator.onLine) { setStatus("offline"); return null; }
  return session;
}

// ── Push: upsert all dirty keys in one batch ─────────────────────────
let pushTimer = null;
function schedulePush(delay = 1200) {
  clearTimeout(pushTimer);
  pushTimer = setTimeout(flush, delay);
}

export async function flush() {
  const session = await ready();
  const dirty = getDirty();
  if (!session || !dirty.size) return;
  setStatus("syncing");
  const meta = readMeta();

  // Guard against a stale local edit clobbering a newer cloud value: before
  // pushing, read the remote timestamps for exactly the dirty keys. Any key
  // the cloud has changed more recently than our local edit is a genuine
  // cross-device conflict — we take the newer remote instead of overwriting
  // it, so last-write-wins is decided by real edit time, never by whichever
  // device happened to reconnect last. (Best-effort: if the read fails we
  // fall back to the previous optimistic push rather than block syncing.)
  let remote = {};
  try {
    const { data } = await supabase().from("kv").select("key,value,updated_at").in("key", [...dirty]);
    for (const row of data || []) if (row && typeof row.key === "string") remote[row.key] = row;
  } catch { /* proceed optimistically */ }

  const rows = [];
  const handled = new Set(); // keys we can clear from the dirty queue
  for (const key of dirty) {
    const localTs = meta[key] || "";
    const rt = remote[key];
    if (rt && (rt.updated_at || "") > localTs) {
      applyExternal(key, JSON.stringify(rt.value), rt.updated_at); // cloud is newer — keep it
      handled.add(key);
      continue;
    }
    try {
      const raw = await storage.get(key);
      if (raw == null) { handled.add(key); continue; } // deleted locally: nothing to push
      rows.push({ user_id: session.user.id, key, value: JSON.parse(raw), updated_at: localTs || new Date().toISOString() });
      handled.add(key);
    } catch { /* unparseable record: keep local, leave dirty for a later retry */ }
  }
  try {
    if (rows.length) {
      const { error } = await supabase().from("kv").upsert(rows, { onConflict: "user_id,key" });
      if (error) throw new Error(error.message);
    }
    // Clear only the keys we actually resolved; anything that errored stays queued.
    const remaining = getDirty();
    for (const k of handled) remaining.delete(k);
    saveDirty(remaining);
    lastSyncAt = new Date().toISOString();
    setStatus(realtimeUp ? "live" : "idle");
  } catch (err) {
    setStatus("error", err.message);
    schedulePush(15000); // automatic retry with backoff
  }
}

// ── Pull: fetch all rows (RLS scopes to this user), newer side wins ──
export async function pull() {
  const session = await ready();
  if (!session) return;
  setStatus("syncing");
  try {
    const { data: rows, error } = await supabase().from("kv").select("key,value,updated_at");
    if (error) throw new Error(error.message);
    const meta = readMeta();
    const remoteKeys = new Set();
    for (const row of rows || []) {
      if (!row || typeof row.key !== "string") continue;
      remoteKeys.add(row.key);
      applyRow(row, meta);
    }
    // First-connect upload: local records the cloud has never seen.
    for (const key of await storage.list()) {
      if (!remoteKeys.has(key)) markDirty(key);
    }
    lastSyncAt = new Date().toISOString();
    setStatus(realtimeUp ? "live" : "idle");
    if (getDirty().size) schedulePush(400);
  } catch (err) {
    setStatus("error", err.message);
  }
}

function applyRow(row, meta = readMeta()) {
  const localTs = meta[row.key] || "";
  const remoteTs = row.updated_at || "";
  if (remoteTs > localTs) {
    applyExternal(row.key, JSON.stringify(row.value), remoteTs);
  } else if (localTs > remoteTs) {
    markDirty(row.key); // local is newer — push it back
  }
}

// ── Realtime: other devices' writes land within a second or two ──────
let channel = null;
async function startRealtime() {
  const session = await getSession();
  const sb = supabase();
  if (!sb || !session || channel) return;
  channel = sb
    .channel("kv-sync")
    .on("postgres_changes",
      { event: "*", schema: "public", table: "kv", filter: `user_id=eq.${session.user.id}` },
      (payload) => { if (payload.new?.key) applyRow(payload.new); })
    .subscribe((state) => {
      realtimeUp = state === "SUBSCRIBED";
      if (realtimeUp && (status === "idle" || status === "live")) setStatus("live");
      if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") realtimeUp = false; // pulls keep covering
    });
}
function stopRealtime() {
  if (channel) { supabase()?.removeChannel(channel); channel = null; realtimeUp = false; }
}

// ── Connection test (used by Settings before saving credentials) ─────
export async function testConnection(cfg) {
  const res = await fetch(`${cfg.url.replace(/\/+$/, "")}/auth/v1/settings`, { headers: { apikey: cfg.anonKey } });
  if (!res.ok) throw new Error(`HTTP ${res.status} — check the project URL and anon key`);
  return true;
}

// Called by Settings after sign-in/out to (re)start or stop syncing.
export async function onAuthChanged(signedIn) {
  stopRealtime();
  if (signedIn) { await pull(); await flush(); startRealtime(); }
  else setStatus(getSyncConfig() ? "auth" : "off");
}

// ── Engine wiring — called once from main.jsx ────────────────────────
let started = false;
export function initSync() {
  if (started) return;
  started = true;
  registerSyncNotify((key) => { markDirty(key); schedulePush(); });
  // Reconcile the cloud *before* pushing on reconnect, so a device that was
  // edited offline with stale data can't overwrite newer changes made
  // elsewhere while it was away (pull applies newer remote; flush then pushes
  // only what's genuinely newer locally).
  window.addEventListener("online", () => { pull().then(flush); });
  window.addEventListener("offline", () => setStatus("offline"));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") pull();
  });
  setInterval(() => {
    if (document.visibilityState === "visible" && getSyncConfig()) pull();
  }, 60000);
  if (getSyncConfig()) {
    onAuth((event) => {
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") { if (!channel) onAuthChanged(true); }
      if (event === "SIGNED_OUT") onAuthChanged(false);
    });
    onAuthChanged(true); // no-op path resolves to "auth" status when signed out
  }
}
