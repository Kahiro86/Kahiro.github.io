// ── Supabase client + auth ───────────────────────────────────────────
// One lazily-created client from the project config pasted in Settings.
// Auth sessions persist in localStorage and auto-refresh (supabase-js).
// Every signed-in user only ever sees their own rows — enforced by RLS
// in the database, not by client code.
//
// The supabase-js SDK (~55KB gzipped) is loaded via a dynamic import so it
// never sits in the first-paint critical path — it downloads only once sync
// is actually configured (Phase 8: offline-first, sync is background
// reconciliation). `supabase()` stays synchronous and returns null until the
// SDK has landed; every caller already treats null as "not connected yet"
// and retries, and the async auth wrappers await the load explicitly.
let createClient = null;
let sdkPromise = null;
export function ensureSdk() {
  if (createClient) return Promise.resolve();
  if (!sdkPromise) sdkPromise = import("@supabase/supabase-js").then((m) => { createClient = m.createClient; });
  return sdkPromise;
}

const CONFIG_KEY = "architect_sync"; // { url, anonKey } — never synced/exported

export function getSyncConfig() {
  try { return JSON.parse(localStorage.getItem(CONFIG_KEY)) || null; } catch { return null; }
}
export function saveSyncConfig(cfg) {
  if (cfg) localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg));
  else localStorage.removeItem(CONFIG_KEY);
  client = null; // recreate with new credentials on next use
}

let client = null;
export function supabase() {
  const cfg = getSyncConfig();
  if (!cfg?.url || !cfg?.anonKey) return null;
  if (!createClient) { ensureSdk(); return null; } // SDK still loading — caller retries
  if (!client) {
    client = createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      realtime: { params: { eventsPerSecond: 5 } },
    });
  }
  return client;
}

// ── Auth helpers (thin wrappers so UI code stays declarative) ────────
export async function signUp(email, password) {
  await ensureSdk();
  const sb = supabase();
  if (!sb) throw new Error("Connect your Supabase project first.");
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  await ensureSdk();
  const sb = supabase();
  if (!sb) throw new Error("Connect your Supabase project first.");
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  await ensureSdk();
  const sb = supabase();
  if (sb) await sb.auth.signOut();
}

export async function resetPassword(email) {
  await ensureSdk();
  const sb = supabase();
  if (!sb) throw new Error("Connect your Supabase project first.");
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname,
  });
  if (error) throw error;
}

export async function updatePassword(newPassword) {
  await ensureSdk();
  const sb = supabase();
  if (!sb) throw new Error("Not connected.");
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function getSession() {
  await ensureSdk();
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data?.session || null;
}

// Fires on sign-in/out, token refresh, and password-recovery links.
export function onAuth(fn) {
  const sb = supabase();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((event, session) => fn(event, session));
  return () => data.subscription.unsubscribe();
}
