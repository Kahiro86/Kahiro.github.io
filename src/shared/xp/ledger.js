// ── The banked XP ledger ─────────────────────────────────────────────
// The old engine derived every total from live rows on each render, so
// archiving a habit silently erased every point it had ever paid (audit
// finding F-1). This banks instead: a day's earnings are computed once, then
// sealed. Sealed days are never recomputed and never reduced — which is what
// non-negotiable 6 and criteria 19–21 actually require.
//
// Carry-forward (criterion 21): there is no historical ledger to preserve,
// only a number the old engine derived. On first run that number is written
// as a single opening-balance row and everything after it is banked under
// the new rules. History keeps its total and its explanation; nothing is
// retroactively rescored.
//
// Today stays live until rollover. That is deliberate: un-ticking a mis-tap
// has to reduce today's number, or the mistake is paid for forever and
// tick-then-untick becomes free XP. Yesterday and earlier cannot move.
import { localDateStr } from "../dates.js";

export const LEDGER_KEY = "xp_ledger";
export const LEDGER_VERSION = 3;

const emptyLedger = () => ({
  version: LEDGER_VERSION,
  opening: null,       // { xp, at, note } — the pre-revamp total, carried forward
  days: {},            // ds -> { total, byDomain, lines, sealedAt }
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function sanitizeLedger(raw) {
  const l = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const out = emptyLedger();
  if (l.opening && Number.isFinite(+l.opening.xp) && +l.opening.xp >= 0) {
    out.opening = { xp: Math.round(+l.opening.xp), at: String(l.opening.at || ""), note: String(l.opening.note || "") };
  }
  const days = l.days && typeof l.days === "object" && !Array.isArray(l.days) ? l.days : {};
  for (const [ds, d] of Object.entries(days)) {
    if (!DATE_RE.test(ds) || !d || typeof d !== "object") continue;
    const total = Number.isFinite(+d.total) ? Math.max(0, Math.round(+d.total)) : 0;
    out.days[ds] = {
      total,
      byDomain: d.byDomain && typeof d.byDomain === "object" && !Array.isArray(d.byDomain) ? d.byDomain : {},
      lines: Array.isArray(d.lines) ? d.lines : [],
      sealedAt: typeof d.sealedAt === "string" ? d.sealedAt : null,
    };
  }
  return out;
}

/** Total banked XP: the carried-forward opening balance plus every sealed day. */
export function bankedTotal(ledger) {
  const l = sanitizeLedger(ledger);
  return (l.opening?.xp || 0) + Object.values(l.days).reduce((s, d) => s + d.total, 0);
}

/**
 * Opens the ledger for a user who has never had one, carrying their existing
 * derived total forward untouched. Idempotent — an already-opened ledger is
 * returned unchanged, so this can run on every boot.
 */
export function openLedger(ledger, derivedTotal, today = localDateStr()) {
  const l = sanitizeLedger(ledger);
  if (l.opening) return { ledger: l, opened: false };
  return {
    ledger: {
      ...l,
      opening: {
        xp: Math.max(0, Math.round(derivedTotal || 0)),
        at: today,
        note: "Carried forward from the derive-only engine. Earned under the previous rules and never rescored.",
      },
    },
    opened: true,
  };
}

/**
 * Banks a day. A day already sealed is returned untouched — this is the line
 * that makes "earned stays earned" true rather than aspirational.
 *
 * `today` is never sealed; it is stored live and re-banked on each call until
 * it becomes the past, at which point the next call seals it.
 */
export function bankDay(ledger, ds, priced, today = localDateStr()) {
  const l = sanitizeLedger(ledger);
  if (!DATE_RE.test(ds)) return { ledger: l, changed: false, reason: "bad date" };
  const existing = l.days[ds];
  if (existing && existing.sealedAt) return { ledger: l, changed: false, reason: "already sealed" };

  const day = {
    total: Math.max(0, Math.round(priced?.total || 0)),
    byDomain: priced?.byDomain || {},
    // Only paid lines are kept — a zero line is an explanation, not a record,
    // and storing every refusal would grow the ledger without end.
    lines: (priced?.lines || []).filter((x) => x && x.awarded > 0)
      .map((x) => ({ k: x.kind, l: x.label, b: x.base, d: x.difficulty, c: x.consistency, r: x.recovery, f: x.balance, x: x.awarded, cap: !!x.capped })),
    sealedAt: ds < today ? new Date().toISOString() : null,
  };
  return { ledger: { ...l, days: { ...l.days, [ds]: day } }, changed: true, sealed: !!day.sealedAt };
}

/** Every day that still needs banking, oldest first. Sealed days are skipped. */
export function unbankedDays(ledger, candidateDates, today = localDateStr()) {
  const l = sanitizeLedger(ledger);
  return [...new Set(candidateDates || [])]
    .filter((ds) => DATE_RE.test(ds) && ds <= today)
    .filter((ds) => !l.days[ds]?.sealedAt)
    .sort();
}

/** Trailing-window totals per domain, for the balance factor (§4.6). */
export function recentByDomain(ledger, today = localDateStr(), days = 7) {
  const l = sanitizeLedger(ledger);
  const from = new Date(`${today}T12:00:00`);
  from.setDate(from.getDate() - (days - 1));
  const fromDs = localDateStr(from);
  const out = {};
  for (const [ds, d] of Object.entries(l.days)) {
    if (ds < fromDs || ds > today) continue;
    for (const [dom, v] of Object.entries(d.byDomain)) out[dom] = (out[dom] || 0) + (Number(v) || 0);
  }
  return out;
}

/** The dates that carry any earning activity — the input to recovery detection. */
export function activeDays(ledger) {
  const l = sanitizeLedger(ledger);
  return new Set(Object.entries(l.days).filter(([, d]) => d.total > 0).map(([ds]) => ds));
}
