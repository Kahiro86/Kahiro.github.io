// Per-module atmosphere. In the premium black theme every module shares one
// identity — black base, the Nocturne cyan/gold accent pair — so the app
// reads as one cohesive surface. Modules keep their distinct particle
// *behaviour* (mode), and now all share the live collage moodboard as their
// backdrop. Kept deliberately low-key so the atmosphere recedes and the data
// carries the screen.
const A = "#78C8FF";   // Nocturne cyan accent
const A2 = "#1E3A4D";  // deep cyan-charcoal (secondary particles)
const BASE = "#000000";

const M = (mode, mood) => ({ accent: A, accent2: A2, base: BASE, mode, mood });

const MODULE_THEME = {
  dashboard: { name: "Command",   ...M("network", "collage") },
  trading:   { name: "Trading",   ...M("data",    "collage") },
  finance:   { name: "Finance",   ...M("dust",    "collage") },
  athlete:   { name: "Athlete",   ...M("embers",  "collage") },
  life:      { name: "Life OS",   ...M("petals",  "collage") },
  mind:      { name: "Mind",      ...M("network", "collage") },
  faith:     { name: "Faith",     ...M("dust",    "collage") },
  journey:   { name: "Journey",   ...M("embers",  "collage") },
  analytics: { name: "Analytics", ...M("data",    "collage") },
  firm:      { name: "The Firm",  ...M("network", "collage") },
};

export const themeFor = (module) => MODULE_THEME[module] || MODULE_THEME.dashboard;
