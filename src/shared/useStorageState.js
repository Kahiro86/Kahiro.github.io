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
      try {
        const raw = await storage.get(key);
        // Corrupt/half-written JSON must never throw here — it would leave the
        // store silently un-persisted. Fall back to the default and heal on
        // the next write instead. A stored literal `null` (valid JSON) is also
        // rejected: it would otherwise replace an array/object default with
        // null and crash every `.filter`/`.map` downstream.
        if (!cancelled && raw != null) {
          const parsed = JSON.parse(raw);
          // Reject values that can't stand in for the default: null/undefined,
          // or a shape mismatch (an object stored where an array is expected,
          // or vice-versa). Either would crash `.filter`/`.map` downstream.
          const shapeOk =
            parsed != null &&
            (typeof initialValue !== "object" ||
              initialValue == null ||
              Array.isArray(parsed) === Array.isArray(initialValue));
          if (shapeOk) setValue(parsed);
        }
      } catch {
        /* keep initialValue; the next set() overwrites the bad record */
      } finally {
        if (!cancelled) setLoaded(true);
      }
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
