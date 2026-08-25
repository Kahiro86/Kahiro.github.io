// ── What this habit is joined to ─────────────────────────────────────
// A link that works invisibly is a link the user cannot trust. This states
// it plainly on the habit itself: which metric it stands for, which way the
// data moves, and — when the habit only claims a bar rather than measuring
// it — why no number flows outward. Nothing here is a control; it reports.
import { useMemo } from "react";
import type { Habit } from "../logic/dbTypes";
import { useStorageState } from "../../../shared/useStorageState.js";
import { resolveLinks, metricById, factorFor, barFor } from "../linkedMetrics.js";

export function LinkCard({ habit }: { habit: Habit }) {
  const [habits] = useStorageState("ht_habits", []);
  const [meta] = useStorageState("ht_meta", {});

  const metric = useMemo(() => {
    const links = resolveLinks(habits, meta);
    for (const [id, habitId] of Object.entries(links)) if (habitId === habit.id) return metricById(id);
    return null;
  }, [habits, meta, habit.id]);

  if (!metric) return null;

  const measures = factorFor(metric, habit) != null;
  const bar = barFor(metric, habit);

  return (
    <section className="card worth">
      <div className="worth__label">Linked · {metric.label}</div>
      <p className="worth__why">
        {metric.readOnly ? (
          <>
            Anything you log as {metric.label.toLowerCase()} elsewhere in Kahiro ticks this
            habit for that day. Nothing flows the other way — a tick here cannot
            invent a record that detailed.
          </>
        ) : measures ? (
          <>
            What you log here is recorded as {metric.label.toLowerCase()} across the whole
            app, and {metric.label.toLowerCase()} logged anywhere else comes back to this
            habit. The bar is {bar} {metric.unit}.
          </>
        ) : (
          <>
            Ticking this marks the day's {metric.label.toLowerCase()} bar as met — it counts
            everywhere, but it records no measurement, so it never moves an
            average. Give the habit a number and a unit and it will.
          </>
        )}
      </p>
    </section>
  );
}
