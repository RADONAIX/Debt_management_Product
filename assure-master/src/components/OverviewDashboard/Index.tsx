import { useEffect, useMemo, useState } from "react";
import {
  AlertOctagon, Banknote, Briefcase, Building2, FileWarning, HandCoins,
  Loader2, RefreshCw, Scale, ShieldAlert, Target, Users, Wallet, Workflow,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { CustomerSearch } from "@/components/dashboard/CustomerSearch";
import { NotificationCenter } from "@/components/notifications/NotificationCenter";
import { money } from "@/lib/money";
import { getPortfolioOverview, type PortfolioOverview } from "@/lib/portfolio";

const short = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`
  : n.toFixed(0);

const pct = (v?: number | null) => (v == null ? "—" : `${v}%`);

const monthLabel = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { month: "short" });

const AGEING_TONE: Record<string, string> = {
  Current: "hsl(var(--muted-foreground))",
  "1-30": "hsl(var(--info))",
  "31-60": "hsl(var(--warning))",
  "61-90": "hsl(var(--warning))",
  "90+": "hsl(var(--destructive))",
};

/** One colour per stage, shared by the bar and the tiles beneath it. */
const STAGE_FILL: Record<string, string> = {
  "In collection": "bg-info",
  "Promise to pay": "bg-sky-500",
  "In dispute": "bg-orange-500",
  "With an agency": "bg-purple-500",
  "In legal": "bg-destructive",
  "No case yet": "bg-muted-foreground",
};

const STAGE_ICON: Record<string, typeof Wallet> = {
  "In collection": Briefcase,
  "Promise to pay": HandCoins,
  "In dispute": FileWarning,
  "With an agency": Building2,
  "In legal": Scale,
  "No case yet": AlertOctagon,
};

const STAGE_MODULE: Record<string, string> = {
  "In collection": "collections_workspace",
  "Promise to pay": "collections_workspace",
  "In dispute": "report",
  "With an agency": "recovery_workspace",
  "In legal": "recovery_workspace",
  "No case yet": "collections_workspace",
};

const tooltipStyle = {
  contentStyle: {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "0.75rem",
    fontSize: "12px",
  },
  labelStyle: { color: "hsl(var(--muted-foreground))", fontSize: "11px" },
};

const Delta = ({ value, invert = false }: { value?: number | null; invert?: boolean }) => {
  if (value == null) return null;
  const good = invert ? value <= 0 : value >= 0;
  return (
    <span className={`text-[11px] font-medium ${good ? "text-success" : "text-destructive"}`}>
      {value >= 0 ? "↑" : "↓"} {Math.abs(value) >= 1000 ? ">999" : Math.abs(value)}%
      <span className="text-muted-foreground font-normal"> vs last month</span>
    </span>
  );
};

/** A headline figure. Six words of caption, because the number is the point. */
const Head = ({ icon: Icon, label, value, caption, children, tone = "" }: {
  icon: typeof Wallet; label: string; value: string; caption: string;
  children?: React.ReactNode; tone?: string;
}) => (
  <Card className="p-4 flex flex-col gap-1">
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground truncate">{label}</span>
      <Icon className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
    </div>
    <div className={`text-3xl font-semibold tabular-nums leading-tight ${tone}`}>{value}</div>
    <div className="text-xs text-muted-foreground">{caption}</div>
    {children}
  </Card>
);

const Panel = ({ title, hint, children }: {
  title: string; hint?: string; children: React.ReactNode;
}) => (
  <Card className="overflow-hidden">
    <div className="px-4 py-3 border-b border-border">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
    {children}
  </Card>
);

/**
 * Portfolio Dashboard — the landing screen, and the widest view in the product.
 *
 * It answers four questions in order: how big is the book, how much of it has
 * gone bad, how much of the bad is actually being worked, and where the rest of
 * it is sitting. Below that, how much of the application is engaged with it —
 * strategies, risk, agencies, legal and the people running them.
 *
 * Figures here are deliberately portfolio-level. The Collections Dashboard
 * measures the collections desks; nothing on this screen repeats it.
 */
const OverviewDashboard = ({ setActiveModule, setSelectedCustomer }) => {
  const [d, setD] = useState<PortfolioOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    getPortfolioOverview()
      .then(setD)
      .catch(() => toast.error("Could not load the portfolio."))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const trend = useMemo(
    () => (d?.trend ?? []).map((m) => ({ ...m, label: monthLabel(m.month) })), [d]);

  if (loading && !d) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!d) return null;

  const go = (module: string) => () => setActiveModule(module);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Portfolio Dashboard"
        description="The whole book, and how much of the operation is engaged with it"
        actions={
          <>
            <CustomerSearch
              selectedCustomerId={selectedCustomerId}
              onSelectCustomer={setSelectedCustomerId}
              setSelectedCustomer={setSelectedCustomer}
              setActiveModule={setActiveModule}
            />
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                       : <RefreshCw className="h-3.5 w-3.5" />}
            </Button>
            <NotificationCenter />
          </>
        }
      />

      {/* 1 — How big is the book, and how much of it is in trouble */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Head
          icon={Wallet} label="Total receivables" value={money(d.receivables)}
          caption={`${d.accounts} accounts · ${d.customers} customers`}
        >
          <Delta value={d.receivablesDeltaPct} invert />
        </Head>
        <Head
          icon={AlertOctagon} label="Delinquent balance" value={money(d.delinquent)}
          caption={`${pct(d.delinquentPct)} of the book · ${d.delinquentAccounts} accounts`}
          tone="text-warning"
        >
          <span className="text-[11px] text-muted-foreground">
            {money(d.severe)} past 90 days ({pct(d.severePct)} of it)
          </span>
        </Head>
        <Head
          icon={Target} label="Under collection" value={pct(d.coveragePct)}
          caption={`${money(d.underCase)} on ${d.openCases} open cases`}
          tone={(d.coveragePct ?? 100) < 80 ? "text-destructive" : "text-foreground"}
        >
          <span className="text-[11px] text-muted-foreground">
            {d.uncovered > 0
              ? `${money(d.uncovered)} delinquent with no case on it`
              : "every delinquent account is being worked"}
          </span>
        </Head>
        <Head
          icon={Banknote} label="Cash collection ratio" value={pct(d.cashCollectionPct)}
          caption={`${money(d.collectedThisMonth)} received of ${money(d.billedThisMonth)} billed`}
          tone="text-success"
        >
          <Delta value={d.collectedDeltaPct} />
        </Head>
      </div>

      {/* 2 — The delinquent balance, split so the parts add up to the whole */}
      <Card className="p-4">
        <div className="flex items-baseline gap-2 flex-wrap">
          <h2 className="text-sm font-semibold text-foreground">
            Where the delinquent balance sits
          </h2>
          <span className="text-xs text-muted-foreground">
            every delinquent account counted once, so these add up to{" "}
            {money(d.delinquent)}
          </span>
        </div>

        {/* One bar, proportional, so the split is legible before the numbers are read */}
        <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-muted">
          {d.stages.map((s) => (
            <div
              key={s.stage}
              title={`${s.stage}: ${money(s.balance)}`}
              style={{ width: `${(s.balance / (d.delinquent || 1)) * 100}%` }}
              className={STAGE_FILL[s.stage] ?? "bg-primary"}
            />
          ))}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 mt-3">
          {d.stages.map((s) => {
            const Icon = STAGE_ICON[s.stage] ?? Briefcase;
            return (
              <button
                key={s.stage}
                onClick={go(STAGE_MODULE[s.stage] ?? "collections_workspace")}
                className="rounded-xl border border-border bg-card px-3 py-2.5 text-left transition hover:border-primary/40"
              >
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${STAGE_FILL[s.stage] ?? "bg-primary"}`} />
                  <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="text-[11px] text-muted-foreground truncate">{s.stage}</span>
                </div>
                <div className="text-lg font-semibold tabular-nums mt-0.5">
                  {money(s.balance)}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {s.accounts} {s.accounts === 1 ? "account" : "accounts"} ·{" "}
                  {pct(Math.round((s.balance / (d.delinquent || 1)) * 1000) / 10)}
                </div>
              </button>
            );
          })}
        </div>

      </Card>

      {/* 3 — Cash and where the balance is aged */}
      <div className="grid gap-3 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Panel title="Billed against collected"
                 hint="Six months of invoicing and receipts across the whole portfolio">
            <div className="p-3 h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trend} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="billed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--info))" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="hsl(var(--info))" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="received" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--success))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--success))" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tickFormatter={short} tick={{ fontSize: 11 }}
                         stroke="hsl(var(--muted-foreground))" />
                  <Tooltip {...tooltipStyle}
                    formatter={(v: number, n: string) =>
                      [money(v), n === "billed" ? "Billed" : "Collected"]} />
                  <Area type="monotone" dataKey="billed" stroke="hsl(var(--info))"
                        strokeWidth={1.5} fill="url(#billed)" />
                  <Area type="monotone" dataKey="collected" stroke="hsl(var(--success))"
                        strokeWidth={2} fill="url(#received)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        <Panel title="Balance by age" hint="The whole book, not only what is in collections">
          <div className="p-3 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={d.ageing} margin={{ top: 6, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="bucket" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tickFormatter={short} tick={{ fontSize: 11 }}
                       stroke="hsl(var(--muted-foreground))" />
                <Tooltip {...tooltipStyle}
                  formatter={(v: number, _n, item) =>
                    [`${money(v)} · ${item?.payload?.accounts ?? 0} accounts`, "Balance"]} />
                <Bar dataKey="balance" radius={[6, 6, 0, 0]}>
                  {d.ageing.map((a) => (
                    <Cell key={a.bucket} fill={AGEING_TONE[a.bucket] ?? "hsl(var(--primary))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* 4 — How much of the application is engaged */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            icon: Users, label: "Customers", value: String(d.customers),
            sub: `${d.enterpriseCustomers} enterprise across ${d.companies} companies`,
            module: "customer_360",
          },
          {
            icon: ShieldAlert, label: "High and critical risk", value: String(d.riskyAccounts),
            sub: `${money(d.riskyValue)} exposed`, module: "risks_segmentation",
          },
          {
            icon: Workflow, label: "Accounts on a strategy", value: String(d.accountsOnStrategy),
            sub: d.accountsOffStrategy > 0
              ? `${d.accountsOffStrategy} following none`
              : "every account is covered",
            module: "risk",
          },
          {
            icon: Briefcase, label: "Cases closed this month", value: String(d.closedThisMonth),
            sub: `${d.agents} collectors · ${d.activeUsers} users in ${d.roles} roles`,
            module: "collections_dashboard",
          },
        ].map((s) => (
          <button key={s.label} onClick={go(s.module)}
                  className="rounded-2xl border border-border bg-card p-4 text-left transition hover:border-primary/40">
            <div className="flex items-center gap-2">
              <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground truncate">{s.label}</span>
            </div>
            <div className="text-2xl font-semibold tabular-nums mt-1">{s.value}</div>
            <div className="text-[11px] text-muted-foreground truncate">{s.sub}</div>
          </button>
        ))}
      </div>

      {/* 5 — The book cut two ways that matter operationally */}
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="By product" hint="Which lines of business carry the delinquency">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  {["Product", "Accounts", "Balance", "Delinquent", "Share"].map((h, i) => (
                    <th key={h} className={`px-4 py-2 font-medium ${i ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {d.products.map((p) => (
                  <tr key={p.name} className="hover:bg-muted/30">
                    <td className="px-4 py-2 truncate max-w-[160px]">{p.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{p.accounts}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(p.balance)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(p.delinquent)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      <span className={(p.delinquentPct ?? 0) > 70 ? "text-warning font-medium" : ""}>
                        {pct(p.delinquentPct)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Strategies in play" hint="What is driving each part of the book">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr>
                  {["Strategy", "Accounts", "Balance", "Success"].map((h, i) => (
                    <th key={h} className={`px-4 py-2 font-medium ${i ? "text-right" : "text-left"}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {d.strategies.map((s) => (
                  <tr key={s.code} className="hover:bg-muted/30 cursor-pointer"
                      onClick={go("strategy_versions")}>
                    <td className="px-4 py-2">
                      <span className="truncate">{s.name}</span>
                      <span className="text-[10px] text-muted-foreground ml-1.5">
                        {s.version} · {s.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">{s.accounts}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{money(s.balance)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{pct(s.successRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
};

export default OverviewDashboard;
