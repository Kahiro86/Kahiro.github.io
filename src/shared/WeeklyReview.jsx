// ── Week in Review — the Sunday "did I win?" screen ──────────────────
// One screen, once a week: the score you earned vs last week's, which
// habits held and which slipped, a few real wins, and one focus to carry
// into the week ahead (seeded from your weakest area). Auto-surfaces on
// Sundays via the gate below; openable any day from the cockpit.
import { useMemo, useState, useEffect, useRef } from "react";
import { X, TrendingUp, TrendingDown, Minus, Target, Check } from "lucide-react";
import { B0, B1, BD, T1, T2, T3, AC, GR, AM, RE } from "./designTokens.js";
import { useStorageState } from "./useStorageState.js";
import { buildWeekReview, suggestFocus } from "./weekReview.js";
import { setFocus, dismissFocus, isoWeekKey, sanitizeFocus, isDismissed } from "./review.js";
import { localDateStr } from "./dates.js";

const tomorrowStr = () => { const d = new Date(); d.setDate(d.getDate() + 1); return d; };

export function WeeklyReview({ habits, onClose }) {
  const [workouts] = useStorageState("athlete_workouts", []);
  const [nutrition] = useStorageState("nutrition_log", {});
  const [entries] = useStorageState("journal_entries", []);
  const [purity] = useStorageState("purity_log", {});
  const [focusRaw, setFocusRaw] = useStorageState("weekly_focus", {});

  const review = useMemo(
    () => buildWeekReview({ habits, workouts, nutrition, entries, purity, ds: localDateStr() }),
    [habits, workouts, nutrition, entries, purity]
  );

  // The focus applies to the week ahead: on Sunday (a complete week) that's
  // next week's key; on a mid-week open it's this week's.
  const targetDate = review.complete ? tomorrowStr() : new Date();
  const key = isoWeekKey(targetDate);
  const existing = sanitizeFocus(focusRaw)[key];
  const [text, setText] = useState(existing && !isDismissed(existing) ? existing : suggestFocus(review.weakest));
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const scoreColor = review.score >= 80 ? GR : review.score >= 50 ? AM : RE;
  const dcolor = review.delta > 0 ? GR : review.delta < 0 ? RE : T3;
  const DeltaIcon = review.delta > 0 ? TrendingUp : review.delta < 0 ? TrendingDown : Minus;
  const big = { fontFamily: "'JetBrains Mono',monospace", fontWeight: 900, color: T1, lineHeight: 1 };

  const lockIn = () => { setFocusRaw(setFocus(focusRaw, text, targetDate)); setSaved(true); };
  const skip = () => { setFocusRaw(dismissFocus(focusRaw, targetDate)); onClose(); };

  const Section = ({ label, children }) => (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: T3, letterSpacing: 2, textTransform: "uppercase", marginBottom: 10 }}>{label}</div>
      {children}
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.62)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 14 }} onClick={onClose}>
      <div role="dialog" aria-label="Week in Review" onClick={(e) => e.stopPropagation()}
        style={{ width: 470, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", background: B1, border: `1px solid ${BD}`, borderRadius: 18, padding: 24, animation: "reviewRise .32s cubic-bezier(0.16,1,0.3,1) both" }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: T1 }}>Week in Review</div>
            <div style={{ fontSize: 12, color: T3, marginTop: 2 }}>{review.rangeLabel}{review.complete ? "" : " · in progress"}</div>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: T3, cursor: "pointer", display: "flex" }}><X size={17} /></button>
        </div>

        {/* Hero score */}
        <div style={{ display: "flex", alignItems: "center", gap: 22, padding: "18px 20px", background: B0, border: `1px solid ${BD}`, borderRadius: 14 }}>
          <div>
            <div style={{ fontSize: 52, ...big, color: scoreColor }}>{review.score}%</div>
            <div style={{ fontSize: 10, color: T3, letterSpacing: 1.5, textTransform: "uppercase", marginTop: 4 }}>Week score</div>
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ textAlign: "right" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end", color: dcolor, fontWeight: 800, fontSize: 18 }}>
              <DeltaIcon size={16} />{review.delta > 0 ? `+${review.delta}` : review.delta}%
            </div>
            <div style={{ fontSize: 10.5, color: T3, marginTop: 4 }}>vs last week ({review.prevScore}%)</div>
          </div>
        </div>

        {/* Habits held / slipped */}
        {review.keptTotal > 0 && (
          <Section label={`Habits · ${review.kept.length}/${review.keptTotal} held all week`}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {review.kept.map((r) => (
                <span key={r.name} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: T1, background: `${GR}18`, border: `1px solid ${GR}44`, borderRadius: 8, padding: "5px 9px" }}>
                  <span>{r.icon}</span>{r.name}
                </span>
              ))}
              {review.slipped.map((r) => (
                <span key={r.name} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: T2, background: `${AM}14`, border: `1px solid ${AM}3A`, borderRadius: 8, padding: "5px 9px" }}>
                  <span>{r.icon}</span>{r.name}<span style={{ color: AM, fontWeight: 700 }}>{r.pct}%</span>
                </span>
              ))}
              {review.kept.length === 0 && review.slipped.length === 0 && (
                <span style={{ fontSize: 12, color: T3 }}>Steady week — nothing perfect, nothing badly slipped.</span>
              )}
            </div>
          </Section>
        )}

        {/* Wins */}
        {review.wins.length > 0 && (
          <Section label="Wins">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {review.wins.map((w, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: T1 }}>
                  <span style={{ fontSize: 15 }}>{w.icon}</span>{w.text}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* One focus for the week ahead */}
        <Section label="One focus for the week ahead">
          {review.weakest && (
            <div style={{ fontSize: 11.5, color: T3, marginBottom: 9 }}>
              Weakest area lately: <span style={{ color: AM, fontWeight: 700 }}>{review.weakest.cat}</span> ({review.weakest.pct}% over 30 days).
            </div>
          )}
          {saved ? (
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 14px", background: `${GR}14`, border: `1px solid ${GR}44`, borderRadius: 11, color: T1, fontSize: 13.5 }}>
              <Check size={16} color={GR} /> Focus locked in: <span style={{ fontWeight: 700 }}>{text}</span>
            </div>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 9, background: B0, border: `1px solid ${BD}`, borderRadius: 11, padding: "10px 12px" }}>
                <Target size={16} color={AC} style={{ flexShrink: 0 }} />
                <input value={text} onChange={(e) => setText(e.target.value.slice(0, 60))} placeholder="e.g. Show up for Fitness"
                  onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) lockIn(); }}
                  style={{ flex: 1, background: "none", border: "none", outline: "none", color: T1, fontSize: 14, fontFamily: "inherit" }} />
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button onClick={lockIn} disabled={!text.trim()}
                  style={{ flex: 1, background: AC, border: "none", borderRadius: 11, padding: "11px 0", color: "#fff", fontWeight: 700, fontSize: 13.5, cursor: text.trim() ? "pointer" : "not-allowed", opacity: text.trim() ? 1 : 0.5, fontFamily: "inherit" }}>
                  Lock in focus
                </button>
                <button onClick={skip}
                  style={{ background: "none", border: `1px solid ${BD}`, borderRadius: 11, padding: "11px 16px", color: T2, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>
                  Skip this week
                </button>
              </div>
            </>
          )}
        </Section>

        {saved && (
          <button onClick={onClose} style={{ width: "100%", marginTop: 16, background: "none", border: `1px solid ${BD}`, borderRadius: 11, padding: "11px 0", color: T2, fontSize: 13.5, cursor: "pointer", fontFamily: "inherit" }}>
            Done
          </button>
        )}
      </div>
    </div>
  );
}

