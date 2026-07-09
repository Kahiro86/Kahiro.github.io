// Guided review flow: pending reviews first (daily/weekly/monthly), each
// pre-loaded with that period's real numbers, then the written history.
import { useMemo, useState } from "react";
import { ClipboardCheck, Check, Trash2 } from "lucide-react";
import { B2, BD, T1, T2, T3, GL, CY, GR, RE, AM, PU } from "../../shared/designTokens.js";
import { Card, SH, Chip } from "../../shared/ui.jsx";
import { useToast } from "../../shared/toast.jsx";
import { sanitizeReviews, newReview, pendingReviews, periodSummary, periodLabel } from "./reviews.js";

const KIND_META = {
  daily:   { label: "Daily Review",   color: CY, icon: "📋" },
  weekly:  { label: "Weekly Review",  color: PU, icon: "🗓️" },
  monthly: { label: "Monthly Review", color: AM, icon: "📊" },
};
const GRADES = [
  { id: "A", desc: "Followed the process", c: GR },
  { id: "B", desc: "Mostly disciplined",   c: AM },
  { id: "C", desc: "Broke my rules",       c: RE },
];

export function ReviewsTab({ trades, reviews, setReviews }) {
  const toast = useToast();
  const list = useMemo(() => sanitizeReviews(reviews), [reviews]);
  const pending = useMemo(() => pendingReviews(trades, list), [trades, list]);
  const [drafts, setDrafts] = useState({}); // `${kind}:${period}` -> { worked, fix, grade }

  const draftFor = (p) => drafts[`${p.kind}:${p.period}`] || { worked: "", fix: "", grade: "B" };
  const setDraft = (p, patch) =>
    setDrafts((d) => ({ ...d, [`${p.kind}:${p.period}`]: { ...draftFor(p), ...patch } }));

  const save = (p) => {
    const d = draftFor(p);
    if (!d.worked.trim() && !d.fix.trim()) return;
    setReviews((prev) => [newReview({ kind: p.kind, period: p.period, worked: d.worked.trim(), fix: d.fix.trim(), grade: d.grade }), ...sanitizeReviews(prev)]);
    setDrafts((cur) => { const n = { ...cur }; delete n[`${p.kind}:${p.period}`]; return n; });
    toast(`${KIND_META[p.kind].label} saved — loop closed ✓`, { tone: "success" });
  };
  const remove = (r) => {
    setReviews((prev) => sanitizeReviews(prev).filter((x) => x.id !== r.id));
    toast("Review deleted", { action: "Undo", onAction: () => setReviews((p) => [r, ...sanitizeReviews(p)]), tone: "danger" });
  };

  const input = { width: "100%", background: B2, border: `1px solid ${BD}`, borderRadius: 9, padding: "9px 12px", fontSize: 12.5, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box", resize: "none", lineHeight: 1.6 };
  const usd = (n) => `${n >= 0 ? "+" : "−"}$${Math.abs(Math.round(n)).toLocaleString()}`;

  return (
    <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 860 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: T1 }}>Reviews</div>
        <div style={{ fontSize: 12.5, color: T3, marginTop: 3 }}>
          Daily after any close · weekly unlocks Sunday · monthly on the last day. A pending review stays pending until it's written.
        </div>
      </div>

      {pending.length === 0 && (
        <Card style={{ padding: "26px", textAlign: "center", borderColor: `${GR}33` }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 13, color: T2 }}>Nothing pending. The next review appears automatically after your next closed trade.</div>
        </Card>
      )}

      {pending.map((p) => {
        const meta = KIND_META[p.kind];
        const s = periodSummary(trades, p.kind, p.period);
        const d = draftFor(p);
        return (
          <Card key={`${p.kind}:${p.period}`} style={{ padding: "18px", borderColor: `${meta.color}44` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 16 }}>{meta.icon}</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: meta.color }}>{meta.label}</span>
              <span style={{ fontSize: 11.5, color: T3 }}>· {periodLabel(p.kind, p.period)}</span>
              <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, letterSpacing: 1, color: AM, background: `${AM}14`, border: `1px solid ${AM}44`, borderRadius: 9, padding: "3px 9px" }}>PENDING</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 9, marginBottom: 13 }}>
              <Chip label="Trades"    value={s.count} color={meta.color} />
              <Chip label="Win rate"  value={`${s.wr}%`} color={CY} />
              <Chip label="P&L"       value={usd(s.pnl)} color={s.pnl >= 0 ? GR : RE} />
              <Chip label="Checklist" value={s.adherence == null ? "—" : `${s.adherence}%`} color={PU} />
            </div>
            <textarea value={d.worked} onChange={(e) => setDraft(p, { worked: e.target.value })}
              placeholder="What worked — the behaviours to repeat" style={{ ...input, minHeight: 52, marginBottom: 8 }} />
            <textarea value={d.fix} onChange={(e) => setDraft(p, { fix: e.target.value })}
              placeholder="What to fix — one specific adjustment" style={{ ...input, minHeight: 52, marginBottom: 10 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
              <span style={{ fontSize: 10.5, color: T3, letterSpacing: 1, textTransform: "uppercase" }}>Process grade</span>
              {GRADES.map((g) => (
                <button key={g.id} onClick={() => setDraft(p, { grade: g.id })} title={g.desc}
                  style={{ padding: "6px 13px", borderRadius: 9, fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${d.grade === g.id ? g.c + "66" : BD}`, background: d.grade === g.id ? `${g.c}18` : GL, color: d.grade === g.id ? g.c : T3 }}>
                  {g.id}
                </button>
              ))}
              <div style={{ flex: 1 }} />
              <button onClick={() => save(p)} disabled={!d.worked.trim() && !d.fix.trim()}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: d.worked.trim() || d.fix.trim() ? `${meta.color}18` : GL, border: `1px solid ${d.worked.trim() || d.fix.trim() ? meta.color + "55" : BD}`, borderRadius: 10, color: d.worked.trim() || d.fix.trim() ? meta.color : T3, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                <ClipboardCheck size={13} />Complete review
              </button>
            </div>
          </Card>
        );
      })}

      {list.length > 0 && (
        <>
          <div style={{ fontSize: 10, color: T3, letterSpacing: 2, textTransform: "uppercase", marginTop: 6 }}>History · {list.length}</div>
          {list.map((r) => {
            const meta = KIND_META[r.kind] || KIND_META.daily;
            const g = GRADES.find((x) => x.id === r.grade) || GRADES[1];
            return (
              <Card key={r.id} style={{ padding: "13px 15px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13 }}>{meta.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: meta.color }}>{meta.label}</span>
                  <span style={{ fontSize: 11, color: T3 }}>· {periodLabel(r.kind, r.period)}</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: g.c, marginLeft: "auto" }}>Grade {r.grade}</span>
                  <button onClick={() => remove(r)} aria-label="Delete review" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex", padding: 2 }}><Trash2 size={11} /></button>
                </div>
                {r.worked && <div style={{ fontSize: 12, color: T2, lineHeight: 1.6 }}><span style={{ color: GR }}>Worked:</span> {r.worked}</div>}
                {r.fix && <div style={{ fontSize: 12, color: T2, lineHeight: 1.6, marginTop: 3 }}><span style={{ color: AM }}>Fix:</span> {r.fix}</div>}
              </Card>
            );
          })}
        </>
      )}
    </div>
  );
}
