// ── The 5-Year Campaign — the map to freedom ─────────────────────────
// The manual's Parts II & IX, made structural: twenty quarters, each a
// mission and the single gate that must pass before the next counts. The
// doctrine is proof-gated, never calendar-gated ("the five-year clock cares
// about the gate, not the calendar"), so the current position is something
// you set as you clear each gate — the app shows the whole road and marks
// where you stand, surfacing live gate status only where it actually knows it
// (the Year-1 gate is the real scaling gate). Pure data + tiny helpers.

export const YEARS = [
  { year: 1, name: "Prove One",        tagline: "The year that decides everything." },
  { year: 2, name: "Multiply",         tagline: "From a trader with an account to an operator with positions." },
  { year: 3, name: "The Firm",         tagline: "Systemise or stall." },
  { year: 4, name: "Sovereign Capital", tagline: "The great migration — from their capital to yours." },
  { year: 5, name: "Freedom",          tagline: "The threshold, crossed on your date." },
];

// key = `Y{year}Q{q}` — 20 quarters in order.
export const CAMPAIGN = [
  // Year 1 — Prove One
  { key: "Y1Q1", year: 1, q: 1, name: "Fix the Machine", mission: "Repair the physical foundation and install the financial plumbing before asking anything ambitious of yourself.", gate: "Sleep floor held ≥25 of 30 nights · vault transfer automated · trading plan written." },
  { key: "Y1Q2", year: 1, q: 2, name: "The Clean Hundred Begins", mission: "Sane volume begins — build the statistical sample that finally tells you what your edge is in numbers, not feelings.", gate: "50+ trades logged · zero breaches · evaluation progress." },
  { key: "Y1Q3", year: 1, q: 3, name: "Funded & Proving", mission: "Phase 2 falls and the account goes live. The only project now is the withdrawal rhythm, untouched by the new pressure.", gate: "Funded live · first withdrawal taken · sample ≥ 75." },
  { key: "Y1Q4", year: 1, q: 4, name: "The Gate Itself", mission: "Hold the standard three straight months — a withdrawal each month, zero breaches. The ignition key to the entire fleet.", gate: "3 consecutive clean withdrawal months.", liveGate: "scaling" },
  // Year 2 — Multiply
  { key: "Y2Q1", year: 2, q: 1, name: "Challenge #2", mission: "Buy challenge #2 from the fleet fund and pass it on the proven process — nothing new, nothing clever. #1's rhythm stays untouched.", gate: "#2 funded · #1 rhythm unbroken." },
  { key: "Y2Q2", year: 2, q: 2, name: "Two in Parallel", mission: "The real test is operational: the aggregate risk cap, the shared window, the doubled journal. The personal book opens.", gate: "2 clean months dual-running." },
  { key: "Y2Q3", year: 2, q: 3, name: "Challenge #3", mission: "Correlation defence goes live with a second exposure profile. The sous-chef raise lands and routes 100% to the vault.", gate: "Ops checklists running without misses." },
  { key: "Y2Q4", year: 2, q: 4, name: "Consolidate", mission: "No new accounts — prove three can run through a full season (holidays, kitchen peak) without a breach. Annual audit v2.", gate: "Fleet stable · book seeded · vault ≥ ~KSh 1.2M." },
  // Year 3 — The Firm
  { key: "Y3Q1", year: 3, q: 1, name: "Systemise", mission: "Accounts #4–5 and a second prop firm. The ops rhythm becomes fully checklist-driven; memory and mood are retired as management tools.", gate: "Multi-firm ops clean for the quarter." },
  { key: "Y3Q2", year: 3, q: 2, name: "The $5k Range", mission: "Fleet at 4–6 accounts, ~$60–100K funded. Combined sane returns plausibly enter the $5k/mo range — the survivable way.", gate: "A full quarter at the target withdrawal rhythm." },
  { key: "Y3Q3", year: 3, q: 3, name: "The Name Begins", mission: "A public journal, a small community, or mentoring juniors. Reputation is the Stark asset charts can't price.", gate: "One reputation asset live." },
  { key: "Y3Q4", year: 3, q: 4, name: "Plan the Migration", mission: "Ask the firm question formally for the first time: what would this run on sovereign capital alone? Plan Year 4 on paper.", gate: "Vault ≥ ~KSh 3M · migration plan written." },
  // Year 4 — Sovereign Capital
  { key: "Y4Q1", year: 4, q: 1, name: "The Great Migration", mission: "The formula reweights toward sovereignty. The book scales under self-imposed circuit breakers identical to the fleet rules.", gate: "Book running at meaningful size · zero self-rule breaches." },
  { key: "Y4Q2", year: 4, q: 2, name: "Streams Stack", mission: "Salary + fleet + book + vault yield against a life still costing ~KSh 30K. Surplus enters the KSh 150–250K/mo range.", gate: "2 quarters of surplus at target." },
  { key: "Y4Q3", year: 4, q: 3, name: "The Kitchen Decision", mission: "Firm income ≥ 2× the life cost for six straight months → the job becomes formally optional. Decide from strength, never fear.", gate: "The decision made and written." },
  { key: "Y4Q4", year: 4, q: 4, name: "Sovereign Rivals Fleet", mission: "Book + vault rival the fleet's earning power. Prop dependence is now a convenience, not a need.", gate: "Vault ≥ ~KSh 7M · sovereignty ≥ 50% of income." },
  // Year 5 — Freedom
  { key: "Y5Q1", year: 5, q: 1, name: "Final Push", mission: "Vault + book cross toward the KSh 15M line; passive/semi-passive income approaches the KSh 85,100/mo target.", gate: "Income coverage ≥ 100% of the freedom number for a quarter." },
  { key: "Y5Q2", year: 5, q: 2, name: "Hold the Line", mission: "Sustain full coverage. The fleet is held only where it still earns its admin cost.", gate: "A second quarter at full coverage." },
  { key: "Y5Q3", year: 5, q: 3, name: "The Season Ends", mission: "The season ends by your hand, on your named date. The six-day grind clause is formally retired.", gate: "The exit executed in good order." },
  { key: "Y5Q4", year: 5, q: 4, name: "Freedom Audit", mission: "What the five years built, and what the next five are for. Freedom of time and space was never the end — it's the platform.", gate: "The finish line, crossed." },
];

export const QUARTER_KEYS = CAMPAIGN.map((c) => c.key);

export const quarterOf = (key) => CAMPAIGN.find((c) => c.key === key) || null;
export const indexOf = (key) => QUARTER_KEYS.indexOf(key);

export function sanitizeCampaign(raw) {
  const src = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const cur = QUARTER_KEYS.includes(src.currentQuarter) ? src.currentQuarter : "Y1Q1";
  return { currentQuarter: cur };
}

// Progress through the road: quarters strictly before the current one are done.
export function campaignProgress(campaign) {
  const c = sanitizeCampaign(campaign);
  const i = indexOf(c.currentQuarter);
  return { current: c.currentQuarter, index: i, done: i, total: QUARTER_KEYS.length, pct: Math.round((i / QUARTER_KEYS.length) * 100) };
}
