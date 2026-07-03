import { Cpu } from "lucide-react";
import { T1, T2, T3, CY } from "./designTokens.js";
import { Card } from "./ui.jsx";

export function PlaceholderModule({ title, sub, features }) {
  return (
    <div style={{ padding: "24px 28px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: T1 }}>{title}</div>
        <div style={{ fontSize: 13, color: T3, marginTop: 3 }}>{sub}</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14 }}>
        {features.map((f) => (
          <Card key={f.name} style={{ padding: "18px", cursor: "pointer" }}>
            <div style={{ fontSize: 20, marginBottom: 11 }}>{f.icon}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: T1, marginBottom: 6 }}>{f.name}</div>
            <div style={{ fontSize: 12, color: T3, lineHeight: 1.6 }}>{f.desc}</div>
          </Card>
        ))}
      </div>
      <div style={{ padding: "16px 20px", background: `${CY}0A`, border: `1px solid ${CY}22`, borderRadius: 12, display: "flex", alignItems: "center", gap: 12 }}>
        <Cpu size={16} color={CY} />
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: CY, marginBottom: 2 }}>Module in development — on your roadmap</div>
          <div style={{ fontSize: 12, color: T2 }}>ARCHITECT will integrate data across modules as the system expands.</div>
        </div>
      </div>
    </div>
  );
}
