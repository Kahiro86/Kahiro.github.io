// ── Supabase client + auth ───────────────────────────────────────────
// One lazily-created client from the project config pasted in Settings.
// Auth sessions persist in localStorage and auto-refresh (supabase-js).
// Every signed-in user only ever sees their own rows — enforced by RLS
// in the database, not by client code.
import { createClient } from "@supabase/supabase-js";

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
  const sb = supabase();
  if (!sb) throw new Error("Connect your Supabase project first.");
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

export async function signIn(email, password) {
  const sb = supabase();
  if (!sb) throw new Error("Connect your Supabase project first.");
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const sb = supabase();
  if (sb) await sb.auth.signOut();
}

export async function resetPassword(email) {
  const sb = supabase();
  if (!sb) throw new Error("Connect your Supabase project first.");
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname,
  });
  if (error) throw error;
}

export async function updatePassword(newPassword) {
  const sb = supabase();
  if (!sb) throw new Error("Not connected.");
  const { error } = await sb.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

export async function getSession() {
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
