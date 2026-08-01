// ── Streak insurance — earn freeze tokens, protect a missed day ──────
// Anti-guilt, not cheating: you EARN one freeze token for every 7 active days
// (days that already have real activity), and may spend one to protect a
// single missed day so a long run survives one bad day. Protection is always
// explicit and visible — it never fabricates activity, it only tells the
// consistency engine "this specific day is covered". With no freezes stored,
// every export below is a no-op and streaks behave exactly as before.
import { localDateStr, daysAgoStr } from "./dates.js";

export const FREEZE_KEY = "streak_freezes";
const DAYS_PER_TOKEN = 7;

export function sanitizeFreezes(raw) {
  const frozen = Array.isArray(raw?.frozen) ? raw.frozen : [];
  const seen = new Set();
  const clean = [];
  for (const d of frozen) {
    if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d) && !seen.has(d)) { seen.add(d); clean.push(d); }
  }
  return { frozen: clean };
}

export const frozenSet = (freezes) => new Set(sanitizeFreezes(freezes).frozen);

// Days with real recorded activity (xpEngine's per-date totals).
export const activeDayCount = (byDay = {}) => Object.values(byDay || {}).filter((v) => (+v || 0) > 0).length;

export const earnedTokens = (byDay = {}) => Math.floor(activeDayCount(byDay) / DAYS_PER_TOKEN);

export function availableTokens(freezes, byDay = {}) {
  return Math.max(0, earnedTokens(byDay) - sanitizeFreezes(freezes).frozen.length);
}

// Compose a frozen-day override onto an optional base predicate, ready to hand
// straight to consistencyStats via `opts.isFull`. Returns undefined for
// unaffected days so the engine falls back to its normal anyXp() check.
export function makeIsFull(freezes, base = null) {
  const fs = frozenSet(freezes);
  if (!fs.size && !base) return undefined;
  return (d) => (fs.has(d) ? true : base ? base(d) : undefined);
}

// Toggle protection on a day (spends or refunds a token). Guarded so you can
// never protect more days than you've earned tokens for.
export function toggleFreeze(freezes, byDay, ds) {
  const cur = sanitizeFreezes(freezes);
  if (cur.frozen.includes(ds)) return { frozen: cur.frozen.filter((d) => d !== ds) };
  if (availableTokens(cur, byDay) <= 0) return cur; // no tokens left
  return { frozen: [...cur.frozen, ds] };
}

// The recent day-by-day picture the UI paints: active | protected | missed.
export function recentDays(byDay = {}, freezes, start, n = 14, today = localDateStr()) {
  const fs = frozenSet(freezes);
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = daysAgoStr(i);
    if (start && d < start) break;
    const active = (+byDay[d] || 0) > 0;
    out.push({ ds: d, state: active ? "active" : fs.has(d) ? "protected" : "missed", isToday: d === today });
  }
  return out;
}
