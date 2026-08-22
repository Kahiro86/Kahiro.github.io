// ── Journal detail, inside Discipline ────────────────────────────────
// Writing happens inline on the Discipline list (the composer). This is the
// rest of what the Journal tab used to hold — the filed archive and the
// patterns — reached by opening the pinned Journal habit rather than by a
// tab of its own (spec §3.1/§3.3).
import { useMemo, useState } from "react";
import { ChevronLeft, Files, Sparkles, Search } from "lucide-react";
import { B2, BD, T1, T2, T3, GL, AC, GR, RE, AM } from "../../shared/designTokens.js";
import { Card } from "../../shared/ui.jsx";
import { relativeDateLabel } from "../../shared/DatePicker.jsx";
import { useStorageState } from "../../shared/useStorageState.js";
import { useToast } from "../../shared/toast.jsx";
import { localDateStr } from "../../shared/dates.js";
import { Journals } from "./Journals.jsx";
import { MOODS, writingStats, journalPatterns } from "./journalMeta.js";

const today = () => localDateStr();

export function JournalDetail({ onBack }) {
  const [tab, setTab] = useState("entries");
  const [q, setQ] = useState("");
  const [rawEntries, setEntries] = useStorageState("journal_entries", []);
  const toast = useToast();

  const entries = useMemo(
    () => (Array.isArray(rawEntries) ? rawEntries : [])
      .filter((e) => e && typeof e === "object" && e.id)
      .slice()
      .sort((a, b) => ((b.date || "").slice(0, 10)).localeCompare((a.date || "").slice(0, 10))),
    [rawEntries]
  );
  // §3.5 — search across entries.
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter((e) => `${e.title || ""} ${e.text || ""} ${(e.tags || []).join(" ")}`.toLowerCase().includes(needle));
  }, [entries, q]);
  const ws = useMemo(() => writingStats(entries, today()), [entries]);
  const patterns = useMemo(() => journalPatterns(entries, today()), [entries]);

  const deleteEntry = (id) => {
    const entry = entries.find((e) => e.id === id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    toast("Entry deleted", { action: "Undo", onAction: () => setEntries((prev) => [entry, ...prev]), tone: "danger" });
  };

  const TABS = [{ id: "entries", l: "Entries", i: Files }, { id: "patterns", l: "Patterns", i: Sparkles }];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {onBack && (
        <button onClick={onBack} aria-label="Back to Discipline"
          style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 6, margin: "16px 0 0 24px",
            background: "none", border: "none", color: T3, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>
          <ChevronLeft size={14} /> Discipline
        </button>
      )}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 24px 24px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 720 }}>
        <div style={{ fontSize: 11, color: T2 }}>
          {ws.monthCount} {ws.monthCount === 1 ? "entry" : "entries"} this month · {ws.streak}-day writing streak
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {TABS.map((t) => {
            const on = tab === t.id; const Icon = t.i;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 13px", borderRadius: 10, fontSize: 12,
                  fontWeight: on ? 600 : 500, cursor: "pointer", fontFamily: "inherit",
                  border: `1px solid ${on ? AC + "55" : "transparent"}`, background: on ? `${AC}18` : "transparent", color: on ? AC : T2 }}>
                <Icon size={13} />{t.l}
              </button>
            );
          })}
        </div>

        {tab === "entries" && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: GL, border: `1px solid ${BD}`, borderRadius: 10, padding: "8px 11px" }}>
              <Search size={13} color={T3} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search entries…"
                style={{ flex: 1, background: "none", border: "none", outline: "none", color: T1, fontSize: 12.5, fontFamily: "inherit" }} />
              {q && <button onClick={() => setQ("")} style={{ background: "none", border: "none", color: T3, cursor: "pointer", fontSize: 11 }}>clear</button>}
            </div>
            {q && <div style={{ fontSize: 11, color: T3 }}>{shown.length} of {entries.length} {entries.length === 1 ? "entry" : "entries"}</div>}
            <Journals entries={shown} editingEntryId={null} onEdit={() => {}} onDelete={deleteEntry}
              relativeDateLabel={relativeDateLabel} today={today} onExport={(f) => toast(`Exported ${f.label}`, { tone: "success" })} />
          </>
        )}

        {tab === "patterns" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {patterns.withMood < 2 ? (
              <Card style={{ padding: "16px 18px" }}>
                <div style={{ fontSize: 12.5, color: T2, lineHeight: 1.6 }}>
                  Tag a few entries' mood as you write and the patterns fill in — how each mood tracks your day score,
                  and whether the pen comes back faster after a gap.
                </div>
              </Card>
            ) : (
              <>
                {Number.isFinite(patterns.moodAvg.drained) && Number.isFinite(patterns.moodAvg.sharp) && (
                  <Insight tone={RE} title="Mood tracks the day, not the other way around"
                    body={<><b>Drained days average {patterns.moodAvg.drained}</b> · Sharp days average {patterns.moodAvg.sharp}. The gap is real — the low-mood days really were the low-score days.</>} />
                )}
                {patterns.withMood >= 3 && patterns.hard / Math.max(1, patterns.withMood) >= 0.5 && (
                  <Insight tone={AM} title="You write most on hard days"
                    body={<><b>{patterns.hard} of {patterns.withMood}</b> tagged entries were Drained or Flat. Worth writing on good days too, so the record isn't only the losses.</>} />
                )}
                {patterns.maxGapEver > patterns.recentMaxGap && (
                  <Insight tone={GR} title="Longest gap is closing"
                    body={<>Your longest silence was <b>{patterns.maxGapEver} days</b>; lately the biggest gap is <b>{patterns.recentMaxGap} day{patterns.recentMaxGap === 1 ? "" : "s"}</b>.</>} />
                )}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                  {MOODS.filter((m) => Number.isFinite(patterns.moodAvg[m.id])).map((m) => (
                    <span key={m.id} style={{ fontSize: 11, padding: "6px 11px", borderRadius: 12, background: GL, border: `1px solid ${BD}`, color: T2 }}>
                      {m.label} <b style={{ color: AC }}>{patterns.moodAvg[m.id]}</b>
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Insight({ tone, title, body }) {
  return (
    <div style={{ position: "relative", overflow: "hidden", background: B2, border: `1px solid ${BD}`, borderRadius: 12, padding: "13px 15px 13px 17px" }}>
      <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: tone }} />
      <div style={{ fontSize: 12.5, fontWeight: 700, color: T1, marginBottom: 5 }}>{title}</div>
      <div style={{ fontSize: 11.5, color: T2, lineHeight: 1.6 }}>{body}</div>
    </div>
  );
}
