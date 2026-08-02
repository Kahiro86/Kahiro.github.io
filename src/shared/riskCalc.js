// ── Risk calculator — size the position, never the ego ───────────────
// Pure position-sizing maths. Given the account, the % you'll risk, and your
// entry/stop, it returns the exact size that caps the loss at that %. Target
// (optional) yields the reward:risk. Instrument-agnostic: "size" is in units
// of whatever you're trading (P/L ≈ size × price move).
const n = (v) => { const x = +v; return Number.isFinite(x) ? x : 0; };

export function computeRisk({ account, riskPct, entry, stop, target }) {
  const acc = Math.max(0, n(account));
  const pct = Math.max(0, Math.min(100, n(riskPct)));
  const e = n(entry), s = n(stop);
  const riskAmount = (acc * pct) / 100;
  const stopDist = Math.abs(e - s);
  const size = stopDist > 0 ? riskAmount / stopDist : 0;
  const dir = e === s ? "" : e > s ? "long" : "short"; // stop below entry → long
  let rr = null, reward = null;
  if (target != null && target !== "" && stopDist > 0) {
    const t = n(target);
    rr = Math.abs(t - e) / stopDist;
    reward = riskAmount * rr;
  }
  return {
    riskAmount: Math.round(riskAmount * 100) / 100,
    stopDist: Math.round(stopDist * 1e6) / 1e6,
    size: Math.round(size * 1e4) / 1e4,
    dir,
    rr: rr == null ? null : Math.round(rr * 100) / 100,
    reward: reward == null ? null : Math.round(reward * 100) / 100,
    valid: acc > 0 && pct > 0 && stopDist > 0,
  };
}
