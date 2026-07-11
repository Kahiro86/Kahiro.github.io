// ── useXp: one hook, the whole progression state ─────────────────────
// Subscribes to every store the XP engine derives from, so any qualifying
// action anywhere in the app updates XP instantly (and cross-tab / cross-
// device via the same sync events the stores already emit).
import { useMemo } from "react";
import { useStorageState } from "./useStorageState.js";
import { computeXp } from "./xpEngine.js";

export function useXp() {
  const [habits, , l1] = useStorageState("habits", []);
  const [purity, , l2] = useStorageState("purity_log", {});
  const [trades] = useStorageState("ict_trades", []);
  const [reviews] = useStorageState("ict_reviews", []);
  const [workouts] = useStorageState("athlete_workouts", []);
  const [measurements] = useStorageState("athlete_measurements", []);
  const [nutrition] = useStorageState("nutrition_log", {});
  const [nutritionProfile] = useStorageState("nutrition_profile", null);
  const [finance] = useStorageState("finance_state", null);
  const [entries] = useStorageState("journal_entries", []);
  const [missions] = useStorageState("missions", []);
  const [church] = useStorageState("faith_church", []);
  const [verses] = useStorageState("faith_scripture", []);
  const [faithNotes] = useStorageState("faith_notes", []);
  const [library] = useStorageState("mind_library", []);
  const [mindNotes] = useStorageState("mind_notes", []);
  const [decisions] = useStorageState("mind_decisions", []);
  const [unlocked, setUnlocked, l3] = useStorageState("xp_achievements", {});
  const [logins, setLogins, l4] = useStorageState("xp_logins", {});
  const [notifLog] = useStorageState("notif_log", []);

  const xp = useMemo(
    () => computeXp({
      habits, purity, trades, reviews, workouts, measurements, finance,
      entries, missions, church, verses, faithNotes, library, mindNotes,
      decisions, unlocked, logins, nutrition, nutritionProfile, notifLog,
    }),
    [habits, purity, trades, reviews, workouts, measurements, finance,
     entries, missions, church, verses, faithNotes, library, mindNotes,
     decisions, unlocked, logins, nutrition, nutritionProfile, notifLog]
  );

  return { ...xp, loaded: l1 && l2 && l3 && l4, setUnlocked, setLogins };
}
