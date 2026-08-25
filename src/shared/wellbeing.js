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
// `claims` is a plain { date: boolean } from a linked habit — true when the
// day's bar was ticked without a measurement, false when it was explicitly
// answered "no". Anything else means the habit said nothing about that day.
const claimOf = (claims) => {
  const m = claims && typeof claims === "object" && !Array.isArray(claims) ? claims : null;
  return m ? (d) => (typeof m[d] === "boolean" ? m[d] : null) : null;
};

/**
 * A day-by-day series with its own coverage. `value` is null on a day with no
 * log — never 0, because "didn't drink" and "didn't record" are different
 * claims and only one of them is the user's fault.
 */
function series(days, valueOf, target, claimOf) {
  const rows = days.map((d) => {
    const v = valueOf(d);
    if (v != null) return { d, value: v, target, hit: v >= target, claimed: false };
    // No measurement. A linked habit may still have claimed the day — a
    // ticked "Sleep well" with no hours attached. That is a real log of a
    // real answer, so it counts toward coverage and consistency; it stays
    // out of the average, because nobody measured anything to average.
    const c = claimOf ? claimOf(d) : null;
    if (c == null) return { d, value: null, target, hit: null, claimed: false };
    return { d, value: null, target, hit: c, claimed: true };
  });
  const logged = rows.filter((r) => r.value != null || r.claimed);
  const measured = rows.filter((r) => r.value != null);
  const hits = logged.filter((r) => r.hit).length;
  return {
    rows,
    loggedDays: logged.length,
    measuredDays: measured.length,
    claimedDays: logged.length - measured.length,
    days: days.length,
    coverage: pct(logged.length, days.length),
    // Consistency is over LOGGED days: a day you never recorded is not a miss,
    // it is an unknown, and counting unknowns as misses makes the number lie.
    consistency: logged.length ? pct(hits, logged.length) : null,
    hits,
    average: measured.length ? Math.round(measured.reduce((s, r) => s + r.value, 0) / measured.length) : null,
    target,
  };
}

/**
 * Millilitres of fluid per day against the profile's water target.
 *
 * Two log paths, one definition. Drinks recorded as food (a latte, a bowl of
 * soup) come through nutrition_log's beverage entries; plain water logged
 * against the linked habit comes through hydration_log. They are added, not
 * chosen between — drinking a coffee and drinking a glass of water are
 * different events, and a person who does both did both.
 */
export function hydrationSeries({ nutrition, nutritionProfile, hydration, claims, today = localDateStr(), days = 30 } = {}) {
  const log = nutrition && typeof nutrition === "object" ? nutrition : {};
  const direct = hydration && typeof hydration === "object" && !Array.isArray(hydration) ? hydration : {};
  const targets = calcTargets(sanitizeProfile(nutritionProfile));
  const list = Array.from({ length: days }, (_, i) => back(today, days - 1 - i));
  const s = series(list, (d) => {
    const entries = dayEntries(log, d);
    const fromFood = entries.length ? Math.round(dayTotals(entries).fluidMl || 0) : 0;
    const logged = Number(direct[d]);
    const fromHabit = Number.isFinite(logged) && logged > 0 ? Math.round(logged) : 0;
    if (!entries.length && !fromHabit) return null;
    return fromFood + fromHabit;
  }, targets.waterMl, claimOf(claims));
  return { ...s, unit: "ml", label: "Hydration", targetLabel: `${(targets.waterMl / 1000).toFixed(1)} L` };
}

/** Hours slept per night against the covenant's 6.5-hour floor (Law 7). */
export function sleepSeries({ sleep, claims, today = localDateStr(), days = 30 } = {}) {
  const map = sleep && typeof sleep === "object" && !Array.isArray(sleep) ? sleep : {};
  const list = Array.from({ length: days }, (_, i) => back(today, days - 1 - i));
  const s = series(list, (d) => {
    const h = Number(map[d]);
    return Number.isFinite(h) && h > 0 ? h : null;
  }, SLEEP_FLOOR_HOURS, claimOf(claims));
  const measured = s.rows.filter((r) => r.value != null);
  return {
    ...s,
    average: measured.length ? Math.round((measured.reduce((a, r) => a + r.value, 0) / measured.length) * 10) / 10 : null,
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
  const claimed = !!last?.claimed;
  return {
    // A claimed day IS logged — the person answered. It just has no number,
    // which is why `value` stays null and every average leaves it out.
    logged: last?.value != null || claimed,
    claimed,
    value: last?.value ?? null,
    target: s.target,
    hit: last?.hit ?? null,
  };
}
