// ── Global search — one box across every module's local data ─────────
// Reads the raw `architect:` localStorage records directly (no heavy module
// imports, corruption-tolerant) and turns them into rankable results that
// jump to the right module. Purely local — nothing leaves the device.

// Static destinations — jumping around the app itself.
export const PAGES = [
  { id: "page:dashboard", type: "Page", title: "Command Center", nav: "dashboard", icon: "◎" },
  { id: "page:life", type: "Page", title: "Life OS", subtitle: "Habits · Nutrition · Journal · Today", nav: "life", icon: "◍" },
  { id: "page:firm", type: "Page", title: "The Firm", subtitle: "Trading · Wealth · HQ", nav: "firm", icon: "▲" },
  { id: "page:faith", type: "Page", title: "Faith & Mind", subtitle: "Scripture · Reading · Decisions", nav: "faith", icon: "✦" },
  { id: "page:calendar", type: "Page", title: "Calendar", nav: "calendar", icon: "▦" },
  { id: "page:journey", type: "Page", title: "Journey", subtitle: "Hall of Fame · Want List · Goals", nav: "journey", icon: "◆" },
  { id: "page:analytics", type: "Page", title: "Analytics", nav: "analytics", icon: "◔" },
  { id: "page:settings", type: "Page", title: "Settings", nav: "settings", icon: "⚙" },
  { id: "page:whoiam", type: "Page", title: "Who I Am", subtitle: "Your five-year identity", nav: "__whoiam__", icon: "❖" },
];

// Data sources: which store, how to label it, where it lives, and the fields
// worth reading. Extraction is defensive — any field may be missing.
export const SOURCES = [
  { key: "journal_entries", type: "Journal", icon: "✎", nav: "life", fields: ["text"], date: "date" },
  { key: "habits", type: "Habit", icon: "◍", nav: "life", fields: ["name"] },
  { key: "life_projects", type: "Project", icon: "◒", nav: "life", fields: ["name", "next"] },
  { key: "nutrition_foods", type: "Food", icon: "🍽", nav: "life", fields: ["name"] },
  { key: "wants", type: "Want", icon: "✦", nav: "journey", fields: ["name", "note"] },
  { key: "goals", type: "Goal", icon: "◆", nav: "journey", fields: ["title", "name", "text"] },
  { key: "ict_trades", type: "Trade", icon: "▲", nav: "firm", fields: ["pair", "notes", "note", "setup", "lesson"], date: "date" },
  { key: "ti_trades", type: "Trade", icon: "▲", nav: "firm", fields: ["pair", "notes", "note", "setup", "lesson"], date: "date" },
  { key: "ti_lessons", type: "Lesson", icon: "◈", nav: "firm", fields: ["title", "note", "text"] },
  { key: "faith_scripture", type: "Scripture", icon: "✝", nav: "faith", fields: ["ref", "text"] },
  { key: "faith_notes", type: "Faith note", icon: "✝", nav: "faith", fields: ["ref", "text"], date: "date" },
  { key: "mind_notes", type: "Note", icon: "✎", nav: "faith", fields: ["text", "title"], date: "date" },
  { key: "mind_decisions", type: "Decision", icon: "⚖", nav: "faith", fields: ["decision", "expected", "lesson"], date: "date" },
  { key: "mind_library", type: "Reading", icon: "📖", nav: "faith", fields: ["title", "author"] },
];

const PREFIX = "architect:";
// Default reader: parse a raw localStorage record. Overridable for tests.
export function readKeyLocal(key) {
  try { return JSON.parse(localStorage.getItem(PREFIX + key)); } catch { return null; }
}

const str = (v) => (typeof v === "string" ? v : "");
const firstField = (item, fields) => { for (const f of fields) if (str(item?.[f]).trim()) return item[f]; return ""; };

// Score a candidate against the query. Higher is better; 0 = no match.
function score(hay, q) {
  const h = hay.toLowerCase();
  const i = h.indexOf(q);
  if (i < 0) return 0;
  if (h === q) return 100;
  if (i === 0) return 70;                                   // prefix
  if (/\s|[-_/·,.]/.test(h[i - 1] || " ")) return 55;       // word boundary
  return 30;                                                // substring
}

// Run the search. `readKey(key)` returns the parsed store (defaults to
// localStorage). Returns ranked results, capped.
export function searchAll(query, { readKey = readKeyLocal, limit = 40 } = {}) {
  const q = (query || "").trim().toLowerCase();
  if (q.length < 1) return [];
  const out = [];

  for (const p of PAGES) {
    const s = Math.max(score(p.title, q), p.subtitle ? score(p.subtitle, q) - 20 : 0);
    if (s > 0) out.push({ ...p, score: s + 5 }); // pages rank a touch higher — they're exact destinations
  }

  for (const src of SOURCES) {
    const raw = readKey(src.key);
    const list = Array.isArray(raw) ? raw : [];
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      let best = 0;
      let title = "";
      for (const f of src.fields) {
        const val = str(item[f]);
        if (!val) continue;
        const sc = score(val, q);
        if (sc > best) { best = sc; if (!title) title = val; }
      }
      if (best <= 0) continue;
      const label = str(firstField(item, src.fields)) || "(untitled)";
      const date = src.date ? str(item[src.date]).slice(0, 10) : "";
      out.push({
        id: `${src.key}:${item.id || label.slice(0, 12)}`,
        type: src.type, icon: src.icon, nav: src.nav,
        title: label.length > 90 ? label.slice(0, 90) + "…" : label,
        subtitle: [src.type, date].filter(Boolean).join(" · "),
        score: best,
      });
    }
  }

  // Who I Am passage — search the vision text itself.
  const who = readKey("who_i_am");
  const whoText = who && typeof who === "object" ? str(who.text) : "";
  if (whoText && score(whoText, q) > 0) {
    out.push({ id: "who_i_am:passage", type: "Who I Am", icon: "❖", nav: "__whoiam__", title: "Your five-year vision", subtitle: "Who I Am", score: 40 });
  }

  return out.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, limit);
}
