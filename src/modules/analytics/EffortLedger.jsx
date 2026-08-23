// ── The XP & effort ledger (criterion 29) ────────────────────────────
// Every habit's difficulty weight, and the completion rate driving it, made
// inspectable. The engine has always known these numbers; until now nothing
// rendered them, which is the same as not having them — §4.3 is explicit that
// a hidden formula feels arbitrary even when it isn't.
//
// The day list below is the banked ledger itself: what was earned, on what,
// with every multiplier that touched it. Nothing here recomputes anything —
// it reads what the engine banked (criterion 23).
import { useMemo, useState } from "react";
import { B2, BD, T1, T2, T3, AC, AC2, GR, AM } from "../../shared/designTokens.js";
import { Card, SH, Empty } from "../../shared/ui.jsx";
import { DIFFICULTY_BANDS, DOMAINS } from "../../shared/xp/values.js";

const bandColor = (w) => (w <= 0.6 ? T3 : w <= 1 ? T2 : w <= 1.4 ? AM : AC);
const pctOrDash = (r) => (r == null ? "—" : `${Math.round(r * 100)}%`);

export function EffortLedger({ xp }) {
  const [openDay, setOpenDay] = useState(null);

  const habits = useMemo(() => {
    const byHabit = xp?.difficulty?.byHabit || {};
    return Object.entries(byHabit)
      .map(([id, d]) => ({ id, ...d }))
      .sort((a, b) => b.weight - a.weight || (b.rate ?? 0) - (a.rate ?? 0));
  }, [xp?.difficulty]);

  const days = useMemo(() => {
    const all = xp?.ledger?.days || {};
    return Object.entries(all)
      .filter(([, d]) => d.total > 0)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 30);
  }, [xp?.ledger]);

  const window = xp?.difficulty?.window ?? 60;

  return (
    <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 900 }}>
      {xp?.opening && (
        <div style={{ fontSize: 11.5, color: T3, lineHeight: 1.6 }}>
          {xp.opening.xp.toLocaleString()} XP carried forward from {xp.opening.at}, before the engine was rebuilt. {xp.opening.note}
        </div>
      )}

      {/* ── What each habit is worth, and why ── */}
      <Card style={{ padding: "16px 18px" }}>
        <SH title="Effort weighting" />
        <div style={{ fontSize: 11.5, color: T3, margin: "8px 0 14px", lineHeight: 1.6 }}>
          A habit's weight comes from your own record with it over the last {window} days — not from a difficulty setting.
          One you've mastered stops paying much; one you're still fighting pays more.
        </div>

        {habits.length === 0 ? (
          <Empty icon="🎚️" title="No habits measured yet" sub="Weights appear once a habit has been scheduled enough times to have a rate." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {habits.map((h) => (
              <div key={h.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto", gap: 12, alignItems: "center", padding: "9px 0", borderBottom: `1px solid ${BD}` }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: T1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.id}</div>
                  <div style={{ fontSize: 10.5, color: T3, marginTop: 2 }}>
                    {h.provisional
                      ? h.band.why
                      : `landed ${h.completed} of ${h.scheduled} scheduled`}
                  </div>
                </div>
                <div style={{ fontSize: 11.5, color: T2, fontFamily: "'JetBrains Mono',monospace", textAlign: "right" }}>{pctOrDash(h.rate)}</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: bandColor(h.weight), fontFamily: "'JetBrains Mono',monospace", minWidth: 92, textAlign: "right" }}>
                  ×{h.weight.toFixed(1)}
                  <span style={{ display: "block", fontSize: 9, fontWeight: 400, color: T3, letterSpacing: 0.4 }}>{h.band.l}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 13, paddingTop: 12, borderTop: `1px solid ${BD}` }}>
          {DIFFICULTY_BANDS.map((b) => (
            <span key={b.l} style={{ fontSize: 10.5, color: T3, fontFamily: "'JetBrains Mono',monospace" }}>
              <span style={{ color: bandColor(b.w), fontWeight: 600 }}>×{b.w.toFixed(1)}</span> {b.l} · {b.min === 0 ? "<50%" : `${Math.round(b.min * 100)}%+`}
            </span>
          ))}
        </div>
      </Card>

      {/* ── Where the XP actually came from ── */}
      <Card style={{ padding: "16px 18px" }}>
        <SH title="The ledger" />
        <div style={{ fontSize: 11.5, color: T3, margin: "8px 0 12px", lineHeight: 1.6 }}>
          Last {days.length} earning day{days.length === 1 ? "" : "s"}. A sealed day never changes — archiving or deleting a habit
          cannot take back what it already paid.
        </div>
        {days.length === 0 ? (
          <Empty icon="📒" title="Nothing banked yet" sub="Log something and the day appears here with every line that paid." />
        ) : days.map(([ds, day]) => {
          const open = openDay === ds;
          return (
            <div key={ds} style={{ borderBottom: `1px solid ${BD}` }}>
              <button type="button" onClick={() => setOpenDay(open ? null : ds)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 0", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
                <span style={{ fontSize: 12, color: T2, fontFamily: "'JetBrains Mono',monospace", minWidth: 74 }}>{ds.slice(5)}</span>
                <span style={{ flex: 1, fontSize: 11, color: T3 }}>
                  {Object.entries(day.byDomain).map(([k, v]) => `${DOMAINS[k]?.l || k} ${v}`).join(" · ")}
                </span>
                {!day.sealedAt && <span style={{ fontSize: 9, color: AM, letterSpacing: 0.6, textTransform: "uppercase" }}>today</span>}
                <span style={{ fontSize: 13, fontWeight: 700, color: GR, fontFamily: "'JetBrains Mono',monospace" }}>{day.total}</span>
              </button>
              {open && (
                <div style={{ paddingBottom: 12, display: "flex", flexDirection: "column", gap: 5 }}>
                  {day.lines.map((l, i) => (
                    <div key={`${l.k}${i}`} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: T2, background: B2, borderRadius: 7, padding: "7px 10px" }}>
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.l}</span>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 10, color: T3 }}>
                        {l.b}{l.d !== 1 ? ` ×${l.d}` : ""}{l.c !== 1 ? ` ×${l.c}` : ""}{l.r !== 1 ? ` ×${l.r}` : ""}{l.f !== 1 ? ` ×${l.f}` : ""}
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: l.cap ? AM : AC2, minWidth: 30, textAlign: "right" }}>{l.x}</span>
                    </div>
                  ))}
                  {day.lines.some((l) => l.cap) && (
                    <div style={{ fontSize: 10.5, color: T3, paddingLeft: 2 }}>
                      Amber lines hit that domain's daily cap. They still logged and still counted toward streaks.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
