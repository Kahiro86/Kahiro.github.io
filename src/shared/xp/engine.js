// ── The XP engine — the only thing that prices an action ─────────────
// Modules emit events ("workout logged", "purity day claimed"); this decides
// what they are worth (spec §4.1b). No module awards XP directly, and any
// value not in values.js cannot be paid.
//
//   action_xp = base
//             × difficulty_weight      (§4.3, 0.6–1.8, habits only)
//             × consistency_multiplier (§4.5, 1.0–1.5, hard ceiling)
//             × recovery_bonus         (§4.5, ×1.5 for 3 days after a break)
//             × domain_balance_factor  (§4.6, 0.8 when one domain dominates)
//   then the daily domain cap applies.
//
// Determinism is a requirement, not an accident: same event, same context,
// same number, every time. There is no randomness anywhere in this file, and
// a test greps for it (§4.0 — this app contains an abstinence tracker, and
// variable-ratio reward is exactly the mechanic it exists to fight).
import {
  EVENTS, DOMAINS, NEVER_PAID, PURITY_MILESTONES,
  CONSISTENCY_BANDS, CONSISTENCY_CEILING, RECOVERY_BONUS, RECOVERY_DAYS,
  BALANCE_THRESHOLD, BALANCE_FACTOR, BALANCE_WINDOW_DAYS,
  FULL_RATE_ACTIONS, MARGINAL_DECAY,
} from "./values.js";

const clampMult = (m) => Math.min(CONSISTENCY_CEILING, Math.max(1, m));

/** Bounded by streak length. Never exceeds CONSISTENCY_CEILING. */
export function consistencyMultiplier(streakDays) {
  const d = Math.max(0, Math.floor(streakDays || 0));
  return clampMult((CONSISTENCY_BANDS.find((b) => d >= b.min) || CONSISTENCY_BANDS[CONSISTENCY_BANDS.length - 1]).m);
}

/**
 * Is `date` inside the recovery window — one of the first RECOVERY_DAYS days
 * of activity after a gap? `activeDays` is the set of dates with any earning
 * activity, `date` included.
 */
export function inRecovery(date, activeDays) {
  const days = [...(activeDays instanceof Set ? activeDays : new Set(activeDays || []))].sort();
  const i = days.indexOf(date);
  if (i <= 0) return false; // day one ever is a start, not a return
  // Walk back up to RECOVERY_DAYS active days; if any adjacent pair is more
  // than a day apart, this day is still inside the window that gap opened.
  for (let k = i; k > 0 && i - k < RECOVERY_DAYS; k--) {
    const gapDays = Math.round((new Date(`${days[k]}T12:00:00`) - new Date(`${days[k - 1]}T12:00:00`)) / 86400000);
    if (gapDays > 1) return true;
  }
  return false;
}

/**
 * Domain balance (§4.6). A domain that produced more than BALANCE_THRESHOLD
 * of the trailing week's XP is dialled to BALANCE_FACTOR until balance
 * returns. Nothing is removed; grinding one axis just stops being the best
 * available move.
 */
export function balanceFactors(recentByDomain) {
  const totals = recentByDomain && typeof recentByDomain === "object" ? recentByDomain : {};
  const active = Object.entries(totals).filter(([, v]) => (Number(v) || 0) > 0);
  const sum = active.reduce((s, [, v]) => s + Number(v), 0);
  const out = {};
  // With only one domain in play there is nothing to grind past, so the
  // factor never applies. Otherwise someone who only tracks habits would sit
  // on a permanent 20% penalty for using the part of the app they use — which
  // punishes narrow usage, not farming, and those are not the same thing.
  const applies = active.length >= 2 && sum > 0;
  for (const d of Object.keys(DOMAINS)) {
    out[d] = applies && (Number(totals[d]) || 0) / sum > BALANCE_THRESHOLD ? BALANCE_FACTOR : 1;
  }
  return out;
}

const wordCount = (s) => String(s || "").trim().split(/\s+/).filter(Boolean).length;

/**
 * Price one event. Returns a fully-explained line — every multiplier that
 * touched it is named, so the UI can show the user why a number is what it
 * is rather than asserting it.
 *
 * Returns null when the event pays nothing, with `reason` saying why.
 */
