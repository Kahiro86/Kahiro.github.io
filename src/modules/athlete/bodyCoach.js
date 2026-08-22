// ── Body · the Coach (spec §2.3) ─────────────────────────────────────
// It reflects; it does not practise. Every line this module can emit is
// written here in full — there is no template that assembles advice at
// runtime — so the whole vocabulary can be read and audited in one sitting.
//
// Hard rules, enforced by tests in tests/audit/body-coach.mjs:
//   · never prescribes calories, macros or programmes beyond what the user
//     already configured
//   · never comments on appearance, body image or worth
//   · never uses shame framing — no "failed", no "should have", no red X
//   · never pushes intake down. Sustained under-target reads as a
//     data-quality OR under-eating question, and says both need opposite
//     fixes — it is never reported as success
//   · flags thin data instead of averaging over it
//   · asks at most one question per week
import { localDateStr } from "../../shared/dates.js";
import { dayEntries, dayTotals } from "./nutrition.js";
import { dayTargets, sessionsOn } from "./bodyTargets.js";

const back = (today, n) => { const d = new Date(`${today}T12:00:00`); d.setDate(d.getDate() - n); return localDateStr(d); };
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);

// A day is "logged" if any food was recorded. Days with nothing are gaps, and
// a gap is not a zero — averaging them in would invent a fast that never
// happened.
function scan(log, profile, sessions, today, days) {
  const out = [];
  for (let i = 1; i <= days; i++) {
    const ds = back(today, i);
    const entries = dayEntries(log, ds);
    if (!entries.length) { out.push({ ds, logged: false }); continue; }
    const t = dayTotals(entries);
    const d = dayTargets({ profile, sessions, ds, today });
    out.push({
      ds, logged: true, kcal: Math.round(t.kcal || 0), p: Math.round(t.p || 0),
      target: d.targets, trained: d.trained,
      hitProtein: (t.p || 0) >= d.targets.p * 0.95,
      hitKcal: Math.abs((t.kcal || 0) - d.targets.kcal) <= d.targets.kcal * 0.1,
    });
  }
  return out;
}

/**
 * The weekly reflection. Returns plain data — the view renders it, and adds
 * no sentences of its own.
 */
export function bodyCoach({ log, profile, sessions, measurements, today = localDateStr(), window = 30 } = {}) {
  const rows = scan(log || {}, profile, sessions || [], today, window);
  const logged = rows.filter((r) => r.logged);
  const coverage = pct(logged.length, window);

  const notes = [];
  const gaps = [];
  let question = null;

  // ── data quality first: everything below is caveated by it ──────────
  const reliable = coverage >= 60;
  if (!reliable) {
    gaps.push({
      k: "coverage",
      text: `${logged.length} of the last ${window} days are logged. That is not enough to average — treat anything below as a sketch, not a measurement.`,
    });
  }

  // ── what happened vs what was intended ──────────────────────────────
  const last7 = rows.slice(0, 7).filter((r) => r.logged);
  if (last7.length >= 3) {
    const hits = last7.filter((r) => r.hitProtein);
    notes.push({
      k: "protein",
      text: `Protein target hit ${hits.length} of the ${last7.length} logged days this week.`,
    });
    const misses = last7.filter((r) => !r.hitProtein);
    if (misses.length >= 2) {
      const allTraining = misses.every((r) => r.trained);
      const allRest = misses.every((r) => !r.trained);
      if (allTraining) notes.push({ k: "protein-when", text: "Every miss was a training day." });
      else if (allRest) notes.push({ k: "protein-when", text: "Every miss was a rest day." });
    }
  }

  const trainedDays = rows.filter((r) => sessionsOn(sessions || [], r.ds).length > 0).length;
  if (trainedDays > 0) {
    notes.push({ k: "sessions", text: `${trainedDays} sessions logged in the last ${window} days.` });
  }

  // ── correlations across Body data ───────────────────────────────────
  const meas = (Array.isArray(measurements) ? measurements : []).filter((m) => m && m.date)
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const recent = meas[meas.length - 1] || null;
  const prior = [...meas].reverse().find((m) => (m.date || "") <= back(today, 21)) || null;
  if (recent && prior && recent !== prior) {
    const dW = Number.isFinite(+recent.weightKg) && Number.isFinite(+prior.weightKg) ? +(recent.weightKg - prior.weightKg).toFixed(1) : null;
    const dWaist = Number.isFinite(+recent.waistCm) && Number.isFinite(+prior.waistCm) ? +(recent.waistCm - prior.waistCm).toFixed(1) : null;
    if (dW != null && dWaist != null) {
      if (Math.abs(dW) <= 0.7 && dWaist <= -0.5) {
        notes.push({ k: "recomp", text: `Weight is flat (${dW >= 0 ? "+" : ""}${dW} kg) but waist is down ${Math.abs(dWaist)} cm. That pattern is recomposition, not a stall.` });
      } else if (dW > 0.7 && dWaist >= 0.5) {
        notes.push({ k: "both-up", text: `Weight is up ${dW} kg and waist is up ${dWaist} cm over three weeks. Both moved together.` });
      } else if (dW < -0.7 && dWaist <= -0.5) {
        notes.push({ k: "both-down", text: `Weight is down ${Math.abs(dW)} kg and waist down ${Math.abs(dWaist)} cm over three weeks. Both moved together.` });
      }
    }
  }

  // ── under-eating / under-logging — never framed as success ──────────
  if (logged.length >= 7) {
    const under = logged.filter((r) => r.kcal < r.target.kcal * 0.75);
    if (under.length >= Math.ceil(logged.length * 0.6)) {
      gaps.push({
        k: "under",
        text: `Logged intake is running well under target on ${under.length} of ${logged.length} logged days. That reads two ways — either meals are going unlogged, or intake really is short — and the two need opposite fixes. Worth knowing which before reading anything else here.`,
      });
    }
  }

  // ── one question per week, and only when there is something to ask ──
  // Anchored to the ISO week so it does not change on every render.
  const weekSeed = Math.floor(new Date(`${today}T12:00:00`).getTime() / (7 * 86400000));
  const candidates = [];
  if (last7.length >= 3) {
    const best = [...last7].sort((a, b) => (b.hitProtein - a.hitProtein) || (b.p - a.p));
    const top = best.slice(0, 2);
    if (top.length === 2 && top.every((r) => !r.trained)) {
      candidates.push("Your two best-fuelled days this week were both days off. What made those easier?");
    }
    if (top.length === 2 && top.every((r) => r.trained)) {
      candidates.push("Your two best-fuelled days this week were both training days. What was different about them?");
    }
  }
  if (trainedDays >= 4) candidates.push("You trained more than you fuelled for this month. Which of the two is the one you actually want to change?");
  if (!reliable) candidates.push("More than a third of the month went unlogged. Was that the busy weeks, or the hard ones?");
  if (candidates.length) question = candidates[weekSeed % candidates.length];

  return {
    coverage, loggedDays: logged.length, window, reliable,
    notes, gaps, question,
    // Nothing here is a target. The view is not allowed to render these as
    // instructions, and the Coach never returns a number to eat.
    prescribes: false,
  };
}
