import { useMemo, useState } from "react";
import {
  AlertTriangle, ArrowUpRight, ChevronDown, ChevronRight, Hand, Layers, List, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/money";
import { ApiError } from "@/lib/api";
import { claimCase, type CaseRow } from "@/lib/collection";
import { PRIORITY_TONE, Pill, RISK_TONE, STATE_TONE, pretty, relative } from "./shared";

/**
 * The case queue, grouped by customer.
 *
 * A customer with several open cases was previously several near-identical
 * rows. Grouping puts the customer first — their exposure, their agent, how
 * many cases — and opens to show the cases underneath. Ownership follows the
 * customer, so this is also the level at which it makes sense to reason about.
 */
type Group = {
  customerId: string;
  customerName: string;
  customerType: string;
  accountCode?: string | null;
  outstanding: number;
  dpd: number;
  riskLevel: string;
  agentName?: string | null;
  unassigned: number;
  breached: number;
  worstPriority: string;
  cases: CaseRow[];
};

const PRIORITY_RANK: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };

export const CaseGroups = ({
  cases, loading, grouped, canEdit, breached,
  onToggleGrouped, onToggleBreached, onOpenCase, onOpenCustomer, onChanged,
}: {
  cases: CaseRow[];
  loading: boolean;
  grouped: boolean;
  canEdit: boolean;
  breached: boolean;
  onToggleGrouped: () => void;
  onToggleBreached: () => void;
  onOpenCase: (id: number) => void;
  onOpenCustomer?: (code: string) => void;
  onChanged: () => void;
}) => {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<number | null>(null);

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    cases.forEach((c) => {
      const g = map.get(c.customerId) ?? {
        customerId: c.customerId,
        customerName: c.customerName,
        customerType: c.customerType,
        accountCode: c.accountCode,
        outstanding: c.outstanding,
        dpd: c.dpd,
        riskLevel: c.riskLevel,
        agentName: null,
        unassigned: 0,
        breached: 0,
        worstPriority: "Low",
        cases: [],
      };
      g.cases.push(c);
      // Outstanding is the customer's balance, not a per-case figure — take the
      // largest rather than summing, or a customer with three cases reads as
      // owing three times what they do.
      g.outstanding = Math.max(g.outstanding, c.outstanding);
      g.dpd = Math.max(g.dpd, c.dpd);
      if (c.agentName) g.agentName = c.agentName;
      if (!c.agentId) g.unassigned += 1;
      if (c.slaBreached) g.breached += 1;
      if ((PRIORITY_RANK[c.priority] ?? 9) < (PRIORITY_RANK[g.worstPriority] ?? 9))
        g.worstPriority = c.priority;
      map.set(c.customerId, g);
    });
    return [...map.values()].sort(
      (a, b) =>
        (PRIORITY_RANK[a.worstPriority] ?? 9) - (PRIORITY_RANK[b.worstPriority] ?? 9) ||
        b.breached - a.breached ||
        b.outstanding - a.outstanding,
    );
  }, [cases]);

  const toggle = (id: string) =>
    setOpen((o) => {
      const next = new Set(o);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const claim = async (c: CaseRow) => {
    setBusy(c.id);
    try {
      await claimCase(c.id);
      toast.success(`${c.caseNumber} claimed — you now own ${c.customerName}.`);
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not claim that case.");
    } finally {
      setBusy(null);
    }
  };

  const multi = groups.filter((g) => g.cases.length > 1).length;
  const unassignedTotal = cases.filter((c) => !c.agentId).length;

  /** One case line, used inside a group and in the flat list. */
  const caseLine = (c: CaseRow, inset: boolean) => (
    <div
      key={c.id}
      onClick={() => onOpenCase(c.id)}
      className={`group flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/40 transition ${
        inset ? "pl-14" : ""
      }`}
    >
      <div className="w-[104px] shrink-0">
        <div className="text-[11px] font-mono text-muted-foreground">{c.caseNumber}</div>
        <Pill tone={PRIORITY_TONE[c.priority]}>{c.priority}</Pill>
      </div>
      {!inset && (
        <div className="w-[170px] shrink-0 min-w-0">
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium text-foreground truncate">{c.customerName}</span>
            {onOpenCustomer && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenCustomer(c.customerId);
                }}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary"
              >
                <ArrowUpRight className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground">{c.accountCode}</div>
        </div>
      )}
      <div className="w-[150px] shrink-0">
        <div className="text-xs text-foreground truncate">{c.typeName ?? c.type}</div>
        <div className="text-[10px] text-muted-foreground truncate">
          {c.sourceName ?? c.source}
        </div>
      </div>
      <div className="w-[100px] shrink-0 text-right tabular-nums text-sm">
        {money(c.amount)}
      </div>
      <div className="w-[110px] shrink-0">
        <Pill tone={STATE_TONE[c.workflowState]}>{pretty(c.workflowState)}</Pill>
      </div>
      <div className="w-[110px] shrink-0 text-[11px] text-muted-foreground truncate">
        {c.queueName ?? "—"}
      </div>
      <div className="w-[120px] shrink-0 text-[11px] truncate">
        {c.agentName ? (
          <span className="text-muted-foreground">{c.agentName}</span>
        ) : canEdit ? (
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[10px] px-2"
            disabled={busy === c.id}
            onClick={(e) => {
              e.stopPropagation();
              void claim(c);
            }}
          >
            {busy === c.id ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <>
                <Hand className="h-3 w-3 mr-1" />
                Claim
              </>
            )}
          </Button>
        ) : (
          <span className="text-warning">Unassigned</span>
        )}
      </div>
      <div className="flex-1 min-w-0 text-[11px] text-right">
        <span
          className={
            c.slaPaused
              ? "text-muted-foreground"
              : c.slaBreached
                ? "text-destructive font-medium"
                : "text-muted-foreground"
          }
        >
          {c.slaPaused
            ? "paused"
            : c.status === "CLOSED"
              ? c.resolution ?? "closed"
              : relative(c.slaDeadline)}
        </span>
      </div>
    </div>
  );

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="font-medium text-foreground">{cases.length} cases</span>
        {grouped && <span>across {groups.length} customers</span>}
        <span>{money(cases.reduce((s, c) => s + c.amount, 0))} at stake</span>
        {multi > 0 && grouped && (
          <span className="text-info">{multi} with more than one case</span>
        )}
        {unassignedTotal > 0 && (
          <span className="text-warning">{unassignedTotal} unclaimed</span>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={onToggleGrouped}
            title={grouped ? "Show every case as its own row" : "Group cases by customer"}
            className="flex items-center gap-1 rounded-md border border-border px-2 py-0.5 hover:text-foreground transition"
          >
            {grouped ? <Layers className="h-3 w-3" /> : <List className="h-3 w-3" />}
            {grouped ? "Grouped" : "Flat"}
          </button>
          <button
            onClick={onToggleBreached}
            className={`flex items-center gap-1 rounded-md px-2 py-0.5 border transition ${
              breached
                ? "bg-destructive/10 border-destructive/40 text-destructive"
                : "border-border hover:text-foreground"
            }`}
          >
            <AlertTriangle className="h-3 w-3" /> SLA breached
          </button>
        </div>
      </div>

      {/* Column headings, matching the widths used by caseLine */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-3 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span className="w-[104px] shrink-0">{grouped ? "Customer" : "Case"}</span>
        {!grouped && <span className="w-[170px] shrink-0">Customer</span>}
        <span className="w-[150px] shrink-0">Type / Source</span>
        <span className="w-[100px] shrink-0 text-right">Value</span>
        <span className="w-[110px] shrink-0">State</span>
        <span className="w-[110px] shrink-0">Queue</span>
        <span className="w-[120px] shrink-0">Agent</span>
        <span className="flex-1 text-right">SLA</span>
      </div>

      <div className="divide-y divide-border">
        {loading && (
          <div className="py-12 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
          </div>
        )}

        {!loading && !grouped && cases.map((c) => caseLine(c, false))}

        {!loading &&
          grouped &&
          groups.map((g) => {
            const isOpen = open.has(g.customerId) || g.cases.length === 1;
            const single = g.cases.length === 1;
            return (
              <div key={g.customerId}>
                <div
                  onClick={() => (single ? onOpenCase(g.cases[0].id) : toggle(g.customerId))}
                  className="group px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-muted/40 transition"
                >
                  <div className="w-4 shrink-0">
                    {!single &&
                      (isOpen ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      ))}
                  </div>
                  <div
                    className={`w-1 h-10 rounded-full shrink-0 ${
                      g.worstPriority === "Critical"
                        ? "bg-destructive"
                        : g.worstPriority === "High"
                          ? "bg-warning"
                          : g.worstPriority === "Medium"
                            ? "bg-info"
                            : "bg-border"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground truncate">
                        {g.customerName}
                      </span>
                      <Pill tone={PRIORITY_TONE[g.worstPriority]}>{g.worstPriority}</Pill>
                      {g.cases.length > 1 && (
                        <Pill tone="bg-primary/10 text-primary border-primary/25">
                          {g.cases.length} cases
                        </Pill>
                      )}
                      {g.breached > 0 && (
                        <Pill tone="bg-destructive/10 text-destructive border-destructive/25">
                          {g.breached} past SLA
                        </Pill>
                      )}
                      {g.unassigned > 0 && (
                        <Pill tone="bg-warning/10 text-warning border-warning/25">
                          {g.unassigned} unclaimed
                        </Pill>
                      )}
                      {onOpenCustomer && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenCustomer(g.customerId);
                          }}
                          title="Open in Subscriber 360"
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {g.accountCode} · {g.customerType} · {g.dpd} DPD ·{" "}
                      <span className={RISK_TONE[g.riskLevel] ?? ""}>{g.riskLevel}</span>
                      {single ? ` · ${g.cases[0].typeName ?? g.cases[0].type}` : ""}
                    </div>
                  </div>
                  <div className="w-[100px] shrink-0 text-right">
                    <div className="text-sm font-semibold tabular-nums text-foreground">
                      {money(g.outstanding)}
                    </div>
                    <div className="text-[10px] text-muted-foreground">outstanding</div>
                  </div>
                  <div className="w-[120px] shrink-0 text-[11px] truncate">
                    {g.agentName ? (
                      <span className="text-muted-foreground">{g.agentName}</span>
                    ) : (
                      <span className="text-warning">Unclaimed</span>
                    )}
                  </div>
                  {single && (
                    <div className="w-[110px] shrink-0">
                      <Pill tone={STATE_TONE[g.cases[0].workflowState]}>
                        {pretty(g.cases[0].workflowState)}
                      </Pill>
                    </div>
                  )}
                </div>

                {!single && isOpen && (
                  <div className="bg-muted/20 border-t border-border divide-y divide-border/50">
                    {g.cases.map((c) => caseLine(c, true))}
                  </div>
                )}
              </div>
            );
          })}

        {!loading && cases.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No cases match these filters.
          </p>
        )}
      </div>
    </div>
  );
};
