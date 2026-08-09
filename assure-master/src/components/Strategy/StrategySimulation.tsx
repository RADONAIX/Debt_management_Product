import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Banknote, Beaker, ChevronRight, Clock, History, Info, Loader2,
  Play, Save, Users, Wallet,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/layout/PageHeader";
import { ApiError } from "@/lib/api";
import { money } from "@/lib/money";
import {
  AGING_BUCKETS, RISK_LEVELS, getSimulationAssumptions, listStrategies,
  listSimulationRuns, getSimulationRun, runSimulation,
  type SimAssumptions, type SimulationResult, type SimulationRunRow, type StrategyRow,
} from "@/lib/strategies";

const pct = (v?: number | null, dp = 1) => (v == null ? "—" : `${v.toFixed(dp)}%`);

const short = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`
  : n.toFixed(0);

const OUTCOME_TONE: Record<string, string> = {
  Settled: "bg-success/10 text-success border-success/25",
  Escalated: "bg-warning/10 text-warning border-warning/25",
  "Engaged, unresolved": "bg-info/10 text-info border-info/25",
  "Still running": "bg-primary/10 text-primary border-primary/25",
  "No contact": "bg-muted text-muted-foreground border-border",
};

const STEP_TONE: Record<string, string> = {
  touch: "bg-info", decision: "bg-warning", promise: "bg-primary",
  escalate: "bg-destructive", terminal: "bg-muted-foreground", start: "bg-success",
  action: "bg-muted-foreground",
};

const Pill = ({ tone, children }: { tone?: string; children: React.ReactNode }) => (
  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none whitespace-nowrap ${
    tone ?? "bg-muted text-muted-foreground border-border"}`}>
    {children}
  </span>
);

const Kpi = ({ icon: Icon, label, value, sub, tone = "" }: {
  icon: typeof Wallet; label: string; value: string; sub: string; tone?: string;
}) => (
  <Card className="p-4">
    <div className="flex items-center gap-2">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">
        {label}
      </span>
      <Icon className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
    </div>
    <div className={`text-2xl font-semibold tabular-nums leading-tight mt-1 ${tone}`}>{value}</div>
    <div className="text-[11px] text-muted-foreground">{sub}</div>
  </Card>
);

const Panel = ({ title, hint, right, children }: {
  title: string; hint?: string; right?: React.ReactNode; children: React.ReactNode;
}) => (
  <Card className="overflow-hidden">
    <div className="px-4 py-3 border-b border-border flex items-center gap-2">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
      {right && <div className="ml-auto shrink-0">{right}</div>}
    </div>
    {children}
  </Card>
);

/**
 * Strategy Simulation.
 *
 * Pick a journey, choose who it would run against, and put them through it.
 * The model walks each account through the strategy's own workflow graph,
 * spending the real channel costs and applying response rates measured from
 * what those channels have actually achieved on this book.
 *
 * It is a projection, and the screen says so: every rate is listed with
 * whether it was measured or assumed, and each run carries the seed that
 * produced it, so the same inputs always give the same answer.
 */
