// ── Finance coach — a personal narrative, no API key required ────────
// Turns the health score + wealth trajectory + the owner's own money
// principles into a short spoken-to-you read. Affirm-don't-invent: every
// line is backed by a real figure, and it only ever encourages — it names
// what's working, what to watch, where the numbers meet (or drift from) the
// stated principles, and one small next step. Mirrors directive.js's tone.
import { activePrinciples } from "./doctrine.js";
import { budgetDrift } from "./budgetValues.js";

const has = (text, ...words) => { const t = (text || "").toLowerCase(); return words.some((w) => t.includes(w)); };

export function financeNarrative(health, trajStats, doctrine, freedom, fmtKES = (n) => `${Math.round(+n || 0)}`, budgets = []) {
  const wins = [], watch = [], creed = [];
  const h = health || {};
  const t = trajStats || {};
  const trending = t.netWorthMoM != null ? (t.netWorthMoM > 0 ? "up" : t.netWorthMoM < 0 ? "down" : "flat") : null;

  // ── Verdict — band + direction, honestly. ──
  const band = h.band || "Building";
  const verdict = trending === "up" ? `${band} — and the trajectory is rising.`
    : trending === "down" ? `${band} — one soft month; the trend is what matters.`
    : `${band}. Consistency is what moves this.`;

  // ── What's working ──
  if (t.netWorthMoM > 0) wins.push(`Net worth rose ${fmtKES(t.netWorthMoM)} last month.`);
  if (t.savingsDelta > 0) wins.push(`Savings rate climbed ${Math.round(t.savingsDelta)} point${Math.round(t.savingsDelta) === 1 ? "" : "s"}, to ${Math.round(h.savingsRate || 0)}%.`);
  if (t.passiveDelta > 0 && freedom) wins.push(`Passive income grew ${fmtKES(t.passiveDelta)}/mo — now ${freedom.freedomPct}% of your freedom number.`);
  if (t.velocity != null && t.velocity < 0) wins.push(`The freedom line moved ${Math.abs(t.velocity)}y closer this month. Keep the pace.`);
  if ((h.emergencyMonths || 0) >= 3 && !wins.length) wins.push(`Your emergency buffer holds ${(h.emergencyMonths || 0).toFixed(1)} months — you can weather a storm.`);
  if ((h.savingsRate || 0) >= 20 && wins.length < 3) wins.push(`A ${Math.round(h.savingsRate)}% savings rate is elite territory — protect it.`);

  // ── What to watch (encourage, never scold) ──
  if ((h.savingsRate || 0) < 10) watch.push(`Savings rate is ${Math.round(h.savingsRate || 0)}% — even five more points compounds fast.`);
  if ((h.emergencyMonths || 0) < 3) watch.push(`Emergency buffer is ${(h.emergencyMonths || 0).toFixed(1)} months — building toward 3 is the next shield.`);
  if ((h.personalDebt || 0) > 0) watch.push(`Debt of ${fmtKES(h.personalDebt)} still costs you — every payment buys freedom back.`);
  if (trending === "down") watch.push(`Net worth dipped last month. One month isn't a trend — watch the next one.`);
  if ((h.netCashFlow || 0) < 0) watch.push(`Spending outran income this month. Trim one category and it flips positive.`);

  // ── Where spending drifts from the value it's meant to serve ──
  const drift = budgetDrift(budgets);
  if (drift.length) {
    const d = drift[0];
    watch.push(`${d.cat} ran ${fmtKES(d.over)} over — is that still serving ${d.value}? Realign it with what ${d.value} really needs.`);
  }

  // ── Where the numbers meet the principles ──
  for (const p of activePrinciples(doctrine).slice(0, 8)) {
    if (creed.length >= 2) break;
    if (has(p.text, "future self", "save", "saving", "pay myself")) {
      if ((h.savingsRate || 0) >= 15) creed.push({ ok: true, text: `You're living it: "${p.text}"` });
      else creed.push({ ok: false, text: `Your principle "${p.text}" is asking for a higher savings rate.` });
    } else if (has(p.text, "debt", "chain")) {
      if ((h.personalDebt || 0) === 0) creed.push({ ok: true, text: `Debt-free — "${p.text}" is lived, not just written.` });
      else creed.push({ ok: false, text: `"${p.text}" — the debt is still on the board.` });
    } else if (has(p.text, "invest", "compound", "harvest")) {
      if ((h.totalInvested || 0) > 0) creed.push({ ok: true, text: `Capital at work — "${p.text}"` });
    }
  }

  // ── One small step — the highest-leverage watch item, made concrete. ──
  let step = "Keep the balances current — the trajectory tells the truth over time.";
  if ((h.netCashFlow || 0) < 0) step = "Pick one category to trim this week — get cash flow back above zero.";
  else if ((h.emergencyMonths || 0) < 1) step = "Move even a small amount to the emergency fund this week — start the shield.";
  else if ((h.savingsRate || 0) < 10) step = "Automate one more transfer to savings on payday — make the rate rise by itself.";
  else if ((h.personalDebt || 0) > 0) step = "Send one extra payment at the smallest debt — momentum beats math.";
  else if (freedom && freedom.freedomPct < 100) step = "Add to the investment engines — passive income is what ends the trade.";

  return { verdict, band, trending, wins, watch, creed, step, hasData: (t.monthsTracked || 0) >= 1 };
}
