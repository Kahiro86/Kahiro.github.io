// ── Prayer list — requests carried, answers remembered ───────────────
// Each request is one record; marking it answered stamps the date so the
// answered log becomes a record of faithfulness over time. Pure and
// corruption-tolerant. Its own store.
import { localDateStr } from "./dates.js";

export const PRAYER_KEY = "prayer_list";
export const CATEGORIES = ["Family", "Provision", "Guidance", "Health", "Gratitude", "Others", "Other"];

const uid = () => `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const dOf = (v) => (typeof v === "string" && DATE_RE.test(v.slice(0, 10)) ? v.slice(0, 10) : null);

export function sanitizePrayers(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p) => p && typeof p === "object" && typeof p.text === "string" && p.text.trim())
    .map((p) => ({
      id: typeof p.id === "string" ? p.id : uid(),
      text: p.text.trim().slice(0, 240),
      category: CATEGORIES.includes(p.category) ? p.category : "Other",
      addedAt: dOf(p.addedAt) || localDateStr(),
      answeredAt: dOf(p.answeredAt),
      note: typeof p.note === "string" ? p.note.trim().slice(0, 240) : "",
    }));
}

export function addPrayer(list, text, category = "Other") {
  const t = (text || "").trim();
  if (!t) return sanitizePrayers(list);
  return [{ id: uid(), text: t.slice(0, 240), category: CATEGORIES.includes(category) ? category : "Other", addedAt: localDateStr(), answeredAt: null, note: "" }, ...sanitizePrayers(list)];
}

export const answerPrayer = (list, id, note = "") =>
  sanitizePrayers(list).map((p) => (p.id === id ? { ...p, answeredAt: p.answeredAt || localDateStr(), note: (note || p.note || "").trim().slice(0, 240) } : p));

export const reopenPrayer = (list, id) =>
  sanitizePrayers(list).map((p) => (p.id === id ? { ...p, answeredAt: null } : p));

export const removePrayer = (list, id) => sanitizePrayers(list).filter((p) => p.id !== id);

export function prayerStats(list) {
  const clean = sanitizePrayers(list);
  const answered = clean.filter((p) => p.answeredAt);
  return { total: clean.length, active: clean.length - answered.length, answered: answered.length };
}

export const activePrayers = (list) => sanitizePrayers(list).filter((p) => !p.answeredAt);
export const answeredPrayers = (list) => sanitizePrayers(list).filter((p) => p.answeredAt).sort((a, b) => (b.answeredAt || "").localeCompare(a.answeredAt || ""));
