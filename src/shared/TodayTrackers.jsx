// ── Today-surface trackers — daily checklist, weekly goal, monthly
// overhead ceiling, and recurring life pings. Plain, quiet, no gamification.
// Composed onto the Command Center so the normal day never needs a module.
import { useMemo, useState } from "react";
import { Check, Plus, Trash2, ArrowUp, ArrowDown, Pencil, X } from "lucide-react";
import { BD, T1, T2, T3, GL, B2, AC, AC2, GR, AM } from "./designTokens.js";
import { Card } from "./ui.jsx";
import { useStorageState } from "./useStorageState.js";
import { localDateStr } from "./dates.js";
import {
  sanitizeChecklist, newChecklistItem, sanitizeChecklistLog, isChecked, toggleChecked,
  sanitizeWeekly, weekKey, weeklyNeedsPrompt, sanitizeArchive,
  sanitizeOverhead, monthKey,
  sanitizePings, DEFAULT_PINGS, newPing, pingDue,
} from "./today.js";
import { sanitizeSeason, seasonActive, seasonDay } from "./season.js";

const kes0 = (n) => Math.round(+n || 0).toLocaleString();
const inp = { width: "100%", background: B2, border: `1px solid ${BD}`, borderRadius: 8, padding: "8px 11px", fontSize: 13, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
const chip = (extra = {}) => ({ display: "flex", alignItems: "center", gap: 5, padding: "6px 11px", background: GL, border: `1px solid ${BD}`, borderRadius: 8, color: T2, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit", ...extra });

export function TodayTrackers({ overheadActual = null }) {
  const ds = localDateStr();

  // ── A. Daily checklist ─────────────────────────────────────────────
  const [rawItems, setItems] = useStorageState("daily_checklist", []);
  const [rawLog, setLog] = useStorageState("daily_checklist_log", {});
  const items = useMemo(() => sanitizeChecklist(rawItems), [rawItems]);
  const logMap = useMemo(() => sanitizeChecklistLog(rawLog), [rawLog]);
  const [editList, setEditList] = useState(false);
  const [newText, setNewText] = useState("");
  const [newCore, setNewCore] = useState(true);
  const addItem = () => { if (!newText.trim()) return; setItems((p) => [...sanitizeChecklist(p), newChecklistItem(newText.trim(), newCore)]); setNewText(""); };
  const removeItem = (id) => setItems((p) => sanitizeChecklist(p).filter((x) => x.id !== id));
  const move = (id, dir) => setItems((p) => { const a = sanitizeChecklist(p); const i = a.findIndex((x) => x.id === id); const j = i + dir; if (i < 0 || j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });
  const toggleCore = (id) => setItems((p) => sanitizeChecklist(p).map((x) => (x.id === id ? { ...x, core: !x.core } : x)));
  const toggle = (id) => setLog((p) => toggleChecked(sanitizeChecklistLog(p), ds, id));
  const doneCount = items.filter((i) => isChecked(logMap, ds, i.id)).length;

  // ── B. Weekly goal ─────────────────────────────────────────────────
  const [rawWeekly, setWeekly] = useStorageState("weekly_goal", {});
  const [rawWArchive, setWArchive] = useStorageState("weekly_goal_archive", []);
  const weekly = sanitizeWeekly(rawWeekly);
  const wArchive = sanitizeArchive(rawWArchive);
  const [wDraft, setWDraft] = useState(weekly.week === weekKey(ds) ? weekly.text : "");
  const [wEditing, setWEditing] = useState(weeklyNeedsPrompt(weekly, ds));
  const [wShowArchive, setWShowArchive] = useState(false);
  const saveWeekly = () => {
    // Archive the outgoing goal if it belonged to a previous week.
    if (weekly.text && weekly.week && weekly.week !== weekKey(ds)) {
      setWArchive((p) => [{ key: weekly.week, text: weekly.text, date: weekly.updatedAt || ds }, ...sanitizeArchive(p)].slice(0, 200));
    }
    setWeekly({ text: wDraft.trim(), week: weekKey(ds), updatedAt: ds });
    setWEditing(false);
  };

  // ── C. Monthly overhead ceiling ────────────────────────────────────
  const [rawOverhead, setOverhead] = useStorageState("monthly_overhead", {});
  const overhead = sanitizeOverhead(rawOverhead);
  const [ohEditing, setOhEditing] = useState(false);
  const [ohDraft, setOhDraft] = useState(String(overhead.targetKsh || ""));
  // Show the actual-vs-target only in the last week of the month (not a daily nag).
  const dayOfMonth = +ds.slice(8, 10);
  const daysInMonth = new Date(+ds.slice(0, 4), +ds.slice(5, 7), 0).getDate();
  const showActual = overheadActual != null && dayOfMonth >= daysInMonth - 6;

  // ── I. Recurring life pings ────────────────────────────────────────
  const [rawPings, setPings] = useStorageState("life_pings", DEFAULT_PINGS);
  const pings = useMemo(() => sanitizePings(rawPings), [rawPings]);
  const duePings = pings.filter((p) => pingDue(p, ds));
  const dismissPing = (id) => setPings((p) => sanitizePings(p).map((x) => (x.id === id ? { ...x, lastDone: ds } : x)));

  // Season day counter (Daniel Fast etc.) surfaced on the today screen.
  const [rawSeason] = useStorageState("active_season", null);
  const season = sanitizeSeason(rawSeason);
  const seasonOn = seasonActive(rawSeason, ds);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {seasonOn && season && (
        <Card style={{ padding: "12px 15px", display: "flex", alignItems: "center", gap: 10, borderColor: `${AC2}55`, background: `${AC2}0a` }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: AC2 }}>🕊️ {season.name}</span>
          <span style={{ fontSize: 12.5, color: T2, fontFamily: "monospace", marginLeft: "auto" }}>Day {seasonDay(rawSeason, ds)} of {season.days}</span>
        </Card>
      )}
      {/* Life pings — dismissible, no lock */}
      {duePings.map((p) => (
        <Card key={p.id} style={{ padding: "12px 15px", display: "flex", alignItems: "center", gap: 10, borderColor: `${AM}44` }}>
          <span style={{ fontSize: 12.5, color: T1, flex: 1 }}>🔔 {p.name} — due{p.lastDone ? "" : " (not logged yet)"}.</span>
          <button onClick={() => dismissPing(p.id)} style={chip({ borderColor: `${GR}55`, color: GR })}><Check size={12} /> Done</button>
        </Card>
      ))}

      {/* Daily checklist */}
      <Card style={{ padding: "15px 17px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, color: T3, flex: 1 }}>Today&apos;s checklist{items.length ? ` · ${doneCount}/${items.length}` : ""}</span>
          <button onClick={() => setEditList((v) => !v)} style={chip()}>{editList ? <><X size={12} /> Done</> : <><Pencil size={12} /> Edit</>}</button>
        </div>
        {items.length === 0 && !editList && <div style={{ fontSize: 12.5, color: T3, lineHeight: 1.5 }}>No items yet — tap Edit to add your recurring daily items.</div>}
        {!editList && items.map((it) => {
          const on = isChecked(logMap, ds, it.id);
          return (
            <button key={it.id} onClick={() => toggle(it.id)} style={{ display: "flex", alignItems: "center", gap: 11, padding: "8px 4px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit", width: "100%" }}>
              <span style={{ width: 19, height: 19, borderRadius: 5, border: `1.5px solid ${on ? GR : T3}`, background: on ? GR : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{on && <Check size={12} color="#04130a" />}</span>
              <span style={{ fontSize: 14, color: on ? T3 : T1, textDecoration: on ? "line-through" : "none" }}>{it.text}</span>
              {!it.core && <span style={{ fontSize: 9, color: T3, border: `1px solid ${BD}`, borderRadius: 5, padding: "1px 5px" }}>optional</span>}
            </button>
          );
        })}
        {editList && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {items.map((it, idx) => (
              <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button onClick={() => toggleCore(it.id)} title={it.core ? "Core" : "Optional"} style={chip({ flex: "none", color: it.core ? AC2 : T3 })}>{it.core ? "Core" : "Opt"}</button>
                <span style={{ flex: 1, fontSize: 13, color: T1 }}>{it.text}</span>
                <button onClick={() => move(it.id, -1)} disabled={idx === 0} style={chip({ flex: "none" })}><ArrowUp size={12} /></button>
                <button onClick={() => move(it.id, 1)} disabled={idx === items.length - 1} style={chip({ flex: "none" })}><ArrowDown size={12} /></button>
                <button onClick={() => removeItem(it.id)} style={chip({ flex: "none", color: "#F85149", borderColor: "#F8514944" })}><Trash2 size={12} /></button>
              </div>
            ))}
            <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
              <input value={newText} onChange={(e) => setNewText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addItem(); }} placeholder="New daily item…" style={inp} />
              <button onClick={() => setNewCore((v) => !v)} style={chip({ flex: "none", color: newCore ? AC2 : T3 })}>{newCore ? "Core" : "Opt"}</button>
              <button onClick={addItem} style={chip({ flex: "none", borderColor: `${GR}55`, color: GR })}><Plus size={12} /></button>
            </div>
          </div>
        )}
      </Card>

      {/* Weekly goal + monthly overhead — one quiet row */}
      <Card style={{ padding: "14px 16px" }}>
        <div style={{ fontSize: 10.5, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, color: T3, marginBottom: 8 }}>This week&apos;s focus</div>
        {wEditing ? (
          <div style={{ display: "flex", gap: 6 }}>
            <input autoFocus value={wDraft} onChange={(e) => setWDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveWeekly(); }} placeholder="One focus statement for this week…" style={inp} />
            <button onClick={saveWeekly} style={chip({ flex: "none", borderColor: `${GR}55`, color: GR })}><Check size={13} /></button>
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ flex: 1, fontSize: 15, color: weekly.text ? T1 : T3, lineHeight: 1.5 }}>{weekly.text || "No focus set for this week."}</span>
            <button onClick={() => { setWDraft(weekly.text); setWEditing(true); }} style={chip({ flex: "none" })}><Pencil size={12} /></button>
          </div>
        )}
        {wArchive.length > 0 && (
          <>
            <button onClick={() => setWShowArchive((v) => !v)} style={{ ...chip({ marginTop: 8 }), background: "none", border: "none", padding: "4px 0", color: T3 }}>{wShowArchive ? "Hide" : "Past weeks"} ({wArchive.length})</button>
            {wShowArchive && <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>{wArchive.map((a, i) => <div key={i} style={{ fontSize: 11.5, color: T3 }}><b style={{ color: T2, fontFamily: "monospace" }}>{a.key}</b> — {a.text}</div>)}</div>}
          </>
        )}

        <div style={{ height: 1, background: BD, margin: "12px 0" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10.5, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, color: T3, marginBottom: 3 }}>Monthly overhead ceiling</div>
            {ohEditing ? (
              <div style={{ display: "flex", gap: 6 }}>
                <input autoFocus type="number" inputMode="numeric" value={ohDraft} onChange={(e) => setOhDraft(e.target.value)} placeholder="KSh" style={{ ...inp, width: 140 }} />
                <button onClick={() => { setOverhead({ targetKsh: Math.max(0, Math.round(+ohDraft || 0)), updatedAt: ds }); setOhEditing(false); }} style={chip({ flex: "none", borderColor: `${GR}55`, color: GR })}><Check size={13} /></button>
              </div>
            ) : (
              <span style={{ fontSize: 16, color: T1, fontWeight: 700, fontFamily: "monospace" }}>{overhead.targetKsh ? `KSh ${kes0(overhead.targetKsh)}` : "Not set"}</span>
            )}
            {showActual && overhead.targetKsh > 0 && (
              <div style={{ fontSize: 11.5, marginTop: 4, color: overheadActual <= overhead.targetKsh ? GR : AM }}>
                This month: KSh {kes0(overheadActual)} {overheadActual <= overhead.targetKsh ? "· under ceiling" : "· over ceiling"}
              </div>
            )}
          </div>
          {!ohEditing && <button onClick={() => { setOhDraft(String(overhead.targetKsh || "")); setOhEditing(true); }} style={chip({ flex: "none" })}><Pencil size={12} /></button>}
        </div>
      </Card>
    </div>
  );
}