// ── Gate: auto-open on Sundays until the week ahead has a focus set ──
// Mounted always; renders nothing until it decides to surface (or the user
// opens it manually via `openSignal`). Writing a focus/skip closes the loop.
export function WeeklyReviewGate({ habits, openSignal = 0 }) {
  const [focusRaw, , loaded] = useStorageState("weekly_focus", {});
  const [open, setOpen] = useState(false);
  const [autoDone, setAutoDone] = useState(false);
  const seen = useRef(openSignal);

  // Manual open from the cockpit button — fires each time the counter ticks.
  useEffect(() => {
    if (openSignal !== seen.current) { seen.current = openSignal; if (openSignal > 0) setOpen(true); }
  }, [openSignal]);

  // Auto-open once on Sundays if the coming week has no focus decision yet.
  useEffect(() => {
    if (!loaded || autoDone) return;
    const d = new Date();
    if (d.getDay() !== 0) return; // Sundays only
    const t = new Date(); t.setDate(t.getDate() + 1);
    const key = isoWeekKey(t);
    if (!sanitizeFocus(focusRaw)[key]) { setOpen(true); setAutoDone(true); }
  }, [loaded, focusRaw, autoDone]);

  if (!open) return null;
  return <WeeklyReview habits={habits} onClose={() => setOpen(false)} />;
}
