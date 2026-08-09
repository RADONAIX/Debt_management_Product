import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Building2,
  ChevronRight,
  Download,
  Filter,
  Gauge,
  Loader2,
  RefreshCw,
  Search,
  Layers,
  ShuffleIcon,
  Target,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import {
  getRiskGridBehaviour,
  getRiskGridEnterprise,
  getRiskGridFunnel,
  getRiskGridMatrix,
  getRiskGridOptions,
  getRiskGridDistribution,
  getRiskGridDrivers,
  getRiskGridMigration,
  getRiskGridSummary,
  getRiskGridTargets,
  type BehaviourSegment,
  type EnterpriseNode,
  type FilterOptions,
  type FunnelStage,
  type KpiSummary,
  type MatrixCell,
  type PriorityTarget,
  type DistributionBand,
  type MigrationCell,
  type RiskDriver,
  type RiskGridFilters,
} from "@/lib/riskGrid";
import { money, moneyShort } from "@/lib/money";
import { ApiError } from "@/lib/api";

const RISK_LEVELS = ["Low", "Medium", "High", "Critical"];
const DPD_BUCKETS = ["0-30", "31-60", "61-90", "90+"];

/** Restrained severity palette — this is a banking screen, not a consumer app. */
const riskTone: Record<string, string> = {
  Low: "bg-success/10 text-success border-success/20",
  Medium: "bg-warning/10 text-warning border-warning/20",
  High: "bg-destructive/10 text-destructive border-destructive/25",
  Critical: "bg-destructive/20 text-destructive border-destructive/40",
};

/** Heat by exposure share, so the eye lands on the money. */
const heat = (share: number) => {
  if (share === 0) return "bg-muted/30";
  if (share > 0.4) return "bg-destructive/25";
  if (share > 0.2) return "bg-destructive/15";
  if (share > 0.1) return "bg-warning/20";
  if (share > 0.03) return "bg-warning/10";
  return "bg-primary/5";
};

const pct = (v: number) => `${v.toFixed(1)}%`;

interface Props {
  /** Opens Customer 360 for a subscriber. */
  onOpenCustomer?: (customerCode: string) => void;
}

