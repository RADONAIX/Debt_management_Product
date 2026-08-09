import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Banknote, Briefcase, CheckCircle2, Clock, HandCoins, Loader2,
  Medal, PhoneCall, RefreshCw, Target, TrendingUp, Wallet,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Line,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/layout/PageHeader";
import { money } from "@/lib/money";
import { getAgentPerformance, type AgentPerformance as Perf } from "@/lib/operations";
import { getConfig, type CollectionConfig } from "@/lib/collection";

const short = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`
  : n.toFixed(0);

const pct = (v?: number | null) => (v == null ? "—" : `${v}%`);

const monthLabel = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short" });

const tooltipStyle = {
  contentStyle: {
    background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
    borderRadius: "0.75rem", fontSize: "12px",
  },
  labelStyle: { color: "hsl(var(--muted-foreground))", fontSize: "11px" },
};

const PRIORITY_TONE: Record<string, string> = {
  Critical: "text-destructive", High: "text-warning",
  Medium: "text-info", Low: "text-muted-foreground",
};

const Pill = ({ tone, children }: { tone?: string; children: React.ReactNode }) => (
  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none whitespace-nowrap ${
    tone ?? "bg-muted text-muted-foreground border-border"}`}>
    {children}
  </span>
);

/** A headline number, with the one figure that gives it context. */
const Kpi = ({ icon: Icon, label, value, sub, tone = "", bar }: {
  icon: typeof Wallet; label: string; value: string; sub: string;
  tone?: string; bar?: number | null;
}) => (
  <Card className="p-4 flex flex-col gap-1">
    <div className="flex items-center gap-2">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">
        {label}
      </span>
      <Icon className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
    </div>
    <div className={`text-2xl font-semibold tabular-nums leading-tight ${tone}`}>{value}</div>
    <div className="text-[11px] text-muted-foreground">{sub}</div>
    {bar != null && (
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mt-1">
        <div
          className={`h-full rounded-full ${
            bar >= 100 ? "bg-success" : bar >= 70 ? "bg-primary" : "bg-warning"}`}
          style={{ width: `${Math.min(Math.max(bar, 0), 100)}%` }}
        />
      </div>
    )}
  </Card>
);

const Panel = ({ title, hint, right, children }: {
  title: string; hint?: string; right?: React.ReactNode; children: React.ReactNode;
}) => (
  <Card className="overflow-hidden">
    <div className="px-4 py-3 border-b border-border flex items-center gap-2">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
        {hint && <p className="text-[11px] text-muted-foreground truncate">{hint}</p>}
      </div>
      {right && <div className="ml-auto shrink-0">{right}</div>}
    </div>
    {children}
  </Card>
);

/**
 * Agent Performance — one collector's month.
 *
 * Every figure comes from the same records the rest of the product reads: cash
 * from the payment ledger, work from the case, promise, dispute and task
 * tables. Nothing is stored only for this screen, so a number here can always
 * be traced to a row somewhere else.
 *
 * A collector sees their own desk. Only someone who may see the floor gets the
 * picker, and that is enforced by the server, not by hiding the control.
 */
