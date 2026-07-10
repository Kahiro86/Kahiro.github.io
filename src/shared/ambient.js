// Per-module atmosphere. Each module is a "world" — a mood, an accent, and a
// particle behaviour. Text/data colours stay in designTokens; these only drive
// the ambient background so each section feels distinct even with no text.
// Palette is deliberately muted (~90% desaturated): dull, low-key accents so
// the atmosphere recedes and the data carries the colour.
const MODULE_THEME = {
  dashboard: { name: "Command",   accent: "#8E96A3", accent2: "#6B7280", base: "#07080A", mode: "network", mood: "command" }, // deep graphite, soft white
  trading:   { name: "Trading",   accent: "#5E8A9C", accent2: "#8C5A62", base: "#060A0D", mode: "data",    mood: "grid" },    // muted cyan / crimson
  finance:   { name: "Finance",   accent: "#6F8F7F", accent2: "#A5946B", base: "#090804", mode: "dust",    mood: "marble" },  // muted emerald / gold
  athlete:   { name: "Athlete",   accent: "#6C8EB5", accent2: "#7A8E9C", base: "#07090B", mode: "embers",  mood: "arena" },   // muted electric blue
  life:      { name: "Life OS",   accent: "#6E8B74", accent2: "#8FA58E", base: "#070907", mode: "petals",  mood: "night" },   // muted forest green
  mind:      { name: "Mind",      accent: "#767FA6", accent2: "#8B8FB0", base: "#07080D", mode: "network", mood: "command" }, // muted indigo
  faith:     { name: "Faith",     accent: "#B09A6F", accent2: "#C0AE8C", base: "#0A0906", mode: "dust",    mood: "night" },   // muted amber
  analytics: { name: "Analytics", accent: "#8B7CA0", accent2: "#9C90AE", base: "#08070C", mode: "data",    mood: "grid" },    // muted purple
};

export const themeFor = (module) => MODULE_THEME[module] || MODULE_THEME.dashboard;
