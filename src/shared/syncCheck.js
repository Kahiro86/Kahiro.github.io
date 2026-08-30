// ── Sync check — a read-only answer to "why is my phone behind?" ─────
// The console version of this (docs/SYNC_CHECK.js) could only ever be run on
// the desktop, because a phone browser has no console — and the phone is half
// the diagnosis. So it lives in the app, behind a button in Settings.
//
// Three rules it must keep:
//   1. It writes nothing. No pushes, no pulls, no repairs. A diagnostic that
//      changes the thing it measures cannot be trusted twice.
//   2. It does not trust sync.js. The cloud side is read straight through
//      PostgREST, so the answer does not depend on the code under suspicion
//      being right.
//   3. The report is safe to send to someone. Counts, timestamps and store
//      names only — never a key, a token, or a line of the user's own data.
//      buildReport() is pure so that last rule can actually be tested.
import { getSyncConfig } from "./supabase.js";

const PREFIX = "architect:";

const readJson = (k, fallback = null) => {
  try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; }
};

/** How many things a store holds, in the store's own terms. A list counts its
 *  items, a by-date map counts its days, and a scalar counts as one. */
export function countOf(v) {
  if (v == null) return null;                 // absent — not the same as zero
  if (Array.isArray(v)) return v.length;
  if (typeof v === "object") return Object.keys(v).length;
  return 1;
}

const stamp = (iso) => (iso ? new Date(iso).toISOString().replace("T", " ").slice(0, 19) : "never");

/** The stores worth naming individually — the ones this is usually run about. */
export const WATCHED = ["ht_habits", "ht_entries", "ht_routines", "gym_routines", "gym_sessions", "nutrition_log"];

/**
 * The report, as plain text. Pure: everything it knows comes in as arguments,
 * so a test can hand it a fake anon key and a fake access token and assert
 * neither can come out the other side.
 */
export function buildReport({ now, agent, configured, host, signedIn, userId, meta, base, dirty, local, cloud, cloudError }) {
  const L = [];
  const row = (k, v) => L.push(`  ${String(k).padEnd(16)} ${v}`);

  L.push("═══ KAHIRO SYNC CHECK ═══");
  L.push(`  ${stamp(now)}  ·  ${String(agent || "").slice(0, 48)}`);

  L.push("", "1. This device");
  row("sync", configured ? `configured · ${host || "?"}` : "NOT CONFIGURED — that is the answer");
  if (!configured) {
    L.push("", "  → Settings → Cloud sync: connect the project, then sign in.");
    return L.join("\n");
  }
  row("signed in", signedIn ? `yes · account ${String(userId || "").slice(0, 8)}…` : "NO — that is the answer");
  if (!signedIn) {
    L.push("", "  → Sign in with the SAME email on both devices.");
    return L.join("\n");
  }

  if (cloudError) {
    L.push("", "2. The cloud", `  could not be read — ${cloudError}`);
    L.push("", "  → 401/403: the session expired. Sign out and back in.");
    L.push("  → 404: the kv table is missing. Run supabase/migrations/0002_kv.sql.");
    return L.join("\n");
  }

  L.push("", "2. Store by store");
  const keys = [...new Set([...WATCHED, ...Object.keys(local), ...Object.keys(cloud)])];
  const interesting = keys.filter((k) => WATCHED.includes(k) || countOf(local[k]) !== (cloud[k] ? countOf(cloud[k].value) : null));
  for (const k of interesting) {
    const here = countOf(local[k]);
    const there = cloud[k] ? countOf(cloud[k].value) : null;
    const lt = Date.parse(meta[k] || "") || 0;
    const rt = Date.parse(cloud[k]?.updated_at || "") || 0;
    let verdict;
    if (here === null && there === null) verdict = "empty on both";
    else if (there === null) verdict = `${here} here, never pushed`;
    else if (here === there) verdict = `${here} on both — in step`;
    else if (here > there) verdict = `${here} here vs ${there} in the cloud — this device has NOT PUSHED`;
    else verdict = `${here} here vs ${there} in the cloud — this device has NOT PULLED`;
    row(k, verdict);
    if (here !== there) row("", `   written here ${stamp(meta[k])} · cloud ${stamp(cloud[k]?.updated_at)}`);
  }
  if (!interesting.length) L.push("  every store matches the cloud");

  L.push("", "3. Waiting to go up");
  row("queued", dirty.length ? dirty.join(", ") : "nothing");
  if (dirty.length) L.push("", "  → Stuck here means the push is failing; the status line above shows why.");

  L.push("", "4. Merge state");
  const reconciled = WATCHED.filter((k) => base[k]?.ts);
  row("reconciled", reconciled.length ? `${reconciled.length}/${WATCHED.length} of the watched stores` : "none yet — this device has not completed a sync");
  L.push("", "  A store with no recorded ancestor keeps everything on both sides and");
  L.push("  never honours a delete, which is the safe direction. It gets one on the");
  L.push("  first sync where this device and the cloud hold the same thing.");

  L.push("", "═════════════════════════");
  return L.join("\n");
}

/** Gather the facts and hand them to buildReport. Read-only throughout. */
export async function runSyncCheck() {
  const cfg = getSyncConfig();
  const facts = {
    now: new Date().toISOString(),
    agent: navigator.userAgent,
    configured: !!cfg?.url,
    host: cfg?.url ? String(cfg.url).replace(/^https?:\/\//, "").split("/")[0] : "",
    signedIn: false, userId: "",
    meta: readJson("architect_meta", {}) || {},
    base: readJson("architect_base", {}) || {},
    dirty: readJson("architect_dirty", []) || [],
    local: {}, cloud: {}, cloudError: "",
  };
  if (!facts.configured) return buildReport(facts);

  for (const k of Object.keys(localStorage)) {
    if (k.startsWith(PREFIX)) facts.local[k.slice(PREFIX.length)] = readJson(k);
  }

  const authKey = Object.keys(localStorage).find((k) => /^sb-.*-auth-token$/.test(k));
  const sess = authKey ? readJson(authKey) : null;
  const token = sess?.access_token;
  facts.signedIn = !!token;
  facts.userId = sess?.user?.id || "";
  if (!token) return buildReport(facts);

  try {
    const res = await fetch(`${cfg.url.replace(/\/+$/, "")}/rest/v1/kv?select=key,value,updated_at`, {
      headers: { apikey: cfg.anonKey, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) facts.cloudError = `HTTP ${res.status}`;
    else for (const r of await res.json()) if (r?.key) facts.cloud[r.key] = r;
  } catch (err) {
    facts.cloudError = err.message || "network";
  }
  return buildReport(facts);
}
