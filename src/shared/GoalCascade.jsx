// ── Goal Cascade — ladder your goals from year to week ───────────────
// Assign each goal a horizon and, optionally, the higher goal it serves, so a
// week's work visibly ladders up to the year. Reads/writes the goals store
// directly; leaves the Journey goal form untouched. Opened from the palette.
import { useMemo } from "react";
import { X, Layers, ChevronRight } from "lucide-react";
import { B1, B2, BD, BD2, T1, T2, T3, GL, AC2, GR } from "./designTokens.js";
import { useStorageState } from "./useStorageState.js";
import { sanitizeGoals } from "./goals.js";
import { HORIZONS, goalPct, rollupPct, groupByHorizon, eligibleParents } from "./goalCascade.js";

export function GoalCascade({ onClose }) {
  const [rawGoals, setGoals] = useStorageState("goals", []);
  const goals = useMemo(() => sanitizeGoals(rawGoals), [rawGoals]);
  const grouped = useMemo(() => groupByHorizon(goals), [goals]);

  const patch = (id, fields) => setGoals((prev) => sanitizeGoals(prev).map((g) => (g.id === id ? { ...g, ...fields } : g)));
  const setHorizon = (g, h) => patch(g.id, { horizon: h, parent: h === g.horizon ? g.parent : "" }); // clear parent if rung changes
  const setParent = (g, p) => patch(g.id, { parent: p });

  const sel = { background: B2, border: `1px solid ${BD}`, borderRadius: 7, padding: "3px 6px", fontSize: 11, color: T1, outline: "none", fontFamily: "inherit" };
  const label = { fontSize: 10.5, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 700, color: T3 };

  const nameOf = (id) => goals.find((g) => g.id === id)?.name;

  const Row = ({ g }) => {
    const parents = eligibleParents(goals, g);
    const pct = goalPct(g);
    return (
      <div style={{ background: B2, border: `1px solid ${BD}`, borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 7 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ flex: 1, fontSize: 12.5, color: T1, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{g.name}</span>
          <span style={{ fontSize: 11, color: pct >= 100 ? GR : T3, fontFamily: "monospace" }}>{pct}%</span>
        </div>
        <div style={{ height: 4, background: BD, borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: `${pct}%`, height: "100%", background: pct >= 100 ? GR : AC2 }} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <select value={g.horizon} onChange={(e) => setHorizon(g, e.target.value)} style={sel}>
            <option value="">— Horizon —</option>
            {HORIZONS.map((h) => <option key={h.id} value={h.id}>{h.short}</option>)}
          </select>
          {parents.length > 0 && (
            <>
              <ChevronRight size={12} color={T3} />
              <select value={g.parent} onChange={(e) => setParent(g, e.target.value)} style={sel}>
                <option value="">— Serves —</option>
                {parents.map((p) => <option key={p.id} value={p.id}>{p.name.slice(0, 40)}</option>)}
              </select>
            </>
          )}
        </div>
        {g.parent && nameOf(g.parent) && (
          <div style={{ fontSize: 10.5, color: T3 }}>↳ ladders up to <span style={{ color: T2 }}>{nameOf(g.parent)}</span></div>
        )}
      </div>
    );
  };

  const sections = [...HORIZONS.map((h) => ({ id: h.id, l: h.l })), { id: "none", l: "Unplaced" }];

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 4200, background: "rgba(0,0,0,0.66)", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "7vh 16px 24px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 500, background: B1, border: `1px solid ${BD2}`, borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", borderBottom: `1px solid ${BD}` }}>
          <Layers size={18} color={AC2} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T1 }}>Goal Cascade</div>
            <div style={{ fontSize: 11, color: T3 }}>Ladder each goal from year down to week</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><X size={17} /></button>
        </div>

        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 18 }}>
          {goals.length === 0 && (
            <div style={{ padding: "26px 8px", textAlign: "center", color: T3, fontSize: 13 }}>No goals yet. Add goals in Journey, then ladder them here.</div>
          )}
          {sections.map((sec) => {
            const list = grouped[sec.id] || [];
            if (!list.length) return null;
            const rollups = sec.id !== "none" ? list.map((g) => rollupPct(g, goals)) : [];
            const avg = rollups.length ? Math.round(rollups.reduce((a, b) => a + b, 0) / rollups.length) : 0;
            return (
              <div key={sec.id}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                  <span style={label}>{sec.l}</span>
                  {sec.id !== "none" && <span style={{ fontSize: 10.5, color: T3, fontFamily: "monospace" }}>· {avg}% rolled up</span>}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {list.map((g) => <Row key={g.id} g={g} />)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
