import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, Coins, Crosshair, Info, Loader2, RefreshCw,
  ShieldAlert, Signal, TrendingDown, TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/layout/PageHeader";
import { ApiError } from "@/lib/api";
import { CURRENCY, money, moneyShort } from "@/lib/money";
import {
  getChannelEconomics, getInstrumentation,
  getStrategyPerformance, getStrategySummary, getVersionImpact,
  type ChannelEconomics, type Instrumentation,
  type StrategyPerformance, type StrategySummary, type VersionImpact,
} from "@/lib/strategyDashboard";

/* ---------------------------------------------------------------------------
 * Pieces
 *
 * Charts here carry one measure on one axis and one hue. Where a second measure
 * matters it becomes a column of text beside the bar, never a second y-scale.
 * Red and amber appear only as labelled state, never as series identity — as
 * adjacent categorical fills they are too close to tell apart.
 * ------------------------------------------------------------------------ */

const pct = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined ? "—" : `${v.toFixed(digits)}%`;

/**
 * Outreach costs live in fractions of a unit — an SMS is 1.5 cents — so the
 * shared `money` helper, which rounds to whole units, would render every one of
 * them as "$0". Small amounts keep enough decimals to stay meaningful; large
 * ones fall back to the shared format so this screen agrees with the others.
 */
const cost = (v: number | null | undefined): string => {
  if (v === null || v === undefined) return "—";
  if (v === 0) return `${CURRENCY}0`;
  const abs = Math.abs(v);
  if (abs >= 100) return money(v);
  if (abs >= 1) return `${CURRENCY}${v.toFixed(2)}`;
  if (abs >= 0.01) return `${CURRENCY}${v.toFixed(3)}`;
  return `${CURRENCY}${v.toFixed(4)}`;
};

/** A headline measure. `tone` marks state and always ships beside a word. */
function Kpi({
  icon: Icon, label, value, sub, footnote, tone = "text-foreground",
}: {
  icon: typeof Coins;
  label: string;
  value: string;
  sub?: string;
  footnote?: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </span>
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">
          {label}
        </span>
      </div>
      <div className={`text-2xl font-semibold tabular-nums leading-tight ${tone}`}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      {footnote && (
        <div className="text-[10px] text-muted-foreground/80 mt-auto pt-1 leading-snug">
          {footnote}
        </div>
      )}
    </div>
  );
}

