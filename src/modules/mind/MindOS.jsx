// ── Mind OS (Kaizen phase 7) ─────────────────────────────────────────
// Mental development: a reading/course library with real progress, quick
// notes, and a decision journal that resurfaces each decision after 30
// days so you learn from outcomes, not intentions.
import { useMemo, useState } from "react";
import { BookOpen, Plus, Check, Trash2, StickyNote, Scale, GraduationCap } from "lucide-react";
import { B2, BD, T1, T2, T3, GL, GR, RE, AM, CY } from "../../shared/designTokens.js";
import { Card, SH, Chip, Hydrating, Meter } from "../../shared/ui.jsx";
import { ModuleTabs } from "../../shared/ModuleTabs.jsx";
import { useStorageState } from "../../shared/useStorageState.js";
import { useToast } from "../../shared/toast.jsx";
import { localDateStr, daysBetween } from "../../shared/dates.js";

const MI = CY; // Nocturne cyan accent (monochrome theme)
const REVIEW_AFTER_DAYS = 30;

const daysSince = (ds) => (ds ? daysBetween(ds, localDateStr()) : 0);

export function MindOS({ loaded = true }) {
  const [tab, setTab] = useState("library");
  const [items, setItems] = useStorageState("mind_library", []);
  const [notes, setNotes] = useStorageState("mind_notes", []);
  const [decisions, setDecisions] = useStorageState("mind_decisions", []);
  const [itemDraft, setItemDraft] = useState(null);   // { title, author, kind, pagesTotal }
  const [noteDraft, setNoteDraft] = useState("");
  const [decDraft, setDecDraft] = useState(null);     // { decision, expected }
  const [reviewing, setReviewing] = useState(null);   // decision id being reviewed
  const [reviewText, setReviewText] = useState("");
  const toast = useToast();
  const ds = localDateStr();

  const itemsSafe = useMemo(() => (Array.isArray(items) ? items : []).filter((x) => x && x.id), [items]);
  const notesSafe = useMemo(() => (Array.isArray(notes) ? notes : []).filter((x) => x && x.id), [notes]);
  const decisionsSafe = useMemo(() => (Array.isArray(decisions) ? decisions : []).filter((x) => x && x.id), [decisions]);

  const reading = itemsSafe.filter((x) => x.status === "reading");
  const finished = itemsSafe.filter((x) => x.status === "done");
  const dueReviews = decisionsSafe.filter((d) => !d.reviewedAt && daysSince(d.date) >= REVIEW_AFTER_DAYS);

  // ── Library actions ─────────────────────────────────────────────────
  const saveItem = () => {
    if (!itemDraft?.title?.trim()) return;
    setItems((prev) => [
      { id: `b${Date.now().toString(36)}`, title: itemDraft.title.trim(), author: (itemDraft.author || "").trim(),
        kind: itemDraft.kind || "book", pagesTotal: +itemDraft.pagesTotal || 0, pagesRead: 0,
        status: "reading", startedAt: ds, finishedAt: null, takeaway: "" },
      ...(Array.isArray(prev) ? prev : []),
    ]);
    setItemDraft(null);
    toast("Added to your library 📚", { tone: "success" });
  };
  const patchItem = (id, patch) =>
    setItems((prev) => (Array.isArray(prev) ? prev : []).map((x) => (x?.id === id ? { ...x, ...patch } : x)));
  const setProgress = (it, pages) => {
    const p = Math.max(0, Math.min(it.pagesTotal || 9999, +pages || 0));
    const finishedNow = it.pagesTotal > 0 && p >= it.pagesTotal;
    patchItem(it.id, { pagesRead: p, ...(finishedNow ? { status: "done", finishedAt: ds } : {}) });
    if (finishedNow) toast(`"${it.title}" finished — capture one takeaway 🎓`, { tone: "success", duration: 5000 });
  };
  const finishItem = (it) => patchItem(it.id, { status: "done", finishedAt: ds, pagesRead: it.pagesTotal || it.pagesRead });
  const deleteItem = (it) => {
    setItems((prev) => (Array.isArray(prev) ? prev : []).filter((x) => x?.id !== it.id));
    toast(`"${it.title}" removed`, { action: "Undo", onAction: () => setItems((p) => [it, ...(Array.isArray(p) ? p : [])]), tone: "danger" });
  };

  // ── Notes actions ───────────────────────────────────────────────────
  const saveNote = () => {
    if (!noteDraft.trim()) return;
    setNotes((prev) => [{ id: `mn${Date.now().toString(36)}`, date: ds, text: noteDraft.trim() }, ...(Array.isArray(prev) ? prev : [])]);
    setNoteDraft("");
    toast("Note captured 💡", { tone: "success", duration: 2200 });
  };
  const deleteNote = (n) => {
    setNotes((prev) => (Array.isArray(prev) ? prev : []).filter((x) => x?.id !== n.id));
    toast("Note removed", { action: "Undo", onAction: () => setNotes((p) => [n, ...(Array.isArray(p) ? p : [])]), tone: "danger" });
  };

  // ── Decision journal actions ────────────────────────────────────────
  const saveDecision = () => {
    if (!decDraft?.decision?.trim()) return;
    setDecisions((prev) => [
      { id: `d${Date.now().toString(36)}`, date: ds, decision: decDraft.decision.trim(), expected: (decDraft.expected || "").trim(), reviewedAt: null, outcome: null, lesson: "" },
      ...(Array.isArray(prev) ? prev : []),
    ]);
    setDecDraft(null);
    toast(`Logged — it resurfaces for review in ${REVIEW_AFTER_DAYS} days ⚖️`, { tone: "success", duration: 4000 });
  };
  const recordOutcome = (id, outcome) => {
    setDecisions((prev) => (Array.isArray(prev) ? prev : []).map((d) =>
      d?.id === id ? { ...d, reviewedAt: ds, outcome, lesson: reviewText.trim() } : d
    ));
    setReviewing(null); setReviewText("");
    toast("Outcome recorded — that's how judgment compounds.", { tone: "success" });
  };

  const TABS = [
    { id: "library",   l: "Library",   i: BookOpen },
    { id: "notes",     l: "Notes",     i: StickyNote },
    { id: "decisions", l: "Decisions", i: Scale },
  ];
  const input = { background: B2, border: `1px solid ${BD}`, borderRadius: 9, padding: "9px 12px", fontSize: 12.5, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
  const OUTCOMES = [
    { id: "better",   l: "Better than expected", c: GR },
    { id: "expected", l: "As expected",          c: CY },
    { id: "worse",    l: "Worse than expected",  c: RE },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ModuleTabs tint="rgba(7,8,13,0.5)" activeBg={`${MI}22`} activeColor="#FFFFFF" tabs={TABS} active={tab} onSelect={setTab}>
        <div style={{ flex: 1 }} />
        {dueReviews.length > 0 && (
          <button onClick={() => setTab("decisions")} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", background: `${AM}14`, border: `1px solid ${AM}44`, borderRadius: 9, color: AM, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            ⚖️ {dueReviews.length} decision{dueReviews.length > 1 ? "s" : ""} ready to review
          </button>
        )}
      </ModuleTabs>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {!loaded && <Hydrating label="Opening Mind OS…" />}

        {/* ══ LIBRARY ══ */}
        {loaded && tab === "library" && (
          <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 820 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 11 }}>
              <Chip label="In progress" value={reading.length} color={MI} />
              <Chip label="Completed"   value={finished.length} color={GR} />
              <Chip label="Notes"       value={notesSafe.length} color={CY} />
              <Chip label="Decisions"   value={decisionsSafe.length} color={AM} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: T1 }}>Library</div>
                <div style={{ fontSize: 12, color: T3, marginTop: 2 }}>Books and courses — progress you can see</div>
              </div>
              {!itemDraft && (
                <button onClick={() => setItemDraft({ title: "", author: "", kind: "book", pagesTotal: "" })}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 15px", background: `${MI}22`, border: `1px solid ${MI}55`, borderRadius: 10, color: "#A8B0D6", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  <Plus size={13} />Add
                </button>
              )}
            </div>

            {itemDraft && (
              <Card style={{ padding: "16px", borderColor: `${MI}55` }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                  {["book", "course"].map((k) => (
                    <button key={k} onClick={() => setItemDraft((d) => ({ ...d, kind: k }))}
                      style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 13px", borderRadius: 8, border: `1px solid ${itemDraft.kind === k ? MI + "66" : BD}`, background: itemDraft.kind === k ? `${MI}22` : GL, color: itemDraft.kind === k ? "#A8B0D6" : T2, fontSize: 11.5, cursor: "pointer", fontFamily: "inherit" }}>
                      {k === "book" ? <BookOpen size={11} /> : <GraduationCap size={11} />}{k === "book" ? "Book" : "Course"}
                    </button>
                  ))}
                </div>
                <input autoFocus value={itemDraft.title} onChange={(e) => setItemDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Title" style={{ ...input, width: "100%", marginBottom: 8 }} />
                <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
                  <input value={itemDraft.author} onChange={(e) => setItemDraft((d) => ({ ...d, author: e.target.value }))} placeholder="Author / platform" style={{ ...input, flex: 2, minWidth: 140 }} />
                  <input value={itemDraft.pagesTotal} onChange={(e) => setItemDraft((d) => ({ ...d, pagesTotal: e.target.value.replace(/[^0-9]/g, "") }))} placeholder={itemDraft.kind === "book" ? "Pages" : "Lessons"} inputMode="numeric" style={{ ...input, flex: 1, minWidth: 80 }} />
                </div>
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => setItemDraft(null)} style={{ padding: "8px 14px", background: GL, border: `1px solid ${BD}`, borderRadius: 9, color: T2, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                  <button onClick={saveItem} disabled={!itemDraft.title.trim()}
                    style={{ padding: "8px 16px", background: itemDraft.title.trim() ? `${MI}22` : GL, border: `1px solid ${itemDraft.title.trim() ? MI + "66" : BD}`, borderRadius: 9, color: itemDraft.title.trim() ? "#A8B0D6" : T3, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Add to library</button>
                </div>
              </Card>
            )}

            {itemsSafe.length === 0 && !itemDraft && (
              <Card style={{ padding: "34px", textAlign: "center" }}>
                <div style={{ fontSize: 26, marginBottom: 10 }}>📚</div>
                <div style={{ fontSize: 13, color: T2 }}>Nothing in the library yet — add what you're reading or studying right now.</div>
              </Card>
            )}

            {[...reading, ...itemsSafe.filter((x) => x.status !== "reading" && x.status !== "done"), ...finished].map((it) => {
              const pct = it.pagesTotal > 0 ? Math.round(((+it.pagesRead || 0) / it.pagesTotal) * 100) : 0;
              const done = it.status === "done";
              return (
                <Card key={it.id} style={{ padding: "14px 16px", opacity: done ? 0.82 : 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 16 }}>{it.kind === "course" ? "🎓" : "📖"}</span>
                    <div style={{ flex: 1, minWidth: 160 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: T1 }}>{it.title}</div>
                      <div style={{ fontSize: 10.5, color: T3, marginTop: 2 }}>
                        {it.author || (it.kind === "course" ? "Course" : "Book")}{done ? ` · finished ${it.finishedAt?.slice(5) || ""}` : ""}
                      </div>
                    </div>
                    {!done && it.pagesTotal > 0 && (
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <input value={it.pagesRead || ""} onChange={(e) => setProgress(it, e.target.value.replace(/[^0-9]/g, ""))}
                          aria-label={`Progress for ${it.title}`} inputMode="numeric"
                          style={{ ...input, width: 62, textAlign: "right", fontFamily: "monospace", padding: "6px 9px" }} />
                        <span style={{ fontSize: 11, color: T3, fontFamily: "monospace" }}>/ {it.pagesTotal}</span>
                      </div>
                    )}
                    {!done && (
                      <button onClick={() => finishItem(it)} style={{ padding: "7px 12px", background: `${GR}12`, border: `1px solid ${GR}44`, borderRadius: 9, color: GR, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                        <Check size={11} style={{ verticalAlign: -1.5 }} /> Done
                      </button>
                    )}
                    <button onClick={() => deleteItem(it)} aria-label={`Delete ${it.title}`} style={{ background: GL, border: `1px solid ${BD}`, borderRadius: 8, padding: "6px 8px", cursor: "pointer", color: RE, display: "flex" }}><Trash2 size={12} /></button>
                  </div>
                  {!done && it.pagesTotal > 0 && (
                    <Meter pct={pct} height={4} color={MI} style={{ marginTop: 11 }} />
                  )}
                  {done && (
                    <textarea value={it.takeaway || ""} onChange={(e) => patchItem(it.id, { takeaway: e.target.value })}
                      placeholder="One takeaway worth keeping…"
                      style={{ ...input, width: "100%", minHeight: 40, resize: "none", lineHeight: 1.6, marginTop: 10, fontSize: 12 }} />
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* ══ NOTES ══ */}
        {loaded && tab === "notes" && (
          <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
            <Card style={{ padding: "16px 18px" }}>
              <SH title="Capture" sub="Ideas, insights, things worth keeping" />
              <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} placeholder="Write it down before it evaporates…"
                style={{ ...input, width: "100%", minHeight: 80, resize: "none", lineHeight: 1.7, marginBottom: 9 }} />
              <button onClick={saveNote} disabled={!noteDraft.trim()}
                style={{ width: "100%", padding: "9px", background: noteDraft.trim() ? `${MI}22` : GL, border: `1px solid ${noteDraft.trim() ? MI + "55" : BD}`, borderRadius: 10, color: noteDraft.trim() ? "#A8B0D6" : T3, fontSize: 12, fontWeight: 700, cursor: noteDraft.trim() ? "pointer" : "default", fontFamily: "inherit" }}>
                Save note
              </button>
            </Card>
            {notesSafe.map((n) => (
              <div key={n.id} style={{ padding: "12px 14px", background: GL, borderRadius: 11, border: `1px solid ${BD}`, display: "flex", gap: 9 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: T3, marginBottom: 4 }}>{new Date(`${n.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</div>
                  <div style={{ fontSize: 12.5, color: T2, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{n.text}</div>
                </div>
                <button onClick={() => deleteNote(n)} aria-label="Delete note" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex", alignSelf: "flex-start", padding: 2 }}><Trash2 size={11} /></button>
              </div>
            ))}
          </div>
        )}

        {/* ══ DECISION JOURNAL ══ */}
        {loaded && tab === "decisions" && (
          <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: T1 }}>Decision Journal</div>
                <div style={{ fontSize: 12, color: T3, marginTop: 2 }}>Write the expectation now; the outcome review unlocks after {REVIEW_AFTER_DAYS} days.</div>
              </div>
              {!decDraft && (
                <button onClick={() => setDecDraft({ decision: "", expected: "" })}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 15px", background: `${MI}22`, border: `1px solid ${MI}55`, borderRadius: 10, color: "#A8B0D6", fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                  <Plus size={13} />Log decision
                </button>
              )}
            </div>

            {decDraft && (
              <Card style={{ padding: "16px", borderColor: `${MI}55` }}>
                <textarea autoFocus value={decDraft.decision} onChange={(e) => setDecDraft((d) => ({ ...d, decision: e.target.value }))}
                  placeholder="What did you decide? (and the key reason)" style={{ ...input, width: "100%", minHeight: 56, resize: "none", lineHeight: 1.6, marginBottom: 8 }} />
                <textarea value={decDraft.expected} onChange={(e) => setDecDraft((d) => ({ ...d, expected: e.target.value }))}
                  placeholder="What do you expect to happen?" style={{ ...input, width: "100%", minHeight: 46, resize: "none", lineHeight: 1.6, marginBottom: 10 }} />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button onClick={() => setDecDraft(null)} style={{ padding: "8px 14px", background: GL, border: `1px solid ${BD}`, borderRadius: 9, color: T2, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Cancel</button>
                  <button onClick={saveDecision} disabled={!decDraft.decision.trim()}
                    style={{ padding: "8px 16px", background: decDraft.decision.trim() ? `${MI}22` : GL, border: `1px solid ${decDraft.decision.trim() ? MI + "66" : BD}`, borderRadius: 9, color: decDraft.decision.trim() ? "#A8B0D6" : T3, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Log it</button>
                </div>
              </Card>
            )}

            {decisionsSafe.length === 0 && !decDraft && (
              <Card style={{ padding: "34px", textAlign: "center" }}>
                <div style={{ fontSize: 26, marginBottom: 10 }}>⚖️</div>
                <div style={{ fontSize: 13, color: T2 }}>No decisions logged. Big trade sizing, a purchase, a commitment — write the expectation before reality votes.</div>
              </Card>
            )}

            {[...decisionsSafe].sort((a, b) => {
              const da = !a.reviewedAt && daysSince(a.date) >= REVIEW_AFTER_DAYS ? 0 : 1;
              const db = !b.reviewedAt && daysSince(b.date) >= REVIEW_AFTER_DAYS ? 0 : 1;
              return da - db;
            }).map((d) => {
              const due = !d.reviewedAt && daysSince(d.date) >= REVIEW_AFTER_DAYS;
              const outcome = OUTCOMES.find((o) => o.id === d.outcome);
              return (
                <Card key={d.id} style={{ padding: "14px 16px", borderColor: due ? `${AM}44` : undefined }}>
                  <div style={{ fontSize: 10, color: T3, marginBottom: 5 }}>
                    {new Date(`${d.date}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    {d.reviewedAt ? " · reviewed" : due ? " · REVIEW DUE" : ` · review in ${Math.max(0, REVIEW_AFTER_DAYS - daysSince(d.date))}d`}
                  </div>
                  <div style={{ fontSize: 13, color: T1, fontWeight: 600, lineHeight: 1.55 }}>{d.decision}</div>
                  {d.expected && <div style={{ fontSize: 11.5, color: T3, lineHeight: 1.6, marginTop: 5 }}>Expected: {d.expected}</div>}

                  {outcome && (
                    <div style={{ marginTop: 9, padding: "8px 11px", background: `${outcome.c}0D`, border: `1px solid ${outcome.c}33`, borderRadius: 9 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 700, color: outcome.c }}>{outcome.l}</span>
                      {d.lesson && <div style={{ fontSize: 11.5, color: T2, lineHeight: 1.6, marginTop: 4 }}>{d.lesson}</div>}
                    </div>
                  )}

                  {due && reviewing !== d.id && (
                    <button onClick={() => { setReviewing(d.id); setReviewText(""); }}
                      style={{ marginTop: 10, padding: "8px 14px", background: `${AM}14`, border: `1px solid ${AM}44`, borderRadius: 9, color: AM, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                      Review outcome now
                    </button>
                  )}
                  {reviewing === d.id && (
                    <div style={{ marginTop: 10 }}>
                      <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} placeholder="What actually happened — and the lesson?"
                        style={{ ...input, width: "100%", minHeight: 46, resize: "none", lineHeight: 1.6, marginBottom: 8 }} />
                      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                        {OUTCOMES.map((o) => (
                          <button key={o.id} onClick={() => recordOutcome(d.id, o.id)}
                            style={{ padding: "7px 13px", background: `${o.c}12`, border: `1px solid ${o.c}44`, borderRadius: 9, color: o.c, fontSize: 11.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                            {o.l}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
