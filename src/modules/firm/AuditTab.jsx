// ── The Firm Audit — HQ tab ──────────────────────────────────────────
// Renders runAudit()'s findings the way a firm reads its own books: an
// integrity score, the blocking count, then each inconsistency with the fix
// that closes it. Recomputed live from finance + firm config; "Run again"
// just re-reads.
import { useMemo, useState } from "react";
import { AlertCircle, AlertTriangle, Scale, Info, ArrowRight, RefreshCw, ClipboardCheck } from "lucide-react";
import { B2, BD, T1, T2, T3, GL, GR, RE, AM, AC2 } from "../../shared/designTokens.js";
import { Card, SH } from "../../shared/ui.jsx";
import { runAudit } from "./audit.js";

const SEV = {
  blocking: { color: RE, label: "Blocking", Icon: AlertCircle },
  doctrine: { color: AM, label: "Doctrine", Icon: AlertTriangle },
  pace: { color: AM, label: "Pace", Icon: AlertTriangle },
  tension: { color: AC2, label: "Tension", Icon: Scale },
  design: { color: T3, label: "By design", Icon: Info },
};

function Metric({ label, value, sub, color }) {
  return (
    <div style={{ background: B2, border: `1px solid ${BD}`, borderRadius: 13, padding: "13px 15px" }}>
      <div style={{ fontSize: 9.5, color: T3, letterSpacing: 0.9, textTransform: "uppercase", marginBottom: 7 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || T1, lineHeight: 1, letterSpacing: -0.5, fontFamily: "'JetBrains Mono',monospace" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: T3, marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function Finding({ f }) {
  const s = SEV[f.sev] || SEV.design;
  return (
    <div style={{ display: "flex", gap: 11, padding: "13px 0", borderBottom: `1px solid ${GL}` }}>
      <div style={{ flexShrink: 0, paddingTop: 1 }}><s.Icon size={16} color={s.color} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T1, marginBottom: 4, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {f.title}
          <span style={{ fontSize: 8, letterSpacing: 0.5, textTransform: "uppercase", padding: "2px 6px", borderRadius: 4, background: `${s.color}18`, color: s.color }}>{f.tag || s.label}</span>
        </div>
        <div style={{ fontSize: 11.5, color: T2, lineHeight: 1.6 }}>{f.detail}</div>
        {f.fix && (
          <div style={{ fontSize: 11, color: AC2, marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
            <ArrowRight size={12} />{f.fix}
          </div>
        )}
      </div>
    </div>
  );
}

export function AuditTab({ finance, config }) {
  const [runs, setRuns] = useState(0); // bump to re-run
  const audit = useMemo(() => runAudit({ finance, config }), [finance, config, runs]);
  const { integrity, findings, blocking } = audit;
  const iColor = integrity >= 85 ? GR : integrity >= 60 ? AM : RE;

  // Group by severity in a stable, worst-first order.
  const order = ["blocking", "doctrine", "pace", "tension", "design"];
  const grouped = order
    .map((sev) => ({ sev, items: findings.filter((f) => f.sev === sev) }))
    .filter((g) => g.items.length);
  const cardBorder = (sev) => (sev === "blocking" ? `${RE}44` : sev === "design" ? BD : `${AM}44`);

  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 16, maxWidth: 780 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: T1, display: "flex", alignItems: "center", gap: 9 }}>
          <ClipboardCheck size={20} color={AC2} /> The Audit
        </div>
        <div style={{ fontSize: 12.5, color: T3, marginTop: 4 }}>
          Numbers before feelings — including the app's own. {findings.length} issue{findings.length === 1 ? "" : "s"} found · last run {audit.ranAt}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <Metric label="Integrity" value={<>{integrity}<span style={{ fontSize: 12, color: T3, fontWeight: 400 }}>/100</span></>} sub={blocking ? `${blocking} blocking` : "no blockers"} color={iColor} />
        <Metric label="Clean books" value={findings.length === 0 ? "Yes" : "No"} sub={findings.length === 0 ? "every check passed" : `${findings.length} to resolve`} color={findings.length === 0 ? GR : T1} />
      </div>

      {findings.length === 0 ? (
        <Card style={{ padding: "22px", textAlign: "center", borderColor: `${GR}33` }}>
          <ClipboardCheck size={26} color={GR} />
          <div style={{ fontSize: 14, fontWeight: 700, color: GR, marginTop: 8 }}>The books are clean.</div>
          <div style={{ fontSize: 12, color: T2, marginTop: 4 }}>Every consistency check passed — income logged, targets aligned, firewalls holding.</div>
        </Card>
      ) : (
        grouped.map((g) => (
          <Card key={g.sev} style={{ padding: "6px 16px 12px", borderColor: cardBorder(g.sev) }}>
            {g.items.map((f) => <Finding key={f.id} f={f} />)}
          </Card>
        ))
      )}

      <button onClick={() => setRuns((n) => n + 1)}
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", padding: "12px", borderRadius: 11, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700,
          background: `${AC2}12`, border: `1px solid ${AC2}44`, color: AC2 }}>
        <RefreshCw size={13} /> Run audit again
      </button>
    </div>
  );
}
