// ── Faith OS (Kaizen phase 8) ────────────────────────────────────────
// Long-term spiritual consistency over daily streaks: monthly grids for
// spiritual habits, spaced scripture review, church attendance, and
// devotional notes. Spiritual habits live in the global habit engine
// (category "Spiritual"), so Life OS, the Command Center and this module
// all see the same records.
import { useMemo, useState } from "react";
import { BookOpen, Plus, Check, Trash2, Pencil, Church as ChurchIcon, Sparkles, ScrollText } from "lucide-react";
import { B2, BD, BD2, T1, T2, T3, GL, GR, RE, AM, PU, CY } from "../../shared/designTokens.js";
import { Card, SH, Chip, Hydrating } from "../../shared/ui.jsx";
import { ModuleTabs } from "../../shared/ModuleTabs.jsx";
import { DatePicker, relativeDateLabel } from "../../shared/DatePicker.jsx";
import { useStorageState } from "../../shared/useStorageState.js";
import { useToast } from "../../shared/toast.jsx";
import { localDateStr, daysAgoStr, daysBetween } from "../../shared/dates.js";
import { isScheduled, isDone, tapHabit, rangeStats, currentStreak, totalCompletions, newHabit } from "../../shared/habitEngine.js";

const FA = CY; // Nocturne cyan accent (monochrome theme)

// Spaced review: due after 1, 3, 7, 14, 30 then every 60 days.
const INTERVALS = [1, 3, 7, 14, 30, 60];
const nextInterval = (reviews) => INTERVALS[Math.min(reviews, INTERVALS.length - 1)];
const daysSince = (ds) => (ds ? daysBetween(ds, localDateStr()) : Infinity);
const isDue = (v) => daysSince(v.lastReviewed || v.addedAt) >= nextInterval(v.reviews || 0);