export const StrategySimulation = () => {
  const [strategies, setStrategies] = useState<StrategyRow[]>([]);
  const [code, setCode] = useState("");
  const [assume, setAssume] = useState<SimAssumptions | null>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [runs, setRuns] = useState<SimulationRunRow[]>([]);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  // Inputs
  const [useTargeting, setUseTargeting] = useState(true);
  const [buckets, setBuckets] = useState<string[]>([]);
  const [risks, setRisks] = useState<string[]>([]);
  const [maxAccounts, setMaxAccounts] = useState(200);
  const [horizon, setHorizon] = useState(30);
  const [lift, setLift] = useState(0);
  const [keptRate, setKeptRate] = useState<number | null>(null);
  const [label, setLabel] = useState("");

  const strategy = useMemo(
    () => strategies.find((s) => s.id === code) ?? null, [strategies, code]);

  useEffect(() => {
    Promise.all([listStrategies(), getSimulationAssumptions(), listSimulationRuns()])
      .then(([s, a, r]) => {
        setStrategies(s);
        setCode((c) => c || s[0]?.id || "");
        setAssume(a);
        setRuns(r);
      })
      .catch(() => toast.error("Could not load the simulator."))
      .finally(() => setLoading(false));
  }, []);

  const run = useCallback(async (save: boolean) => {
    if (!code) return;
    setRunning(true);
    try {
      const res = await runSimulation(code, {
        useTargeting,
        agingBuckets: buckets.length ? buckets : undefined,
        riskLevels: risks.length ? risks : undefined,
        maxAccounts, horizonDays: horizon,
        responseLiftPct: lift,
        promiseKeptRate: keptRate ?? undefined,
        save, label: save ? (label.trim() || undefined) : undefined,
      });
      setResult(res);
      if (save) {
        setRuns(await listSimulationRuns());
        toast.success("Run saved.");
      }
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "The simulation did not run.");
    } finally {
      setRunning(false);
    }
  }, [code, useTargeting, buckets, risks, maxAccounts, horizon, lift, keptRate, label]);

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const funnelMax = Math.max(1, ...(result?.funnel ?? []).map((f) => f.accounts));
  const assumed = (assume?.channels ?? []).filter((c) => c.source.startsWith("assumed"));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Strategy Simulation"
        description="Run a journey against the live book before you publish it"
        actions={
          result && (
            <Pill tone="bg-muted text-muted-foreground border-border">
              seed {result.seed}
            </Pill>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] items-start">
        {/* ---------------- Inputs ---------------- */}
        <div className="space-y-3">
          <Panel title="What to run" hint="The journey and who goes through it">
            <div className="p-4 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Strategy</Label>
                <Select value={code} onValueChange={setCode}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {strategies.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} · {s.version}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {strategy && (
                  <p className="text-[11px] text-muted-foreground">
                    {strategy.status} ·{" "}
                    {(strategy.workflow?.nodes as unknown[] | undefined)?.length ?? 0} steps ·
                    targets {(strategy.aging ?? []).join(", ") || "any age"},{" "}
                    {(strategy.riskLevel ?? []).join(", ") || "any risk"}
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Switch checked={useTargeting} onCheckedChange={setUseTargeting} />
                <div className="min-w-0">
                  <Label className="text-xs">Use the strategy's own targeting</Label>
                  <p className="text-[10px] text-muted-foreground">
                    Off, it runs against whatever you pick below
                  </p>
                </div>
              </div>

              {!useTargeting && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Days past due</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {AGING_BUCKETS.map((b) => (
                        <button key={b} onClick={() => toggle(buckets, setBuckets, b)}
                          className={`rounded-lg border px-2 py-1 text-[11px] transition ${
                            buckets.includes(b)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border hover:bg-muted"}`}>
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Risk</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {RISK_LEVELS.map((r) => (
                        <button key={r} onClick={() => toggle(risks, setRisks, r)}
                          className={`rounded-lg border px-2 py-1 text-[11px] transition ${
                            risks.includes(r)
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border hover:bg-muted"}`}>
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Max accounts</Label>
                  <Input type="number" className="h-9" value={maxAccounts}
                         onChange={(e) => setMaxAccounts(Number(e.target.value) || 1)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Horizon (days)</Label>
                  <Input type="number" className="h-9" value={horizon}
                         onChange={(e) => setHorizon(Number(e.target.value) || 7)} />
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="What to assume"
                 hint="Measured from the book unless you move them">
            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <Label className="text-xs">Response versus today</Label>
                  <span className={`ml-auto text-xs tabular-nums font-medium ${
                    lift > 0 ? "text-success" : lift < 0 ? "text-warning" : ""}`}>
                    {lift > 0 ? "+" : ""}{lift}%
                  </span>
                </div>
                <Slider value={[lift]} min={-60} max={60} step={5}
                        onValueChange={([v]) => setLift(v)} />
                <p className="text-[10px] text-muted-foreground">
                  Stress the run: what if every channel performs better or worse than it does now
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-baseline gap-2">
                  <Label className="text-xs">Promises kept</Label>
                  <span className="ml-auto text-xs tabular-nums font-medium">
                    {keptRate ?? assume?.promiseKeptRate ?? 0}%
                  </span>
                </div>
                <Slider value={[keptRate ?? assume?.promiseKeptRate ?? 45]}
                        min={0} max={100} step={1}
                        onValueChange={([v]) => setKeptRate(v)} />
                <p className="text-[10px] text-muted-foreground">
                  {assume?.promiseKeptSource}
                  {keptRate != null && (
                    <button className="ml-1.5 underline" onClick={() => setKeptRate(null)}>
                      reset
                    </button>
                  )}
                </p>
              </div>

              <div className="flex gap-2">
                <Button className="flex-1" disabled={running || !code}
                        onClick={() => void run(false)}>
                  {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                           : <Play className="h-4 w-4 mr-2" />}
                  Run simulation
                </Button>
                <Button variant="outline" disabled={running || !result}
                        title="Keep this run to compare against later"
                        onClick={() => void run(true)}>
                  <Save className="h-4 w-4" />
                </Button>
              </div>
              <Input className="h-8 text-xs" value={label}
                     onChange={(e) => setLabel(e.target.value)}
                     placeholder="Name this run, if you are saving it" />
            </div>
          </Panel>

          {runs.length > 0 && (
            <Panel title="Saved runs" hint="Reopen a result exactly as it was">
              <div className="divide-y divide-border max-h-[260px] overflow-y-auto">
                {runs.map((r) => (
                  <button key={r.id}
                          onClick={() => getSimulationRun(r.id).then(setResult)
                            .catch(() => toast.error("Could not open that run."))}
                          className="w-full px-4 py-2.5 text-left hover:bg-muted/40 transition">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium truncate">
                        {r.label ?? `${r.strategyCode} ${r.strategyVersion ?? ""}`}
                      </span>
                      <ChevronRight className="h-3 w-3 text-muted-foreground ml-auto shrink-0" />
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {r.accounts} accounts · {pct(r.recoveryRate)} recovered ·{" "}
                      {new Date(r.createdAt).toLocaleDateString(undefined, {
                        day: "numeric", month: "short" })}
                    </div>
                  </button>
                ))}
              </div>
            </Panel>
          )}
        </div>

        {/* ---------------- Outputs ---------------- */}
        <div className="space-y-4">
          {!result && (
            <Card className="p-14 text-center">
              <Beaker className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">Nothing has been run yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                Pick a strategy and press Run. Each account in the population is walked through
                the journey step by step, paying the real channel costs, so you can see what it
                would collect and what it would spend before publishing it.
              </p>
            </Card>
          )}

          {result && (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                <Kpi icon={Users} label="Accounts in" value={String(result.accounts)}
                     sub={`${money(result.exposure)} of exposure`} />
                <Kpi icon={Banknote} label="Recovered" value={money(result.recovered)}
                     sub={`${pct(result.recoveryRate)} of exposure`} tone="text-success" />
                <Kpi icon={Wallet} label="Cost to run" value={money(result.cost)}
                     sub={`${result.touches} touches · ${money(result.costPerAccount)} per account`} />
                <Kpi icon={Beaker} label="Cost per $100 recovered"
                     value={result.costPerRecovered == null ? "—"
                            : `$${(result.costPerRecovered * 100).toFixed(2)}`}
                     sub="channel spend only, no agent time" />
                <Kpi icon={Clock} label="Days to settle"
                     value={result.avgDaysToSettle == null ? "—" : String(result.avgDaysToSettle)}
                     sub={`over a ${result.horizonDays}-day horizon`} />
                <Kpi icon={AlertTriangle} label="Handed on"
                     value={String(result.funnel.find((f) => f.stage === "Escalated")?.accounts ?? 0)}
                     sub="escalated out of this journey"
                     tone="text-warning" />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="Where the population ends up"
                       hint="Each account counted once, at the furthest point it reached">
                  <div className="p-4 space-y-2.5">
                    {result.funnel.map((f) => (
                      <div key={f.stage} className="grid grid-cols-[8.5rem_1fr_3rem] items-center gap-3">
                        <span className="text-xs text-foreground truncate">{f.stage}</span>
                        <div className="h-5 rounded-md bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-md ${
                              f.stage === "Settled" ? "bg-success"
                              : f.stage === "Escalated" ? "bg-warning"
                              : f.stage === "Horizon ran out" ? "bg-primary/50"
                              : f.stage === "Finished, unpaid" ? "bg-muted-foreground/50"
                              : "bg-primary"}`}
                            style={{ width: `${(f.accounts / funnelMax) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-right">{f.accounts}</span>
                      </div>
                    ))}
                  </div>
                </Panel>

                <Panel title="Money in over time"
                       hint="Cumulative recovery across the horizon">
                  <div className="p-3 h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={result.curve} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
                        <defs>
                          <linearGradient id="simRec" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                        <XAxis dataKey="day" tick={{ fontSize: 10 }}
                               stroke="hsl(var(--muted-foreground))"
                               tickFormatter={(d) => `d${d}`} />
                        <YAxis tickFormatter={short} tick={{ fontSize: 10 }}
                               stroke="hsl(var(--muted-foreground))" />
                        <Tooltip
                          contentStyle={{
                            background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
                            borderRadius: "0.75rem", fontSize: "12px",
                          }}
                          labelFormatter={(d) => `Day ${d}`}
                          formatter={(v: number) => [money(v), "Recovered"]} />
                        <Area type="monotone" dataKey="recovered" stroke="hsl(var(--success))"
                              strokeWidth={2} fill="url(#simRec)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
              </div>

              <Panel title="Step by step"
                     hint="How many accounts reached each step of the journey, and what happened there">
                <div className="divide-y divide-border">
                  {result.steps.map((s) => (
                    <div key={s.nodeId} className="px-4 py-2.5 flex items-center gap-3">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${STEP_TONE[s.kind]}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-medium text-foreground truncate">
                            {s.label}
                          </span>
                          {s.channel && <Pill>{s.channel}</Pill>}
                        </div>
                        <div className="h-1.5 mt-1 rounded-full bg-muted overflow-hidden max-w-md">
                          <div className="h-full rounded-full bg-primary/60"
                               style={{ width: `${(s.entered / result.accounts) * 100}%` }} />
                        </div>
                      </div>
                      <div className="text-right shrink-0 w-40">
                        <div className="text-xs tabular-nums">
                          {s.entered} in
                          {s.kind !== "terminal" && s.kind !== "start" && s.kind !== "action" && (
                            <span className="text-muted-foreground">
                              {" "}· {s.succeeded} {s.kind === "touch" ? "reached"
                                : s.kind === "decision" ? "paid" : "done"}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground tabular-nums">
                          {s.cost > 0 ? money(s.cost) : "no channel cost"}
                          {s.successRate != null && ` · ${pct(s.successRate, 0)}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="What each channel did"
                       hint="Touches sent, how many landed, and what they cost">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                        <tr>
                          {["Channel", "Touches", "Reached", "Rate", "Cost"].map((h, i) => (
                            <th key={h} className={`px-4 py-2 font-medium ${i ? "text-right" : "text-left"}`}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {result.channels.map((c) => (
                          <tr key={c.channel} className="hover:bg-muted/30">
                            <td className="px-4 py-2">{c.channel}</td>
                            <td className="px-4 py-2 text-right tabular-nums">{c.touches}</td>
                            <td className="px-4 py-2 text-right tabular-nums">{c.reached}</td>
                            <td className="px-4 py-2 text-right tabular-nums">{pct(c.reachRate, 0)}</td>
                            <td className="px-4 py-2 text-right tabular-nums">{money(c.cost)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Panel>

                <Panel title="A sample of the accounts"
                       hint="The first 25, and where each one ended">
                  <div className="divide-y divide-border max-h-[280px] overflow-y-auto">
                    {result.sample.map((o) => (
                      <div key={o.accountCode} className="px-4 py-2 flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium truncate">{o.customerName}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {o.accountCode} · {o.bucket} · {o.riskLevel}
                          </div>
                        </div>
                        <Pill tone={OUTCOME_TONE[o.outcome]}>{o.outcome}</Pill>
                        <div className="text-right w-20 shrink-0">
                          <div className="text-xs tabular-nums">{money(o.outstanding)}</div>
                          {o.recovered > 0 && (
                            <div className="text-[10px] tabular-nums text-success">
                              +{money(o.recovered)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </Panel>
              </div>

              {/* What the result rests on — stated, not buried */}
              <Card className="p-4">
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">
                      What this result rests on
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      A projection, not a forecast. Same inputs always give the same answer —
                      this one ran on seed {result.seed}.
                    </p>
                    <div className="grid gap-x-6 gap-y-1.5 mt-3 sm:grid-cols-2">
                      {result.assumptions.channels.map((c) => (
                        <div key={c.channel} className="flex items-baseline gap-2 text-[11px]">
                          <span className="text-foreground w-20 shrink-0">{c.channel}</span>
                          <span className="tabular-nums">{pct(c.reachRate, 0)} reach</span>
                          <span className="text-muted-foreground tabular-nums">
                            ${c.costPerTouch}
                          </span>
                          <span className={`ml-auto truncate ${
                            c.source.startsWith("assumed") ? "text-warning" : "text-muted-foreground"}`}>
                            {c.source}
                          </span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-3">
                      Promises kept {pct(result.assumptions.promiseKeptRate, 0)} —{" "}
                      {result.assumptions.promiseKeptSource}. A settling account clears{" "}
                      {pct(result.assumptions.settlementShare, 0)} of its balance —{" "}
                      {result.assumptions.settlementSource}. Costs price each touch from the
                      channel cost table and exclude agent time.
                    </p>
                    {assumed.length > 0 && (
                      <p className="text-[11px] text-warning mt-2 flex items-start gap-1.5">
                        <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                        {assumed.length} channel{assumed.length === 1 ? "" : "s"} had too little
                        history to measure ({assumed.map((c) => c.channel).join(", ")}), so a
                        conservative default was used. Treat any result leaning on{" "}
                        {assumed.length === 1 ? "it" : "them"} as indicative.
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StrategySimulation;
