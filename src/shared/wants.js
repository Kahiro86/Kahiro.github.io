// ── Want List — the personal dream vault ─────────────────────────────
// A long-term list of meaningful things worth saving for (for yourself or
// as gifts), built to reward patient, deliberate saving over impulse. It
// is NOT a shopping cart: every derived number celebrates progress and
// consistency, never spending.
//
// Same durability rule as the rest of the app: nothing important is stored
// as a mutable total. A want's saved amount, percentage, status, streak and
// every analytic derive from its immutable list of contributions, so the
// XP engine can read them idempotently and two devices always agree. The
// only stored pieces are the want records themselves (name, target, the
// contribution log, a manual archive flag, a purchase stamp).
import { localDateStr, daysAgoStr, daysBetween } from "./dates.js";

// ── Vocabulary ───────────────────────────────────────────────────────
export const WANT_CATEGORIES = [
  "Technology", "Fitness", "Clothing", "Watches", "Shoes", "Home",
  "Furniture", "Vehicle", "Travel", "Education", "Business", "Photography",
  "Gaming", "Books", "Collectibles", "Gifts", "Family", "Friends", "Other",
];

// A soft glyph per default category — used for the premium placeholder when
// a want has no image. Unknown/custom categories fall back to the vault key.
export const CATEGORY_ICON = {
  Technology: "💻", Fitness: "🏋️", Clothing: "🧥", Watches: "⌚", Shoes: "👟",
  Home: "🏠", Furniture: "🛋️", Vehicle: "🚗", Travel: "✈️", Education: "🎓",
  Business: "📈", Photography: "📷", Gaming: "🎮", Books: "📚",
  Collectibles: "🏆", Gifts: "🎁", Family: "❤️", Friends: "🤝", Other: "🗝️",
};
export const iconFor = (cat) => CATEGORY_ICON[cat] || "🗝️";

// Statuses are DERIVED (never hand-set) except the two real user actions:
// archiving (a flag) and purchasing (a stamp). Everything else follows the
// money automatically — dreaming → saving → ready.
export const STATUSES = ["dreaming", "saving", "ready", "purchased", "gifted", "archived"];
export const STATUS_LABEL = {
  dreaming: "Dreaming", saving: "Saving", ready: "Ready to Buy",
  purchased: "Purchased", gifted: "Gifted", archived: "Archived",
};

export const PRIORITIES = ["critical", "high", "medium", "low", "someday"];
export const PRIORITY_LABEL = {
  critical: "Critical", high: "High", medium: "Medium", low: "Low", someday: "Someday",
};
// Distinct indicator hues, legible on the black base.
export const PRIORITY_COLOR = {
  critical: "#F85149", high: "#E3B341", medium: "#4C8DFF", low: "#78C8FF", someday: "#7A7A7A",
};

// Where a contribution came from — reinforces that saving has real sources.
export const FUNDING_SOURCES = [
  { id: "salary", label: "Salary", icon: "💼" },
  { id: "trading", label: "Trading payout", icon: "📈" },
  { id: "side", label: "Side hustle", icon: "🛠️" },
  { id: "bonus", label: "Bonus", icon: "🎉" },
  { id: "gift", label: "Gift / birthday", icon: "🎁" },
  { id: "investment", label: "Investment profit", icon: "🏦" },
  { id: "manual", label: "Manual", icon: "✍️" },
];
export const sourceLabel = (id) => (FUNDING_SOURCES.find((s) => s.id === id) || { label: "Manual" }).label;

// Milestones worth celebrating on the way up.
export const MILESTONES = [10, 25, 50, 75, 90, 100];

// Progress-bar colour ramp — a deliberate motivational device: the closer to
// the target, the warmer the bar, culminating in emerald at 100%.
export function progressColor(pct) {
  if (pct >= 100) return "#3FB950"; // emerald — fulfilled
  if (pct >= 75) return "#F0B429";  // gold
  if (pct >= 50) return "#9B7CE0";  // purple
  if (pct >= 25) return "#4C8DFF";  // blue
  return "#8A8A8A";                 // grey — just beginning
}

