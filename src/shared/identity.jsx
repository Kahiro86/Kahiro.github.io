// ── App identity — user-editable app name & owner name ───────────────
// The app's brand ("appName") and the person it belongs to ("ownerName")
// are personalizable, so a shared copy can be made someone else's. Stored
// under one synced key (app_identity) and read app-wide via context, so no
// component hardcodes a name. If storage is unavailable the provider still
// serves in-memory defaults, so nothing crashes.
import { createContext, useContext, useMemo, useEffect, useCallback } from "react";
import { useStorageState } from "./useStorageState.js";

export const IDENTITY_KEY = "app_identity";
export const DEFAULT_APP_NAME = "Kahiro";
export const TITLE_SUFFIX = " — Kaizen OS";
export const DEFAULT_IDENTITY = { appName: DEFAULT_APP_NAME, ownerName: "", configured: false };

// Trim, cap (appName ≤32, ownerName ≤40), and fall back to the default app
// name if it's blank. `configured` marks that the user has made a choice
// (drives the first-run card).
export function sanitizeIdentity(raw) {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  let appName = String(o.appName ?? "").trim().slice(0, 32);
  if (!appName) appName = DEFAULT_APP_NAME;
  const ownerName = String(o.ownerName ?? "").trim().slice(0, 40);
  return { appName, ownerName, configured: !!o.configured };
}

// How to refer to the owner in generated copy when no name is set.
export const ownerRef = (ownerName) => (ownerName && ownerName.trim()) || "the user";
// A greeting suffix that reads naturally when empty: "Welcome back" + "" or ", Alex".
export const greetingSuffix = (ownerName) => (ownerName && ownerName.trim() ? `, ${ownerName.trim()}` : "");

const IdentityContext = createContext(null);

export function IdentityProvider({ children }) {
  const [raw, setRaw, loaded] = useStorageState(IDENTITY_KEY, DEFAULT_IDENTITY);
  const id = useMemo(() => sanitizeIdentity(raw), [raw]);

  // Keep the browser tab title in sync with the app name.
  useEffect(() => { try { document.title = id.appName + TITLE_SUFFIX; } catch { /* SSR / no document */ } }, [id.appName]);

  const save = useCallback((next) => {
    setRaw((prev) => sanitizeIdentity({ ...sanitizeIdentity(prev), ...next, configured: true }));
  }, [setRaw]);
  const reset = useCallback(() => {
    setRaw({ appName: DEFAULT_APP_NAME, ownerName: "", configured: true });
  }, [setRaw]);

  const value = useMemo(() => ({ ...id, loaded, save, reset }), [id, loaded, save, reset]);
  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}

// Safe outside a provider too (returns defaults) so nothing ever crashes.
export function useIdentity() {
  return useContext(IdentityContext) || { ...DEFAULT_IDENTITY, configured: true, loaded: true, save: () => {}, reset: () => {} };
}
