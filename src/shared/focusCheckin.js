// ── Weekly-focus daily check-in ──────────────────────────────────────
// The focus itself lives in weekly_focus (review.js) — the single source of
// truth. This adds one tap per day against the focus: "Did today serve it?"
// Yes / Partially / No, stored by date. Derived signals (under-served, week
// pattern) are computed FROM these answers, never tracked separately.
import { localDateStr, daysAgoStr } from "./dates.js";

export const CHECKIN_KEY = "focus_checkins";       // { "YYYY-MM-DD": "yes"|"partial"|"no" }
export const CHECKIN_CFG_KEY = "focus_checkin_cfg"; // { cadence: "off"|"daily"|"twice" }

export const ANSWERS = [
  { id: "yes", label: "Yes", tone: "good" },
  { id: "partial", label: "Partially", tone: "mid" },
  { id: "no", label: "No", tone: "bad" },
];
const IDS = new Set(ANSWERS.map((a) => a.id));
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function sanitizeCheckins(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out = {};
  for (const [k, v] of Object.entries(raw)) if (DATE_RE.test(k) && IDS.has(v)) out[k] = v;
  return out;
}

export const getCheckin = (map, ds = localDateStr()) => sanitizeCheckins(map)[ds] || null;
export function setCheckin(map, ds, ans) {
  const c = sanitizeCheckins(map);
  if (!DATE_RE.test(ds) || !IDS.has(ans)) return c;
  return { ...c, [ds]: ans };
}
export const answerMeta = (id) => ANSWERS.find((a) => a.id === id) || null;

// ── Reminder cadence (Settings) ──────────────────────────────────────
export const CADENCES = ["off", "daily", "twice"];
export const getCadence = (cfg) => (cfg && CADENCES.includes(cfg.cadence) ? cfg.cadence : "daily");

// Should the in-app prompt show right now? Off → never; otherwise until the
// day is answered. "twice" additionally re-surfaces in the afternoon slot even
// if the morning was answered, so the answer can be updated later in the day.
export function needsCheckin(map, cfg, now = new Date()) {
  const cad = getCadence(cfg);
  if (cad === "off") return false;
  const ds = localDateStr(now);
  const answered = !!getCheckin(map, ds);
  if (!answered) return true;
  return false; // one stored verdict per day; "twice" only affects re-nudge timing (UI)
}

// ── Derived week signals (computed from the answers) ─────────────────
// Elapsed week (Mon → today) as { ds, answer|null }, oldest → newest.
export function weekAnswers(map, now = new Date()) {
  const clean = sanitizeCheckins(map);
  const ds = localDateStr(now);
  const monOffset = (new Date(`${ds}T12:00:00`).getDay() + 6) % 7;
  const out = [];
  for (let i = monOffset; i >= 0; i--) { const d = daysAgoStr(i); out.push({ ds: d, answer: clean[d] || null }); }
  return out;
}

export const underServedCount = (map, now = new Date()) =>
  weekAnswers(map, now).filter((a) => a.answer === "no" || a.answer === "partial").length;

// 3+ days logged No/Partially this week → the focus is being under-served.
export const isUnderServed = (map, now = new Date()) => underServedCount(map, now) >= 3;
