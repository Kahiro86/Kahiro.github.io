// ── Storage ──────────────────────────────────────────────────────────
// A localStorage-backed state hook. Deliberately small: this app has no
// server, no account and no sync, so the whole persistence story is a key
// and a JSON blob.
//
// Two properties worth having anyway:
//
//  · a read that cannot throw. Private mode, a cleared origin and a
//    hand-edited value all have to end in a usable default rather than a
//    white screen.
//  · a shape guard. If the stored value is the wrong shape for what the
//    caller asked for — an object where a list belongs — the default wins.
//    Half-parsed state is harder to debug than none.
import { useCallback, useEffect, useState } from "react";

const PREFIX = "pnp:";

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

export function write(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    // Other tabs of the same app should not show stale trades.
    window.dispatchEvent(new CustomEvent("pnp:kv", { detail: { key } }));
  } catch { /* nothing useful to do — the UI already holds the value */ }
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
    if (data[k] !== undefined) { write(k, data[k]); written.push(k); }
  }
  return written;
}
