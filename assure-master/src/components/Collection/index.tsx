import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3, Briefcase, CalendarClock, Headset, Inbox, Layers, RefreshCw, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { moneyShort } from "@/lib/money";
import { ApiError } from "@/lib/api";
import {
  ALL_DESKS, getAgents, getDeskSummary, settlePromises,
  type Agent, type DeskSummary,
} from "@/lib/agentDesk";
import {
  getCandidateSummary, getConfig, getCounters,
  type CandidateSummary, type CollectionConfig, type TicketCounters,
} from "@/lib/collection";
import { Candidates } from "./Candidates";
import { CaseManagement } from "./CaseManagement";
import { TicketBoard } from "./TicketBoard";
import { TaskDiary } from "./TaskDiary";
import { CaseDrawer } from "./CaseDrawer";
import { Pill, pretty } from "./shared";

type Tab = "candidates" | "cases" | "diary" | "dashboard" | "assignment";

/**
 * Collections Workspace — one screen for the whole collections operation.
 *
 * Three tabs do the work: what needs a case, the ticket board, and the
 * follow-up diary. A supervisor also sees the floor-wide dashboard and the
 * assignment view, gated on permission.
 */
export const CollectionsWorkspace = ({
  canEdit = true,
  canSupervise = false,
  onOpenCustomer,
  initialCaseId,
}: {
  canEdit?: boolean;
  /** Sees the floor: dashboard and assignment. */
  canSupervise?: boolean;
  onOpenCustomer?: (code: string) => void;
  /** A case to open on arrival, when another screen sent the user here. */
  initialCaseId?: number | null;
}) => {
  // "Needs a case" is where the day starts: work that has nobody on it.
  const [tab, setTab] = useState<Tab>("candidates");
  const [agents, setAgents] = useState<Agent[]>([]);
  // A supervisor lands on the whole floor; an agent on their own desk. Without
  // this, anyone who owns no customers (an admin, say) sees an empty queue.
  const [deskId, setDeskId] = useState<number | undefined>(
    canSupervise ? ALL_DESKS : undefined,
  );
  const [desk, setDesk] = useState<DeskSummary | null>(null);
  const [candidates, setCandidates] = useState<CandidateSummary | null>(null);
  const [counters, setCounters] = useState<TicketCounters | null>(null);
  const [config, setConfig] = useState<CollectionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [drawerCase, setDrawerCase] = useState<number | null>(initialCaseId ?? null);

  // Arriving from another screen with a case in hand: open it, and switch to
  // the board behind it so closing the drawer leaves somewhere sensible.
  useEffect(() => {
    if (initialCaseId) {
      setDrawerCase(initialCaseId);
      setTab("cases");
    }
  }, [initialCaseId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, cs, ct] = await Promise.all([
        getDeskSummary(deskId),
        getCandidateSummary(),
        getCounters(),
      ]);
      setDesk(s);
      setCandidates(cs);
      setCounters(ct);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load the workspace.");
    } finally {
      setLoading(false);
    }
  }, [deskId]);

  useEffect(() => {
    getConfig().then(setConfig).catch(() => undefined);
    if (canSupervise) getAgents().then(setAgents).catch(() => undefined);
  }, [canSupervise]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 220);
    return () => clearTimeout(t);
  }, [load]);

  /** Tabs are the same list for everyone; permission decides which are shown. */
  const TABS = useMemo(() => {
    const mine: { key: Tab; label: string; icon: typeof Inbox; badge?: number }[] = [
      { key: "candidates", label: "Needs a case", icon: Sparkles, badge: candidates?.total },
      { key: "cases", label: "Cases", icon: Briefcase },
      { key: "diary", label: "Diary", icon: CalendarClock },
    ];
    if (canSupervise) {
      mine.push({ key: "dashboard", label: "Dashboard", icon: BarChart3 });
      mine.push({ key: "assignment", label: "Assignment", icon: Layers });
    }
    return mine;
  }, [candidates, canSupervise]);

  /**
   * One measure. `sub` carries the supporting number, `hint` says in plain
   * words what the figure counts — nobody should have to ask what a tile means.
   */
  const kpi = (label: string, value: string, sub?: string, tone = "text-foreground",
               onClick?: () => void, hint?: string) => (
    <button onClick={onClick} disabled={!onClick}
      className={`text-left px-4 py-3 rounded-xl border border-border bg-card transition ${
        onClick ? "hover:border-primary/40 hover:bg-muted/40" : "cursor-default"}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground whitespace-nowrap">
        {label}
      </div>
      <div className={`text-xl font-semibold tabular-nums mt-0.5 ${tone}`}>{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
      {hint && <div className="text-[10px] text-muted-foreground/70 mt-1 leading-snug">{hint}</div>}
    </button>
  );


  return (
    <div className="space-y-4">
      {/* --- Desk header ---------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Headset className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">
            {deskId === ALL_DESKS ? "All agents" : desk?.agentName ?? "Collections"}
          </h2>
          <p className="text-xs text-muted-foreground">
            {desk?.bookCustomers ?? 0} customers under collection ·{" "}
            {moneyShort(desk?.bookExposure ?? 0)} owed
            {desk?.maxCaseload ? ` · ${desk.openCases}/${desk.maxCaseload} caseload` : ""}
          </p>
          <p className="text-[11px] text-muted-foreground/70">
            {desk?.customers ?? 0} customers assigned in total ·{" "}
            {moneyShort(desk?.portfolioValue ?? 0)} whole portfolio
          </p>
        </div>
        {canSupervise && (
          <Select value={deskId === undefined ? "me" : String(deskId)}
            onValueChange={(v) => setDeskId(v === "me" ? undefined : Number(v))}>
            <SelectTrigger className="h-9 w-60 text-sm ml-2"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={String(ALL_DESKS)}>All agents — whole floor</SelectItem>
              <SelectItem value="me">My own desk</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>
                  {a.name} · {a.openCases} cases
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="ml-auto flex items-center gap-2">
          {canEdit && (
            <Button size="sm" variant="outline" className="h-9" disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const r = await settlePromises(deskId);
                  toast.success(`Promises re-checked — ${r.kept} kept, ${r.broken} broken.`);
                  await load();
                } catch (err) {
                  toast.error(err instanceof ApiError ? err.message : "Could not settle promises.");
                } finally {
                  setBusy(false);
                }
              }}>
              Settle promises
            </Button>
          )}
          <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* --- KPIs ----------------------------------------------------------- */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {kpi("Needs a case", String(candidates?.total ?? 0),
          moneyShort(candidates?.totalValue ?? 0),
          (candidates?.total ?? 0) > 0 ? "text-warning" : "text-foreground",
          () => setTab("candidates"),
          "Accounts that have met a trigger but have no case yet.")}
        {kpi("Open cases", String(counters?.openCases ?? 0),
          `${counters?.overSla ?? 0} past SLA`,
          (counters?.overSla ?? 0) > 0 ? "text-destructive" : "text-foreground",
          () => setTab("cases"),
          `Cases still being worked. Excludes ${counters?.awaitingClose ?? 0} resolved and waiting to be closed off.`)}
        {kpi("Past SLA", String(counters?.overSla ?? 0), "need attention now",
          (counters?.overSla ?? 0) > 0 ? "text-destructive" : "text-foreground",
          () => setTab("cases"),
          "Open cases past their next-action deadline. Paused clocks are not counted.")}
        {kpi("In dispute / legal", `${counters?.disputes ?? 0} / ${counters?.legalCases ?? 0}`,
          "collection on hold", "text-warning", undefined,
          "Unresolved disputes, and open legal cases from the legal register.")}
        {kpi("Promises due today", String(counters?.promiseDueToday ?? 0),
          `${counters?.brokenPromises ?? 0} broken`, "text-info", () => setTab("diary"),
          "Promises falling due today. Broken counts the last 90 days.")}
        {kpi("Collected today", moneyShort(counters?.collectedToday ?? 0),
          `${counters?.resolvedToday ?? 0} resolved · ${counters?.promiseDueToday ?? 0} promises due`,
          "text-success", undefined,
          "Payments that settled today, and cases closed today.")}
      </div>

      {/* --- Tabs ----------------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-xl border border-border bg-card p-1 flex-wrap">
          {TABS.map((v) => (
            <button key={v.key} onClick={() => setTab(v.key)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                tab === v.key ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground"}`}>
              <v.icon className="h-3.5 w-3.5" />
              {v.label}
              {v.badge ? (
                <span className={`ml-0.5 rounded-full px-1.5 text-[10px] ${
                  tab === v.key ? "bg-white/20" : "bg-muted"}`}>{v.badge}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {/* --- Needs a case --------------------------------------------------- */}
      {tab === "candidates" && (
        <Candidates canEdit={canEdit} onOpenCustomer={onOpenCustomer} />
      )}

      {/* --- Cases: the ticket board ---------------------------------------- */}
      {tab === "cases" && (
        <TicketBoard config={config} canEdit={canEdit} agentId={deskId}
          onOpenCase={setDrawerCase} onOpenCustomer={onOpenCustomer} />
      )}

      {/* --- Diary: follow-ups day by day ------------------------------------ */}
      {tab === "diary" && (
        <TaskDiary canEdit={canEdit} onOpenCase={setDrawerCase}
          onOpenCustomer={onOpenCustomer} />
      )}

      {/* --- Dashboard, assignment, configuration ---------------------------- */}
      {["dashboard", "assignment"].includes(tab) && (
        <CaseManagement
          canEdit={canEdit}
          onOpenCustomer={onOpenCustomer}
          embeddedView={tab as "dashboard" | "assignment"}
          agentId={deskId === ALL_DESKS ? undefined : deskId}
        />
      )}

      <CaseDrawer caseId={drawerCase} config={config} canAct={canEdit}
        onClose={() => setDrawerCase(null)} onChanged={() => void load()}
        onOpenCustomer={onOpenCustomer} />
    </div>
  );
};

export default CollectionsWorkspace;