// 12-week consistency grid for one habit (weeks as columns, Sun→Sat rows).
function MonthGrid({ habit }) {
  const cells = [];
  for (let w = 11; w >= 0; w--) {
    const col = [];
    for (let d = 6; d >= 0; d--) {
      const offset = w * 7 + d;
      const ds = daysAgoStr(offset);
      col.push({ ds, sched: isScheduled(habit, ds), done: isDone(habit, ds), future: false });
    }
    cells.push(col);
  }
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {cells.map((col, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {col.map((c) => (
            <div key={c.ds} title={c.ds}
              style={{ width: 9, height: 9, borderRadius: 2.5, background: c.done ? FA : c.sched ? `${FA}22` : BD }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function FaithCore({ habits, setHabits, loaded = true }) {
  const [tab, setTab] = useState("walk");
  const [verses, setVerses] = useStorageState("faith_scripture", []);
  const [church, setChurch] = useStorageState("faith_church", []);
  const [notes, setNotes] = useStorageState("faith_notes", []);
  const [verseDraft, setVerseDraft] = useState(null); // { ref, text }
  const [noteDraft, setNoteDraft] = useState("");
  const [noteRef, setNoteRef] = useState("");
  const [noteDs, setNoteDs] = useState(localDateStr());
  const [editingNoteId, setEditingNoteId] = useState(null);
  const toast = useToast();
  const ds = localDateStr();

  const spiritual = useMemo(
    () => habits.filter((h) => h && !h.archived && !h.paused && h.category === "Spiritual"),
    [habits]
  );
  const versesSafe = useMemo(() => (Array.isArray(verses) ? verses : []).filter((v) => v && v.id), [verses]);
  const churchSafe = useMemo(() => (Array.isArray(church) ? church : []).filter((d) => typeof d === "string"), [church]);
  const notesSafe = useMemo(() => (Array.isArray(notes) ? notes : []).filter((n) => n && n.id)
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))), [notes]);

  const due = versesSafe.filter(isDue);
  const stats90 = spiritual.map((h) => rangeStats(h, 90));
  const pct90 = stats90.length
    ? Math.round((stats90.reduce((s, x) => s + x.done, 0) / Math.max(1, stats90.reduce((s, x) => s + x.scheduled, 0))) * 100)
    : 0;
  const totalSessions = spiritual.reduce((s, h) => s + totalCompletions(h), 0);

  // This Sunday (or today if Sunday) — the attendance unit.
  const lastSunday = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay()); return localDateStr(d); })();
  const attendedThisWeek = churchSafe.includes(lastSunday);
  const toggleChurch = () => {
    setChurch((prev) => {
      const list = (Array.isArray(prev) ? prev : []).filter((d) => typeof d === "string");
      return list.includes(lastSunday) ? list.filter((d) => d !== lastSunday) : [...list, lastSunday].sort();
    });
    if (!attendedThisWeek) toast("Church attendance logged ⛪", { tone: "success" });
  };

  const addSpiritualHabit = () => {
    setHabits((prev) => [...prev, newHabit({ name: "Prayer", icon: "🙏", color: FA, category: "Spiritual", pillar: "nonneg" })]);
    toast("Prayer habit added — edit it in Life OS → Habits", { tone: "success" });
  };

  const saveVerse = () => {
    if (!verseDraft?.ref?.trim()) return;
    setVerses((prev) => [
      { id: `v${Date.now().toString(36)}`, ref: verseDraft.ref.trim(), text: (verseDraft.text || "").trim(), addedAt: ds, lastReviewed: null, reviews: 0 },
      ...(Array.isArray(prev) ? prev : []),
    ]);
    setVerseDraft(null);
    toast("Verse added — first review due tomorrow 📖", { tone: "success" });
  };
  const reviewVerse = (id) => {
    setVerses((prev) => (Array.isArray(prev) ? prev : []).map((v) =>
      v?.id === id ? { ...v, lastReviewed: ds, reviews: (v.reviews || 0) + 1 } : v
    ));
  };
  const deleteVerse = (v) => {
    setVerses((prev) => (Array.isArray(prev) ? prev : []).filter((x) => x?.id !== v.id));
    toast(`"${v.ref}" removed`, { action: "Undo", onAction: () => setVerses((p) => [v, ...(Array.isArray(p) ? p : [])]), tone: "danger" });
  };

  const saveNote = () => {
    if (!noteDraft.trim()) return;
    if (editingNoteId) {
      setNotes((prev) => (Array.isArray(prev) ? prev : []).map((n) =>
        n?.id === editingNoteId ? { ...n, date: noteDs, ref: noteRef.trim(), text: noteDraft.trim(), editedAt: new Date().toISOString() } : n));
      toast("Devotional note updated ✍️", { tone: "success" });
    } else {
      setNotes((prev) => [
        { id: `fn${Date.now().toString(36)}`, date: noteDs, ref: noteRef.trim(), text: noteDraft.trim(), editedAt: null },
        ...(Array.isArray(prev) ? prev : []),
      ]);
      toast("Devotional note saved 🌱", { tone: "success" });
    }
    setNoteDraft(""); setNoteRef(""); setNoteDs(localDateStr()); setEditingNoteId(null);
  };
  const startEditNote = (n) => { setEditingNoteId(n.id); setNoteDraft(n.text || ""); setNoteRef(n.ref || ""); setNoteDs((n.date || "").slice(0, 10) || localDateStr()); };
  const cancelEditNote = () => { setEditingNoteId(null); setNoteDraft(""); setNoteRef(""); setNoteDs(localDateStr()); };
  const deleteNote = (n) => {
    setNotes((prev) => (Array.isArray(prev) ? prev : []).filter((x) => x?.id !== n.id));
    if (editingNoteId === n.id) cancelEditNote();
    toast("Note removed", { action: "Undo", onAction: () => setNotes((p) => [n, ...(Array.isArray(p) ? p : [])]), tone: "danger" });
  };

  const TABS = [
    { id: "walk",      l: "The Walk",  i: Sparkles },
    { id: "scripture", l: "Scripture", i: ScrollText },
    { id: "notes",     l: "Devotional", i: BookOpen },
  ];
  const input = { background: B2, border: `1px solid ${BD}`, borderRadius: 9, padding: "9px 12px", fontSize: 12.5, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ModuleTabs tint="rgba(10,10,10,0.6)" activeBg={`${FA}22`} activeColor={FA} tabs={TABS} active={tab} onSelect={setTab}>
        <div style={{ flex: 1 }} />
        {due.length > 0 && (
          <button onClick={() => setTab("scripture")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", background: `${AM}14`, border: `1px solid ${AM}44`, borderRadius: 9, color: AM, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            📖 {due.length} verse{due.length > 1 ? "s" : ""} due for review
          </button>
        )}
      </ModuleTabs>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {!loaded && <Hydrating label="Opening Faith OS…" />}

        {/* ══ THE WALK ══ */}
        {loaded && tab === "walk" && (
          <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 11 }}>
              <Chip label="90-day consistency" value={`${pct90}%`} color={FA} />
              <Chip label="Total sessions"     value={totalSessions.toLocaleString()} color={GR} />
              <Chip label="Verses memorising"  value={versesSafe.length} color={PU} />
              <Chip label="Sundays attended"   value={churchSafe.length} color={CY} />
            </div>

            <Card style={{ padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: `${FA}18`, border: `1px solid ${FA}44`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ChurchIcon size={17} color={FA} />
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: T1 }}>Church this week</div>
                <div style={{ fontSize: 11.5, color: T3, marginTop: 2 }}>Sunday {lastSunday.slice(5)} · faithfulness over the long haul</div>
              </div>
              <button onClick={toggleChurch}
                style={{ padding: "9px 16px", background: attendedThisWeek ? `${GR}18` : `${FA}14`, border: `1px solid ${attendedThisWeek ? GR + "55" : FA + "44"}`, borderRadius: 10, color: attendedThisWeek ? GR : FA, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
                {attendedThisWeek ? <><Check size={13} />Attended</> : "Log attendance"}
              </button>
            </Card>

            {spiritual.length === 0 ? (
              <Card style={{ padding: "34px", textAlign: "center" }}>
                <div style={{ fontSize: 26, marginBottom: 10 }}>🙏</div>
                <div style={{ fontSize: 13.5, color: T2, marginBottom: 6 }}>No spiritual habits yet</div>
                <div style={{ fontSize: 12, color: T3, marginBottom: 14 }}>Prayer, Bible study and devotion live in the habit engine — tracked here over months, not just streaks.</div>
                <button onClick={addSpiritualHabit} style={{ padding: "9px 18px", background: `${FA}18`, border: `1px solid ${FA}44`, borderRadius: 10, color: FA, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  <Plus size={12} style={{ verticalAlign: -2 }} /> Add a Prayer habit
                </button>
              </Card>
            ) : spiritual.map((h) => {
              const s90 = rangeStats(h, 90), s30 = rangeStats(h, 30);
              return (
                <Card key={h.id} style={{ padding: "16px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 12, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 18 }}>{h.icon}</span>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: T1 }}>{h.name}</div>
                      <div style={{ fontSize: 10.5, color: T3, marginTop: 2 }}>
                        {s30.pct}% last 30d · {s90.pct}% last 90d · 🔥 {currentStreak(h)}d
                      </div>
                    </div>
                    {!isDone(h, ds) && isScheduled(h, ds) && (
                      <button onClick={() => setHabits((prev) => tapHabit(prev, h.id))}
                        style={{ padding: "7px 14px", background: `${FA}14`, border: `1px solid ${FA}44`, borderRadius: 9, color: FA, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        Complete today
                      </button>
                    )}
                    {isDone(h, ds) && <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: GR, fontWeight: 700 }}><Check size={13} />Today ✓</span>}
                  </div>
                  <div style={{ overflowX: "auto", paddingBottom: 2 }}>
                    <MonthGrid habit={h} />
                  </div>
                  <div style={{ fontSize: 9.5, color: T3, marginTop: 7 }}>Last 12 weeks — each column is a week</div>
                </Card>
              );
            })}
          </div>
        )}

        {/* ══ SCRIPTURE MEMORY ══ */}
        {loaded && tab === "scripture" && (
          <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: T1 }}>Scripture Memory</div>
                <div style={{ fontSize: 12, color: T3, marginTop: 2 }}>Spaced review: 1 → 3 → 7 → 14 → 30 → 60 days. {due.length ? `${due.length} due now.` : "Nothing due — well kept."}</div>
              </div>
              {!verseDraft && (
                <button onClick={() => setVerseDraft({ ref: "", text: "" })} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 15px", background: `${FA}18`, border: `1px solid ${FA}44`, borderRadius: 10, color: FA, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  <Plus size={13} />Add verse
                </button>
              )}
            </div>

            {verseDraft && (
              <Card style={{ padding: "16px", borderColor: `${FA}44` }}>
                <input autoFocus value={verseDraft.ref} onChange={(e) => setVerseDraft((d) => ({ ...d, ref: e.target.value }))}
                  placeholder="Reference — e.g. Philippians 4:6-7" style={{ ...input, width: "100%", marginBottom: 8 }} />
                <textarea value={verseDraft.text} onChange={(e) => setVerseDraft((d) => ({ ...d, text: e.target.value }))}
                  placeholder="The verse text (optional — recall from reference alone is stronger)"
                  style={{ ...input, width: "100%", minHeight: 70, resize: "none", lineHeight: 1.6, marginBottom: 10 }} />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => setVerseDraft(null)} style={{ padding: "8px 14px", background: GL, border: `1px solid ${BD}`, borderRadius: 9, color: T2, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                  <button onClick={saveVerse} disabled={!verseDraft.ref.trim()}
                    style={{ padding: "8px 16px", background: verseDraft.ref.trim() ? `${FA}22` : GL, border: `1px solid ${verseDraft.ref.trim() ? FA + "55" : BD}`, borderRadius: 9, color: verseDraft.ref.trim() ? FA : T3, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Save verse</button>
                </div>
              </Card>
            )}

            {versesSafe.length === 0 && !verseDraft && (
              <Card style={{ padding: "34px", textAlign: "center" }}>
                <div style={{ fontSize: 26, marginBottom: 10 }}>📖</div>
                <div style={{ fontSize: 13, color: T2 }}>No verses yet — add one and the system will schedule every review for you.</div>
              </Card>
            )}

            {[...versesSafe].sort((a, b) => (isDue(b) ? 1 : 0) - (isDue(a) ? 1 : 0)).map((v) => {
              const dueNow = isDue(v);
              const nextIn = Math.max(0, nextInterval(v.reviews || 0) - daysSince(v.lastReviewed || v.addedAt));
              return (
                <Card key={v.id} style={{ padding: "14px 16px", borderColor: dueNow ? `${AM}44` : undefined }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: T1 }}>{v.ref}</div>
                      {v.text && <div style={{ fontSize: 12, color: T2, lineHeight: 1.65, marginTop: 5, fontStyle: "italic" }}>"{v.text}"</div>}
                      <div style={{ fontSize: 10.5, color: dueNow ? AM : T3, marginTop: 6, fontWeight: dueNow ? 700 : 400 }}>
                        {dueNow ? "Review due — recite it from memory, then mark reviewed" : `Next review in ${nextIn}d`} · {v.reviews || 0} review{(v.reviews || 0) === 1 ? "" : "s"}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                      {dueNow && (
                        <button onClick={() => reviewVerse(v.id)} style={{ padding: "7px 13px", background: `${GR}14`, border: `1px solid ${GR}44`, borderRadius: 9, color: GR, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                          Reviewed ✓
                        </button>
                      )}
                      <button onClick={() => deleteVerse(v)} aria-label={`Delete ${v.ref}`} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: RE, display: "flex" }}><Trash2 size={12} /></button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* ══ DEVOTIONAL NOTES ══ */}
        {loaded && tab === "notes" && (
          <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
            <Card style={{ padding: "16px 18px" }}>
              <SH title={editingNoteId ? "Edit Devotional Note" : "Devotional Note"} sub={relativeDateLabel(noteDs)} />
              <div style={{ marginBottom: 9 }}><DatePicker value={noteDs} onChange={setNoteDs} /></div>
              <input value={noteRef} onChange={(e) => setNoteRef(e.target.value)} placeholder="Passage (optional) — e.g. Psalm 23" style={{ ...input, width: "100%", marginBottom: 8 }} />
              <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="What is God teaching you today?"
                style={{ ...input, width: "100%", minHeight: 90, resize: "none", lineHeight: 1.7, marginBottom: 9 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={saveNote} disabled={!noteDraft.trim()}
                  style={{ flex: 1, padding: "9px", background: noteDraft.trim() ? `${FA}14` : GL, border: `1px solid ${noteDraft.trim() ? FA + "44" : BD}`, borderRadius: 10, color: noteDraft.trim() ? FA : T3, fontSize: 12, fontWeight: 700, cursor: noteDraft.trim() ? "pointer" : "default", fontFamily: "inherit" }}>
                  {editingNoteId ? "Update note" : "Save note"}
                </button>
                {editingNoteId && (
                  <button onClick={cancelEditNote} style={{ padding: "9px 16px", background: GL, border: `1px solid ${BD}`, borderRadius: 10, color: T2, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                )}
              </div>
            </Card>
            {notesSafe.map((n) => (
              <div key={n.id} style={{ padding: "12px 14px", background: GL, borderRadius: 11, border: `1px solid ${n.id === editingNoteId ? FA + "55" : BD}`, display: "flex", gap: 9 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: T3, marginBottom: 4 }}>
                    {relativeDateLabel((n.date || "").slice(0, 10) || ds)}{n.ref ? ` · ${n.ref}` : ""}{n.editedAt && <span style={{ opacity: 0.7 }}> · edited</span>}
                  </div>
                  <div style={{ fontSize: 12.5, color: T2, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{n.text}</div>
                </div>
                <button onClick={() => startEditNote(n)} aria-label="Edit note" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex", alignSelf: "flex-start", padding: 2 }}><Pencil size={11} /></button>
                <button onClick={() => deleteNote(n)} aria-label="Delete note" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex", alignSelf: "flex-start", padding: 2 }}><Trash2 size={11} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
