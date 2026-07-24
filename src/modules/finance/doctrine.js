// ── Money Doctrine — the "who I am" behind the numbers ──────────────
// Finance tracks what the money does; this holds why it matters. A personal
// money creed (the "why" / freedom vision), the principles the owner spends
// and saves by, and the core values the money is meant to serve. Pure data +
// sanitizer; the tab owns the storage (`finance_doctrine`). Parallels the
// Firm's Covenant — identity encoded, editable, never invented for the user.
const str = (v, n) => (typeof v === "string" ? v.slice(0, n) : "");
const uid = (p = "pr") => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const DOCTRINE_KEY = "finance_doctrine";

// Suggested starting points — offered as one-tap adds, never auto-applied, so
// what lands here is always the owner's own choice.
export const SUGGESTED_PRINCIPLES = [
  "Pay my future self first — before anything else gets a shilling.",
  "Every shilling has a job before the month begins.",
  "Freedom is worth more than comfort or status.",
  "Debt is a chain — break it faster than it grows.",
  "Invest boredom now; harvest freedom later.",
  "I own my money; it never owns me.",
  "Give generously — abundance is a mindset, not a balance.",
  "Never risk the roof to chase the view.",
];

export const SUGGESTED_VALUES = ["Freedom", "Family", "Faith", "Security", "Growth", "Generosity", "Legacy", "Health", "Adventure", "Peace"];

export function sanitizeDoctrine(raw) {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const principles = (Array.isArray(o.principles) ? o.principles : [])
    .filter((p) => p && typeof p === "object" && typeof p.text === "string" && p.text.trim())
    .map((p) => ({ id: p.id ? String(p.id) : uid(), text: p.text.slice(0, 240), archived: !!p.archived }))
    .slice(0, 60);
  const values = [...new Set((Array.isArray(o.values) ? o.values : []).filter((v) => typeof v === "string" && v.trim()).map((v) => v.trim().slice(0, 40)))].slice(0, 24);
  return {
    why: str(o.why, 2000),
    principles,
    values,
    updatedAt: typeof o.updatedAt === "string" ? o.updatedAt : null,
  };
}

export const newPrinciple = (text) => ({ id: uid(), text: String(text || "").slice(0, 240), archived: false });

// The active principles a coach / analyst can reason against.
export const activePrinciples = (doctrine) => sanitizeDoctrine(doctrine).principles.filter((p) => !p.archived);
