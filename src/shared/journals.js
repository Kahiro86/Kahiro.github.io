// ── File-based journals ──────────────────────────────────────────────
// Reflections stop scrolling as one endless inline log. Instead they are
// filed into per-period records (one file per month), collapsed by date.
// You open a file to read it; closed/older periods sit out of the active
// view until opened. Each file can be exported on its own. Local-first —
// this only reshapes how the existing `journal_entries` are presented, it
// never changes what is stored.

const MONTHS = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

// A period key groups entries into one file. Month granularity by default.
export function periodKey(dateStr, period = "month") {
  const d = String(dateStr || "").slice(0, 10);
  const [y, m] = d.split("-");
  if (!y || !m) return "unknown";
  return period === "year" ? y : `${y}-${m}`;
}

export function periodLabel(key) {
  if (key === "unknown") return "Undated";
  const [y, m] = key.split("-");
  if (!m) return y;
  const idx = parseInt(m, 10) - 1;
  return `${MONTHS[idx] || m} ${y}`;
}

// Group sorted entries into files, newest period first. Each file keeps its
// own entries newest-first. `count` is the number of reflections filed.
export function groupIntoFiles(entries, period = "month") {
  const list = Array.isArray(entries) ? entries : [];
  const byKey = new Map();
  for (const e of list) {
    if (!e || typeof e !== "object") continue;
    const key = periodKey(e.date, period);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(e);
  }
  const files = [];
  for (const [key, es] of byKey) {
    es.sort((a, b) => ((b.date || "").slice(0, 10)).localeCompare((a.date || "").slice(0, 10)));
    files.push({ key, label: periodLabel(key), entries: es, count: es.length });
  }
  files.sort((a, b) => (a.key === "unknown" ? 1 : b.key === "unknown" ? -1 : b.key.localeCompare(a.key)));
  return files;
}

// Render one file as portable Markdown for export.
export function fileToMarkdown(file) {
  if (!file) return "";
  const lines = [`# Journal — ${file.label}`, ""];
  for (const e of file.entries) {
    const d = (e.date || "").slice(0, 10) || "undated";
    lines.push(`## ${d}${e.editedAt ? " · (edited)" : ""}`, "");
    if (e.title) lines.push(`**${String(e.title).trim()}**`, "");
    lines.push((e.text || "").trim(), "");
  }
  return lines.join("\n");
}

export function fileExportName(file) {
  const safe = String(file?.key || "journal").replace(/[^a-z0-9-]/gi, "-");
  return `journal-${safe}.md`;
}

// Trigger a client-side download of a text file. No-op outside the browser.
export function downloadText(filename, text, type = "text/markdown") {
  if (typeof document === "undefined" || typeof URL === "undefined") return;
  const blob = new Blob([text], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
