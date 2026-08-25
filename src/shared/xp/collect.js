// ── Events, collected from the stores ────────────────────────────────
// Modules do not award XP. This turns what is actually on disk into a stream
// of canonical events per day, and the engine prices them (spec §4.1b).
//
// The one piece of real judgement here is overlap resolution. When a single
// real-world action is tracked in two places — a workout logged in Body and a
// "train today" habit ticked in Discipline — it must pay once, at the highest
// single value, with the others marked satisfied (§4.4, criterion 12).
// Overlaps are grouped by day and resolved by price, not by a hardcoded
// winner, so if a habit is ever worth more than the session it stands in for,
// the habit is what pays.
import { localDateStr, daysBetween } from "../dates.js";
import { EVENTS, PURITY_MILESTONES } from "./values.js";
import { priceEvent } from "./engine.js";
import { sanitizeNutrition, dayTotals, calcTargets, nutritionScore } from "../../modules/athlete/nutrition.js";
import { habitFeed } from "../../modules/habits/xpFeed.js";

const arr = (x) => (Array.isArray(x) ? x.filter(Boolean) : []);
const ds10 = (v) => String(v || "").slice(0, 10);
const dOf = (v) => { const d = ds10(v); return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null; };

// Which habit names stand in for an action tracked elsewhere. Keyword matching
// is imperfect by nature, so a miss costs a small double-payment rather than a
// lost award, and the pairing is surfaced in the ledger for the user to see.
const OVERLAPS = [
  { group: "training", re: /\b(train|training|workout|work ?out|gym|lift|lifting|exercise)\b/i },
  { group: "meals", re: /\b(meal|meals|eat|eating|food|nutrition|macros)\b/i },
  { group: "protein", re: /\bprotein\b/i },
  { group: "water", re: /\b(water|hydrate|hydration)\b/i },
  { group: "sleep", re: /\bsleep\b/i },
];
const overlapForHabit = (name) => (OVERLAPS.find((o) => o.re.test(String(name || ""))) || {}).group || null;

/**
 * deps → { [date]: event[] }. Every event carries `kind` (a key in the value
 * table) and enough context for the engine: `habitId` for difficulty,
 * `label` for the ledger, `group` for overlap resolution.
 */
