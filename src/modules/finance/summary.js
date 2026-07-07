// Personal-finance rollup from finance_state. The funded trading account is
// deliberately NOT part of any of these totals — trading is its own financial
// environment (see tradingMetrics) and never enters personal net worth.
export function financeSummary(state) {
  const s0 = state && typeof state === "object" ? state : {};
  const {
    opBal = 0, savBal = 0, efBal = 0, personalDebt = 0,
    saccoBal = 0, saccoYield = 0, reitUnits = 0, reitNAV = 0, xRate = 130,
  } = s0;
  // Array fields default to [] even when explicitly stored as null (a corrupt
  // record can carry `mmfs: null`, which a default param would NOT catch).
  const arr = (v) => (Array.isArray(v) ? v.filter((x) => x != null) : []);
  const mmfs = arr(s0.mmfs), tbills = arr(s0.tbills), nseStocks = arr(s0.nseStocks),
    budgets = arr(s0.budgets), income = arr(s0.income);

  const totalMMF = mmfs.reduce((s, m) => s + (+m.balance || 0), 0);
  const totalTbill = tbills.reduce((s, t) => s + (+t.faceValue || 0), 0);
  const totalNSE = nseStocks.reduce((s, st) => s + (+st.shares || 0) * (+st.currentPrice || 0), 0);
  const totalReit = (+reitUnits || 0) * (+reitNAV || 0);
  const totalInvested = totalMMF + totalTbill + totalNSE + (+saccoBal || 0) + totalReit;
  const totalLiquid = (+opBal || 0) + (+savBal || 0) + (+efBal || 0);
  const personalNetWorth = totalLiquid + totalInvested - (+personalDebt || 0);

  const monthlyPassive = Math.round(
    mmfs.reduce((s, m) => s + (+m.balance || 0) * ((+m.yield || 0) / 100 / 12), 0) +
    tbills.reduce((s, t) => s + (+t.faceValue || 0) * ((+t.rate || 0) / 100 / 12), 0) +
    (+saccoBal || 0) * ((+saccoYield || 0) / 100 / 12) +
    totalReit * (0.08 / 12)
  );

  const totalBudgeted = budgets.reduce((s, b) => s + (+b.budget || 0), 0);
  const totalSpent = budgets.reduce((s, b) => s + (+b.spent || 0), 0);

  const ym = new Date().toISOString().slice(0, 7);
  const thisMonthIncome = (income || [])
    .filter((e) => (e.date || "").slice(0, 7) === ym)
    .reduce((s, e) => s + (+e.amount || 0), 0);

  return {
    totalLiquid, totalInvested, personalNetWorth, monthlyPassive,
    totalBudgeted, totalSpent, thisMonthIncome, personalDebt: +personalDebt || 0,
    xRate: +xRate || 130,
  };
}
