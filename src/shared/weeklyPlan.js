// ── Weekly plan — set the week's theme + three priorities ────────────
// One record per week, keyed by that week's Monday. Last week's priorities
// surface for carry-over. Pure + corruption-tolerant.
import { localDateStr } from "./dates.js";

export const WEEKLY_KEY = "weekly_plan";

// Monday (YYYY-MM-DD) of the week containing `ds`. Local-time safe.
export function mondayOf(ds = localDateStr()) {
  const [y, m, d] = ds.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const shift = (dt.getDay() + 6) % 7; // Sun=0 → 6, Mon=1 → 0 …
  dt.setDate(dt.getDate() - shift);
  const p = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

export function prevMonday(monday) {
  const [y, m, d] = monday.split("-").map(Number);
  const dt = new Date(y, m - 1, d - 7);
  const p = (n) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

// "Aug 4 – 10" style label for the week starting `monday`.
export function weekLabel(monday) {
  const [y, m, d] = monday.split("-").map(Number);
  const a = new Date(y, m - 1, d), b = new Date(y, m - 1, d + 6);
  const mo = (dt) => dt.toLocaleDateString("en-US", { month: "short" });
  return a.getMonth() === b.getMonth() ? `${mo(a)} ${a.getDate()} – ${b.getDate()}` : `${mo(a)} ${a.getDate()} – ${mo(b)} ${b.getDate()}`;
}

const cleanLine = (s) => (typeof s === "string" ? s.trim().slice(0, 160) : "");
const cleanTop = (arr) => (Array.isArray(arr) ? arr : []).map(cleanLine).filter(Boolean).slice(0, 3);

export function sanitizePlans(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !v || typeof v !== "object") continue;
    out[k] = { theme: cleanLine(v.theme), priorities: cleanTop(v.priorities), at: typeof v.at === "string" ? v.at : "" };
  }
  return out;
}

export const getPlan = (plans, monday) => sanitizePlans(plans)[monday] || null;
