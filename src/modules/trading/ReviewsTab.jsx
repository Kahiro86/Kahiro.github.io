// Guided review flow: pending reviews first — an incident write-up after any
// breach (named enemy, variance vs drift, repair, dated re-entry), then the
// period reviews (daily/weekly/monthly) pre-loaded with real numbers — then
// the written history. A pending review stays pending until it's written.
import { useMemo, useState } from "react";
import { ClipboardCheck, Trash2, AlertTriangle } from "lucide-react";
import { B2, BD, T1, T2, T3, GL, CY, GR, RE, AM, PU } from "../../shared/designTokens.js";
import { Card, Chip } from "../../shared/ui.jsx";
import { useToast } from "../../shared/toast.jsx";
import { sanitizeReviews, newReview, pendingReviews, periodSummary, periodLabel, ENEMIES } from "./reviews.js";

const KIND_META = {
  daily:    { label: "Daily Review",    color: CY, icon: "📋" },
  weekly:   { label: "Weekly Review",   color: PU, icon: "🗓️" },
  monthly:  { label: "Monthly Review",  color: AM, icon: "📊" },
  incident: { label: "Incident Review", color: RE, icon: "⚠️" },
};
const GRADES = [
  { id: "A", desc: "Followed the process", c: GR },
  { id: "B", desc: "Mostly disciplined",   c: AM },
  { id: "C", desc: "Broke my rules",       c: RE },
];
const enemyLabel = (id) => (ENEMIES.find((e) => e.id === id) || {}).label || id;
const keyOf = (p) => (p.kind === "incident" ? `incident:${p.ref}` : `${p.kind}:${p.period}`);

