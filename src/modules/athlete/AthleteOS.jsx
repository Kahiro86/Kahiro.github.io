import { useState } from "react";
import {
  BarChart, Bar, AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Layers, FileText, TrendingUp, Flame, Plus, CheckCircle, Trash2, Copy, Zap, ArrowUp, ArrowDown, Minus, Utensils, Pencil, Camera } from "lucide-react";
import { B1, B2, BD, T1, T2, T3, GL, CY, PU, GR, RE, AM } from "../../shared/designTokens.js";
import { Card, SH, Chip } from "../../shared/ui.jsx";
import { ModuleTabs } from "../../shared/ModuleTabs.jsx";
import { NutritionTab } from "./NutritionTab.jsx";
import { mkTT } from "../../shared/ChartTooltip.jsx";
import { useStorageState } from "../../shared/useStorageState.js";
import { useToast } from "../../shared/toast.jsx";
import { localDateStr } from "../../shared/dates.js";
import { DatePicker, relativeDateLabel } from "../../shared/DatePicker.jsx";
import { MotivePush } from "../../shared/MotivePush.jsx";
import { compressImage } from "../../shared/imageCompress.js";
import { WEEK_PLAN } from "./constants.js";
import { getDayName } from "./helpers.js";
import { DEFAULT_EXERCISES, uidT, lastValuesByExercise, overloadTrend } from "./library.js";
import { LogWorkoutForm } from "./LogWorkoutForm.jsx";

