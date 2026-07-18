// Per-module atmosphere. In the premium black theme every module shares one
// identity — black base, a single crimson accent — so the app reads as one
// cohesive surface. Modules keep their distinct particle *behaviour* (mode)
// and mood, but not distinct colours. Kept deliberately low-key so the
// atmosphere recedes and the data carries the screen.
const A = "#E5484D";   // crimson accent
const A2 = "#5A2A2E";  // deep crimson-charcoal (secondary particles)
const BASE = "#000000";

const M = (mode, mood) => ({ accent: A, accent2: A2, base: BASE, mode, mood });

const MODULE_THEME = {
  dashboard: { name: "Command",   ...M("network", "command") },
  trading:   { name: "Trading",   ...M("data",    "grid") },
  finance:   { name: "Finance",   ...M("dust",    "marble") },
  athlete:   { name: "Athlete",   ...M("embers",  "arena") },
  life:      { name: "Life OS",   ...M("petals",  "night") },
  mind:      { name: "Mind",      ...M("network", "command") },
  faith:     { name: "Faith",     ...M("dust",    "night") },
  journey:   { name: "Journey",   ...M("embers",  "night") },
  analytics: { name: "Analytics", ...M("data",    "grid") },
  firm:      { name: "The Firm",  ...M("network", "command") },
};

export const themeFor = (module) => MODULE_THEME[module] || MODULE_THEME.dashboard;
