import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import {
  formatMoney,
  formatCount,
  type AgingBucket,
  type PortfolioMetrics,
} from "@/data/portfolioStore";

/* Validated against the dataviz six-checks (light + dark):
   base #2563EB vs severe #E34948 — CVD ΔE 26.1, normal ΔE 36.4, both ≥3:1. */
const BASE = "hsl(var(--chart-blue))";
const SEVERE = "hsl(var(--destructive))";

const makeTooltip = (total: number) => ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const share = total ? ((d.amount / total) * 100).toFixed(1) : "0.0";
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <p className="text-xs font-semibold text-foreground">{d.bucket}</p>
      <p className="text-sm font-semibold tabular-nums text-foreground mt-1">
        {formatMoney(d.amount)}
        <span className="text-xs font-normal text-muted-foreground ml-1.5">{share}% of book</span>
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">
        {formatCount(d.accounts)} accounts
      </p>
    </div>
  );
};

export function AgingDistribution({
  buckets,
  metrics,
}: {
  buckets: AgingBucket[];
  metrics: PortfolioMetrics;
}) {
  const CustomTooltip = makeTooltip(metrics.totalOutstanding);
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h2 className="text-base font-semibold text-foreground">Aging Distribution</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Outstanding balance by days past due
          </p>
        </div>
        {/* Legend — identity is never colour-alone. */}
        <div className="flex items-center gap-3 text-xs shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: BASE }} />
            <span className="text-muted-foreground">Performing</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SEVERE }} />
            <span className="text-muted-foreground">90+ DPD</span>
          </span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={230}>
        <BarChart data={buckets} margin={{ top: 20, right: 8, left: 8, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis
            dataKey="bucket"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={48}
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(v) => formatMoney(v, 0)}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))" }} />
          <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={72}>
            {buckets.map((b) => (
              <Cell key={b.bucket} fill={b.severe ? SEVERE : BASE} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <p className="text-xs text-muted-foreground border-t border-border pt-3 mt-1">
        <span className="font-medium text-foreground">
          {metrics.severeSharePct}% of the book
        </span>{" "}
        sits in 90+ DPD, held by just {metrics.severeAccountSharePct}% of accounts (
        {formatCount(metrics.severeAccounts)}).
      </p>
    </Card>
  );
}
