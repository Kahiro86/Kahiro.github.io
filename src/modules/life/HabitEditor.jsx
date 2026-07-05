import { useState } from "react";
import { Check, X } from "lucide-react";
import { B2, BD, T1, T2, T3, GL, CY, GR } from "../../shared/designTokens.js";
import { Card } from "../../shared/ui.jsx";
import { HABIT_COLORS, HABIT_ICONS, DEFAULT_CATEGORIES, WEEKDAYS } from "../../shared/habitEngine.js";

// Create/edit a habit: icon, color, category (incl. custom), weekday
// schedule, daily target with unit, notes. Everything optional but the name.
export function HabitEditor({ habit, categories, onSave, onCancel }) {
  const [d, setD] = useState({ ...habit });
  const [customCat, setCustomCat] = useState(false);
  const set = (k, v) => setD((x) => ({ ...x, [k]: v }));
  const allCats = [...new Set([...DEFAULT_CATEGORIES, ...categories])];

  const toggleDay = (i) => set("days", d.days.includes(i) ? d.days.filter((x) => x !== i) : [...d.days, i].sort());
  const daily = d.days.length === 7;
  const weekly = d.freq === "weekly";
  const PILLARS = [{ v: null, l: "None" }, { v: "wellness", l: "🌿 Wellness" }, { v: "nonneg", l: "🎯 Non-negotiable" }];

  const inp = { width: "100%", background: B2, border: `1px solid ${BD}`, borderRadius: 8, padding: "9px 11px", fontSize: 13, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  const lbl = { fontSize: 10, color: T3, letterSpacing: 0.5, textTransform: "uppercase", display: "block", marginBottom: 5 };

  return (
    <Card style={{ padding: "20px", borderColor: CY + "44" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: T1 }}>{habit.name ? "Edit Habit" : "New Habit"}</div>
        <button onClick={onCancel} style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><X size={15} /></button>
      </div>

      <input autoFocus value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="Habit name (e.g. Drink water)" style={{ ...inp, marginBottom: 12 }} />

      <span style={lbl}>Icon</span>
      <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
        {HABIT_ICONS.map((ic) => (
          <button key={ic} onClick={() => set("icon", ic)} style={{ width: 32, height: 32, borderRadius: 8, fontSize: 15, cursor: "pointer", background: d.icon === ic ? `${CY}22` : GL, border: `1px solid ${d.icon === ic ? CY + "66" : BD}` }}>{ic}</button>
        ))}
      </div>

      <span style={lbl}>Colour</span>
      <div style={{ display: "flex", gap: 7, marginBottom: 12 }}>
        {HABIT_COLORS.map((c) => (
          <button key={c} onClick={() => set("color", c)} style={{ width: 24, height: 24, borderRadius: "50%", background: c, cursor: "pointer", border: d.color === c ? `2px solid ${T1}` : "2px solid transparent" }} />
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 11, marginBottom: 12 }}>
        <div>
          <span style={lbl}>Category</span>
          {customCat ? (
            <input value={d.category} onChange={(e) => set("category", e.target.value)} placeholder="New category" style={inp}
              onKeyDown={(e) => e.key === "Enter" && setCustomCat(false)} />
          ) : (
            <select value={allCats.includes(d.category) ? d.category : "__custom__"} onChange={(e) => { if (e.target.value === "__custom__") { setCustomCat(true); set("category", ""); } else set("category", e.target.value); }}
              style={{ ...inp, cursor: "pointer" }}>
              {allCats.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value="__custom__">＋ New category…</option>
            </select>
          )}
        </div>
        <div>
          <span style={lbl}>Daily target {d.target > 1 ? `· ${d.target}${d.unit ? ` ${d.unit}` : "×"}` : ""}</span>
          <div style={{ display: "flex", gap: 7 }}>
            <input type="number" min="1" value={d.target} onChange={(e) => set("target", Math.max(1, +e.target.value || 1))} style={{ ...inp, width: 64, fontFamily: "monospace" }} />
            <input value={d.unit} onChange={(e) => set("unit", e.target.value)} placeholder="unit (L, pages…)" style={inp} />
          </div>
        </div>
      </div>

      <span style={lbl}>Frequency</span>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {[{ v: "daily", l: "Daily" }, { v: "weekly", l: "Weekly" }].map((f) => (
          <button key={f.v} onClick={() => set("freq", f.v)} style={{ flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", background: d.freq === f.v ? `${CY}22` : GL, color: d.freq === f.v ? CY : T3, border: `1px solid ${d.freq === f.v ? CY + "55" : BD}`, fontFamily: "inherit" }}>{f.l}</button>
        ))}
      </div>

      {weekly ? (
        <div style={{ marginBottom: 12 }}>
          <span style={lbl}>Times per week · {d.weeklyTarget}×</span>
          <input type="number" min="1" max="7" value={d.weeklyTarget} onChange={(e) => set("weeklyTarget", Math.max(1, Math.min(7, +e.target.value || 1)))} style={{ ...inp, width: 90, fontFamily: "monospace" }} />
        </div>
      ) : (
        <>
          <span style={lbl}>Schedule {daily ? "· every day" : `· ${d.days.length} days/week`}</span>
          <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
            {WEEKDAYS.map((w, i) => (
              <button key={w} onClick={() => toggleDay(i)} style={{ flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 10.5, fontWeight: 700, cursor: "pointer", background: d.days.includes(i) ? `${d.color}22` : GL, color: d.days.includes(i) ? d.color : T3, border: `1px solid ${d.days.includes(i) ? d.color + "55" : BD}`, fontFamily: "inherit" }}>{w}</button>
            ))}
          </div>
        </>
      )}

      <span style={lbl}>Pillar</span>
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {PILLARS.map((pl) => (
          <button key={pl.l} onClick={() => set("pillar", pl.v)} style={{ flex: 1, padding: "8px 4px", borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: "pointer", background: d.pillar === pl.v ? `${d.color}22` : GL, color: d.pillar === pl.v ? d.color : T3, border: `1px solid ${d.pillar === pl.v ? d.color + "55" : BD}`, fontFamily: "inherit" }}>{pl.l}</button>
        ))}
      </div>

      <input value={d.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Why this habit matters (optional)" style={{ ...inp, marginBottom: 14 }} />

      <div style={{ display: "flex", gap: 9, justifyContent: "flex-end" }}>
        <button onClick={onCancel} style={{ padding: "8px 15px", background: GL, border: `1px solid ${BD}`, borderRadius: 9, color: T2, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
        <button onClick={() => d.name.trim() && d.days.length && onSave({ ...d, name: d.name.trim(), category: d.category || "Personal Growth" })}
          disabled={!d.name.trim() || !d.days.length}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", background: d.name.trim() && d.days.length ? `linear-gradient(135deg,${GR},${CY})` : GL, border: "none", borderRadius: 9, color: d.name.trim() && d.days.length ? "#000" : T3, fontSize: 12.5, fontWeight: 700, cursor: d.name.trim() ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
          <Check size={13} />Save Habit
        </button>
      </div>
    </Card>
  );
}
