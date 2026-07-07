// ── Cloud sync engine ────────────────────────────────────────────────
// Mirrors every `architect:` record to a Supabase (PostgREST) `kv` table so
// all devices converge on the same data. Design:
//   · localStorage stays the source of truth for the running app — the UI
//     never waits on the network and works fully offline.
//   · Writes mark the key dirty and push (debounced, batched, retried).
//   · Pulls run on start, on regaining focus/connectivity, and every 60s
//     while visible. Conflict resolution is last-write-wins per key using
//     the per-key timestamps kept by useStorageState (readMeta).
//   · One row per key (primary key = key), so duplicates are impossible.
//   · A pull never overwrites newer local data; a push never loses newer
//     remote data (it is re-pulled and wins if genuinely newer).
// Setup (one-time, free tier is fine): create a Supabase project and run
// the SQL in SettingsPanel's setup box, then paste the project URL and
// anon key into Settings → Cloud Sync.
import { storage } from "./storage.js";
import { readMeta, applyExternal, registerSyncNotify } from "./useStorageState.js";

const CONFIG_KEY = "architect_sync"; // outside "architect:" — never synced/exported
const DIRTY_KEY = "architect_dirty";

export function getSyncConfig() {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY)) || null; } catch { return null; }
}
export function setSyncConfig(cfg) {
  if (cfg) localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  else localStorage.removeItem(CONFIG_KEY);
  status = cfg ? "idle" : "off";
  notifyStatus();
}

// ── Status (subscribable — Settings shows it live) ───────────────────
let status = "off"; // off | idle | syncing | error | offline
let lastError = "";
let lastSyncAt = null;
const statusListeners = new Set();
export const getSyncStatus = () => ({ status, lastError, lastSyncAt });
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

const headers = (cfg) => ({
  "Content-Type": "application/json",
  apikey: cfg.anonKey,
  Authorization: `Bearer ${cfg.anonKey}`,
});
const kvUrl = (cfg) => `${cfg.url.replace(/\/+$/, "")}/rest/v1/kv`;

// ── Push: upsert all dirty keys in one batch ─────────────────────────
let pushTimer = null;
export function schedulePush(delay = 1200) {
  const cfg = getSyncConfig();
  if (!cfg) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(flush, delay);
}

export async function flush() {
  const cfg = getSyncConfig();
  const dirty = getDirty();
  if (!cfg || !dirty.size) return;
  if (!navigator.onLine) { setStatus("offline"); return; } // retried on "online"
  setStatus("syncing");
  const meta = readMeta();
  const rows = [];
  for (const key of dirty) {
    try {
      const raw = await storage.get(key);
      if (raw == null) continue;
      rows.push({ key, value: JSON.parse(raw), updated_at: meta[key] || new Date().toISOString() });
    } catch { /* unparseable record: leave local, drop from queue */ }
  }
  try {
    if (rows.length) {
      const res = await fetch(`${kvUrl(cfg)}?on_conflict=key`, {
        method: "POST",
        headers: { ...headers(cfg), Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(rows),
      });
      if (!res.ok) throw new Error(`push failed (HTTP ${res.status})`);
    }
    saveDirty(new Set());
    lastSyncAt = new Date().toISOString();
    setStatus("idle");
  } catch (err) {
    setStatus("error", err.message);
    schedulePush(15000); // automatic retry with backoff
  }
}

// ── Pull: fetch all rows, apply the newer side per key ───────────────
export async function pull() {
  const cfg = getSyncConfig();
  if (!cfg) return;
  if (!navigator.onLine) { setStatus("offline"); return; }
  setStatus("syncing");
  try {
    const res = await fetch(`${kvUrl(cfg)}?select=key,value,updated_at`, { headers: headers(cfg) });
    if (!res.ok) throw new Error(`pull failed (HTTP ${res.status})`);
    const rows = await res.json();
    const meta = readMeta();
    const remoteKeys = new Set();
    for (const row of Array.isArray(rows) ? rows : []) {
      if (!row || typeof row.key !== "string") continue;
      remoteKeys.add(row.key);
      const localTs = meta[row.key] || "";
      const remoteTs = row.updated_at || "";
      if (remoteTs > localTs) {
        applyExternal(row.key, JSON.stringify(row.value), remoteTs);
      } else if (localTs > remoteTs) {
        markDirty(row.key); // local is newer — push it back
      }
    }
    // First-connect upload: local records the cloud has never seen.
    for (const key of await storage.list()) {
      if (!remoteKeys.has(key)) markDirty(key);
    }
    lastSyncAt = new Date().toISOString();
    setStatus("idle");
    if (getDirty().size) schedulePush(400);
  } catch (err) {
    setStatus("error", err.message);
  }
}

// ── Connection test (used by Settings) ───────────────────────────────
export async function testSync(cfg) {
  const res = await fetch(`${kvUrl(cfg)}?select=key&limit=1`, { headers: headers(cfg) });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}${body ? ` — ${body.slice(0, 120)}` : ""}`);
  }
  return true;
}

// ── Engine wiring — called once from main.jsx ────────────────────────
let started = false;
export function initSync() {
  if (started) return;
  started = true;
  registerSyncNotify((key) => { markDirty(key); schedulePush(); });
  window.addEventListener("online", () => { flush(); pull(); });
  window.addEventListener("offline", () => setStatus("offline"));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") pull();
  });
  setInterval(() => {
    if (document.visibilityState === "visible" && getSyncConfig()) pull();
  }, 60000);
  if (getSyncConfig()) { status = "idle"; pull(); }
}
