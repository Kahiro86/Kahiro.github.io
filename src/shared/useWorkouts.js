// ── One workout list, for every reader ───────────────────────────────
// Training used to be written to `athlete_workouts` by the retired Athlete
// module. The Gym port writes `gym_sessions` instead, and Gate 2 made Body
// the only place a session is logged — but the legacy store still holds real
// history, so both are sources and neither may be dropped.
//
// Every analytical view reads through here. Reading `athlete_workouts`
// directly is what made the dashboard, calendar, analytics and the reviews
// all report zero training while sessions were being logged daily.
import { useMemo } from "react";
import { useStorageState } from "./useStorageState.js";
import { gymSessionsToWorkouts } from "../modules/gym/gymSessions.js";

/** Legacy workouts + gym sessions, in the one shape every consumer expects. */
export function useWorkouts() {
  const [legacy] = useStorageState("athlete_workouts", []);
  const [sessions] = useStorageState("gym_sessions", []);
  return useMemo(
    () => [...(Array.isArray(legacy) ? legacy.filter(Boolean) : []), ...gymSessionsToWorkouts(sessions)],
    [legacy, sessions],
  );
}
