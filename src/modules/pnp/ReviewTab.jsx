// ── Period reviews ───────────────────────────────────────────────────
// Daily, weekly and monthly, over the same ict_reviews store the Trading
// OS review cascade already uses — so a review written here is the same
// review the XP engine, the directive and the Firm doctrine read.
//
// The numbers are never stored. They compute from the trades in the
// period every time you open it, which means a trade edited afterwards is
// reflected immediately and the three "manual" fields Notion needs — max
// drawdown and both streaks — do not exist as inputs at all.
import { useMemo, useState } from "react";
import { BD, T1, T2, T3, AC, AC2, GR, AM, RE, MONO } from "../../shared/designTokens.js";
import { Card, Empty } from "../../shared/ui.jsx";
import { localDateStr } from "../../shared/dates.js";
import { sanitizeReviews, newReview } from "../trading/reviews.js";
import { reviewStats, periodsWithTrades } from "./engine/review.js";
import { periodKey } from "./engine/periods.js";

const KINDS = [
  { id: "daily", l: "Daily" },
  { id: "weekly", l: "Weekly" },
  { id: "monthly", l: "Monthly" },
];

const PLAN = ["Yes", "Mostly", "No"];
const MOODS = ["Calm / Neutral", "Impatient", "Frustrated", "FOMO", "Revenge", "Overconfident", "Fearful"];
const PLAN_TONE = { Yes: GR, Mostly: AM, No: RE };

const fmt = (v, suffix = "") => (v == null ? "—" : `${v}${suffix}`);

/** One computed number. Dashes when there is nothing to compute from. */
function Stat({ label, value, tone, hint }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 92 }}>
      <div style={{ fontSize: 9, color: T3, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</div>
      <div style={{ fontFamily: MONO, fontSize: 17, fontWeight: 700, color: tone || T1 }}>{value}</div>
      {hint && <div style={{ fontSize: 9.5, color: T3 }}>{hint}</div>}
    </div>
  );
}

const field = {
  background: "transparent", border: `1px solid ${BD}`, borderRadius: 8,
  color: "#fff", padding: "7px 9px", fontSize: 11.5, fontFamily: "inherit", width: "100%",
};

