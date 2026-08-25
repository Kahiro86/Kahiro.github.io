// ── Linked metrics, for readers ──────────────────────────────────────
// One hook so every surface that reports hydration or sleep gets the same
// three inputs: the direct hydration log, and the claim maps from whichever
// habits are linked. Without it each screen would have to remember to pass
// `claims`, and the ones that forgot would quietly disagree with the ones
// that didn't — which is the exact failure this work exists to end.
import { useMemo } from "react";
import { useStorageState } from "./useStorageState.js";
import { linkedClaims } from "../modules/habits/linkSync.js";

export function useLinkedMetrics() {
  const [habits] = useStorageState("ht_habits", []);
  const [entries] = useStorageState("ht_entries", []);
  const [meta] = useStorageState("ht_meta", {});
  const [hydration] = useStorageState("hydration_log", {});
  const claims = useMemo(
    () => linkedClaims({ habits, entries, meta, writes: {} }),
    [habits, entries, meta]
  );
  return { hydration, claims };
}
