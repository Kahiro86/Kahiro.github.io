// ── useXp: one hook, the whole progression state ─────────────────────
// Subscribes to every store the XP engine derives from, so any qualifying
// action anywhere in the app updates XP instantly (and cross-tab / cross-
// device via the same sync events the stores already emit).
import { useMemo } from "react";
import { useStorageState } from "./useStorageState.js";
import { computeXp } from "./xpEngine.js";
import { gymSessionsToWorkouts } from "../modules/gym/gymSessions.js";

export function useXp() {
  const [habits, , l1] = useStorageState("habits", []);
  const [purity, , l2] = useStorageState("purity_log", {});
  const [trades] = useStorageState("ict_trades", []);
  const [reviews] = useStorageState("ict_reviews", []);
  const [workouts] = useStorageState("athlete_workouts", []);
  const [gymSessions] = useStorageState("gym_sessions", []);
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
  const [goals] = useStorageState("goals", []);
  const [wants] = useStorageState("wants", []);
  const [tiTrades] = useStorageState("ti_trades", []);
  const [photos] = useStorageState("athlete_photos", []);
  // New habit tracker's stores — a logged habit moves the shared level, the
  // Habit Mastery / Perfect Days / Streak journeys and the consistency
  // engine's life-day, all through the same derive-only pipeline.
  const [htHabits] = useStorageState("ht_habits", []);
  const [htEntries] = useStorageState("ht_entries", []);

  // Gym-facet sessions feed the same fitness pipeline by mapping to the legacy
  // `workouts` shape, so a logged workout moves the shared level, the Iron Body
  // journey and the consistency engine's fitness-day — no XP-engine changes.
  const allWorkouts = useMemo(
    () => [...(Array.isArray(workouts) ? workouts : []), ...gymSessionsToWorkouts(gymSessions)],
    [workouts, gymSessions]
  );

  const xp = useMemo(
    () => computeXp({
      habits, purity, trades, reviews, workouts: allWorkouts, measurements, finance,
      entries, missions, church, verses, faithNotes, library, mindNotes,
      decisions, unlocked, logins, nutrition, nutritionProfile, notifLog, goals, wants, tiTrades, photos,
      htHabits, htEntries,
    }),
    [habits, purity, trades, reviews, allWorkouts, measurements, finance,
     entries, missions, church, verses, faithNotes, library, mindNotes,
     decisions, unlocked, logins, nutrition, nutritionProfile, notifLog, goals, wants, tiTrades, photos,
     htHabits, htEntries]
  );

  return { ...xp, loaded: l1 && l2 && l3 && l4, setUnlocked, setLogins };
}
