// ── Hydration & sleep — the full chain ───────────────────────────────
// Both were logged and both paid XP, but neither had anywhere to be looked
// at: no trend, no consistency, no answer to "am I actually doing this?".
// Logging something the app never reports back on is the definition of a
// disconnected feature.
//
// Pure and derive-only. Reads the same stores everything else does —
// nutrition_log for water (fluid is logged with food), trade_sleep for hours
// — through one definition each, so no screen can disagree with another.
import { localDateStr } from "./dates.js";
import { dayEntries, dayTotals, calcTargets, sanitizeProfile } from "../modules/athlete/nutrition.js";
import { SLEEP_FLOOR_HOURS } from "./views.js";

const back = (today, n) => { const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() - n); return localDateStr(d); };
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : null);

/**
 * A day-by-day series with its own coverage. `value` is null on a day with no
 * log — never 0, because "didn't drink" and "didn't record" are different
 * claims and only one of them is the user's fault.
 */
function series(days, valueOf, target) {
  const rows = days.map((d) => {
    const v = valueOf(d);
    return { d, value: v, target, hit: v == null ? null : v >= target };
  });
  const logged = rows.filter((r) => r.value != null);
  const hits = logged.filter((r) => r.hit).length;
  return {
    rows,
    loggedDays: logged.length,
    days: days.length,
    coverage: pct(logged.length, days.length),
    // Consistency is over LOGGED days: a day you never recorded is not a miss,
    // it is an unknown, and counting unknowns as misses makes the number lie.
    consistency: logged.length ? pct(hits, logged.length) : null,
    hits,
    average: logged.length ? Math.round(logged.reduce((s, r) => s + r.value, 0) / logged.length) : null,
    target,
  };
}

/** Litres of fluid per day against the profile's water target. */
export function hydrationSeries({ nutrition, nutritionProfile, today = localDateStr(), days = 30 } = {}) {
  const log = nutrition && typeof nutrition === "object" ? nutrition : {};
  const targets = calcTargets(sanitizeProfile(nutritionProfile));
  const list = Array.from({ length: days }, (_, i) => back(today, days - 1 - i));
  const s = series(list, (d) => {
    const entries = dayEntries(log, d);
    if (!entries.length) return null;
    return Math.round(dayTotals(entries).fluidMl || 0);
  }, targets.waterMl);
  return { ...s, unit: "ml", label: "Hydration", targetLabel: `${(targets.waterMl / 1000).toFixed(1)} L` };
}

/** Hours slept per night against the covenant's 6.5-hour floor (Law 7). */
export function sleepSeries({ sleep, today = localDateStr(), days = 30 } = {}) {
  const map = sleep && typeof sleep === "object" && !Array.isArray(sleep) ? sleep : {};
  const list = Array.from({ length: days }, (_, i) => back(today, days - 1 - i));
  const s = series(list, (d) => {
    const h = Number(map[d]);
    return Number.isFinite(h) && h > 0 ? h : null;
  }, SLEEP_FLOOR_HOURS);
  return {
    ...s,
    average: s.loggedDays ? Math.round((s.rows.filter((r) => r.value != null).reduce((a, r) => a + r.value, 0) / s.loggedDays) * 10) / 10 : null,
    unit: "h", label: "Sleep", targetLabel: `${SLEEP_FLOOR_HOURS} h floor`,
  };
}

/** Weekly buckets from a series, for the month/quarter view. */
export function weeklyBuckets(s, weeks = 6) {
  const out = [];
  const rows = s.rows.slice();
  for (let w = weeks - 1; w >= 0; w--) {
    const chunk = rows.slice(Math.max(0, rows.length - (w + 1) * 7), rows.length - w * 7);
    const logged = chunk.filter((r) => r.value != null);
    out.push({
      label: chunk.length ? chunk[chunk.length - 1].d.slice(5).replace("-", "/") : "",
      loggedDays: logged.length,
      consistency: logged.length ? pct(logged.filter((r) => r.hit).length, logged.length) : null,
      average: logged.length ? Math.round(logged.reduce((a, r) => a + r.value, 0) / logged.length) : null,
    });
  }
  return out;
}

/** Today's status, for the Command Centre. */
export function todayStatus(s) {
  const last = s.rows[s.rows.length - 1];
  return { logged: last?.value != null, value: last?.value ?? null, target: s.target, hit: last?.hit ?? null };
}
