// ── Identity System (Kaizen phase 11) ───────────────────────────────
// "Who am I becoming" — each identity maps to activity domains, and its
// reinforcement is simply real completions in those domains this week.
// Votes for the person you're becoming, counted from actual records.
import { isDone, isScheduled } from "./habitEngine.js";
import { daysAgoStr } from "./dates.js";

export const DEFAULT_IDENTITIES = [
  { id: "trader",  name: "Disciplined Trader", icon: "📊", domains: ["trading"] },
  { id: "athlete", name: "Hybrid Athlete",     icon: "🏃", domains: ["training"] },
  { id: "faith",   name: "Faithful Disciple",  icon: "🙏", domains: ["faith"] },
  { id: "wealth",  name: "Wealth Builder",     icon: "💰", domains: ["finance"] },
  { id: "learner", name: "Lifelong Learner",   icon: "📖", domains: ["mind", "journal"] },
];

export const sanitizeIdentities = (raw) => {
  const list = (Array.isArray(raw) ? raw : []).filter((x) => x && x.id && x.name);
  return list.length ? list : DEFAULT_IDENTITIES;
};

// Reinforcement this week: completions in the identity's domains over the
// last 7 days. Habit categories map to domains via keywords; trades and
// workouts count directly.
const CAT_DOMAIN = {
  Spiritual: "faith", Trading: "trading", Finance: "finance", Fitness: "training",
  Health: "training", Learning: "mind", "Personal Growth": "journal", Nutrition: "training",
};

export function identityVotes(identities, { habits = [], trades = [], workouts = [], entries = [] }) {
  const votes = Object.fromEntries(identities.map((i) => [i.id, 0]));
  const since = daysAgoStr(6);
  const add = (domain, n = 1) => {
    for (const i of identities) if ((i.domains || []).includes(domain)) votes[i.id] += n;
  };
  for (const h of habits) {
    if (!h || h.archived) continue;
    const domain = CAT_DOMAIN[h.category];
    if (!domain) continue;
    for (let d = 0; d < 7; d++) {
      const ds = daysAgoStr(d);
      if (isScheduled(h, ds) && isDone(h, ds)) add(domain);
    }
  }
  add("trading", trades.filter((t) => t && t.status === "CLOSED" && t.date >= since).length);
  add("training", workouts.filter((w) => w && w.date >= since).length);
  add("journal", entries.filter((e) => e && (e.date || "").slice(0, 10) >= since).length);
  return votes;
}
