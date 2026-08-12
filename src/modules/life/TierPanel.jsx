// ── Tier panel — one graphed habit tier (Non-Negotiables, Wellness, 1%) ──
// Every habit in these tiers is qualitative AND quantitative: a target-1 habit
// logs as a tick, a target>1 habit logs with a stepper, and BOTH get a
// per-habit trend graph so the pattern is visible at a glance. Normal daily
// habits (no pillar) stay a plain checklist elsewhere — only these elite tiers
// carry the graph. One shared component so all three tiers read identically.
import { Check, Minus, Plus, Flame } from "lucide-react";
import { BD, T1, T2, T3, GL, GR, AM } from "../../shared/designTokens.js";
import { Card, SH } from "../../shared/ui.jsx";
import { localDateStr, shiftDateStr } from "../../shared/dates.js";
import { valueOn, isDone, isSkipped, isScheduled, currentStreak, rangeStats } from "../../shared/habitEngine.js";

const stepFor = (unit) => (unit === "h" ? 0.5 : unit === "L" ? 0.25 : unit === "min" ? 5 : 1);
const round2 = (n) => Math.round(n * 100) / 100;
const ctrlBtn = (bd, fg, bg = GL) => ({ width: 28, height: 28, borderRadius: 8, background: bg, border: `1px solid ${bd}`, color: fg, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 });

// Per-habit trend: last `days` days as mini bars. Height ∝ value/target, so a
// tick habit reads on/off and a measured habit reads as a real trend line.
function SparkBars({ h, days = 21, ds }) {
  const target = h.target || 1;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 32, marginTop: 10 }}>
      {Array.from({ length: days }, (_, i) => {
        const d = shiftDateStr(ds, i - (days - 1));
        const v = valueOn(h, d);
        const ratio = Math.max(0, Math.min(1, v / target));
        const met = v >= target;
        const sk = isSkipped(h, d);
        const isToday = d === ds;
        const bg = met ? h.color : v > 0 ? `${h.color}66` : sk ? `${T3}44` : `${BD}`;
        return (
          <div key={d} title={`${d} · ${round2(v)}${h.unit ? " " + h.unit : met ? " done" : ""}`} style={{ flex: 1, minWidth: 2, height: "100%", display: "flex", alignItems: "flex-end" }}>
            <div style={{ width: "100%", height: `${Math.max(v > 0 ? 14 : 6, ratio * 100)}%`, borderRadius: 2, background: bg, outline: isToday ? `1px solid ${h.color}88` : "none" }} />
          </div>
        );
      })}
    </div>
  );
}

export function TierPanel({ habits, title, sub, accent = GR, onTap, onSetValue, ds = localDateStr() }) {
  if (!habits.length) return null;
  const metToday = habits.filter((h) => isDone(h, ds)).length;

  return (
    <Card style={{ padding: "18px 20px", borderColor: `${accent}26` }}>
      <SH title={title} sub={sub} action={
        <span style={{ fontSize: 13, fontWeight: 800, color: metToday === habits.length ? GR : accent, fontFamily: "monospace" }}>{metToday}/{habits.length}</span>
      } />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {habits.map((h) => {
          const v = round2(valueOn(h, ds));
          const target = h.target || 1;
          const met = v >= target;
          const quant = target > 1;
          const step = stepFor(h.unit);
          const streak = currentStreak(h);
          const s7 = rangeStats(h, 7);
          return (
            <div key={h.id} style={{ padding: "12px 13px", background: met ? `${h.color}0C` : GL, border: `1px solid ${met ? h.color + "44" : BD}`, borderRadius: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {/* status / tick — clickable for qualitative habits */}
                <button
                  onClick={quant ? undefined : () => onTap(h.id)}
                  title={quant ? h.name : met ? "Tap to undo" : "Tap to complete"}
                  style={{ width: 32, height: 32, borderRadius: 9, background: met ? `${h.color}33` : GL, border: `2px solid ${met ? h.color : BD}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, cursor: quant ? "default" : "pointer", padding: 0 }}>
                  {met ? <Check size={15} color={h.color} /> : <span>{h.icon}</span>}
                </button>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: T1, fontWeight: 600 }}>{h.name}</div>
                  <div style={{ fontSize: 10, color: T3, marginTop: 2 }}>
                    {quant ? `${v} / ${target}${h.unit ? " " + h.unit : ""}` : met ? "Held today" : "Not yet"} · {s7.pct}% this week
                  </div>
                </div>
                {streak > 0 && <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, color: AM, flexShrink: 0 }}><Flame size={11} />{streak}</span>}
                {/* quantitative stepper */}
                {quant && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <button onClick={() => onSetValue(h.id, Math.max(0, round2(v - step)))} aria-label={`Less ${h.name}`} style={ctrlBtn(BD, T2)}><Minus size={13} /></button>
                    <span style={{ fontSize: 15, fontWeight: 800, color: met ? h.color : T1, fontFamily: "monospace", minWidth: 30, textAlign: "center" }}>{v}</span>
                    <button onClick={() => onSetValue(h.id, round2(v + step))} aria-label={`More ${h.name}`} style={ctrlBtn(`${h.color}44`, h.color, `${h.color}18`)}><Plus size={13} /></button>
                  </div>
                )}
              </div>
              <SparkBars h={h} ds={ds} />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
