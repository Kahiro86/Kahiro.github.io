// ── Auto-goal syncer ─────────────────────────────────────────────────
// Always mounted. Goals bound to a live source (books finished, trades
// journaled, clean days…) advance themselves: whenever the derived XP
// stats change, this write-throughs each auto-goal's current value and
// its checkpoint/completion stamps back into the synced `goals` store —
// the same write-through pattern XPCelebration uses for xp_achievements.
// The write is essential (not just cosmetic): goal-completion XP derives
// from `completedAt` in the store, so an auto-completed goal only pays out
// once its stamp is persisted. Idempotent and convergent — once written,
// current === stat − base is a fixed point, so it settles in one pass.
import { useEffect } from "react";
import { useStorageState } from "./useStorageState.js";
import { sanitizeGoals, syncAutoGoals } from "./goals.js";

export function AutoGoalSync({ xp }) {
  const [rawGoals, setGoals, loaded] = useStorageState("goals", []);

  useEffect(() => {
    if (!loaded || !xp?.loaded || !xp.stats) return;
    // Only touch the store when the synced result actually differs, so this
    // never fights the user's own edits or loops against its own writes.
    const current = sanitizeGoals(rawGoals);
    if (!current.some((g) => g.source)) return; // no auto-goals → nothing to do
    const next = syncAutoGoals(current, xp.stats);
    if (JSON.stringify(next) !== JSON.stringify(current)) {
      setGoals(next);
    }
  }, [loaded, xp?.loaded, xp?.stats, rawGoals]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