export default function RiskGridDashboard({ onOpenCustomer }: Props) {
  const [filters, setFilters] = useState<RiskGridFilters>({});
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [summary, setSummary] = useState<KpiSummary | null>(null);
  const [matrix, setMatrix] = useState<MatrixCell[]>([]);
  const [behaviour, setBehaviour] = useState<BehaviourSegment[]>([]);
  const [migration, setMigration] = useState<MigrationCell[]>([]);
  const [drivers, setDrivers] = useState<RiskDriver[]>([]);
  const [distribution, setDistribution] = useState<DistributionBand[]>([]);
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [targets, setTargets] = useState<PriorityTarget[]>([]);
  const [targetTotal, setTargetTotal] = useState(0);
  const [enterprise, setEnterprise] = useState<EnterpriseNode[]>([]);
  const [openCompany, setOpenCompany] = useState<string | null>(null);
  const [drill, setDrill] = useState<EnterpriseNode[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRiskGridOptions().then(setOptions).catch(() => setOptions(null));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, m, b, mig, dr, dist, fn, t, ent] = await Promise.all([
        getRiskGridSummary(filters),
        getRiskGridMatrix(filters),
        getRiskGridBehaviour(filters),
        getRiskGridMigration(filters),
        getRiskGridDrivers(filters),
        getRiskGridDistribution(filters),
        getRiskGridFunnel(filters),
        getRiskGridTargets(filters, search || undefined, 10),
        getRiskGridEnterprise(filters),
      ]);
      setSummary(s);
      setMatrix(m);
      setBehaviour(b);
      setMigration(mig);
      setDrivers(dr);
      setDistribution(dist);
      setFunnel(fn);
      setTargets(t.rows);
      setTargetTotal(t.total);
      setEnterprise(ent);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load the risk grid.");
    } finally {
      setLoading(false);
    }
  }, [filters, search]);

  useEffect(() => {
    const id = setTimeout(load, search ? 300 : 0);   // debounce the search box
    return () => clearTimeout(id);
  }, [load, search]);

  useEffect(() => {
    if (!openCompany) return setDrill([]);
    getRiskGridEnterprise(filters, openCompany).then(setDrill).catch(() => setDrill([]));
  }, [openCompany, filters]);

  const set = (patch: RiskGridFilters) => setFilters((f) => ({ ...f, ...patch }));
  const clearFilter = (key: keyof RiskGridFilters) =>
    setFilters((f) => {
      const next = { ...f };
      delete next[key];
      return next;
    });

  const active = Object.entries(filters).filter(([, v]) => v);
  const cellFor = (risk: string, bucket: string) =>
    matrix.find((c) => c.riskLevel === risk && c.dpdBucket === bucket);
  const maxExposure = useMemo(
    () => Math.max(1, ...matrix.map((c) => c.outstanding)),
    [matrix],
  );

  const exportTargets = () => {
    const header = [
      "Rank", "Customer", "Type", "Account", "Outstanding", "DPD", "Risk",
      "Behaviour", "Recovery %", "Next best action", "Last contact", "Next action",
    ];
    const rows = targets.map((t) => [
      t.rank, t.customerName, t.customerType, t.accountCode, t.outstanding, t.dpd,
      t.riskLevel, t.behaviourProfile, t.recoveryProbability, t.recommendedStrategy,
      t.lastContact ?? "", t.nextAction ?? "",
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "priority-targets.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <Card className="p-8 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive mx-auto mb-3" />
        <p className="text-sm text-foreground">{error}</p>
        <Button onClick={load} variant="outline" className="mt-4 gap-2">
          <RefreshCw className="h-4 w-4" /> Retry
        </Button>
      </Card>
    );
  }

  const kpi = (
    label: string,
    value: string,
    sub: React.ReactNode,
    icon: React.ReactNode,
    accent?: string,
  ) => (
    <Card className="relative overflow-hidden">
      <div className={`absolute inset-x-0 top-0 h-0.5 ${accent ?? "bg-primary"}`} />
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs text-muted-foreground">{label}</p>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        {loading && !summary ? (
          <Skeleton className="h-8 w-28 mt-2" />
        ) : (
          <p className="text-2xl font-semibold text-foreground mt-1 tabular-nums">{value}</p>
        )}
        <div className="text-xs text-muted-foreground mt-1">{sub}</div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-5">
      {/* ---------- Filter bar ---------- */}
      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground px-1">
            <Filter className="h-3.5 w-3.5" /> Filters
          </span>

          <Select
            value={filters.customerType ?? "all"}
            onValueChange={(v) => (v === "all" ? clearFilter("customerType") : set({ customerType: v }))}
          >
            <SelectTrigger className="h-9 w-[150px] text-sm"><SelectValue placeholder="Customer type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All customers</SelectItem>
              {(options?.customerTypes ?? []).map((t) => (
                <SelectItem key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.riskLevel ?? "all"}
            onValueChange={(v) => (v === "all" ? clearFilter("riskLevel") : set({ riskLevel: v }))}
          >
            <SelectTrigger className="h-9 w-[130px] text-sm"><SelectValue placeholder="Risk" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All risk</SelectItem>
              {RISK_LEVELS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select
            value={filters.dpdBucket ?? "all"}
            onValueChange={(v) => (v === "all" ? clearFilter("dpdBucket") : set({ dpdBucket: v }))}
          >
            <SelectTrigger className="h-9 w-[130px] text-sm"><SelectValue placeholder="DPD" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All DPD</SelectItem>
              {DPD_BUCKETS.map((d) => <SelectItem key={d} value={d}>{d} days</SelectItem>)}
            </SelectContent>
          </Select>

          <Select
            value={filters.region ?? "all"}
            onValueChange={(v) => (v === "all" ? clearFilter("region") : set({ region: v }))}
          >
            <SelectTrigger className="h-9 w-[130px] text-sm"><SelectValue placeholder="Region" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All regions</SelectItem>
              {(options?.regions ?? []).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select
            value={filters.accountStatus ?? "all"}
            onValueChange={(v) => (v === "all" ? clearFilter("accountStatus") : set({ accountStatus: v }))}
          >
            <SelectTrigger className="h-9 w-[150px] text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {(options?.accountStatuses ?? []).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>

          <div className="ml-auto flex items-center gap-2">
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            {active.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setFilters({})} className="gap-1 text-xs">
                <X className="h-3.5 w-3.5" /> Clear {active.length}
              </Button>
            )}
          </div>

          {active.length > 0 && (
            <div className="w-full flex flex-wrap gap-1.5 pt-1">
              {active.map(([k, v]) => (
                <Badge key={k} variant="secondary" className="gap-1 font-normal">
                  {String(v)}
                  <span
                    role="button"
                    onClick={() => clearFilter(k as keyof RiskGridFilters)}
                    className="hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </span>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------- Row 1: KPIs ---------- */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        {kpi(
          "Portfolio Health",
          summary ? `${summary.portfolioHealth.toFixed(0)}/100` : "—",
          summary && (
            <span className={`flex items-center gap-1 ${summary.portfolioHealthTrend >= 0 ? "text-success" : "text-destructive"}`}>
              {summary.portfolioHealthTrend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
              {Math.abs(summary.portfolioHealthTrend).toFixed(1)} vs last month
            </span>
          ),
          <Gauge className="h-4 w-4" />,
          summary && summary.portfolioHealth >= 70 ? "bg-success" : summary && summary.portfolioHealth >= 50 ? "bg-warning" : "bg-destructive",
        )}
        {kpi(
          "Total Outstanding",
          summary ? moneyShort(summary.totalOutstanding) : "—",
          summary && `Consumer ${moneyShort(summary.consumerOutstanding)} · Enterprise ${moneyShort(summary.enterpriseOutstanding)}`,
          <Wallet className="h-4 w-4" />,
        )}
        {kpi(
          "Expected Recovery (30d)",
          summary ? moneyShort(summary.expectedRecovery30d) : "—",
          summary && `${pct(summary.expectedRecoveryPct)} of outstanding`,
          <TrendingUp className="h-4 w-4" />,
          "bg-success",
        )}
        {kpi(
          "High Risk Accounts",
          summary ? String(summary.highRiskAccounts) : "—",
          summary && `${moneyShort(summary.highRiskOutstanding)} exposed`,
          <AlertTriangle className="h-4 w-4" />,
          "bg-destructive",
        )}
        {kpi(
          "Recovery Probability",
          summary ? pct(summary.avgRecoveryProbability) : "—",
          summary && `${summary.totalAccounts} lines · ${summary.totalCustomers} customers`,
          <Activity className="h-4 w-4" />,
        )}
      </div>

      {/* ---------- Row 2: matrix + behaviour ---------- */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Risk Grid Matrix</CardTitle>
            <CardDescription>
              Exposure by risk band and ageing. Select a cell to filter the whole page.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading && matrix.length === 0 ? (
              <Skeleton className="h-56 w-full" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-separate border-spacing-1">
                  <thead>
                    <tr>
                      <th className="text-left text-[11px] uppercase tracking-wide text-muted-foreground font-semibold p-2">
                        Risk / DPD
                      </th>
                      {DPD_BUCKETS.map((d) => (
                        <th key={d} className="text-center text-[11px] uppercase tracking-wide text-muted-foreground font-semibold p-2">
                          {d}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {RISK_LEVELS.map((risk) => (
                      <tr key={risk}>
                        <td className="p-2">
                          <Badge variant="outline" className={riskTone[risk]}>{risk}</Badge>
                        </td>
                        {DPD_BUCKETS.map((bucket) => {
                          const c = cellFor(risk, bucket);
                          const selected =
                            filters.riskLevel === risk && filters.dpdBucket === bucket;
                          return (
                            <td key={bucket} className="p-0">
                              <button
                                disabled={!c}
                                onClick={() =>
                                  selected
                                    ? setFilters((f) => ({ ...f, riskLevel: undefined, dpdBucket: undefined }))
                                    : set({ riskLevel: risk, dpdBucket: bucket })
                                }
                                className={`w-full rounded-lg p-3 text-left transition-all ${heat(
                                  (c?.outstanding ?? 0) / maxExposure,
                                )} ${selected ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-primary/40"} ${
                                  c ? "cursor-pointer" : "opacity-40 cursor-default"
                                }`}
                              >
                                <div className="text-sm font-semibold text-foreground tabular-nums">
                                  {c?.accounts ?? 0}
                                </div>
                                <div className="text-[11px] text-muted-foreground tabular-nums">
                                  {c ? money(c.outstanding) : "—"}
                                </div>
                                {c && (
                                  <div className="text-[10px] text-muted-foreground mt-0.5">
                                    {pct(c.avgRecovery)} recovery
                                  </div>
                                )}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Behaviour Profile</CardTitle>
            <CardDescription>How each segment actually pays</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading && behaviour.length === 0 && <Skeleton className="h-48 w-full" />}
            {behaviour.map((b) => {
              const selected = filters.behaviour === b.profile;
              return (
                <button
                  key={b.profile}
                  onClick={() => (selected ? clearFilter("behaviour") : set({ behaviour: b.profile }))}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">{b.profile}</span>
                    <span className="text-sm tabular-nums text-foreground">{money(b.outstanding)}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary/60" style={{ width: `${b.share}%` }} />
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>{b.accounts} lines ({pct(b.share)})</span>
                    <span>recovery {pct(b.avgRecovery)}</span>
                    <span>risk {b.avgRisk}</span>
                  </div>
                </button>
              );
            })}
            {!loading && behaviour.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No accounts match these filters.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ---------- Row 3: migration + drivers + distribution ---------- */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1fr] gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShuffleIcon className="h-4 w-4" /> Risk Migration
            </CardTitle>
            <CardDescription>
              Band moves from last month to this one — deterioration is what needs a response
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading && migration.length === 0 ? (
              <Skeleton className="h-48 w-full" />
            ) : migration.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No month-over-month history for this selection.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {(["improved", "stable", "deteriorated"] as const).map((dir) => {
                    const rows = migration.filter((m) => m.direction === dir);
                    const lines = rows.reduce((n, m) => n + m.accounts, 0);
                    const amount = rows.reduce((n, m) => n + m.outstanding, 0);
                    const tone =
                      dir === "improved" ? "text-success"
                      : dir === "deteriorated" ? "text-destructive"
                      : "text-muted-foreground";
                    return (
                      <div key={dir} className="rounded-lg border border-border p-2.5">
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                          {dir}
                        </p>
                        <p className={`text-xl font-semibold tabular-nums ${tone}`}>{lines}</p>
                        <p className="text-[11px] text-muted-foreground">{money(amount)}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                        <th className="px-2 py-2 font-semibold">From</th>
                        <th className="px-2 py-2 font-semibold">To</th>
                        <th className="px-2 py-2 font-semibold text-right">Lines</th>
                        <th className="px-2 py-2 font-semibold text-right">Exposure</th>
                      </tr>
                    </thead>
                    <tbody>
                      {migration
                        .slice()
                        .sort((a, b) => b.accounts - a.accounts)
                        .map((m) => (
                          <tr
                            key={`${m.fromBand}-${m.toBand}`}
                            className={`border-b border-border last:border-0 ${
                              m.toBand === "Critical" || m.toBand === "High"
                                ? "bg-destructive/5"
                                : m.direction === "deteriorated"
                                ? "bg-warning/5"
                                : ""
                            }`}
                          >
                            <td className="px-2 py-1.5">
                              <Badge variant="outline" className={riskTone[m.fromBand]}>
                                {m.fromBand}
                              </Badge>
                            </td>
                            <td className="px-2 py-1.5">
                              <span className="flex items-center gap-1.5">
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                <Badge variant="outline" className={riskTone[m.toBand]}>
                                  {m.toBand}
                                </Badge>
                              </span>
                            </td>
                            <td className="px-2 py-1.5 text-right tabular-nums">{m.accounts}</td>
                            <td className="px-2 py-1.5 text-right tabular-nums">
                              {money(m.outstanding)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Layers className="h-4 w-4" /> Risk Drivers
            </CardTitle>
            <CardDescription>
              What is actually pushing the score, weighted as configured in Risk Analysis
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading && drivers.length === 0 && <Skeleton className="h-44 w-full" />}
            {drivers.map((d) => (
              <div key={d.driver}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{d.driver}</span>
                  <span className="tabular-nums text-foreground font-medium">
                    {pct(d.contribution)}
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full ${d.contribution >= 30 ? "bg-destructive" : d.contribution >= 15 ? "bg-warning" : "bg-primary/60"}`}
                    style={{ width: `${Math.min(100, d.contribution)}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  avg score {d.avgScore} · weight {d.weightPct}%
                  {d.weightPct === 0 && " · not in the roll-up"}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ---------- Distribution + exposure by risk ---------- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Risk Distribution &amp; Exposure</CardTitle>
          <CardDescription>
            How many accounts sit in each band, and how much money sits with them
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading && distribution.length === 0 ? (
            <Skeleton className="h-28 w-full" />
          ) : (
            <>
              {/* Two proportional bars: accounts against exposure. */}
              <div className="space-y-3 mb-4">
                {(["Accounts", "Exposure"] as const).map((kind) => (
                  <div key={kind}>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1">
                      {kind}
                    </p>
                    <div className="flex h-7 rounded-lg overflow-hidden border border-border">
                      {distribution.map((b) => {
                        const w = kind === "Accounts" ? b.sharePct : b.exposurePct;
                        const fill =
                          b.riskLevel === "Critical" ? "bg-destructive"
                          : b.riskLevel === "High" ? "bg-destructive/60"
                          : b.riskLevel === "Medium" ? "bg-warning/70"
                          : "bg-success/60";
                        return w > 0 ? (
                          <button
                            key={b.riskLevel}
                            title={`${b.riskLevel}: ${pct(w)}`}
                            onClick={() =>
                              filters.riskLevel === b.riskLevel
                                ? clearFilter("riskLevel")
                                : set({ riskLevel: b.riskLevel })
                            }
                            className={`${fill} flex items-center justify-center text-[10px] text-white font-medium transition-opacity hover:opacity-80`}
                            style={{ width: `${w}%` }}
                          >
                            {w >= 8 ? pct(w) : ""}
                          </button>
                        ) : null;
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {distribution.map((b) => (
                  <button
                    key={b.riskLevel}
                    onClick={() =>
                      filters.riskLevel === b.riskLevel
                        ? clearFilter("riskLevel")
                        : set({ riskLevel: b.riskLevel })
                    }
                    className={`rounded-xl border p-3 text-left transition-colors ${
                      filters.riskLevel === b.riskLevel
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <Badge variant="outline" className={riskTone[b.riskLevel]}>
                      {b.riskLevel}
                    </Badge>
                    <p className="text-xl font-semibold text-foreground tabular-nums mt-2">
                      {money(b.outstanding)}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {b.accounts} lines ({pct(b.sharePct)}) · {pct(b.exposurePct)} of exposure
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      avg {b.avgDpd.toFixed(0)} dpd · recovery {pct(b.avgRecovery)}
                    </p>
                  </button>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ---------- Row 4: funnel ---------- */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Collection Funnel</CardTitle>
          <CardDescription>Where accounts drop out of the journey</CardDescription>
        </CardHeader>
        <CardContent>
          {loading && funnel.length === 0 ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {funnel.map((s, i) => (
                <div key={s.stage} className="relative">
                  <div className="rounded-xl border border-border p-3">
                    <p className="text-xs text-muted-foreground">{s.stage}</p>
                    <p className="text-xl font-semibold text-foreground tabular-nums mt-1">
                      {s.accounts}
                    </p>
                    <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary" style={{ width: `${s.ofPortfolioPct}%` }} />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {pct(s.ofPortfolioPct)} of portfolio
                    </p>
                  </div>
                  {i > 0 && (
                    <span className="absolute -left-2 top-1/2 -translate-y-1/2 hidden md:block text-[10px] text-muted-foreground bg-background px-1">
                      {pct(s.conversionPct)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------- Row 5: priority targets ---------- */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4" /> Priority Targets
            </CardTitle>
            <CardDescription>
              Ranked by money at risk — exposure weighted by the chance of losing it
              {targetTotal ? ` · ${targetTotal} lines in scope` : ""}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search name or account"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pl-8 w-56 text-sm"
              />
            </div>
            <Button variant="outline" size="sm" onClick={exportTargets} className="gap-1.5">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-y border-border">
                  <th className="px-3 py-2 font-semibold">#</th>
                  <th className="px-3 py-2 font-semibold">Customer</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold text-right">Outstanding</th>
                  <th className="px-3 py-2 font-semibold text-right">DPD</th>
                  <th className="px-3 py-2 font-semibold">Risk</th>
                  <th className="px-3 py-2 font-semibold">Behaviour</th>
                  <th className="px-3 py-2 font-semibold text-right">Recovery</th>
                  <th className="px-3 py-2 font-semibold">Next best action</th>
                  <th className="px-3 py-2 font-semibold">Next action</th>
                </tr>
              </thead>
              <tbody>
                {loading && targets.length === 0 && (
                  <tr><td colSpan={10} className="px-3 py-10 text-center">
                    <Loader2 className="h-5 w-5 animate-spin inline text-muted-foreground" />
                  </td></tr>
                )}
                {targets.map((t) => (
                  <tr
                    key={t.accountCode}
                    onClick={() => onOpenCustomer?.(t.customerId)}
                    className="border-b border-border last:border-0 hover:bg-muted/40 cursor-pointer"
                  >
                    <td className="px-3 py-2 text-muted-foreground tabular-nums">{t.rank}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-foreground">{t.customerName}</div>
                      <div className="text-xs text-muted-foreground">
                        {t.subscriberNo ?? t.accountCode}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {t.customerType.charAt(0) + t.customerType.slice(1).toLowerCase()}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {money(t.outstanding)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{t.dpd}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={riskTone[t.riskLevel]}>{t.riskLevel}</Badge>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{t.behaviourProfile}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{pct(t.recoveryProbability)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{t.recommendedStrategy}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {t.nextAction ? new Date(t.nextAction).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
                {!loading && targets.length === 0 && (
                  <tr><td colSpan={10} className="px-3 py-10 text-center text-muted-foreground">
                    No accounts match these filters.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ---------- Enterprise exposure ---------- */}
      {enterprise.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Enterprise Exposure
            </CardTitle>
            <CardDescription>Company → branch → BAN → account</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {enterprise.map((c) => {
              const open = openCompany === c.id;
              const branches = drill.filter((d) => d.level === "branch");
              return (
                <div key={c.id} className="rounded-lg border border-border overflow-hidden">
                  <button
                    onClick={() => setOpenCompany(open ? null : c.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors"
                  >
                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
                    <span className="text-sm font-medium text-foreground">{c.name}</span>
                    <Badge variant="outline" className={riskTone[c.riskLevel]}>{c.riskLevel}</Badge>
                    <span className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{c.accounts} lines</span>
                      <span>avg {c.avgDpd.toFixed(0)} dpd</span>
                      <span>recovery {pct(c.recoveryProbability)}</span>
                      <span className="text-foreground font-medium tabular-nums">{money(c.outstanding)}</span>
                    </span>
                  </button>
                  {open && (
                    <div className="border-t border-border divide-y divide-border">
                      {branches.length === 0 && (
                        <p className="px-6 py-3 text-xs text-muted-foreground">Loading branches…</p>
                      )}
                      {branches.map((b) => (
                        <div key={b.id} className="px-6 py-2 flex items-center gap-3 text-sm">
                          <span className="text-foreground">{b.name}</span>
                          <span className="ml-auto flex items-center gap-4 text-xs text-muted-foreground">
                            <span>{b.accounts} lines</span>
                            <span>avg {b.avgDpd.toFixed(0)} dpd</span>
                            <span className="text-foreground tabular-nums">{money(b.outstanding)}</span>
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
