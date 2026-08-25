import { PU, CY, OR, T3 } from "../../shared/designTokens.js";

// The actual weekly training schedule, from the user's own plan. This is not
// decoration: directive.js reads `type === "Rest"` to decide whether a day
// without a session is a miss, and the Notification Center announces today's
// and tomorrow's session by it. The previous table was a generic
// upper/lower/cardio split that disagreed with the real week in two ways
// that both mattered — it called Thursday a rest day (it is the second lower
// session) and Saturday cardio (it is skill work, deliberately light).
//
// Only Sunday is type "Rest". Saturday is active recovery, which is still
// training: the app should expect something to be logged, just not a grind.
export const WEEK_PLAN = [
  { day: "MON", type: "Lower + Power",       icon: "🦵", color: PU },
  { day: "TUE", type: "Upper · Push + Pull", icon: "💪", color: PU },
  { day: "WED", type: "Endurance + Mobility", icon: "🏃", color: CY },
  { day: "THU", type: "Lower + Athleticism", icon: "🦵", color: PU },
  { day: "FRI", type: "Upper · Pull-biased", icon: "💪", color: OR },
  { day: "SAT", type: "Active Recovery",     icon: "🧘", color: CY },
  { day: "SUN", type: "Rest",                icon: "😴", color: T3 },
];

