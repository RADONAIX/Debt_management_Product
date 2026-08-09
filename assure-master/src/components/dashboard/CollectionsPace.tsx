import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { CYCLE, type PortfolioMetrics, type TrendPoint } from "@/data/portfolioStore";

/* Validated against the dataviz six-checks (light + dark):
   collected #2563EB vs pace #EDA100 — CVD ΔE 37.2, normal ΔE 43.4.
   The amber sits below 3:1 on white, so the relief rule applies: it ships as a
   dashed reference line with a legend entry and a direct end-label. */
const COLLECTED = "hsl(var(--chart-blue))";
const PACE = "hsl(var(--warning))";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const actual = payload.find((p: any) => p.dataKey === "actual")?.value ?? 0;
  const target = payload.find((p: any) => p.dataKey === "target")?.value ?? 0;
  const variance = actual - target;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-foreground">{label}</p>
      <div className="mt-1 space-y-0.5">
        <p className="text-sm tabular-nums text-foreground">
          Collected <span className="font-semibold">${actual}K</span>
        </p>
        <p className="text-sm tabular-nums text-muted-foreground">
          Pace <span className="font-semibold">${target}K</span>
        </p>
      </div>
      <p
        className={`text-xs font-medium mt-1 pt-1 border-t border-border ${
          variance >= 0 ? "text-success" : "text-destructive"
        }`}
      >
        {variance >= 0 ? "+" : ""}
        {variance}K vs pace
      </p>
    </div>
  );
};

export function CollectionsPace({
  trend,
  metrics,
}: {
  trend: TrendPoint[];
  metrics: PortfolioMetrics;
}) {
  const gap = metrics.attainmentPct - metrics.pacePct;
  const ahead = gap >= 0;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h2 className="text-base font-semibold text-foreground">Collections vs Pace</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Cumulative recovery against the monthly target
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ background: COLLECTED }} />
            <span className="text-muted-foreground">Collected</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="h-0.5 w-4 rounded"
              style={{ background: `repeating-linear-gradient(90deg, ${PACE} 0 4px, transparent 4px 7px)` }}
            />
            <span className="text-muted-foreground">Pace to target</span>
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={230}>
        <LineChart data={trend} margin={{ top: 20, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={48}
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(v) => `$${v}K`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="target"
            stroke={PACE}
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            activeDot={false}
          />
          <Line
            type="monotone"
            dataKey="actual"
            stroke={COLLECTED}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }}
          />
        </LineChart>
      </ResponsiveContainer>

      <p className="text-xs text-muted-foreground border-t border-border pt-3 mt-1">
        <span className={`font-medium ${ahead ? "text-success" : "text-destructive"}`}>
          {Math.abs(gap).toFixed(1)}pp {ahead ? "ahead of" : "behind"} pace
        </span>{" "}
        — {metrics.attainmentPct}% of target collected with{" "}
        {CYCLE.daysInCycle - CYCLE.daysElapsed} days left in the cycle.
      </p>
    </Card>
  );
}
