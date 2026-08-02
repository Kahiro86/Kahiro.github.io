// ── Flashcards — spaced repetition (SM-2-lite) ───────────────────────
// Turn lessons worth keeping into recallable cards. Each review reschedules a
// card by how well you knew it: forgot → today, knew it → further out. Pure,
// corruption-tolerant, own store.
import { localDateStr } from "./dates.js";

export const CARD_KEY = "review_cards";
export const GRADES = [
  { id: "again", label: "Again", tone: "bad" },
  { id: "good", label: "Good", tone: "ok" },
  { id: "easy", label: "Easy", tone: "good" },
];

const uid = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const dOf = (v) => (typeof v === "string" && DATE_RE.test(v.slice(0, 10)) ? v.slice(0, 10) : null);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Add `days` to a YYYY-MM-DD string (local-time safe).
export function addDays(ds, days) {
  const [y, m, d] = ds.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  const p = (x) => String(x).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

export function sanitizeCards(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c) => c && typeof c === "object" && typeof c.front === "string" && c.front.trim())
    .map((c) => ({
      id: typeof c.id === "string" ? c.id : uid(),
      front: c.front.trim().slice(0, 300),
      back: typeof c.back === "string" ? c.back.trim().slice(0, 500) : "",
      reps: Math.max(0, Math.round(+c.reps || 0)),
      intervalDays: Math.max(0, Math.round(+c.intervalDays || 0)),
      ease: Number.isFinite(+c.ease) ? clamp(+c.ease, 1.3, 3) : 2.3,
      due: dOf(c.due) || localDateStr(),
      createdAt: dOf(c.createdAt) || localDateStr(),
    }));
}

export function addCard(list, front, back = "") {
  const f = (front || "").trim();
  if (!f) return sanitizeCards(list);
  return [{ id: uid(), front: f.slice(0, 300), back: (back || "").trim().slice(0, 500), reps: 0, intervalDays: 0, ease: 2.3, due: localDateStr(), createdAt: localDateStr() }, ...sanitizeCards(list)];
}

export const removeCard = (list, id) => sanitizeCards(list).filter((c) => c.id !== id);

// Reschedule one card by grade. Returns the updated card.
export function schedule(card, grade, today = localDateStr()) {
  const c = sanitizeCards([card])[0];
  if (!c) return card;
  const ease = clamp(c.ease + (grade === "again" ? -0.2 : grade === "easy" ? 0.15 : 0), 1.3, 3);
  let reps, interval;
  if (grade === "again") { reps = 0; interval = 0; }
  else if (grade === "good") { reps = c.reps + 1; interval = c.reps === 0 ? 1 : c.reps === 1 ? 3 : Math.max(1, Math.round(c.intervalDays * ease)); }
  else { reps = c.reps + 1; interval = c.reps === 0 ? 3 : Math.max(2, Math.round(c.intervalDays * ease * 1.3)); }
  return { ...c, ease, reps, intervalDays: interval, due: addDays(today, interval) };
}

export const applyReview = (list, id, grade, today = localDateStr()) =>
  sanitizeCards(list).map((c) => (c.id === id ? schedule(c, grade, today) : c));

export const dueCards = (list, today = localDateStr()) => sanitizeCards(list).filter((c) => c.due <= today);

export function cardStats(list, today = localDateStr()) {
  const clean = sanitizeCards(list);
  return { total: clean.length, due: clean.filter((c) => c.due <= today).length, learned: clean.filter((c) => c.reps >= 3).length };
}
