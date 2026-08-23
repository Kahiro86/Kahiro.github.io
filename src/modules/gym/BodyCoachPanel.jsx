// ── Body · Coach (spec §2.3) ─────────────────────────────────────────
// A renderer, deliberately. Every sentence comes from bodyCoach.js, which is
// where the prohibitions are enforced and tested; this file adds no copy of
// its own beyond the section labels, so there is exactly one place where the
// Coach's vocabulary can change.
import { useMemo } from "react";
import { MessageCircle, AlertCircle } from "lucide-react";
import { BD, T1, T2, T3, AC2, AM, GR } from "../../shared/designTokens.js";
import { Card, SH, Empty } from "../../shared/ui.jsx";
import { useStorageState } from "../../shared/useStorageState.js";
import { localDateStr } from "../../shared/dates.js";
import { sanitizeNutrition, sanitizeProfile } from "../athlete/nutrition.js";
import { bodyCoach } from "../athlete/bodyCoach.js";

export function BodyCoachPanel({ sessions }) {
  const [rawLog] = useStorageState("nutrition_log", {});
  const [rawProfile] = useStorageState("nutrition_profile", {});
  const [measurements] = useStorageState("athlete_measurements", []);
  const today = localDateStr();

  const log = useMemo(() => sanitizeNutrition(rawLog), [rawLog]);
  const profile = useMemo(() => sanitizeProfile(rawProfile), [rawProfile]);
  const c = useMemo(
    () => bodyCoach({ log, profile, sessions, measurements, today }),
    [log, profile, sessions, measurements, today],
  );

  const empty = !c.notes.length && !c.gaps.length && !c.question;

  return (
    <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
      <div style={{ fontSize: 11.5, color: T2 }}>
        {c.loggedDays} of the last {c.window} days logged
        {c.reliable ? "" : " · read everything below as provisional"}
      </div>

      {empty && (
        <Empty icon="🪞" title="Nothing to reflect back yet"
          sub="The Coach reads your own logs. Once there's a week of sessions or meals, it starts describing what actually happened." />
      )}

      {c.gaps.length > 0 && (
        <Card style={{ padding: "14px 16px", border: `1px solid ${AM}33`, background: `${AM}08` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <AlertCircle size={14} color={AM} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: T1 }}>Before reading the rest</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {c.gaps.map((g) => (
              <div key={g.k} style={{ fontSize: 12, color: T2, lineHeight: 1.65 }}>{g.text}</div>
            ))}
          </div>
        </Card>
      )}

      {c.notes.length > 0 && (
        <Card style={{ padding: "16px 18px" }}>
          <SH title="What actually happened" />
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 11 }}>
            {c.notes.map((n) => (
              <div key={n.k} style={{ display: "flex", gap: 9, fontSize: 12.5, color: T2, lineHeight: 1.6 }}>
                <span style={{ color: T3, flexShrink: 0 }}>·</span>
                <span>{n.text}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {c.question && (
        <Card style={{ padding: "16px 18px", border: `1px solid ${AC2}33`, background: `${AC2}08` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
            <MessageCircle size={14} color={AC2} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: T1 }}>This week's question</span>
          </div>
          <div style={{ fontSize: 13.5, color: T1, lineHeight: 1.6, fontStyle: "italic" }}>{c.question}</div>
          <div style={{ fontSize: 10.5, color: T3, marginTop: 9, paddingTop: 9, borderTop: `1px solid ${BD}`, lineHeight: 1.55 }}>
            There is nowhere to submit an answer, and nothing scores it. It is here to be sat with.
          </div>
        </Card>
      )}

      <div style={{ fontSize: 10.5, color: T3, lineHeight: 1.6 }}>
        The Coach describes your own logs back to you. It does not set targets — those are yours, in Fuel settings — and it does not write training plans.
      </div>
    </div>
  );
}