export function ReviewTab({ trades, reviews, setReviews, accountId }) {
  const [kind, setKind] = useState("daily");
  const list = useMemo(() => sanitizeReviews(reviews), [reviews]);

  // Every period you actually traded, newest first — plus the current one,
  // so a review can be started before the day is over.
  const { periods, latestTraded } = useMemo(() => {
    const withTrades = periodsWithTrades(trades, kind);
    const now = periodKey(localDateStr(), kind);
    return {
      periods: withTrades.includes(now) ? withTrades : [now, ...withTrades],
      latestTraded: withTrades[0] || now,
    };
  }, [trades, kind]);

  const [period, setPeriod] = useState(null);
  // Land on the most recent period that has trades, not on an empty today.
  // Opening to a row of dashes reads as a broken screen rather than as an
  // untraded day.
  const active = period && periods.includes(period) ? period : latestTraded;
  const stats = useMemo(
    () => (active ? reviewStats(trades, kind, active, accountId) : null),
    [trades, kind, active, accountId],
  );

  const existing = list.find((r) => r.kind === kind && r.period === active);
  const save = (patch) => {
    setReviews((prev) => {
      const rs = sanitizeReviews(prev);
      const i = rs.findIndex((r) => r.kind === kind && r.period === active);
      if (i >= 0) return rs.map((r, j) => (j === i ? { ...r, ...patch } : r));
      // newReview keeps the shape ReviewsTab and the XP engine expect; the
      // PNP fields ride alongside. sanitizeReviews is a filter, not a
      // whitelist, so they survive without touching reviews.js.
      return [newReview({ kind, period: active, ...patch }), ...rs];
    });
  };

  if (!stats) return <Empty title="No trades yet" body="Log a trade and its review period appears here." />;

  const rTone = (v) => (v == null ? T3 : v > 0 ? GR : v < 0 ? RE : T2);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {KINDS.map((k) => (
          <button key={k.id} type="button" onClick={() => { setKind(k.id); setPeriod(null); }}
            style={{
              padding: "6px 14px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
              fontSize: 11.5, fontWeight: 600,
              background: kind === k.id ? "rgba(120,200,255,0.14)" : "transparent",
              color: kind === k.id ? AC : T2,
              border: `1px solid ${kind === k.id ? AC : BD}`,
            }}>{k.l}</button>
        ))}
        <select value={active} onChange={(e) => setPeriod(e.target.value)}
          style={{ ...field, width: "auto", fontFamily: MONO, marginLeft: "auto" }}>
          {periods.map((p) => <option key={p} value={p} style={{ background: "#161616" }}>{p}</option>)}
        </select>
      </div>

      {/* The numbers. All computed; none typed. */}
      <Card style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: T1 }}>{stats.label}</span>
          <span style={{
            fontSize: 10.5,
            color: stats.sampleLevel === "solid" ? GR : stats.sampleLevel === "hint" ? AM : T3,
          }}>{stats.sampleCheck}</span>
        </div>
        <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
          <Stat label="Trades" value={stats.tradesTaken} />
          <Stat label="Total R" value={fmt(stats.totalR)} tone={rTone(stats.totalR)} />
          <Stat label="Expectancy" value={fmt(stats.expectancyR)} tone={rTone(stats.expectancyR)} hint="R / trade" />
          <Stat label="Profit factor" value={fmt(stats.profitFactor)}
            tone={stats.profitFactor == null ? T3 : stats.profitFactor >= 1.5 ? GR : stats.profitFactor >= 1 ? AM : RE} />
          <Stat label="Win rate" value={fmt(stats.winRatePct, "%")} hint={`${stats.wins}W · ${stats.losses}L · ${stats.breakeven}BE`} />
          <Stat label="Avg execution" value={fmt(stats.avgExecution)} hint="of 10" />
          <Stat label="Rule adherence" value={fmt(stats.avgRuleAdherence, "%")} />
          <Stat label="MFE gap" value={fmt(stats.avgMfeGapR)} hint="R left behind" />
          <Stat label="Wick-outs" value={stats.wickOuts} />
        </div>
        {/* Manual number fields in Notion. Computed here. */}
        <div style={{
          display: "flex", gap: 20, flexWrap: "wrap",
          borderTop: `1px solid ${BD}`, paddingTop: 12,
        }}>
          <Stat label="Max drawdown" value={fmt(stats.maxDrawdownR, "R")} tone={stats.maxDrawdownR ? RE : T2} />
          <Stat label="Longest win streak" value={stats.longestWinStreak} tone={GR} />
          <Stat label="Longest loss streak" value={stats.longestLossStreak} tone={stats.longestLossStreak >= 3 ? RE : T1} />
          <Stat label="Best trade" value={fmt(stats.best?.netR)} tone={GR} />
          <Stat label="Worst trade" value={fmt(stats.worst?.netR)} tone={RE} />
          <div style={{ flex: 1, minWidth: 180, display: "flex", alignItems: "flex-end" }}>
            <span style={{ fontSize: 9.5, color: T3, lineHeight: 1.5 }}>
              Drawdown and streaks are manual fields in Notion — formulas there cannot see
              neighbouring rows. Computed from the sequence here.
            </span>
          </div>
        </div>
      </Card>

      {/* What you write. */}
      <Card style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 150 }}>
            <span style={{ fontSize: 9.5, color: T3, textTransform: "uppercase", letterSpacing: 0.6 }}>Followed the plan?</span>
            <select value={existing?.followedPlan || ""} onChange={(e) => save({ followedPlan: e.target.value })}
              style={{ ...field, color: PLAN_TONE[existing?.followedPlan] || T2, fontWeight: 600 }}>
              <option value="" style={{ background: "#161616" }}>—</option>
              {PLAN.map((o) => <option key={o} value={o} style={{ background: "#161616" }}>{o}</option>)}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 170 }}>
            <span style={{ fontSize: 9.5, color: T3, textTransform: "uppercase", letterSpacing: 0.6 }}>Emotional state</span>
            <select value={existing?.emotionalState || ""} onChange={(e) => save({ emotionalState: e.target.value })} style={field}>
              <option value="" style={{ background: "#161616" }}>—</option>
              {MOODS.map((o) => <option key={o} value={o} style={{ background: "#161616" }}>{o}</option>)}
            </select>
          </label>
        </div>
        {/* The spec's three questions. Not "mostly" — name the rule. */}
        {[
          ["biggestMistake", "The single biggest mistake", "The one that cost the most R — or would have, if the market hadn't bailed you out."],
          ["biggestLesson", "The one lesson for next time", "Write it as an instruction to yourself, not an observation."],
          ["notes", "Notes", ""],
        ].map(([k, label, hint]) => (
          <label key={k} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 9.5, color: T3, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</span>
            {hint && <span style={{ fontSize: 10, color: T3, marginTop: -2 }}>{hint}</span>}
            <textarea rows={k === "notes" ? 3 : 2} value={existing?.[k] || ""}
              onChange={(e) => save({ [k]: e.target.value })}
              style={{ ...field, resize: "vertical", lineHeight: 1.55 }} />
          </label>
        ))}
        {existing && (
          <div style={{ fontSize: 9.5, color: T3 }}>
            Saved as a {kind} review for {active} — visible in Trading OS → Reviews too.
          </div>
        )}
      </Card>
    </div>
  );
}
