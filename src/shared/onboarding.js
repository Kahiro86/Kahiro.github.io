// ── Onboarding progress & "What's New" ───────────────────────────────
// A lightweight getting-started checklist (derived from real data, nothing
// new stored to track it) and the changelog the What's New popup shows on a
// version bump. Kept as plain data + one pure helper.

export const CHECKLIST = [
  { id: "tour",    label: "Take the guided tour",     hint: "See the whole app in 30 seconds." },
  { id: "habit",   label: "Log your first habit",     hint: "Tap one done in Life OS." },
  { id: "explore", label: "Explore another module",   hint: "Open Life, the Firm, Faith, Journey or Analytics." },
  { id: "goal",    label: "Set a goal",               hint: "Journey → Goals." },
  { id: "help",    label: "Browse the Help Centre",   hint: "Search anything, anytime." },
];

// Derive completion from what already exists — habit logs, goals, and a few
// interaction flags kept on the `onboarding` object.
export function computeChecklist({ onboard = {}, habits = [], goals = [] } = {}) {
  const ob = onboard && typeof onboard === "object" ? onboard : {};
  const done = {
    tour: !!ob.overviewSeen,
    habit: (Array.isArray(habits) ? habits : []).some((h) => h && h.log && Object.keys(h.log).length > 0),
    explore: Array.isArray(ob.explored) && ob.explored.length > 0,
    goal: (Array.isArray(goals) ? goals : []).filter((g) => g && g.id).length > 0,
    help: !!ob.helpBrowsed,
  };
  const items = CHECKLIST.map((c) => ({ ...c, done: !!done[c.id] }));
  const count = items.filter((i) => i.done).length;
  return { items, count, total: items.length, pct: Math.round((count / items.length) * 100), allDone: count === items.length };
}

// Bump `version` whenever there's something worth a What's New popup.
export const WHATS_NEW = {
  version: "3.1",
  title: "What's new in Kahiro",
  items: [
    { icon: "🧭", h: "Guided tour & Help Centre", p: "Learn every part of the app with a highlighted walkthrough and a searchable manual — tap the ? in the header anytime." },
    { icon: "😴", h: "Rest days & cheat days", p: "Mark a planned rest or cheat day and your streaks stay safe — recovery counts, it doesn't break the chain." },
    { icon: "✍️", h: "Editable profile & measurements", p: "Your age, height, weight and every logged measurement are now fully editable." },
  ],
};
