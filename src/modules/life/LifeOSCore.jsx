import { useMemo, useState, useEffect } from "react";
import { BookOpen, ShieldCheck, PenLine, Files, Sparkles } from "lucide-react";
import { B2, BD, T1, T2, T3, GL, CY, PU, GR, RE, AC, AM } from "../../shared/designTokens.js";
import { Card, SH } from "../../shared/ui.jsx";
import { DatePicker, relativeDateLabel } from "../../shared/DatePicker.jsx";
import { useStorageState } from "../../shared/useStorageState.js";
import { useToast } from "../../shared/toast.jsx";
import { localDateStr } from "../../shared/dates.js";
import { ModuleTabs } from "../../shared/ModuleTabs.jsx";
import { REFLECTION_PROMPTS } from "../../shared/kaizen.js";
import { PurityTab } from "./PurityTab.jsx";
import { Journals } from "./Journals.jsx";
import { ModeHistoryStrip } from "../../shared/ModeHistoryStrip.jsx";
import { useFocusRequest } from "../../shared/searchFocus.js";
import { habitSummary } from "../habits/summary.js";
import { sanitizeNutrition, dayEntries } from "../athlete/nutrition.js";
import { MOODS, JOURNAL_TAGS, writingStats, journalPatterns } from "./journalMeta.js";

const today = () => localDateStr();

