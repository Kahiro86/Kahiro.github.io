// ── "What this is worth" (spec §4.3) ─────────────────────────────────
// A habit's XP weight comes from the user's own completion rate with it. The
// spec is explicit that this must be stated in the UI: "hidden formulas feel
// arbitrary and arbitrary feels unfair even when it isn't."
//
// It also satisfies the harder rule — non-negotiable 7, the user must know
// what an action is worth BEFORE taking it. This card shows the number, the
// rate that produced it, and the arithmetic, on the habit itself.
import { useEffect, useState } from "react";
import { db } from "../localDb";
import { isScheduled } from "../logic/schedule";
import { difficultyFor } from "../../../shared/xp/difficulty.js";
import { DIFFICULTY_BANDS, DIFFICULTY_WINDOW_DAYS } from "../../../shared/xp/values.js";
import { EVENTS, DOMAINS } from "../../../shared/xp/values.js";
import type { Habit } from "../logic/dbTypes";

const localDs = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const back = (n: number) => { const d = new Date(); d.setDate(d.getDate() - n); return localDs(d); };

type Measured = { weight: number; rate: number | null; scheduled: number; completed: number;
  band: { l: string; why: string }; provisional: boolean };

export function WorthCard({ habit }: { habit: Habit }) {
  const [m, setM] = useState<Measured | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const from = back(DIFFICULTY_WINDOW_DAYS - 1);
      const to = localDs(new Date());
      const entries = await db.getEntriesForHabit(habit.id, from, to);
      const done = new Set(entries.filter((e) => Number(e.value) > 0).map((e) => String(e.date).slice(0, 10)));
      const created = String(habit.createdAt || "").slice(0, 10);
      let scheduled = 0;
      for (let i = 0; i < DIFFICULTY_WINDOW_DAYS; i++) {
        const ds = back(i);
        if (created && ds < created) continue;
        if (!isScheduled(habit, ds)) continue;
        scheduled++;
      }
      if (alive) setM(difficultyFor({ scheduled, completed: done.size }) as Measured);
    })().catch(() => { if (alive) setM(null); });
    return () => { alive = false; };
  }, [habit.id, habit.createdAt, habit.frequencyType, habit.frequencyDays, habit.frequencyCount]);

  if (!m) return null;

  const subtype = (habit as Habit & { subtype?: string }).subtype;
  const kind = subtype === "abstinence" ? "purity.dayClaimed"
    : subtype === "journal" ? "journal.entry"
    : habit.type === "numeric" ? "habit.numericTarget" : "habit.completed";
  const def = (EVENTS as Record<string, { base: number; domain: string }>)[kind];
  const base = def?.base ?? 10;
  const worth = Math.round(base * m.weight);
  const domain = DOMAINS[def?.domain as keyof typeof DOMAINS];

  return (
    <section className="card worth">
      <div className="worth__top">
        <div>
          <div className="worth__label">What this is worth</div>
          <div className="worth__value">
            {worth}<span className="worth__unit">XP</span>
          </div>
        </div>
        <div className={`worth__band worth__band--${m.provisional ? "new" : bandKey(m.weight)}`}>
          {m.band.l}
          <span className="worth__weight">×{m.weight.toFixed(1)}</span>
        </div>
      </div>

      <p className="worth__why">{m.band.why}</p>

      <div className="worth__math">
        <span>{base} base</span><span className="worth__op">×</span>
        <span>{m.weight.toFixed(1)} difficulty</span><span className="worth__op">=</span>
        <span className="worth__math-out">{worth} XP</span>
      </div>

      <div className="worth__rate">
        {m.rate === null
          ? `No scheduled days yet in the last ${DIFFICULTY_WINDOW_DAYS}.`
          : `You've landed this ${m.completed} of ${m.scheduled} times it came up in the last ${DIFFICULTY_WINDOW_DAYS} days — ${Math.round(m.rate * 100)}%.`}
      </div>

      <details className="worth__rule">
        <summary>How the weight is set</summary>
        <p>
          Weight comes from your own record with this habit, not from a difficulty setting. A habit you've
          mastered stops paying much; one you're still fighting pays more. Adding easy habits can't farm XP,
          because they pull their own weight down within two weeks.
        </p>
        <ul>
          {DIFFICULTY_BANDS.map((b) => (
            <li key={b.l}>
              <span className="worth__rule-w">×{b.w.toFixed(1)}</span>
              <span className="worth__rule-l">{b.l}</span>
              <span className="worth__rule-r">{b.min === 0 ? "under 50%" : `${Math.round(b.min * 100)}% and up`}</span>
            </li>
          ))}
        </ul>
        <p className="worth__rule-note">
          A streak multiplies this further, up to ×1.5 at 60 days. The first {domain ? domain.l.toLowerCase() : "domain"} actions
          each day pay full; past the fourth, each one pays a little less, so quantity never beats difficulty.
          {domain ? ` ${domain.l} pays at most ${domain.cap} XP a day — past that, actions still log and still count for streaks.` : ""}
        </p>
      </details>
    </section>
  );
}

const bandKey = (w: number) => (w <= 0.6 ? "easy" : w <= 1 ? "base" : w <= 1.4 ? "hard" : "frontier");
