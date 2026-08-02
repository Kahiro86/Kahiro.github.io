// ── Correlations — does one domain move with another? ────────────────
// Pure stats over daily series ({ ds: number }). Pearson's r across a window
// of days, with an honest strength label and guardrails (needs enough varied
// data, never divides by zero). Read-only — the overlay supplies the series.
import { daysAgoStr } from "./dates.js";

// Pearson correlation of two equal-length numeric arrays. Null when there
// isn't enough signal (fewer than 5 points, or one side is flat).
export function pearson(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 5) return null;
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let i = 0; i < n; i++) {
    const x = +xs[i] || 0, y = +ys[i] || 0;
    sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
  }
  const cov = sxy - (sx * sy) / n;
  const vx = sxx - (sx * sx) / n;
  const vy = syy - (sy * sy) / n;
  if (vx <= 0 || vy <= 0) return null;
  const r = cov / Math.sqrt(vx * vy);
  return Math.max(-1, Math.min(1, r));
}

// The last `n` day-strings, oldest → newest.
export function lastNDates(n = 60) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(daysAgoStr(i));
  return out;
}

export const seriesToArray = (map, dates) => dates.map((d) => (map && Number.isFinite(+map[d]) ? +map[d] : 0));

export function strength(r) {
  if (r == null) return "not enough data";
  const a = Math.abs(r);
  const dir = r > 0 ? "positive" : "negative";
  if (a >= 0.6) return `strong ${dir}`;
  if (a >= 0.3) return `moderate ${dir}`;
  if (a >= 0.15) return `weak ${dir}`;
  return "no clear link";
}

// Correlate two daily-series maps over a window. Returns { r, n, label }.
export function correlate(mapA, mapB, windowDays = 60) {
  const dates = lastNDates(windowDays);
  const xs = seriesToArray(mapA, dates);
  const ys = seriesToArray(mapB, dates);
  const r = pearson(xs, ys);
  return { r, n: dates.length, label: strength(r) };
}
