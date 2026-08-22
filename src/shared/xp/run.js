// ── Running the ledger ───────────────────────────────────────────────
// Collect events → price each day → bank it. This is the only path by which
// a number reaches the user's total.
//
// Ordering matters and is deliberate: difficulty is measured once over the
// trailing window, the balance factor reads the ledger's own trailing week
// (not the day being priced, which would be circular), and days are banked
// oldest-first so each day's balance factor sees only what came before it.
import { localDateStr } from "../dates.js";
import { collectEvents } from "./collect.js";
import { priceDay, balanceFactors, consistencyMultiplier, inRecovery } from "./engine.js";
import { difficultyMap } from "./difficulty.js";
import {
  sanitizeLedger, openLedger, bankDay, bankedTotal, recentByDomain, activeDays,
} from "./ledger.js";
import { levelFromXp, rankFor, xpForLevel, BALANCE_WINDOW_DAYS } from "./values.js";

const back = (today, n) => { const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() - n); return localDateStr(d); };

/** Current daily streak from the set of days with any earning activity. */
export function streakFrom(active, today = localDateStr()) {
  let n = 0;
  // Today not yet earning does not break a streak — the day is not over.
  let cursor = active.has(today) ? today : back(today, 1);
  while (active.has(cursor)) { n++; cursor = back(cursor, 1); }
  return n;
}

/**
 * @param deps   the same store bundle computeXp reads
 * @param ledger the stored xp_ledger (or null on a first run)
 * @param derivedTotal the pre-revamp total, used once to open the ledger
 */
export function runXp({ deps = {}, ledger = null, derivedTotal = 0, today = localDateStr(), isScheduledOn } = {}) {
  const opened = openLedger(ledger, derivedTotal, today);
  let led = opened.ledger;

  const events = collectEvents(deps, today);
  const diff = difficultyMap({ habits: deps.htHabits, entries: deps.htEntries, isScheduledOn, today });

  // Days needing work: anything with events that is not already sealed.
  const candidates = Object.keys(events).filter((ds) => ds <= today).sort();
  const pending = candidates.filter((ds) => !sanitizeLedger(led).days[ds]?.sealedAt);

  // Recovery and streak read the days that actually earned — which includes
  // days already banked, so a returning user is recognised immediately.
  const earning = new Set([...activeDays(led), ...candidates.filter((ds) => (events[ds] || []).length)]);

  for (const ds of pending) {
    const balance = balanceFactors(recentByDomain(led, back(ds, 1), BALANCE_WINDOW_DAYS));
    const streak = streakFrom(earning, ds);
    const priced = priceDay(events[ds], {
      difficulty: diff.byHabit,
      consistency: consistencyMultiplier(streak),
      recovery: inRecovery(ds, earning),
      balance,
    });
    led = bankDay(led, ds, priced, today).ledger;
  }

  const clean = sanitizeLedger(led);
  const total = bankedTotal(clean);
  const lvl = levelFromXp(total);
  const byDay = {};
  for (const [ds, d] of Object.entries(clean.days)) byDay[ds] = d.total;
  const byDomain = {};
  for (const d of Object.values(clean.days)) for (const [k, v] of Object.entries(d.byDomain)) byDomain[k] = (byDomain[k] || 0) + v;

  return {
    ledger: clean,
    total,
    opening: clean.opening,
    byDay,
    byDomain,
    today: clean.days[today] || { total: 0, byDomain: {}, lines: [], sealedAt: null },
    level: lvl.level,
    xpIntoLevel: lvl.xpIntoLevel,
    xpForNext: lvl.xpForNext,
    toNext: lvl.toNext,
    nextLevelXp: lvl.nextAt,
    rank: rankFor(lvl.level),
    streak: streakFrom(new Set(Object.keys(byDay).filter((d) => byDay[d] > 0)), today),
    difficulty: diff,
    changed: opened.opened || pending.length > 0,
  };
}

export { xpForLevel };
