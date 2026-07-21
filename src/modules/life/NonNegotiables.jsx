import { Check, Flame } from "lucide-react";
import { BD, T1, T2, T3, GL, GR, RE, AM } from "../../shared/designTokens.js";
import { Card, SH } from "../../shared/ui.jsx";
import { localDateStr, shiftDateStr } from "../../shared/dates.js";
import { isDone, isSkipped, currentStreak, rangeStats } from "../../shared/habitEngine.js";

// The lines you don't cross. One tap each, a 7-day dot trail that makes a
// missed day impossible to ignore, and weekly consistency at a glance.
// `ds` defaults to today but the caller can pass a past date when the user
// is viewing/backdating a prior day — the 7-day trail shifts with it.
export function NonNegotiables({ habits, onTap, ds = localDateStr() }) {
  if (!habits.length) return null;
  const week = Array.from({ length: 7 }, (_, i) => shiftDateStr(ds, i - 6)); // oldest→ds
  const doneToday = habits.filter((h) => isDone(h, ds)).length;

  return (
    <Card style={{ padding: "18px 20px", borderColor: RE + "22" }}>
      <SH title="Non-Negotiables" sub="The daily minimum you hold to — no exceptions" action={
        <span style={{ fontSize: 13, fontWeight: 800, color: doneToday === habits.length ? GR : AM, fontFamily: "monospace" }}>{doneToday}/{habits.length}</span>
      } />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {habits.map((h) => {
          const done = isDone(h, ds);
          const s7 = rangeStats(h, 7);
          const streak = currentStreak(h);
          return (
            <div key={h.id} onClick={() => onTap(h.id)} title={done ? "Tap to undo" : "Tap anywhere to complete"} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", background: done ? `${h.color}0C` : GL, border: `1px solid ${done ? h.color + "44" : BD}`, borderRadius: 11, cursor: "pointer", userSelect: "none" }}>
              <div style={{ width: 32, height: 32, borderRadius: 9, background: done ? `${h.color}33` : GL, border: `2px solid ${done ? h.color : BD}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0 }}>
                {done ? <Check size={15} color={h.color} /> : h.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: done ? T1 : T2, fontWeight: 600 }}>{h.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 3 }}>
                  {/* 7-day dot trail: filled = done, hollow amber = missed */}
                  <div style={{ display: "flex", gap: 3 }}>
                    {week.map((d) => {
                      const wd = isDone(h, d), sk = isSkipped(h, d), isToday = d === ds;
                      return <div key={d} title={d} style={{ width: 8, height: 8, borderRadius: "50%", background: wd ? h.color : sk ? T3 : isToday ? "transparent" : `${RE}55`, border: `1px solid ${wd ? h.color : sk ? T3 : isToday ? BD : RE + "88"}` }} />;
                    })}
                  </div>
                  <span style={{ fontSize: 10, color: T3 }}>· {s7.pct}% this week</span>
                </div>
              </div>
              {streak > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: AM, flexShrink: 0 }}><Flame size={11} />{streak}</span>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
