// Per-module atmosphere. Each module is a "world" — a mood, an accent, and a
// particle behaviour. Text/data colours stay in designTokens; these only drive
// the ambient background so each section feels distinct even with no text.
export const MODULE_THEME = {
  dashboard:    { name: "Command", accent: "#8FD3FF", accent2: "#E8EDF5", base: "#05070F", mode: "network", mood: "command" },
  trading:      { name: "Trading", accent: "#4CC6FF", accent2: "#0EA5E9", base: "#050A13", mode: "data",    mood: "grid" },
  finance:      { name: "Finance", accent: "#E7C77B", accent2: "#C99A34", base: "#0B0803", mode: "dust",    mood: "marble" },
  athlete:      { name: "Athlete", accent: "#34D399", accent2: "#F0526B", base: "#07090A", mode: "embers",  mood: "arena" },
  life:         { name: "Life OS", accent: "#C4B5FD", accent2: "#8CE0A6", base: "#08060F", mode: "petals",  mood: "night" },
  relations:    { name: "Relationships", accent: "#F0A6C0", accent2: "#C4B5FD", base: "#0B060C", mode: "dust", mood: "night" },
  knowledge:    { name: "Knowledge", accent: "#9DB4FF", accent2: "#C4B5FD", base: "#06080F", mode: "network", mood: "command" },
  productivity: { name: "Productivity", accent: "#7DE0D0", accent2: "#8FD3FF", base: "#05090E", mode: "data", mood: "grid" },
  health:       { name: "Health", accent: "#7BE0A6", accent2: "#8FD3FF", base: "#06090C", mode: "dust", mood: "arena" },
};

export const themeFor = (module) => MODULE_THEME[module] || MODULE_THEME.dashboard;
