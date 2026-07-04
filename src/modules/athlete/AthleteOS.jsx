import { useState } from "react";
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { Layers, FileText, TrendingUp, Flame, Plus, CheckCircle, Trash2, Copy, Zap, ArrowUp, ArrowDown, Minus } from "lucide-react";
import { B1, BD, T1, T2, T3, GL, CY, PU, GR, RE, AM } from "../../shared/designTokens.js";
import { Card, SH, Chip } from "../../shared/ui.jsx";
import { mkTT } from "../../shared/ChartTooltip.jsx";
import { useStorageState } from "../../shared/useStorageState.js";
import { useToast } from "../../shared/toast.jsx";
import { localDateStr } from "../../shared/dates.js";
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

  const toast = useToast();
  const startLog = (initial = null) => { setLogInitial(initial); setView("log"); };
  const saveWorkout = (w) => {
    setWorkouts((prev) => [w, ...prev]);
    setLogInitial(null);
    setView("week");
    toast("Workout logged 💪", { tone: "success", duration: 2500 });
  };
  const deleteWorkout = (id) => {
    const w = workouts.find((x) => x.id === id);
    setWorkouts((prev) => prev.filter((x) => x.id !== id));
    toast("Workout deleted", { action: "Undo", onAction: () => setWorkouts((p) => [w, ...p]), tone: "danger" });
  };
  const duplicateWorkout = (w) => startLog({ type: w.type, name: w.name, exercises: w.exercises, duration: w.duration, intensity: w.intensity });
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

  const exercisePRs = {};
  workouts.filter((w) => w.type === "strength").forEach((w) => {
    (w.exercises || []).forEach((ex) => {
      (ex.sets || []).forEach((s) => {
        const wt = +s.weight || 0;
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
    { id: "week",     l: "This Week", i: Layers },
    { id: "history",  l: "History",   i: FileText },
    { id: "progress", l: "Progress",  i: TrendingUp },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ background: B1, borderBottom: `1px solid ${BD}`, padding: "10px 24px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 3, background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: 3 }}>
          {TABS.map(({ id, l, i: Icon }) => (
            <button key={id} onClick={() => setView(id)} style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 13px", borderRadius: 8, border: "none", cursor: "pointer", background: view === id ? `linear-gradient(135deg,${PU}22,${CY}22)` : "transparent", color: view === id ? PU : T2, fontSize: 12, fontWeight: view === id ? 600 : 400, fontFamily: "inherit" }}>
              <Icon size={11} />{l}
            </button>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 11px", background: `${AM}11`, border: `1px solid ${AM}22`, borderRadius: 9 }}>
          <Flame size={12} color={AM} />
          <span style={{ fontSize: 12, fontWeight: 700, color: AM, fontFamily: "monospace" }}>{streak}</span>
          <span style={{ fontSize: 10, color: T3 }}>day streak</span>
        </div>
        <button onClick={() => startLog()} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 15px", background: `linear-gradient(135deg,${PU},${CY})`, border: "none", borderRadius: 10, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          <Plus size={14} />Log Workout
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {view === "week" && (
          <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, color: T1 }}>Athlete OS</div>
              <div style={{ fontSize: 13, color: T3, marginTop: 3 }}>Consistency over intensity — small sessions compound.</div>
            </div>

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

            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
              <Chip label="Strength This Week" value={strengthCount} color={PU} />
              <Chip label="Cardio This Week"   value={cardioCount}   color={CY} />
              <Chip label="Cardio Minutes"     value={cardioMinutes} color={GR} />
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
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 9 }}>
                {WEEK_PLAN.map((d) => {
                  const isToday = d.day === todayDay;
                  const dayLogged = workouts.some((w) => {
                    const wd = new Date(w.date).toLocaleDateString("en-US", { weekday: "short" }).toUpperCase().slice(0, 3);
                    const sameWeek = new Date(w.date) >= weekStart;
                    return wd === d.day && sameWeek;
                  });
                  return (
                    <div key={d.day} style={{ background: isToday ? `${d.color}14` : GL, border: `1px solid ${isToday ? d.color + "55" : BD}`, borderRadius: 11, padding: "12px 9px", textAlign: "center", opacity: d.type === "Rest" ? 0.55 : 1 }}>
                      <div style={{ fontSize: 9, color: isToday ? d.color : T3, letterSpacing: 2, marginBottom: 8, fontWeight: isToday ? 700 : 400 }}>{d.day}</div>
                      <div style={{ fontSize: 20, marginBottom: 8 }}>{d.icon}</div>
                      <div style={{ fontSize: 10.5, color: d.color, fontWeight: 600, lineHeight: 1.4 }}>{d.type}</div>
                      {dayLogged && <div style={{ marginTop: 8 }}><CheckCircle size={12} color={GR} /></div>}
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
                {[{ v: "", l: "All" }, { v: "strength", l: "Strength" }, { v: "cardio", l: "Cardio" }].map((f) => (
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
                        <span style={{ fontSize: 22 }}>{w.type === "strength" ? "💪" : "🏃"}</span>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: T1 }}>{w.name}</div>
                          <div style={{ fontSize: 11, color: T3, marginTop: 2 }}>{w.date}</div>
                          {w.type === "strength" && w.exercises?.length > 0 && (
                            <div style={{ fontSize: 11.5, color: T2, marginTop: 6 }}>
                              {w.exercises.map((e) => e.name).join(", ")}
                            </div>
                          )}
                          {w.type === "cardio" && (
                            <div style={{ fontSize: 11.5, color: T2, marginTop: 6 }}>{w.duration} min · {w.intensity}</div>
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

            {workouts.length === 0 ? (
              <Card style={{ padding: "40px", textAlign: "center", color: T3, fontSize: 13 }}>Log a few workouts to see your progress here.</Card>
            ) : (
              <>
                <Card style={{ padding: "20px" }}>
                  <SH title="Strength Volume" sub="Total kg lifted per week" />
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={last8Weeks} margin={{ top: 0, right: 0, bottom: 0, left: -18 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={BD} />
                      <XAxis dataKey="label" stroke={T3} fontSize={10.5} tickLine={false} axisLine={false} />
                      <YAxis stroke={T3} fontSize={10.5} tickLine={false} axisLine={false} />
                      <Tooltip content={mkTT("", "kg")} />
                      <Bar dataKey="volume" radius={[5, 5, 0, 0]} fill={PU} fillOpacity={0.85} />
                    </BarChart>
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
                    <BarChart data={last8Weeks} margin={{ top: 0, right: 0, bottom: 0, left: -18 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={BD} />
                      <XAxis dataKey="label" stroke={T3} fontSize={10.5} tickLine={false} axisLine={false} />
                      <YAxis stroke={T3} fontSize={10.5} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip content={mkTT("", " sessions")} />
                      <Bar dataKey="count" radius={[5, 5, 0, 0]} fill={GR} fillOpacity={0.85} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>

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
      </div>
    </div>
  );
}
