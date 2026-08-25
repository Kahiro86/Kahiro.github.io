// ── What this habit is joined to ─────────────────────────────────────
// A link that works invisibly is a link the user cannot trust. This states
// it plainly on the habit itself: which metric it stands for, which way the
// data moves, and — when the habit only claims a bar rather than measuring
// it — why no number flows outward.
//
// It is also where the link is CHANGED. resolveLinks has always honoured an
// explicit choice in ht_meta, including the explicit choice to link nothing,
// and nothing in the app could make one — so with two water habits the older
// one silently won and the person had no say. A capability with no way to
// reach it is the same defect as a missing one.
import { useMemo } from "react";
import type { Habit } from "../logic/dbTypes";
import { useStorageState, writeStore } from "../../../shared/useStorageState.js";
import {
  resolveLinks, metricById, factorFor, barFor, METRICS, metaKeyFor, NO_LINK,
} from "../linkedMetrics.js";

export function LinkCard({ habit }: { habit: Habit }) {
  const [habits] = useStorageState("ht_habits", []);
  const [meta] = useStorageState("ht_meta", {});

  const links = useMemo(() => resolveLinks(habits, meta), [habits, meta]);

  const metric = useMemo(() => {
    for (const [id, habitId] of Object.entries(links)) if (habitId === habit.id) return metricById(id);
    return null;
  }, [links, habit.id]);

  // A metric this habit's NAME matches but which something else currently
  // holds — or which was explicitly unlinked. That is the case the person
  // needs to see, because otherwise the link is simply missing with no
  // explanation and no way to ask for it.
  const candidate = useMemo(() => {
    if (metric) return null;
    return METRICS.find((m) => m.namePattern.test(String(habit.name || ""))) || null;
  }, [metric, habit.name]);

  const setLink = (metricId: string, value: string) => {
    const next = { ...(meta && typeof meta === "object" ? meta : {}) };
    if (value) next[metaKeyFor(metricId)] = value;
    else delete next[metaKeyFor(metricId)];
    writeStore("ht_meta", next);
  };

  if (!metric && candidate) {
    const holder = habits.find((h: Habit) => h.id === links[candidate.id]);
    return (
      <section className="card worth">
        <div className="worth__label">Not linked · {candidate.label}</div>
        <p className="worth__why">
          {holder
            ? <>This looks like a {candidate.label.toLowerCase()} habit, but <b>{holder.name}</b> is currently the one
                the rest of the app reads. Only one habit can stand for a metric — two would double-count it.</>
            : <>This looks like a {candidate.label.toLowerCase()} habit, but it is not linked, so what you log here
                stays here.</>}
        </p>
        <button type="button" className="worth__action" onClick={() => setLink(candidate.id, habit.id)}>
          Use this habit for {candidate.label}
        </button>
      </section>
    );
  }

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
      <div className="worth__links">
        <button type="button" className="worth__action" onClick={() => setLink(metric.id, NO_LINK)}>
          Unlink
        </button>
        <span className="worth__hint">
          Unlinking stops the sync both ways. Nothing already recorded is removed.
        </span>
      </div>
    </section>
  );
}
