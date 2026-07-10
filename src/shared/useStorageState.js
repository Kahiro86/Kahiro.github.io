import { useCallback, useEffect, useRef, useState } from "react";
import { storage } from "./storage.js";

// ── Synchronised storage state ───────────────────────────────────────
// Every hook instance of the same key stays consistent everywhere:
//  · same tab, different components  → CustomEvent("architect:kv")
//  · different tabs, same device    → native window "storage" event
//  · different devices              → sync engine (sync.js) pulls remote
//    changes and re-broadcasts them through applyExternal() below.
// Writes are write-through: state → localStorage → meta timestamp → sync
// push. Loads never write anything back, so a corrupt record is preserved
// on disk until the user's first real edit replaces it.

const PREFIX = "architect:";
const META_KEY = "architect_meta"; // outside PREFIX: never synced or exported

let instanceSeq = 0;
let syncNotify = null; // sync.js registers a (key, raw) => void push hook
export const registerSyncNotify = (fn) => { syncNotify = fn; };

// Per-key last-modified timestamps, used by the sync engine for
// last-write-wins conflict resolution across devices.
export function readMeta() {
  try { return JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch { return {}; }
}
function stampMeta(key, iso = new Date().toISOString()) {
  const m = readMeta();
  m[key] = iso;
  try { localStorage.setItem(META_KEY, JSON.stringify(m)); } catch { /* quota */ }
}

// Parse a raw record, rejecting anything that can't stand in for the
// default: bad JSON, null, or an array/object shape mismatch. Null entries
// inside array stores are dropped. Returns undefined when unusable.
function safeParse(raw, initialValue) {
  if (raw == null) return undefined;
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return undefined; }
  if (parsed == null) return undefined;
  if (typeof initialValue === "object" && initialValue != null &&
      Array.isArray(parsed) !== Array.isArray(initialValue)) return undefined;
  return Array.isArray(parsed) ? parsed.filter((x) => x != null) : parsed;
}

// Applied by the sync engine when a newer remote record arrives: persist it,
// keep the remote timestamp, and broadcast so mounted hooks update live.
export function applyExternal(key, raw, updatedAtIso) {
  storage.set(key, raw);
  stampMeta(key, updatedAtIso || new Date().toISOString());
  window.dispatchEvent(new CustomEvent("architect:kv", { detail: { key, raw, origin: "remote" } }));
}

export function useStorageState(key, initialValue) {
  const [value, setValue] = useState(initialValue);
  const [loaded, setLoaded] = useState(false);
  const idRef = useRef(++instanceSeq);
  const initRef = useRef(initialValue); // stable default for guards/listeners

  // Initial load — read-only; never writes back (see header note).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await storage.get(key);
        const parsed = safeParse(raw, initRef.current);
        if (!cancelled && parsed !== undefined) setValue(parsed);
      } catch { /* keep default; first real write replaces the bad record */
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [key]);

  // Live updates from other hook instances, other tabs, and the cloud.
  useEffect(() => {
    const applyRaw = (raw) => {
      const parsed = safeParse(raw, initRef.current);
      if (parsed !== undefined) { setValue(parsed); setLoaded(true); }
    };
    const onLocal = (e) => {
      if (e.detail?.key !== key) return;
      if (e.detail.origin === idRef.current) return; // our own write
      applyRaw(e.detail.raw);
    };
    const onStorage = (e) => {
      if (e.key !== PREFIX + key || e.newValue == null) return;
      applyRaw(e.newValue);
    };
    window.addEventListener("architect:kv", onLocal);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("architect:kv", onLocal);
      window.removeEventListener("storage", onStorage);
    };
  }, [key]);

  // Write-through setter: state, then (post-render) disk + broadcast + sync.
  const set = useCallback((updater) => {
    setValue((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      queueMicrotask(() => {
        const raw = JSON.stringify(next);
        storage.set(key, raw);
        stampMeta(key);
        window.dispatchEvent(new CustomEvent("architect:kv", { detail: { key, raw, origin: idRef.current } }));
        syncNotify?.(key, raw);
      });
      return next;
    });
    setLoaded(true);
  }, [key]);

  return [value, set, loaded];
}
