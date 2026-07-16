// ── Notification Center ──────────────────────────────────────────────
// The bell, grown up: due reminders with actions, smart nudges, morning
// briefing / evening review, pinned + overdue shelves, searchable history,
// a full reminder editor, response analytics and per-category controls —
// all on the synced stores, so every device shows the same inbox.
import { useMemo, useState } from "react";
import { Bell, Plus, Check, X, Clock, Pin, Trash2, Search, ChevronDown, Pencil, Pause, Play } from "lucide-react";
import { B0, B1, BD, T1, T2, T3, GL, CY, GR, RE, AM, PU } from "./designTokens.js";
import { useStorageState } from "./useStorageState.js";
import { useToast } from "./toast.jsx";
import { localDateStr, daysAgoStr } from "./dates.js";
import { migrateHabits, isScheduled, isDone } from "./habitEngine.js";
import { buildNudges } from "./insights.js";
import { nudgeOfTheDay } from "./kaizen.js";
import { getActiveKillzone } from "../modules/trading/timezone.js";
import { WEEK_PLAN } from "../modules/athlete/constants.js";
import { billsDueSoon } from "../modules/finance/bills.js";
import { sanitizeNutrition, dayTotals, calcTargets, dayEntries } from "../modules/athlete/nutrition.js";
import {
  NOTIF_CATS, PRIORITIES, REPEATS, SNOOZES, NAV_TARGETS, priorityColor,
  newReminder, sanitizeReminders, sanitizeNotifLog, sanitizePrefs,
  bucketLog, notifAnalytics, catEnabled, nextOccurrenceLabel,
} from "./notify.js";

