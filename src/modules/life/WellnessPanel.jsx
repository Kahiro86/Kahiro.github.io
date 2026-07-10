import { useState } from "react";
import { Minus, Plus, Moon, ChevronDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { BD, T1, T2, T3, GL, CY, PU, GR } from "../../shared/designTokens.js";
import { Card, SH, Meter } from "../../shared/ui.jsx";
import { daysAgoStr, localDateStr } from "../../shared/dates.js";

const stepFor = (unit) => (unit === "h" ? 0.5 : unit === "L" ? 0.25 : unit === "min" ? 5 : 1);
const goalOf = (h) => +h.target || 1;
const round2 = (n) => Math.round(n * 100) / 100;

// Unified Daily Wellness — Sleep, Hydration, Prayer/Study — logged with a
// simple stepper and shown together with a combined trend. Advanced trends
// stay hidden until asked for (minimalist by default).
export function WellnessPanel({ habits, onSetValue }) {
  const [range, setRange] = useState(7);
  const [open, setOpen] = useState(false);
  const ds = localDateStr();
  if (!habits.length) return null;

  const metToday = habits.filter((h) => (h.log?.[ds]?.v || 0) >= goalOf(h)).length;
  const combinedPct = Math.round((metToday / habits.length) * 100);

  // Combined daily completion over the selected window.
  const days = Array.from({ length: range }, (_, i) => {
    const d = daysAgoStr(range - 1 - i);
    const met = habits.filter((h) => (h.log?.[d]?.v || 0) >= goalOf(h)).length;
    return { label: d.slice(5), pct: Math.round((met / habits.length) * 100) };
  });
  const avg = Math.round(days.reduce((s, d) => s + d.pct, 0) / days.length);

  return (
    <Card style={{ padding: "18px 20px" }}>
      <SH title="Daily Wellness" sub="Sleep · Hydration · Prayer & Study" action={
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <Moon size={13} color={PU} />
          <span style={{ fontSize: 13, fontWeight: 800, color: combinedPct === 100 ? GR : T1, fontFamily: "monospace" }}>{combinedPct}%</span>
        </div>
      } />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
        {habits.map((h) => {
          const v = round2(h.log?.[ds]?.v || 0);
          const goal = goalOf(h);
          const met = v >= goal;
          const step = stepFor(h.unit);
          return (
            <div key={h.id} style={{ padding: "13px", background: GL, border: `1px solid ${met ? h.color + "44" : BD}`, borderRadius: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                <span style={{ fontSize: 16 }}>{h.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, color: T1, fontWeight: 600 }}>{h.name}</div>
                  <div style={{ fontSize: 10, color: T3 }}>Goal {goal}{h.unit ? ` ${h.unit}` : ""}</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                <button onClick={() => onSetValue(h.id, Math.max(0, round2(v - step)))} style={{ width: 30, height: 30, borderRadius: 8, background: GL, border: `1px solid ${BD}`, color: T2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Minus size={13} /></button>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: met ? h.color : T1, fontFamily: "monospace" }}>{v}</span>
                  <span style={{ fontSize: 11, color: T3 }}> / {goal}{h.unit ? ` ${h.unit}` : ""}</span>
                </div>
                <button onClick={() => onSetValue(h.id, round2(v + step))} style={{ width: 30, height: 30, borderRadius: 8, background: `${h.color}18`, border: `1px solid ${h.color}44`, color: h.color, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Plus size={13} /></button>
              </div>
              <Meter pct={(v / goal) * 100} fill={`linear-gradient(90deg,${h.color}77,${h.color})`} />
            </div>
          );
        })}
      </div>

      <button onClick={() => setOpen((o) => !o)} style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, background: "none", border: "none", color: T3, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>
        <ChevronDown size={13} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
        {open ? "Hide" : "Show"} combined trend
      </button>

      {open && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {[{ v: 7, l: "Week" }, { v: 30, l: "Month" }].map((r) => (
              <button key={r.v} onClick={() => setRange(r.v)} style={{ padding: "5px 13px", borderRadius: 8, fontSize: 11.5, cursor: "pointer", background: range === r.v ? `${CY}18` : GL, color: range === r.v ? CY : T2, border: `1px solid ${range === r.v ? CY + "44" : BD}`, fontFamily: "inherit" }}>{r.l}</button>
            ))}
            <span style={{ fontSize: 11, color: T3, alignSelf: "center", marginLeft: 6 }}>{range}-day average · {avg}%</span>
          </div>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={days} margin={{ top: 0, right: 0, bottom: 0, left: -24 }}>
              <XAxis dataKey="label" stroke={T3} fontSize={9.5} tickLine={false} axisLine={false} interval={range > 10 ? 4 : 0} />
              <YAxis stroke={T3} fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
              <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={({ active, payload }) => active && payload?.length ? <div style={{ background: "#101829", border: `1px solid ${BD}`, borderRadius: 8, padding: "6px 10px", fontSize: 11.5, color: T1 }}>{payload[0].value}% wellness</div> : null} />
              <Bar dataKey="pct" radius={[4, 4, 0, 0]}>
                {days.map((d, i) => <Cell key={i} fill={d.pct === 100 ? GR : d.pct >= 50 ? CY : PU} fillOpacity={0.8} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