// Money, Kenyan-shilling style: "KSh 120,000".
export const fmtKsh = (n) => `KSh ${Math.round(+n || 0).toLocaleString("en-US")}`;

// ── Sanitisation ─────────────────────────────────────────────────────
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const dOf = (v) => (typeof v === "string" && DATE_RE.test(v.slice(0, 10)) ? v.slice(0, 10) : null);
const num = (v, min = 0) => (Number.isFinite(+v) ? Math.max(min, +v) : min);
const str = (v, max) => (typeof v === "string" ? v.slice(0, max) : "");

function sanitizeContribs(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const c of raw) {
    if (!c || typeof c !== "object") continue;
    const amount = num(c.amount);
    if (amount <= 0) continue; // a contribution is money in — zero/neg is noise
    out.push({
      id: c.id ? String(c.id) : `c${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
      amount,
      date: dOf(c.date) || localDateStr(),
      source: FUNDING_SOURCES.some((s) => s.id === c.source) ? c.source : "manual",
      note: str(c.note, 200),
    });
  }
  // Oldest → newest, so "first contribution" and timelines are stable.
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function sanitizeWants(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const w of raw) {
    if (!w || typeof w !== "object" || !w.id || typeof w.name !== "string" || !w.name.trim()) continue;
    const forWhom = w.forWhom === "gift" ? "gift" : "me";
    out.push({
      id: String(w.id),
      name: w.name.trim().slice(0, 120),
      category: typeof w.category === "string" && w.category.trim() ? w.category.trim().slice(0, 40) : "Other",
      forWhom,
      recipient: forWhom === "gift" ? str(w.recipient, 60) : "",
      occasion: forWhom === "gift" ? str(w.occasion, 60) : "",
      giftDate: forWhom === "gift" ? dOf(w.giftDate) : null,
      priority: PRIORITIES.includes(w.priority) ? w.priority : "medium",
      target: num(w.target) || 1,
      image: typeof w.image === "string" ? w.image.slice(0, 500000) : "",
      note: str(w.note, 800),
      contributions: sanitizeContribs(w.contributions),
      createdAt: dOf(w.createdAt) || localDateStr(),
      purchasedAt: dOf(w.purchasedAt),
      finalCost: w.finalCost == null ? null : num(w.finalCost),
      archived: !!w.archived,
      editedAt: typeof w.editedAt === "string" ? w.editedAt : null,
    });
  }
  return out;
}

export const newWant = (patch = {}) =>
  sanitizeWants([{
    id: `w${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
    name: "", category: "Other", forWhom: "me", priority: "medium", target: 1,
    contributions: [], createdAt: localDateStr(), purchasedAt: null, finalCost: null,
    archived: false, ...patch,
  }])[0];

// ── Per-item derivation ──────────────────────────────────────────────
export const savedOf = (w) => (w.contributions || []).reduce((s, c) => s + (+c.amount || 0), 0);
export const remainingOf = (w) => Math.max(0, (w.target || 0) - savedOf(w));
export const pctOf = (w) => (w.target > 0 ? Math.min(100, Math.round((savedOf(w) / w.target) * 1000) / 10) : 0);

// Effective status — money-driven, with the two manual overrides on top.
export function statusOf(w) {
  if (w.archived) return "archived";
  if (w.purchasedAt) return w.forWhom === "gift" ? "gifted" : "purchased";
  const saved = savedOf(w);
  if (saved >= w.target) return "ready";
  if (saved > 0) return "saving";
  return "dreaming";
}
export const isComplete = (w) => !!w.purchasedAt;
export const isActive = (w) => !w.archived && !w.purchasedAt;

// Which milestones a want has crossed (for the celebrate-on-cross logic).
export const crossedMilestones = (pct) => MILESTONES.filter((m) => pct >= m);
export const highestMilestone = (pct) => crossedMilestones(pct).slice(-1)[0] || 0;

// Timeline facts a card can show without recomputing.
export function timelineOf(w) {
  const cs = w.contributions || [];
  const first = cs[0]?.date || null;
  const last = cs[cs.length - 1]?.date || null;
  const saved = savedOf(w);
  // Average-per-week is floored at a one-week span: you can't honestly claim a
  // weekly rate from less than a week of data, and without the floor a single
  // same-day contribution extrapolates to an absurd "KSh 325k/week".
  const spanDays = first ? daysBetween(first, w.purchasedAt || localDateStr()) : 0;
  const weeks = Math.max(1, spanDays / 7);
  const perWeek = first ? saved / weeks : 0;
  const remaining = remainingOf(w);
  // Estimated completion: at the current weekly pace, when does the gap close?
  let etaDays = null;
  if (!w.purchasedAt && remaining > 0 && perWeek > 0) etaDays = Math.ceil((remaining / perWeek) * 7);
  const etaDate = etaDays != null ? daysAgoStr(-etaDays) : null;
  return {
    first, last, saved, remaining,
    daysSaving: spanDays,
    perWeek: Math.round(perWeek),
    etaDays, etaDate,
    durationDays: w.purchasedAt && first ? daysBetween(first, w.purchasedAt) : null,
  };
}

// ── Mutations (all go through sanitize so a bad store self-heals) ─────
export function addContribution(wants, id, { amount, date, source = "manual", note = "" }) {
  const amt = num(amount);
  if (amt <= 0) return sanitizeWants(wants);
  return sanitizeWants(wants).map((w) =>
    w.id === id
      ? { ...w, contributions: [...w.contributions, { id: `c${Date.now()}${Math.random().toString(36).slice(2, 6)}`, amount: amt, date: dOf(date) || localDateStr(), source, note: str(note, 200) }] }
      : w);
}
export function removeContribution(wants, id, contribId) {
  return sanitizeWants(wants).map((w) =>
    w.id === id ? { ...w, contributions: w.contributions.filter((c) => c.id !== contribId) } : w);
}
export function markPurchased(wants, id, { date, finalCost } = {}) {
  return sanitizeWants(wants).map((w) => {
    if (w.id !== id) return w;
    const fc = finalCost == null || finalCost === "" ? savedOf(w) : num(finalCost);
    return { ...w, purchasedAt: dOf(date) || localDateStr(), finalCost: fc };
  });
}
export function updateWant(wants, id, patch) {
  return sanitizeWants(wants).map((w) => (w.id === id ? sanitizeWants([{ ...w, ...patch, id: w.id, editedAt: new Date().toISOString() }])[0] : w));
}
export const archiveWant = (wants, id, on = true) => updateWant(wants, id, { archived: on });

// ── Portfolio analytics ──────────────────────────────────────────────
export function wantsAnalytics(raw) {
  const wants = sanitizeWants(raw).filter((w) => !w.archived);
  const active = wants.filter((w) => !w.purchasedAt);
  const done = wants.filter((w) => w.purchasedAt);
  const totalValue = active.reduce((s, w) => s + w.target, 0);
  const totalSaved = active.reduce((s, w) => s + savedOf(w), 0);
  const totalRemaining = active.reduce((s, w) => s + remainingOf(w), 0);
  const ym = localDateStr().slice(0, 7);
  const savedThisMonth = wants.reduce((s, w) => s + w.contributions.filter((c) => c.date.slice(0, 7) === ym).reduce((a, c) => a + c.amount, 0), 0);
  // Average saving speed across every active want with history (KSh/week).
  const speeds = active.map((w) => timelineOf(w).perWeek).filter((v) => v > 0);
  const avgSpeed = speeds.length ? Math.round(speeds.reduce((a, b) => a + b, 0) / speeds.length) : 0;
  const byPct = [...active].sort((a, b) => pctOf(b) - pctOf(a));
  return {
    totalWants: active.length,
    totalValue, totalSaved, totalRemaining,
    completed: done.length,
    completionRate: wants.length ? Math.round((done.length / wants.length) * 100) : 0,
    avgSpeed, savedThisMonth,
    committed: totalSaved, // money currently parked toward active wants
    biggest: active.reduce((m, w) => (!m || w.target > m.target ? w : m), null),
    closest: byPct.find((w) => pctOf(w) < 100) || byPct[0] || null,
    newest: active.reduce((m, w) => (!m || w.createdAt > m.createdAt ? w : m), null),
  };
}

// Money currently committed across active wants — surfaced against the
// Finance savings balance so committed vs free is always honest.
export const committedSavings = (raw) =>
  sanitizeWants(raw).filter(isActive).reduce((s, w) => s + savedOf(w), 0);

// ── Rule-based smart suggestions (no AI, just honest arithmetic) ──────
// Encouraging, specific, one-tap actionable — same voice as insights.js.
export function suggestionsFor(w) {
  if (w.purchasedAt || w.archived) return [];
  const out = [];
  const pct = pctOf(w);
  const remaining = remainingOf(w);
  const t = timelineOf(w);
  if (pct >= 100) { out.push("Fully funded — ready to buy. 🎉"); return out; }
  if (remaining > 0 && remaining <= 10000) out.push(`Only ${fmtKsh(remaining)} left — one good week away.`);
  if (pct >= 90) out.push("So close. This goal is almost complete.");
  else if (pct >= 50) out.push("Past halfway — the hardest part is behind you.");
  if (t.etaDays != null) {
    const wk = Math.round(t.etaDays / 7);
    out.push(t.etaDays <= 14 ? `At your pace you'll reach this in ${t.etaDays} days.` : `On track — about ${wk} week${wk === 1 ? "" : "s"} to go at your current pace.`);
  }
  if (t.last) {
    const gap = daysBetween(t.last, localDateStr());
    if (gap >= 14) out.push(`No contribution in ${Math.floor(gap / 7)} weeks — even a small amount keeps momentum.`);
  } else {
    out.push("No savings yet — the first contribution is the one that matters most.");
  }
  return out.slice(0, 3);
}

// ── Want-List achievements (the module's own Hall of Fame) ───────────
// Derived live from the store — nothing here can be edited into existence.
// The badges mirror the global XP journeys but are shown in-module for a
// self-contained "dream vault" trophy wall.
export function wantAchievements(raw) {
  const wants = sanitizeWants(raw);
  const done = wants.filter((w) => w.purchasedAt);
  const gifts = done.filter((w) => w.forWhom === "gift");
  const lifetimeSaved = wants.reduce((s, w) => s + savedOf(w), 0);
  const dreamChasers = wants.filter((w) => !w.purchasedAt && pctOf(w) >= 50).length;
  const streak = bestContribStreak(contributionDays(wants));
  const defs = [
    { id: "first_goal", icon: "🌱", name: "First Goal Started", desc: "Add your first want", got: wants.length >= 1 },
    { id: "first_buy", icon: "✨", name: "First Purchase", desc: "Fulfil your first want", got: done.length >= 1 },
    { id: "ten_done", icon: "🏅", name: "10 Goals Completed", desc: "Fulfil 10 wants", got: done.length >= 10 },
    { id: "saved_100k", icon: "💎", name: "KSh 100,000 Saved", desc: "Save KSh 100k in total", got: lifetimeSaved >= 100000 },
    { id: "consistent", icon: "🔥", name: "Consistent Saver", desc: "30-day contribution streak", got: streak >= 30 },
    { id: "gifter", icon: "🎁", name: "Gift Giver", desc: "Complete 5 gifts", got: gifts.length >= 5 },
    { id: "dream_chaser", icon: "🌠", name: "Dream Chaser", desc: "50%+ on five active goals", got: dreamChasers >= 5 },
    { id: "collector", icon: "👑", name: "Collector", desc: "25 completed goals", got: done.length >= 25 },
  ];
  return defs;
}

// ── Contribution-streak helpers (also used by the XP engine) ─────────
// The set of distinct dates on which ANY want received a contribution.
export function contributionDays(raw) {
  const days = new Set();
  for (const w of sanitizeWants(raw)) for (const c of w.contributions) days.add(c.date);
  return days;
}
// Longest run of consecutive calendar days that each had a contribution.
export function bestContribStreak(daySet) {
  const days = [...daySet].sort();
  let best = 0, run = 0, prev = null;
  for (const d of days) {
    if (prev && daysBetween(prev, d) === 1) run += 1;
    else run = 1;
    if (run > best) best = run;
    prev = d;
  }
  return best;
}
