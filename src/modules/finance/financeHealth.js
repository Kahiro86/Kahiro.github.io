// Financial health scoring — turns the live finance + income + trading data
// into a 0–100 health score with sub-scores, so the AI analyst and reports
// can reason about it. Every metric adapts to whatever the user has logged.
const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

export function financeHealth({ incomeStats, totalBudgeted, totalSpent, efBal, savBal, totalInvested, personalDebt, tradingStats }) {
  const monthlyIncome = incomeStats.thisMonth || incomeStats.avgMonthly || 0;
  const monthlyExpenses = +totalSpent || 0;
  const netCashFlow = monthlyIncome - monthlyExpenses;
  const savingsRate = monthlyIncome > 0 ? (netCashFlow / monthlyIncome) * 100 : 0;
  const emergencyMonths = monthlyExpenses > 0 ? (+efBal || 0) / monthlyExpenses : (+efBal || 0) > 0 ? 6 : 0;
  const diversification = incomeStats.diversification || 0;

  // Sub-scores (0–100)
  const sub = {
    savings: clamp((savingsRate / 20) * 100), // 20%+ savings rate = full marks
    cashFlow: netCashFlow >= 0 ? 100 : clamp(100 + (netCashFlow / Math.max(monthlyIncome, 1)) * 100),
    emergency: clamp((emergencyMonths / 6) * 100), // 6 months = full
    diversification: diversification >= 4 ? 100 : diversification === 3 ? 75 : diversification === 2 ? 55 : diversification === 1 ? 30 : 0,
    budget: totalBudgeted > 0 ? clamp(100 - Math.max(0, (totalSpent - totalBudgeted) / totalBudgeted) * 100) : (totalSpent === 0 ? 60 : 50),
    debt: (+personalDebt || 0) === 0 ? 100 : clamp(100 - ((+personalDebt || 0) / Math.max(monthlyIncome, 1)) * 25),
    investing: clamp(((+totalInvested || 0) / Math.max(monthlyIncome * 6, 1)) * 100), // 6 months income invested = full
  };

  const weights = { savings: 0.22, cashFlow: 0.2, emergency: 0.18, diversification: 0.12, budget: 0.12, debt: 0.09, investing: 0.07 };
  const overall = Math.round(Object.keys(weights).reduce((s, k) => s + sub[k] * weights[k], 0));

  const band = overall >= 80 ? "Excellent" : overall >= 65 ? "Strong" : overall >= 50 ? "Building" : overall >= 35 ? "Fragile" : "At Risk";

  return {
    overall, band, sub,
    monthlyIncome, monthlyExpenses, netCashFlow, savingsRate,
    emergencyMonths, diversification,
    tradingPnl: tradingStats?.totalPnl || 0, tradingWr: tradingStats?.wr || 0,
    totalInvested: +totalInvested || 0, personalDebt: +personalDebt || 0,
  };
}

export const SUBSCORE_META = [
  { key: "savings", label: "Savings Rate" },
  { key: "cashFlow", label: "Cash Flow" },
  { key: "emergency", label: "Emergency Buffer" },
  { key: "diversification", label: "Income Diversity" },
  { key: "budget", label: "Budget Adherence" },
  { key: "debt", label: "Debt Health" },
  { key: "investing", label: "Investing" },
];
