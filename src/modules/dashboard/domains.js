import { CY, PU, GR, AM, OR, RE } from "../../shared/designTokens.js";

export const DOMAINS = [
  { key: "trading", label: "TRADING",  color: CY, score: 78, r: 44 },
  { key: "athlete", label: "ATHLETIC", color: PU, score: 82, r: 61 },
  { key: "finance", label: "FINANCE",  color: GR, score: 71, r: 78 },
  { key: "life",    label: "LIFE OS",  color: AM, score: 65, r: 95 },
  { key: "social",  label: "SOCIAL",   color: OR, score: 74, r: 112 },
  { key: "health",  label: "HEALTH",   color: RE, score: 80, r: 129 },
];

export const HABITS_DEF = [
  { name: "Morning Protocol", streak: 12, done: true,  icon: "☀️" },
  { name: "Trade Review",     streak: 8,  done: true,  icon: "📊" },
  { name: "Zone 2 Session",   streak: 5,  done: false, icon: "🏃" },
  { name: "Evening Journal",  streak: 15, done: true,  icon: "📝" },
  { name: "Cold Exposure",    streak: 3,  done: false, icon: "🧊" },
  { name: "Protein Target",   streak: 9,  done: true,  icon: "🥩" },
];
