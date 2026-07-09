import { CY, GR, PU, AM, OR, RE, T2 } from "../../shared/designTokens.js";

export const DEFAULT_FINANCE_STATE = {
  currency: "KES",
  xRate: 130,
  income: [],
  gross: "",
  opBal: 0,
  savBal: 0,
  efBal: 0,
  efMMF: "CIC MMF",
  personalDebt: 10000,
  mmfs: [
    { id: "cic",    name: "CIC MMF",    balance: 0, yield: 14.5 },
    { id: "sanlam", name: "Sanlam MMF", balance: 0, yield: 13.8 },
    { id: "britam", name: "Britam MMF", balance: 0, yield: 14.2 },
    { id: "cytonn", name: "Cytonn MMF", balance: 0, yield: 15.1 },
    { id: "ncba",   name: "NCBA MMF",   balance: 0, yield: 13.5 },
  ],
  tbills: [],
  nseStocks: [],
  saccoBal: 0,
  saccoYield: 12,
  reitUnits: 0,
  reitNAV: 7.5,
  budgets: [
    { id: "housing",   cat: "Housing",       budget: 0, spent: 0, color: CY },
    { id: "food",      cat: "Food",          budget: 0, spent: 0, color: GR },
    { id: "transport", cat: "Transport",     budget: 0, spent: 0, color: PU },
    { id: "comms",     cat: "Communication", budget: 0, spent: 0, color: AM },
    { id: "health",    cat: "Health",        budget: 0, spent: 0, color: OR },
    { id: "savings",   cat: "Savings",       budget: 0, spent: 0, color: GR },
    { id: "invest",    cat: "Investments",   budget: 0, spent: 0, color: CY },
    { id: "leisure",   cat: "Leisure",       budget: 0, spent: 0, color: RE },
    { id: "misc",      cat: "Miscellaneous", budget: 0, spent: 0, color: T2 },
  ],
  // Trading account lives inside Finance but is firewalled from personal wealth.
  tradingWithdrawals: 0,
  profitSplit: 80,
  // Interactive debts. remaining = original − Σ payments. Falls back to the
  // legacy single `personalDebt` number when this list is empty.
  debts: [],
  // Recurring monthly bills: { id, name, amount, dueDay, lastPaidMonth }.
  bills: [],
  // Editable financial goals (persisted). history: [{ date, amount }] contribution log.
  goals: [
    { id: "g_ef",   name: "Emergency Fund (6 months)", icon: "🛡️", target: 300000, current: 0, monthly: 5000,  deadline: "", color: GR, archived: false, createdAt: "", history: [] },
    { id: "g_port", name: "Investment Portfolio",      icon: "📈", target: 500000, current: 0, monthly: 10000, deadline: "", color: CY, archived: false, createdAt: "", history: [] },
    { id: "g_nw",   name: "Net Worth KES 5M",          icon: "💰", target: 5000000, current: 0, monthly: 20000, deadline: "", color: PU, archived: false, createdAt: "", history: [] },
  ],
};

export const TBILL_TYPES = ["91-Day T-Bill", "182-Day T-Bill", "364-Day T-Bill", "2-Year Bond", "5-Year Bond", "10-Year Bond", "15-Year Bond", "20-Year Bond"];

// ── Dynamic income tracking ─────────────────────────────────────────
// Income is never assumed fixed — users log unlimited entries from any source.
export const INCOME_SOURCES = [
  "Salary", "Trading Profits", "Investment Returns", "Freelance",
  "Business", "Side Hustle", "Gift / Bonus", "Other",
];

export const INCOME_CATEGORIES = ["Active", "Passive", "Business", "Investment", "Windfall", "Other"];

// Stable-ish palette so a source keeps a colour across the app.
export const INCOME_PALETTE = [CY, GR, PU, AM, OR, RE, "#2DD4BF", "#F472B6", "#A78BFA", "#38BDF8"];
export function sourceColor(source) {
  let h = 0;
  for (let i = 0; i < (source || "").length; i++) h = (h * 31 + source.charCodeAt(i)) >>> 0;
  return INCOME_PALETTE[h % INCOME_PALETTE.length];
}
