// ── The shared chart wrapper ─────────────────────────────────────────
// Renders a chart from a definition object rather than hand-rolling a
// recharts tree per chart. Before this, every chart in the app built its
// own <ResponsiveContainer><ComposedChart> with its own axis styling — so
// a change to how charts look meant editing ten files.
//
// It also carries the sample-size rule, and carries it *structurally*.
// The rule is not decoration: a bar built from nine trades looks exactly
// as confident as one built from nine hundred, and the whole point of the
// journal is to stop you trading a pattern that isn't there. Every bucket
// states its n, thin buckets are visibly muted, and a breakdown with no
// bucket above the threshold says so instead of drawing a ranking.
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";
import { BD, BD2, T1, T2, T3, AC, AC2, GR, RE, AM, MONO } from "./tokens.js";
import { mkTT } from "./ChartTooltip.jsx";
// The app's glass card. Every module renders over a live collage
// background, and only this treatment — a near-opaque fill plus a
// backdrop blur — keeps text legible against it. A translucent panel of
// my own would have looked fine on a plain background and unreadable in
// the actual app.
import { Card } from "./primitives.jsx";

const SAMPLE_NONE = 20;

/** Positive is green, negative is red. R is directional; a bar should say so. */
const rColor = (v) => (v > 0 ? GR : v < 0 ? RE : T3);

const DONUT_COLORS = [AC, AC2, GR, AM, RE, "#9B7FD4", "#4FC3B0", "#E07A5F", T3];

const axis = { stroke: T3, fontSize: 10, tickLine: false, axisLine: false };

/** A bucket below the threshold is drawn, but visibly cannot be read from. */
const bucketOpacity = (n) => (n < SAMPLE_NONE ? 0.35 : 1);

function Frame({ title, caption, star, right, children, footer }) {
  return (
    <Card style={{
      padding: "14px 16px 12px", display: "flex", flexDirection: "column", gap: 8, minWidth: 0,
    }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: T1, flex: 1 }}>
          {star && <span style={{ color: AC2, marginRight: 5 }} aria-label="key chart">★</span>}
          {title}
        </div>
        {right}
      </div>
      {children}
      {caption && <div style={{ fontSize: 10.5, color: T3, lineHeight: 1.5 }}>{caption}</div>}
      {footer}
    </Card>
  );
}

/**
 * What a chart shows when the fields it reads have never been filled in.
 *
 * It names the field. "No data" would be true and useless; "needs Setup
 * Grade" tells you the one thing that would light it up.
 */
function Dark({ title, star, missing }) {
  return (
    <Frame title={title} star={star}>
      <div style={{
        minHeight: 96, display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", gap: 6, textAlign: "center", padding: "8px 4px",
      }}>
        <div style={{ fontSize: 11.5, color: T2 }}>Nothing logged yet</div>
        <div style={{ fontSize: 10.5, color: T3, lineHeight: 1.5 }}>
          Fill in <span style={{ color: AC }}>{missing.join(" · ")}</span> on your trades
          and this chart starts working.
        </div>
      </div>
    </Frame>
  );
}

/** A single big number. */
function NumberTile({ title, caption, star, value, unit, n }) {
  const num = typeof value === "number" ? value : 0;
  const thin = n < SAMPLE_NONE;
  return (
    <Frame
      title={title} caption={caption} star={star}
      right={<span style={{ fontSize: 10, color: T3, fontFamily: MONO }}>n={n}</span>}
    >
      <div style={{
        fontFamily: MONO, fontSize: 30, fontWeight: 700, lineHeight: 1.1,
        color: unit === "R" ? rColor(num) : T1,
        opacity: thin ? 0.55 : 1,
      }}>
        {Number.isFinite(num) ? num.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
        {unit && <span style={{ fontSize: 13, color: T3, marginLeft: 4 }}>{unit}</span>}
      </div>
      {thin && (
        <div style={{ fontSize: 10, color: AM }}>
          {n === 0 ? "No closed trades yet" : `Only ${n} trade${n === 1 ? "" : "s"} — not enough to conclude anything`}
        </div>
      )}
    </Frame>
  );
}

/** Column / bar breakdown over buckets. */
function Bars({ title, caption, star, data, horizontal, unit }) {
  const best = Math.max(0, ...data.map((d) => d.n));
  const allThin = best < SAMPLE_NONE;
  const Chart = BarChart;
  return (
    <Frame
      title={title} caption={caption} star={star}
      right={<span style={{ fontSize: 10, color: T3, fontFamily: MONO }}>{data.length} buckets</span>}
      footer={allThin && (
        <div style={{ fontSize: 10, color: AM, lineHeight: 1.5 }}>
          Largest bucket is {best} trade{best === 1 ? "" : "s"}. A breakdown needs about 20 per
          bucket before it means anything — read the shape, not the ranking.
        </div>
      )}
    >
      <div style={{ height: horizontal ? Math.max(120, data.length * 30 + 30) : 190 }}>
        <ResponsiveContainer width="100%" height="100%">
          <Chart data={data} layout={horizontal ? "vertical" : "horizontal"}
            margin={{ top: 4, right: 8, bottom: 0, left: horizontal ? 4 : -18 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={BD} vertical={!horizontal} horizontal={horizontal} />
            {horizontal ? <XAxis type="number" {...axis} /> : <XAxis dataKey="label" type="category" {...axis} interval={0} />}
            {horizontal ? <YAxis dataKey="label" type="category" width={110} {...axis} /> : <YAxis type="number" {...axis} />}
            <Tooltip content={mkTT("", unit === "%" ? "%" : unit === "R" ? "R" : "")} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
            <ReferenceLine {...(horizontal ? { x: 0 } : { y: 0 })} stroke={BD2} />
            <Bar dataKey="value" radius={horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]} isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell key={i} fill={rColor(d.value)} fillOpacity={bucketOpacity(d.n)} />
              ))}
            </Bar>
          </Chart>
        </ResponsiveContainer>
      </div>
      {/* n per bucket, spelled out — the axis cannot carry it legibly. */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "3px 10px", fontSize: 9.5, color: T3, fontFamily: MONO }}>
        {data.map((d) => (
          <span key={d.key} style={{ opacity: d.n < SAMPLE_NONE ? 0.7 : 1 }}>
            {d.label} n={d.n}{d.n < SAMPLE_NONE ? "" : " ✓"}
          </span>
        ))}
      </div>
    </Frame>
  );
}

