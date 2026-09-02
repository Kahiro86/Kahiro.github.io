// ── One-shot seed from the Notion workspace ──────────────────────────
// Constants, not an integration. The workspace held almost nothing worth
// importing: a 161-property Trade Journal with a single completely empty
// row, three empty review templates, and — in a *legacy* database — one
// real trade. Two accounts are real. That is the whole of it, so an API
// client, a token and a sync path would all be machinery around four
// values that fit in this file.
//
// Guarded by `pnp_seeded` so it runs once. Existing records are never
// overwritten: an account of the same name, or a trade already carrying
// the seeded id, is left exactly as it is.
import { seedPhases } from "./phases.js";

export const SEED_FLAG = "pnp_seeded";

/**
 * The two real accounts. Written in the shape ti_accounts already uses,
 * so they show up in Trading OS's Accounts tab as well.
 */
export const SEED_ACCOUNTS = [
  {
    id: "acc_fxreplay", name: "FX REPLAY", type: "Backtest",
    startBalance: 25000, goalBalance: 28250, status: "active", riskPct: 0.5,
  },
  {
    id: "acc_fundednext15k", name: "FundedNext 2-step 15K", type: "Funded",
    startBalance: 15149, goalBalance: 16950, status: "active", riskPct: 0.5,
  },
];

/**
 * The one real trade in the workspace — EUR/USD short, closed by stop.
 *
 * Its `Realized RR` was stored in Notion as the *text* "-1", so it is
 * written here as a number. The rest is transcribed as logged: no MFE,
 * no MAE, no wick-out forensics, because none was ever recorded. Leaving
 * those blank is the point — a seeded value nobody measured would be
 * invented data, and every chart that reads them would rather stay dark.
 */
export const SEED_TRADE = {
  id: "notion_live_1",
  accountId: "acc_fxreplay",
  date: "2026-08-27",
  time: "16:30",
  instrument: "EUR/USD",
  direction: "Sell",
  pipSize: 0.0001,
  valuePerPipPerLot: 10,
  status: "CLOSED",
  sessions: ["New York"],
  conditions: ["Down-Trend"],
  confluences: [
    "Liquidity Swept", "Fair value gap",
    "Bearish Price action", "Price structure shift",
  ],
  strategy: "PRESS N PLAY",
  marketModel: "Continuation",
  entryTf: "5m",
  riskPct: 0.5,
  commission: 9.9,
  lessons: "A loss would be a lesson\nA win will fuel my wrong habits",
  // Gross −75.24 on a 0.5% risk of a 25,000 account (≈125), i.e. about
  // −0.6R before commission. Entry/stop/exit are reconstructed to that
  // ratio because Notion recorded the P&L but not the prices.
  entry: 1.16,
  stop: 1.161,
  exit: 1.16085,
  lots: 0.75,
  createdAt: "2026-08-27T13:30:00.000Z",
};

/**
 * Seeds phases, accounts and the one trade. Returns what it wrote so the
 * caller can say so rather than seeding silently.
 */
export function buildSeed({ accounts = [], trades = [] } = {}) {
  const haveAccount = new Set(accounts.map((a) => String(a.name || "").toLowerCase()));
  const haveTrade = new Set(trades.map((t) => t.id));
  const newAccounts = SEED_ACCOUNTS.filter((a) => !haveAccount.has(a.name.toLowerCase()));
  const newTrades = haveTrade.has(SEED_TRADE.id) ? [] : [SEED_TRADE];
  return { phases: seedPhases(), accounts: newAccounts, trades: newTrades };
}