export function collectEvents(deps = {}, today = localDateStr()) {
  const byDay = {};
  const add = (d, ev) => { const k = dOf(d); if (!k || k > today) return; (byDay[k] ||= []).push(ev); };

  // ── Discipline — habits, purity and journal all run through the tracker
  //    since Gate 1, so this is one source, not three.
  const habits = arr(deps.htHabits);
  const nameOf = new Map(habits.map((h) => [h.id, h.name]));
  const hf = habitFeed(deps.htHabits, deps.htEntries, today);
  for (const c of hf.completions) {
    const name = nameOf.get(c.habitId) || "";
    const isPurity = c.habitId === "sys_purity";
    const isJournal = c.habitId === "sys_journal";
    add(c.d, {
      kind: isPurity ? "purity.dayClaimed" : isJournal ? "journal.entry" : "habit.completed",
      habitId: c.habitId,
      label: name || "Habit",
      group: overlapForHabit(name),
      // Journal length is checked against the entry's own text below.
      text: isJournal ? (deps.journalTextByDate || {})[c.d] : undefined,
    });
  }

  // Purity milestones — the one scaling ladder kept, because these are rare
  // and genuinely hard (§4.4).
  {
    const days = [...new Set(arr(deps.htEntries).filter((e) => e.habitId === "sys_purity" && Number(e.value) > 0).map((e) => ds10(e.date)))].sort();
    let run = 0, prev = null;
    for (const d of days) {
      run = prev && daysBetween(prev, d) === 1 ? run + 1 : 1;
      prev = d;
      if (PURITY_MILESTONES[run]) add(d, { kind: "purity.milestone", run, label: `${run}-day clean streak` });
    }
  }

  // ── Body — sessions, PRs, and the day's fuel ──────────────────────
  const workouts = arr(deps.workouts).filter((w) => dOf(w.date)).sort((a, b) => (ds10(a.date) < ds10(b.date) ? -1 : 1));
  const maxByEx = {};
  for (const w of workouts) {
    const d = ds10(w.date);
    const sets = arr(w.exercises).reduce((s, e) => s + arr(e.sets).length, 0);
    add(d, { kind: sets > 0 && sets < 3 ? "workout.partial" : "workout.logged", label: w.name || w.type || "Session", group: "training" });
    for (const ex of arr(w.exercises)) {
      if (!ex.name) continue;
      const top = arr(ex.sets).reduce((m, s) => Math.max(m, +s?.weight || +s?.weightKg || 0), 0);
      const prev = maxByEx[ex.name] || 0;
      if (top > prev && prev > 0) add(d, { kind: "workout.pr", label: `PR — ${ex.name}` });
      if (top > prev) maxByEx[ex.name] = top;
    }
  }

  {
    const nlog = sanitizeNutrition(deps.nutrition);
    const targets = calcTargets(deps.nutritionProfile);
    for (const [d, entries] of Object.entries(nlog)) {
      if (!dOf(d) || !entries.length) continue;
      const t = dayTotals(entries);
      add(d, { kind: "meals.dayComplete", label: "Meals logged", group: "meals" });
      if (targets.p > 0 && (t.p || 0) >= targets.p) add(d, { kind: "protein.hit", label: "Protein target", group: "protein" });
      if (targets.kcal > 0 && Math.abs((t.kcal || 0) - targets.kcal) <= targets.kcal * 0.1) add(d, { kind: "calories.inBand", label: "Calories in band" });
      // A quality score is not a separate award any more — it was one of the
      // paths that let one logged day pay three times.
      void nutritionScore;
    }
  }

  // ── Water — the two log paths, added, then graded once ────────────
  // Fluid arrives either as a beverage in the food log or against the linked
  // hydration habit. Grading inside the nutrition loop meant a day of water
  // with no food logged paid nothing, which is the wrong lesson to teach.
  {
    const nlog = sanitizeNutrition(deps.nutrition);
    const targets = calcTargets(deps.nutritionProfile);
    const direct = deps.hydration && typeof deps.hydration === "object" && !Array.isArray(deps.hydration) ? deps.hydration : {};
    const fluid = {};
    for (const [d, entries] of Object.entries(nlog)) {
      if (!dOf(d) || !entries.length) continue;
      fluid[d] = (fluid[d] || 0) + (dayTotals(entries).fluidMl || 0);
    }
    for (const [d, ml] of Object.entries(direct)) {
      if (!dOf(d)) continue;
      const v = Number(ml);
      if (Number.isFinite(v) && v > 0) fluid[d] = (fluid[d] || 0) + v;
    }
    if (targets.waterMl > 0) {
      for (const [d, ml] of Object.entries(fluid)) {
        if (ml >= targets.waterMl) add(d, { kind: "water.hit", label: "Water target", group: "water" });
      }
    }
  }

  // ── Sleep — trade_sleep is the single authoritative source (criterion 40)
  {
    const sleep = deps.sleep && typeof deps.sleep === "object" && !Array.isArray(deps.sleep) ? deps.sleep : {};
    for (const [d, hours] of Object.entries(sleep)) {
      if (!dOf(d)) continue;
      if (Number(hours) >= 6.5) add(d, { kind: "sleep.floorHeld", label: `${hours}h`, group: "sleep" });
    }
  }

  // ── The Firm — the gates and the vault, previously unrewarded ─────
  {
    const fin = deps.finance && typeof deps.finance === "object" ? deps.finance : {};
    for (const w of arr(fin.withdrawals)) {
      const d = dOf(w.date);
      if (!d) continue;
      const vault = Number(w.split?.vault) || 0;
      if (vault > 0) add(d, { kind: "vault.contribution", label: "Vault contribution" });
    }
    for (const g of arr(fin.gatesCleared)) { const d = dOf(g.date || g.month); if (d) add(d, { kind: "gate.monthCleared", label: g.label || "Gate month cleared" }); }
    for (const q of arr(fin.quartersCleared)) { const d = dOf(q.date || q.quarter); if (d) add(d, { kind: "campaign.quarterCleared", label: q.label || "Campaign quarter" }); }
    for (const i of arr(fin.income)) { const d = dOf(i.date); if (d) add(d, { kind: "income.logged", label: i.source || "Income" }); }
    for (const b of arr(fin.bills)) { if (b.lastPaidMonth) add(`${b.lastPaidMonth}-15`, { kind: "bill.paid", label: b.name || "Bill" }); }
  }

  // ── Reviews. Trading itself pays nothing (§4.4); the day-review does. ──
  for (const r of arr(deps.reviews)) {
    const d = dOf(r.date);
    if (!d) continue;
    if (r.kind === "monthly") add(d, { kind: "review.monthly", label: "Monthly review" });
    else if (r.kind === "weekly") add(d, { kind: "review.weekly", label: "Weekly review" });
    else add(d, { kind: "trading.dayReview", label: "Day review" });
  }

  // ── Faith ─────────────────────────────────────────────────────────
  for (const c of arr(deps.church)) add(dOf(c.date), { kind: "faith.church", label: "Service" });
  for (const v of arr(deps.verses)) {
    const added = dOf(v.addedAt || v.date);
    if (added) add(added, { kind: "faith.verseAdded", label: v.ref || "Verse" });
    const n = Math.max(0, Math.floor(+v.reviewCount || 0));
    for (let i = 0; i < Math.min(n, 20); i++) add(dOf(v.lastReviewed) || added, { kind: "faith.verseReviewed", label: v.ref || "Verse review" });
  }
  for (const n of arr(deps.faithNotes)) add(dOf(n.date), { kind: "faith.devotional", label: "Devotional" });
  for (const m of arr(deps.missions)) {
    const d = dOf(m.date || m.completedAt);
    const kind = { day: "faith.missionDay", week: "faith.missionWeek", month: "faith.missionMonth", quarter: "faith.missionQuarter", year: "faith.missionYear" }[m.level];
    if (m.done && d && kind) add(d, { kind, label: m.label || "Mission" });
  }

  // ── Mind ──────────────────────────────────────────────────────────
  for (const n of arr(deps.mindNotes)) add(dOf(n.date), { kind: "mind.note", label: "Note" });
  for (const dec of arr(deps.decisions)) {
    add(dOf(dec.date), { kind: "mind.decisionLogged", label: dec.title || "Decision" });
    if (dOf(dec.reviewedAt)) add(dOf(dec.reviewedAt), { kind: "mind.decisionReviewed", label: dec.title || "Decision reviewed" });
  }
  for (const b of arr(deps.library)) {
    if (b.status === "done" || b.finishedAt) add(dOf(b.finishedAt || b.date), { kind: "mind.bookFinished", label: b.title || "Book" });
  }

  // ── Growth — goals and the want list ──────────────────────────────
  for (const g of arr(deps.goals)) {
    for (const p of [25, 50, 75]) { const d = dOf(g.ms?.[p]); if (d) add(d, { kind: "goal.checkpoint", label: `${g.name || "Goal"} · ${p}%` }); }
    if (dOf(g.completedAt)) add(dOf(g.completedAt), { kind: "goal.completed", label: g.name || "Goal" });
  }
  for (const w of arr(deps.wants)) {
    if (dOf(w.purchasedAt)) {
      add(dOf(w.purchasedAt), { kind: "want.purchased", label: w.name || "Want" });
      if (w.forWhom === "gift") add(dOf(w.purchasedAt), { kind: "want.gift", label: `${w.name || "Gift"} — for someone else` });
    }
  }

  // NOTE: no app-open, tab-view or notification-dismissal event exists here.
  // Presence is not collected at all, so it cannot be priced (criterion 11).

  return resolveOverlaps(byDay);
}

/**
 * Within one day, events sharing an overlap group describe the same
 * real-world action. The highest-priced one pays; the rest are marked
 * `supersededBy` and pay nothing while still being recorded.
 */
export function resolveOverlaps(byDay) {
  const out = {};
  for (const [d, events] of Object.entries(byDay)) {
    const groups = {};
    for (const ev of events) if (ev.group) (groups[ev.group] ||= []).push(ev);
    const winners = {};
    for (const [g, list] of Object.entries(groups)) {
      let best = null, bestXp = -1;
      for (const ev of list) {
        const xp = priceEvent({ ...ev, group: undefined }).xp || 0;
        if (xp > bestXp) { bestXp = xp; best = ev; }
      }
      winners[g] = best;
    }
    out[d] = events.map((ev) => (ev.group && winners[ev.group] && winners[ev.group] !== ev
      ? { ...ev, supersededBy: winners[ev.group].kind }
      : ev));
  }
  return out;
}

export { EVENTS };
