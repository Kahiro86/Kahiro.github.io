// ── The Firm Audit ───────────────────────────────────────────────────
// Law 9 says audit like a firm — so this audits the books themselves, the
// app's own numbers included. It reads the live finance + firm data and
// reports genuine inconsistencies: a configured salary that never reached the
// ledger, a freedom target and a vault line that disagree on the withdrawal
// rate, an emergency fund sized against a burn the Covenant doesn't admit, and
// so on. Numbers before feelings. Pure and derive-only.
import { freedomMath } from "../../shared/freedom.js";
import { financeSummary } from "../finance/summary.js";
import { sanitizeFirmConfig } from "../../shared/firm.js";
import { totalDebtRemaining } from "../finance/debt.js";
import { localDateStr, daysAgoStr } from "../../shared/dates.js";

const arr = (x) => (Array.isArray(x) ? x.filter(Boolean) : []);
const kes = (n) => `KES ${Math.round(+n || 0).toLocaleString()}`;

// How much each open finding costs the integrity score.
const WEIGHT = { blocking: 25, doctrine: 12, pace: 8, tension: 6, design: 0 };

export function runAudit({ finance, config } = {}) {
  const fin = financeSummary(finance);
  const cfg = sanitizeFirmConfig(config);
  const freedom = freedomMath(finance, config);
  const findings = [];

  // 1 — Income actually logged?
  const income = arr(finance?.income);
  const recent = income.filter((e) => (e.date || "") >= daysAgoStr(35));
  if (!income.length) {
    findings.push({ id: "income", sev: "blocking", tag: "Ledger", title: "Income never logged",
      detail: "The Income Ledger is empty, so every report reads $0 income and the health score is computed against a phantom — even with a salary configured in the calculator.",
      fix: "One tap: log take-home in Wealth → Income (the calculator now writes it)." });
  } else if (!recent.length) {
    const last = income.map((e) => e.date).filter(Boolean).sort().pop();
    findings.push({ id: "income", sev: "blocking", tag: "Ledger", title: "Income not logged this month",
      detail: `The last Income Ledger entry is dated ${last}. Every report since reads $0 income and a negative net cash flow.`,
      fix: "Log this month's income in Wealth → Income." });
  }

  // 2 — Freedom target vs the vault line (one withdrawal rate, or two?)
  if (freedom.impliedWithdrawalRate != null && freedom.capitalRequired) {
    const wr = freedom.impliedWithdrawalRate * 100;
    if (wr < 4 || wr > 12) {
      findings.push({ id: "freedom", sev: "blocking", tag: "Mission", title: "Freedom target and vault line disagree",
        detail: `The vault line (${kes(freedom.target)}) implies a ${wr.toFixed(1)}% withdrawal against the ${kes(freedom.freedomNumber)}/mo target; at the blended ${(freedom.annualYield * 100).toFixed(1)}% yield the same income needs ${kes(freedom.capitalRequired)}. Same metric, two lines.`,
        fix: "Pick one source of truth — the Freedom Math card reconciles them." });
    }
  }

  // 3 — Emergency fund vs Law 8 (the frozen life)
  const efTarget6 = Math.max((fin.totalBudgeted || 0) * 6, 300000);
  const impliedBurn = Math.round(efTarget6 / 6);
  if (cfg.lifeCostKsh > 0 && Math.abs(impliedBurn - cfg.lifeCostKsh) / cfg.lifeCostKsh > 0.2) {
    findings.push({ id: "ef_law8", sev: "doctrine", tag: "Doctrine", title: "Emergency fund contradicts Law 8",
      detail: `The 6-month EF target of ${kes(efTarget6)} implies a ${kes(impliedBurn)}/mo burn, but Law 8 fixes the life at ${kes(cfg.lifeCostKsh)}. At ${kes(cfg.lifeCostKsh)} the targets should be ${kes(cfg.lifeCostKsh * 3)} and ${kes(cfg.lifeCostKsh * 6)}.`,
      fix: "Either raise the burn figure or lower the targets — say which is true." });
  }

  // 4 — EF funding pace
  const efBal = +finance?.efBal || 0;
  const efContrib = 5000; // ~5% of a typical net; flat guidance figure
  const efMonths = Math.ceil(Math.max(0, efTarget6 - efBal) / efContrib);
  if (efMonths > 60) {
    findings.push({ id: "ef_pace", sev: "pace", tag: "Pace", title: `EF funding runs ${efMonths} months`,
      detail: `At ~${kes(efContrib)}/mo against a ${kes(efTarget6)} target, full insurance is ${(efMonths / 12).toFixed(1)} years out — long for the thing meant to catch a job loss.` });
  }

  // 5 — Debt rate vs MMF yield
  const debts = arr(finance?.debts);
  const debtApr = debts.length ? Math.max(...debts.map((d) => +d.apr || 0)) : 0;
  const debtRemaining = totalDebtRemaining(debts, finance?.personalDebt);
  const mmfs = arr(finance?.mmfs);
  const wBal = mmfs.reduce((s, m) => s + (+m.balance || 0), 0);
  const mmfYield = wBal > 0
    ? mmfs.reduce((s, m) => s + (+m.balance || 0) * (+m.yield || 0), 0) / wBal
    : (mmfs.length ? mmfs.reduce((s, m) => s + (+m.yield || 0), 0) / mmfs.length : 0);
  if (debtApr > 0 && debtRemaining > 0 && mmfYield > debtApr) {
    findings.push({ id: "debt_yield", sev: "tension", tag: "Tension", title: "Debt rate vs MMF yield",
      detail: `Debt is ${debtApr.toFixed(1)}% APR; the MMF blend pays ${mmfYield.toFixed(1)}% p.a. Arithmetic favours paying the minimum and routing surplus to the vault — but Law 6 says break the chain faster than it grows. Both readings are defensible; the app shouldn't quietly pick one.`,
      fix: "Record the decision in the Covenant, either way." });
  }

  // 6 — Net worth negative while capital sits funded (by design, no action)
  if (fin.personalNetWorth < 0 && (freedom.capital > 0 || fin.totalInvested > 0)) {
    findings.push({ id: "nw_design", sev: "design", tag: "By design", title: "Net worth reads negative while capital sits funded",
      detail: "Firewalls are working as intended — rented/trading capital is not yours, so it stays out of personal net worth. Flagged only so the number never reads as failure. No action." });
  }

  const penalty = findings.reduce((s, f) => s + (WEIGHT[f.sev] || 0), 0);
  const integrity = Math.max(0, 100 - penalty);
  const blocking = findings.filter((f) => f.sev === "blocking").length;
  return { integrity, findings, blocking, ranAt: localDateStr() };
}
