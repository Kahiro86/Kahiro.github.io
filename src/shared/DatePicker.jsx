// ── Shared date picker — Today / Yesterday / Prev / Next / calendar ──
// The one control every backdatable logging surface uses to choose which
// day an entry belongs to. Three modules (Trading, Finance/Income, Athlete
// workouts) previously each hand-rolled their own raw `<input type="date">`
// with no way to step a day at a time — this consolidates that into one
// component with quick shortcuts, and is the entry point new backdating
// work (Habits, Nutrition, Journal) builds on.
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { AC, AC2, T1, T2, T3, BD, GL } from "./designTokens.js";
import { localDateStr, daysBetween, shiftDateStr } from "./dates.js";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// "Today" / "Yesterday" / "Monday, 20 July 2026" — the relative-date label
// convention used everywhere a chosen date needs a human-readable heading.
export function relativeDateLabel(ds, today = localDateStr()) {
  const delta = daysBetween(ds, today);
  if (delta === 0) return "Today";
  if (delta === 1) return "Yesterday";
  if (delta === -1) return "Tomorrow";
  const [y, m, d] = ds.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${WEEKDAYS[dt.getDay()]}, ${d} ${MONTHS[m - 1]} ${y}`;
}

// `value`/`onChange` are the only required props — a plain YYYY-MM-DD
// string in, a plain YYYY-MM-DD string out. `max` defaults to today (no
// logging into the future); pass `max={null}` to allow future dates (e.g.
// goal deadlines) — not used by activity logging.
export function DatePicker({ value, onChange, max = localDateStr() }) {
  const ds = value || localDateStr();
  const isToday = ds === localDateStr();
  const isYesterday = ds === shiftDateStr(localDateStr(), -1);
  const atMax = max != null && ds >= max;

  const btnStyle = (active) => ({
    padding: "6px 11px", borderRadius: 8, border: `1px solid ${active ? AC + "55" : BD}`,
    background: active ? `${AC}1a` : GL, color: active ? AC : T2,
    fontSize: 11.5, fontWeight: active ? 700 : 500, cursor: "pointer",
    fontFamily: "inherit", whiteSpace: "nowrap",
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button onClick={() => onChange(shiftDateStr(ds, -1))} aria-label="Previous day"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, border: `1px solid ${BD}`, background: GL, color: T2, cursor: "pointer" }}>
        <ChevronLeft size={14} />
      </button>

      <div style={{ position: "relative", flex: "1 1 auto", minWidth: 150 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 12px", borderRadius: 8, border: `1px solid ${BD}`, background: GL }}>
          <Calendar size={13} color={AC2} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, fontWeight: 700, color: T1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {relativeDateLabel(ds)}
          </span>
          <input
            type="date" value={ds} max={max ?? undefined}
            onChange={(e) => e.target.value && onChange(e.target.value)}
            aria-label="Choose a date"
            style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer", width: "100%", height: "100%" }}
          />
        </div>
      </div>

      <button onClick={() => onChange(shiftDateStr(ds, 1))} aria-label="Next day" disabled={atMax}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 8, border: `1px solid ${BD}`, background: GL, color: atMax ? T3 : T2, cursor: atMax ? "default" : "pointer", opacity: atMax ? 0.4 : 1 }}>
        <ChevronRight size={14} />
      </button>

      {!isYesterday && (
        <button onClick={() => onChange(shiftDateStr(localDateStr(), -1))} style={btnStyle(false)}>Yesterday</button>
      )}
      {!isToday && (
        <button onClick={() => onChange(localDateStr())} style={btnStyle(true)}>Today</button>
      )}
    </div>
  );
}
