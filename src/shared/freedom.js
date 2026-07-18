// ── Freedom math — the one number the whole firm serves ──────────────
// The manual's finish line: passive/semi-passive income of KSh 85,100 a month,
// against a life frozen at ~KSh 30K, funded by sovereign capital compounding
// toward the ~KSh 15M line. This turns the doctrine's arithmetic into live
// figures from real finance data — passive income now vs the freedom number,
// capital now vs the line, and an honest projection of how far out the season
// still runs at the current trajectory. Pure; reuses financeSummary.
import { financeSummary } from "../modules/finance/summary.js";
import { sanitizeFirmConfig } from "./firm.js";

// Month-by-month projection: current capital compounding at the net yield with
// a fixed monthly deposit, until it crosses the line. Returns years (1 dp) or
// null if it never reaches within the cap (~60 years) — never a fake number.
function projectYears(capital, target, annualYield, monthlyDeposit, capMonths = 720) {
  if (capital >= target) return 0;
  const i = (annualYield || 0) / 12;
  let bal = capital, m = 0;
  while (bal < target && m < capMonths) { bal = bal * (1 + i) + monthlyDeposit; m++; }
  return m >= capMonths ? null : Math.round((m / 12) * 10) / 10;
}

export function freedomMath(finance, config) {
  const cfg = sanitizeFirmConfig(config);
  const fin = financeSummary(finance);

  const freedomNumber = cfg.freedomNumberKsh;
  const passiveMonthly = Math.max(0, fin.monthlyPassive || 0);
  const freedomPct = Math.min(100, Math.round((passiveMonthly / freedomNumber) * 100));

  const capital = Math.max(0, fin.totalInvested || 0); // sovereign capital at work
  const target = cfg.vaultTargetKsh;
  const capitalPct = Math.min(100, Math.round((capital / target) * 100));

  // Weighted net yield across the money-market funds; fall back to the manual's
  // ~10% planning assumption when there's nothing to weight.
  const mmfs = Array.isArray(finance?.mmfs) ? finance.mmfs.filter(Boolean) : [];
  const wBal = mmfs.reduce((s, m) => s + (+m.balance || 0), 0);
  const wYld = mmfs.reduce((s, m) => s + (+m.balance || 0) * (+m.yield || 0), 0);
  const annualYield = (wBal > 0 ? wYld / wBal : 10) / 100;

  const yearsOut = projectYears(capital, target, annualYield, cfg.monthlyVaultKsh);

  return {
    freedomNumber, passiveMonthly, freedomPct,
    capital, target, capitalPct,
    lifeCost: cfg.lifeCostKsh, surplusToFreedom: Math.max(0, freedomNumber - passiveMonthly),
    annualYield, monthlyDeposit: cfg.monthlyVaultKsh, yearsOut,
  };
}
