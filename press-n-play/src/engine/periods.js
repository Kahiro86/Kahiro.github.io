// ── Period bucketing, grouping, and the sample-size rule ─────────────
// The generic layer between a list of trades and a chart or a review.
//
// Membership of a period is derived from the trade's own date, never from
// a link. Notion has to link each trade to its daily review by hand — and
// its weekly and monthly rollups then read 0 R unless you also link every
// trade to those, which its own schema never actually does. Deriving from
// the date removes both the manual step and the bug.
import { localDateStr, weekStartStr } from "../ui/dates.js";
import { closedTrades, metricsOf } from "./metrics.js";
import { SAMPLE_NONE, SAMPLE_HINT } from "./constants.js";

/** The period key a date belongs to, for each cadence. */
export const periodKey = (ds, kind) => {
  if (kind === "weekly") return weekStartStr(ds);
  if (kind === "monthly") return ds.slice(0, 7);
  return ds;
};

/** Does this date fall inside this review's period? */
export const inPeriod = (ds, kind, period) =>
  typeof ds === "string" && ds.length >= 10 && periodKey(ds, kind) === period;

/** The closed trades belonging to one period. No linking required. */
export const tradesInPeriod = (trades, kind, period, accountId = "") =>
  closedTrades(trades, accountId).filter((t) => inPeriod(t.date, kind, period));

/** Human label for a period key. */
export function periodLabel(kind, period) {
  if (kind === "monthly") {
    const [y, m] = period.split("-");
    const MONTHS = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    return `${MONTHS[+m - 1] || period} ${y}`;
  }
  if (kind === "weekly") return `Week of ${period}`;
  return period === localDateStr() ? "Today" : period;
}

// ── Sample size ──────────────────────────────────────────────────────
/**
 * How much a bucket of n trades is allowed to claim.
 *
 * Straight from the spec's own table, and the reason it exists is stated
 * there just as plainly: at the time it was written the journal held one
 * trade, and "an invented pattern is worse than no pattern, because you
 * would trade on it."
 *
 * Returning a level rather than a boolean lets a chart dim a thin bucket
 * instead of hiding it — you still see that the bucket exists, you just
 * cannot read an edge into it.
 */
export function sampleLevel(n) {
  if (n < SAMPLE_NONE) return "none";
  if (n < SAMPLE_HINT) return "hint";
  return "solid";
}

export const SAMPLE_COPY = {
  none: "Too few trades — do not conclude anything",
  hint: "Directional only — treat as a hint",
  solid: "Enough to act on",
};

/** The spec's Sample Size Check field, computed rather than stored. */
export const sampleSizeCheck = (n) => SAMPLE_COPY[sampleLevel(n)];

// ── Aggregation ──────────────────────────────────────────────────────
const AGGS = {
  sum: (xs) => +xs.reduce((a, b) => a + b, 0).toFixed(2),
  avg: (xs) => (xs.length ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(2) : 0),
  count: (xs) => xs.length,
  min: (xs) => (xs.length ? +Math.min(...xs).toFixed(2) : 0),
  max: (xs) => (xs.length ? +Math.max(...xs).toFixed(2) : 0),
};

/**
 * Aggregate one field across rows, skipping nulls.
 *
 * Skipping rather than zero-filling is what makes `winnerR` and `loserR`
 * work: a plain average over the whole set returns the average winner,
 * because every loser contributed null and was never counted.
 */
export function aggregate(rows, field, agg = "sum") {
  // `v !== ""` matters: `+"" === 0` and `Number.isFinite(0)` is true, so a
  // blank field would otherwise be averaged in as a real zero and drag
  // every mean towards it.
  const xs = rows
    .map((r) => r[field])
    .filter((v) => v != null && v !== "" && Number.isFinite(+v))
    .map(Number);
  return (AGGS[agg] || AGGS.sum)(xs);
}

/**
 * Group rows by a field and aggregate each bucket.
 *
 * Multi-select fields (preTradeFlags, ruleChecklist) put a trade in every
 * bucket it names — a trade entered on both FOMO and Impatience is
 * evidence about both. Bucket counts therefore sum to more than the trade
 * count, which is correct and is why every bucket carries its own n.
 */
export function groupBy(rows, field, { agg = "sum", valueField = "netR", sort = null } = {}) {
  const buckets = new Map();
  for (const r of rows) {
    const raw = r[field];
    if (raw == null || raw === "") continue;
    const keys = Array.isArray(raw) ? raw : [raw];
    for (const k of keys) {
      const key = String(k);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key).push(r);
    }
  }
  const out = [...buckets.entries()].map(([key, rs]) => ({
    key,
    n: rs.length,
    value: aggregate(rs, valueField, agg),
    level: sampleLevel(rs.length),
  }));
  if (sort === "desc") out.sort((a, b) => b.value - a.value);
  else if (sort === "asc") out.sort((a, b) => a.value - b.value);
  else out.sort((a, b) => a.key.localeCompare(b.key));
  return out;
}

/** Trades → metric rows, once, for everything downstream. */
export const rowsOf = (trades, accountId = "") => closedTrades(trades, accountId).map(metricsOf);

/** Calendar buckets for the trend charts. */
export const byMonth = (rows) => groupBy(rows.map((r) => ({ ...r, _m: r.date.slice(0, 7) })), "_m", { valueField: "netR", agg: "sum" });

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const withCalendarKeys = (rows) => rows.map((r) => ({
  ...r,
  month: r.date.slice(0, 7),
  dayOfWeek: WEEKDAYS[new Date(`${r.date}T12:00:00`).getDay()],
}));