export function AthleteOS() {
  const [view, setView] = useState("week");
  const [workouts, setWorkouts] = useStorageState("athlete_workouts", []);
  const [exerciseLib, setExerciseLib] = useStorageState("athlete_exercises", DEFAULT_EXERCISES);
  const [templates, setTemplates] = useStorageState("athlete_templates", []);
  const [logInitial, setLogInitial] = useState(null);
  const [filterType, setFilterType] = useState("");
  const [rawMeasures, setMeasures] = useStorageState("athlete_measurements", []);
  const measures = (Array.isArray(rawMeasures) ? rawMeasures : []).filter((m) => m && m.id);
  const [mDraft, setMDraft] = useState(null); // { weight, waist, chest, arms, thighs, notes }
  const [rawPhotos, setPhotos] = useStorageState("athlete_photos", []);
  const photos = (Array.isArray(rawPhotos) ? rawPhotos : [])
    .filter((p) => p && p.id && typeof p.dataUrl === "string")
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  const [photoBusy, setPhotoBusy] = useState(false);
  const [viewPhoto, setViewPhoto] = useState(null);

  const toast = useToast();
  const addPhoto = async (file) => {
    if (!file) return;
    setPhotoBusy(true);
    try {
      const dataUrl = await compressImage(file, { maxDim: 1080, quality: 0.7 });
      setPhotos((prev) => [{ id: `ph${Date.now().toString(36)}`, date: localDateStr(), dataUrl, note: "" }, ...(Array.isArray(prev) ? prev : [])]);
      toast("Progress photo added 📸", { tone: "success" });
    } catch (e) {
      toast(e?.message || "Could not add that photo", { tone: "danger" });
    } finally { setPhotoBusy(false); }
  };
  const deletePhoto = (p) => {
    setPhotos((prev) => (Array.isArray(prev) ? prev : []).filter((x) => x?.id !== p.id));
    toast("Photo removed", { action: "Undo", onAction: () => setPhotos((prev) => [p, ...(Array.isArray(prev) ? prev : [])]), tone: "danger" });
  };
  const startLog = (initial = null) => { setLogInitial(initial); setView("log"); };
  const saveWorkout = (w) => {
    setWorkouts((prev) => (prev.some((x) => x.id === w.id) ? prev.map((x) => (x.id === w.id ? w : x)) : [w, ...prev]));
    setLogInitial(null);
    setView("week");
    toast(w.editedAt ? "Workout updated" : "Workout logged 💪", { tone: "success", duration: 2500 });
  };
  const editWorkout = (w) => startLog(w);
  const deleteWorkout = (id) => {
    const w = workouts.find((x) => x.id === id);
    setWorkouts((prev) => prev.filter((x) => x.id !== id));
    toast("Workout deleted", { action: "Undo", onAction: () => setWorkouts((p) => [w, ...p]), tone: "danger" });
  };
  const TYPE_ICON = { strength: "💪", cardio: "🏃", mobility: "🧘", recovery: "😴" };
  const duplicateWorkout = (w) => startLog({ type: w.type, name: w.name, exercises: w.exercises, duration: w.duration, distance: w.distance, intensity: w.intensity });
  const saveMeasure = () => {
    const vals = ["weight", "waist", "chest", "arms", "thighs"].reduce((o, k) => ({ ...o, [k]: +mDraft?.[k] || 0 }), {});
    if (!Object.values(vals).some((v) => v > 0)) return;
    const mDate = mDraft.date || localDateStr();
    const notes = (mDraft.notes || "").trim();
    if (mDraft.id) {
      setMeasures((prev) => (Array.isArray(prev) ? prev : []).map((x) =>
        x?.id === mDraft.id ? { ...x, date: mDate, ...vals, notes, editedAt: new Date().toISOString() } : x));
      toast("Measurements updated ✍️", { tone: "success", duration: 2500 });
    } else {
      setMeasures((prev) => [{ id: uidT(), date: mDate, ...vals, notes, editedAt: null }, ...(Array.isArray(prev) ? prev : [])]);
      toast("Measurements logged 📏", { tone: "success", duration: 2500 });
    }
    setMDraft(null);
  };
  const startEditMeasure = (m) => setMDraft({ id: m.id, date: (m.date || "").slice(0, 10) || localDateStr(),
    weight: m.weight || "", waist: m.waist || "", chest: m.chest || "", arms: m.arms || "", thighs: m.thighs || "", notes: m.notes || "" });
  const deleteMeasure = (m) => {
    setMeasures((prev) => (Array.isArray(prev) ? prev : []).filter((x) => x?.id !== m.id));
    if (mDraft?.id === m.id) setMDraft(null);
    toast("Entry deleted", { action: "Undo", onAction: () => setMeasures((p) => [m, ...(Array.isArray(p) ? p : [])]), tone: "danger" });
  };
  const saveTemplate = (tpl) => {
    setTemplates((prev) => [...prev, { id: uidT(), ...tpl }]);
    toast(`Template "${tpl.name}" saved — one tap to reuse it`, { tone: "success" });
  };
  const deleteTemplate = (id) => {
    const t = templates.find((x) => x.id === id);
    setTemplates((prev) => prev.filter((x) => x.id !== id));
    toast("Template deleted", { action: "Undo", onAction: () => setTemplates((p) => [...p, t]), tone: "danger" });
  };
  const lastValues = lastValuesByExercise(workouts);
  const overload = overloadTrend(workouts);

  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
  const thisWeekWorkouts = workouts.filter((w) => new Date(w.date) >= weekStart);
  const strengthCount = thisWeekWorkouts.filter((w) => w.type === "strength").length;
  const cardioCount = thisWeekWorkouts.filter((w) => w.type === "cardio").length;
  const cardioMinutes = thisWeekWorkouts.filter((w) => w.type === "cardio").reduce((s, w) => s + (+w.duration || 0), 0);
  const mobilityCount = thisWeekWorkouts.filter((w) => w.type === "mobility" || w.type === "recovery").length;

  // Running progression: cardio sessions with a distance, oldest -> newest.
  const runs = workouts
    .filter((w) => w && w.type === "cardio" && +w.distance > 0 && +w.duration > 0)
    .map((w) => ({ date: (w.date || "").slice(5), km: +w.distance, pace: +((+w.duration) / (+w.distance)).toFixed(2) }))
    .reverse();

  // Body measurements, oldest -> newest, for trends and deltas.
  const mAsc = [...measures].sort((a, b) => (a.date < b.date ? -1 : 1));
  const weightSeries = mAsc.filter((m) => +m.weight > 0).map((m) => ({ date: (m.date || "").slice(5), kg: +m.weight }));
  const latestM = mAsc[mAsc.length - 1];
  const prevM = mAsc[mAsc.length - 2];

  const streak = (() => {
    let count = 0, d = new Date();
    const dates = new Set(workouts.map((w) => w.date));
    for (let i = 0; i < 60; i++) {
      const ds = localDateStr(d);
      if (dates.has(ds)) { count++; d.setDate(d.getDate() - 1); }
      else if (i === 0) { d.setDate(d.getDate() - 1); continue; }
      else break;
    }
    return count;
  })();

  const todayDay = getDayName();
  const todayPlan = WEEK_PLAN.find((d) => d.day === todayDay);
  const todayLogged = workouts.some((w) => w.date === localDateStr());

  const filteredHistory = workouts.filter((w) => !filterType || w.type === filterType);

  const last8Weeks = Array.from({ length: 8 }, (_, i) => {
    const wEnd = new Date(now); wEnd.setDate(now.getDate() - i * 7);
    const wStart = new Date(wEnd); wStart.setDate(wEnd.getDate() - 7);
    const wk = workouts.filter((w) => { const d = new Date(w.date); return d > wStart && d <= wEnd; });
    return {
      label: i === 0 ? "This Wk" : `-${i}w`,
      volume: wk.filter((w) => w.type === "strength").reduce((s, w) => s + (+w.totalVolume || 0), 0),
      cardio: wk.filter((w) => w.type === "cardio").reduce((s, w) => s + (+w.duration || 0), 0),
      count: wk.length,
    };
  }).reverse();

  // Training rhythm — which weekdays you actually train and the strength /
  // cardio / mobility balance, over the last 12 weeks. Answers "when do I
  // train, and is the mix balanced" — neither of which the per-metric charts
  // above show.
  const rhythm = (() => {
    const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const cutoff = new Date(now); cutoff.setDate(now.getDate() - 84);
    const recent = workouts.filter((w) => w && w.date && new Date(w.date) >= cutoff);
    const byDay = Array.from({ length: 7 }, () => 0);
    const byType = { strength: 0, cardio: 0, mobility: 0, recovery: 0 };
    for (const w of recent) {
      const wd = new Date(`${w.date}T12:00:00`).getDay();
      if (wd >= 0 && wd <= 6) byDay[wd]++;
      if (w.type in byType) byType[w.type]++;
    }
    const maxDay = Math.max(1, ...byDay);
    const weekday = byDay.map((n, i) => ({ day: WD[i], n, pct: Math.round((n / maxDay) * 100) }));
    const total = recent.length;
    const types = [
      { k: "strength", l: "Strength", c: PU }, { k: "cardio", l: "Cardio", c: CY },
      { k: "mobility", l: "Mobility", c: GR }, { k: "recovery", l: "Recovery", c: AM },
    ].map((t) => ({ ...t, n: byType[t.k], pct: total ? Math.round((byType[t.k] / total) * 100) : 0 })).filter((t) => t.n > 0);
    const busiest = weekday.filter((d) => d.n > 0).sort((a, b) => b.n - a.n)[0] || null;
    return { weekday, types, total, perWeek: +(total / 12).toFixed(1), busiest };
  })();

  const exercisePRs = {};
  workouts.filter((w) => w && w.type === "strength").forEach((w) => {
    (Array.isArray(w.exercises) ? w.exercises : []).forEach((ex) => {
      if (!ex || !ex.name) return;
      (Array.isArray(ex.sets) ? ex.sets : []).forEach((s) => {
        const wt = +s?.weight || 0;
        if (wt > 0 && (!exercisePRs[ex.name] || wt > exercisePRs[ex.name].weight)) {
          exercisePRs[ex.name] = { weight: wt, reps: +s.reps || 0, date: w.date };
        }
      });
    });
  });
  const prList = Object.entries(exercisePRs).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.weight - a.weight);

  if (view === "log") return <LogWorkoutForm onSave={saveWorkout} onCancel={() => { setLogInitial(null); setView("week"); }}
    exerciseLib={exerciseLib} setExerciseLib={setExerciseLib} templates={templates} onSaveTemplate={saveTemplate}
    initial={logInitial} lastValues={lastValues} />;

  const TABS = [
    { id: "week",      l: "This Week", i: Layers },
    { id: "history",   l: "History",   i: FileText },
    { id: "progress",  l: "Progress",  i: TrendingUp },
    { id: "nutrition", l: "Nutrition", i: Utensils },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ModuleTabs tabs={TABS} active={view} onSelect={setView} pad="6px 13px" activeBg={`linear-gradient(135deg,${PU}22,${CY}22)`} activeColor={PU}>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", background: `${AM}11`, border: `1px solid ${AM}22`, borderRadius: 9 }}>
          <Flame size={12} color={AM} />
          <span style={{ fontSize: 12, fontWeight: 700, color: AM, fontFamily: "monospace" }}>{streak}</span>
          <span style={{ fontSize: 10, color: T3 }}>day streak</span>
        </div>
        {workouts[0] && (
          <button onClick={() => duplicateWorkout(workouts[0])} title={`Repeat: ${workouts[0].name}`} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 13px", background: GL, border: `1px solid ${CY}44`, borderRadius: 10, color: CY, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap" }}>
            <Copy size={13} />Repeat last
          </button>
        )}
        <button onClick={() => startLog()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 15px", background: `linear-gradient(135deg,${PU},${CY})`, border: "none", borderRadius: 10, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          <Plus size={14} />Log Workout
        </button>
      </ModuleTabs>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {view === "week" && (
          <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: T1 }}>Athlete OS</div>
              <div style={{ fontSize: 13, color: T3, marginTop: 3 }}>Consistency over intensity — small sessions compound.</div>
            </div>

            <MotivePush context={todayLogged ? ["workout", "streak"] : ["workout", "day-start"]}
              state={{ streak, missedYesterday: streak === 0 && workouts.length > 0 }} accent={PU} />

            {streak === 0 && workouts.length > 0 && !todayLogged && (
              <div style={{ padding: "12px 18px", background: `${GR}0D`, border: `1px solid ${GR}33`, borderRadius: 12, display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 18 }}>🌱</span>
                <span style={{ fontSize: 13, color: T2, lineHeight: 1.5 }}>Been a little while — that's part of training. Returning is the win. Even a 10-minute session today puts you back in motion.</span>
              </div>
            )}

            {!todayLogged && todayPlan && todayPlan.type !== "Rest" && (
              <div style={{ padding: "14px 18px", background: `${PU}0D`, border: `1px solid ${PU}33`, borderRadius: 12, display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{ fontSize: 24 }}>{todayPlan.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: PU }}>Today: {todayPlan.type}</div>
                  <div style={{ fontSize: 12, color: T2 }}>A short, easy version still counts. Start small.</div>
                </div>
                <button onClick={() => startLog()} style={{ padding: "8px 16px", background: `${PU}22`, border: `1px solid ${PU}44`, borderRadius: 9, color: PU, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  Log Now
                </button>
              </div>
            )}
            {todayLogged && (
              <div style={{ padding: "12px 18px", background: `${GR}0D`, border: `1px solid ${GR}33`, borderRadius: 12, display: "flex", alignItems: "center", gap: 12 }}>
                <CheckCircle size={18} color={GR} />
                <span style={{ fontSize: 13, color: T1 }}>Workout logged for today. Nice work.</span>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 12 }}>
              <Chip label="Strength This Week" value={strengthCount} color={PU} />
              <Chip label="Cardio This Week"   value={cardioCount}   color={CY} />
              <Chip label="Cardio Minutes"     value={cardioMinutes} color={GR} />
              <Chip label="Mobility & Recovery" value={mobilityCount} color={AM} />
              <Chip label="Day Streak"         value={streak}        color={AM} />
            </div>

            {templates.length > 0 && (
              <Card style={{ padding: "18px" }}>
                <SH title="Quick-Start Templates" sub="One tap to load a saved session — edit before saving" />
                <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                  {templates.map((tpl) => (
                    <div key={tpl.id} style={{ display: "flex", alignItems: "center", gap: 4, background: GL, border: `1px solid ${CY}33`, borderRadius: 10, padding: "4px 4px 4px 12px" }}>
                      <button onClick={() => startLog(tpl)} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: CY, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
                        <Zap size={12} />{tpl.name}
                        <span style={{ fontSize: 10, color: T3 }}>{tpl.type === "strength" ? `${(tpl.exercises || []).length} ex` : `${tpl.duration}m`}</span>
                      </button>
                      <button onClick={() => deleteTemplate(tpl.id)} title="Delete template" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex", padding: 4 }}><Trash2 size={11} /></button>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <Card style={{ padding: "20px" }}>
              <SH title="Weekly Plan" sub="Simple split — adjust as needed" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,minmax(0,1fr))", gap: 5 }}>
                {WEEK_PLAN.map((d) => {
                  const isToday = d.day === todayDay;
                  const dayLogged = workouts.some((w) => {
                    const wd = new Date(w.date).toLocaleDateString("en-US", { weekday: "short" }).toUpperCase().slice(0, 3);
                    const sameWeek = new Date(w.date) >= weekStart;
                    return wd === d.day && sameWeek;
                  });
                  return (
                    <div key={d.day} style={{ position: "relative", background: isToday ? `${d.color}14` : GL, border: `1px solid ${isToday ? d.color + "55" : BD}`, borderRadius: 8, padding: "7px 3px", textAlign: "center", opacity: d.type === "Rest" ? 0.5 : 1 }}>
                      <div style={{ fontSize: 8, color: isToday ? d.color : T3, letterSpacing: 1, marginBottom: 3, fontWeight: isToday ? 700 : 400 }}>{d.day}</div>
                      <div style={{ fontSize: 14, marginBottom: 3, lineHeight: 1 }}>{d.icon}</div>
                      <div style={{ fontSize: 8.5, color: d.color, fontWeight: 600, lineHeight: 1.2 }}>{d.type}</div>
                      {dayLogged && <CheckCircle size={9} color={GR} style={{ position: "absolute", top: 3, right: 3 }} />}
                    </div>
                  );
                })}
              </div>
            </Card>

            {prList.length > 0 && (
              <Card style={{ padding: "20px" }}>
                <SH title="Personal Records" sub="Heaviest weight logged per exercise" />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
                  {prList.slice(0, 6).map((pr) => (
                    <div key={pr.name} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: "12px" }}>
                      <div style={{ fontSize: 11, color: T2, marginBottom: 5 }}>{pr.name}</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: PU, fontFamily: "monospace" }}>{pr.weight}kg</div>
                      <div style={{ fontSize: 10, color: T3 }}>× {pr.reps} reps</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {workouts.length === 0 && (
              <Card style={{ padding: "40px", textAlign: "center" }}>
                <div style={{ fontSize: 30, marginBottom: 10 }}>🏋️</div>
                <div style={{ fontSize: 14, color: T2, marginBottom: 6 }}>No workouts logged yet</div>
                <div style={{ fontSize: 12, color: T3, marginBottom: 16 }}>Log your first session to start tracking progress.</div>
                <button onClick={() => startLog()} style={{ padding: "9px 20px", background: `linear-gradient(135deg,${PU},${CY})`, border: "none", borderRadius: 10, color: "#000", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  Log Your First Workout
                </button>
              </Card>
            )}
          </div>
        )}

        {view === "history" && (
          <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: T1 }}>History</div>
                <div style={{ fontSize: 13, color: T3, marginTop: 3 }}>{workouts.length} workouts logged</div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {[{ v: "", l: "All" }, { v: "strength", l: "Strength" }, { v: "cardio", l: "Cardio" }, { v: "mobility", l: "Mobility" }, { v: "recovery", l: "Recovery" }].map((f) => (
                  <button key={f.v} onClick={() => setFilterType(f.v)} style={{ padding: "6px 13px", borderRadius: 9, border: `1px solid ${filterType === f.v ? PU + "66" : BD}`, background: filterType === f.v ? `${PU}22` : GL, color: filterType === f.v ? PU : T2, fontSize: 12, fontWeight: filterType === f.v ? 700 : 400, cursor: "pointer", fontFamily: "inherit" }}>
                    {f.l}
                  </button>
                ))}
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <Card style={{ padding: "40px", textAlign: "center", color: T3, fontSize: 13 }}>No workouts in this filter.</Card>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filteredHistory.map((w) => (
                  <Card key={w.id} style={{ padding: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ display: "flex", gap: 12 }}>
                        <span style={{ fontSize: 22 }}>{TYPE_ICON[w.type] || "🏃"}</span>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: T1 }}>{w.name}</div>
                          <div style={{ fontSize: 11, color: T3, marginTop: 2 }}>{w.date}</div>
                          {w.type === "strength" && w.exercises?.length > 0 && (
                            <div style={{ fontSize: 11.5, color: T2, marginTop: 6 }}>
                              {w.exercises.map((e) => e?.name).filter(Boolean).join(", ")}
                            </div>
                          )}
                          {w.type !== "strength" && (
                            <div style={{ fontSize: 11.5, color: T2, marginTop: 6 }}>{w.duration} min{w.type === "cardio" && +w.distance > 0 ? ` · ${w.distance} km · ${((+w.duration) / (+w.distance)).toFixed(1)} min/km` : ""} · {w.intensity}</div>
                          )}
                          {w.notes && <div style={{ fontSize: 11, color: T3, marginTop: 6, fontStyle: "italic" }}>"{w.notes}"</div>}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {w.type === "strength" && w.totalVolume > 0 && (
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: 15, fontWeight: 800, color: PU, fontFamily: "monospace" }}>{w.totalVolume.toLocaleString()}kg</div>
                            <div style={{ fontSize: 9.5, color: T3 }}>volume</div>
                          </div>
                        )}
                        <button onClick={() => editWorkout(w)} title="Edit" style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 7, padding: "6px 7px", cursor: "pointer", color: T2, display: "flex" }}><Pencil size={12} /></button>
                        <button onClick={() => duplicateWorkout(w)} title="Repeat this workout" style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 7, padding: "6px 7px", cursor: "pointer", color: CY, display: "flex" }}><Copy size={12} /></button>
                        <button onClick={() => deleteWorkout(w.id)} title="Delete" style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 7, padding: "6px 7px", cursor: "pointer", color: RE, display: "flex" }}><Trash2 size={12} /></button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {view === "progress" && (
          <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: T1 }}>Progress</div>
              <div style={{ fontSize: 13, color: T3, marginTop: 3 }}>Last 8 weeks</div>
            </div>

            {/* ── Progress Photos — on-device, compressed ── */}
            <Card style={{ padding: "20px" }}>
              <SH title="Progress Photos" sub="How you look over time — stored on your device, compressed" action={
                <label style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", background: `${PU}18`, border: `1px solid ${PU}44`, borderRadius: 9, color: PU, fontSize: 12, fontWeight: 700, cursor: photoBusy ? "default" : "pointer", fontFamily: "inherit", opacity: photoBusy ? 0.6 : 1 }}>
                  <Camera size={13} />{photoBusy ? "Adding…" : "Add photo"}
                  <input type="file" accept="image/*" disabled={photoBusy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; addPhoto(f); }} style={{ display: "none" }} />
                </label>
              } />
              {photos.length === 0 ? (
                <div style={{ padding: "16px 4px", fontSize: 12, color: T3, textAlign: "center" }}>No photos yet. Snap a front/side shot every few weeks — the changes you can't see day to day show up here.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(96px,1fr))", gap: 8 }}>
                  {photos.map((p) => (
                    <div key={p.id} style={{ position: "relative", borderRadius: 10, overflow: "hidden", border: `1px solid ${BD}`, aspectRatio: "3 / 4", background: GL }}>
                      <img src={p.dataUrl} alt={`Progress ${p.date}`} onClick={() => setViewPhoto(p)} style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer", display: "block" }} />
                      <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "3px 6px", background: "linear-gradient(transparent, rgba(0,0,0,0.72))", fontSize: 9.5, color: "#fff", pointerEvents: "none" }}>{relativeDateLabel(p.date)}</div>
                      <button onClick={() => deletePhoto(p)} aria-label="Delete photo" style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.55)", border: "none", borderRadius: 6, padding: 3, cursor: "pointer", color: "#fff", display: "flex" }}><Trash2 size={11} /></button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {viewPhoto && (
              <div onClick={() => setViewPhoto(null)} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.9)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, cursor: "zoom-out" }}>
                <img src={viewPhoto.dataUrl} alt={`Progress ${viewPhoto.date}`} style={{ maxWidth: "100%", maxHeight: "88%", borderRadius: 10, objectFit: "contain" }} />
                <div style={{ marginTop: 12, fontSize: 12, color: "#ccc" }}>{relativeDateLabel(viewPhoto.date)}</div>
              </div>
            )}

            {workouts.length === 0 ? (
              <Card style={{ padding: "40px", textAlign: "center", color: T3, fontSize: 13 }}>Log a few workouts to see your progress here.</Card>
            ) : (
              <>
                {rhythm.total > 0 && (
                  <Card style={{ padding: "20px" }}>
                    <SH title="Training Rhythm" sub={`${rhythm.perWeek}/week over 12 weeks · when you train and the mix`} />
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 7, alignItems: "end", height: 96, marginTop: 4 }}>
                      {rhythm.weekday.map((d) => (
                        <div key={d.day} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 5, height: "100%" }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: d.n === 0 ? T3 : PU, fontFamily: "monospace" }}>{d.n || "—"}</span>
                          <div style={{ width: "100%", height: `${Math.max(3, d.pct * 0.7)}%`, minHeight: 3, background: d.n === 0 ? BD : `linear-gradient(180deg,${PU},${CY})`, borderRadius: 4, opacity: d.n === 0 ? 0.4 : 1 }} />
                          <span style={{ fontSize: 10, color: d.day === todayDay ? CY : T3, fontWeight: d.day === todayDay ? 700 : 400 }}>{d.day}</span>
                        </div>
                      ))}
                    </div>
                    {rhythm.types.length > 0 && (
                      <>
                        <div style={{ display: "flex", height: 8, borderRadius: 5, overflow: "hidden", marginTop: 16, background: GL }}>
                          {rhythm.types.map((t) => <div key={t.k} style={{ width: `${t.pct}%`, background: t.c }} title={`${t.l} ${t.pct}%`} />)}
                        </div>
                        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 9 }}>
                          {rhythm.types.map((t) => (
                            <span key={t.k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: T2 }}>
                              <span style={{ width: 9, height: 9, borderRadius: 2, background: t.c }} />{t.l} <b style={{ color: T1 }}>{t.pct}%</b>
                            </span>
                          ))}
                        </div>
                      </>
                    )}
                    {rhythm.busiest && <div style={{ fontSize: 11, color: T3, marginTop: 12, lineHeight: 1.5 }}>Most sessions land on <b style={{ color: PU }}>{rhythm.busiest.day}</b>. {rhythm.types.length === 1 ? "One training type so far — a little variety builds a more resilient body." : "Watch the balance: recovery and mobility protect the hard days."}</div>}
                  </Card>
                )}

                <Card style={{ padding: "20px" }}>
                  <SH title="Strength Volume" sub="Total kg lifted per week" />
                  <ResponsiveContainer width="100%" height={180}>
                    <LineChart data={last8Weeks} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={BD} />
                      <XAxis dataKey="label" stroke={T3} fontSize={10.5} tickLine={false} axisLine={false} />
                      <YAxis stroke={T3} fontSize={10.5} tickLine={false} axisLine={false} />
                      <Tooltip content={mkTT("", "kg")} />
                      <Line type="monotone" dataKey="volume" stroke={PU} strokeWidth={2} dot={{ fill: PU, r: 2.5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>

                <Card style={{ padding: "20px" }}>
                  <SH title="Cardio Minutes" sub="Total minutes per week" />
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={last8Weeks} margin={{ top: 0, right: 0, bottom: 0, left: -18 }}>
                      <defs>
                        <linearGradient id="cardioG" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CY} stopOpacity={0.25} />
                          <stop offset="95%" stopColor={CY} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={BD} />
                      <XAxis dataKey="label" stroke={T3} fontSize={10.5} tickLine={false} axisLine={false} />
                      <YAxis stroke={T3} fontSize={10.5} tickLine={false} axisLine={false} />
                      <Tooltip content={mkTT("", "min")} />
                      <Area type="monotone" dataKey="cardio" stroke={CY} strokeWidth={2.5} fill="url(#cardioG)" dot={{ fill: CY, r: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </Card>

                <Card style={{ padding: "20px" }}>
                  <SH title="Workout Frequency" sub="Sessions logged per week" />
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={last8Weeks} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={BD} />
                      <XAxis dataKey="label" stroke={T3} fontSize={10.5} tickLine={false} axisLine={false} />
                      <YAxis stroke={T3} fontSize={10.5} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip content={mkTT("", " sessions")} />
                      <Line type="monotone" dataKey="count" stroke={GR} strokeWidth={2} dot={{ fill: GR, r: 2.5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>

                {runs.length >= 2 && (
                  <Card style={{ padding: "20px" }}>
                    <SH title="Running Progression" sub="Distance per run · pace (min/km) — lower pace line = faster" />
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={runs} margin={{ top: 0, right: 0, bottom: 0, left: -18 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={BD} />
                        <XAxis dataKey="date" stroke={T3} fontSize={10.5} tickLine={false} axisLine={false} />
                        <YAxis stroke={T3} fontSize={10.5} tickLine={false} axisLine={false} />
                        <Tooltip content={mkTT("", " km")} />
                        <Bar dataKey="km" radius={[5, 5, 0, 0]} fill={CY} fillOpacity={0.85} />
                      </BarChart>
                    </ResponsiveContainer>
                    <ResponsiveContainer width="100%" height={140}>
                      <LineChart data={runs} margin={{ top: 8, right: 0, bottom: 0, left: -18 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={BD} />
                        <XAxis dataKey="date" stroke={T3} fontSize={10.5} tickLine={false} axisLine={false} />
                        <YAxis stroke={T3} fontSize={10.5} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                        <Tooltip content={mkTT("", " min/km")} />
                        <Line type="monotone" dataKey="pace" stroke={GR} strokeWidth={2} dot={{ fill: GR, r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Card>
                )}

                {overload.length > 0 && (
                  <Card style={{ padding: "20px" }}>
                    <SH title="Progressive Overload" sub="Top-set weight this session vs the one before" />
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {overload.map((o) => {
                        const up = o.delta != null && o.delta > 0;
                        const down = o.delta != null && o.delta < 0;
                        const flat = o.delta === 0 || o.delta == null;
                        return (
                          <div key={o.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 13px", background: GL, borderRadius: 10, border: `1px solid ${up ? GR + "33" : down ? RE + "33" : BD}` }}>
                            <div>
                              <div style={{ fontSize: 13, color: T1 }}>{o.name}</div>
                              <div style={{ fontSize: 10, color: T3 }}>{o.sessions} session{o.sessions === 1 ? "" : "s"} · latest {o.date}</div>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                              <span style={{ fontSize: 15, fontWeight: 800, color: PU, fontFamily: "monospace" }}>{o.latest}kg</span>
                              <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 12, fontWeight: 700, fontFamily: "monospace", color: up ? GR : down ? RE : T3, width: 58, justifyContent: "flex-end" }}>
                                {up ? <ArrowUp size={12} /> : down ? <ArrowDown size={12} /> : <Minus size={12} />}
                                {o.delta == null ? "new" : `${o.delta > 0 ? "+" : ""}${o.delta}kg`}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                )}

                {prList.length > 0 && (
                  <Card style={{ padding: "20px" }}>
                    <SH title="All Personal Records" sub="Best weight per exercise" />
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {prList.map((pr) => (
                        <div key={pr.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 13px", background: GL, borderRadius: 10, border: `1px solid ${BD}` }}>
                          <span style={{ fontSize: 13, color: T1 }}>{pr.name}</span>
                          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                            <span style={{ fontSize: 11, color: T3 }}>{pr.date}</span>
                            <span style={{ fontSize: 15, fontWeight: 800, color: PU, fontFamily: "monospace" }}>{pr.weight}kg × {pr.reps}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}
              </>
            )}
          </div>
        )}

        {view === "nutrition" && (
          <div style={{ padding: "22px 24px 0", display: "flex", flexDirection: "column", gap: 16, maxWidth: 900 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontSize: 22, fontWeight: 800, color: T1 }}>Body composition</div>
                <div style={{ fontSize: 13, color: T3, marginTop: 3 }}>The body today's fuel is building — the scale is one signal, not the verdict.</div>
              </div>
              {!mDraft && (
                <button onClick={() => setMDraft({ date: localDateStr(), weight: "", waist: "", chest: "", arms: "", thighs: "", notes: "" })}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 15px", background: `linear-gradient(135deg,${PU},${CY})`, border: "none", borderRadius: 10, color: "#000", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  <Plus size={13} />Log measurements
                </button>
              )}
            </div>

            {mDraft && (
              <Card style={{ padding: "16px", borderColor: `${PU}44` }}>
                <div style={{ marginBottom: 12 }}><DatePicker value={mDraft.date || localDateStr()} onChange={(v) => setMDraft((d) => ({ ...d, date: v }))} /></div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 10, marginBottom: 10 }}>
                  {[["weight", "Weight (kg)"], ["waist", "Waist (cm)"], ["chest", "Chest (cm)"], ["arms", "Arms (cm)"], ["thighs", "Thighs (cm)"]].map(([k, l]) => (
                    <label key={k}>
                      <span style={{ fontSize: 9.5, color: T3, letterSpacing: 1, textTransform: "uppercase" }}>{l}</span>
                      <input type="number" value={mDraft[k]} onChange={(e) => setMDraft((d) => ({ ...d, [k]: e.target.value }))}
                        style={{ width: "100%", background: B2, border: `1px solid ${BD}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, color: T1, outline: "none", fontFamily: "monospace", marginTop: 4, boxSizing: "border-box" }} />
                    </label>
                  ))}
                </div>
                <input value={mDraft.notes} onChange={(e) => setMDraft((d) => ({ ...d, notes: e.target.value }))} placeholder="Notes (optional)"
                  style={{ width: "100%", background: B2, border: `1px solid ${BD}`, borderRadius: 8, padding: "9px 11px", fontSize: 12.5, color: T1, outline: "none", fontFamily: "inherit", marginBottom: 10, boxSizing: "border-box" }} />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => setMDraft(null)} style={{ padding: "8px 14px", background: GL, border: `1px solid ${BD}`, borderRadius: 9, color: T2, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                  <button onClick={saveMeasure} style={{ padding: "8px 18px", background: `linear-gradient(135deg,${PU},${CY})`, border: "none", borderRadius: 9, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>{mDraft.id ? "Update entry" : "Save entry"}</button>
                </div>
              </Card>
            )}

            {measures.length === 0 && !mDraft && (
              <Card style={{ padding: "40px", textAlign: "center" }}>
                <div style={{ fontSize: 30, marginBottom: 10 }}>📏</div>
                <div style={{ fontSize: 14, color: T2, marginBottom: 6 }}>No measurements yet</div>
                <div style={{ fontSize: 12, color: T3 }}>Log weight and tape measurements every week or two — trends beat daily noise.</div>
              </Card>
            )}

            {latestM && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 11 }}>
                {[["weight", "Weight", "kg"], ["waist", "Waist", "cm"], ["chest", "Chest", "cm"], ["arms", "Arms", "cm"], ["thighs", "Thighs", "cm"]].map(([k, l, u]) => {
                  const cur = +latestM[k] || 0;
                  if (!cur) return null;
                  const prev = prevM ? +prevM[k] || 0 : 0;
                  const d = prev ? +(cur - prev).toFixed(1) : null;
                  return (
                    <Card key={k} style={{ padding: "13px 15px" }}>
                      <div style={{ fontSize: 9.5, color: T3, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 }}>{l}</div>
                      <div style={{ fontSize: 19, fontWeight: 800, color: PU, fontFamily: "monospace" }}>{cur}<span style={{ fontSize: 11, color: T3 }}> {u}</span></div>
                      {d != null && d !== 0 && <div style={{ fontSize: 10.5, fontWeight: 700, color: T2, marginTop: 3 }}>{d > 0 ? `▲ +${d}` : `▼ ${d}`} vs last</div>}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {view === "nutrition" && <NutritionTab />}

        {view === "nutrition" && measures.length > 0 && (
          <div style={{ padding: "4px 24px 24px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 900 }}>
            {weightSeries.length >= 2 && (
              <Card style={{ padding: "20px" }}>
                <SH title="Weight Trend" sub="Every logged entry" />
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={weightSeries} margin={{ top: 6, right: 4, bottom: 0, left: -18 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={BD} />
                    <XAxis dataKey="date" stroke={T3} fontSize={10.5} tickLine={false} axisLine={false} />
                    <YAxis stroke={T3} fontSize={10.5} tickLine={false} axisLine={false} domain={["auto", "auto"]} />
                    <Tooltip content={mkTT("", " kg")} />
                    <Line type="monotone" dataKey="kg" stroke={PU} strokeWidth={2} dot={{ fill: PU, r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            )}

            {measures.length > 0 && (
              <Card style={{ padding: "16px 18px" }}>
                <SH title="History" sub={`${measures.length} entr${measures.length === 1 ? "y" : "ies"}`} />
                {[...measures].sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))).map((m) => (
                  <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", background: GL, border: `1px solid ${m.id === mDraft?.id ? PU + "55" : BD}`, borderRadius: 10, marginBottom: 7, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 11, color: T3, width: 128 }}>{relativeDateLabel((m.date || "").slice(0, 10) || localDateStr())}{m.editedAt && <span style={{ opacity: 0.7 }}> · edited</span>}</span>
                    <span style={{ flex: 1, fontSize: 12, color: T2 }}>
                      {[["weight", "kg"], ["waist", "cm W"], ["chest", "cm C"], ["arms", "cm A"], ["thighs", "cm T"]]
                        .filter(([k]) => +m[k] > 0).map(([k, u]) => `${m[k]}${u.split(" ")[0]}${u.includes(" ") ? " " + u.split(" ")[1] : ""}`).join(" · ")}
                      {m.notes ? ` — ${m.notes}` : ""}
                    </span>
                    <button onClick={() => startEditMeasure(m)} aria-label="Edit entry" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex", padding: 2 }}><Pencil size={11} /></button>
                    <button onClick={() => deleteMeasure(m)} aria-label="Delete entry" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex", padding: 2 }}><Trash2 size={11} /></button>
                  </div>
                ))}
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
