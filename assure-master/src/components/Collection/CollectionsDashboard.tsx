import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Banknote, Clock,
  HandCoins, Layers, Loader2, RefreshCw, Timer, Wallet,
} from "lucide-react";
import { toast } from "sonner";
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { money } from "@/lib/money";
import { getOverview, getConfig, type CollectionsOverview, type CollectionConfig }
  from "@/lib/collection";
import { PRIORITY_TONE, Pill, RISK_TONE } from "./shared";

/** Compact money for axes and dense cells, where the full figure will not fit. */
const short = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`
  : n.toFixed(0);

const pct = (v?: number | null) => (v == null ? "—" : `${v}%`);

const weekLabel = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

const AGEING_TONE: Record<string, string> = {
  Current: "hsl(var(--muted-foreground))",
  "1-30": "hsl(var(--info))",
  "31-60": "hsl(var(--warning))",
  "61-90": "hsl(var(--warning))",
  "90+": "hsl(var(--destructive))",
};

/**
 * One KPI. Each card on this screen measures something none of the others do —
 * a stock, a flow, a rate, a reliability, a service level, a duration — so
 * nothing is said twice in different words.
 */
const Kpi = ({
  icon: Icon, label, value, sub, delta, tone = "text-foreground", footnote,
}: {
  icon: typeof Wallet;
  label: string;
  value: string;
  sub?: string;
  delta?: number | null;
  tone?: string;
  footnote?: string;
}) => (
  <div className="rounded-2xl border border-border bg-card p-4 flex flex-col gap-1">
    <div className="flex items-center gap-2">
      <span className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </span>
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">
        {label}
      </span>
      {delta != null && (
        <span
          className={`ml-auto flex items-center gap-0.5 text-[11px] font-medium ${
            delta >= 0 ? "text-success" : "text-destructive"}`}
          title="Against the previous 30 days"
        >
          {delta >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {Math.abs(delta) >= 1000 ? ">999" : Math.abs(delta)}%
        </span>
      )}
    </div>
    <div className={`text-2xl font-semibold tabular-nums leading-tight ${tone}`}>{value}</div>
    {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    {footnote && <div className="text-[10px] text-muted-foreground/80 mt-auto pt-1">{footnote}</div>}
  </div>
);

const Panel = ({ title, hint, right, children }: {
  title: string; hint?: string; right?: React.ReactNode; children: React.ReactNode;
}) => (
  <div className="rounded-2xl border border-border bg-card overflow-hidden">
    <div className="px-4 py-3 border-b border-border flex items-center gap-2">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
        {hint && <p className="text-[11px] text-muted-foreground truncate">{hint}</p>}
      </div>
      {right && <div className="ml-auto shrink-0">{right}</div>}
    </div>
    {children}
  </div>
);

const tooltipStyle = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "0.75rem",
    fontSize: "12px",
  },
  labelStyle: { color: "hsl(var(--muted-foreground))", fontSize: "11px" },
};

/**
 * The collections book as a whole: what is owed, what came in, whether
 * promises hold and whether the work is being done on time. Scoped by the
 * server to the desk this user may see — a collector's own book, or the floor.
 */
export const CollectionsDashboard = ({ onOpenCustomer, onOpenCase }: {
  onOpenCustomer?: (code: string) => void;
  onOpenCase?: (id: number) => void;
}) => {
  const [d, setD] = useState<CollectionsOverview | null>(null);
  const [config, setConfig] = useState<CollectionConfig | null>(null);
  const [agentId, setAgentId] = useState<string>("all");
  const [weeks, setWeeks] = useState("8");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setD(await getOverview(agentId === "all" ? 0 : Number(agentId), Number(weeks)));
    } catch {
      toast.error("Could not load the collections dashboard.");
    } finally {
      setLoading(false);
    }
  }, [agentId, weeks]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { getConfig().then(setConfig).catch(() => undefined); }, []);

  // A collector's own view has nothing to pick between, so the selector only
  // appears for someone the server would actually widen the scope for.
  const canWiden = (d?.scope ?? "MY_DESK") === "ALL_COLLECTIONS" || agentId !== "all";

  const trend = useMemo(
    () => (d?.trend ?? []).map((t) => ({ ...t, week: weekLabel(t.weekStart) })),
    [d]);
  const flow = useMemo(
    () => (d?.trend ?? []).map((t) => ({
      week: weekLabel(t.weekStart), opened: t.opened, closed: -t.closed,
      net: t.opened - t.closed,
    })),
    [d]);

  if (!d && loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!d) return null;

  // An account worked by two collectors counts on both desks but only once in
  // the book. Say so, rather than leave a column that appears not to add up.
  const deskSum = d.collectors.reduce((s, c) => s + c.exposure, 0);
  const overlap = Math.round(deskSum - d.openExposure);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Collections Dashboard"
        description={
          d.scope === "MY_DESK"
            ? "Your book: the accounts you are collecting on"
            : "Every account under collection you have access to"
        }
        actions={
          <div className="flex items-center gap-2">
            {canWiden && (
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger className="h-9 w-[190px] text-sm">
                  <SelectValue placeholder="Whose book" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Everyone I can see</SelectItem>
                  {config?.agents.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select value={weeks} onValueChange={setWeeks}>
              <SelectTrigger className="h-9 w-[130px] text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["8", "12", "16", "26"].map((w) => (
                  <SelectItem key={w} value={w}>{w} weeks</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                       : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
          </div>
        }
      />

      {/* Six measures, each answering a different question */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Kpi
          icon={Wallet} label="Open exposure" value={money(d.openExposure)}
          sub={`${d.accounts} accounts · ${d.customers} customers`}
          footnote={`Balance still owed on accounts with a live case. ${money(d.over90Exposure)} of it is past 90 days.`}
        />
        <Kpi
          icon={Banknote} label="Collected 30d" value={money(d.collected30d)}
          delta={d.collectedDeltaPct} tone="text-success"
          sub={`${d.collectedPayments} payments`}
          footnote={`Settled payments over the last 30 days, against the 30 before it. ${
            d.collectedToday > 0 ? `${money(d.collectedToday)} in today.` : "Nothing in yet today."}`}
        />
        <Kpi
          icon={Layers} label="Recovery rate" value={pct(d.recoveryRatePct)}
          sub="of what was collectable"
          footnote="Collected in the last 30 days ÷ (that amount + everything still owed)."
        />
        <Kpi
          icon={HandCoins} label="Promises kept" value={pct(d.promiseKeptRatePct)}
          tone={(d.promiseKeptRatePct ?? 100) < 50 ? "text-warning" : "text-foreground"}
          sub={`${d.promisesKept} kept · ${d.promisesBroken} broken`}
          footnote="Share of promises that were honoured, counting only those that fell due in the last 90 days."
        />
        <Kpi
          icon={Timer} label="On-time work" value={pct(d.slaCompliancePct)}
          tone={(d.slaCompliancePct ?? 100) < 70 ? "text-destructive" : "text-foreground"}
          sub={`${d.slaBreached} past due · ${d.slaDueSoon} due in 24h`}
          footnote="Share of live cases still inside their next-action deadline. Resolved cases and paused clocks are excluded."
        />
        <Kpi
          icon={Clock} label="Days to close" value={d.avgDaysToClose == null ? "—" : String(d.avgDaysToClose)}
          sub={`${d.closedMtd} closed this month`}
          footnote="Average days from opening a case to closing it, over cases closed in the last 90 days."
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {/* Cash in, against what was promised */}
        <div className="lg:col-span-2">
          <Panel
            title="Collected against promised"
            hint="What customers said they would pay, and what actually arrived"
          >
            <div className="p-3 h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={trend} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="collected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tickFormatter={short} tick={{ fontSize: 11 }}
                         stroke="hsl(var(--muted-foreground))" />
                  <Tooltip {...tooltipStyle}
                    formatter={(v: number, n: string) => [money(v), n === "collected" ? "Collected" : "Promised"]} />
                  <Area type="monotone" dataKey="collected" stroke="hsl(var(--success))"
                        strokeWidth={2} fill="url(#collected)" />
                  <Line type="monotone" dataKey="promised" stroke="hsl(var(--info))"
                        strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        {/* Where the money is stuck */}
        <Panel title="Exposure by age" hint="Older money is harder money">
          <div className="p-3 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.ageing} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tickFormatter={short} tick={{ fontSize: 11 }}
                       stroke="hsl(var(--muted-foreground))" />
                <Tooltip {...tooltipStyle}
                  formatter={(v: number, _n, item) =>
                    [`${money(v)} · ${item?.payload?.accounts ?? 0} accounts`, "Exposure"]} />
                <Bar dataKey="exposure" radius={[6, 6, 0, 0]}>
                  {d.ageing.map((a) => (
                    <Cell key={a.bucket} fill={AGEING_TONE[a.bucket] ?? "hsl(var(--primary))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {/* Is the backlog growing or shrinking? */}
        <Panel title="Cases in and out" hint="Opened above the line, closed below it">
          <div className="p-3 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={flow} stackOffset="sign"
                        margin={{ top: 6, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip {...tooltipStyle}
                  formatter={(v: number, n: string) =>
                    [Math.abs(v), n === "opened" ? "Opened" : "Closed"]} />
                <Bar dataKey="opened" stackId="f" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="closed" stackId="f" fill="hsl(var(--success))" radius={[0, 0, 4, 4]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* What breaches next */}
        <Panel
          title="Needs attention first"
          hint="Ordered by how close the next action is to being late"
          right={d.slaBreached > 0 ? (
            <Pill tone="bg-destructive/10 text-destructive border-destructive/25">
              {d.slaBreached} past due
            </Pill>
          ) : undefined}
        >
          <div className="divide-y divide-border max-h-[240px] overflow-y-auto">
            {d.atRisk.length === 0 && (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                Nothing is close to breaching.
              </p>
            )}
            {d.atRisk.map((c) => (
              <button
                key={c.caseId}
                onClick={() => onOpenCase?.(c.caseId)}
                className="w-full text-left px-4 py-2.5 hover:bg-muted/50 transition flex items-center gap-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground truncate">
                      {c.customerName}
                    </span>
                    <Pill tone={PRIORITY_TONE[c.priority]}>{c.priority}</Pill>
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {c.caseNumber} · {c.caseType}
                    {c.agentName ? ` · ${c.agentName}` : " · unassigned"}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className={`text-xs font-medium tabular-nums ${
                    c.hoursToSla < 0 ? "text-destructive" : "text-warning"}`}>
                    {c.hoursToSla < 0
                      ? `${Math.round(Math.abs(c.hoursToSla))}h over`
                      : `${Math.round(c.hoursToSla)}h left`}
                  </div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">
                    {money(c.outstanding)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Panel>

        {/* The biggest balances in the book */}
        <Panel title="Largest balances"
               hint="One row per account — where a single call moves the number most">
          <div className="divide-y divide-border max-h-[240px] overflow-y-auto">
            {d.topExposure.map((c) => (
              <div key={c.caseId}
                   className="px-4 py-2.5 hover:bg-muted/50 transition flex items-center gap-2">
                <button onClick={() => onOpenCustomer?.(c.customerId)}
                        className="min-w-0 flex-1 text-left group">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground truncate group-hover:text-primary">
                      {c.customerName}
                    </span>
                    {c.companyName && c.companyName !== c.customerName && (
                      <span className="text-[10px] text-muted-foreground truncate">
                        {c.companyName}
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {c.accountCode} · {c.dpd} DPD ·{" "}
                    <span className={RISK_TONE[c.riskLevel ?? ""] ?? ""}>{c.riskLevel}</span>
                  </div>
                </button>
                <div className="text-right shrink-0">
                  <div className="text-xs font-semibold tabular-nums">{money(c.outstanding)}</div>
                  <button onClick={() => onOpenCase?.(c.caseId)}
                          title={c.caseCount > 1
                            ? `${c.caseCount} cases on this account — opens the most urgent`
                            : "Open this case"}
                          className="text-[10px] text-muted-foreground hover:text-primary">
                    {c.caseNumber}
                    {c.caseCount > 1 && ` +${c.caseCount - 1}`}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Who is carrying what — only meaningful when looking at more than one desk */}
      {d.collectors.length > 0 && (
        <Panel
          title="The floor"
          hint="Each collector's book, and what has come in against it"
          right={<Pill>{d.collectors.length} collectors</Pill>}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  {["Collector", "Live cases", "Exposure", "Collected · 30d",
                    "Promises kept", "Past due"].map((h, i) => (
                    <th key={h} className={`px-4 py-2 font-medium ${i ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {d.collectors.map((c) => (
                  <tr key={c.agentId} className="hover:bg-muted/30 transition">
                    <td className="px-4 py-2">
                      <button onClick={() => setAgentId(String(c.agentId))}
                              className="text-foreground hover:text-primary font-medium">
                        {c.agentName}
                      </button>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{c.openCases}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(c.exposure)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-success">
                      {money(c.collected30d)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      <span className={(c.keptRate ?? 100) < 40 ? "text-warning" : ""}>
                        {pct(c.keptRate)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {c.breached > 0 ? (
                        <span className="text-destructive font-medium">{c.breached}</span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {overlap > 0 && (
            <p className="px-4 py-2.5 border-t border-border text-[11px] text-muted-foreground">
              Desk exposure adds up to {money(deskSum)} against a book of {money(d.openExposure)}:
              {" "}{money(overlap)} sits on accounts two collectors are both working, so it counts
              on each desk but only once in the book.
            </p>
          )}
        </Panel>
      )}

      {d.awaitingClose > 0 && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3" />
          {d.awaitingClose} resolved {d.awaitingClose === 1 ? "case is" : "cases are"} waiting to be
          closed. Resolved work is left out of the figures above, which count what is still live.
        </p>
      )}
    </div>
  );
};

export default CollectionsDashboard;
