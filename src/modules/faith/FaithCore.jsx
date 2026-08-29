// ── Faith OS (Kaizen phase 8) ────────────────────────────────────────
// Long-term spiritual consistency over daily streaks: monthly grids for
// spiritual habits, spaced scripture review, church attendance, and
// devotional notes. Spiritual habits live in the global habit engine
// (category "Spiritual"), so Life OS, the Command Center and this module
// all see the same records.
import { useMemo, useState } from "react";
import { Plus, Check, Trash2, Pencil, Eye, Sparkles, ScrollText } from "lucide-react";
import { B2, BD, BD2, T1, T2, T3, GL, GR, RE, AM, PU, CY } from "../../shared/designTokens.js";
import { Card, SH, Chip, Hydrating } from "../../shared/ui.jsx";
import { ModuleTabs } from "../../shared/ModuleTabs.jsx";
import { DatePicker, relativeDateLabel } from "../../shared/DatePicker.jsx";
import { useStorageState } from "../../shared/useStorageState.js";
import { useToast } from "../../shared/toast.jsx";
import { db as habitDb } from "../habits/localDb.js";
import { buildActivityFeed, summarise, windowOf, isDone as activityDone } from "../../shared/activity.js";
import { localDateStr, daysAgoStr, daysBetween } from "../../shared/dates.js";
import { isScheduled, isDone, tapHabit, rangeStats, currentStreak } from "../../shared/habitEngine.js";

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

// Which habit names count as spiritual practice. Name matching is imperfect,
// so it is used only to SHOW a habit here — never to move or duplicate it.
const PRAYER_RE = /\bpray|\bprayer\b|\bdevotion/i;
const SPIRITUAL_RE = /\bpray|\bprayer\b|\bdevotion|\bscripture\b|\bbible\b|\bworship\b|\bfast(ing)?\b|\bchurch\b/i;

