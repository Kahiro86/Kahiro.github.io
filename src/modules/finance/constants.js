import { CY, GR, PU, AM, OR, RE, T2 } from "../../shared/designTokens.js";

export const DEFAULT_FINANCE_STATE = {
  currency: "KES",
  xRate: 130,
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
};

export const TBILL_TYPES = ["91-Day T-Bill", "182-Day T-Bill", "364-Day T-Bill", "2-Year Bond", "5-Year Bond", "10-Year Bond", "15-Year Bond", "20-Year Bond"];