function Trend({ title, caption, star, data, unit }) {
  return (
    <Frame title={title} caption={caption} star={star}>
      <div style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={BD} />
            <XAxis dataKey="label" {...axis} />
            <YAxis {...axis} />
            <Tooltip content={mkTT("", unit === "R" ? "R" : "")} />
            <ReferenceLine y={0} stroke={BD2} />
            <Line type="monotone" dataKey="value" stroke={AC} strokeWidth={2} dot={{ r: 2.5, fill: AC }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </Frame>
  );
}

function Donut({ title, caption, star, data }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <Frame
      title={title} caption={caption} star={star}
      right={<span style={{ fontSize: 10, color: T3, fontFamily: MONO }}>n={total}</span>}
    >
      <div style={{ height: 170, display: "flex", alignItems: "center", gap: 10 }}>
        <ResponsiveContainer width="55%" height="100%">
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="label" innerRadius={38} outerRadius={62}
              paddingAngle={2} stroke="none" isAnimationActive={false}>
              {data.map((d, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
            </Pie>
            <Tooltip content={mkTT()} />
          </PieChart>
        </ResponsiveContainer>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          {data.map((d, i) => (
            <div key={d.key} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10.5, color: T2 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: DONUT_COLORS[i % DONUT_COLORS.length], flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.label}</span>
              <span style={{ fontFamily: MONO, color: T3 }}>
                {d.value}{total ? ` · ${Math.round((d.value / total) * 100)}%` : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

/** Cumulative R with the drawdown from its running peak shaded beneath. */
function Equity({ title, caption, star, data }) {
  return (
    <Frame title={title} caption={caption} star={star}>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
            <defs>
              <linearGradient id="pnpDd" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={RE} stopOpacity={0.35} />
                <stop offset="100%" stopColor={RE} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke={BD} />
            <XAxis dataKey="date" {...axis} minTickGap={40} />
            <YAxis {...axis} />
            <Tooltip content={mkTT("", "R")} />
            <ReferenceLine y={0} stroke={BD2} />
            <Area type="monotone" dataKey="drawdown" stroke="none" fill="url(#pnpDd)" isAnimationActive={false} />
            <Area type="monotone" dataKey="cumR" stroke={AC} strokeWidth={2} fill="none" isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Frame>
  );
}

/**
 * One entry point. `spec` is a definition from engine/charts.js; `data` is
 * whatever that definition's shape needs, prepared by the dashboard.
 */
export function Chart({ spec, data, n = 0, missing = [], star = false }) {
  if (missing.length) return <Dark title={spec.title} star={star} missing={missing} />;
  const common = { title: spec.title, caption: spec.caption, star, unit: spec.unit };

  if (spec.type === "number") return <NumberTile {...common} value={data} n={n} />;
  if (spec.type === "equity") {
    if (!data || data.length < 2) {
      return <Dark title={spec.title} star={star} missing={["at least two closed trades"]} />;
    }
    return <Equity {...common} data={data} />;
  }
  if (!data || !data.length) return <Dark title={spec.title} star={star} missing={["closed trades"]} />;
  if (spec.type === "donut") return <Donut {...common} data={data} />;
  if (spec.type === "line") return <Trend {...common} data={data} />;
  return <Bars {...common} data={data} horizontal={spec.type === "bar"} />;
}

export { SAMPLE_NONE };
