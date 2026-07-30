// ── Seasons — time-boxed modes (fasts, blocks) over the nutrition engine
// A reusable pattern: a Season has a template, a start date, and a duration.
// While active it reframes nutrition and adjusts the God Mode floors; it ends
// automatically at the day count and reverts. First template: the Daniel Fast.
// Future fasts/blocks add a template here — no new component needed.
import { localDateStr, daysBetween } from "./dates.js";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Templates. `proteinFloorMult` reasonably lowers the protein floor when meat
// is out (Daniel Fast) so the enforcement doesn't demand impossible protein;
// calories are unchanged. `allow`/`avoid` drive the framing copy only.
export const SEASON_TEMPLATES = [
  {
    id: "daniel",
    name: "Daniel Fast",
    days: 21,
    proteinFloorMult: 0.6,
    kcalFloorMult: 1.0,
    framing: "Whole foods only — fruit, vegetables, legumes, whole grains, nuts, seeds, water. No meat, no sweeteners, no processed food. Restricted, not starving.",
    avoid: ["meat", "whey / protein powder", "sweeteners & sugar", "processed food"],
  },
];
export const templateById = (id) => SEASON_TEMPLATES.find((t) => t.id === id) || null;

export function sanitizeSeason(raw) {
  const p = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : null;
  if (!p || !DATE_RE.test(p.startDate)) return null;
  const tpl = templateById(p.template);
  if (!tpl) return null;
  return {
    template: tpl.id,
    name: typeof p.name === "string" && p.name ? p.name.slice(0, 40) : tpl.name,
    startDate: p.startDate,
    days: Number.isInteger(+p.days) && +p.days >= 1 && +p.days <= 365 ? +p.days : tpl.days,
  };
}

// Active if today is within [startDate, startDate + days). Ends automatically.
export function seasonActive(season, ds = localDateStr()) {
  const s = sanitizeSeason(season);
  if (!s) return false;
  const elapsed = daysBetween(s.startDate, ds);
  return elapsed >= 0 && elapsed < s.days;
}
export function seasonDay(season, ds = localDateStr()) {
  const s = sanitizeSeason(season);
  if (!s) return 0;
  return Math.min(s.days, daysBetween(s.startDate, ds) + 1);
}
export const seasonTemplate = (season) => { const s = sanitizeSeason(season); return s ? templateById(s.template) : null; };

// God Mode floor multipliers for an active season (identity when inactive).
export function seasonFloorAdjust(season, ds = localDateStr()) {
  if (!seasonActive(season, ds)) return { proteinFloorMult: 1, kcalFloorMult: 1 };
  const tpl = seasonTemplate(season);
  return { proteinFloorMult: tpl?.proteinFloorMult ?? 1, kcalFloorMult: tpl?.kcalFloorMult ?? 1 };
}

export const startSeason = (templateId, startDate = localDateStr(), days) => {
  const tpl = templateById(templateId);
  if (!tpl) return null;
  return { template: tpl.id, name: tpl.name, startDate, days: days || tpl.days };
};
