import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { AlertTriangle, Gavel, Scale, TrendingUp } from "lucide-react";
import { moneyShort } from "@/lib/money";
import type { RecoverySummary } from "@/lib/recovery";

/**
 * The state of the recovery book in one band rather than a row of cards — the
 * numbers belong together, and it keeps the workspace below visually quiet.
 */
export const CommandRibbon = ({
  summary,
  onJumpOverdue,
  onJumpLegal,
}: {
  summary: RecoverySummary | null;
  onJumpOverdue: () => void;
  onJumpLegal: () => void;
}) => {
  const s = summary;
  const stat = (label: string, value: string, sub?: string, tone = "text-foreground") => (
    <div className="px-5 first:pl-0 border-l border-border first:border-0">
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground whitespace-nowrap">
        {label}
      </div>
      <div className={`text-xl font-semibold mt-1 tabular-nums ${tone}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground mt-0.5 whitespace-nowrap">{sub}</div>}
    </div>
  );

  return (
    <div className="rounded-2xl bg-gradient-to-br from-card via-card to-primary/5 border border-border px-6 py-5 shadow-sm">
      <div className="flex flex-wrap items-start gap-y-5">
        <div className="flex flex-wrap items-start flex-1 min-w-[520px]">
          {stat(
            "Open with agencies",
            s ? moneyShort(s.openValue) : "—",
            s ? `${s.activePlacements} live placements` : undefined,
          )}
          {stat(
            "Recovered",
            s ? moneyShort(s.recoveredValue) : "—",
            s ? `of ${moneyShort(s.placedValue)} placed` : undefined,
            "text-success",
          )}
          {stat(
            "Recovery rate",
            s ? `${s.recoveryRate}%` : "—",
            s?.avgDaysToRecover ? `${s.avgDaysToRecover} days average` : undefined,
            "text-success",
          )}
          {stat(
            "Commission",
            s ? moneyShort(s.commissionAccrued) : "—",
            s ? `${moneyShort(s.recoveredThisMonth)} recovered MTD` : undefined,
            "text-warning",
          )}
        </div>

        {/* Attention: the two things that need a decision today. */}
        <div className="flex items-center gap-2 ml-auto pl-4">
          <button
            onClick={onJumpOverdue}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-left transition ${
              s?.overdueRecalls
                ? "bg-warning/10 hover:bg-warning/20 border border-warning/30"
                : "bg-muted/50 hover:bg-muted border border-border"
            }`}
          >
            <AlertTriangle
              className={`h-4 w-4 ${s?.overdueRecalls ? "text-warning" : "text-muted-foreground"}`}
            />
            <div>
              <div className="text-sm font-semibold text-foreground tabular-nums">
                {s?.overdueRecalls ?? 0}
              </div>
              <div className="text-[10px] text-muted-foreground leading-none">Recall due</div>
            </div>
          </button>
          <button
            onClick={onJumpLegal}
            className="flex items-center gap-2 rounded-xl px-3 py-2 bg-muted/50 hover:bg-muted border border-border transition text-left"
          >
            <Scale className="h-4 w-4 text-violet-600 dark:text-violet-400" />
            <div>
              <div className="text-sm font-semibold text-foreground tabular-nums">{s?.legalOpen ?? 0}</div>
              <div className="text-[10px] text-muted-foreground leading-none">
                Legal · {s ? moneyShort(s.legalClaimValue) : "—"}
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* Twelve-month placed vs recovered */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center gap-4 mb-1.5">
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
            <TrendingUp className="h-3 w-3" /> Placed vs recovered · 12 months
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Placed
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> Recovered
          </span>
          <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1">
            <Gavel className="h-3 w-3" />
            {s?.agencies ?? 0} agencies under contract
          </span>
        </div>
        <div className="h-[74px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={s?.trend ?? []} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="ribbonPlaced" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="ribbonRecovered" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                axisLine={false}
                tickLine={false}
                interval={1}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 10,
                  fontSize: 11,
                  color: "hsl(var(--popover-foreground))",
                }}
                formatter={(v: number, n: string) => [moneyShort(v), n]}
              />
              <Area
                type="monotone"
                dataKey="placed"
                name="Placed"
                stroke="hsl(var(--primary))"
                strokeWidth={1.5}
                fill="url(#ribbonPlaced)"
              />
              <Area
                type="monotone"
                dataKey="recovered"
                name="Recovered"
                stroke="hsl(var(--success))"
                strokeWidth={1.5}
                fill="url(#ribbonRecovered)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
