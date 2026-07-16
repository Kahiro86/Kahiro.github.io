// ── Journey — universal goals + the Hall of Fame ─────────────────────
// One place for direction (goals in every area of life) and legacy (the
// lifelong tiered milestones). Goals live in the synced `goals` store;
// everything in the Hall of Fame derives from the XP engine's stats, so
// nothing here can drift or be edited into existence.
import { useMemo, useState } from "react";
import { Target, Trophy, Plus, Check, Pencil, Archive, Link2 } from "lucide-react";
import { BD, T1, T2, T3, GL, B2, GR, RE, AM, CY } from "../../shared/designTokens.js";
import { Card, SH, Chip, Meter, Empty, Hydrating } from "../../shared/ui.jsx";
import { ModuleTabs } from "../../shared/ModuleTabs.jsx";
import { Collapse } from "../../shared/Collapse.jsx";
import { useStorageState } from "../../shared/useStorageState.js";
import { useToast } from "../../shared/toast.jsx";
import {
  GOAL_AREAS, GOAL_SOURCES, areaOf, sourceOf, isAuto, CHECKPOINTS,
  sanitizeGoals, newGoal, goalPct, setGoalProgress, updateGoal,
  nextCheckpoint, goalDaysLeft, goalsSummary,
} from "../../shared/goals.js";
import { TITLES } from "../../shared/xpEngine.js";

const JO = "#A5946B"; // muted gold — this module's accent

const fmtDate = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "");

