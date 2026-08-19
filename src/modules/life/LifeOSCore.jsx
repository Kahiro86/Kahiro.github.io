import { useMemo, useState, useEffect } from "react";
import { BookOpen, ShieldCheck } from "lucide-react";
import { BD, T1, T2, T3, GL, CY, PU } from "../../shared/designTokens.js";
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

// The habit tracker was removed; Life keeps Journal + Purity here (Nutrition
// lives alongside in LifeOSModule). Journal/Purity data and behaviour are
// untouched.
const today = () => localDateStr();

export function LifeOSCore() {
  const [tab, setTab] = useState("journal");
  const focus = useFocusRequest();
  useEffect(() => {
    if (focus?.module === "life" && (focus.tab === "journal" || focus.tab === "purity")) setTab(focus.tab);
  }, [focus?.nonce]); // eslint-disable-line

  const [journal, setJournal] = useState("");
  const [journalTitle, setJournalTitle] = useState("");
  const [journalDs, setJournalDs] = useState(() => today());
  const [editingEntryId, setEditingEntryId] = useState(null);
  const [rawEntries, setEntries] = useStorageState("journal_entries", []);
  const toast = useToast();

  const entries = useMemo(
    () => (Array.isArray(rawEntries) ? rawEntries : [])
      .filter((e) => e && typeof e === "object" && e.id)
      .slice()
      .sort((a, b) => ((b.date || "").slice(0, 10)).localeCompare((a.date || "").slice(0, 10))),
    [rawEntries]
  );

  const saveEntry = () => {
    if (!journal.trim()) return;
    const title = journalTitle.trim();
    if (editingEntryId) {
      setEntries((prev) => (Array.isArray(prev) ? prev : []).map((e) =>
        e?.id === editingEntryId ? { ...e, date: journalDs, title, text: journal, editedAt: new Date().toISOString() } : e));
      toast("Reflection updated ✍️", { tone: "success", duration: 2500 });
    } else {
      setEntries((prev) => [{ id: `j${Date.now()}`, date: journalDs, title, text: journal }, ...prev]);
      toast("Reflection saved 🌱", { tone: "success", duration: 2500 });
    }
    setEditingEntryId(null);
    setJournalDs(today());
    setJournal("");
    setJournalTitle("");
  };
  const startEditEntry = (e) => {
    setEditingEntryId(e.id);
    setJournalTitle(e.title || "");
    setJournal(e.text || "");
    setJournalDs((e.date || today()).slice(0, 10));
  };
  const cancelEditEntry = () => {
    setEditingEntryId(null);
    setJournal("");
    setJournalTitle("");
    setJournalDs(today());
  };
  const deleteEntry = (id) => {
    const entry = entries.find((e) => e.id === id);
    if (id === editingEntryId) cancelEditEntry();
    setEntries((prev) => prev.filter((e) => e.id !== id));
    toast("Entry deleted", { action: "Undo", onAction: () => setEntries((prev) => [entry, ...prev]), tone: "danger" });
  };

  const TABS = [
    { id: "journal", l: "Journal", i: BookOpen },
    { id: "purity", l: "Purity", i: ShieldCheck },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ModuleTabs tabs={TABS} active={tab} onSelect={setTab} activeBg={`linear-gradient(135deg,${CY}22,${CY}18)`} activeColor={CY} />

      <div style={{ flex: 1, overflowY: "auto" }}>
        {tab === "journal" && (
          <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 }}>
            <Card style={{ padding: "20px" }}>
              <SH title={editingEntryId ? "Edit Reflection" : "Daily Reflection"} />
              <DatePicker value={journalDs} onChange={setJournalDs} />
              <div style={{ fontSize: 11.5, color: T3, margin: "10px 0", lineHeight: 1.6 }}>Reflect to learn, not to judge. Tap a prompt to begin.</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 11 }}>
                {REFLECTION_PROMPTS.map((p) => (
                  <button key={p} onClick={() => setJournal((j) => (j ? `${j}\n\n${p}\n` : `${p}\n`))}
                    style={{ padding: "5px 11px", borderRadius: 20, border: `1px solid ${CY}33`, background: `${CY}12`, color: CY, fontSize: 11, cursor: "pointer", fontFamily: "inherit", lineHeight: 1.4, textAlign: "left" }}>
                    {p}
                  </button>
                ))}
              </div>
              <input value={journalTitle} onChange={(e) => setJournalTitle(e.target.value)} placeholder="Title (optional)"
                style={{ width: "100%", background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: "10px 13px", fontSize: 14, fontWeight: 700, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 8 }} />
              <textarea value={journal} onChange={(e) => setJournal(e.target.value)} placeholder="One honest sentence is enough. What improved today?"
                style={{ width: "100%", minHeight: 110, background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: "11px 13px", fontSize: 13, color: T1, lineHeight: 1.7, resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box" }} />
              <div style={{ display: "flex", gap: 8, marginTop: 9 }}>
                <button onClick={saveEntry} style={{ flex: 1, padding: "9px", background: `linear-gradient(135deg,${CY}22,${PU}22)`, border: `1px solid ${CY}44`, borderRadius: 10, color: CY, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                  {editingEntryId ? "Update Entry" : "Save Entry"}
                </button>
                {editingEntryId && (
                  <button onClick={cancelEditEntry} style={{ padding: "9px 16px", background: GL, border: `1px solid ${BD}`, borderRadius: 10, color: T2, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                    Cancel
                  </button>
                )}
              </div>
            </Card>
            <div style={{ fontSize: 10.5, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 700, color: T3, marginTop: 2 }}>Journals</div>
            <Journals
              entries={entries}
              editingEntryId={editingEntryId}
              onEdit={startEditEntry}
              onDelete={deleteEntry}
              relativeDateLabel={relativeDateLabel}
              today={today}
              onExport={(f) => toast(`Exported ${f.label}`, { tone: "success" })}
            />
            <ModeHistoryStrip />
          </div>
        )}

        {tab === "purity" && <PurityTab />}
      </div>
    </div>
  );
}
