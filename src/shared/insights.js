// ── Smart assistance (Kaizen phase 14) — no AI, just honest rules ────
// Every nudge answers "what should I do now?", links to where to do it,
// and celebrates real milestones. Quiet by design: only what's true today.
import { localDateStr, daysAgoStr, daysBetween } from "./dates.js";
import { isScheduled, isDone, isSkipped, isNonNeg, isWeekly, currentStreak, rangeStats } from "./habitEngine.js";
import { pendingReviews, sanitizeReviews } from "../modules/trading/reviews.js";
import { billsDueSoon } from "../modules/finance/bills.js";
import { sanitizePurity, statusOn } from "../modules/life/purity.js";
import { sanitizeNutrition, dayTotals, calcTargets, dayEntries } from "../modules/athlete/nutrition.js";
import { sanitizeWants, isActive, pctOf, remainingOf, savedOf, timelineOf, fmtKsh } from "./wants.js";

// deps: { habits, trades, reviews, bills, verses, decisions, purity, nutrition, nutritionProfile, entries, wants }
export function buildNudges(deps) {
  const ds = localDateStr();
  const habits = (deps.habits || []).filter((h) => h && !h.archived && !h.paused);
  const out = [];

  // 1. Non-negotiables still open today.
  const openNonNegs = habits.filter((h) => isNonNeg(h) && !isWeekly(h) && isScheduled(h, ds) && !isDone(h, ds) && !isSkipped(h, ds));
  if (openNonNegs.length) {
    out.push({ id: "nonneg", icon: "❤️", tone: "urgent", nav: "life",
      text: `${openNonNegs.length} non-negotiable${openNonNegs.length > 1 ? "s" : ""} still open today — start with ${openNonNegs[0].name}.` });
  }

  // 2. Streaks at risk: a 7+ day streak not yet done today.
  const atRisk = habits.filter((h) => isScheduled(h, ds) && !isDone(h, ds) && !isSkipped(h, ds) && currentStreak(h) >= 7);
  for (const h of atRisk.slice(0, 2)) {
    out.push({ id: `risk_${h.id}`, icon: "🔥", tone: "urgent", nav: "life",
      text: `${h.name}'s ${currentStreak(h)}-day streak is on the line today.` });
  }

  // 3. Repeated misses: scheduled ≥4 of the last 7 days, done ≤1 — shrink it.
  for (const h of habits) {
    const s = rangeStats(h, 7);
    if (s.scheduled >= 4 && s.done <= 1 && !isDone(h, ds)) {
      out.push({ id: `miss_${h.id}`, icon: "🌱", tone: "info", nav: "life",
        text: `${h.name} slipped this week (${s.done}/${s.scheduled}). Shrink it — the 2-minute version still counts.` });
      break; // one gentle nudge, never a scoreboard
    }
  }

  // 4. Trading reviews owed.
  const reviews = pendingReviews(deps.trades || [], sanitizeReviews(deps.reviews));
  if (reviews.length) {
    out.push({ id: "reviews", icon: "📋", tone: "urgent", nav: "firm:trading",
      text: `${reviews.length} trading review${reviews.length > 1 ? "s" : ""} pending — the loop closes when it's written.` });
  }

  // 5. Bills due soon.
  const bills = billsDueSoon(deps.bills || []);
  if (bills.length) {
    out.push({ id: "bills", icon: "💰", tone: "urgent", nav: "firm:wealth",
      text: `${bills.length} bill${bills.length > 1 ? "s" : ""} due within 7 days — ${bills[0].name} first.` });
  }

  // 6. Scripture reviews due.
  const verses = (deps.verses || []).filter((v) => v && v.id);
  const dueVerses = verses.filter((v) => {
    const last = v.lastReviewed || v.addedAt;
    if (!last) return false;
    const daysSince = daysBetween(last, ds);
    const ivs = [1, 3, 7, 14, 30, 60];
    return daysSince >= ivs[Math.min(v.reviews || 0, ivs.length - 1)];
  });
  if (dueVerses.length) {
    out.push({ id: "verses", icon: "📖", tone: "info", nav: "faith",
      text: `${dueVerses.length} verse${dueVerses.length > 1 ? "s" : ""} due for review — recite before you read.` });
  }

  // 7. Decisions ready to review (30 days elapsed).
  const dueDecisions = (deps.decisions || []).filter((d) => {
    if (!d || d.reviewedAt || !d.date) return false;
    return daysBetween(d.date, ds) >= 30;
  });
  if (dueDecisions.length) {
    out.push({ id: "decisions", icon: "⚖️", tone: "info", nav: "faith:mind",
      text: `${dueDecisions.length} decision${dueDecisions.length > 1 ? "s" : ""} ready for outcome review — judgment compounds when checked.` });
  }

  // 8. Milestones: streaks crossing 7/30/100 today.
  for (const h of habits) {
    const st = currentStreak(h);
    if ([7, 30, 100].includes(st) && isDone(h, ds)) {
      out.push({ id: `mile_${h.id}`, icon: "🏆", tone: "celebrate", nav: "life",
        text: `${h.name}: ${st}-day streak. That's identity, not luck.` });
    }
  }

  // 9. Purity check-in still open (only once the practice has begun).
  const purityLog = sanitizePurity(deps.purity);
  if (Object.keys(purityLog).length && !statusOn(purityLog, ds)) {
    out.push({ id: "purity", icon: "🛡️", tone: "info", nav: "life",
      text: "Purity check-in is open — claim today." });
  }

  // 10. Nutrition: once the tracker is in use — empty log after midday, or
  // protein badly behind by evening. One nudge, never both.
  const nlog = sanitizeNutrition(deps.nutrition);
  if (Object.keys(nlog).length) {
    const todayN = dayEntries(nlog, ds);
    const hour = new Date().getHours();
    const ydsN = daysAgoStr(1);
    if (!todayN.length && hour >= 12) {
      out.push({ id: "nutrition", icon: "🍽️", tone: "info", nav: "life:athlete",
        text: "Nothing logged in Nutrition yet — 10 seconds logs your last meal." });
    } else if (!dayEntries(nlog, ydsN).length) {
      // Yesterday's gap only surfaces once today isn't also empty — one
      // nutrition nudge at a time, never both stacked.
      out.push({ id: "yesterday_nutrition", icon: "🍽️", tone: "info", nav: "life:athlete",
        text: "Yesterday's nutrition log is empty — log it now, backdated to Yesterday." });
    } else if (todayN.length && hour >= 18) {
      const nT = calcTargets(deps.nutritionProfile);
      const t = dayTotals(todayN);
      if (t.p < nT.p * 0.6) {
        out.push({ id: "protein", icon: "🥩", tone: "info", nav: "life:athlete",
          text: `Protein is at ${Math.round(t.p)}g of ${nT.p}g with the day winding down — dinner decides.` });
      }
    }
  }

  // 10b. Backup reminder: only when cloud sync is OFF (so this device is the
  // sole copy) and no export in 30+ days — one gentle line, never nagging.
  if (deps.syncOn === false) {
    const last = +deps.lastExport || 0;
    const staleDays = last ? daysBetween(localDateStr(new Date(last)), ds) : Infinity;
    if (staleDays >= 30) {
      out.push({ id: "backup", icon: "💾", tone: "info", nav: "settings",
        text: last ? "It's been a while since your last backup — export one so a cleared browser can't erase your data."
                   : "No backup yet — export one so a cleared browser can't erase your trades, workouts and journal." });
    }
  }

  // 11. Weekly focus: the weakest area over 30 days (Sundays only, one line).
  if (new Date().getDay() === 0 && habits.length >= 3) {
    const byCat = {};
    for (const h of habits) {
      const s = rangeStats(h, 30);
      if (!s.scheduled) continue;
      byCat[h.category] = byCat[h.category] || { sched: 0, done: 0 };
      byCat[h.category].sched += s.scheduled;
      byCat[h.category].done += s.done;
    }
    const ranked = Object.entries(byCat).map(([cat, x]) => ({ cat, pct: Math.round((x.done / x.sched) * 100) })).sort((a, b) => a.pct - b.pct);
    if (ranked.length && ranked[0].pct < 70) {
      out.push({ id: "focus", icon: "🎯", tone: "info", nav: "life",
        text: `This week's focus: ${ranked[0].cat} (${ranked[0].pct}% last 30d). One small rep a day.` });
    }
  }

  // 12. Yesterday looks incomplete — now that Habits and Journal both
  // support backdating, a gap yesterday isn't lost; it's one tap away.
  // Encouraging framing only ("finish it"), never a guilt count.
  const yds = daysAgoStr(1);
  const yScheduled = habits.filter((h) => isScheduled(h, yds));
  const yUndone = yScheduled.filter((h) => !isDone(h, yds) && !isSkipped(h, yds));
  if (yScheduled.length && yUndone.length >= Math.ceil(yScheduled.length / 2)) {
    out.push({ id: "yesterday_habits", icon: "📅", tone: "info", nav: "life",
      text: `Yesterday looks incomplete — pick Yesterday in the date picker to finish logging it.` });
  }

  const journalEntries = Array.isArray(deps.entries) ? deps.entries : [];
  if (journalEntries.length && !journalEntries.some((e) => (e?.date || "").slice(0, 10) === yds)) {
    out.push({ id: "yesterday_journal", icon: "📓", tone: "info", nav: "life",
      text: "No journal entry for yesterday — one honest sentence, backdated, still counts." });
  }

  // 13. Want List: celebrate the goal that's almost there, and gently revive
  // one that's gone quiet — encouraging framing, never a spending prompt.
  const activeWants = sanitizeWants(deps.wants).filter(isActive);
  const almost = activeWants.filter((w) => pctOf(w) >= 90 && remainingOf(w) > 0).sort((a, b) => pctOf(b) - pctOf(a))[0];
  if (almost) {
    out.push({ id: "want_almost", icon: "🗝️", tone: "info", nav: "journey",
      text: `Only ${fmtKsh(remainingOf(almost))} left on ${almost.name} — you're at ${Math.round(pctOf(almost))}%.` });
  }
  const stalled = activeWants
    .filter((w) => savedOf(w) > 0 && pctOf(w) < 100)
    .map((w) => ({ w, gap: (() => { const l = timelineOf(w).last; return l ? daysBetween(l, ds) : 0; })() }))
    .filter((x) => x.gap >= 14)
    .sort((a, b) => b.gap - a.gap)[0];
  if (stalled && (!almost || stalled.w.id !== almost.id)) {
    out.push({ id: "want_stalled", icon: "🌱", tone: "info", nav: "journey",
      text: `You haven't added to ${stalled.w.name} in ${Math.floor(stalled.gap / 7)} weeks — even a little keeps it alive.` });
  }

  // Urgent first, celebrations next, gentle guidance last.
  const order = { urgent: 0, celebrate: 1, info: 2 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, 6);
}
