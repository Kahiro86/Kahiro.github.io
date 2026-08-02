// ── Overhead & runway — what the machine costs to run ────────────────
// A flat list of recurring costs (bills + subscriptions), each normalised to a
// monthly figure, plus runway = liquid savings ÷ monthly burn. Pure and
// corruption-tolerant; its own store, independent of finance_state.
export const OVERHEAD_KEY = "overhead";
export const CADENCES = [
  { id: "mo", label: "/mo", per: 1 },
  { id: "yr", label: "/yr", per: 12 },
  { id: "wk", label: "/wk", per: 1 / (52 / 12) },
];
export const KINDS = [
  { id: "bill", label: "Bill" },
  { id: "sub", label: "Subscription" },
];

const uid = () => `o${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
const n = (v) => { const x = +v; return Number.isFinite(x) && x >= 0 ? x : 0; };
const perOf = (id) => (CADENCES.find((c) => c.id === id) || CADENCES[0]).per;

export function sanitizeOverhead(raw) {
  const items = Array.isArray(raw?.items) ? raw.items : [];
  const clean = items
    .filter((it) => it && typeof it === "object" && n(it.amount) > 0)
    .map((it) => ({
      id: typeof it.id === "string" ? it.id : uid(),
      name: typeof it.name === "string" ? it.name.trim().slice(0, 60) : "",
      amount: n(it.amount),
      cadence: CADENCES.some((c) => c.id === it.cadence) ? it.cadence : "mo",
      kind: KINDS.some((k) => k.id === it.kind) ? it.kind : "bill",
    }));
  return { items: clean, savings: n(raw?.savings) };
}

// A single item's normalised monthly cost.
export const monthlyOf = (it) => n(it.amount) / perOf(it.cadence);

export const monthlyTotal = (data) => sanitizeOverhead(data).items.reduce((a, it) => a + monthlyOf(it), 0);
export const yearlyTotal = (data) => monthlyTotal(data) * 12;

export function kindTotals(data) {
  const t = { bill: 0, sub: 0 };
  for (const it of sanitizeOverhead(data).items) t[it.kind] += monthlyOf(it);
  return t;
}

// Months of runway your savings buy at the current burn (null when burn is 0).
export function runwayMonths(data) {
  const clean = sanitizeOverhead(data);
  const burn = monthlyTotal(clean);
  if (burn <= 0) return null;
  return clean.savings / burn;
}

export function addItem(data, item) {
  const c = sanitizeOverhead(data);
  const amount = n(item.amount);
  if (amount <= 0) return c;
  return { ...c, items: [{ id: uid(), name: (item.name || "").trim().slice(0, 60), amount, cadence: CADENCES.some((x) => x.id === item.cadence) ? item.cadence : "mo", kind: KINDS.some((x) => x.id === item.kind) ? item.kind : "bill" }, ...c.items] };
}

export function removeItem(data, id) {
  const c = sanitizeOverhead(data);
  return { ...c, items: c.items.filter((it) => it.id !== id) };
}
