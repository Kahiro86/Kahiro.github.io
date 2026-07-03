import { useEffect, useState } from "react";
import { storage } from "./storage.js";

// Loads `key` from the storage adapter on mount, then persists on every change.
// `loaded` lets callers avoid rendering/saving default data before the real value arrives.
export function useStorageState(key, initialValue) {
  const [value, setValue] = useState(initialValue);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const raw = await storage.get(key);
      if (!cancelled && raw != null) setValue(JSON.parse(raw));
      if (!cancelled) setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    storage.set(key, JSON.stringify(value));
  }, [key, value, loaded]);

  return [value, setValue, loaded];
}
