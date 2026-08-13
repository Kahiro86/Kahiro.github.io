import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } from "recharts";
import { Card, SH } from "../../shared/ui.jsx";
import { CY, BD, T2, T3 } from "../../shared/designTokens.js";
import { muscleRollup } from "../../shared/workoutLog.js";
import { localDateStr, daysAgoStr } from "../../shared/dates.js";

const LABEL = { chest: "Chest", back: "Back", shoulders: "Shoulders", arms: "Arms", core: "Core", legs: "Legs", glutes: "Glutes" };

// Trained today = 100, decays ~12pts/day, never trained in the window = 0.
const freshness = (daysSince) => (daysSince == null ? 0 : Math.max(0, Math.round(100 - daysSince * 12)));

export function MuscleRadar({ workouts }) {
  const toDs = localDateStr();
  const fromDs = daysAgoStr(27);
  const rollup = muscleRollup(workouts, fromDs, toDs, toDs).filter((r) => r.muscle in LABEL);
  const data = rollup.map((r) => ({ muscle: LABEL[r.muscle], fresh: freshness(r.daysSince), count: r.count }));
  const trained = data.some((d) => d.count > 0);

  return (
    <Card style={{ padding: "20px" }}>
      <SH title="Muscle Freshness" sub="Last 28 days — closer to the edge = trained more recently" />
      {!trained ? (
        <div style={{ padding: "20px 4px", fontSize: 12, color: T3, textAlign: "center" }}>Log a strength session to see this fill in.</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <RadarChart data={data} outerRadius="72%">
            <PolarGrid stroke={BD} />
            <PolarAngleAxis dataKey="muscle" tick={{ fill: T2, fontSize: 11 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar dataKey="fresh" stroke={CY} fill={CY} fillOpacity={0.35} />
            <Tooltip formatter={(_v, _n, p) => [`${p?.payload?.count || 0} session${p?.payload?.count === 1 ? "" : "s"}`, p?.payload?.muscle]} />
          </RadarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
