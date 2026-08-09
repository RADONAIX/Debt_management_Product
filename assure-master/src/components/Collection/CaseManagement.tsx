import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowUpRight, BarChart3, Inbox, Layers, Loader2, RefreshCw, Search,
  Settings2, UserX, Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { money, moneyShort } from "@/lib/money";
import { ApiError } from "@/lib/api";
import {
  getCases, getConfig, getDashboard,
  type CaseDashboard, type CaseRow, type CollectionConfig,
} from "@/lib/collection";
import { CaseDrawer } from "./CaseDrawer";
import { CaseGroups } from "./CaseGroups";
import {
  PRIORITY_TONE, Pill, RISK_TONE, STATE_TONE, dateTimeText, pretty, relative,
} from "./shared";

type View = "dashboard" | "queue" | "assignment" | "config";

const VIEWS: { key: View; label: string; icon: typeof Inbox }[] = [
  { key: "dashboard", label: "Dashboard", icon: BarChart3 },
  { key: "queue", label: "Case queue", icon: Inbox },
  { key: "assignment", label: "Assignment", icon: Layers },
  { key: "config", label: "Configuration", icon: Settings2 },
];

/** Case Management — every case, however it was raised. */
export const CaseManagement = ({
  canEdit = true,
  onOpenCustomer,
  embeddedView,
  agentId,
}: {
  canEdit?: boolean;
  onOpenCustomer?: (code: string) => void;
  /** Render one view without the internal switcher — used by the unified shell. */
  embeddedView?: View;
  /** Scope the case queue to one agent, for an agent's own tab. */
  agentId?: number;
}) => {
  const [view, setView] = useState<View>(embeddedView ?? "dashboard");
  const [dash, setDash] = useState<CaseDashboard | null>(null);
  const [config, setConfig] = useState<CollectionConfig | null>(null);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [state, setState] = useState<string | null>(null);
  const [queue, setQueue] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [priority, setPriority] = useState<string | null>(null);
  const [breached, setBreached] = useState(false);
  const [unassigned, setUnassigned] = useState(false);
  const [drawerCase, setDrawerCase] = useState<number | null>(null);
  // A customer with several cases reads better as one row that opens.
  const [grouped, setGrouped] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, dsh] = await Promise.all([
        getCases({
          search: search.trim() || undefined, state: state ?? undefined,
          queue: queue ?? undefined, source: source ?? undefined,
          priority: priority ?? undefined, breached, unassigned, agentId,
          limit: 400,
        }),
        getDashboard(),
      ]);
      setCases(c);
      setDash(dsh);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load cases.");
    } finally {
      setLoading(false);
    }
  }, [search, state, queue, source, priority, breached, unassigned, agentId]);

  useEffect(() => {
    getConfig().then(setConfig).catch(() => undefined);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 220);
    return () => clearTimeout(t);
  }, [load]);

  // The shell owns the tabs when embedded, so follow whatever it asks for.
  useEffect(() => {
    if (embeddedView) setView(embeddedView);
  }, [embeddedView]);

  const activeFilters = useMemo(() => [
    state && { label: pretty(state), clear: () => setState(null) },
    queue && { label: queue, clear: () => setQueue(null) },
    source && { label: pretty(source), clear: () => setSource(null) },
    priority && { label: priority, clear: () => setPriority(null) },
    breached && { label: "SLA breached", clear: () => setBreached(false) },
    unassigned && { label: "Unassigned", clear: () => setUnassigned(false) },
  ].filter(Boolean) as { label: string; clear: () => void }[],
  [state, queue, source, priority, breached, unassigned]);

  const kpi = (label: string, value: string, sub?: string, tone = "text-foreground",
               onClick?: () => void) => (
    <button onClick={onClick} disabled={!onClick}
      className={`text-left px-4 py-3 rounded-xl border border-border bg-card transition ${
        onClick ? "hover:border-primary/40 hover:bg-muted/40" : "cursor-default"}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">
        {label}
      </div>
      <div className={`text-xl font-semibold tabular-nums mt-0.5 ${tone}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </button>
  );

  /** A labelled distribution, clickable to filter the queue. */
  const breakdown = (title: string, rows: { key: string; count: number; value: number }[],
                     onPick?: (k: string) => void, tone?: (k: string) => string) => {
    const max = Math.max(1, ...rows.map((r) => r.count));
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="text-xs font-semibold text-foreground mb-3">{title}</h3>
        <div className="space-y-2">
          {rows.map((r) => (
            <button key={r.key} onClick={() => onPick?.(r.key)} disabled={!onPick}
              className="w-full text-left group">
              <div className="flex items-center justify-between text-[11px] mb-0.5">
                <span className="text-foreground truncate group-hover:text-primary transition">
                  {pretty(r.key)}
                </span>
                <span className="text-muted-foreground tabular-nums shrink-0">
                  {r.count} · {moneyShort(r.value)}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                <div className={`h-full rounded-full ${tone?.(r.key) ?? "bg-primary"}`}
                  style={{ width: `${(r.count / max) * 100}%` }} />
              </div>
            </button>
          ))}
          {rows.length === 0 && <p className="text-[11px] text-muted-foreground">Nothing here.</p>}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* View switch — only when this screen stands alone */}
      <div className={`flex flex-wrap items-center gap-2 ${embeddedView ? "hidden" : ""}`}>
        <div className="inline-flex rounded-xl border border-border bg-card p-1">
          {VIEWS.map((v) => (
            <button key={v.key} onClick={() => setView(v.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                view === v.key ? "bg-primary text-primary-foreground"
                               : "text-muted-foreground hover:text-foreground"}`}>
              <v.icon className="h-3.5 w-3.5" />{v.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="h-9 pl-8 text-sm" value={search}
            onChange={(e) => { setSearch(e.target.value); setView("queue"); }}
            placeholder="Search case number, customer or summary" />
        </div>
        <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* KPIs — the shell shows its own when embedded */}
      <div className={`grid grid-cols-2 md:grid-cols-6 gap-3 ${
        embeddedView && embeddedView !== "dashboard" ? "hidden" : ""}`}>
        {kpi("Open cases", String(dash?.totalOpen ?? 0), moneyShort(dash?.totalValue ?? 0),
          "text-foreground", () => { setView("queue"); setBreached(false); setUnassigned(false); })}
        {kpi("SLA breached", String(dash?.slaBreached ?? 0), "past the next action",
          (dash?.slaBreached ?? 0) > 0 ? "text-destructive" : "text-foreground",
          () => { setView("queue"); setBreached(true); })}
        {kpi("Unassigned", String(dash?.unassigned ?? 0), "need an owner",
          (dash?.unassigned ?? 0) > 0 ? "text-warning" : "text-foreground",
          () => { setView("queue"); setUnassigned(true); })}
        {kpi("Due today", String(dash?.dueToday ?? 0), "next action due")}
        {kpi("Created today", String(dash?.createdToday ?? 0),
          `${dash?.closedToday ?? 0} closed`)}
        {kpi("Avg resolution", dash?.avgResolutionHours ? `${dash.avgResolutionHours}h` : "—",
          `${dash?.reopened ?? 0} reopened`)}
      </div>

      {/* --- Dashboard --- */}
      {view === "dashboard" && dash && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {breakdown("By workflow state",
            dash.byState.map((r) => ({ key: r.state, count: r.count, value: r.value })),
            (k) => { setState(k); setView("queue"); })}
          {breakdown("By queue",
            dash.byQueue.map((r) => ({ key: r.queue, count: r.count, value: r.value })),
            (k) => { setQueue(k); setView("queue"); })}
          {breakdown("By source — how the case was raised",
            dash.bySource.map((r) => ({ key: r.source, count: r.count, value: r.value })),
            (k) => { setSource(k); setView("queue"); })}
          {breakdown("By priority",
            dash.byPriority.map((r) => ({ key: r.priority, count: r.count, value: r.value })),
            (k) => { setPriority(k); setView("queue"); },
            (k) => k === "Critical" ? "bg-destructive" : k === "High" ? "bg-warning"
                 : k === "Medium" ? "bg-info" : "bg-muted-foreground")}
          {breakdown("By case type",
            dash.byType.map((r) => ({ key: r.type, count: r.count, value: r.value })))}
          <div className="rounded-2xl border border-border bg-card p-4">
            <h3 className="text-xs font-semibold text-foreground mb-3">Case ageing</h3>
            <div className="space-y-2">
              {dash.ageing.map((a) => {
                const max = Math.max(1, ...dash.ageing.map((x) => x.count));
                return (
                  <div key={a.bucket}>
                    <div className="flex justify-between text-[11px] mb-0.5">
                      <span className="text-foreground">{a.bucket}</span>
                      <span className="text-muted-foreground tabular-nums">{a.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${
                        a.bucket === "Over 30 days" ? "bg-destructive"
                        : a.bucket === "7-30 days" ? "bg-warning" : "bg-primary"}`}
                        style={{ width: `${(a.count / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* --- Assignment view --- */}
      {view === "assignment" && dash && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Workload by agent</span>
            <span className="ml-3">{dash.unassigned} cases have no owner</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border">
                <th className="px-4 py-2 font-semibold">Agent</th>
                <th className="px-4 py-2 font-semibold text-right">Open cases</th>
                <th className="px-4 py-2 font-semibold text-right">SLA breached</th>
                <th className="px-4 py-2 font-semibold text-right">Value</th>
                <th className="px-4 py-2 font-semibold">Load</th>
              </tr>
            </thead>
            <tbody>
              {dash.byAgent.map((a) => {
                const max = Math.max(1, ...dash.byAgent.map((x) => x.count));
                return (
                  <tr key={a.agent} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-2.5 font-medium text-foreground">{a.agent}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{a.count}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums ${
                      a.breached > 0 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                      {a.breached}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{money(a.value)}</td>
                    <td className="px-4 py-2.5 w-40">
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-primary"
                          style={{ width: `${(a.count / max) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {dash.unassigned > 0 && (
            <button onClick={() => { setUnassigned(true); setView("queue"); }}
              className="w-full px-4 py-2.5 border-t border-border text-left text-xs text-warning hover:bg-warning/5 flex items-center gap-2">
              <UserX className="h-3.5 w-3.5" />
              {dash.unassigned} unassigned cases — review and assign
            </button>
          )}
        </div>
      )}

      {/* --- Configuration --- */}
      {view === "config" && config && (
        <div className="space-y-3">
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border text-xs font-semibold text-foreground">
              Queues — where work lands and how it is handed out
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border">
                  <th className="px-4 py-2 font-semibold">Queue</th>
                  <th className="px-4 py-2 font-semibold">Criteria</th>
                  <th className="px-4 py-2 font-semibold">Assignment</th>
                  <th className="px-4 py-2 font-semibold text-right">Open</th>
                  <th className="px-4 py-2 font-semibold text-right">Breached</th>
                  <th className="px-4 py-2 font-semibold text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {config.queues.map((q) => (
                  <tr key={q.code} className="border-b border-border last:border-0 hover:bg-muted/40 cursor-pointer"
                    onClick={() => { setQueue(q.code); setView("queue"); }}>
                    <td className="px-4 py-2">
                      <div className="font-medium text-foreground">{q.name}</div>
                      <div className="text-[10px] text-muted-foreground">{q.description}</div>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {[q.dpdMin != null || q.dpdMax != null
                          ? `DPD ${q.dpdMin ?? 0}–${q.dpdMax ?? "∞"}` : null,
                        q.amountMin != null ? `≥ ${money(q.amountMin)}` : null,
                        q.riskLevels.length ? q.riskLevels.join("/") : null,
                        q.customerTypes.length ? q.customerTypes.join("/") : null,
                      ].filter(Boolean).join(" · ") || "any"}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {pretty(q.assignmentMode)} · max {q.maxPerAgent}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{q.openCases}</td>
                    <td className={`px-4 py-2 text-right tabular-nums ${
                      q.slaBreached ? "text-destructive" : ""}`}>{q.slaBreached}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{moneyShort(q.totalValue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border text-xs font-semibold">
                Case types and their duplicate policy
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase text-muted-foreground border-b border-border">
                    <th className="px-4 py-2 font-semibold">Type</th>
                    <th className="px-4 py-2 font-semibold">Queue</th>
                    <th className="px-4 py-2 font-semibold">SLA</th>
                    <th className="px-4 py-2 font-semibold">If already open</th>
                  </tr>
                </thead>
                <tbody>
                  {config.types.map((t) => (
                    <tr key={t.code} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 font-medium text-foreground">{t.name}</td>
                      <td className="px-4 py-2 text-muted-foreground">{t.defaultQueue ?? "—"}</td>
                      <td className="px-4 py-2 text-muted-foreground">{t.slaHours}h</td>
                      <td className="px-4 py-2"><Pill>{pretty(t.duplicatePolicy)}</Pill></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border text-xs font-semibold flex items-center gap-1.5">
                <Workflow className="h-3.5 w-3.5" /> Workflow states
              </div>
              <div className="p-4 flex flex-wrap gap-1.5">
                {config.states.map((s) => (
                  <div key={s.code}
                    className={`rounded-lg border px-2.5 py-1.5 text-[11px] ${STATE_TONE[s.code] ?? ""}`}>
                    {s.name}
                    <span className="opacity-70"> · {s.caseCount}</span>
                    {s.pausesSla && <span className="opacity-70"> · SLA pauses</span>}
                  </div>
                ))}
              </div>
              <div className="px-4 pb-4">
                <h4 className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                  Assignment rules (first match wins)
                </h4>
                <div className="space-y-1">
                  {config.rules.map((r) => (
                    <div key={r.id} className="flex items-center gap-2 text-[11px] border-b border-border/40 pb-1">
                      <span className="font-mono text-muted-foreground w-8 shrink-0">{r.priority}</span>
                      <span className="text-foreground truncate flex-1">{r.name}</span>
                      <Pill>{r.targetQueue}</Pill>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Case queue --- */}
      {view === "queue" && (
        <>
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">Filtered by</span>
              {activeFilters.map((f) => (
                <button key={f.label} onClick={f.clear}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/25 px-2 py-0.5 text-[11px] text-primary hover:bg-primary/20">
                  {f.label} ✕
                </button>
              ))}
            </div>
          )}
          <CaseGroups
            cases={cases}
            loading={loading}
            grouped={grouped}
            canEdit={canEdit}
            breached={breached}
            onToggleGrouped={() => setGrouped((g) => !g)}
            onToggleBreached={() => setBreached(!breached)}
            onOpenCase={setDrawerCase}
            onOpenCustomer={onOpenCustomer}
            onChanged={() => void load()}
          />
        </>
      )}

      <CaseDrawer caseId={drawerCase} config={config} onClose={() => setDrawerCase(null)}
        onChanged={() => void load()} onOpenCustomer={onOpenCustomer} />
    </div>
  );
};

export default CaseManagement;