// ── Goal editor (create + edit share one form) ───────────────────────
function GoalForm({ initial, stats = {}, onSave, onCancel }) {
  const [area, setArea] = useState(initial?.area || "fitness");
  const [name, setName] = useState(initial?.name || "");
  const [target, setTarget] = useState(initial ? String(initial.target) : "");
  const [current, setCurrent] = useState(initial ? String(initial.current) : "0");
  const [unit, setUnit] = useState(initial?.unit || "");
  const [deadline, setDeadline] = useState(initial?.deadline || "");
  const [source, setSource] = useState(initial?.source || "");
  const auto = !!source;
  const canSave = name.trim() && Number.isFinite(+target) && +target > 0;
  const inp = { background: B2, border: `1px solid ${BD}`, borderRadius: 9, padding: "9px 11px", fontSize: 12.5, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  const save = () => {
    if (!canSave) return;
    // Always carry source/sourceBase explicitly so switching auto→manual on an
    // edit clears the old binding (a patch merge would otherwise keep it).
    const payload = { area, name, target: +target, unit, deadline: deadline || null, source: "", sourceBase: 0 };
    if (auto) {
      // Baseline = the source's live count now (kept from the original goal when
      // editing), so progress is counted from the moment tracking started.
      payload.source = source;
      payload.sourceBase = initial?.source === source ? initial.sourceBase : (+stats[source] || 0);
      payload.current = Math.max(0, (+stats[source] || 0) - payload.sourceBase);
    } else {
      payload.current = +current || 0;
    }
    onSave(payload);
  };
  return (
    <Card style={{ padding: "16px 18px", borderColor: `${JO}33` }}>
      <SH title={initial ? "Edit goal" : "New goal"} sub="Any area of life — a number moving toward a target" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {GOAL_AREAS.map((a) => (
          <button key={a.id} onClick={() => setArea(a.id)} aria-label={`Area ${a.label}`}
            style={{ padding: "6px 11px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, fontWeight: area === a.id ? 700 : 400, background: area === a.id ? `${a.color}22` : GL, border: `1px solid ${area === a.id ? a.color + "66" : BD}`, color: area === a.id ? T1 : T3 }}>
            {a.icon} {a.label}
          </button>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 9 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Goal name (e.g. Read 12 books)" style={{ ...inp, gridColumn: "1 / -1" }} aria-label="Goal name" />
        <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Target (number)" inputMode="decimal" style={inp} aria-label="Goal target" />
        {!auto && <input value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="Current progress" inputMode="decimal" style={inp} aria-label="Goal current progress" />}
        <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Unit (books, kg, KES…)" style={inp} aria-label="Goal unit" />
        <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} style={{ ...inp, colorScheme: "dark" }} aria-label="Goal deadline (optional)" />
      </div>

      {/* Auto-track: bind progress to a count the app already keeps */}
      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 10, color: T3, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 7 }}>Progress tracking</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <button onClick={() => setSource("")} aria-label="Track manually"
            style={{ padding: "6px 11px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, fontWeight: !auto ? 700 : 400, background: !auto ? `${JO}22` : GL, border: `1px solid ${!auto ? JO + "66" : BD}`, color: !auto ? "#C9BB96" : T3 }}>
            ✍️ Manual
          </button>
          {GOAL_SOURCES.map((s) => (
            <button key={s.stat} onClick={() => setSource(s.stat)} aria-label={`Auto-track from ${s.label}`}
              style={{ padding: "6px 11px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", fontSize: 11.5, fontWeight: source === s.stat ? 700 : 400, background: source === s.stat ? `${JO}22` : GL, border: `1px solid ${source === s.stat ? JO + "66" : BD}`, color: source === s.stat ? "#C9BB96" : T3 }}>
              {s.icon} {s.label}
            </button>
          ))}
        </div>
        {auto && (
          <div style={{ fontSize: 10.5, color: T3, marginTop: 7, lineHeight: 1.5 }}>
            Advances automatically as you log {sourceOf(source)?.label.toLowerCase()} — counted from today. No manual updates needed.
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button onClick={save} disabled={!canSave}
          style={{ flex: 1, padding: "9px", background: canSave ? `${JO}1E` : GL, border: `1px solid ${canSave ? JO + "55" : BD}`, borderRadius: 9, color: canSave ? "#C9BB96" : T3, fontSize: 12.5, fontWeight: 700, cursor: canSave ? "pointer" : "default", fontFamily: "inherit" }}>
          {initial ? "Save changes" : "Create goal"}
        </button>
        <button onClick={onCancel} style={{ padding: "9px 16px", background: GL, border: `1px solid ${BD}`, borderRadius: 9, color: T3, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit" }}>
          Cancel
        </button>
      </div>
    </Card>
  );
}

// ── One active goal ──────────────────────────────────────────────────
function GoalCard({ g, onSet, onEdit, onArchive }) {
  const [draft, setDraft] = useState(null); // progress-input draft, null = closed
  const a = areaOf(g.area);
  const pct = goalPct(g);
  const next = nextCheckpoint(g);
  const left = goalDaysLeft(g);
  const done = !!g.completedAt;
  const auto = isAuto(g);
  const src = auto ? sourceOf(g.source) : null;
  return (
    <Card style={{ padding: "15px 17px", borderColor: done ? `${GR}44` : `${a.color}26` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}>
        <span style={{ fontSize: 17 }}>{a.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{g.name}</div>
          <div style={{ fontSize: 10, color: T3, marginTop: 1 }}>
            {a.label}{left != null && !done && <> · <span style={{ color: left < 0 ? RE : left <= 7 ? AM : T3 }}>{left < 0 ? `${-left}d overdue` : left === 0 ? "due today" : `${left}d left`}</span></>}
            {done && <> · <span style={{ color: GR }}>completed {fmtDate(g.completedAt)}</span></>}
          </div>
        </div>
        {!done && (
          <button onClick={() => onEdit(g)} aria-label={`Edit ${g.name}`} style={{ background: "none", border: "none", color: T3, cursor: "pointer", padding: 4 }}>
            <Pencil size={13} />
          </button>
        )}
        <button onClick={() => onArchive(g.id)} aria-label={`Archive ${g.name}`} style={{ background: "none", border: "none", color: T3, cursor: "pointer", padding: 4 }}>
          <Archive size={13} />
        </button>
      </div>

      {/* progress bar with checkpoint ticks */}
      <div style={{ position: "relative", marginBottom: 7 }}>
        <Meter pct={pct} height={7} color={done ? GR : a.color} />
        {CHECKPOINTS.map((p) => (
          <span key={p} style={{ position: "absolute", left: `${p}%`, top: -2, width: 2, height: 11, borderRadius: 1, background: pct >= p ? (done ? GR : a.color) : BD, opacity: 0.9 }} />
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 11, color: T2, fontFamily: "monospace" }}>
          {g.current.toLocaleString()} / {g.target.toLocaleString()}{g.unit ? ` ${g.unit}` : ""} · <span style={{ color: done ? GR : a.color, fontWeight: 700 }}>{pct}%</span>
        </span>
        {!done && next && <span style={{ fontSize: 10, color: T3 }}>next checkpoint: {next.value.toLocaleString()}{g.unit ? ` ${g.unit}` : ""} ({next.pct}%)</span>}
      </div>

      {auto ? (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 10, padding: "5px 10px", background: `${JO}12`, border: `1px solid ${JO}33`, borderRadius: 8, fontSize: 10.5, color: T2 }}>
          <Link2 size={11} color={JO} /> Auto-tracked from {src ? `${src.icon} ${src.label.toLowerCase()}` : "a live count"}
        </div>
      ) : !done && (
        <div style={{ display: "flex", gap: 7, marginTop: 10 }}>
          {draft == null ? (
            <>
              <button onClick={() => onSet(g.id, g.current + 1)} aria-label={`Add 1 to ${g.name}`}
                style={{ padding: "7px 13px", background: `${a.color}16`, border: `1px solid ${a.color}44`, borderRadius: 9, color: T1, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                +1{g.unit ? ` ${g.unit}` : ""}
              </button>
              <button onClick={() => setDraft(String(g.current))} aria-label={`Update progress for ${g.name}`}
                style={{ padding: "7px 13px", background: GL, border: `1px solid ${BD}`, borderRadius: 9, color: T2, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>
                Update progress
              </button>
            </>
          ) : (
            <>
              <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} inputMode="decimal" aria-label={`New progress for ${g.name}`}
                onKeyDown={(e) => { if (e.key === "Enter" && Number.isFinite(+draft)) { onSet(g.id, +draft); setDraft(null); } if (e.key === "Escape") setDraft(null); }}
                style={{ width: 110, background: B2, border: `1px solid ${a.color}55`, borderRadius: 9, padding: "7px 10px", fontSize: 12, color: T1, outline: "none", fontFamily: "monospace" }} />
              <button onClick={() => { if (Number.isFinite(+draft)) onSet(g.id, +draft); setDraft(null); }} aria-label="Save progress"
                style={{ padding: "7px 12px", background: `${GR}16`, border: `1px solid ${GR}44`, borderRadius: 9, color: GR, cursor: "pointer", display: "flex", alignItems: "center" }}>
                <Check size={13} />
              </button>
            </>
          )}
        </div>
      )}
    </Card>
  );
}

// ── Hall of Fame ─────────────────────────────────────────────────────
function HallOfFame({ xp }) {
  const totalTiers = xp.journeys.reduce((s, j) => s + j.tiers.length, 0);
  const gotTiers = xp.journeys.reduce((s, j) => s + j.done, 0);
  const titleLadder = [...TITLES].reverse(); // Beginner → Legend
  const stats = [
    ["Habit completions", xp.stats.habitCompletions, GR], ["Best streak", `${xp.stats.bestStreak}d`, "#C9BB96"],
    ["Perfect days", xp.stats.perfectCount, AM], ["Days journaled", xp.stats.journalDays, CY],
    ["Workouts", xp.stats.workoutCount, "#6C8EB5"], ["Trades journaled", xp.stats.tradeCount, "#5E8A9C"],
    ["Reviews written", xp.stats.reviewCount, "#8B7CA0"], ["Clean days", xp.stats.cleanDays, "#6E8B74"],
    ["Days of meals logged", xp.stats.mealDays, "#8FA58E"], ["Books & courses", xp.stats.booksFinished, "#767FA6"],
    ["Church services", xp.stats.churchCount, "#B09A6F"], ["Goals completed", xp.stats.goalsDone, JO],
  ];
  return (
    <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 980 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: T1 }}>Hall of Fame</div>
        <div style={{ fontSize: 12.5, color: T3, marginTop: 2 }}>A lifetime of milestones — every one reached reveals the next. {gotTiers}/{totalTiers} claimed.</div>
      </div>

      {/* Level + title ladder */}
      <Card style={{ padding: "18px 20px", background: `linear-gradient(180deg,${JO}0C,transparent)` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <div style={{ textAlign: "center", minWidth: 80 }}>
            <div style={{ fontSize: 40, fontWeight: 900, color: JO, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1, textShadow: `0 0 26px ${JO}44` }}>{xp.level}</div>
            <div style={{ fontSize: 9, color: T3, letterSpacing: 2, marginTop: 4 }}>LEVEL</div>
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 7 }}>
              <span style={{ padding: "3px 12px", background: `${JO}18`, border: `1px solid ${JO}55`, borderRadius: 13, fontSize: 11.5, fontWeight: 700, color: "#C9BB96", letterSpacing: 1 }}>{xp.title}</span>
              <span style={{ fontSize: 11, color: T3 }}>{(xp.nextLevelXp - xp.total).toLocaleString()} XP to level {xp.level + 1}</span>
            </div>
            <Meter pct={xp.pctToNext} height={7} fill={`linear-gradient(90deg,${JO}77,${JO})`} glow={`${JO}55`} />
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
          {titleLadder.map(([lvl, t]) => {
            const got = xp.level >= lvl;
            const current = xp.title === t;
            return (
              <span key={t} style={{ padding: "4px 10px", borderRadius: 10, fontSize: 10, fontWeight: got ? 700 : 400, letterSpacing: 0.5, background: current ? `${JO}22` : got ? GL : "transparent", border: `1px solid ${current ? JO + "66" : got ? BD : BD + "66"}`, color: current ? "#C9BB96" : got ? T2 : T3, opacity: got ? 1 : 0.55 }}>
                {t} · L{lvl}
              </span>
            );
          })}
        </div>
      </Card>

      {/* Lifetime stats */}
      <Card style={{ padding: "16px 18px" }}>
        <SH title="Lifetime record" sub="The permanent numbers — everything you've ever logged" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
          {stats.map(([l, v, c]) => <Chip key={l} label={l} value={typeof v === "number" ? v.toLocaleString() : String(v)} color={c} />)}
        </div>
      </Card>

      {/* Journeys */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14 }}>
        {xp.journeys.map((j) => (
          <Card key={j.key} style={{ padding: "15px 17px", borderColor: j.done ? `${JO}30` : undefined }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
              <span style={{ fontSize: 17 }}>{j.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: T1 }}>{j.name}</div>
                <div style={{ fontSize: 10, color: T3 }}>{j.value.toLocaleString()} {j.unit}</div>
              </div>
              {j.rank && (
                <span style={{ padding: "3px 10px", borderRadius: 10, fontSize: 10, fontWeight: 700, background: `${JO}18`, border: `1px solid ${JO}55`, color: "#C9BB96", whiteSpace: "nowrap" }}>{j.rank}</span>
              )}
            </div>
            <Meter pct={j.pctToNext} height={5} color={JO} style={{ marginBottom: 7 }} />
            <div style={{ fontSize: 10.5, color: j.next ? T2 : GR, marginBottom: 9 }}>
              {j.next
                ? <>Next: <span style={{ color: "#C9BB96", fontWeight: 700 }}>{j.next.rank}</span> at {j.next.threshold.toLocaleString()} {j.unit} — {(j.next.threshold - j.value).toLocaleString()} to go</>
                : "Journey complete. Immortal. 👑"}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {j.tiers.map((t) => (
                <span key={t.id} title={t.got ? `${t.rank} — ${t.date ? fmtDate(t.date) : "earned"}` : `${t.rank} at ${t.threshold.toLocaleString()}`}
                  style={{ padding: "2px 8px", borderRadius: 8, fontSize: 9.5, fontFamily: "monospace", background: t.got ? `${JO}1C` : GL, border: `1px solid ${t.got ? JO + "55" : BD}`, color: t.got ? "#C9BB96" : T3, opacity: t.got ? 1 : 0.6 }}>
                  {t.threshold.toLocaleString()}
                </span>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Module shell ─────────────────────────────────────────────────────
export function JourneyModule({ xpInfo }) {
  const [tab, setTab] = useState("goals");
  const [rawGoals, setGoals, goalsLoaded] = useStorageState("goals", []);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const toast = useToast();

  const summary = useMemo(() => goalsSummary(rawGoals), [rawGoals]);
  const { active, completed, avgPct } = summary;

  const saveGoal = (draft) => {
    if (editing) {
      setGoals((prev) => updateGoal(prev, editing.id, draft));
      toast("Goal updated", { tone: "success" });
    } else {
      setGoals((prev) => [...sanitizeGoals(prev), newGoal(draft)]);
      toast("🎯 Goal created — checkpoints at 25 / 50 / 75 / 100%", { tone: "success" });
    }
    setFormOpen(false); setEditing(null);
  };
  const setProgress = (id, val) => {
    setGoals((prev) => {
      const next = setGoalProgress(prev, id, val);
      const g = next.find((x) => x.id === id);
      if (g?.completedAt && !sanitizeGoals(prev).find((x) => x.id === id)?.completedAt) {
        toast(`🏆 Goal completed: ${g.name}`, { tone: "success", duration: 6000 });
      }
      return next;
    });
  };
  const archive = (id) => {
    setGoals((prev) => updateGoal(prev, id, { archived: true }));
    toast("Goal archived", { action: "Undo", onAction: () => setGoals((prev) => updateGoal(prev, id, { archived: false })), tone: "danger" });
  };

  if (!goalsLoaded) return <Hydrating label="Loading your journey…" />;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ModuleTabs tint="rgba(10,9,6,0.5)" activeBg={`${JO}26`} activeColor="#C9BB96"
        tabs={[{ id: "goals", l: "Goals", i: Target }, { id: "fame", l: "Hall of Fame", i: Trophy }]}
        active={tab} onSelect={setTab} />

      <div style={{ flex: 1, overflowY: "auto" }}>
        {tab === "fame" && <HallOfFame xp={xpInfo} />}

        {tab === "goals" && (
          <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 980 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: T1 }}>Goals</div>
                <div style={{ fontSize: 12.5, color: T3, marginTop: 2 }}>Every area of life. Checkpoints and completions pay XP and feed the Hall of Fame.</div>
              </div>
              {!formOpen && (
                <button onClick={() => { setEditing(null); setFormOpen(true); }}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: `${JO}1E`, border: `1px solid ${JO}55`, borderRadius: 10, color: "#C9BB96", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  <Plus size={14} /> New goal
                </button>
              )}
            </div>

            {active.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10 }}>
                <Chip label="Active goals" value={String(active.length)} color={JO} />
                <Chip label="Avg progress" value={`${avgPct}%`} color={CY} />
                <Chip label="Completed" value={String(Math.max(completed.length, xpInfo.stats.goalsDone))} color={GR} />
              </div>
            )}

            {formOpen && <GoalForm initial={editing} stats={xpInfo.stats} onSave={saveGoal} onCancel={() => { setFormOpen(false); setEditing(null); }} />}

            {active.length === 0 && !formOpen ? (
              <Empty icon={<Target size={26} color={JO} />} title="No active goals"
                sub="Set a target in any area — fitness, trading, faith, reading, anything. Progress checkpoints reveal themselves as you move.">
                <button onClick={() => setFormOpen(true)}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 18px", background: `${JO}1E`, border: `1px solid ${JO}55`, borderRadius: 10, color: "#C9BB96", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: 10 }}>
                  <Plus size={14} /> Create your first goal
                </button>
              </Empty>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12 }}>
                {active.map((g) => (
                  <GoalCard key={g.id} g={g} onSet={setProgress} onArchive={archive}
                    onEdit={(goal) => { setEditing(goal); setFormOpen(true); }} />
                ))}
              </div>
            )}

            {completed.length > 0 && (
              <Collapse id="journey_completed" title="Completed" count={completed.length} defaultOpen={false}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 12 }}>
                  {completed.map((g) => (
                    <GoalCard key={g.id} g={g} onSet={setProgress} onArchive={archive} onEdit={() => {}} />
                  ))}
                </div>
              </Collapse>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
