// ── Supabase client + auth ───────────────────────────────────────────
// Sync is optional and off by default. The project URL and anon key are
// pasted into the app's own Sync panel and kept in localStorage under a
// key outside the "pnp:" prefix, so the credentials are never themselves
// synced and never land in a backup file you might share.
//
// The SDK (~55KB gzipped) arrives through a dynamic import, so an app with
// sync switched off never downloads it at all. `supabase()` stays
// synchronous and returns null until the SDK lands; every caller already
// treats null as "not connected yet".
//
// Publishing the anon key in the page source is the intended design: it
// grants nothing on its own. Row Level Security in the database is what
// confines each signed-in user to their own rows.
let createClient = null;
let sdkPromise = null;

export function ensureSdk() {
  if (createClient) return Promise.resolve();
  if (!sdkPromise) {
    sdkPromise = import("@supabase/supabase-js").then((m) => { createClient = m.createClient; });
  }
  return sdkPromise;
}

const CONFIG_KEY = "pnp_sync"; // { url, anonKey } — never synced, never exported

export function getSyncConfig() {
  try {
    const cfg = JSON.parse(localStorage.getItem(CONFIG_KEY));
    return cfg?.url && cfg?.anonKey ? cfg : null;
  } catch { return null; }
}

export function saveSyncConfig(cfg) {
  try {
    if (cfg) localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
    else localStorage.removeItem(CONFIG_KEY);
  } catch { /* private mode: sync simply stays off */ }
  client = null; // rebuild against the new credentials on next use
}

let client = null;
export function supabase() {
  const cfg = getSyncConfig();
  if (!cfg) return null;
  if (!createClient) { ensureSdk(); return null; } // still loading — caller retries
  if (!client) {
    client = createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      realtime: { params: { eventsPerSecond: 5 } },
    });
  }
  return client;
}

/** Checks the URL and key before they are saved, so a typo is caught at
 *  the panel rather than showing up later as a silent sync failure. */
export async function testConnection(cfg) {
  const url = String(cfg?.url || "").replace(/\/+$/, "");
  if (!/^https:\/\/[^/]+/.test(url)) throw new Error("The project URL should start with https://");
  const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: cfg.anonKey } });
  if (!res.ok) throw new Error(`HTTP ${res.status} — check the project URL and the anon key`);
  return true;
}

// ── Auth ─────────────────────────────────────────────────────────────
async function sdk() {
  await ensureSdk();
  const sb = supabase();
  if (!sb) throw new Error("Connect a Supabase project first.");
  return sb;
}

export async function signUp(email, password) {
  const { data, error } = await (await sdk()).auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const { data, error } = await (await sdk()).auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await ensureSdk();
  await supabase()?.auth.signOut();
}

export async function resetPassword(email) {
  const { error } = await (await sdk()).auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname,
  });
  if (error) throw error;
}

export async function getSession() {
  await ensureSdk();
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data?.session || null;
}

/** Fires on sign-in, sign-out, token refresh and password-recovery links. */
export function onAuth(fn) {
  const sb = supabase();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((event, session) => fn(event, session));
  return () => data.subscription.unsubscribe();
}