const AgentPerformance = ({ canSeeFloor = false }: { canSeeFloor?: boolean }) => {
  const [d, setD] = useState<Perf | null>(null);
  const [config, setConfig] = useState<CollectionConfig | null>(null);
  const [agentId, setAgentId] = useState<string>("me");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setD(await getAgentPerformance(agentId === "me" ? undefined : Number(agentId)));
    } catch {
      toast.error("Could not load the performance figures.");
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (canSeeFloor) getConfig().then(setConfig).catch(() => undefined);
  }, [canSeeFloor]);

  const history = useMemo(
    () => (d?.history ?? []).map((m) => ({ ...m, label: monthLabel(m.month) })), [d]);
  const activity = useMemo(
    () => (d?.history ?? []).map((m) => ({
      label: monthLabel(m.month), contacts: m.contacts,
      promises: m.ptpCreated, kept: m.ptpKept, breaches: m.slaBreaches,
    })), [d]);

  if (loading && !d) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!d) return null;

  const initials = d.agentName.split(" ").map((w) => w[0]).join("").slice(0, 2);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Agent Performance"
        description="Collections, promises, conversations and follow-ups for the month"
        actions={
          <div className="flex items-center gap-2">
            {canSeeFloor && (
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger className="h-9 w-[190px] text-sm">
                  <SelectValue placeholder="Whose desk" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="me">My desk</SelectItem>
                  {config?.agents.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                       : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
          </div>
        }
      />

      {/* Who this is */}
      <Card className="p-4 flex items-center gap-4 flex-wrap">
        <span className="h-11 w-11 rounded-full bg-primary/10 text-primary text-sm font-semibold flex items-center justify-center shrink-0">
          {initials}
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-base font-semibold text-foreground">{d.agentName}</h2>
            {d.employeeCode && <Pill>{d.employeeCode}</Pill>}
            {d.availability && (
              <Pill tone={d.availability === "AVAILABLE"
                ? "bg-success/10 text-success border-success/25" : undefined}>
                {d.availability.toLowerCase()}
              </Pill>
            )}
            {d.rank && (
              <Pill tone="bg-primary/10 text-primary border-primary/25">
                <Medal className="h-3 w-3 mr-0.5" /> {d.rank} of {d.ofAgents} this month
              </Pill>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {[d.expertise, d.skillGroup,
              d.yearsExperience ? `${d.yearsExperience} years` : null,
              d.languages.length ? d.languages.join(", ") : null]
              .filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="ml-auto flex gap-4 text-right">
          {[
            ["Book", money(d.portfolio)],
            ["Customers", String(d.customers)],
            ["Caseload", `${d.openCases}${d.maxCaseload ? ` / ${d.maxCaseload}` : ""}`],
          ].map(([l, v]) => (
            <div key={l}>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{l}</div>
              <div className="text-sm font-semibold tabular-nums">{v}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* The six that matter this month */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Kpi
          icon={Banknote} label="Collected" value={money(d.collectedMtd)}
          sub={`${d.payments} payments this month`} tone="text-success"
        />
        <Kpi
          icon={Target} label="Against target" value={pct(d.attainment)}
          sub={`${money(d.collectedMtd)} of ${money(d.target)}`} bar={d.attainment ?? 0}
        />
        <Kpi
          icon={HandCoins} label="Promises kept" value={pct(d.keptRate)}
          sub={`${d.promisesKept} kept · ${d.promisesBroken} broken`}
          tone={(d.keptRate ?? 100) < 50 ? "text-warning" : ""}
        />
        <Kpi
          icon={Clock} label="On-time work" value={pct(d.slaCompliance)}
          sub={`${d.slaBreached} past due · ${d.slaDueSoon} due in 24h`}
          tone={(d.slaCompliance ?? 100) < 70 ? "text-destructive" : ""}
        />
        <Kpi
          icon={PhoneCall} label="Reached" value={pct(d.reachRate)}
          sub={`${d.contactsReached} of ${d.contactsMtd} attempts`}
        />
        <Kpi
          icon={CheckCircle2} label="Follow-ups done" value={pct(d.taskCompletion)}
          sub={`${d.tasksDone} of ${d.tasksTotal} tasks`}
          tone={d.tasksOverdue > 0 ? "text-warning" : ""}
        />
      </div>

      {/* Today */}
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-foreground">Today</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5 mt-2">
          {[
            ["Collected today", money(d.collectedToday), ""],
            ["Conversations", String(d.contactsToday), ""],
            ["Promises due", String(d.promisesDueToday),
              d.promisesDueToday > 0 ? "text-info" : ""],
            ["Follow-ups due", String(d.tasksDueToday),
              d.tasksOverdue > 0 ? "text-warning" : ""],
            ["Not picked up", String(d.notStarted),
              d.notStarted > 0 ? "text-warning" : ""],
          ].map(([label, value, tone]) => (
            <div key={label} className="rounded-xl border border-border px-3 py-2">
              <div className="text-[11px] text-muted-foreground">{label}</div>
              <div className={`text-lg font-semibold tabular-nums ${tone || "text-foreground"}`}>
                {value}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-3 lg:grid-cols-3">
        {/* Six months of cash against target */}
        <div className="lg:col-span-2">
          <Panel title="Collections against target"
                 hint="Six months, from the payment ledger">
            <div className="p-3 h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={history} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="collected" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }}
                         stroke="hsl(var(--muted-foreground))" />
                  <YAxis tickFormatter={short} tick={{ fontSize: 11 }}
                         stroke="hsl(var(--muted-foreground))" />
                  <Tooltip {...tooltipStyle}
                    formatter={(v: number, n: string) =>
                      [money(v), n === "collected" ? "Collected" : "Target"]} />
                  <Area type="monotone" dataKey="collected" stroke="hsl(var(--success))"
                        strokeWidth={2} fill="url(#collected)" />
                  <Line type="monotone" dataKey="target" stroke="hsl(var(--muted-foreground))"
                        strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        {/* What needs doing first */}
        <Panel
          title="Work in front of you"
          hint="Ordered by how close each case is to being late"
          right={d.slaBreached > 0 ? (
            <Pill tone="bg-destructive/10 text-destructive border-destructive/25">
              {d.slaBreached} late
            </Pill>
          ) : undefined}
        >
          <div className="divide-y divide-border max-h-[250px] overflow-y-auto">
            {d.nextUp.length === 0 && (
              <p className="px-4 py-10 text-center text-xs text-muted-foreground">
                Nothing is waiting on you.
              </p>
            )}
            {d.nextUp.map((c) => (
              <div key={c.caseId} className="px-4 py-2.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-foreground truncate">
                    {c.customerName}
                  </span>
                  <span className={`text-[10px] ${PRIORITY_TONE[c.priority] ?? ""}`}>
                    {c.priority}
                  </span>
                  <span className={`ml-auto text-[11px] font-medium tabular-nums shrink-0 ${
                    c.hoursToSla < 0 ? "text-destructive" : "text-warning"}`}>
                    {c.hoursToSla < 0
                      ? `${Math.round(Math.abs(c.hoursToSla))}h over`
                      : `${Math.round(c.hoursToSla)}h left`}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {c.caseNumber} · {c.caseType} · {money(c.outstanding)} · {c.reason}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* The work behind the cash */}
        <Panel title="Activity by month"
               hint="Conversations, promises taken and how many held">
          <div className="p-3 h-[230px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={activity} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }}
                       stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip {...tooltipStyle} />
                <Bar dataKey="contacts" fill="hsl(var(--info))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="promises" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="kept" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* Where this desk stands */}
        <Panel title="The floor this month"
               hint="Everyone's collections against their own target">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  {["Collector", "Collected", "Target", "Attained", "Cases"].map((h, i) => (
                    <th key={h} className={`px-4 py-2 font-medium ${i ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {d.floor.map((p) => (
                  <tr key={p.agentId}
                      className={p.isMe ? "bg-primary/5 font-medium" : "hover:bg-muted/30"}>
                    <td className="px-4 py-2">
                      {p.agentName}
                      {p.isMe && <span className="text-[10px] text-primary ml-1.5">you</span>}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(p.collected)}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                      {money(p.target)}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      <span className={(p.attainment ?? 0) >= 100 ? "text-success" : ""}>
                        {pct(p.attainment)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {p.openCases}
                      {p.breached > 0 && (
                        <span className="text-destructive text-[10px] ml-1">
                          {p.breached} late
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {/* The rest of the picture, where a number alone is enough */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: Briefcase, label: "Cases closed this month", value: String(d.closedThisMonth),
            sub: d.avgDaysToClose ? `${d.avgDaysToClose} days on average` : "no closures yet" },
          { icon: HandCoins, label: "Promises in flight", value: String(d.openPromises),
            sub: money(d.openPromiseValue) },
          { icon: AlertTriangle, label: "Open disputes", value: String(d.openDisputes),
            sub: `${d.disputesSettledMtd} settled this month` },
          { icon: TrendingUp, label: "Caseload used", value: pct(d.caseloadPct),
            sub: `${d.openCases} of ${d.maxCaseload ?? "—"} places` },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-2">
              <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground truncate">{s.label}</span>
            </div>
            <div className="text-xl font-semibold tabular-nums mt-1">{s.value}</div>
            <div className="text-[11px] text-muted-foreground truncate">{s.sub}</div>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default AgentPerformance;
