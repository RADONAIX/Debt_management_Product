import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, ArrowUpRight, CheckCircle2, FileWarning, HandCoins, Loader2, Plus,
  RefreshCw, Search, Sparkles, TimerOff, UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { money, moneyShort } from "@/lib/money";
import { ApiError } from "@/lib/api";
import {
  createCasesFromCandidates, getCandidateSummary, getCandidates, getConfig,
  type CandidateRow, type CandidateSummary, type CollectionConfig,
} from "@/lib/collection";
import { CaseWizard } from "./CaseWizard";
import { CaseDrawer } from "./CaseDrawer";
import { AccountSheet } from "./AccountSheet";
import { PRIORITY_TONE, Pill, RISK_TONE, dateText, relative } from "./shared";

/**
 * "Needs a case" — accounts that have defaulted with nobody working them.
 *
 * The queue tab answers "what do I do next on my cases?". This answers the
 * question that comes before it: who has fallen over and has no case at all?
 * Every row states why it qualifies and what the system would raise, so the
 * collector's job is to confirm rather than to fill in a form.
 */

const TRIGGER_TONE: Record<string, string> = {
  BROKEN_PTP: "bg-destructive/10 text-destructive border-destructive/25",
  PTP_OVERDUE: "bg-warning/10 text-warning border-warning/25",
  DISPUTE_OPEN: "bg-orange-500/10 text-orange-600 border-orange-500/25",
  DPD_90: "bg-destructive/10 text-destructive border-destructive/25",
  DPD_60: "bg-warning/10 text-warning border-warning/25",
  DPD_30: "bg-info/10 text-info border-info/25",
  DPD_EARLY: "bg-muted text-muted-foreground border-border",
  HIGH_RISK: "bg-warning/10 text-warning border-warning/25",
  NO_PAYMENT: "bg-muted text-muted-foreground border-border",
};

const TRIGGER_ICON: Record<string, typeof HandCoins> = {
  BROKEN_PTP: HandCoins,
  PTP_OVERDUE: HandCoins,
  DISPUTE_OPEN: FileWarning,
  NO_PAYMENT: TimerOff,
};

