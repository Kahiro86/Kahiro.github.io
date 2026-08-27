// ── Training balance, on Body ────────────────────────────────────────
// What kind of training the last month actually was, and what is missing
// from it (§3). One bar per discipline and at most three sentences — the
// point is to be readable in a glance, not to be a second dashboard.
import { useMemo } from "react";
import { AC, T1, T2, T3, BD, GR, AM } from "../../shared/designTokens.js";
import { Card, SH } from "../../shared/ui.jsx";
import { trainingBalance, balanceFindings, MIN_SETS_FOR_BALANCE } from "./trainingBalance.js";

export function BalanceCard({ sessions, days = 30 }) {
  const balance = useMemo(() => trainingBalance({ sessions, days }), [sessions, days]);
  const findings = useMemo(() => balanceFindings(balance), [balance]);

  if (balance.totalSets === 0) return null;

  const worked = balance.rows.filter((r) => r.sets > 0);
  const max = Math.max(...worked.map((r) => r.sets), 1);

  return (
    <Card>
      <SH title="Training balance" sub={`${balance.totalSets} sets over ${balance.days} days, by kind`} />

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {worked.map((r) => (
          <div key={r.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11.5, color: T2, width: 128, flexShrink: 0 }}>{r.label}</span>
            <span style={{ flex: 1, height: 5, background: BD, borderRadius: 3, overflow: "hidden" }}>
              <span style={{ display: "block", height: "100%", width: `${(r.sets / max) * 100}%`, background: AC, borderRadius: 3 }} />
            </span>
            <span style={{ fontSize: 10.5, color: T3, fontFamily: "monospace", width: 84, textAlign: "right", flexShrink: 0 }}>
              {r.sets} · {r.share}%
            </span>
          </div>
        ))}
      </div>

      {/* Absent disciplines are listed rather than simply missing from the
          chart — a bar that is not drawn is easy not to notice, which is the
          opposite of what a balance report is for. */}
      {balance.rows.some((r) => r.sets === 0) && (
        <div style={{ fontSize: 11, color: T3, marginTop: 10, lineHeight: 1.55 }}>
          Nothing logged as: {balance.rows.filter((r) => r.sets === 0).map((r) => r.label.toLowerCase()).join(", ")}.
        </div>
      )}

      {findings.length > 0 && (
        <div style={{ borderTop: `1px solid ${BD}`, marginTop: 11, paddingTop: 10, display: "flex", flexDirection: "column", gap: 5 }}>
          {findings.map((f) => (
            <div key={f.id} style={{ fontSize: 12, color: T2, lineHeight: 1.5 }}>
              <span style={{ color: AM }}>·</span> {f.text}
            </div>
          ))}
        </div>
      )}

      {balance.totalSets < MIN_SETS_FOR_BALANCE && (
        <div style={{ fontSize: 10.5, color: T3, marginTop: 10 }}>
          Too few sets this month to call anything neglected — the split is shown, the judgement is not.
        </div>
      )}
    </Card>
  );
}
