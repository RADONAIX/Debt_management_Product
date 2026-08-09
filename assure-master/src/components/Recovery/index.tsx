import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  Building2,
  Loader2,
  RefreshCw,
  Save,
  Scale,
  Search,
  Send,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { money } from "@/lib/money";
import { ApiError } from "@/lib/api";
import {
  deleteAgency,
  getAgencies,
  getLedger,
  getLegalCases,
  getPlacements,
  getRecoveryConfig,
  getSummary,
  saveRecoveryConfig,
  PLACEMENT_STATUSES,
  PRIORITIES,
  type Agency,
  type ConfigRow,
  type LegalCase,
  type Placement,
  type RecoveryEntry,
  type RecoverySummary,
} from "@/lib/recovery";
import { CommandRibbon } from "./CommandRibbon";
import { AgencyRail } from "./AgencyRail";
import { AgencyDialog } from "./AgencyDialog";
import { PlaceDialog } from "./PlaceDialog";
import { PlacementDrawer } from "./PlacementDrawer";
import { LegalBoard } from "./LegalBoard";
import { PRIORITY_TONE, Pill, ProgressTrack, RISK_TONE, STATUS_TONE, dateText, pretty } from "./shared";

type View = "placements" | "ledger" | "legal" | "settings";

const VIEWS: { key: View; label: string; icon: typeof Send }[] = [
  { key: "placements", label: "Placements", icon: Send },
  { key: "ledger", label: "Recovery ledger", icon: Banknote },
  { key: "legal", label: "Legal", icon: Scale },
  { key: "settings", label: "Configuration", icon: SlidersHorizontal },
];

/**
 * Recovery Workspace — the external-agency book end to end: who holds which
 * account, for how much, what has come back, and what happens next.
 */
