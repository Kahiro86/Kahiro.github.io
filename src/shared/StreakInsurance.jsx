// ── Streak Insurance — spend an earned token to protect a missed day ──
// Honest by design: you see exactly which days are active, protected, or
// missed, and can only protect as many as you've earned. Opened from the
// command palette. Lazy.
import { useMemo } from "react";
import { X, Shield, Snowflake } from "lucide-react";
import { B1, B2, BD, BD2, T1, T2, T3, GL, GR, BL, RE, AC2 } from "./designTokens.js";
import { useStorageState } from "./useStorageState.js";
import { useConsistencyStart } from "./consistency.js";
import { FREEZE_KEY, sanitizeFreezes, availableTokens, earnedTokens, toggleFreeze, recentDays } from "./streakInsurance.js";

const STATE = {
  active: { c: GR, label: "Active" },
  protected: { c: BL, label: "Protected" },
  missed: { c: RE, label: "Missed" },
};

export function StreakInsurance({ onClose, byDay = {} }) {
  const [freezes, setFreezes] = useStorageState(FREEZE_KEY, { frozen: [] });
  const [logins] = useStorageState("xp_logins", {});
  const { start } = useConsistencyStart(logins);

  const tokens = useMemo(() => availableTokens(freezes, byDay), [freezes, byDay]);
  const earned = useMemo(() => earnedTokens(byDay), [byDay]);
  const spent = sanitizeFreezes(freezes).frozen.length;
  const days = useMemo(() => recentDays(byDay, freezes, start, 14), [byDay, freezes, start]);

  const toggle = (ds) => setFreezes((prev) => toggleFreeze(prev, byDay, ds));

  const dow = (ds) => { const [y, m, d] = ds.split("-").map(Number); return ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][new Date(y, m - 1, d).getDay()]; };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 4200, background: "rgba(0,0,0,0.66)", display: "flex", justifyContent: "center", alignItems: "flex-start", padding: "8vh 16px 24px", overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ width: "100%", maxWidth: 460, background: B1, border: `1px solid ${BD2}`, borderRadius: 18, overflow: "hidden", boxShadow: "0 24px 70px rgba(0,0,0,0.6)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", borderBottom: `1px solid ${BD}` }}>
          <Shield size={18} color={BL} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: T1 }}>Streak Insurance</div>
            <div style={{ fontSize: 11, color: T3 }}>Protect one hard day so the run survives</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><X size={17} /></button>
        </div>

        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1, background: `${BL}12`, border: `1px solid ${BL}33`, borderRadius: 12, padding: "13px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: BL, lineHeight: 1 }}>{tokens}</div>
              <div style={{ fontSize: 10, color: T3, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>Tokens ready</div>
            </div>
            <div style={{ flex: 1, background: B2, border: `1px solid ${BD}`, borderRadius: 12, padding: "13px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: T1, lineHeight: 1 }}>{spent}</div>
              <div style={{ fontSize: 10, color: T3, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.8 }}>Days protected</div>
            </div>
          </div>

          <div style={{ fontSize: 11.5, color: T3, lineHeight: 1.5 }}>
            You earn <strong style={{ color: T2 }}>one freeze token every 7 active days</strong>. Spend a token on a missed day and it counts toward your streak — earned rest, not a lie. You've earned {earned} in total.
          </div>

          <div>
            <div style={{ fontSize: 10.5, letterSpacing: 1.4, textTransform: "uppercase", fontWeight: 700, color: T3, marginBottom: 9 }}>Last 14 days</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
              {days.map((d) => {
                const st = STATE[d.state];
                const canProtect = d.state === "missed" && !d.isToday && tokens > 0;
                const canRelease = d.state === "protected";
                return (
                  <div key={d.ds} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 11px", background: B2, border: `1px solid ${BD}`, borderRadius: 9 }}>
                    <span style={{ width: 22, fontSize: 10.5, color: T3, fontWeight: 700 }}>{dow(d.ds)}</span>
                    <span style={{ flex: 1, fontSize: 12, color: T2, fontFamily: "monospace" }}>{d.ds.slice(5)}{d.isToday ? " · today" : ""}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: st.c }}>{st.label}</span>
                    {(canProtect || canRelease) && (
                      <button onClick={() => toggle(d.ds)}
                        style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 9px", borderRadius: 7, cursor: "pointer", fontFamily: "inherit", fontSize: 10.5, fontWeight: 700,
                          background: canRelease ? GL : `${BL}18`, border: `1px solid ${canRelease ? BD : BL + "55"}`, color: canRelease ? T3 : BL }}>
                        <Snowflake size={11} />{canRelease ? "Release" : "Protect"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
