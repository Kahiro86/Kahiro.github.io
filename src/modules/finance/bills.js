// ── Bills: recurring monthly obligations ────────────────────────────
// A bill is due on `dueDay` of every month; paying it stamps the month
// (lastPaidMonth = "YYYY-MM"), so "due soon" means: unpaid this cycle and
// the due date is within the next 7 days (wrapping into next month).
import { localDateStr } from "../../shared/dates.js";

export const newBill = (patch = {}) => ({
  id: `bill${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`,
  name: "",
  amount: 0,
  dueDay: 1,          // 1–31, clamped to the month's length
  lastPaidMonth: "",  // "YYYY-MM" of the last cycle marked paid
  // Every payment, dated. lastPaidMonth answers "is this cycle settled?" and
  // is kept for that; it cannot answer "when did I pay, and how many times
  // have I" — a bill paid every month for a year left exactly one scalar
  // behind, so eleven of those payments were invisible to everything.
  payments: [],       // [{ date: "YYYY-MM-DD", amount }]
  ...patch,
});

/** Records a payment on `date`, and settles the cycle it falls in. */
export function payBill(bill, date = localDateStr(), amount = null) {
  const log = Array.isArray(bill.payments) ? bill.payments : [];
  const already = log.some((p) => p && String(p.date).slice(0, 10) === date);
  return {
    ...bill,
    lastPaidMonth: date.slice(0, 7),
    payments: already ? log : [...log, { date, amount: Number.isFinite(+amount) ? +amount : (+bill.amount || 0) }],
  };
}

/** Undoes the settlement for `date`'s cycle, and drops that cycle's payments. */
export function unpayBill(bill, date = localDateStr()) {
  const ym = date.slice(0, 7);
  const log = Array.isArray(bill.payments) ? bill.payments : [];
  return { ...bill, lastPaidMonth: "", payments: log.filter((p) => p && String(p.date).slice(0, 7) !== ym) };
}

export const sanitizeBills = (raw) =>
  (Array.isArray(raw) ? raw : []).filter((b) => b && typeof b === "object" && b.id);

const clampDay = (year, month1, day) => Math.min(day, new Date(year, month1, 0).getDate());

// Days from `today` to the bill's next due date (0 = today).
export function daysUntilDue(bill, today = localDateStr()) {
  const [y, m, d] = today.split("-").map(Number);
  const due = clampDay(y, m, +bill.dueDay || 1);
  if (due >= d) return due - d;
  const ny = m === 12 ? y + 1 : y, nm = m === 12 ? 1 : m + 1;
  return clampDay(ny, nm, +bill.dueDay || 1) + new Date(y, m, 0).getDate() - d;
}

export const isPaidThisCycle = (bill, today = localDateStr()) =>
  bill.lastPaidMonth === today.slice(0, 7);

export const billsDueSoon = (bills, today = localDateStr(), horizon = 7) =>
  sanitizeBills(bills).filter((b) => !isPaidThisCycle(b, today) && daysUntilDue(b, today) <= horizon);

export const monthlyBillsTotal = (bills) =>
  sanitizeBills(bills).reduce((s, b) => s + (+b.amount || 0), 0);
