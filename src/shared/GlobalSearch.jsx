// ── Global search overlay — a command palette across the whole app ───
// Opens from the header or Cmd/Ctrl+K (or "/"). Searches every local store,
// ranks the hits, and jumps to the right module on Enter/click. Keyboard
// first; nothing leaves the device.
import { useEffect, useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import { B1, B2, BD, T1, T2, T3, GL, AC, AC2 } from "./designTokens.js";
import { searchAll, recentItems, PAGES } from "./search.js";

export function GlobalSearch({ onClose, onNavigate, onOpenWhoIAm }) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Empty query → "jump back in" (recent items) then the pages, each under a
  // section header. A typed query → flat ranked hits, order = relevance.
  const results = useMemo(() => {
    const query = q.trim();
    if (query) return searchAll(query);
    const rows = [];
    for (const r of recentItems({ limit: 5 })) rows.push({ ...r, _group: "Recent" });
    for (const p of PAGES) rows.push({ ...p, subtitle: p.subtitle || "Jump to", _group: "Jump to" });
    return rows;
  }, [q]);

  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const go = (r) => {
    if (!r) return;
    if (r.nav === "__whoiam__") { onOpenWhoIAm?.(); onClose(); return; }
    onNavigate?.(r.nav);
    onClose();
  };

  const onKey = (e) => {
    if (e.key === "Escape") { e.preventDefault(); onClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); go(results[active]); }
  };

  // Keep the active row in view.
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-i="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 4300, background: "rgba(0,0,0,0.62)", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "10vh 16px 16px" }}>
      <div onClick={(e) => e.stopPropagation()} onKeyDown={onKey}
        style={{ width: "100%", maxWidth: 560, background: B1, border: `1px solid ${BD}`, borderRadius: 16, overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px", borderBottom: `1px solid ${BD}` }}>
          <Search size={17} color={T3} />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search everything — journal, trades, habits, scripture, wants…"
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: T1, fontSize: 15, fontFamily: "inherit" }} />
          <kbd style={{ fontSize: 10, color: T3, border: `1px solid ${BD}`, borderRadius: 5, padding: "2px 6px" }}>esc</kbd>
        </div>

        <div ref={listRef} style={{ maxHeight: "56vh", overflowY: "auto", padding: 6 }}>
          {results.length === 0 ? (
            <div style={{ padding: "26px 16px", textAlign: "center", color: T3, fontSize: 13 }}>
              No matches for “{q.trim()}”.
            </div>
          ) : results.map((r, i) => (
            <div key={r.id}>
              {r._group && r._group !== results[i - 1]?._group && (
                <div style={{ padding: "10px 12px 4px", fontSize: 10, fontWeight: 700, color: T3, letterSpacing: 1.4, textTransform: "uppercase" }}>{r._group}</div>
              )}
              <button data-i={i} onClick={() => go(r)} onMouseEnter={() => setActive(i)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                  background: i === active ? GL : "transparent" }}>
                <span style={{ width: 26, height: 26, borderRadius: 7, background: B2, border: `1px solid ${BD}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: i === active ? AC2 : T2, flexShrink: 0 }}>{r.icon || "•"}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 13.5, color: T1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.title}</span>
                  {r.subtitle && <span style={{ display: "block", fontSize: 11, color: T3, marginTop: 1 }}>{r.subtitle}</span>}
                </span>
                {i === active && <span style={{ fontSize: 10, color: T3 }}>↵</span>}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