export const RecoveryWorkspace = ({
  canEdit = true,
  onOpenCustomer,
}: {
  canEdit?: boolean;
  /** Opens that customer's Subscriber 360. Omitted, the drill buttons hide. */
  onOpenCustomer?: (customerCode: string) => void;
}) => {
  const [summary, setSummary] = useState<RecoverySummary | null>(null);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [ledger, setLedger] = useState<RecoveryEntry[]>([]);
  const [legal, setLegal] = useState<LegalCase[]>([]);
  const [config, setConfig] = useState<ConfigRow[]>([]);
  const [configDraft, setConfigDraft] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);

  const [view, setView] = useState<View>("placements");
  const [agencyFilter, setAgencyFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>("ACTIVE");
  const [priorityFilter, setPriorityFilter] = useState<string | null>(null);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [search, setSearch] = useState("");

  const [drawerId, setDrawerId] = useState<number | null>(null);
  const [agencyDialog, setAgencyDialog] = useState<{ open: boolean; agency: Agency | null }>({
    open: false,
    agency: null,
  });
  const [placeOpen, setPlaceOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Agency | null>(null);

  const loadBoard = useCallback(async () => {
    const rows = await getPlacements({
      agency: agencyFilter ?? undefined,
      status: statusFilter ?? undefined,
      priority: priorityFilter ?? undefined,
      search: search.trim() || undefined,
      overdue: overdueOnly,
    });
    setPlacements(rows);
  }, [agencyFilter, statusFilter, priorityFilter, search, overdueOnly]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, a, l, lc, c] = await Promise.all([
        getSummary(),
        getAgencies(),
        getLedger(),
        getLegalCases(),
        getRecoveryConfig(),
      ]);
      setSummary(s);
      setAgencies(a);
      setLedger(l);
      setLegal(lc);
      setConfig(c);
      setConfigDraft(Object.fromEntries(c.map((r) => [r.key, r.value])));
      await loadBoard();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load the recovery book.");
    } finally {
      setLoading(false);
    }
  }, [loadBoard]);

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Filters only need the board, not the whole workspace.
  useEffect(() => {
    const t = setTimeout(() => void loadBoard().catch(() => undefined), 220);
    return () => clearTimeout(t);
  }, [loadBoard]);

  const refresh = async () => {
    const [s, a, l, lc] = await Promise.all([
      getSummary(),
      getAgencies(),
      getLedger(),
      getLegalCases(),
    ]);
    setSummary(s);
    setAgencies(a);
    setLedger(l);
    setLegal(lc);
    await loadBoard();
  };

  const removeAgency = async (a: Agency) => {
    try {
      await deleteAgency(a.id);
      toast.success(`${a.name} removed.`);
      if (agencyFilter === a.id) setAgencyFilter(null);
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not remove that agency.");
    } finally {
      setConfirmDelete(null);
    }
  };

  const configDirty = useMemo(
    () => config.some((r) => configDraft[r.key] !== r.value),
    [config, configDraft],
  );

  const saveConfig = async () => {
    setSavingConfig(true);
    try {
      const changed = Object.fromEntries(
        config.filter((r) => configDraft[r.key] !== r.value).map((r) => [r.key, configDraft[r.key]]),
      );
      await saveRecoveryConfig(changed);
      setConfig(await getRecoveryConfig());
      toast.success("Configuration saved.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save the configuration.");
    } finally {
      setSavingConfig(false);
    }
  };

  const activeFilters = [
    agencyFilter && {
      label: agencies.find((a) => a.id === agencyFilter)?.name ?? agencyFilter,
      clear: () => setAgencyFilter(null),
    },
    statusFilter && { label: pretty(statusFilter), clear: () => setStatusFilter(null) },
    priorityFilter && { label: `${priorityFilter} priority`, clear: () => setPriorityFilter(null) },
    overdueOnly && { label: "Recall due", clear: () => setOverdueOnly(false) },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const boardTotals = useMemo(
    () => ({
      placed: placements.reduce((s, p) => s + p.placedAmount, 0),
      recovered: placements.reduce((s, p) => s + p.recoveredAmount, 0),
      open: placements.reduce((s, p) => s + p.openAmount, 0),
    }),
    [placements],
  );

  return (
    <div className="space-y-4">
      <CommandRibbon
        summary={summary}
        onJumpOverdue={() => {
          setView("placements");
          setStatusFilter(null);
          setOverdueOnly(true);
        }}
        onJumpLegal={() => setView("legal")}
      />

      <div className="flex gap-4 items-start">
        <AgencyRail
          agencies={agencies}
          selected={agencyFilter}
          onSelect={setAgencyFilter}
          onEdit={(a) => setAgencyDialog({ open: true, agency: a })}
          onDelete={setConfirmDelete}
          onAdd={() => setAgencyDialog({ open: true, agency: null })}
          canEdit={canEdit}
        />

        <div className="flex-1 min-w-0 space-y-3">
          {/* View switcher + actions */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-xl border border-border bg-card p-1">
              {VIEWS.map((v) => (
                <button
                  key={v.key}
                  onClick={() => setView(v.key)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    view === v.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <v.icon className="h-3.5 w-3.5" />
                  {v.label}
                  {v.key === "legal" && legal.length > 0 && (
                    <span
                      className={`ml-0.5 rounded-full px-1.5 text-[10px] ${
                        view === v.key ? "bg-white/20" : "bg-muted"
                      }`}
                    >
                      {legal.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <Button size="sm" variant="ghost" onClick={() => void refresh()} className="h-9 px-2">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>

            {canEdit && view === "placements" && (
              <Button size="sm" className="ml-auto h-9" onClick={() => setPlaceOpen(true)}>
                <Send className="h-3.5 w-3.5 mr-1.5" />
                Place an account
              </Button>
            )}
          </div>

          {/* --- Placements ------------------------------------------------ */}
          {view === "placements" && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    className="h-9 pl-8 text-sm"
                    placeholder="Search customer, placement or agency"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
                  {["ACTIVE", ...PLACEMENT_STATUSES.filter((s) => s !== "ACTIVE")].map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(statusFilter === s ? null : s)}
                      className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                        statusFilter === s
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {pretty(s)}
                    </button>
                  ))}
                </div>
                <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p}
                      onClick={() => setPriorityFilter(priorityFilter === p ? null : p)}
                      className={`rounded-md px-2 py-1 text-[11px] font-medium transition ${
                        priorityFilter === p
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setOverdueOnly((v) => !v)}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
                    overdueOnly
                      ? "bg-warning/15 border-warning/40 text-warning"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Recall due
                </button>
              </div>

              {activeFilters.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-muted-foreground">Filtered by</span>
                  {activeFilters.map((f) => (
                    <button
                      key={f.label}
                      onClick={f.clear}
                      className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/25 px-2 py-0.5 text-[11px] text-primary hover:bg-primary/20"
                    >
                      {f.label}
                      <X className="h-2.5 w-2.5" />
                    </button>
                  ))}
                </div>
              )}

              <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border flex items-center gap-4 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {placements.length} placement{placements.length === 1 ? "" : "s"}
                  </span>
                  <span>Placed {money(boardTotals.placed)}</span>
                  <span className="text-success">Recovered {money(boardTotals.recovered)}</span>
                  <span className="ml-auto">Open {money(boardTotals.open)}</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border">
                        <th className="px-4 py-2 font-semibold">Customer</th>
                        <th className="px-4 py-2 font-semibold">Agency</th>
                        <th className="px-4 py-2 font-semibold text-right">Placed</th>
                        <th className="px-4 py-2 font-semibold w-[150px]">Recovered</th>
                        <th className="px-4 py-2 font-semibold text-right">Open</th>
                        <th className="px-4 py-2 font-semibold">Priority</th>
                        <th className="px-4 py-2 font-semibold">Status</th>
                        <th className="px-4 py-2 font-semibold">Recall</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loading && (
                        <tr>
                          <td colSpan={8} className="px-4 py-10 text-center">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
                          </td>
                        </tr>
                      )}
                      {!loading &&
                        placements.map((p) => (
                          <tr
                            key={p.id}
                            onClick={() => setDrawerId(p.id)}
                            className="group border-b border-border last:border-0 cursor-pointer hover:bg-muted/40 transition"
                          >
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1">
                                <span className="font-medium text-foreground truncate max-w-[170px]">
                                  {p.customerName}
                                </span>
                                {onOpenCustomer && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onOpenCustomer(p.customerId);
                                    }}
                                    title="Open in Subscriber 360"
                                    className="opacity-0 group-hover:opacity-100 h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition"
                                  >
                                    <ArrowUpRight className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                              {p.companyName && p.companyName !== p.customerName && (
                                <div className="text-[10px] text-muted-foreground truncate max-w-[190px]">
                                  {p.companyName}
                                </div>
                              )}
                              <div className="text-[11px] text-muted-foreground">
                                <span className="font-mono">{p.code}</span> · {p.dpd} DPD
                                {p.riskLevel && (
                                  <span className={`ml-1 ${RISK_TONE[p.riskLevel] ?? ""}`}>
                                    {p.riskLevel}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="text-xs text-foreground truncate max-w-[150px]">
                                {p.agencyName}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {p.commissionPct}% · {p.daysWithAgency}d
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums">
                              {money(p.placedAmount)}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                <ProgressTrack pct={p.recoveryPct} tone="bg-success" className="flex-1" />
                                <span className="text-[11px] tabular-nums text-muted-foreground w-9 text-right">
                                  {Math.round(p.recoveryPct)}%
                                </span>
                              </div>
                              <div className="text-[11px] text-success tabular-nums mt-0.5">
                                {money(p.recoveredAmount)}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                              {money(p.openAmount)}
                            </td>
                            <td className="px-4 py-2.5">
                              <Pill tone={PRIORITY_TONE[p.priority]}>{p.priority}</Pill>
                            </td>
                            <td className="px-4 py-2.5">
                              <Pill tone={STATUS_TONE[p.status]}>{pretty(p.status)}</Pill>
                            </td>
                            <td className="px-4 py-2.5">
                              <div
                                className={`text-[11px] ${
                                  p.overdueRecall ? "text-warning font-medium" : "text-muted-foreground"
                                }`}
                              >
                                {p.status === "ACTIVE" || p.status === "LEGAL"
                                  ? dateText(p.recallDue)
                                  : p.closeReason ?? dateText(p.closedOn)}
                              </div>
                            </td>
                          </tr>
                        ))}
                      {!loading && placements.length === 0 && (
                        <tr>
                          <td colSpan={8} className="px-4 py-12 text-center text-sm text-muted-foreground">
                            Nothing matches these filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* --- Recovery ledger ------------------------------------------- */}
          {view === "ledger" && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border flex items-center gap-4 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{ledger.length} entries</span>
                <span className="text-success">
                  {money(ledger.reduce((s, r) => s + r.amount, 0))} recovered
                </span>
                <span className="ml-auto">
                  {money(ledger.reduce((s, r) => s + r.commission, 0))} commission
                </span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border">
                    <th className="px-4 py-2 font-semibold">Date</th>
                    <th className="px-4 py-2 font-semibold">Customer</th>
                    <th className="px-4 py-2 font-semibold">Agency</th>
                    <th className="px-4 py-2 font-semibold">Method</th>
                    <th className="px-4 py-2 font-semibold">Reference</th>
                    <th className="px-4 py-2 font-semibold text-right">Amount</th>
                    <th className="px-4 py-2 font-semibold text-right">Commission</th>
                    <th className="px-4 py-2 font-semibold">Remittance</th>
                    <th className="px-4 py-2 font-semibold">On account</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setDrawerId(r.placementId)}
                      className="group border-b border-border last:border-0 cursor-pointer hover:bg-muted/40"
                    >
                      <td className="px-4 py-2 text-muted-foreground">{dateText(r.recoveredOn)}</td>
                      <td className="px-4 py-2 font-medium text-foreground max-w-[180px]">
                        <div className="flex items-center gap-1">
                          <span className="truncate">{r.customerName}</span>
                          {onOpenCustomer && r.customerId && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenCustomer(r.customerId!);
                              }}
                              title="Open in Subscriber 360"
                              className="opacity-0 group-hover:opacity-100 h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition"
                            >
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground truncate max-w-[160px]">
                        {r.agencyName}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{r.method}</td>
                      <td className="px-4 py-2 text-[11px] font-mono text-muted-foreground">
                        {r.reference ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium text-success">
                        {money(r.amount)}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                        {money(r.commission)}
                      </td>
                      <td className="px-4 py-2">
                        <Pill
                          tone={
                            r.remitted
                              ? "bg-success/10 text-success border-success/25"
                              : "bg-warning/10 text-warning border-warning/25"
                          }
                        >
                          {r.remitted ? "Remitted" : "Pending"}
                        </Pill>
                      </td>
                      <td className="px-4 py-2">
                        {r.appliedToAccount ? (
                          <Pill tone="bg-success/10 text-success border-success/25">
                            Posted to 360
                          </Pill>
                        ) : (
                          <Pill>Prior cycle</Pill>
                        )}
                      </td>
                    </tr>
                  ))}
                  {ledger.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-sm text-muted-foreground">
                        No recoveries posted yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* --- Legal ------------------------------------------------------ */}
          {view === "legal" && (
            <LegalBoard
              cases={legal}
              canEdit={canEdit}
              onChanged={() => void refresh()}
              onOpenCustomer={onOpenCustomer}
            />
          )}

          {/* --- Configuration ---------------------------------------------- */}
          {view === "settings" && (
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Recovery configuration</h3>
                  <p className="text-xs text-muted-foreground">
                    These rules drive placement eligibility, recall windows and escalation across
                    the workspace.
                  </p>
                </div>
                {canEdit && (
                  <Button size="sm" onClick={saveConfig} disabled={!configDirty || savingConfig}>
                    {savingConfig ? (
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5 mr-1.5" />
                    )}
                    {configDirty ? "Save changes" : "Saved"}
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {config.map((r) => (
                  <div
                    key={r.key}
                    className="rounded-xl border border-border p-3 flex items-start gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <Label className="text-xs font-medium text-foreground">{r.label}</Label>
                      {r.description && (
                        <p className="text-[11px] text-muted-foreground mt-0.5">{r.description}</p>
                      )}
                    </div>
                    {r.valueType === "boolean" ? (
                      <Switch
                        checked={configDraft[r.key] === "true"}
                        disabled={!canEdit}
                        onCheckedChange={(v) =>
                          setConfigDraft((d) => ({ ...d, [r.key]: v ? "true" : "false" }))
                        }
                      />
                    ) : (
                      <Input
                        type={r.valueType === "number" ? "number" : "text"}
                        className="h-8 w-28 text-sm"
                        disabled={!canEdit}
                        value={configDraft[r.key] ?? ""}
                        onChange={(e) =>
                          setConfigDraft((d) => ({ ...d, [r.key]: e.target.value }))
                        }
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="pt-2 border-t border-border">
                <h4 className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5" /> Contracts
                </h4>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-1.5 font-medium">Agency</th>
                      <th className="py-1.5 font-medium">Commission</th>
                      <th className="py-1.5 font-medium">Recall</th>
                      <th className="py-1.5 font-medium">Placement range</th>
                      <th className="py-1.5 font-medium">Covers</th>
                      <th className="py-1.5 font-medium">Contract ends</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agencies.map((a) => (
                      <tr key={a.id} className="border-t border-border">
                        <td className="py-1.5 font-medium text-foreground">{a.name}</td>
                        <td className="py-1.5">{a.commissionPct}%</td>
                        <td className="py-1.5">{a.recallDays}d</td>
                        <td className="py-1.5">
                          {money(a.minPlacement)} –{" "}
                          {a.maxPlacement != null ? money(a.maxPlacement) : "no limit"}
                        </td>
                        <td className="py-1.5 text-muted-foreground">
                          {[...a.coversRisk, ...a.coversBucket].join(", ") || "—"}
                        </td>
                        <td className="py-1.5 text-muted-foreground">{dateText(a.contractEnd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      <PlacementDrawer
        placementId={drawerId}
        agencies={agencies}
        canEdit={canEdit}
        onOpenCustomer={onOpenCustomer}
        onClose={() => setDrawerId(null)}
        onChanged={() => void refresh()}
      />

      <AgencyDialog
        open={agencyDialog.open}
        agency={agencyDialog.agency}
        onOpenChange={(v) => setAgencyDialog((d) => ({ ...d, open: v }))}
        onSaved={() => void refresh()}
      />

      <PlaceDialog
        open={placeOpen}
        agencies={agencies}
        onOpenChange={setPlaceOpen}
        onPlaced={() => void refresh()}
      />

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {confirmDelete?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their closed placement history is removed with them. An agency holding open
              placements cannot be removed — recall or reassign those first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDelete && removeAgency(confirmDelete)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default RecoveryWorkspace;
