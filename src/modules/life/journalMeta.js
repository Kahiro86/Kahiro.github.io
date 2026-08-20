// ── Journal metadata: mood, tags, and what the entries say ───────────
// A journal that stamps each entry with the day's state (mood + God-Mode
// score + habits) stops being a text pile and becomes correlatable — you can
// ask whether the hard days really were the low-score days, or just felt it.
import { localDateStr, daysAgoStr } from "../../shared/dates.js";

export const MOODS = [
  { id: "drained", label: "Drained", tone: "dn" },
  { id: "flat", label: "Flat", tone: null },
  { id: "steady", label: "Steady", tone: null },
  { id: "sharp", label: "Sharp", tone: "up" },
];
export const moodLabel = (id) => MOODS.find((m) => m.id === id)?.label || null;
export const moodTone = (id) => MOODS.find((m) => m.id === id)?.tone || null;

export const JOURNAL_TAGS = ["Kitchen", "Trading", "Training", "Faith", "Money", "Health"];

const arr = (x) => (Array.isArray(x) ? x.filter(Boolean) : []);

// This-month count + a writing streak (consecutive days with an entry, ending
// today or yesterday — today still pending never breaks it).
export function writingStats(entries, today = localDateStr()) {
  const days = new Set(arr(entries).map((e) => (e.date || "").slice(0, 10)).filter(Boolean));
  const monthCount = arr(entries).filter((e) => (e.date || "").slice(0, 7) === today.slice(0, 7)).length;
  let streak = 0;
  for (let i = days.has(today) ? 0 : 1; i < 3650; i++) {
    if (days.has(daysAgoStr(i))) streak++;
    else break;
  }
  return { monthCount, streak, totalDays: days.size };
}

// Mood → average God-Mode score, hard-day writing skew, and the longest gap
// between entries now vs earlier (did the pen come back faster?).
export function journalPatterns(entries, today = localDateStr()) {
  const list = arr(entries);
  const byMood = {};
  for (const e of list) if (e.mood) (byMood[e.mood] ||= []).push(e);
  const moodAvg = {};
  for (const [m, es] of Object.entries(byMood)) {
    const g = es.map((e) => e.gm).filter((v) => Number.isFinite(v));
    moodAvg[m] = g.length ? Math.round(g.reduce((s, x) => s + x, 0) / g.length) : null;
  }
  const hard = list.filter((e) => e.mood === "drained" || e.mood === "flat").length;
  const withMood = list.filter((e) => e.mood).length;

  // Gaps between consecutive entry days, earliest → latest.
  const dates = [...new Set(list.map((e) => (e.date || "").slice(0, 10)).filter(Boolean))].sort();
  const gaps = [];
  for (let i = 1; i < dates.length; i++) {
    const a = new Date(dates[i - 1] + "T12:00:00"), b = new Date(dates[i] + "T12:00:00");
    gaps.push(Math.round((b - a) / 86400000));
  }
  const maxGapEver = gaps.length ? Math.max(...gaps) : 0;
  const recentMaxGap = gaps.length ? Math.max(...gaps.slice(Math.floor(gaps.length / 2))) : 0;

  return { moodAvg, total: list.length, hard, withMood, maxGapEver, recentMaxGap };
}
