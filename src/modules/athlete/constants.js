import { PU, CY, OR, T3 } from "../../shared/designTokens.js";

export const WEEK_PLAN = [
  { day: "MON", type: "Upper Body", icon: "💪", color: PU },
  { day: "TUE", type: "Cardio",     icon: "🏃", color: CY },
  { day: "WED", type: "Lower Body", icon: "🦵", color: PU },
  { day: "THU", type: "Rest",       icon: "😴", color: T3 },
  { day: "FRI", type: "Full Body",  icon: "🔥", color: OR },
  { day: "SAT", type: "Cardio",     icon: "🏃", color: CY },
  { day: "SUN", type: "Rest",       icon: "😴", color: T3 },
];

export const EXERCISE_LIBRARY = [
  "Squat", "Deadlift", "Bench Press", "Overhead Press", "Pull-up", "Barbell Row",
  "Hip Thrust", "Lunges", "Dips", "Bicep Curl", "Tricep Extension", "Lat Pulldown",
  "Leg Press", "Leg Curl", "Calf Raise", "Shoulder Press", "Face Pulls", "Plank", "Custom",
];
