// Kenya PAYE 2024/25 bands. Personal relief KES 2,400/month subtracted from computed tax.
export function calcPAYE(amt) {
  if (amt <= 0) return 0;
  const BANDS = [
    { lim: 24000,    rate: 0.10 },
    { lim: 8333,     rate: 0.25 },
    { lim: 467667,   rate: 0.30 },
    { lim: 300000,   rate: 0.325 },
    { lim: Infinity, rate: 0.35 },
  ];
  let tax = 0, rem = amt;
  for (const b of BANDS) {
    if (rem <= 0) break;
    tax += Math.min(rem, b.lim) * b.rate;
    rem -= b.lim;
  }
  return Math.max(0, Math.round(tax - 2400));
}

// NSSF Act 2013 — Tier I: 6% of first 6,000. Tier II: 6% of pensionable pay above 6,000, capped at +30,000.
export function calcNSSF(amt) {
  if (amt <= 0) return 0;
  const t1 = Math.min(amt, 6000) * 0.06;
  const t2 = amt > 6000 ? Math.min(amt - 6000, 30000) * 0.06 : 0;
  return Math.round(t1 + t2);
}
