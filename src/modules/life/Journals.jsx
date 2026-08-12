// ── Journals — file-based reflection archive ─────────────────────────
// Replaces the endless inline reflection feed. Saved reflections are filed
// into per-month records; each file is collapsed by date and opened to
// read. The current month opens by default; older months sit closed out of
// the active view until you open them. Every file exports on its own.
import { useMemo, useState } from "react";
import { Pencil, Trash2, Download, FolderClosed, FolderOpen } from "lucide-react";
import { T1, T2, T3, GL, BD, CY, AC } from "../../shared/designTokens.js";
import { groupIntoFiles, fileToMarkdown, fileExportName, downloadText } from "../../shared/journals.js";
import { WeeklyMuscleRollup } from "../../shared/WeeklyMuscleRollup.jsx";

export function Journals({ entries, editingEntryId, onEdit, onDelete, relativeDateLabel, today, onExport }) {
  const files = useMemo(() => groupIntoFiles(entries), [entries]);
  const [open, setOpen] = useState(() => new Set(files.length ? [files[0].key] : []));

  const toggle = (key) => setOpen((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const exportFile = (file) => {
    downloadText(fileExportName(file), fileToMarkdown(file));
    onExport && onExport(file);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Weekly workout record — the body map + muscle coverage for the week,
          filed alongside the written reflections. */}
      <WeeklyMuscleRollup />
      {!files.length && (
        <div style={{ fontSize: 12, color: T3, padding: "6px 2px" }}>No reflections filed yet — save one above and it lands in this month's file.</div>
      )}
      {files.map((file) => {
        const isOpen = open.has(file.key);
        return (
          <div key={file.key} style={{ border: `1px solid ${BD}`, borderRadius: 12, background: GL, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 13px" }}>
              <button onClick={() => toggle(file.key)} style={{ flex: 1, display: "flex", alignItems: "center", gap: 9, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left", padding: 0 }}>
                {isOpen ? <FolderOpen size={15} color={CY} /> : <FolderClosed size={15} color={T3} />}
                <span style={{ fontSize: 13.5, fontWeight: 700, color: T1 }}>{file.label}</span>
                <span style={{ fontSize: 10.5, color: T3 }}>{file.count} {file.count === 1 ? "entry" : "entries"}</span>
              </button>
              <button onClick={() => exportFile(file)} title={`Export ${file.label}`} aria-label={`Export ${file.label}`} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: `1px solid ${BD}`, borderRadius: 8, padding: "4px 9px", cursor: "pointer", color: T3, fontSize: 10.5, fontFamily: "inherit" }}>
                <Download size={11} /> Export
              </button>
            </div>
            {isOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 13px 13px" }}>
                {file.entries.map((e) => (
                  <div key={e.id} style={{ padding: "11px 13px", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: `1px solid ${e.id === editingEntryId ? CY + "55" : BD}`, display: "flex", gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: T3, marginBottom: 4 }}>
                        {relativeDateLabel((e.date || "").slice(0, 10) || today())}
                        {e.editedAt && <span style={{ opacity: 0.7 }}> · edited</span>}
                      </div>
                      {e.title && <div style={{ fontSize: 14, fontWeight: 700, color: T1, marginBottom: 4, lineHeight: 1.35 }}>{e.title}</div>}
                      <div style={{ fontSize: 12.5, color: T2, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>{e.text}</div>
                    </div>
                    <button onClick={() => onEdit(e)} title="Edit entry" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex", alignSelf: "flex-start", padding: 2 }}><Pencil size={11} /></button>
                    <button onClick={() => onDelete(e.id)} title="Delete entry" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex", alignSelf: "flex-start", padding: 2 }}><Trash2 size={11} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
