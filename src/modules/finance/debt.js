// Debt helpers — pure, so the tab and the net-worth calc share one source.
export const debtId = () => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 4)}`;

export const paidOf = (d) => (d.payments || []).reduce((s, p) => s + (+p.amount || 0), 0);
export const remainingOf = (d) => Math.max(0, (+d.original || 0) - paidOf(d));
export const progressOf = (d) => (+d.original > 0 ? Math.min(100, Math.round((paidOf(d) / +d.original) * 100)) : 0);

export const totalDebtRemaining = (debts, fallback = 0) =>
  debts && debts.length ? debts.reduce((s, d) => s + remainingOf(d), 0) : (+fallback || 0);

// Interest-aware payoff estimate. Returns months to clear at the current
// minimum payment, or null if the payment never beats the monthly interest.
export function payoffMonths(d) {
  let bal = remainingOf(d);
  if (bal <= 0) return 0;
  const min = +d.minPayment || 0;
  const monthlyRate = (+d.apr || 0) / 1200;
  if (min <= bal * monthlyRate) return null; // interest ≥ payment → never clears
  let m = 0;
  while (bal > 0 && m < 600) {
    bal += bal * monthlyRate;
    bal -= min;
    m++;
  }
  return m;
}

// Days until the next occurrence of `dueDay` (1–31) from today.
export function daysUntilDue(dueDay) {
  if (!dueDay) return null;
  const now = new Date();
  let due = new Date(now.getFullYear(), now.getMonth(), dueDay);
  if (due < new Date(now.getFullYear(), now.getMonth(), now.getDate())) due = new Date(now.getFullYear(), now.getMonth() + 1, dueDay);
  return Math.round((due - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000);
}
