// ── This week's focus, on the today surface ──────────────────────────
// Once a weekly focus is set it stops being a passive stat: it sits here every
// open, with a one-tap daily check-in ("did today serve it?") and — if it's
// been under-served — a plain, neutral notice. Reads weekly_focus (the single
// source of truth) plus the check-in log; writes only the day's answer.
// Self-hiding: renders nothing until a focus exists. Never a gate.
import { useMemo } from "react";
import { Compass } from "lucide-react";
import { B0, B2, BD, T1, T2, T3, AC2, GR, AM, RE, SERIF } from "./designTokens.js";
import { useStorageState } from "./useStorageState.js";
import { localDateStr } from "./dates.js";
import { focusThisWeek, isDismissed } from "./review.js";
import {
  CHECKIN_KEY, CHECKIN_CFG_KEY, ANSWERS, setCheckin, getCheckin, needsCheckin,
  underServedCount, isUnderServed,
} from "./focusCheckin.js";

const TONE = { good: GR, mid: AM, bad: RE };

export function FocusToday() {
  const [focusRaw] = useStorageState("weekly_focus", {});
  const [checkins, setCheckins] = useStorageState(CHECKIN_KEY, {});
  const [cfg] = useStorageState(CHECKIN_CFG_KEY, { cadence: "daily" });
  const ds = localDateStr();

  const focus = focusThisWeek(focusRaw);
  const todayAnswer = useMemo(() => getCheckin(checkins, ds), [checkins, ds]);
  const askNow = useMemo(() => needsCheckin(checkins, cfg), [checkins, cfg]);
  const under = useMemo(() => isUnderServed(checkins), [checkins]);
  const underN = useMemo(() => underServedCount(checkins), [checkins]);

  if (!focus || isDismissed(focus)) return null; // nothing set → self-hide

  const answer = (id) => setCheckins((prev) => setCheckin(prev, ds, id));

  return (
    <div style={{ background: "linear-gradient(180deg,#171009,#0D0A06)", border: `1px solid ${AC2}33`, borderRadius: 14, padding: "15px 17px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 10, fontWeight: 700, color: AC2, letterSpacing: 2, textTransform: "uppercase" }}>
        <Compass size={13} /> This week's focus
      </div>
      <div style={{ fontFamily: SERIF, fontSize: 19, color: T1, marginTop: 7, lineHeight: 1.3 }}>{focus}</div>

      {under && (
        <div style={{ marginTop: 11, fontSize: 12, color: T2, background: B0, border: `1px solid ${BD}`, borderRadius: 9, padding: "9px 11px", lineHeight: 1.45 }}>
          Under-served — {underN} of this week's days didn't serve it.
        </div>
      )}

      {askNow ? (
        <div style={{ marginTop: 13 }}>
          <div style={{ fontSize: 12.5, color: T2, marginBottom: 8 }}>Did today serve this week's focus?</div>
          <div style={{ display: "flex", gap: 8 }}>
            {ANSWERS.map((a) => (
              <button key={a.id} onClick={() => answer(a.id)}
                style={{ flex: 1, padding: "9px 6px", borderRadius: 9, cursor: "pointer", fontFamily: "inherit", fontSize: 12.5, fontWeight: 700, background: `${TONE[a.tone]}14`, border: `1px solid ${TONE[a.tone]}55`, color: TONE[a.tone] }}>
                {a.label}
              </button>
            ))}
          </div>
        </div>
      ) : todayAnswer ? (
        <div style={{ marginTop: 11, display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: T3 }}>
          Today: <span style={{ color: TONE[ANSWERS.find((a) => a.id === todayAnswer)?.tone] || T2, fontWeight: 700 }}>{ANSWERS.find((a) => a.id === todayAnswer)?.label}</span>
          <button onClick={() => setCheckins((prev) => { const c = { ...prev }; delete c[ds]; return c; })}
            style={{ marginLeft: "auto", background: "none", border: "none", color: T3, fontSize: 11, cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}>change</button>
        </div>
      ) : null}
    </div>
  );
}
