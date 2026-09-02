// ── The analytics dashboard ──────────────────────────────────────────
// All 34 Notion charts plus the five it could not draw, rendered from
// engine/charts.js definitions through the shared <Chart> wrapper.
//
// Nothing here computes; it prepares each chart's data shape and hands it
// over. The arithmetic lives in the engine so it can be tested without a
// browser.
import { useMemo, useState } from "react";
import { BD, T1, T2, T3, AC, AC2, AM, MONO } from "../ui/tokens.js";
import { Card } from "../ui/primitives.jsx";
import { Chart } from "../ui/Chart.jsx";
import { CHARTS, GROUPS, isStarred, missingFields, FIELD_LABELS } from "../engine/charts.js";
import { rowsOf, withCalendarKeys, groupBy, aggregate, sampleSizeCheck } from "../engine/periods.js";
import { equityCurve, maxDrawdownR, longestStreak } from "../engine/sequence.js";

/** Aggregates the chart definitions ask for that are not plain reductions. */
function specialAgg(spec, rows, trades) {
  if (spec.agg === "profitFactor") {
    const loss = aggregate(rows, "grossLossR", "sum");
    if (!loss) return rows.length ? Infinity : 0;
    return +(aggregate(rows, "grossWinR", "sum") / loss).toFixed(2);
  }
  if (spec.agg === "maxDrawdown") return maxDrawdownR(trades);
  if (spec.agg === "lossStreak") return longestStreak(trades, "loss");
  if (spec.agg === "winStreak") return longestStreak(trades, "win");
  return null;
}

export function DashboardTab({ trades, phases, accountId }) {
  const [starsOnly, setStarsOnly] = useState(false);

  const rows = useMemo(() => withCalendarKeys(rowsOf(trades, accountId)), [trades, accountId]);
  const closed = useMemo(() => rowsOf(trades, accountId), [trades, accountId]);
  const phaseName = useMemo(
    () => Object.fromEntries((phases || []).map((p) => [p.id, p.phase])),
    [phases],
  );

  const prepared = useMemo(() => CHARTS.map((spec) => {
    const missing = missingFields(spec, rows).map((f) => FIELD_LABELS[f] || f);
    if (missing.length) return { spec, missing };

    // Charts 18 and 32 only speak about trades that were actually wicked out.
    const scoped = spec.filter === "wickedOut" ? rows.filter((r) => r.wickedOut === "Yes") : rows;

    if (spec.type === "equity") return { spec, data: equityCurve(trades), missing: [] };

    if (spec.type === "number") {
      const special = specialAgg(spec, scoped, trades);
      if (special !== null) return { spec, data: special, n: scoped.length, missing: [] };
      return { spec, data: aggregate(scoped, spec.field, spec.agg), n: scoped.length, missing: [] };
    }

    const buckets = groupBy(scoped, spec.groupBy, {
      valueField: spec.field, agg: spec.agg, sort: spec.sort,
    });
    return {
      spec,
      // labelBy: "phase" turns a stored phase id into the phase's name.
      data: buckets.map((b) => ({
        ...b,
        label: spec.labelBy === "phase" ? (phaseName[b.key] || b.key) : b.key,
      })),
      n: scoped.length,
      missing: [],
    };
  }), [rows, trades, phaseName]);

  const shown = starsOnly ? prepared.filter((p) => isStarred(p.spec)) : prepared;
  const n = closed.length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      {/* The sample-size verdict for the whole page, stated before anything
          below it can be misread as an edge. */}
      <Card style={{
        display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "11px 14px",
      }}>
        <span style={{ fontFamily: MONO, fontSize: 18, fontWeight: 700, color: T1 }}>{n}</span>
        <span style={{ fontSize: 11.5, color: n < 20 ? AM : T2, flex: 1, minWidth: 200 }}>
          closed trade{n === 1 ? "" : "s"} — {sampleSizeCheck(n)}
        </span>
        <button
          type="button"
          onClick={() => setStarsOnly((s) => !s)}
          style={{
            padding: "6px 12px", borderRadius: 8, cursor: "pointer", fontFamily: "inherit",
            fontSize: 11, fontWeight: 600,
            background: starsOnly ? AC2 : "transparent",
            color: starsOnly ? "#000" : T2,
            border: `1px solid ${starsOnly ? AC2 : BD}`,
          }}
        >
          ★ The nine that matter
        </button>
      </Card>

      {GROUPS.map((g) => {
        const inGroup = shown.filter((p) => p.spec.group === g.id);
        if (!inGroup.length) return null;
        return (
          <section key={g.id} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{
              fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase",
              color: T3, fontWeight: 600,
            }}>{g.label}</div>
            <div style={{
              display: "grid", gap: 12,
              gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))",
            }}>
              {inGroup.map((p) => (
                <Chart
                  key={p.spec.id}
                  spec={p.spec}
                  data={p.data}
                  n={p.n}
                  missing={p.missing}
                  star={isStarred(p.spec)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