export function FaithCore({ habits, setHabits, loaded = true }) {
  const [tab, setTab] = useState("walk");
  const [verses, setVerses] = useStorageState("faith_scripture", []);
  const [notes, setNotes] = useStorageState("faith_notes", []);
  const [noteDraft, setNoteDraft] = useState("");
  const [noteRef, setNoteRef] = useState("");
  const [noteDs, setNoteDs] = useState(localDateStr());
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [memorize, setMemorize] = useState(false); // composer: also commit this passage to Scripture memory
  const [verseText, setVerseText] = useState("");   // composer: verse text when memorizing
  const toast = useToast();
  const ds = localDateStr();

  // Faith reads the activity feed rather than keeping its own record of what
  // was prayed or read. One action, many views: a Prayer habit ticked in the
  // tracker IS the prayer, and it shows here, on the Calendar and in the
  // Record without any of them writing a second copy (§5, §10).
  const [htHabits] = useStorageState("ht_habits", []);
  const [htEntries] = useStorageState("ht_entries", []);
  const [church] = useStorageState("faith_church", []);
  const feed = useMemo(
    () => buildActivityFeed({ htHabits, htEntries, church, verses, faithNotes: notes })
      .filter((a) => a.category === "faith" || (a.type === "habit" && SPIRITUAL_RE.test(a.label))),
    [htHabits, htEntries, church, verses, notes],
  );
  const walk30 = useMemo(() => {
    const rows = windowOf(feed, 30, ds);
    const days = new Set(rows.filter(activityDone).map((a) => a.date));
    return { days: days.size, acts: rows.length, pct: Math.round((days.size / 30) * 100) };
  }, [feed, ds]);
  const prayer30 = useMemo(() => summarise(feed.filter((a) => PRAYER_RE.test(a.label)), "habit", 30, ds), [feed, ds]);
  const scripture30 = useMemo(() => summarise(feed, "scripture", 30, ds), [feed, ds]);

  // Spiritual practice is whatever is being tracked NOW. This used to filter
  // the retired legacy store by category, so the screen could say "no
  // spiritual habits yet" directly above a prayer figure of 1/1.
  const spiritual = useMemo(
    () => (Array.isArray(htHabits) ? htHabits : [])
      .filter((h) => h && h.id && !h.archivedAt && SPIRITUAL_RE.test(String(h.name || ""))),
    [htHabits],
  );
  const versesSafe = useMemo(() => (Array.isArray(verses) ? verses : []).filter((v) => v && v.id), [verses]);
  const notesSafe = useMemo(() => (Array.isArray(notes) ? notes : []).filter((n) => n && n.id)
    .sort((a, b) => String(b.date || "").localeCompare(String(a.date || ""))), [notes]);

  const due = versesSafe.filter(isDue);
  const [revealed, setRevealed] = useState({}); // scripture recall: verse id → text shown

  // Faith has always said prayer lives in the habit engine, and then created
  // it in the RETIRED one — so the habit landed in a store the tracker never
  // reads and the person never saw it again. It goes into the live tracker
  // now, which is also what makes it show up here: this screen reads the
  // activity feed, and the feed reads ht_entries.
  const addSpiritualHabit = async () => {
    try {
      await habitDb.createHabit({
        name: "Prayer", icon: "🙏", type: "boolean",
        frequencyType: "daily", color: FA,
      });
      toast("Prayer habit added — tick it here or in Habits", { tone: "success" });
    } catch {
      toast("Could not add the habit.", { tone: "danger" });
    }
  };

  const addVerse = (ref, text) => {
    setVerses((prev) => [
      { id: `v${Date.now().toString(36)}`, ref: ref.trim(), text: (text || "").trim(), addedAt: ds, lastReviewed: null, reviews: 0, reviewDates: [] },
      ...(Array.isArray(prev) ? prev : []),
    ]);
  };
  const reviewVerse = (id) => {
    setVerses((prev) => (Array.isArray(prev) ? prev : []).map((v) => {
      if (v?.id !== id) return v;
      // A dated log, not just a counter. The counter drives the spacing
      // interval and is kept; it cannot say WHEN a review happened, so every
      // review used to land on lastReviewed — twenty reviews over twenty days
      // collapsed onto one date on every recompute, and the calendar and the
      // consistency engine both read dated events. One entry per day: two
      // reviews in one sitting are one act of review.
      const dates = Array.isArray(v.reviewDates) ? v.reviewDates : [];
      return {
        ...v,
        lastReviewed: ds,
        reviews: (v.reviews || 0) + 1,
        reviewDates: dates.includes(ds) ? dates : [...dates, ds].slice(-500),
      };
    }));
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

  // Unified composer: a reflection, and optionally commit its passage to Scripture memory — one act on the Word.
  const saveWord = () => {
    const ref = noteRef.trim();
    const hasReflection = !!noteDraft.trim();
    const wantVerse = memorize && !!ref && !editingNoteId;
    if (!hasReflection && !wantVerse) return;
    if (wantVerse) addVerse(ref, verseText);
    if (hasReflection) {
      saveNote(); // create/update note + reset note fields + toast
    } else {
      setNoteDraft(""); setNoteRef(""); setNoteDs(localDateStr()); setEditingNoteId(null);
    }
    if (wantVerse) toast(hasReflection ? "Reflection saved · passage set to memorise 📖" : "Verse added — first review due tomorrow 📖", { tone: "success" });
    setMemorize(false); setVerseText("");
  };

  const TABS = [
    { id: "walk",      l: "The Walk",         i: Sparkles },
    { id: "scripture", l: "The Word", i: ScrollText },
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
              <Chip label="Days with practice · 30d" value={`${walk30.days}/30`} color={FA} />
              <Chip label="Prayer · 30d" value={prayer30.logged ? `${prayer30.met}/${prayer30.logged}` : "—"} color={GR} />
              <Chip label="Scripture · 30d" value={scripture30.logged || "—"} color={PU} />
            </div>

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
              const rows = feed.filter((a) => a.meta?.habitId === h.id);
              const s30 = summarise(rows, "habit", 30, ds);
              const s90 = summarise(rows, "habit", 90, ds);
              const today = rows.find((a) => a.date === ds);
              return (
                <Card key={h.id} style={{ padding: "16px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 11, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 18 }}>{h.icon || "🙏"}</span>
                    <div style={{ flex: 1, minWidth: 140 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: T1 }}>{h.name}</div>
                      <div style={{ fontSize: 10.5, color: T3, marginTop: 2 }}>
                        {s30.logged ? `${s30.met} of ${s30.logged} logged · 30d` : "not logged in 30 days"}
                        {s90.logged ? ` · ${s90.met}/${s90.logged} · 90d` : ""}
                      </div>
                    </div>
                    {today ? (
                      <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, color: activityDone(today) ? GR : T3, fontWeight: 700 }}>
                        <Check size={13} />{activityDone(today) ? "Today ✓" : `Today ${today.pct ?? 0}%`}
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: T3 }}>Tick it in Habits</span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}

        {/* ══ THE WORD — reflection woven with Scripture memory ══ */}
        {loaded && tab === "scripture" && (() => {
          const feed = [
            ...versesSafe.map((v) => ({ kind: "verse", id: v.id, date: v.lastReviewed || v.addedAt || "", due: isDue(v), v })),
            ...notesSafe.map((n) => ({ kind: "note", id: n.id, date: (n.date || "").slice(0, 10), due: false, n })),
          ].sort((a, b) => (a.due !== b.due ? (a.due ? -1 : 1) : String(b.date).localeCompare(String(a.date))));
          const canSave = !!noteDraft.trim() || (memorize && !!noteRef.trim());
          return (
          <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: T1 }}>The Word</div>
              <div style={{ fontSize: 12, color: T3, marginTop: 2 }}>
                {due.length ? `${due.length} verse${due.length === 1 ? "" : "s"} due for review · ` : ""}{versesSafe.length} memorising · {notesSafe.length} reflection{notesSafe.length === 1 ? "" : "s"}. Spaced review: 1 → 3 → 7 → 14 → 30 → 60 days.
              </div>
            </div>

            {/* Unified composer: reflect, and optionally commit the passage to memory */}
            <Card style={{ padding: "16px 18px" }}>
              <SH title={editingNoteId ? "Edit Reflection" : "Reflect on the Word"} sub={relativeDateLabel(noteDs)} />
              <div style={{ marginBottom: 9 }}><DatePicker value={noteDs} onChange={setNoteDs} /></div>
              <input value={noteRef} onChange={(e) => setNoteRef(e.target.value)} placeholder="Passage (optional) — e.g. Psalm 23" style={{ ...input, width: "100%", marginBottom: 8 }} />
              <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="What is God teaching you today?"
                style={{ ...input, width: "100%", minHeight: 90, resize: "none", lineHeight: 1.7, marginBottom: 9 }} />

              {!editingNoteId && (
                <div style={{ marginBottom: 9 }}>
                  <button onClick={() => noteRef.trim() && setMemorize((m) => !m)} disabled={!noteRef.trim()} title={noteRef.trim() ? "" : "Add a passage above first"}
                    style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "6px 12px", background: memorize ? `${FA}18` : GL, border: `1px solid ${memorize ? FA + "55" : BD}`, borderRadius: 9, color: memorize ? FA : T2, fontSize: 11.5, fontWeight: 700, cursor: noteRef.trim() ? "pointer" : "default", fontFamily: "inherit", opacity: noteRef.trim() ? 1 : 0.55 }}>
                    {memorize ? <Check size={13} /> : <Plus size={13} />} Commit this passage to Scripture memory
                  </button>
                  {memorize && noteRef.trim() && (
                    <textarea value={verseText} onChange={(e) => setVerseText(e.target.value)} placeholder="Verse text to memorise (optional — recall from the reference alone is stronger)"
                      style={{ ...input, width: "100%", minHeight: 60, resize: "none", lineHeight: 1.6, marginTop: 8 }} />
                  )}
                </div>
              )}

              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={saveWord} disabled={!canSave}
                  style={{ flex: 1, padding: "9px", background: canSave ? `${FA}14` : GL, border: `1px solid ${canSave ? FA + "44" : BD}`, borderRadius: 10, color: canSave ? FA : T3, fontSize: 12, fontWeight: 700, cursor: canSave ? "pointer" : "default", fontFamily: "inherit" }}>
                  {editingNoteId ? "Update reflection" : "Save"}
                </button>
                {editingNoteId && (
                  <button onClick={cancelEditNote} style={{ padding: "9px 16px", background: GL, border: `1px solid ${BD}`, borderRadius: 10, color: T2, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                )}
              </div>
            </Card>

            {feed.length === 0 && (
              <Card style={{ padding: "34px", textAlign: "center" }}>
                <div style={{ fontSize: 26, marginBottom: 10 }}>📖</div>
                <div style={{ fontSize: 13, color: T2 }}>Nothing here yet — write a reflection, or commit a passage to memory and the system will schedule every review for you.</div>
              </Card>
            )}

            {/* Interleaved feed — memorised verses (due first) woven with dated reflections */}
            {feed.map((item) => item.kind === "verse" ? (() => {
              const v = item.v; const dueNow = item.due;
              const nextIn = Math.max(0, nextInterval(v.reviews || 0) - daysSince(v.lastReviewed || v.addedAt));
              return (
                <Card key={`v${v.id}`} style={{ padding: "14px 16px", borderColor: dueNow ? `${AM}44` : undefined }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 9.5, color: FA, fontWeight: 700, letterSpacing: 0.7, textTransform: "uppercase", marginBottom: 3 }}>📖 Memory</div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: T1 }}>{v.ref}</div>
                      {v.text && (dueNow && !revealed[v.id] ? (
                        <button onClick={() => setRevealed((r) => ({ ...r, [v.id]: true }))}
                          style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 7, padding: "6px 12px", background: GL, border: `1px dashed ${BD2 || BD}`, borderRadius: 9, color: T2, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                          <Eye size={12} /> Recite from memory, then reveal
                        </button>
                      ) : (
                        <div style={{ fontSize: 12, color: T2, lineHeight: 1.65, marginTop: 5, fontStyle: "italic" }}>"{v.text}"</div>
                      ))}
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
            })() : (() => {
              const n = item.n;
              return (
                <div key={`n${n.id}`} style={{ padding: "12px 14px", background: GL, borderRadius: 11, border: `1px solid ${n.id === editingNoteId ? FA + "55" : BD}`, display: "flex", gap: 9 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: T3, marginBottom: 4 }}>
                      <span style={{ color: PU, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase" }}>✍️ Reflection</span> · {relativeDateLabel((n.date || "").slice(0, 10) || ds)}{n.ref ? ` · ${n.ref}` : ""}{n.editedAt && <span style={{ opacity: 0.7 }}> · edited</span>}
                    </div>
                    <div style={{ fontSize: 12.5, color: T2, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{n.text}</div>
                  </div>
                  <button onClick={() => startEditNote(n)} aria-label="Edit note" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex", alignSelf: "flex-start", padding: 2 }}><Pencil size={11} /></button>
                  <button onClick={() => deleteNote(n)} aria-label="Delete note" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex", alignSelf: "flex-start", padding: 2 }}><Trash2 size={11} /></button>
                </div>
              );
            })())}
          </div>
          );
        })()}
        )}
      </div>
    </div>
  );
}