export function ReviewsTab({ trades, reviews, setReviews }) {
  const toast = useToast();
  const list = useMemo(() => sanitizeReviews(reviews), [reviews]);
  const pending = useMemo(() => pendingReviews(trades, list), [trades, list]);
  const [drafts, setDrafts] = useState({});

  const draftFor = (p) => drafts[keyOf(p)] || (p.kind === "incident"
    ? { enemy: "", facts: "", variance: "", repair: "", reentry: "" }
    : { worked: "", fix: "", grade: "B" });
  const setDraft = (p, patch) => setDrafts((d) => ({ ...d, [keyOf(p)]: { ...draftFor(p), ...patch } }));
  const clearDraft = (p) => setDrafts((cur) => { const n = { ...cur }; delete n[keyOf(p)]; return n; });

  const input = { width: "100%", background: B2, border: `1px solid ${BD}`, borderRadius: 9, padding: "9px 12px", fontSize: 12.5, color: T1, outline: "none", fontFamily: "inherit", boxSizing: "border-box", resize: "none", lineHeight: 1.6 };
  const usd = (n) => `${n >= 0 ? "+" : "−"}$${Math.abs(Math.round(n)).toLocaleString()}`;

  const savePeriod = (p) => {
    const d = draftFor(p);
    if (!d.worked.trim() && !d.fix.trim()) return;
    setReviews((prev) => [newReview({ kind: p.kind, period: p.period, worked: d.worked.trim(), fix: d.fix.trim(), grade: d.grade }), ...sanitizeReviews(prev)]);
    clearDraft(p);
    toast(`${KIND_META[p.kind].label} saved — loop closed ✓`, { tone: "success" });
  };
  const saveIncident = (p) => {
    const d = draftFor(p);
    if (!d.facts.trim() || !d.enemy) return;
    setReviews((prev) => [newReview({ kind: "incident", period: p.period, ref: p.ref, enemy: d.enemy, facts: d.facts.trim(), variance: d.variance, repair: d.repair.trim(), reentry: d.reentry.trim() }), ...sanitizeReviews(prev)]);
    clearDraft(p);
    toast("Incident logged — the enemy is named ✓", { tone: "success" });
  };
  const remove = (r) => {
    setReviews((prev) => sanitizeReviews(prev).filter((x) => x.id !== r.id));
    toast("Review deleted", { action: "Undo", onAction: () => setReviews((p) => [r, ...sanitizeReviews(p)]), tone: "danger" });
  };

  const incidents = pending.filter((p) => p.kind === "incident");
  const periods = pending.filter((p) => p.kind !== "incident");

  return (
    <div style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 860 }}>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: T1 }}>Reviews</div>
        <div style={{ fontSize: 12.5, color: T3, marginTop: 3 }}>
          An incident write-up after any breach · daily after a close · weekly Sundays · monthly on the last day. A pending review stays pending until it's written.
        </div>
      </div>

      {pending.length === 0 && (
        <Card style={{ padding: "26px", textAlign: "center", borderColor: `${GR}33` }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 13, color: T2 }}>Nothing pending. No breaches to review, and the next period review appears automatically after your next closed trade.</div>
        </Card>
      )}

      {/* ── Incident reviews (breaches) — first, because they matter most ── */}
      {incidents.map((p) => {
        const t = (Array.isArray(trades) ? trades : []).find((x) => x && x.id === p.ref);
        const d = draftFor(p);
        const can = d.facts.trim() && d.enemy;
        return (
          <Card key={keyOf(p)} style={{ padding: "18px", borderColor: `${RE}55`, background: `linear-gradient(180deg,${RE}0A,transparent)` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6, flexWrap: "wrap" }}>
              <AlertTriangle size={16} color={RE} />
              <span style={{ fontSize: 14, fontWeight: 800, color: RE }}>Incident Review</span>
              <span style={{ fontSize: 11.5, color: T3 }}>· {p.label} · {periodLabel("daily", p.period)}</span>
              <span style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, letterSpacing: 1, color: RE, background: `${RE}14`, border: `1px solid ${RE}44`, borderRadius: 9, padding: "3px 9px" }}>BREACH</span>
            </div>
            {t && (
              <div style={{ fontSize: 11, color: T3, marginBottom: 12 }}>
                Checklist {(+t.checklistScore || 0)}/{+t.checklistTotal || 0}{t.checklistSkipped ? " · skipped" : ""} — the rule wasn't fully held. Name it, don't bury it.
              </div>
            )}

            <div style={{ fontSize: 10.5, color: T3, letterSpacing: 1, textTransform: "uppercase", marginBottom: 7 }}>Which enemy?</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
              {ENEMIES.map((e) => (
                <button key={e.id} onClick={() => setDraft(p, { enemy: e.id })} title={e.desc}
                  style={{ padding: "7px 12px", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${d.enemy === e.id ? RE + "66" : BD}`, background: d.enemy === e.id ? `${RE}18` : GL, color: d.enemy === e.id ? RE : T2 }}>
                  {e.label}
                </button>
              ))}
            </div>

            <textarea value={d.facts} onChange={(e) => setDraft(p, { facts: e.target.value })}
              placeholder="What happened — facts only, no story" style={{ ...input, minHeight: 52, marginBottom: 10 }} />

            <div style={{ fontSize: 10.5, color: T3, letterSpacing: 1, textTransform: "uppercase", marginBottom: 7 }}>Variance or drift?</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
              {[["variance", "Variance", "A valid setup that lost — the cost of doing business", GR], ["drift", "Drift", "Outside the plan — this is the failure", RE]].map(([id, label, desc, c]) => (
                <button key={id} onClick={() => setDraft(p, { variance: id })} title={desc}
                  style={{ flex: "1 1 180px", textAlign: "left", padding: "9px 12px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", border: `1px solid ${d.variance === id ? c + "66" : BD}`, background: d.variance === id ? `${c}14` : GL }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: d.variance === id ? c : T1 }}>{label}</div>
                  <div style={{ fontSize: 10.5, color: T3, marginTop: 2 }}>{desc}</div>
                </button>
              ))}
            </div>

            <textarea value={d.repair} onChange={(e) => setDraft(p, { repair: e.target.value })}
              placeholder="The countermeasure that failed, and its repair" style={{ ...input, minHeight: 46, marginBottom: 8 }} />
            <input value={d.reentry} onChange={(e) => setDraft(p, { reentry: e.target.value })}
              placeholder="Re-entry condition — specific and dated" style={{ ...input, marginBottom: 12 }} />

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => saveIncident(p)} disabled={!can}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 18px", background: can ? `${RE}18` : GL, border: `1px solid ${can ? RE + "66" : BD}`, borderRadius: 10, color: can ? RE : T3, fontSize: 12.5, fontWeight: 700, cursor: can ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
                <ClipboardCheck size={13} />Log the incident
              </button>
            </div>
          </Card>
        );
      })}

      {/* ── Period reviews (daily / weekly / monthly) ── */}
      {periods.map((p) => {
        const meta = KIND_META[p.kind];
        const s = periodSummary(trades, p.kind, p.period);
        const d = draftFor(p);
        return (
          <Card key={keyOf(p)} style={{ padding: "18px", borderColor: `${meta.color}44` }}>
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
              <button onClick={() => savePeriod(p)} disabled={!d.worked.trim() && !d.fix.trim()}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 16px", background: d.worked.trim() || d.fix.trim() ? `${meta.color}18` : GL, border: `1px solid ${d.worked.trim() || d.fix.trim() ? meta.color + "55" : BD}`, borderRadius: 10, color: d.worked.trim() || d.fix.trim() ? meta.color : T3, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                <ClipboardCheck size={13} />Complete review
              </button>
            </div>
          </Card>
        );
      })}

      {/* ── History ── */}
      {list.length > 0 && (
        <>
          <div style={{ fontSize: 10, color: T3, letterSpacing: 2, textTransform: "uppercase", marginTop: 6 }}>History · {list.length}</div>
          {list.map((r) => {
            const meta = KIND_META[r.kind] || KIND_META.daily;
            if (r.kind === "incident") {
              return (
                <Card key={r.id} style={{ padding: "13px 15px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13 }}>{meta.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: RE }}>Incident</span>
                    <span style={{ fontSize: 11, color: T3 }}>· {periodLabel("daily", r.period)}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: RE, background: `${RE}14`, border: `1px solid ${RE}44`, borderRadius: 8, padding: "2px 8px" }}>{enemyLabel(r.enemy)}</span>
                    {r.variance && <span style={{ fontSize: 10.5, fontWeight: 700, color: r.variance === "drift" ? RE : GR }}>{r.variance === "drift" ? "Drift" : "Variance"}</span>}
                    <button onClick={() => remove(r)} aria-label="Delete review" style={{ marginLeft: "auto", background: "none", border: "none", color: T3, cursor: "pointer", display: "flex", padding: 2 }}><Trash2 size={11} /></button>
                  </div>
                  {r.facts && <div style={{ fontSize: 12, color: T2, lineHeight: 1.6 }}>{r.facts}</div>}
                  {r.repair && <div style={{ fontSize: 12, color: T2, lineHeight: 1.6, marginTop: 3 }}><span style={{ color: AM }}>Repair:</span> {r.repair}</div>}
                  {r.reentry && <div style={{ fontSize: 12, color: T2, lineHeight: 1.6, marginTop: 3 }}><span style={{ color: CY }}>Re-entry:</span> {r.reentry}</div>}
                </Card>
              );
            }
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
