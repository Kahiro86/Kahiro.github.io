// ── Monthly overhead, on the today surface ───────────────────────────
// Once a ceiling is set it stays in view every open (not just month-end):
// actual-vs-target, a linear month-end projection when on pace to exceed, and
// which checkpoints have been crossed (recorded once per month for the
// archive). Reads the same monthly_overhead target + the actual the surface
// already computes. Self-hiding until a target is set. Never a gate.
import { useEffect, useMemo } from "react";
import { Gauge } from "lucide-react";
import { B0, B2, BD, T1, T2, T3, GR, AM, RE } from "./designTokens.js";
import { useStorageState } from "./useStorageState.js";
import { sanitizeOverhead } from "./today.js";
import {
  ALERTS_KEY, ARCHIVE_KEY, OVERHEAD_CFG_KEY, monthKey,
  overheadStatus, newAlerts, recordAlerts,
} from "./overheadPriority.js";

const kes = (v) => Math.round(+v || 0).toLocaleString();

export function OverheadToday({ actual = 0 }) {
  const [rawOverhead] = useStorageState("monthly_overhead", {});
  const [cfg] = useStorageState(OVERHEAD_CFG_KEY, {});
  const [fired, setFired] = useStorageState(ALERTS_KEY, {});
  const [, setArchive] = useStorageState(ARCHIVE_KEY, []);
  const target = sanitizeOverhead(rawOverhead).targetKsh;

  const st = useMemo(() => overheadStatus(target, actual, cfg), [target, actual, cfg]);
  const pending = useMemo(() => newAlerts(fired, target, actual, cfg), [fired, target, actual, cfg]);

  // Fire-once per month: record any newly-crossed checkpoints (for the archive
  // and any future push channel). The persistent line below states the current
  // fact regardless — this only prevents re-notifying.
  useEffect(() => {
    if (target > 0 && pending.length) setFired((prev) => recordAlerts(prev, pending));
  }, [pending.length, target]); // eslint-disable-line

  // Running month archive: upsert this month's actual-vs-target + fired levels,
  // so at month close the final figures are already archived (same shape the
  // weekly archive uses).
  useEffect(() => {
    if (!(target > 0)) return;
    const mk = monthKey();
    setArchive((prev) => {
      const arr = Array.isArray(prev) ? prev : [];
      const rec = { month: mk, target, actual: Math.round(actual || 0), fired: Array.isArray(fired[mk]) ? fired[mk] : [] };
      const i = arr.findIndex((a) => a && a.month === mk);
      if (i >= 0) { if (JSON.stringify(arr[i]) === JSON.stringify(rec)) return prev; const c = [...arr]; c[i] = rec; return c; }
      return [rec, ...arr].slice(0, 60);
    });
  }, [target, actual, fired]); // eslint-disable-line

  if (!(target > 0)) return null; // no ceiling set → self-hide

  const color = st.pct >= 100 ? RE : st.pct >= 80 ? AM : GR;

  return (
    <div style={{ background: B2, border: `1px solid ${BD}`, borderRadius: 12, padding: "13px 15px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Gauge size={13} color={T3} />
        <span style={{ fontSize: 10.5, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, color: T3 }}>Monthly overhead</span>
        <span style={{ marginLeft: "auto", fontSize: 12.5, color: T2, fontFamily: "monospace" }}>
          KSh {kes(actual)} <span style={{ color: T3 }}>/ {kes(target)}</span>
        </span>
      </div>
      <div style={{ height: 5, background: B0, borderRadius: 3, overflow: "hidden", marginTop: 9 }}>
        <div style={{ width: `${Math.min(100, st.pct)}%`, height: "100%", background: color, transition: "width .3s" }} />
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 7, fontSize: 11, color: T3, flexWrap: "wrap" }}>
        <span style={{ color, fontWeight: 700 }}>{st.pct}%</span>
        {st.over && <span>Over by KSh {kes(actual - target)}.</span>}
        {!st.over && st.projection?.onPace && <span>On pace for KSh {kes(st.projection.proj)} by month-end.</span>}
      </div>
    </div>
  );
}