export function LifeOSCore() {
  const [tab, setTab] = useState("journal");
  const [jtab, setJtab] = useState("write"); // write | entries | patterns
  const focus = useFocusRequest();
  useEffect(() => {
    if (focus?.module === "life" && (focus.tab === "journal" || focus.tab === "purity")) setTab(focus.tab);
  }, [focus?.nonce]); // eslint-disable-line

  const [journal, setJournal] = useState("");
  const [journalTitle, setJournalTitle] = useState("");
  const [journalDs, setJournalDs] = useState(() => today());
  const [mood, setMood] = useState(null);
  const [tags, setTags] = useState([]);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [rawEntries, setEntries] = useStorageState("journal_entries", []);
  // Stores for the auto-stamp: the day's God-Mode score + habits.
  const [htHabits] = useStorageState("ht_habits", []);
  const [htEntries] = useStorageState("ht_entries", []);
  const [nutritionLog] = useStorageState("nutrition_log", {});
  const toast = useToast();

  const entries = useMemo(
    () => (Array.isArray(rawEntries) ? rawEntries : [])
      .filter((e) => e && typeof e === "object" && e.id)
      .slice()
      .sort((a, b) => ((b.date || "").slice(0, 10)).localeCompare((a.date || "").slice(0, 10))),
    [rawEntries]
  );
  const hsum = useMemo(() => habitSummary(htHabits, htEntries, today()), [htHabits, htEntries]);
  const nutrition = useMemo(() => sanitizeNutrition(nutritionLog), [nutritionLog]);
  const ws = useMemo(() => writingStats(entries, today()), [entries]);
  const patterns = useMemo(() => journalPatterns(entries, today()), [entries]);

  // The day's state, stamped onto an entry so mood becomes correlatable. GM is
  // the same daily composite the dashboard shows (habits · meals · journaled),
  // computed with journaled forced true because this very entry is the proof.
  const snapshot = (ds) => {
    const parts = [];
    const hr = hsum.ratioOn(ds); if (hr != null) parts.push(hr);
    parts.push(dayEntries(nutrition, ds).length > 0 ? 1 : 0);
    parts.push(1);
    const gm = Math.round((parts.reduce((s, x) => s + x, 0) / parts.length) * 100);
    const c = hsum.countsOn(ds);
    return { gm, habits: c.scheduled ? `${c.done}/${c.scheduled}` : null, streak: hsum.streaks[0]?.days || 0 };
  };
  const snap = snapshot(journalDs);

  const resetForm = () => { setEditingEntryId(null); setJournalDs(today()); setJournal(""); setJournalTitle(""); setMood(null); setTags([]); };
  const saveEntry = () => {
    if (!journal.trim()) return;
    const title = journalTitle.trim();
    const stamp = snapshot(journalDs);
    if (editingEntryId) {
      setEntries((prev) => (Array.isArray(prev) ? prev : []).map((e) =>
        e?.id === editingEntryId ? { ...e, date: journalDs, title, text: journal, mood, tags, gm: stamp.gm, habits: stamp.habits, streak: stamp.streak, editedAt: new Date().toISOString() } : e));
      toast("Reflection updated ✍️", { tone: "success", duration: 2500 });
    } else {
      setEntries((prev) => [{ id: `j${Date.now()}`, date: journalDs, title, text: journal, mood, tags, gm: stamp.gm, habits: stamp.habits, streak: stamp.streak }, ...prev]);
      toast("Reflection saved 🌱", { tone: "success", duration: 2500 });
    }
    resetForm();
  };
  const startEditEntry = (e) => {
    setEditingEntryId(e.id);
    setJournalTitle(e.title || "");
    setJournal(e.text || "");
    setJournalDs((e.date || today()).slice(0, 10));
    setMood(e.mood || null);
    setTags(Array.isArray(e.tags) ? e.tags : []);
    setJtab("write");
  };
  const cancelEditEntry = () => resetForm();
  const deleteEntry = (id) => {
    const entry = entries.find((e) => e.id === id);
    if (id === editingEntryId) cancelEditEntry();
    setEntries((prev) => prev.filter((e) => e.id !== id));
    toast("Entry deleted", { action: "Undo", onAction: () => setEntries((prev) => [entry, ...prev]), tone: "danger" });
  };
  const toggleTag = (t) => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const TABS = [
    { id: "journal", l: "Journal", i: BookOpen },
    { id: "purity", l: "Purity", i: ShieldCheck },
  ];
  const JTABS = [
    { id: "write", l: "Write", i: PenLine },
    { id: "entries", l: "Entries", i: Files },
    { id: "patterns", l: "Patterns", i: Sparkles },
  ];

  const pill = (on, tone) => ({
    padding: "6px 12px", borderRadius: 20, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit",
    border: `1px solid ${on ? (tone || CY) + "66" : BD}`, background: on ? (tone || CY) + "18" : GL, color: on ? (tone || CY) : T3,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ModuleTabs tabs={TABS} active={tab} onSelect={setTab} activeBg={`linear-gradient(135deg,${CY}22,${CY}18)`} activeColor={CY} />

      <div style={{ flex: 1, overflowY: "auto" }}>
        {tab === "journal" && (
          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 720 }}>
            <div style={{ fontSize: 11, color: T2 }}>
              {ws.monthCount} {ws.monthCount === 1 ? "entry" : "entries"} this month · {ws.streak}-day writing streak
            </div>

            {/* inner tabs */}
            <div style={{ display: "flex", gap: 6 }}>
              {JTABS.map((t) => {
                const on = jtab === t.id;
                const Icon = t.i;
                return (
                  <button key={t.id} onClick={() => setJtab(t.id)}
                    style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 10, fontSize: 12, fontWeight: on ? 600 : 500, cursor: "pointer", fontFamily: "inherit",
                      border: `1px solid ${on ? AC + "55" : "transparent"}`, background: on ? `${AC}18` : "transparent", color: on ? AC : T2 }}>
                    <Icon size={13} />{t.l}
                  </button>
                );
              })}
            </div>

            {jtab === "write" && (
              <Card style={{ padding: "18px 20px" }}>
                <SH title={editingEntryId ? "Edit reflection" : "Today"} sub="Reflect to learn, not to judge. One honest sentence is enough." />
                <DatePicker value={journalDs} onChange={setJournalDs} />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "11px 0" }}>
                  {REFLECTION_PROMPTS.map((p) => (
                    <button key={p} onClick={() => setJournal((j) => (j ? `${j}\n\n${p}\n` : `${p}\n`))}
                      style={{ padding: "5px 11px", borderRadius: 20, border: `1px solid ${AC}33`, background: `${AC}12`, color: AC, fontSize: 11, cursor: "pointer", fontFamily: "inherit", lineHeight: 1.4, textAlign: "left" }}>
                      {p}
                    </button>
                  ))}
                </div>
                <input value={journalTitle} onChange={(e) => setJournalTitle(e.target.value)} placeholder="Title (optional)"
                  style={{ width: "100%", background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: "10px 13px", fontSize: 14, fontWeight: 700, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 8 }} />
                <textarea value={journal} onChange={(e) => setJournal(e.target.value)} placeholder="Write…"
                  style={{ width: "100%", minHeight: 100, background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: "11px 13px", fontSize: 13, color: T1, lineHeight: 1.7, resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />

                <div style={{ fontSize: 9, color: T3, letterSpacing: 0.7, textTransform: "uppercase", margin: "12px 0 6px" }}>State today</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {MOODS.map((m) => (
                    <button key={m.id} onClick={() => setMood(mood === m.id ? null : m.id)}
                      style={pill(mood === m.id, m.tone === "up" ? GR : m.tone === "dn" ? RE : CY)}>{m.label}</button>
                  ))}
                </div>

                <div style={{ fontSize: 9, color: T3, letterSpacing: 0.7, textTransform: "uppercase", margin: "12px 0 6px" }}>Tag</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {JOURNAL_TAGS.map((t) => (
                    <button key={t} onClick={() => toggleTag(t)} style={pill(tags.includes(t), AC)}>{t}</button>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                  <button onClick={saveEntry} disabled={!journal.trim()}
                    style={{ flex: 1, padding: "10px", background: journal.trim() ? `${AC}18` : GL, border: `1px solid ${journal.trim() ? AC + "55" : BD}`, borderRadius: 10, color: journal.trim() ? AC : T3, fontSize: 12.5, fontWeight: 700, cursor: journal.trim() ? "pointer" : "default", fontFamily: "inherit" }}>
                    {editingEntryId ? "Update entry" : "Save entry"}
                  </button>
                  {editingEntryId && (
                    <button onClick={cancelEditEntry} style={{ padding: "10px 16px", background: GL, border: `1px solid ${BD}`, borderRadius: 10, color: T2, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                  )}
                </div>
                <div style={{ textAlign: "center", fontSize: 10, color: T3, marginTop: 8 }}>
                  Auto-stamps GM {snap.gm}{snap.streak ? ` · streak ${snap.streak}` : ""}{snap.habits ? ` · ${snap.habits} habits` : ""}
                </div>
              </Card>
            )}

            {jtab === "entries" && (
              <>
                <Journals entries={entries} editingEntryId={editingEntryId} onEdit={startEditEntry} onDelete={deleteEntry}
                  relativeDateLabel={relativeDateLabel} today={today} onExport={(f) => toast(`Exported ${f.label}`, { tone: "success" })} />
                <ModeHistoryStrip />
              </>
            )}

            {jtab === "patterns" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {patterns.withMood < 2 ? (
                  <Card style={{ padding: "16px 18px" }}>
                    <div style={{ fontSize: 12.5, color: T2, lineHeight: 1.6 }}>Tag a few entries' mood as you write and the patterns fill in — how each mood tracks your God-Mode score, and whether the pen comes back faster after a gap.</div>
                  </Card>
                ) : (
                  <>
                    {Number.isFinite(patterns.moodAvg.drained) && Number.isFinite(patterns.moodAvg.sharp) && (
                      <InsightCard tone={RE} title="Mood tracks the day, not the other way around"
                        body={<><b>Drained days average GM {patterns.moodAvg.drained}</b> · Sharp days average {patterns.moodAvg.sharp}. The gap is real — the low-mood days really were the low-score days.</>} />
                    )}
                    {patterns.withMood >= 3 && patterns.hard / Math.max(1, patterns.withMood) >= 0.5 && (
                      <InsightCard tone={AM} title="You write most on hard days"
                        body={<><b>{patterns.hard} of {patterns.withMood}</b> tagged entries were Drained or Flat. Worth writing on good days too, so the record isn't only the losses.</>} />
                    )}
                    {patterns.maxGapEver > patterns.recentMaxGap && patterns.recentMaxGap >= 0 && (
                      <InsightCard tone={GR} title="Longest gap is closing"
                        body={<>Your longest silence was <b>{patterns.maxGapEver} days</b>; lately the biggest gap is <b>{patterns.recentMaxGap} day{patterns.recentMaxGap === 1 ? "" : "s"}</b>. The pen comes back faster than it used to.</>} />
                    )}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                      {MOODS.filter((m) => Number.isFinite(patterns.moodAvg[m.id])).map((m) => (
                        <span key={m.id} style={{ fontSize: 11, padding: "6px 11px", borderRadius: 12, background: GL, border: `1px solid ${BD}`, color: T2 }}>
                          {m.label} <b style={{ color: AC }}>GM {patterns.moodAvg[m.id]}</b>
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {tab === "purity" && <PurityTab />}
      </div>
    </div>
  );
}

function InsightCard({ tone, title, body }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", background: B2, border: `1px solid ${BD}`, borderRadius: 12, padding: "13px 15px 13px 17px" }}>
      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: tone }} />
      <div style={{ fontSize: 12.5, fontWeight: 700, color: T1, marginBottom: 5 }}>{title}</div>
      <div style={{ fontSize: 11.5, color: T2, lineHeight: 1.6 }}>{body}</div>
    </div>
  );
}
