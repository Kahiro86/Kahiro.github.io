// ── Journal prompts + mood — a nudge for the blank page ──────────────
// A rotating daily prompt and a small mood vocabulary. Entries written with
// these still land in the normal journal_entries store (same {id,date,text}
// shape) with optional mood + tags alongside, so the Journal tab shows them
// unchanged. Pure.
export const PROMPTS = [
  "What improved today, even slightly?",
  "What drained you — and was it worth it?",
  "What did you avoid, and why?",
  "Where did you show discipline no one saw?",
  "What would make tomorrow a win?",
  "What are you grateful for right now?",
  "What did today teach you about yourself?",
  "What's one thing you'd do differently?",
  "Who did you serve or strengthen today?",
  "What fear showed up, and how did you meet it?",
  "What's the smallest next step that matters?",
  "What did you build toward the five-year vision?",
  "What pulled you off course — and what pulls you back?",
  "What are you proud of that you'd never brag about?",
];

export const MOODS = [
  { id: "driven", emoji: "🔥", label: "Driven" },
  { id: "calm", emoji: "😌", label: "Calm" },
  { id: "grateful", emoji: "🙏", label: "Grateful" },
  { id: "flat", emoji: "😐", label: "Flat" },
  { id: "low", emoji: "😔", label: "Low" },
  { id: "frustrated", emoji: "😤", label: "Frustrated" },
];

const dayIndex = (ds) => { const [y, m, d] = (ds || "").split("-").map(Number); return Number.isFinite(y) ? Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 864e5) : 0; };

// The same prompt for a whole day, rotating across days.
export const promptOfDay = (ds) => PROMPTS[((dayIndex(ds) % PROMPTS.length) + PROMPTS.length) % PROMPTS.length];

export const moodOf = (id) => MOODS.find((m) => m.id === id) || null;

// Normalise a free-text tag line into a clean, de-duped, capped list.
export function parseTags(str) {
  if (typeof str !== "string") return [];
  const seen = new Set();
  const out = [];
  for (const raw of str.split(/[,\n]/)) {
    const t = raw.trim().replace(/^#/, "").slice(0, 24);
    const key = t.toLowerCase();
    if (t && !seen.has(key)) { seen.add(key); out.push(t); }
    if (out.length >= 8) break;
  }
  return out;
}
