// ── Smart assistance (Kaizen phase 14) — no AI, just honest rules ────
// Every nudge answers "what should I do now?", links to where to do it,
// and celebrates real milestones. Quiet by design: only what's true today.
import { localDateStr } from "./dates.js";
import { isScheduled, isDone, isSkipped, isNonNeg, isWeekly, currentStreak, rangeStats } from "./habitEngine.js";
import { pendingReviews, sanitizeReviews } from "../modules/trading/reviews.js";
import { billsDueSoon } from "../modules/finance/bills.js";

// deps: { habits, trades, reviews, bills, verses, decisions }
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
    out.push({ id: "reviews", icon: "📋", tone: "urgent", nav: "trading",
      text: `${reviews.length} trading review${reviews.length > 1 ? "s" : ""} pending — the loop closes when it's written.` });
  }

  // 5. Bills due soon.
  const bills = billsDueSoon(deps.bills || []);
  if (bills.length) {
    out.push({ id: "bills", icon: "💰", tone: "urgent", nav: "finance",
      text: `${bills.length} bill${bills.length > 1 ? "s" : ""} due within 7 days — ${bills[0].name} first.` });
  }

  // 6. Scripture reviews due.
  const verses = (deps.verses || []).filter((v) => v && v.id);
  const dueVerses = verses.filter((v) => {
    const last = v.lastReviewed || v.addedAt;
    if (!last) return false;
    const daysSince = Math.floor((new Date(`${ds}T12:00:00`) - new Date(`${last}T12:00:00`)) / 86400000);
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
    return Math.floor((new Date(`${ds}T12:00:00`) - new Date(`${d.date}T12:00:00`)) / 86400000) >= 30;
  });
  if (dueDecisions.length) {
    out.push({ id: "decisions", icon: "⚖️", tone: "info", nav: "mind",
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

  // 9. Weekly focus: the weakest area over 30 days (Sundays only, one line).
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

  // Urgent first, celebrations next, gentle guidance last.
  const order = { urgent: 0, celebrate: 1, info: 2 };
  return out.sort((a, b) => order[a.tone] - order[b.tone]).slice(0, 6);
}