function Panel({
  title, hint, children, action,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/** A bar that reads as a proportion of the largest value in its column. */
function Bar({ value, max, title }: { value: number; max: number; title: string }) {
  const w = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden" title={title}>
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-500"
        style={{ width: `${w}%` }}
      />
    </div>
  );
}

/** Signed change, with the direction carried by an icon as well as the colour. */
function Delta({ value, suffix = "pp" }: { value: number | null; suffix?: string }) {
  if (value === null || value === undefined) {
    return <span className="text-muted-foreground text-xs">no control</span>;
  }
  const up = value >= 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 tabular-nums ${
        up ? "text-success" : "text-destructive"
      }`}
    >
      <Icon className="h-3 w-3" />
      {up ? "+" : ""}
      {value.toFixed(1)}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------------------ */

const StrategyDashboard = () => {
  const [summary, setSummary] = useState<StrategySummary | null>(null);
  const [rows, setRows] = useState<StrategyPerformance[]>([]);
  const [channels, setChannels] = useState<ChannelEconomics[]>([]);
  const [versions, setVersions] = useState<VersionImpact[]>([]);
  const [instr, setInstr] = useState<Instrumentation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, p, c, v, i] = await Promise.all([
        getStrategySummary(), getStrategyPerformance(), getChannelEconomics(),
        getVersionImpact(), getInstrumentation(),
      ]);
      setSummary(s); setRows(p); setChannels(c); setVersions(v); setInstr(i);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load strategy performance.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading && !summary) {
    return (
      <div className="space-y-6">
        <PageHeader title="Strategy Performance" description="Loading…" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    );
  }

  const maxTouches = Math.max(1, ...channels.map((c) => c.touches));
  const uncovered = summary?.uncoveredValue ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Strategy Performance"
        description="How the dunning strategies themselves are doing — whether they beat leaving an account alone, what they cost to run, and whether they are pointed at the right accounts."
        actions={
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                     : <RefreshCw className="h-4 w-4 mr-2" />}
            Refresh
          </Button>
        }
      />

      {error && (
        <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>
      )}

      {summary && (
        <>
          {/* Six measures, each answering a question only a strategy can be asked */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            <Kpi
              icon={Signal} label="Book coverage" value={pct(summary.coveragePct)}
              sub={`${summary.coveredAccounts} of ${summary.coveredAccounts + summary.uncoveredAccounts} accounts`}
              tone={summary.coveragePct < 90 ? "text-warning" : "text-foreground"}
              footnote={
                uncovered > 0
                  ? `${money(uncovered)} is on no strategy at all, averaging ${summary.uncoveredAvgDpd.toFixed(0)} days overdue.`
                  : "Every account is being worked by a strategy."
              }
            />
            <Kpi
              icon={TrendingUp} label="Lift over doing nothing"
              value={`${summary.liftPct >= 0 ? "+" : ""}${summary.liftPct.toFixed(1)}pp`}
              sub={`${pct(summary.recoveryRate)} on strategy · ${pct(summary.controlRate)} unmanaged`}
              tone={summary.liftPct >= 0 ? "text-success" : "text-destructive"}
              footnote="Recovery on enrolled accounts against accounts of the same age left on no strategy. This is the only test of whether running a strategy paid."
            />
            <Kpi
              icon={Coins} label="Cost per 100 recovered"
              value={summary.collected > 0 ? cost(summary.costPer100) : "—"}
              sub={`${cost(summary.touchCost)} of outreach · ${summary.touches} touches`}
              footnote="Messaging spend divided by what came in, priced from the channel cost table. Agent time is not included."
            />
            <Kpi
              icon={Crosshair} label="Promise conversion" value={pct(summary.promiseKeptRate)}
              sub={`${summary.promises} promises taken · ${pct(summary.responseRate)} of touches engaged`}
              footnote="Share of settled promises that were honoured, on accounts enrolled in a strategy."
            />
            <Kpi
              icon={ShieldAlert} label="Escalation leakage" value={pct(summary.escalationRate)}
              tone={summary.escalationRate > 10 ? "text-warning" : "text-foreground"}
              sub="handed to agency or legal"
              footnote="Enrolled accounts the strategy could not recover in house. A strategy that escalates everything is not collecting, it is queueing."
            />
            <Kpi
              icon={Crosshair} label="Routing accuracy" value={pct(summary.routingAccuracy)}
              tone={summary.offTarget > 0 ? "text-warning" : "text-success"}
              sub={summary.offTarget > 0
                ? `${summary.offTarget} account${summary.offTarget === 1 ? "" : "s"} off target`
                : "every account on target"}
              footnote="Accounts whose risk band and ageing match the audience their strategy declares it targets. Anything else is being worked by the wrong playbook."
            />
          </div>

          {/* The league table */}
          <Panel
            title="Strategy league table"
            hint="One row per strategy. Lift is the verdict; the rest explains it."
          >
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    {["Strategy", "Accounts", "Outstanding", "Recovered", "Recovery",
                      "Lift vs none", "Touches/acct", "Cost per 100", "Promise kept",
                      "Escalated", "Off target", "Last published"].map((h, i) => (
                      <TableHead
                        key={h}
                        className={`whitespace-nowrap text-xs font-medium ${i > 0 ? "text-right" : ""}`}
                      >
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.strategyId} className="text-sm">
                      <TableCell className="whitespace-nowrap">
                        <div className="font-medium text-foreground">{r.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {r.strategyId} · {r.version ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.accounts}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(r.outstanding)}</TableCell>
                      <TableCell className="text-right tabular-nums text-success">
                        {money(r.collected)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums w-28">
                        <div className="flex items-center justify-end gap-2">
                          <span className="w-12">{pct(r.recoveryRate)}</span>
                          <span className="w-14">
                            <Bar value={r.recoveryRate} max={100} title={`${r.recoveryRate}% recovered`} />
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Delta value={r.liftPct} />
                        {r.liftPct !== null && r.controlCoveragePct < 100 && (
                          <div className="text-[10px] text-muted-foreground">
                            on {r.controlCoveragePct.toFixed(0)}% of the book
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.touchesPerAccount}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.collected > 0 ? cost(r.costPer100) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{pct(r.promiseKeptRate)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className={r.escalationRate >= 50 ? "text-destructive font-medium" : ""}>
                          {pct(r.escalationRate)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.offTarget > 0 ? (
                          <span className="text-warning">
                            {r.offTarget} · {moneyShort(r.offTargetValue)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap text-xs text-muted-foreground">
                        {r.lastPublished
                          ? new Date(r.lastPublished).toLocaleDateString("en-GB",
                              { day: "2-digit", month: "short", year: "numeric" })
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Channel economics — one measure on the bar, the rest as figures */}
            <Panel
              title="What each channel costs, and what it buys"
              hint="Bar length is touches sent. Response and cost per reply sit beside it rather than on a second axis."
            >
              <div className="space-y-3">
                {channels.map((c) => (
                  <div key={c.channel} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3">
                    <div className="min-w-0">
                      <div className="text-sm text-foreground truncate">{c.label}</div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        {cost(c.unitCost)} each
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Bar value={c.touches} max={maxTouches} title={`${c.touches} touches`} />
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        {c.touches} touches · {cost(c.cost)} spent
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm tabular-nums text-foreground">{pct(c.responseRate, 0)}</div>
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        {c.costPerResponse === null ? "no replies" : `${cost(c.costPerResponse)}/reply`}
                      </div>
                    </div>
                  </div>
                ))}
                {channels.length === 0 && (
                  <p className="text-sm text-muted-foreground">No touches recorded yet.</p>
                )}
              </div>
            </Panel>

            {/* Version impact */}
            <Panel
              title="Did the last edit help?"
              hint="Money in for the 30 days after a version was published, against the 30 before it."
            >
              <div className="space-y-2">
                {versions.map((v) => (
                  <div
                    key={v.strategyId}
                    className="flex items-center justify-between gap-3 py-1.5 border-b border-border last:border-0"
                  >
                    <div className="min-w-0">
                      <div className="text-sm text-foreground truncate">{v.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {v.version} · published {v.daysSince}d ago
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {v.mature ? (
                        <>
                          <Delta value={v.changePct} suffix="%" />
                          <div className="text-[11px] text-muted-foreground tabular-nums">
                            {moneyShort(v.collectedBefore)} → {moneyShort(v.collectedAfter)}
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="text-xs text-muted-foreground">too soon to tell</span>
                          <div className="text-[11px] text-muted-foreground">
                            {v.windowDays - v.daysSince} more days needed
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {versions.length === 0 && (
                  <p className="text-sm text-muted-foreground">No published versions yet.</p>
                )}
              </div>
            </Panel>
          </div>

          {/* What the numbers rest on — stated, not implied */}
          {instr && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="text-xs leading-relaxed">
                <span className="font-medium text-foreground">Where these numbers come from. </span>
                {instr.stepEvents.toLocaleString()} recorded touches across{" "}
                {instr.enrolments.toLocaleString()} enrolments.{" "}
                {instr.backfilledEnrolments > 0 && (
                  <>
                    {instr.backfilledEnrolments.toLocaleString()} enrolment
                    {instr.backfilledEnrolments === 1 ? " was" : "s were"} reconstructed from the
                    current strategy assignment, so their start dates are inferred rather than
                    recorded.{" "}
                  </>
                )}
                {instr.nodeCoveragePct === 0 ? (
                  <>
                    No touch yet records <em>which workflow step</em> produced it, so per-step
                    drop-off cannot be shown. It appears once the strategy engine stamps a node id
                    on each execution.
                  </>
                ) : (
                  <>{pct(instr.nodeCoveragePct, 0)} of touches identify the workflow step that produced them.</>
                )}{" "}
                Cost figures price each touch from the channel cost table and exclude agent time.
              </AlertDescription>
            </Alert>
          )}

          {summary.offTarget > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <span className="font-medium text-foreground">
                  {summary.offTarget} account{summary.offTarget === 1 ? " sits" : "s sit"} outside
                  the audience their strategy targets.
                </span>{" "}
                Each is being worked by a playbook written for a different risk band or ageing
                bucket — see the "Off target" column above.
              </AlertDescription>
            </Alert>
          )}
        </>
      )}
    </div>
  );
};

export default StrategyDashboard;