export function priceEvent(event, ctx = {}) {
  const kind = event && event.kind;
  if (!kind) return { xp: 0, paid: false, reason: "no event kind" };

  if (NEVER_PAID[kind]) return { xp: 0, paid: false, kind, label: event.label || kind, reason: NEVER_PAID[kind] };

  const def = EVENTS[kind];
  if (!def) return { xp: 0, paid: false, kind, label: event.label || kind, reason: "not in the value table — nothing outside values.js can pay" };

  // Journal entries under the minimum still save; they just are not paid for.
  if (def.minWords && wordCount(event.text) < def.minWords) {
    return { xp: 0, paid: false, kind, label: event.label || kind, domain: def.domain, reason: `under ${def.minWords} words — the entry saves, it just doesn't pay` };
  }

  // A real-world action satisfying several trackers pays once, at the highest
  // single value; the others are marked satisfied without paying (§4.4).
  if (event.supersededBy) {
    return { xp: 0, paid: false, kind, label: event.label || kind, domain: def.domain, satisfied: true, reason: `already paid as ${event.supersededBy}` };
  }

  let base = def.base;
  if (def.scale === "purityMilestone") {
    base = PURITY_MILESTONES[event.run] || 0;
    if (!base) return { xp: 0, paid: false, kind, label: event.label || kind, domain: def.domain, reason: `run of ${event.run} is not a milestone` };
  }
  if (Number.isFinite(+event.baseOverride)) base = Math.max(0, +event.baseOverride);
  if (base <= 0) return { xp: 0, paid: false, kind, label: event.label || kind, domain: def.domain, reason: "base value is zero" };

  // Milestones are flat: they are already sized for their rarity, and
  // stacking multipliers on top of 400 produces numbers nobody can predict.
  const dw = def.flat ? 1 : (Number.isFinite(+ctx.difficulty) ? Math.max(0.6, Math.min(1.8, +ctx.difficulty)) : 1);
  const cm = def.flat ? 1 : clampMult(Number.isFinite(+ctx.consistency) ? +ctx.consistency : 1);
  const rb = def.flat ? 1 : (ctx.recovery ? RECOVERY_BONUS : 1);
  const bf = def.flat ? 1 : (Number.isFinite(+ctx.balance) ? +ctx.balance : 1);

  const xp = Math.round(base * dw * cm * rb * bf);
  return {
    xp, paid: true, kind, domain: def.domain, base,
    difficulty: dw, consistency: cm, recovery: rb, balance: bf,
    uncapped: !!def.uncapped, label: event.label || kind,
  };
}

/** The k-th (1-indexed) paid action of a domain in one day. */
export const marginalFactor = (k) =>
  k <= FULL_RATE_ACTIONS ? 1 : 1 / (1 + MARGINAL_DECAY * (k - FULL_RATE_ACTIONS));

/**
 * Price a whole day. Three things happen here that cannot happen per-event:
 * diminishing returns on repeated actions within a domain, the per-domain
 * daily cap, and the ordering that decides which actions get the full-rate
 * slots.
 *
 * Over-cap and past-the-knee lines still return — they are logged, they still
 * count for streaks, they simply stop paying (§4.6, criterion 18).
 */
export function priceDay(events, ctx = {}) {
  const price = (ev) => priceEvent(ev, {
    difficulty: ev.habitId && ctx.difficulty ? ctx.difficulty[ev.habitId]?.weight : undefined,
    consistency: ctx.consistency,
    recovery: ctx.recovery,
    balance: ev.kind && EVENTS[ev.kind] ? (ctx.balance || {})[EVENTS[ev.kind].domain] : 1,
  });

  // Overlap resolution happens HERE, not at collect time, because it is a
  // pricing decision and this is the only place the multipliers exist. It used
  // to run in collect.js with no context at all, ranking on the bare base
  // value — so a Frontier-difficulty "log meals" habit worth 10 × 1.8 = 18 lost
  // to meals.dayComplete's base 12, in flat contradiction of the promise
  // written above the code that did it.
  const list = (Array.isArray(events) ? events : []).map((ev) => ({ ev, p: price(ev) }));
  const winners = {};
  for (const { ev, p } of list) {
    if (!ev.group || ev.supersededBy) continue;
    const best = winners[ev.group];
    if (!best || p.xp > best.p.xp) winners[ev.group] = { ev, p };
  }
  const priced = list.map(({ ev, p }) => {
    const win = ev.group && winners[ev.group];
    if (!win || win.ev === ev) return { ev, p };
    // Re-price with the supersede flag so the line carries its own
    // explanation rather than a silent zero.
    return { ev, p: price({ ...ev, supersededBy: win.ev.kind }) };
  });

  // Highest-value first, so the full-rate slots go to the hardest actions.
  // Unpaid lines keep their original position — they carry explanations, not
  // value, and reordering them would scramble the day's story.
  const payable = priced.filter((x) => x.p.paid).sort((a, b) => b.p.xp - a.p.xp);
  const unpaid = priced.filter((x) => !x.p.paid);

  const lines = [];
  const spent = {};
  const count = {};
  let total = 0;

  for (const { p } of payable) {
    // Milestones sit outside the knee as well as the cap: a cleared quarter is
    // not "one more action today".
    const k = p.uncapped ? 1 : (count[p.domain] = (count[p.domain] || 0) + 1);
    const marginal = p.uncapped ? 1 : marginalFactor(k);
    let awarded = Math.round(p.xp * marginal);

    const cap = DOMAINS[p.domain]?.cap ?? Infinity;
    const used = spent[p.domain] || 0;
    let capped = false;
    if (!p.uncapped) {
      const room = Math.max(0, cap - used);
      if (awarded > room) { awarded = room; capped = true; }
      spent[p.domain] = used + awarded;
    }
    total += awarded;
    lines.push({ ...p, awarded, marginal, nth: k, capped, capRemaining: p.uncapped ? null : Math.max(0, cap - (spent[p.domain] || 0)) });
  }
  for (const { p } of unpaid) lines.push({ ...p, awarded: 0 });

  const byDomain = {};
  for (const l of lines) if (l.awarded > 0) byDomain[l.domain] = (byDomain[l.domain] || 0) + l.awarded;
  return { total, byDomain, lines, caps: { ...DOMAINS } };
}

export { BALANCE_WINDOW_DAYS };