const input = { width: "100%", background: B0, border: `1px solid ${BD}`, borderRadius: 9, padding: "8px 11px", fontSize: 12, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
const NUDGE_CAT = { nonneg: "habits", reviews: "trading", bills: "finance", verses: "faith", decisions: "mind", purity: "life", nutrition: "nutrition", protein: "nutrition", focus: "life" };
const nudgeCat = (id) => NUDGE_CAT[id] || (id.startsWith("risk_") || id.startsWith("mile_") ? "streaks" : id.startsWith("miss_") ? "habits" : "life");
const timeAgo = (ts) => {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m ago`;
  if (m < 1440) return `${Math.round(m / 60)}h ago`;
  return `${Math.round(m / 1440)}d ago`;
};

function Section({ title, color = T3, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 9.5, color, letterSpacing: 1.6, textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{children}</div>
    </div>
  );
}

function Fold({ label, children, open, onToggle, right }) {
  return (
    <div style={{ borderTop: `1px solid ${BD}`, paddingTop: 8, marginTop: 8 }}>
      <button onClick={onToggle} style={{ width: "100%", display: "flex", alignItems: "center", gap: 7, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: "2px 0" }}>
        <ChevronDown size={11} color={T3} style={{ transform: open ? "none" : "rotate(-90deg)", transition: "transform 0.2s" }} />
        <span style={{ fontSize: 9.5, color: T3, letterSpacing: 1.6, textTransform: "uppercase", fontWeight: 700 }}>{label}</span>
        <span style={{ flex: 1 }} />
        {right}
      </button>
      {open && <div style={{ marginTop: 8 }}>{children}</div>}
    </div>
  );
}

export function NotificationCenter({ onNavigate }) {
  const [open, setOpen] = useState(false);
  const [rawRems, setRems] = useStorageState("notif_reminders", []);
  const [rawLog, setLog] = useStorageState("notif_log", []);
  const [rawPrefs, setPrefs] = useStorageState("notif_prefs", null);
  const toast = useToast();

  const rems = useMemo(() => sanitizeReminders(rawRems), [rawRems]);
  const log = useMemo(() => sanitizeNotifLog(rawLog), [rawLog]);
  const prefs = useMemo(() => sanitizePrefs(rawPrefs), [rawPrefs]);

  // Smart nudges — the derived layer (never stored, always current).
  const [rawHabits] = useStorageState("habits", []);
  const [trades] = useStorageState("ict_trades", []);
  const [reviews] = useStorageState("ict_reviews", []);
  const [finance] = useStorageState("finance_state", null);
  const [verses] = useStorageState("faith_scripture", []);
  const [decisions] = useStorageState("mind_decisions", []);
  const [purity] = useStorageState("purity_log", {});
  const [nutrition] = useStorageState("nutrition_log", {});
  const [nutritionProfile] = useStorageState("nutrition_profile", null);
  const [workouts] = useStorageState("athlete_workouts", []);
  const [journal] = useStorageState("journal_entries", []);
  const habits = useMemo(() => migrateHabits(rawHabits).filter((h) => !h.archived && !h.paused), [rawHabits]);
  const nudges = useMemo(() => buildNudges({
    habits, trades: (Array.isArray(trades) ? trades : []).filter((t) => t && t.id), reviews,
    bills: finance?.bills, verses: Array.isArray(verses) ? verses : [],
    decisions: (Array.isArray(decisions) ? decisions : []).filter((d) => d && d.id),
    purity, nutrition, nutritionProfile,
  }).filter((n) => catEnabled(prefs, nudgeCat(n.id))), [habits, trades, reviews, finance, verses, decisions, purity, nutrition, nutritionProfile, prefs]);

  const { active, overdue } = useMemo(() => bucketLog(log), [log, open]);
  const unread = log.filter((e) => e.state === "unread").length;
  const badge = active.length + overdue.length + nudges.length;
  const urgent = active.some((e) => e.priority === "critical" || e.esc >= 3) || overdue.length > 0 || nudges.some((n) => n.tone === "urgent");

  // ── Panel state ─────────────────────────────────────────────────────
  const [editing, setEditing] = useState(null);   // reminder draft
  const [snoozeFor, setSnoozeFor] = useState(null); // log entry id showing snooze menu
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [fold, setFold] = useState({ hist: true, rem: false, ana: false, set: false });
  const flip = (k) => setFold((f) => ({ ...f, [k]: !f[k] }));

  // ── Log mutations ───────────────────────────────────────────────────
  const patchEntry = (id, patch) => setLog((prev) => sanitizeNotifLog(prev).map((e) => (e.id === id ? { ...e, ...patch } : e)));
  const complete = (e) => { patchEntry(e.id, { state: "done", doneAt: Date.now() }); toast("Done ✓", { tone: "success", duration: 1800 }); };
  const dismiss = (e) => patchEntry(e.id, { state: "dismissed" });
  const snooze = (e, min) => {
    const until = min == null
      ? (() => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(8, 0, 0, 0); return d.getTime(); })()
      : Date.now() + min * 60000;
    patchEntry(e.id, { state: "snoozed", snoozeUntil: until, esc: 0 });
    setSnoozeFor(null);
    toast(`Snoozed ${min == null ? "until tomorrow 08:00" : `${min} min`} 💤`, { tone: "info", duration: 2200 });
  };
  const removeEntry = (id) => {
    const item = sanitizeNotifLog(rawLog).find((e) => e.id === id);
    setLog((prev) => sanitizeNotifLog(prev).filter((e) => e.id !== id));
    if (item) toast("Removed from history", { action: "Undo", onAction: () => setLog((p) => [item, ...sanitizeNotifLog(p)]), tone: "danger" });
  };
  const markAllRead = () => setLog((prev) => sanitizeNotifLog(prev).map((e) => (e.state === "unread" ? { ...e, state: "read" } : e)));

  // ── Reminder mutations ──────────────────────────────────────────────
  const saveReminder = () => {
    if (!editing?.title?.trim()) return;
    const rem = { ...editing, title: editing.title.trim() };
    setRems((prev) => {
      const clean = sanitizeReminders(prev);
      return clean.some((r) => r.id === rem.id) ? clean.map((r) => (r.id === rem.id ? rem : r)) : [...clean, rem];
    });
    setEditing(null);
    toast("Reminder saved 🔔", { tone: "success", duration: 2200 });
  };
  const deleteReminder = (r) => {
    setRems((prev) => sanitizeReminders(prev).filter((x) => x.id !== r.id));
    toast(`"${r.title}" deleted`, { action: "Undo", onAction: () => setRems((p) => [...sanitizeReminders(p), r]), tone: "danger" });
  };
  const toggleRemPause = (r) => setRems((prev) => sanitizeReminders(prev).map((x) => (x.id === r.id ? { ...x, paused: !x.paused } : x)));

  // ── Briefing / evening review (derived, never stored) ───────────────
  const hour = new Date().getHours();
  const ds = localDateStr();
  const brief = useMemo(() => {
    const sched = habits.filter((h) => isScheduled(h, ds));
    const done = sched.filter((h) => isDone(h, ds));
    const plan = WEEK_PLAN.find((d) => d.day === ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][new Date().getDay()]);
    const nlog = sanitizeNutrition(nutrition);
    const kcal = Math.round(dayTotals(dayEntries(nlog, ds)).kcal || 0);
    const kcalTarget = calcTargets(nutritionProfile).kcal;
    const bills = billsDueSoon(finance?.bills || []);
    const kz = getActiveKillzone();
    const journaled = (Array.isArray(journal) ? journal : []).some((e) => e && (e.date || "").slice(0, 10) === ds);
    const workedOut = (Array.isArray(workouts) ? workouts : []).some((w) => w && w.date === ds);
    const tmr = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][(new Date().getDay() + 1) % 7];
    const tmrPlan = WEEK_PLAN.find((d) => d.day === tmr);
    const tmrDs = daysAgoStr(-1);
    const tmrHabits = habits.filter((h) => isScheduled(h, tmrDs)).length;
    return { sched: sched.length, done: done.length, pct: sched.length ? Math.round((done.length / sched.length) * 100) : 0, plan, kcal, kcalTarget, bills: bills.length, kz, journaled, workedOut, tmrPlan, tmrHabits };
  }, [habits, ds, nutrition, nutritionProfile, finance, journal, workouts]);

  const analytics = useMemo(() => notifAnalytics(log, 30), [log]);

  const history = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return log
      .filter((e) => (!catFilter || e.cat === catFilter) && (!needle || e.title.toLowerCase().includes(needle)))
      .slice(0, 30);
  }, [log, q, catFilter]);
  const pinned = log.filter((e) => e.pinned).slice(0, 5);

  const askBrowserPermission = async () => {
    try {
      const perm = await Notification.requestPermission();
      if (perm === "granted") { setPrefs({ ...prefs, browser: true }); toast("Browser notifications on (while the app is open)", { tone: "success" }); }
      else toast("Permission not granted — check the browser's site settings.", { tone: "info" });
    } catch { toast("This browser doesn't support notifications.", { tone: "info" }); }
  };

  const stateColor = { unread: CY, read: T3, done: GR, dismissed: T3, missed: RE, snoozed: AM };

  const EntryRow = ({ e, actions = true }) => (
    <div style={{ padding: "9px 11px", background: GL, border: `1px solid ${e.esc >= 3 ? RE + "55" : priorityColor(e.priority) + "33"}`, borderLeft: `3px solid ${priorityColor(e.priority)}`, borderRadius: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <span style={{ fontSize: 13, flexShrink: 0 }}>{e.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: e.state === "unread" ? T1 : T2, fontWeight: e.state === "unread" ? 600 : 400, lineHeight: 1.4 }}>
            {e.title}{e.esc >= 3 && <span style={{ color: RE, fontSize: 10, marginLeft: 6 }}>OVERDUE</span>}
          </div>
          <div style={{ fontSize: 9.5, color: T3, marginTop: 2 }}>{timeAgo(e.firedAt)} · {NOTIF_CATS.find((c) => c.id === e.cat)?.l || e.cat}{e.state === "snoozed" && e.snoozeUntil ? ` · 💤 ${new Date(e.snoozeUntil).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}` : ""}</div>
        </div>
        {actions && (
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <button onClick={() => complete(e)} aria-label={`Complete ${e.title}`} title="Complete" style={{ background: `${GR}14`, border: `1px solid ${GR}44`, borderRadius: 7, padding: "4px 6px", cursor: "pointer", color: GR, display: "flex" }}><Check size={11} /></button>
            <button onClick={() => setSnoozeFor(snoozeFor === e.id ? null : e.id)} aria-label={`Snooze ${e.title}`} title="Snooze" style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 7, padding: "4px 6px", cursor: "pointer", color: AM, display: "flex" }}><Clock size={11} /></button>
            <button onClick={() => dismiss(e)} aria-label={`Dismiss ${e.title}`} title="Dismiss" style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 7, padding: "4px 6px", cursor: "pointer", color: T3, display: "flex" }}><X size={11} /></button>
          </div>
        )}
      </div>
      {snoozeFor === e.id && (
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 8 }}>
          {SNOOZES.map((s) => (
            <button key={s.l} onClick={() => snooze(e, s.min)} style={{ padding: "3px 9px", borderRadius: 11, fontSize: 10, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${AM}33`, background: `${AM}0D`, color: AM }}>{s.l}</button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)} aria-label={`Notifications${badge ? ` (${badge})` : ""}`}
        style={{ width: 34, height: 34, borderRadius: 10, background: open ? `${GR}18` : GL, border: `1px solid ${open ? GR + "55" : BD}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Bell size={13} color={open ? GR : T2} />
      </button>
      {badge > 0 && (
        <div style={{ position: "absolute", top: 4, right: 4, minWidth: 13, height: 13, borderRadius: 7, background: urgent ? RE : unread ? AM : GR, border: `1.5px solid ${B1}`, fontSize: 8.5, fontWeight: 800, color: "#000", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px", pointerEvents: "none" }}>
          {badge}
        </div>
      )}

      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 40 }} onClick={() => { setOpen(false); setEditing(null); setSnoozeFor(null); }} />
          <div style={{ position: "absolute", top: 42, right: 0, width: 400, maxWidth: "calc(100vw - 20px)", maxHeight: "min(78vh, 640px)", overflowY: "auto", background: "rgba(13,17,28,0.97)", backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)", border: `1px solid ${BD}`, borderRadius: 14, padding: 14, zIndex: 41, boxShadow: "0 16px 50px rgba(0,0,0,0.55)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}>
              <Bell size={12} color={GR} />
              <span style={{ fontSize: 10.5, fontWeight: 700, color: GR, letterSpacing: 1.5 }}>NOTIFICATION CENTER</span>
              <span style={{ flex: 1 }} />
              {unread > 0 && <button onClick={markAllRead} style={{ background: "none", border: "none", cursor: "pointer", color: T3, fontSize: 10, fontFamily: "inherit", textDecoration: "underline" }}>Mark all read</button>}
              <button onClick={() => setEditing(editing ? null : newReminder())} aria-label="New reminder"
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", background: editing ? `${GR}18` : GL, border: `1px solid ${editing ? GR + "55" : BD}`, borderRadius: 8, color: editing ? GR : T2, fontSize: 10.5, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                <Plus size={11} />Reminder
              </button>
            </div>

            {/* ── Reminder editor ── */}
            {editing && (
              <div style={{ padding: "11px", background: `${GR}06`, border: `1px dashed ${BD}`, borderRadius: 10, marginBottom: 12, display: "flex", flexDirection: "column", gap: 7 }}>
                <input autoFocus value={editing.title} onChange={(e) => setEditing((s) => ({ ...s, title: e.target.value }))} placeholder="Title — e.g. Drink water, Pre-market prep" aria-label="Reminder title" style={input} />
                <input value={editing.desc} onChange={(e) => setEditing((s) => ({ ...s, desc: e.target.value }))} placeholder="Description (optional)" aria-label="Reminder description" style={input} />
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <input type="date" value={editing.date} onChange={(e) => setEditing((s) => ({ ...s, date: e.target.value }))} aria-label="Date" style={{ ...input, width: 132 }} />
                  <input type="time" value={editing.time} onChange={(e) => setEditing((s) => ({ ...s, time: e.target.value }))} aria-label="Time" style={{ ...input, width: 96 }} />
                  <select value={editing.repeat.kind} onChange={(e) => setEditing((s) => ({ ...s, repeat: { ...s.repeat, kind: e.target.value } }))} aria-label="Repeat" style={{ ...input, width: 128 }}>
                    {REPEATS.map((r) => <option key={r.id} value={r.id}>{r.l}</option>)}
                  </select>
                  {REPEATS.find((r) => r.id === editing.repeat.kind)?.n && (
                    <input type="number" min={1} max={90} value={editing.repeat.n} onChange={(e) => setEditing((s) => ({ ...s, repeat: { ...s.repeat, n: +e.target.value || 2 } }))} aria-label="Repeat interval N" style={{ ...input, width: 58 }} />
                  )}
                </div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                  {PRIORITIES.map((p) => (
                    <button key={p.id} onClick={() => setEditing((s) => ({ ...s, priority: p.id }))}
                      style={{ padding: "3px 10px", borderRadius: 11, fontSize: 10, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${editing.priority === p.id ? p.color + "88" : BD}`, background: editing.priority === p.id ? `${p.color}1E` : GL, color: editing.priority === p.id ? p.color : T3 }}>{p.l}</button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <select value={editing.cat} onChange={(e) => setEditing((s) => ({ ...s, cat: e.target.value }))} aria-label="Category" style={{ ...input, width: 128 }}>
                    {NOTIF_CATS.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.l}</option>)}
                  </select>
                  <select value={editing.nav} onChange={(e) => setEditing((s) => ({ ...s, nav: e.target.value }))} aria-label="Link to" style={{ ...input, width: 150 }}>
                    {NAV_TARGETS.map((t) => <option key={t.id} value={t.id}>{t.id ? `→ ${t.l}` : "No link"}</option>)}
                  </select>
                  <div style={{ display: "flex", gap: 4 }}>
                    {["🔔", "💧", "📖", "💪", "🍽️", "📊", "💰", "🧘", "🧹", "😴"].map((ic) => (
                      <button key={ic} onClick={() => setEditing((s) => ({ ...s, icon: ic }))} aria-label={`Icon ${ic}`} style={{ width: 26, height: 26, borderRadius: 7, fontSize: 12, cursor: "pointer", background: editing.icon === ic ? `${GR}1E` : GL, border: `1px solid ${editing.icon === ic ? GR + "66" : BD}` }}>{ic}</button>
                    ))}
                  </div>
                </div>
                <input value={editing.notes} onChange={(e) => setEditing((s) => ({ ...s, notes: e.target.value }))} placeholder="Notes / checklist (optional)" aria-label="Notes" style={input} />
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button onClick={saveReminder} disabled={!editing.title.trim()}
                    style={{ padding: "7px 16px", background: editing.title.trim() ? `linear-gradient(135deg,${GR},#5fae7c)` : GL, border: "none", borderRadius: 9, color: editing.title.trim() ? "#04130a" : T3, fontSize: 11.5, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" }}>Save reminder</button>
                  <span style={{ fontSize: 9.5, color: T3 }}>{editing.title.trim() ? (nextOccurrenceLabel(editing) ? `Next: ${nextOccurrenceLabel(editing)}` : "") : ""}</span>
                </div>
              </div>
            )}

            {/* ── Briefing / evening review ── */}
            {prefs.briefing && hour < 12 && (
              <div style={{ padding: "10px 12px", background: `linear-gradient(135deg,${CY}0A,${PU}0A)`, border: `1px solid ${CY}22`, borderRadius: 10, marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: CY, letterSpacing: 1.5, fontWeight: 700, marginBottom: 5 }}>🌅 MORNING BRIEFING</div>
                <div style={{ fontSize: 11.5, color: T2, lineHeight: 1.7 }}>
                  {brief.sched} habit{brief.sched === 1 ? "" : "s"} today ({brief.pct}% done) · Training: <b style={{ color: T1 }}>{brief.plan?.type || "—"}</b> · Fuel: <b style={{ color: T1 }}>{brief.kcal}/{brief.kcalTarget} kcal</b>
                  {brief.bills > 0 && <> · <b style={{ color: AM }}>{brief.bills} bill{brief.bills > 1 ? "s" : ""} due soon</b></>} · {brief.kz.active ? <b style={{ color: GR }}>{brief.kz.label.split("(")[0].trim()} open</b> : "No killzone live"}
                </div>
                <div style={{ fontSize: 10, color: T3, marginTop: 5, fontStyle: "italic" }}>{nudgeOfTheDay(0)}</div>
              </div>
            )}
            {prefs.evening && hour >= 17 && (
              <div style={{ padding: "10px 12px", background: `linear-gradient(135deg,${PU}0A,${AM}0A)`, border: `1px solid ${PU}22`, borderRadius: 10, marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: PU, letterSpacing: 1.5, fontWeight: 700, marginBottom: 5 }}>🌙 EVENING REVIEW</div>
                <div style={{ fontSize: 11.5, color: T2, lineHeight: 1.7 }}>
                  Habits <b style={{ color: brief.pct >= 70 ? GR : AM }}>{brief.done}/{brief.sched}</b> · {brief.kcal} kcal eaten · {brief.workedOut ? "Workout done 💪" : "No workout logged"} · {brief.journaled ? "Journal written ✓" : <b style={{ color: AM }}>Journal still open</b>}
                </div>
                <div style={{ fontSize: 10, color: T3, marginTop: 5 }}>Tomorrow: {brief.tmrHabits} habits · {brief.tmrPlan?.type || "—"}</div>
              </div>
            )}

            {/* ── Due now ── */}
            {(active.length > 0 || nudges.length > 0) && (
              <Section title={`Needs attention (${active.length + nudges.length})`} color={AM}>
                {active.map((e) => <EntryRow key={e.id} e={e} />)}
                {nudges.map((n) => (
                  <button key={n.id} onClick={() => { onNavigate?.(n.nav); setOpen(false); }}
                    style={{ display: "flex", gap: 9, padding: "9px 11px", background: GL, border: `1px solid ${n.tone === "urgent" ? AM + "44" : BD}`, borderLeft: `3px solid ${n.tone === "urgent" ? AM : n.tone === "celebrate" ? GR : T3}`, borderRadius: 10, cursor: "pointer", textAlign: "left", fontFamily: "inherit", width: "100%" }}>
                    <span style={{ fontSize: 12, flexShrink: 0 }}>{n.icon}</span>
                    <span style={{ fontSize: 12, color: T2, lineHeight: 1.5 }}>{n.text}</span>
                  </button>
                ))}
              </Section>
            )}

            {/* ── Overdue ── */}
            {overdue.length > 0 && (
              <Section title={`Overdue (${overdue.length})`} color={RE}>
                {overdue.map((e) => <EntryRow key={e.id} e={e} />)}
              </Section>
            )}

            {/* ── Pinned ── */}
            {pinned.length > 0 && (
              <Section title="Pinned" color={CY}>
                {pinned.map((e) => <EntryRow key={e.id} e={e} actions={e.state !== "done" && e.state !== "dismissed"} />)}
              </Section>
            )}

            {active.length === 0 && overdue.length === 0 && nudges.length === 0 && !editing && (
              <div style={{ padding: "22px 10px", textAlign: "center" }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🌿</div>
                <div style={{ fontSize: 12, color: T2 }}>All clear — nothing owed, nothing at risk.</div>
              </div>
            )}

            {/* ── History ── */}
            <Fold label={`History (${log.length})`} open={fold.hist} onToggle={() => flip("hist")}>
              <div style={{ position: "relative", marginBottom: 7 }}>
                <Search size={11} color={T3} style={{ position: "absolute", left: 9, top: 9 }} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search notifications…" aria-label="Search notifications" style={{ ...input, paddingLeft: 26 }} />
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                <button onClick={() => setCatFilter("")} style={{ padding: "2px 9px", borderRadius: 10, fontSize: 9.5, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${!catFilter ? GR + "55" : BD}`, background: !catFilter ? `${GR}14` : GL, color: !catFilter ? GR : T3 }}>All</button>
                {NOTIF_CATS.filter((c) => log.some((e) => e.cat === c.id)).map((c) => (
                  <button key={c.id} onClick={() => setCatFilter(catFilter === c.id ? "" : c.id)} style={{ padding: "2px 9px", borderRadius: 10, fontSize: 9.5, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${catFilter === c.id ? GR + "55" : BD}`, background: catFilter === c.id ? `${GR}14` : GL, color: catFilter === c.id ? GR : T3 }}>{c.icon} {c.l}</button>
                ))}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {history.length === 0 && <div style={{ fontSize: 11, color: T3, padding: "8px 0", textAlign: "center" }}>Nothing here yet.</div>}
                {history.map((e) => (
                  <div key={e.id} onClick={() => e.state === "unread" && patchEntry(e.id, { state: "read" })}
                    style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 9px", background: GL, border: `1px solid ${BD}`, borderRadius: 9, cursor: e.state === "unread" ? "pointer" : "default" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: stateColor[e.state] || T3, flexShrink: 0 }} title={e.state} />
                    <span style={{ fontSize: 11.5, flexShrink: 0 }}>{e.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11, color: e.state === "unread" ? T1 : T2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</div>
                      <div style={{ fontSize: 9, color: T3 }}>{timeAgo(e.firedAt)} · {e.state}</div>
                    </div>
                    <button onClick={(ev) => { ev.stopPropagation(); patchEntry(e.id, { pinned: !e.pinned }); }} aria-label={`Pin ${e.title}`} style={{ background: "none", border: "none", cursor: "pointer", color: e.pinned ? CY : T3, display: "flex", padding: 2 }}><Pin size={10} /></button>
                    <button onClick={(ev) => { ev.stopPropagation(); removeEntry(e.id); }} aria-label={`Delete ${e.title}`} style={{ background: "none", border: "none", cursor: "pointer", color: T3, display: "flex", padding: 2 }}><Trash2 size={10} /></button>
                  </div>
                ))}
              </div>
            </Fold>

            {/* ── My reminders ── */}
            <Fold label={`My reminders (${rems.length})`} open={fold.rem} onToggle={() => flip("rem")}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {rems.length === 0 && <div style={{ fontSize: 11, color: T3, padding: "6px 0", textAlign: "center" }}>No custom reminders yet — tap "+ Reminder".</div>}
                {rems.map((r) => (
                  <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 9px", background: GL, border: `1px solid ${BD}`, borderRadius: 9, opacity: r.paused ? 0.55 : 1 }}>
                    <span style={{ fontSize: 12 }}>{r.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 11.5, color: T1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</div>
                      <div style={{ fontSize: 9, color: T3 }}>{r.time} · {REPEATS.find((x) => x.id === r.repeat.kind)?.l}{REPEATS.find((x) => x.id === r.repeat.kind)?.n ? ` (${r.repeat.n})` : ""} · <span style={{ color: priorityColor(r.priority) }}>{r.priority}</span></div>
                    </div>
                    <button onClick={() => setEditing({ ...r })} aria-label={`Edit ${r.title}`} style={{ background: "none", border: "none", cursor: "pointer", color: T2, display: "flex", padding: 2 }}><Pencil size={11} /></button>
                    <button onClick={() => toggleRemPause(r)} aria-label={r.paused ? `Resume ${r.title}` : `Pause ${r.title}`} style={{ background: "none", border: "none", cursor: "pointer", color: r.paused ? GR : AM, display: "flex", padding: 2 }}>{r.paused ? <Play size={11} /> : <Pause size={11} />}</button>
                    <button onClick={() => deleteReminder(r)} aria-label={`Delete reminder ${r.title}`} style={{ background: "none", border: "none", cursor: "pointer", color: RE, display: "flex", padding: 2 }}><Trash2 size={11} /></button>
                  </div>
                ))}
              </div>
            </Fold>

            {/* ── Analytics ── */}
            <Fold label="Response analytics (30d)" open={fold.ana} onToggle={() => flip("ana")}>
              {!analytics.n ? (
                <div style={{ fontSize: 11, color: T3, textAlign: "center", padding: "6px 0" }}>Complete a few reminders and your patterns show up here.</div>
              ) : (
                <div style={{ fontSize: 11.5, color: T2, lineHeight: 1.9 }}>
                  Completion rate: <b style={{ color: analytics.completionPct >= 70 ? GR : AM, fontFamily: "monospace" }}>{analytics.completionPct}%</b> ({analytics.n} fired)<br />
                  {analytics.avgResponseMin != null && <>Avg response: <b style={{ color: T1, fontFamily: "monospace" }}>{analytics.avgResponseMin} min</b><br /></>}
                  {analytics.mostCompleted && <>Most completed: <b style={{ color: GR }}>{analytics.mostCompleted.t}</b> ({analytics.mostCompleted.pct}%)<br /></>}
                  {analytics.mostIgnored && analytics.mostIgnored.pct < 100 && <>Most ignored: <b style={{ color: RE }}>{analytics.mostIgnored.t}</b> ({analytics.mostIgnored.pct}%)<br /></>}
                  {analytics.bestDay && <>Best day: <b style={{ color: GR }}>{analytics.bestDay}</b>{analytics.worstDay ? <> · Toughest: <b style={{ color: AM }}>{analytics.worstDay}</b></> : null}</>}
                </div>
              )}
            </Fold>

            {/* ── Settings ── */}
            <Fold label="Notification settings" open={fold.set} onToggle={() => flip("set")}>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 9 }}>
                {NOTIF_CATS.map((c) => {
                  const on = catEnabled(prefs, c.id);
                  return (
                    <button key={c.id} onClick={() => setPrefs({ ...prefs, cats: { ...prefs.cats, [c.id]: on ? false : undefined } })}
                      aria-label={`${on ? "Disable" : "Enable"} ${c.l} notifications`}
                      style={{ padding: "3px 9px", borderRadius: 10, fontSize: 9.5, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${on ? GR + "44" : BD}`, background: on ? `${GR}0D` : GL, color: on ? GR : T3, textDecoration: on ? "none" : "line-through" }}>
                      {c.icon} {c.l}
                    </button>
                  );
                })}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 11, color: T2 }}>
                {[
                  ["escalation", "Escalate unhandled reminders (30 / 60 / 120 min)"],
                  ["briefing", "Morning briefing card"],
                  ["evening", "Evening review card"],
                ].map(([k, l]) => (
                  <label key={k} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                    <input type="checkbox" checked={prefs[k]} onChange={() => setPrefs({ ...prefs, [k]: !prefs[k] })} style={{ accentColor: GR }} />{l}
                  </label>
                ))}
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input type="checkbox" checked={prefs.browser} onChange={() => (prefs.browser ? setPrefs({ ...prefs, browser: false }) : askBrowserPermission())} style={{ accentColor: GR }} />
                  Browser notifications <span style={{ color: T3, fontSize: 9.5 }}>(while the app is open — background push needs a server this app doesn't have)</span>
                </label>
              </div>
            </Fold>
          </div>
        </>
      )}
    </div>
  );
}
