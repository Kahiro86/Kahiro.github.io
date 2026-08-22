// ── Calendar — one month, every part of the system on each day ───────
// A month grid that aggregates habits, workouts, nutrition, trades,
// journal, measurements, purity and bills — coloured dots per day, and a
// tap-through day breakdown that deep-links into the owning module. Purely
// a lens over existing data; it stores nothing of its own.
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { BD, B2, T1, T2, T3, GL, GL2, CY, AC, GR } from "../../shared/designTokens.js";
import { Card } from "../../shared/ui.jsx";
import { useStorageState } from "../../shared/useStorageState.js";
import { useWorkouts } from "../../shared/useWorkouts.js";
import { localDateStr, daysAgoStr } from "../../shared/dates.js";
import { migrateHabits } from "../../shared/habitEngine.js";
import { sanitizeNutrition } from "../athlete/nutrition.js";
import { sanitizeTrades } from "../trading/intel/tradingIntel.js";
import { sanitizePurity } from "../life/purity.js";
import { sanitizeBills } from "../finance/bills.js";
import { DEFAULT_FINANCE_STATE } from "../finance/constants.js";
import { CAL_DOMAINS, calendarGrid, dayDomains, activeDots, dayLines } from "../../shared/calendar.js";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOM = Object.fromEntries(CAL_DOMAINS.map((d) => [d.key, d]));

const relLabel = (ds) => {
  if (ds === localDateStr()) return "Today";
  if (ds === daysAgoStr(1)) return "Yesterday";
  return new Date(`${ds}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
};

export function CalendarModule({ habits = [], onNavigate }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [sel, setSel] = useState(localDateStr());

  const rawWorkouts = useWorkouts();
  const [rawTrades] = useStorageState("ti_trades", []);
  const [rawEntries] = useStorageState("journal_entries", []);
  const [rawNutrition] = useStorageState("nutrition_log", {});
  const [rawPurity] = useStorageState("purity_log", {});
  const [rawMeasures] = useStorageState("athlete_measurements", []);
  const [finance] = useStorageState("finance_state", DEFAULT_FINANCE_STATE);

  const S = useMemo(() => ({
    habits: migrateHabits(habits),
    workouts: Array.isArray(rawWorkouts) ? rawWorkouts : [],
    trades: sanitizeTrades(rawTrades),
    entries: (Array.isArray(rawEntries) ? rawEntries : []).filter((e) => e && e.id),
    nutrition: sanitizeNutrition(rawNutrition),
    purity: sanitizePurity(rawPurity),
    measurements: (Array.isArray(rawMeasures) ? rawMeasures : []).filter((m) => m && m.id),
    bills: sanitizeBills(finance?.bills),
  }), [habits, rawWorkouts, rawTrades, rawEntries, rawNutrition, rawPurity, rawMeasures, finance]);

  const grid = useMemo(() => calendarGrid(year, month), [year, month]);
  const today = localDateStr();
  const selLines = useMemo(() => dayLines(sel, S), [sel, S]);

  const step = (delta) => {
    const m = month + delta;
    if (m < 0) { setMonth(11); setYear((y) => y - 1); }
    else if (m > 11) { setMonth(0); setYear((y) => y + 1); }
    else setMonth(m);
  };
  const goToday = () => { setYear(now.getFullYear()); setMonth(now.getMonth()); setSel(today); };

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: "4px 2px 40px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 21, fontWeight: 800, color: T1 }}>{MONTHS[month]} {year}</span>
        </div>
        <button onClick={goToday} style={{ padding: "7px 13px", background: GL, border: `1px solid ${BD}`, borderRadius: 9, color: T2, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Today</button>
        <button onClick={() => step(-1)} aria-label="Previous month" style={{ width: 34, height: 34, borderRadius: 9, background: GL, border: `1px solid ${BD}`, color: T2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronLeft size={17} /></button>
        <button onClick={() => step(1)} aria-label="Next month" style={{ width: 34, height: 34, borderRadius: 9, background: GL, border: `1px solid ${BD}`, color: T2, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronRight size={17} /></button>
      </div>

      <Card style={{ padding: "12px 12px 14px" }}>
        {/* Weekday row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5, marginBottom: 6 }}>
          {WD.map((w) => <div key={w} style={{ textAlign: "center", fontSize: 9.5, letterSpacing: 1, color: T3, textTransform: "uppercase", fontWeight: 600 }}>{w}</div>)}
        </div>
        {/* Weeks */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {grid.map((week, wi) => (
            <div key={wi} style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 5 }}>
              {week.map((cell) => {
                const dom = dayDomains(cell.ds, S);
                const dots = activeDots(dom);
                const isToday = cell.ds === today;
                const isSel = cell.ds === sel;
                const future = cell.ds > today;
                return (
                  <button key={cell.ds} onClick={() => setSel(cell.ds)}
                    style={{ position: "relative", minHeight: 58, padding: "5px 6px", borderRadius: 10, textAlign: "left", cursor: "pointer", fontFamily: "inherit",
                      background: isSel ? GL2 : cell.inMonth ? GL : "transparent",
                      border: `1px solid ${isSel ? AC + "88" : isToday ? AC + "44" : BD}`,
                      opacity: cell.inMonth ? (future ? 0.72 : 1) : 0.32 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 12, fontWeight: isToday ? 800 : 500, color: isToday ? AC : cell.inMonth ? T1 : T3, fontFamily: "monospace" }}>{cell.day}</span>
                      {dom.habitsTotal > 0 && dom.habitsDone < dom.habitsTotal && !future && (
                        <span style={{ fontSize: 8.5, color: T3, fontFamily: "monospace" }}>{dom.habitsDone}/{dom.habitsTotal}</span>
                      )}
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 5 }}>
                      {dots.map((k) => <span key={k} title={DOM[k].label} style={{ width: 6, height: 6, borderRadius: "50%", background: DOM[k].color }} />)}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </Card>

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, margin: "12px 2px", justifyContent: "center" }}>
        {CAL_DOMAINS.map((d) => (
          <div key={d.key} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: d.color }} />
            <span style={{ fontSize: 10.5, color: T3 }}>{d.label}</span>
          </div>
        ))}
      </div>

      {/* Day detail */}
      <Card style={{ padding: "16px 18px", marginTop: 4 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: T1 }}>{relLabel(sel)}</span>
          {sel !== today && <button onClick={() => setSel(today)} style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex", fontSize: 11, fontFamily: "inherit" }}><X size={13} /></button>}
        </div>
        {selLines.length === 0 ? (
          <div style={{ fontSize: 12.5, color: T3, lineHeight: 1.6 }}>Nothing logged this day. {sel <= today ? "Open a module to backdate an entry, or use the quick-log." : "A clean slate ahead."}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {selLines.map((l) => (
              <button key={l.key} onClick={() => l.nav && onNavigate?.(l.nav)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 8px", background: "transparent", border: "none", borderRadius: 9, cursor: l.nav ? "pointer" : "default", textAlign: "left", fontFamily: "inherit", width: "100%" }}
                onMouseEnter={(e) => { if (l.nav) e.currentTarget.style.background = GL; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: DOM[l.key]?.color || T3, flexShrink: 0 }} />
                <span style={{ fontSize: 14 }}>{l.icon}</span>
                <span style={{ flex: 1, fontSize: 13, color: T1, fontWeight: 500 }}>{l.label}</span>
                <span style={{ fontSize: 11.5, color: T3 }}>{l.detail}</span>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
