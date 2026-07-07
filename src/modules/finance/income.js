// Dynamic income analytics — adapts to changing cash flow, never assumes a
// fixed monthly income.
export const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
export const monthKey = (dateStr) => (dateStr || "").slice(0, 7);

export function monthLabel(key) {
  if (!key) return "—";
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", { month: "short", year: "numeric" });
}

function lastNMonths(n) {
  const arr = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push({ key: ym(d), label: d.toLocaleString("en-US", { month: "short" }) });
  }
  return arr;
}

export function incomeAnalytics(entries, trendMonths = 8) {
  const list = (Array.isArray(entries) ? entries : []).filter((e) => e && typeof e === "object");
  const byMonth = {};
  list.forEach((e) => {
    const k = monthKey(e.date);
    if (!k) return;
    byMonth[k] = (byMonth[k] || 0) + (+e.amount || 0);
  });
  const monthsSorted = Object.keys(byMonth).sort();

  const nowKey = ym(new Date());
  const prev = new Date();
  prev.setDate(1);
  prev.setMonth(prev.getMonth() - 1);
  const prevKey = ym(prev);

  const thisMonth = byMonth[nowKey] || 0;
  const lastMonth = byMonth[prevKey] || 0;
  const momGrowth = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : thisMonth > 0 ? 100 : 0;

  const totalAll = monthsSorted.reduce((s, k) => s + byMonth[k], 0);
  const avgMonthly = monthsSorted.length ? totalAll / monthsSorted.length : 0;

  let highest = null;
  let lowest = null;
  monthsSorted.forEach((k) => {
    if (!highest || byMonth[k] > highest.total) highest = { month: k, total: byMonth[k] };
    if (!lowest || byMonth[k] < lowest.total) lowest = { month: k, total: byMonth[k] };
  });

  const srcMap = {};
  list.forEach((e) => {
    const s = e.source || "Other";
    srcMap[s] = (srcMap[s] || 0) + (+e.amount || 0);
  });
  const bySource = Object.entries(srcMap)
    .map(([source, total]) => ({ source, total, pct: totalAll > 0 ? (total / totalAll) * 100 : 0 }))
    .sort((a, b) => b.total - a.total);

  const recurringTotal = list.filter((e) => e.recurring).reduce((s, e) => s + (+e.amount || 0), 0);

  const trend = lastNMonths(trendMonths).map((m) => ({ label: m.label, key: m.key, total: byMonth[m.key] || 0 }));

  return {
    byMonth, monthsSorted, thisMonth, lastMonth, momGrowth,
    avgMonthly, activeMonths: monthsSorted.length, totalAll,
    highest, lowest, bySource, recurringTotal, trend,
    diversification: bySource.length,
  };
}