export const Candidates = ({
  canEdit = true,
  onOpenCustomer,
  onOpenAgentAction,
}: {
  canEdit?: boolean;
  onOpenCustomer?: (code: string) => void;
  onOpenAgentAction?: () => void;
}) => {
  const [rows, setRows] = useState<CandidateRow[]>([]);
  const [summary, setSummary] = useState<CandidateSummary | null>(null);
  const [config, setConfig] = useState<CollectionConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState("");
  const [trigger, setTrigger] = useState<string | null>(null);
  const [mine, setMine] = useState(false);
  const [minDpd, setMinDpd] = useState<number | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [sheetRow, setSheetRow] = useState<CandidateRow | null>(null);
  const [wizardFor, setWizardFor] = useState<CandidateRow | null>(null);
  const [drawerCase, setDrawerCase] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, s] = await Promise.all([
        getCandidates({
          mine, search: search.trim() || undefined, trigger: trigger ?? undefined,
          minDpd: minDpd ?? undefined, limit: 400,
        }),
        getCandidateSummary(),
      ]);
      setRows(r);
      setSummary(s);
      setPicked(new Set());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load defaulters.");
    } finally {
      setLoading(false);
    }
  }, [mine, search, trigger, minDpd]);

  useEffect(() => {
    getConfig().then(setConfig).catch(() => undefined);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 220);
    return () => clearTimeout(t);
  }, [load]);

  const toggle = (id: number) =>
    setPicked((p) => {
      const next = new Set(p);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allPicked = rows.length > 0 && picked.size === rows.length;
  const pickedRows = useMemo(() => rows.filter((r) => picked.has(r.accountId)), [rows, picked]);
  const pickedValue = pickedRows.reduce((s, r) => s + r.outstanding, 0);

  const raiseSelected = async (assignToMe: boolean) => {
    if (picked.size === 0) return;
    setCreating(true);
    try {
      const res = await createCasesFromCandidates({
        accountIds: [...picked],
        assignToMe,
      });
      if (res.created) {
        toast.success(
          `${res.created} case${res.created === 1 ? "" : "s"} raised` +
            (assignToMe ? " and assigned to you." : " and routed by the rules."),
        );
      }
      res.messages.forEach((m) => toast.error(m));
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not raise the cases.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* --- Why anyone is here ------------------------------------------- */}
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-baseline gap-3">
          <div className="h-9 w-9 rounded-xl bg-warning/10 flex items-center justify-center">
            <AlertTriangle className="h-4 w-4 text-warning" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              Defaulted accounts with no case
            </h2>
            <p className="text-xs text-muted-foreground">
              Nobody is working these. Select the ones to take on and raise a case.
            </p>
          </div>
          <div className="ml-auto flex items-baseline gap-4">
            <div className="text-right">
              <div className="text-2xl font-semibold text-foreground tabular-nums">
                {summary?.total ?? 0}
              </div>
              <div className="text-[11px] text-muted-foreground">accounts</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-semibold text-warning tabular-nums">
                {moneyShort(summary?.totalValue ?? 0)}
              </div>
              <div className="text-[11px] text-muted-foreground">unworked exposure</div>
            </div>
          </div>
        </div>

        {/* Trigger breakdown — the reasons, clickable to filter */}
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            onClick={() => setTrigger(null)}
            className={`rounded-lg border px-3 py-2 text-left transition ${
              trigger === null ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
            }`}
          >
            <div className="text-[11px] font-medium text-foreground">All reasons</div>
            <div className="text-[10px] text-muted-foreground tabular-nums">
              {summary?.total ?? 0} · {moneyShort(summary?.totalValue ?? 0)}
            </div>
          </button>
          {summary?.byTrigger.map((t) => (
            <button
              key={t.trigger}
              onClick={() => setTrigger(trigger === t.trigger ? null : t.trigger)}
              className={`rounded-lg border px-3 py-2 text-left transition ${
                trigger === t.trigger
                  ? "border-primary bg-primary/5"
                  : "border-border hover:bg-muted/50"
              }`}
            >
              <div className="text-[11px] font-medium text-foreground">{t.label}</div>
              <div className="text-[10px] text-muted-foreground tabular-nums">
                {t.count} · {moneyShort(t.value)}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* --- Filters ------------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="h-9 pl-8 text-sm"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, company, account or BAN"
          />
        </div>
        <button
          onClick={() => setMine(!mine)}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
            mine
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <UserCheck className="h-3.5 w-3.5" />
          Assigned to me
          {summary?.mine ? ` (${summary.mine})` : ""}
        </button>
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
          {[
            ["Any", null],
            ["30+", 30],
            ["60+", 60],
            ["90+", 90],
          ].map(([label, v]) => (
            <button
              key={String(label)}
              onClick={() => setMinDpd(v as number | null)}
              className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                minDpd === v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label} DPD
            </button>
          ))}
        </div>
        <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* --- Bulk action bar ----------------------------------------------- */}
      {picked.size > 0 && canEdit && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 flex flex-wrap items-center gap-3 sticky top-2 z-10 backdrop-blur">
          <CheckCircle2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">
            {picked.size} selected · {money(pickedValue)}
          </span>
          <span className="text-[11px] text-muted-foreground">
            Each will use its own suggested case type and priority
          </span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" disabled={creating}
              onClick={() => void raiseSelected(false)}>
              Raise & route by rules
            </Button>
            <Button size="sm" disabled={creating} onClick={() => void raiseSelected(true)}>
              {creating ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <Plus className="h-3.5 w-3.5 mr-1.5" />
              )}
              Raise {picked.size} case{picked.size === 1 ? "" : "s"} to me
            </Button>
          </div>
        </div>
      )}

      {/* --- The defaulters ------------------------------------------------ */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border flex items-center gap-3 text-[11px] text-muted-foreground">
          {canEdit && (
            <Checkbox
              checked={allPicked}
              onCheckedChange={() =>
                setPicked(allPicked ? new Set() : new Set(rows.map((r) => r.accountId)))
              }
              aria-label="Select all"
            />
          )}
          <span className="font-medium text-foreground">{rows.length} accounts</span>
          <span>{money(rows.reduce((s, r) => s + r.outstanding, 0))} outstanding</span>
          <span className="ml-auto flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> These have no case being worked — the owner
            shown is who holds the customer relationship
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border">
                {canEdit && <th className="px-4 py-2 w-8" />}
                <th className="px-4 py-2 font-semibold">Customer</th>
                <th className="px-4 py-2 font-semibold">Why it needs a case</th>
                <th className="px-4 py-2 font-semibold text-right">Outstanding</th>
                <th className="px-4 py-2 font-semibold text-right">DPD</th>
                <th className="px-4 py-2 font-semibold">Risk</th>
                <th className="px-4 py-2 font-semibold">Account owner</th>
                <th className="px-4 py-2 font-semibold">Suggested case</th>
                <th className="px-4 py-2 font-semibold w-8" />
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((r) => {
                  const Icon = TRIGGER_ICON[r.triggerCode];
                  const isPicked = picked.has(r.accountId);
                  return (
                    <tr
                      key={r.accountId}
                      onClick={() => setSheetRow(r)}
                      className={`group border-b border-border last:border-0 cursor-pointer transition ${
                        isPicked ? "bg-primary/5" : "hover:bg-muted/40"
                      }`}
                    >
                      {canEdit && (
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={isPicked}
                            onCheckedChange={() => toggle(r.accountId)}
                            aria-label={`Select ${r.customerName}`}
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-foreground truncate max-w-[170px]">
                            {r.customerName}
                          </span>
                          {onOpenCustomer && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenCustomer(r.customerId);
                              }}
                              title="Open in Subscriber 360"
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition"
                            >
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                        <div className="text-[10px] text-muted-foreground truncate">
                          {r.accountCode} · {r.customerType}
                          {r.companyName ? ` · ${r.companyName}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[280px]">
                        <div className="flex items-center gap-1.5">
                          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                          <Pill tone={TRIGGER_TONE[r.triggerCode]}>{r.triggerLabel}</Pill>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          {r.triggerDetail}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {money(r.outstanding)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{r.dpd}</td>
                      <td className={`px-4 py-3 text-xs ${RISK_TONE[r.riskLevel] ?? ""}`}>
                        {r.riskLevel}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-muted-foreground truncate max-w-[110px]">
                        {r.agentName ?? <span className="text-warning">Unassigned</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-foreground">{r.suggestedTypeName}</span>
                          <Pill tone={PRIORITY_TONE[r.suggestedPriority]}>
                            {r.suggestedPriority}
                          </Pill>
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          → {r.suggestedQueue ?? "by rules"}
                        </div>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {canEdit && (
                          <button
                            onClick={() => setWizardFor(r)}
                            title="Create a case with these details"
                            className="opacity-0 group-hover:opacity-100 h-7 w-7 rounded-lg border border-border hover:bg-primary/10 hover:text-primary flex items-center justify-center text-muted-foreground transition"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center">
                    <CheckCircle2 className="h-6 w-6 text-success mx-auto mb-2" />
                    <p className="text-sm text-foreground font-medium">
                      Every defaulted account has a case.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Nothing is going unworked{mine ? " on your book" : ""}.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* The account sheet takes a candidate, so map it onto the shape it wants */}
      <AccountSheet
        row={
          sheetRow
            ? {
                ...sheetRow,
                phone: null,
                email: null,
                servicePlan: null,
                accountStatus: null,
                contactability: 0,
                collectionStatus: sheetRow.triggerLabel,
                openCases: 0,
                openCaseCode: null,
                openCaseId: null,
                activePtp: !!sheetRow.overduePtpDate,
                ptpAmount: sheetRow.brokenPtpAmount ?? null,
                ptpDueOn: sheetRow.overduePtpDate ?? null,
                activeDisputes: sheetRow.openDisputes,
                disputedAmount: 0,
                legalStatus: null,
                legalStage: null,
                agencyStatus: null,
                agencyName: null,
                lastPaymentAmount: null,
                payments90d: 0,
                collected90d: 0,
                contactAttempts: 0,
                queueCode: sheetRow.suggestedQueue ?? null,
                nextAction: `Raise a ${sheetRow.suggestedTypeName} case — ${sheetRow.triggerDetail}`,
                priority: sheetRow.suggestedPriority,
                priorityScore: sheetRow.urgency,
              }
            : null
        }
        canEdit={canEdit}
        onClose={() => setSheetRow(null)}
        onCreateCase={() => {
          const r = sheetRow;
          setSheetRow(null);
          setWizardFor(r);
        }}
        onOpenCase={(id) => {
          setSheetRow(null);
          setDrawerCase(id);
        }}
        onOpenCustomer={onOpenCustomer}
        onAgentAction={onOpenAgentAction}
      />

      <CaseWizard
        open={!!wizardFor}
        customer={
          wizardFor
            ? ({
                ...wizardFor,
                collectionStatus: wizardFor.triggerLabel,
                nextAction: wizardFor.triggerDetail,
                priority: wizardFor.suggestedPriority,
              } as never)
            : null
        }
        config={config}
        suggestedType={wizardFor?.suggestedType}
        suggestedReason={wizardFor?.triggerDetail}
        onOpenChange={(v) => !v && setWizardFor(null)}
        onCreated={(id) => {
          setDrawerCase(id);
          void load();
        }}
      />

      <CaseDrawer
        caseId={drawerCase}
        config={config}
        onClose={() => setDrawerCase(null)}
        onChanged={() => void load()}
        onOpenCustomer={onOpenCustomer}
      />
    </div>
  );
};

export default Candidates;
