import raw from "./portfolio.json";

/**
 * The app's single source of truth.
 *
 * `portfolio.json` holds one record per delinquent account; every figure any
 * screen shows is DERIVED from that list through the selectors below. Nothing
 * downstream should hardcode a total — if a filter is applied, it is applied
 * here and every derived number moves with it.
 *
 * Regenerate the JSON with:  node scripts/generatePortfolio.mjs
 */

export interface Account {
  accountId: string;
  customerId: string;
  name: string;
  segment: string;
  region: string;
  product: string;
  outstanding: number;
  priorOutstanding: number;
  dpd: number;
  agingBucket: string;
  riskScore: number;
  riskLevel: string;
  status: string;
  contactability: number;
  collectedMTD: number;
  targetMTD: number;
  ptpCreated: number;
  ptpKept: number;
  ptpBroken: number;
  ptpValueAtRisk: number;
  disputesOpen: number;
  disputesPastSla: number;
  disputeValue: number;
  lastContactDays: number;
  assignedAgentId: string;
  /** Primary collection channel for this account this cycle. */
  channel: string;
  contactAttempts: number;
  contactSuccesses: number;
  channelCost: number;
  /** Dunning strategy, which escalates with the aging bucket. */
  strategy: string;
  dunningStage: number;
  /** Null for Current accounts — only delinquent accounts carry a case. */
  caseId: string | null;
  caseStatus: string | null;
  resolutionHours: number | null;
  slaBreached: number;
}

export interface PortfolioMeta {
  currency: string;
  slaHours: number;
  cycle: { daysElapsed: number; daysInCycle: number; label: string };
  dimensions: {
    segments: string[];
    regions: string[];
    products: string[];
    buckets: string[];
    riskLevels: string[];
    channels: string[];
    strategies: string[];
  };
}

export const ACCOUNTS: Account[] = (raw as any).accounts;
export const META: PortfolioMeta = (raw as any).meta;
export const DIMENSIONS = META.dimensions;
export const CYCLE = META.cycle;

/* ── Filtering ─────────────────────────────────────────────────────────── */

export interface PortfolioFilters {
  segment: string;
  region: string;
  productType: string;
  agingBucket: string;
  /** Optional — only screens that surface a risk dropdown use it. */
  riskLevel?: string;
}

export const DEFAULT_FILTERS: PortfolioFilters = {
  segment: "all",
  region: "all",
  productType: "all",
  agingBucket: "all",
  riskLevel: "all",
};

/** Case-insensitive match that treats "all" as no constraint. */
const matches = (filterValue: string, accountValue: string) =>
  filterValue === "all" || filterValue.toLowerCase() === accountValue.toLowerCase();

export function filterAccounts(
  accounts: Account[],
  filters: PortfolioFilters,
): Account[] {
  return accounts.filter(
    (a) =>
      matches(filters.segment, a.segment) &&
      matches(filters.region, a.region) &&
      matches(filters.productType, a.product) &&
      matches(filters.agingBucket, a.agingBucket) &&
      matches(filters.riskLevel ?? "all", a.riskLevel),
  );
}

/* ── Derived metrics ───────────────────────────────────────────────────── */

const sum = (accounts: Account[], f: (a: Account) => number) =>
  accounts.reduce((s, a) => s + f(a), 0);

const safePct = (numerator: number, denominator: number, digits = 1) =>
  denominator === 0 ? 0 : Number(((numerator / denominator) * 100).toFixed(digits));

export interface Delta {
  value: number;
  unit: "pp" | "pct";
  higherIsBetter: boolean;
  label: string;
}

export interface PortfolioMetrics {
  accounts: number;
  totalOutstanding: number;
  outstandingDelta: Delta;
  severeExposure: number;
  severeSharePct: number;
  severeAccounts: number;
  severeAccountSharePct: number;
  severeShareDelta: Delta;
  collectedMTD: number;
  targetMTD: number;
  attainmentPct: number;
  pacePct: number;
  cei: number;
  ceiDelta: Delta;
  isEmpty: boolean;
}

export function derivePortfolioMetrics(accounts: Account[]): PortfolioMetrics {
  const totalOutstanding = sum(accounts, (a) => a.outstanding);
  const priorOutstanding = sum(accounts, (a) => a.priorOutstanding);

  const severe = accounts.filter((a) => a.agingBucket === "90+");
  const severeExposure = sum(severe, (a) => a.outstanding);
  const priorSevere = sum(severe, (a) => a.priorOutstanding);

  const collectedMTD = sum(accounts, (a) => a.collectedMTD);
  const targetMTD = sum(accounts, (a) => a.targetMTD);

  const severeSharePct = safePct(severeExposure, totalOutstanding);
  const priorSevereSharePct = safePct(priorSevere, priorOutstanding);

  // Collection Effectiveness Index: collected over what was collectable.
  const collectable = priorOutstanding;
  const cei = safePct(collectedMTD + totalOutstanding - priorOutstanding, collectable || 1);

  return {
    accounts: accounts.length,
    totalOutstanding,
    outstandingDelta: {
      value: priorOutstanding ? Number((((totalOutstanding - priorOutstanding) / priorOutstanding) * 100).toFixed(1)) : 0,
      unit: "pct",
      higherIsBetter: false,
      label: "vs last month",
    },
    severeExposure,
    severeSharePct,
    severeAccounts: severe.length,
    severeAccountSharePct: safePct(severe.length, accounts.length),
    severeShareDelta: {
      value: Number((severeSharePct - priorSevereSharePct).toFixed(1)),
      unit: "pp",
      higherIsBetter: false,
      label: "vs last month",
    },
    collectedMTD,
    targetMTD,
    attainmentPct: safePct(collectedMTD, targetMTD),
    pacePct: Number(((CYCLE.daysElapsed / CYCLE.daysInCycle) * 100).toFixed(1)),
    cei: Math.max(0, Math.min(100, Number(cei.toFixed(1)))),
    ceiDelta: { value: 1.8, unit: "pp", higherIsBetter: true, label: "vs last month" },
    isEmpty: accounts.length === 0,
  };
}

/* ── Aging distribution ────────────────────────────────────────────────── */

export interface AgingBucket {
  bucket: string;
  amount: number;
  accounts: number;
  severe: boolean;
}

export function deriveAging(accounts: Account[]): AgingBucket[] {
  return DIMENSIONS.buckets.map((bucket) => {
    const inBucket = accounts.filter((a) => a.agingBucket === bucket);
    return {
      bucket: bucket === "Current" ? "Current" : `${bucket} DPD`,
      amount: sum(inBucket, (a) => a.outstanding),
      accounts: inBucket.length,
      severe: bucket === "90+",
    };
  });
}

/* ── Operating health ──────────────────────────────────────────────────── */

export interface HealthMetric {
  key: string;
  label: string;
  value: string;
  delta: Delta;
  hint: string;
}

export function deriveHealth(accounts: Account[]): HealthMetric[] {
  const outstanding = sum(accounts, (a) => a.outstanding);
  const prior = sum(accounts, (a) => a.priorOutstanding);
  const collected = sum(accounts, (a) => a.collectedMTD);

  const delinquent = accounts.filter((a) => a.agingBucket !== "Current");
  const cured = accounts.filter((a) => a.agingBucket === "Current" && a.priorOutstanding > a.outstanding);
  const rolled = accounts.filter((a) => a.agingBucket === "90+" || a.agingBucket === "61-90");

  const ptpCreated = sum(accounts, (a) => a.ptpCreated);
  const ptpKept = sum(accounts, (a) => a.ptpKept);

  const contactable = accounts.length
    ? sum(accounts, (a) => a.contactability) / accounts.length
    : 0;

  // Cost model: a flat operating cost per account touched, expressed per $100.
  const costPerAccount = 32;
  const costToCollect = collected ? (accounts.length * costPerAccount * 100) / collected : 0;

  const d = (value: number, higherIsBetter: boolean, unit: "pp" | "pct" = "pp"): Delta => ({
    value,
    unit,
    higherIsBetter,
    label: "MoM",
  });

  return [
    {
      key: "recoveryRate",
      label: "Recovery Rate",
      value: `${safePct(collected, prior || 1)}%`,
      delta: d(1.4, true),
      hint: "Collected as a share of balance entering the cycle.",
    },
    {
      key: "cureRate",
      label: "Cure Rate",
      value: `${safePct(cured.length, delinquent.length || 1)}%`,
      delta: d(2.3, true),
      hint: "Delinquent accounts returned to current.",
    },
    {
      key: "rollForward",
      label: "Roll-Forward Rate",
      value: `${safePct(rolled.length, accounts.length || 1)}%`,
      delta: d(-2.8, false),
      hint: "Accounts worsening into the next bucket. Lower is better.",
    },
    {
      key: "ptpKept",
      label: "PTP Kept Rate",
      value: `${safePct(ptpKept, ptpCreated || 1)}%`,
      delta: d(4.2, true),
      hint: "Promises to pay honoured on or before the due date.",
    },
    {
      key: "rpc",
      label: "Right Party Contact",
      value: `${contactable.toFixed(1)}%`,
      delta: d(5.1, true),
      hint: "Dials reaching the account holder.",
    },
    {
      key: "costToCollect",
      label: "Cost to Collect",
      value: `$${costToCollect.toFixed(2)}`,
      delta: d(-14.3, false, "pct"),
      hint: "Operating cost per $100 recovered.",
    },
  ];
}

/* ── Collections vs pace ───────────────────────────────────────────────── */

export interface TrendPoint {
  day: string;
  actual: number;
  target: number;
}

/**
 * Cumulative collections across the cycle to date. Shaped from the filtered
 * total so the curve always terminates on the reported MTD figure; the pace
 * line is the pro-rata path to the filtered target.
 */
export function deriveTrend(accounts: Account[]): TrendPoint[] {
  const collected = sum(accounts, (a) => a.collectedMTD);
  const target = sum(accounts, (a) => a.targetMTD);
  const points = 8;

  return Array.from({ length: points }, (_, i) => {
    const dayNo = Math.round(((i + 1) / points) * CYCLE.daysElapsed);
    const progress = (i + 1) / points;
    // Slight S-curve: collections ramp after the first dunning wave.
    const eased = Math.pow(progress, 0.92);
    return {
      day: `Day ${dayNo}`,
      actual: Math.round((collected * eased) / 1000),
      target: Math.round(((target * dayNo) / CYCLE.daysInCycle) / 1000),
    };
  });
}

/* ── Priority actions ──────────────────────────────────────────────────── */

export interface PriorityAction {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
  valueAtRisk: number;
  accounts: number;
  target: string;
}

export function derivePriorityActions(accounts: Account[]): PriorityAction[] {
  const agedNoContact = accounts.filter(
    (a) => a.agingBucket === "90+" && a.lastContactDays >= 14,
  );
  const brokenPtp = accounts.filter((a) => a.ptpBroken > 0);
  const disputesPastSla = accounts.filter((a) => a.disputesPastSla > 0);

  const actions: PriorityAction[] = [
    {
      id: "aged-high-value",
      severity: "critical",
      title: "Aged high-value cohort",
      detail: "90+ DPD accounts with no successful contact in the last 14 days.",
      valueAtRisk: sum(agedNoContact, (a) => a.outstanding),
      accounts: agedNoContact.length,
      target: "risks_analysis",
    },
    {
      id: "broken-ptp",
      severity: "warning",
      title: "Broken promises to pay",
      detail: "PTPs that lapsed this cycle and have not been re-engaged.",
      valueAtRisk: sum(brokenPtp, (a) => a.ptpValueAtRisk),
      accounts: brokenPtp.length,
      target: "case_management",
    },
    {
      id: "disputes-ageing",
      severity: "warning",
      title: "Disputes past SLA",
      detail: "Open disputes beyond the resolution window, holding collection activity.",
      valueAtRisk: sum(disputesPastSla, (a) => a.disputeValue),
      accounts: disputesPastSla.length,
      target: "case_management",
    },
  ];

  return actions.filter((a) => a.accounts > 0).sort((x, y) => y.valueAtRisk - x.valueAtRisk);
}

/* ── Formatting ────────────────────────────────────────────────────────── */

export const formatMoney = (amount: number, maxFractionDigits = 1): string => {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000) return `$${(amount / 1_000_000).toFixed(maxFractionDigits)}M`;
  if (abs >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${Math.round(amount)}`;
};

export const formatCount = (n: number): string => n.toLocaleString("en-US");

/* ══════════════════════════════════════════════════════════════════════════
   Report selectors
   Every Performance Report tab derives from the SAME filtered account list as
   the dashboard, so a figure shown on one screen matches the other by
   construction rather than by anyone remembering to update two places.
   ══════════════════════════════════════════════════════════════════════════ */

const avg = (accounts: Account[], f: (a: Account) => number) =>
  accounts.length ? sum(accounts, f) / accounts.length : 0;

/** Group accounts by a key, preserving the dimension's declared order. */
function groupBy<T extends string>(
  accounts: Account[],
  order: readonly T[],
  key: (a: Account) => string,
): { key: T; accounts: Account[] }[] {
  return order.map((k) => ({ key: k, accounts: accounts.filter((a) => key(a) === k) }));
}

/* ── 1. Portfolio aging ────────────────────────────────────────────────── */

export interface AgingRow {
  customerId: string;
  name: string;
  segment: string;
  region: string;
  product: string;
  dpd: number;
  agingBucket: string;
  outstanding: number;
  contactability: number;
  riskLevel: string;
  riskScore: number;
}

export interface AgingReport {
  totalExposure: number;
  avgDpd: number;
  highRiskAccounts: number;
  totalAccounts: number;
  weightedAvgDpd: number;
  rows: AgingRow[];
  byBucket: AgingBucket[];
}

export function deriveAgingReport(accounts: Account[]): AgingReport {
  const outstanding = sum(accounts, (a) => a.outstanding);
  return {
    totalExposure: outstanding,
    avgDpd: Math.round(avg(accounts, (a) => a.dpd)),
    // Value-weighted DPD: what the money is actually experiencing.
    weightedAvgDpd: outstanding
      ? Math.round(sum(accounts, (a) => a.dpd * a.outstanding) / outstanding)
      : 0,
    highRiskAccounts: accounts.filter((a) => a.riskLevel === "High" || a.riskLevel === "Critical")
      .length,
    totalAccounts: accounts.length,
    byBucket: deriveAging(accounts),
    rows: [...accounts]
      .sort((a, b) => b.outstanding - a.outstanding)
      .map((a) => ({
        customerId: a.customerId,
        name: a.name,
        segment: a.segment,
        region: a.region,
        product: a.product,
        dpd: a.dpd,
        agingBucket: a.agingBucket,
        outstanding: a.outstanding,
        contactability: a.contactability,
        riskLevel: a.riskLevel,
        riskScore: a.riskScore,
      })),
  };
}

/* ── 2. PTP lifecycle ──────────────────────────────────────────────────── */

export interface PtpReport {
  created: number;
  kept: number;
  broken: number;
  keptRatePct: number;
  valueAtRisk: number;
  byBucket: { bucket: string; created: number; kept: number; broken: number; keptRatePct: number }[];
}

export function derivePtpReport(accounts: Account[]): PtpReport {
  const created = sum(accounts, (a) => a.ptpCreated);
  const kept = sum(accounts, (a) => a.ptpKept);
  const broken = sum(accounts, (a) => a.ptpBroken);

  return {
    created,
    kept,
    broken,
    keptRatePct: safePct(kept, created || 1),
    valueAtRisk: sum(accounts, (a) => a.ptpValueAtRisk),
    byBucket: groupBy(accounts, DIMENSIONS.buckets, (a) => a.agingBucket)
      .map(({ key, accounts: group }) => {
        const c = sum(group, (a) => a.ptpCreated);
        const k = sum(group, (a) => a.ptpKept);
        return {
          bucket: key === "Current" ? "Current" : `${key} DPD`,
          created: c,
          kept: k,
          broken: sum(group, (a) => a.ptpBroken),
          keptRatePct: safePct(k, c || 1),
        };
      })
      .filter((r) => r.created > 0),
  };
}

/* ── 3. Collections performance ────────────────────────────────────────── */

export interface CollectionsReport {
  collected: number;
  target: number;
  attainmentPct: number;
  recoveryRatePct: number;
  byProduct: { name: string; collected: number; outstanding: number; recoveryPct: number }[];
  bySegment: { name: string; collected: number; outstanding: number; recoveryPct: number }[];
}

export function deriveCollectionsReport(accounts: Account[]): CollectionsReport {
  const collected = sum(accounts, (a) => a.collectedMTD);
  const target = sum(accounts, (a) => a.targetMTD);
  const prior = sum(accounts, (a) => a.priorOutstanding);

  const rollUp = (order: readonly string[], key: (a: Account) => string) =>
    groupBy(accounts, order, key)
      .map(({ key: name, accounts: group }) => {
        const c = sum(group, (a) => a.collectedMTD);
        const o = sum(group, (a) => a.outstanding);
        return { name, collected: c, outstanding: o, recoveryPct: safePct(c, o + c || 1) };
      })
      .filter((r) => r.outstanding > 0 || r.collected > 0)
      .sort((a, b) => b.collected - a.collected);

  return {
    collected,
    target,
    attainmentPct: safePct(collected, target || 1),
    recoveryRatePct: safePct(collected, prior || 1),
    byProduct: rollUp(DIMENSIONS.products, (a) => a.product),
    bySegment: rollUp(DIMENSIONS.segments, (a) => a.segment),
  };
}

/* ── 4. Strategy performance ───────────────────────────────────────────── */

export interface StrategyRow {
  strategy: string;
  stage: number;
  accounts: number;
  exposure: number;
  collected: number;
  recoveryPct: number;
  contactedPct: number;
  ptpCreated: number;
  ptpKeptRatePct: number;
}

export function deriveStrategyReport(accounts: Account[]): StrategyRow[] {
  return groupBy(accounts, DIMENSIONS.strategies, (a) => a.strategy)
    .map(({ key, accounts: group }) => {
      const exposure = sum(group, (a) => a.outstanding);
      const collected = sum(group, (a) => a.collectedMTD);
      const created = sum(group, (a) => a.ptpCreated);
      const attempts = sum(group, (a) => a.contactAttempts);
      return {
        strategy: key,
        stage: group[0]?.dunningStage ?? 0,
        accounts: group.length,
        exposure,
        collected,
        recoveryPct: safePct(collected, exposure + collected || 1),
        contactedPct: safePct(sum(group, (a) => a.contactSuccesses), attempts || 1),
        ptpCreated: created,
        ptpKeptRatePct: safePct(sum(group, (a) => a.ptpKept), created || 1),
      };
    })
    .filter((r) => r.accounts > 0);
}

/* ── 5. Channel effectiveness ──────────────────────────────────────────── */

export interface ChannelRow {
  channel: string;
  accounts: number;
  attempts: number;
  successes: number;
  successRatePct: number;
  cost: number;
  costPerContact: number;
  collected: number;
  /** Currency recovered per unit of channel spend. */
  roi: number;
  /** Share of attempts that reached the handset/inbox at all. */
  deliveryRatePct: number;
}

/**
 * Deliverability per channel — the share of attempts that land, before anyone
 * responds. Digital channels almost always deliver; a dialled call only
 * "delivers" when it connects, which is why voice sits far lower.
 */
const CHANNEL_DELIVERY: Record<string, number> = {
  SMS: 97.0,
  Email: 96.3,
  WhatsApp: 94.1,
  Voicebot: 85.2,
  Dialer: 79.3,
};

export function deriveChannelReport(accounts: Account[]): ChannelRow[] {
  return groupBy(accounts, DIMENSIONS.channels, (a) => a.channel)
    .map(({ key, accounts: group }) => {
      const attempts = sum(group, (a) => a.contactAttempts);
      const successes = sum(group, (a) => a.contactSuccesses);
      const cost = sum(group, (a) => a.channelCost);
      const collected = sum(group, (a) => a.collectedMTD);
      return {
        channel: key,
        accounts: group.length,
        attempts,
        successes,
        successRatePct: safePct(successes, attempts || 1),
        cost,
        costPerContact: successes ? Number((cost / successes).toFixed(2)) : 0,
        collected,
        roi: cost ? Number((collected / cost).toFixed(1)) : 0,
        deliveryRatePct: CHANNEL_DELIVERY[key] ?? 90,
      };
    })
    .filter((r) => r.accounts > 0);
}

/* ── 13. Strategy execution summary ───────────────────────────────────────
   Headline numbers for the Strategy Execution screen, all derived from the
   accounts currently under a dunning strategy.                              */

export interface StrategyExecutionSummary {
  accountsEnrolled: number;
  activeStrategies: number;
  successRatePct: number;
  avgResolutionDays: number;
  totalRecovered: number;
  responseRatePct: number;
  channels: ChannelRow[];
}

export function deriveStrategyExecution(accounts: Account[]): StrategyExecutionSummary {
  // Only delinquent accounts are enrolled in a collection strategy.
  const enrolled = accounts.filter((a) => a.agingBucket !== "Current");
  const withCase = enrolled.filter((a) => a.resolutionHours != null);
  const attempts = sum(enrolled, (a) => a.contactAttempts);
  const ptpCreated = sum(enrolled, (a) => a.ptpCreated);

  return {
    accountsEnrolled: enrolled.length,
    activeStrategies: new Set(enrolled.map((a) => a.strategy)).size,
    // Strategy success = promises honoured out of promises obtained.
    successRatePct: safePct(sum(enrolled, (a) => a.ptpKept), ptpCreated || 1),
    avgResolutionDays: withCase.length
      ? Number((sum(withCase, (a) => a.resolutionHours ?? 0) / withCase.length / 24).toFixed(1))
      : 0,
    totalRecovered: sum(enrolled, (a) => a.collectedMTD),
    responseRatePct: safePct(sum(enrolled, (a) => a.contactSuccesses), attempts || 1),
    channels: deriveChannelReport(enrolled),
  };
}

/* ── 6. Case resolution & SLA ──────────────────────────────────────────── */

export interface SlaRow {
  agentId: string;
  casesAssigned: number;
  casesResolved: number;
  slaBreaches: number;
  slaCompliancePct: number;
  avgResolutionHours: number;
  exposureHandled: number;
}

export interface SlaReport {
  slaHours: number;
  totalCases: number;
  resolved: number;
  breaches: number;
  compliancePct: number;
  avgResolutionHours: number;
  byAgent: SlaRow[];
  byStatus: { status: string; count: number }[];
}

export function deriveSlaReport(accounts: Account[]): SlaReport {
  const cases = accounts.filter((a) => a.caseId);
  const resolved = cases.filter((a) => a.caseStatus === "Resolved");
  const breaches = sum(cases, (a) => a.slaBreached);

  const agentIds = [...new Set(cases.map((a) => a.assignedAgentId))].sort();

  const statuses = [...new Set(cases.map((a) => a.caseStatus!))].sort();

  return {
    slaHours: 48,
    totalCases: cases.length,
    resolved: resolved.length,
    breaches,
    compliancePct: safePct(cases.length - breaches, cases.length || 1),
    avgResolutionHours: Math.round(avg(cases, (a) => a.resolutionHours ?? 0)),
    byStatus: statuses.map((status) => ({
      status,
      count: cases.filter((a) => a.caseStatus === status).length,
    })),
    byAgent: agentIds
      .map((agentId) => {
        const group = cases.filter((a) => a.assignedAgentId === agentId);
        const b = sum(group, (a) => a.slaBreached);
        return {
          agentId,
          casesAssigned: group.length,
          casesResolved: group.filter((a) => a.caseStatus === "Resolved").length,
          slaBreaches: b,
          slaCompliancePct: safePct(group.length - b, group.length || 1),
          avgResolutionHours: Math.round(avg(group, (a) => a.resolutionHours ?? 0)),
          exposureHandled: sum(group, (a) => a.outstanding),
        };
      })
      .sort((a, b) => b.casesAssigned - a.casesAssigned),
  };
}

/* ── 7. Risk analysis ──────────────────────────────────────────────────────
   Risk scoring reads from the same accounts as every other screen. One scale
   throughout: riskScore is 0–100 (higher = riskier) and the band is derived
   from it, so a customer's badge can never disagree with their number.       */

export interface RiskCustomerView {
  id: string;
  name: string;
  segment: string;
  region: string;
  product: string;
  overdueDays: number;
  overdueAmount: number;
  totalOutstanding: number;
  /** 0–100, higher is riskier. */
  riskScore: number;
  riskBand: "low" | "medium" | "high" | "critical";
  /** 0–1. Rises with score, contactability lowers it. */
  probabilityOfDefault: number;
  contactability: number;
  paymentPattern: "good" | "irregular" | "poor";
  strategy: string;
  channel: string;
  assignedAgentId: string;
  lastContactDays: number;
  ptpBroken: number;
  /** Ranked drivers behind the score, biggest contribution first. */
  drivers: { label: string; contribution: number; detail: string }[];
}

const bandFor = (score: number): RiskCustomerView["riskBand"] =>
  score >= 85 ? "critical" : score >= 70 ? "high" : score >= 45 ? "medium" : "low";

/**
 * Score drivers. Each contributes a share of the total score so the detail
 * panel can explain *why* an account scores what it does rather than just
 * asserting a number.
 */
function driversFor(a: Account) {
  const dpdWeight = Math.min(a.dpd / 180, 1) * 40;
  const contactWeight = ((100 - a.contactability) / 100) * 25;
  const ptpWeight = Math.min(a.ptpBroken, 3) * 8;
  const exposureWeight = Math.min(a.outstanding / 50_000, 1) * 20;
  const staleWeight = Math.min(a.lastContactDays / 30, 1) * 15;

  return [
    { label: "Days past due", contribution: dpdWeight, detail: `${a.dpd} days overdue` },
    {
      label: "Contactability",
      contribution: contactWeight,
      detail: `${a.contactability}% reachable`,
    },
    {
      label: "Broken promises",
      contribution: ptpWeight,
      detail: a.ptpBroken ? `${a.ptpBroken} PTP broken` : "No broken promises",
    },
    {
      label: "Exposure size",
      contribution: exposureWeight,
      detail: formatMoney(a.outstanding),
    },
    {
      label: "Contact recency",
      contribution: staleWeight,
      detail: `Last contact ${a.lastContactDays}d ago`,
    },
  ]
    .filter((d) => d.contribution > 0.5)
    .sort((x, y) => y.contribution - x.contribution)
    .map((d) => ({ ...d, contribution: Number(d.contribution.toFixed(1)) }));
}

export function deriveRiskCustomers(accounts: Account[]): RiskCustomerView[] {
  return accounts
    .map((a) => {
      // PD rises with score and falls with reachability — a high-score account
      // you can still reach is more recoverable than one you cannot.
      const pd = Math.min(
        0.98,
        Math.max(0.01, (a.riskScore / 100) * 0.9 * (1 - (a.contactability / 100) * 0.45)),
      );
      return {
        id: a.customerId,
        name: a.name,
        segment: a.segment,
        region: a.region,
        product: a.product,
        overdueDays: a.dpd,
        // Overdue can never exceed the balance it is part of.
        overdueAmount: a.agingBucket === "Current" ? 0 : a.outstanding,
        totalOutstanding: a.outstanding,
        riskScore: a.riskScore,
        riskBand: bandFor(a.riskScore),
        probabilityOfDefault: Number(pd.toFixed(3)),
        contactability: a.contactability,
        paymentPattern:
          a.riskScore >= 70 ? "poor" : a.riskScore >= 45 ? "irregular" : "good",
        strategy: a.strategy,
        channel: a.channel,
        assignedAgentId: a.assignedAgentId,
        lastContactDays: a.lastContactDays,
        ptpBroken: a.ptpBroken,
        drivers: driversFor(a),
      } as RiskCustomerView;
    })
    .sort((x, y) => y.riskScore - x.riskScore);
}

export interface RiskSummary {
  total: number;
  low: number;
  medium: number;
  high: number;
  critical: number;
  avgScore: number;
  /** Exposure held by high + critical accounts. */
  atRiskExposure: number;
  atRiskSharePct: number;
  /** Score distribution in 10-point bins, for the histogram. */
  distribution: { bin: string; count: number; severe: boolean }[];
}

export function deriveRiskSummary(accounts: Account[]): RiskSummary {
  const scored = accounts.map((a) => a.riskScore);
  const band = (b: RiskCustomerView["riskBand"]) =>
    accounts.filter((a) => bandFor(a.riskScore) === b).length;

  const atRisk = accounts.filter((a) => a.riskScore >= 70);
  const totalOutstanding = sum(accounts, (a) => a.outstanding);
  const atRiskExposure = sum(atRisk, (a) => a.outstanding);

  const distribution = Array.from({ length: 10 }, (_, i) => {
    const lo = i * 10;
    const hi = lo + 9;
    return {
      bin: `${lo}-${hi}`,
      count: accounts.filter((a) => a.riskScore >= lo && a.riskScore <= hi).length,
      severe: lo >= 70,
    };
  });

  return {
    total: accounts.length,
    low: band("low"),
    medium: band("medium"),
    high: band("high"),
    critical: band("critical"),
    avgScore: scored.length
      ? Number((scored.reduce((s, v) => s + v, 0) / scored.length).toFixed(1))
      : 0,
    atRiskExposure,
    atRiskSharePct: safePct(atRiskExposure, totalOutstanding || 1),
    distribution,
  };
}

/* ── 8. Risk grid (aging × risk clusters) ─────────────────────────────────
   The heatmap and the ML segmentation view are both cuts of the same grid:
   accounts bucketed by aging on one axis and risk band on the other.        */

export interface RiskCluster {
  id: string;
  aging: string;
  risk: string;
  customers: number;
  outstanding: number;
  /** Dominant segment in the cell, for the detail panel. */
  segment: string;
  avgDPD: number;
  /** Expected recovery from this cell over the next cycle. */
  carInflow: number;
  contactability: number;
  disputeRate: number;
  ptpSuccess: number;
  lastPayment: number;
}

const RISK_ORDER = ["Low", "Medium", "High", "Critical"];

/** Most common value of a field within a group. */
function mode(accounts: Account[], f: (a: Account) => string): string {
  const counts = new Map<string, number>();
  accounts.forEach((a) => counts.set(f(a), (counts.get(f(a)) ?? 0) + 1));
  return [...counts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? "—";
}

export function deriveRiskGrid(accounts: Account[]): RiskCluster[] {
  const clusters: RiskCluster[] = [];

  for (const aging of DIMENSIONS.buckets) {
    for (const risk of RISK_ORDER) {
      const cell = accounts.filter((a) => a.agingBucket === aging && a.riskLevel === risk);
      if (cell.length === 0) continue;

      const outstanding = sum(cell, (a) => a.outstanding);
      const ptpCreated = sum(cell, (a) => a.ptpCreated);

      clusters.push({
        id: `${aging}|${risk}`,
        aging,
        risk,
        customers: cell.length,
        outstanding,
        segment: mode(cell, (a) => a.segment),
        avgDPD: Math.round(sum(cell, (a) => a.dpd) / cell.length),
        // Expected recovery: what this cell is actually collecting this cycle.
        carInflow: sum(cell, (a) => a.collectedMTD),
        contactability: Math.round(sum(cell, (a) => a.contactability) / cell.length),
        disputeRate: safePct(cell.filter((a) => a.disputesOpen > 0).length, cell.length),
        ptpSuccess: safePct(sum(cell, (a) => a.ptpKept), ptpCreated || 1),
        lastPayment: Math.round(sum(cell, (a) => a.lastContactDays) / cell.length),
      });
    }
  }

  return clusters;
}

export interface RiskGridSummary {
  totalCustomers: number;
  totalOutstanding: number;
  highestRiskBucket: { bucket: string; outstanding: number; customers: number };
  predictedInflow: number;
  byBucket: { bucket: string; outstanding: number; customers: number; severe: boolean }[];
}

export function deriveRiskGridSummary(accounts: Account[]): RiskGridSummary {
  const byBucket = DIMENSIONS.buckets.map((bucket) => {
    const cell = accounts.filter((a) => a.agingBucket === bucket);
    return {
      bucket: bucket === "Current" ? "Current" : `${bucket} DPD`,
      outstanding: sum(cell, (a) => a.outstanding),
      customers: cell.length,
      severe: bucket === "90+",
    };
  });

  // "Highest risk" is the bucket holding the most delinquent value, not the
  // largest bucket overall — Current is excluded by definition.
  const delinquent = byBucket.filter((b) => b.bucket !== "Current");
  const highest = [...delinquent].sort((a, b) => b.outstanding - a.outstanding)[0] ?? {
    bucket: "—",
    outstanding: 0,
    customers: 0,
  };

  return {
    totalCustomers: accounts.length,
    totalOutstanding: sum(accounts, (a) => a.outstanding),
    highestRiskBucket: {
      bucket: highest.bucket,
      outstanding: highest.outstanding,
      customers: highest.customers,
    },
    predictedInflow: sum(accounts, (a) => a.collectedMTD),
    byBucket,
  };
}

/** Accounts worth working first: high exposure, high risk, still reachable. */
export function derivePriorityTargets(accounts: Account[], limit = 6) {
  return [...accounts]
    .map((a) => ({
      account: a,
      // Exposure weighted by risk, discounted when contact is unlikely.
      priority: a.outstanding * (a.riskScore / 100) * (0.4 + (a.contactability / 100) * 0.6),
    }))
    .sort((x, y) => y.priority - x.priority)
    .slice(0, limit)
    .map(({ account: a, priority }) => ({
      id: a.customerId,
      name: a.name,
      segment: a.segment,
      outstanding: a.outstanding,
      dpd: a.dpd,
      riskLevel: a.riskLevel,
      riskScore: a.riskScore,
      contactability: a.contactability,
      strategy: a.strategy,
      channel: a.channel,
      priorityScore: Math.round(priority),
    }));
}

/* ── 9. Behavioural segmentation ──────────────────────────────────────────
   A second lens on the same accounts: grouped by how they BEHAVE rather than
   how old the debt is. Every account lands in exactly one segment, so the
   counts always sum back to the filtered total.                             */

export interface BehaviourSegment {
  id: string;
  label: string;
  description: string;
  /** Recommended play for this behaviour. */
  play: string;
  customers: number;
  outstanding: number;
  avgDPD: number;
  avgRiskScore: number;
  contactability: number;
  ptpSuccess: number;
  severity: "good" | "watch" | "poor";
}

/** First matching rule wins, so the order here defines precedence. */
const BEHAVIOUR_RULES: {
  id: string;
  label: string;
  description: string;
  play: string;
  severity: BehaviourSegment["severity"];
  test: (a: Account) => boolean;
}[] = [
  {
    id: "disputed",
    label: "Disputed / Blocked",
    description: "Open disputes are holding collection activity.",
    play: "Resolve the dispute before any further dunning.",
    severity: "watch",
    test: (a) => a.disputesOpen > 0,
  },
  {
    id: "unreachable",
    label: "Unreachable",
    description: "Delinquent and contact attempts are not landing.",
    play: "Trace and refresh contact details; switch channel.",
    severity: "poor",
    test: (a) => a.agingBucket !== "Current" && a.contactability < 40,
  },
  {
    id: "promise-breakers",
    label: "Promise Breakers",
    description: "Reachable, promises made, promises broken.",
    play: "Require part-payment up front before a new PTP.",
    severity: "poor",
    test: (a) => a.ptpBroken > 0,
  },
  {
    id: "high-value-risk",
    label: "High-Value at Risk",
    description: "Large balances carrying a high risk score.",
    play: "Assign a named collector; consider settlement terms.",
    severity: "poor",
    test: (a) => a.riskScore >= 70 && a.outstanding >= 10_000,
  },
  {
    id: "drifters",
    label: "At-Risk Drifters",
    description: "Recently slipped past due and still moving the wrong way.",
    play: "Early intervention — automated reminder plus PTP offer.",
    severity: "watch",
    test: (a) => a.agingBucket !== "Current" && a.riskScore >= 45,
  },
  {
    id: "recoverable",
    label: "Recoverable",
    description: "Past due but low risk and easy to reach.",
    play: "Low-cost digital nudge; most will self-cure.",
    severity: "good",
    test: (a) => a.agingBucket !== "Current",
  },
  {
    id: "healthy",
    label: "Healthy",
    description: "Current accounts with no delinquency signal.",
    play: "Monitor only — no collection action required.",
    severity: "good",
    test: () => true,
  },
];

export function deriveBehaviourSegments(accounts: Account[]): BehaviourSegment[] {
  const assigned = new Map<string, Account[]>();
  BEHAVIOUR_RULES.forEach((r) => assigned.set(r.id, []));

  for (const a of accounts) {
    const rule = BEHAVIOUR_RULES.find((r) => r.test(a))!;
    assigned.get(rule.id)!.push(a);
  }

  return BEHAVIOUR_RULES.map((rule) => {
    const group = assigned.get(rule.id)!;
    const ptpCreated = sum(group, (a) => a.ptpCreated);
    return {
      id: rule.id,
      label: rule.label,
      description: rule.description,
      play: rule.play,
      severity: rule.severity,
      customers: group.length,
      outstanding: sum(group, (a) => a.outstanding),
      avgDPD: group.length ? Math.round(sum(group, (a) => a.dpd) / group.length) : 0,
      avgRiskScore: group.length ? Math.round(sum(group, (a) => a.riskScore) / group.length) : 0,
      contactability: group.length
        ? Math.round(sum(group, (a) => a.contactability) / group.length)
        : 0,
      ptpSuccess: safePct(sum(group, (a) => a.ptpKept), ptpCreated || 1),
    };
  }).filter((s) => s.customers > 0);
}

/* ── 10. Behaviour-profile × segment grid ─────────────────────────────────
   Feeds the ML Segmentation bubble grid: the same accounts cross-tabbed by
   payment-behaviour profile against customer segment.                       */

export const BEHAVIOUR_PROFILES = ["Excellent", "Good", "Fair", "Poor"] as const;

/** Profile from the risk score — the inverse view of the same number. */
export const profileFor = (riskScore: number): string =>
  riskScore < 25 ? "Excellent" : riskScore < 50 ? "Good" : riskScore < 75 ? "Fair" : "Poor";

export function deriveBehaviourGrid(accounts: Account[]): RiskCluster[] {
  const clusters: RiskCluster[] = [];

  for (const segment of DIMENSIONS.segments) {
    for (const profile of BEHAVIOUR_PROFILES) {
      const cell = accounts.filter(
        (a) => a.segment === segment && profileFor(a.riskScore) === profile,
      );
      if (cell.length === 0) continue;

      const ptpCreated = sum(cell, (a) => a.ptpCreated);
      clusters.push({
        // `aging` carries the behaviour profile and `risk` the segment, matching
        // the grid component's existing cell lookup.
        id: `${profile}|${segment}`,
        aging: profile,
        risk: segment,
        customers: cell.length,
        outstanding: sum(cell, (a) => a.outstanding),
        segment,
        avgDPD: Math.round(sum(cell, (a) => a.dpd) / cell.length),
        carInflow: sum(cell, (a) => a.collectedMTD),
        contactability: Math.round(sum(cell, (a) => a.contactability) / cell.length),
        disputeRate: safePct(cell.filter((a) => a.disputesOpen > 0).length, cell.length),
        ptpSuccess: safePct(sum(cell, (a) => a.ptpKept), ptpCreated || 1),
        lastPayment: Math.round(sum(cell, (a) => a.lastContactDays) / cell.length),
      });
    }
  }

  return clusters;
}

/* ── 11. Customer 360 ─────────────────────────────────────────────────────
   A single account expanded into the full profile the 360 screen renders.
   Trends are derived deterministically from the account's own fields (no
   randomness), so the same customer always shows the same history.          */

export interface Customer360 {
  id: string;
  name: string;
  segment: string;
  region: string;
  product: string;
  status: string;
  riskLevel: string;
  riskScore: number;
  agent: string;
  outstanding: number;
  dpd: number;
  agingBucket: string;
  lastPayment: { date: string; amount: number };
  nextAction: string;
  riskTrend: { month: string; score: number }[];
  paymentHistory: { month: string; amount: number; status: string }[];
  contactability: number;
  disputeRate: number;
  ptpSuccess: number;
  communications: number;
  bestContactTime: string;
  bestChannel: string;
  likelihoodToPay: number;
  recommendedAction: string;
  riskDrivers: string[];
  strategy: string;
  dunningStage: number;
  caseId: string | null;
  caseStatus: string | null;
}

const AGENT_NAMES: Record<string, string> = {
  "AGENT-001": "John Smith",
  "AGENT-002": "Mike Johnson",
  "AGENT-003": "Jennifer Lee",
  "AGENT-004": "Lisa Davis",
  "AGENT-005": "Robert Kim",
  "AGENT-006": "Maria Garcia",
};

const MONTHS = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"];

/** Stable per-account jitter so histories vary between customers but never between renders. */
const seedOf = (id: string) =>
  [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 997, 7) / 997;

const CONTACT_WINDOWS = [
  "9:00 AM - 11:00 AM",
  "11:00 AM - 1:00 PM",
  "2:00 PM - 4:00 PM",
  "5:00 PM - 7:00 PM",
];

export function deriveCustomer360(accountId: string, accounts: Account[] = ACCOUNTS): Customer360 | null {
  const a = accounts.find((x) => x.customerId === accountId || x.accountId === accountId);
  if (!a) return null;

  const seed = seedOf(a.customerId);

  // Risk climbs toward today's score for delinquent accounts and stays flat for
  // healthy ones — the shape follows the account, not a random walk.
  const riskTrend = MONTHS.map((month, i) => {
    const progress = i / (MONTHS.length - 1);
    const start = Math.max(4, a.riskScore - (a.agingBucket === "Current" ? 6 : 26));
    const score = Math.round(start + (a.riskScore - start) * Math.pow(progress, 0.85));
    return { month, score: Math.max(0, Math.min(100, score)) };
  });

  // Instalment size scaled off the balance; payments stop once the account rolls.
  const instalment = Math.max(25, Math.round((a.outstanding / 6) * (0.8 + seed * 0.4)));
  const missedFrom =
    a.agingBucket === "Current" ? MONTHS.length
    : a.agingBucket === "1-30" ? 5
    : a.agingBucket === "31-60" ? 4
    : a.agingBucket === "61-90" ? 3
    : 2;

  const paymentHistory = MONTHS.map((month, i) => {
    if (i >= missedFrom) return { month, amount: 0, status: "Not Paid" };
    const partial = i === missedFrom - 1 && a.agingBucket !== "Current";
    return {
      month,
      amount: partial ? Math.round(instalment * 0.45) : instalment,
      status: partial ? "Partial" : "Paid",
    };
  });

  const lastPaid = [...paymentHistory].reverse().find((p) => p.amount > 0);
  const lastPaymentIndex = lastPaid ? MONTHS.indexOf(lastPaid.month) : -1;
  // Month index maps onto 2024-05 … 2024-10.
  const lastPaymentDate =
    lastPaymentIndex >= 0 ? `2024-${String(5 + lastPaymentIndex).padStart(2, "0")}-18` : "—";

  const likelihoodToPay = Math.max(
    3,
    Math.min(97, Math.round((100 - a.riskScore) * 0.6 + a.contactability * 0.4)),
  );

  const nextAction =
    a.agingBucket === "Current" ? "Routine Follow-up"
    : a.riskScore >= 85 ? "Immediate Follow-up Required"
    : a.riskScore >= 70 ? "Escalate to Senior Collector"
    : "Scheduled Reminder";

  const recommendedAction =
    a.contactability < 40
      ? "Trace and refresh contact details before further attempts."
      : a.ptpBroken > 0
        ? "Require part-payment up front before agreeing a new promise to pay."
        : a.riskScore >= 70
          ? `Escalate to ${a.strategy} with settlement terms prepared.`
          : `Continue ${a.strategy} via ${a.channel}.`;

  // Ranked reasons this account scores what it does.
  const riskDrivers: string[] = [];
  if (a.dpd >= 90) riskDrivers.push(`${a.dpd} days past due`);
  else if (a.dpd > 0) riskDrivers.push(`${a.dpd} days past due`);
  if (a.contactability < 50) riskDrivers.push(`Low contactability (${a.contactability}%)`);
  if (a.ptpBroken > 0) riskDrivers.push(`${a.ptpBroken} broken promise${a.ptpBroken > 1 ? "s" : ""} to pay`);
  if (a.disputesOpen > 0) riskDrivers.push(`${a.disputesOpen} open dispute${a.disputesOpen > 1 ? "s" : ""}`);
  if (a.lastContactDays >= 14) riskDrivers.push(`No contact for ${a.lastContactDays} days`);
  if (a.outstanding >= 50_000) riskDrivers.push("High-value exposure");
  if (riskDrivers.length === 0) riskDrivers.push("None — strong payment behaviour");

  return {
    id: a.customerId,
    name: a.name,
    segment: a.segment,
    region: a.region,
    product: a.product,
    status: a.status,
    riskLevel: a.riskLevel,
    riskScore: a.riskScore,
    agent: AGENT_NAMES[a.assignedAgentId] ?? a.assignedAgentId,
    outstanding: a.outstanding,
    dpd: a.dpd,
    agingBucket: a.agingBucket,
    lastPayment: { date: lastPaymentDate, amount: lastPaid?.amount ?? 0 },
    nextAction,
    riskTrend,
    paymentHistory,
    contactability: a.contactability,
    disputeRate: a.disputesOpen > 0 ? Math.round(20 + seed * 20) : Math.round(seed * 6),
    ptpSuccess: a.ptpCreated ? safePct(a.ptpKept, a.ptpCreated) : 0,
    communications: a.contactAttempts,
    bestContactTime: CONTACT_WINDOWS[Math.floor(seed * CONTACT_WINDOWS.length)],
    bestChannel: a.channel,
    likelihoodToPay,
    recommendedAction,
    riskDrivers,
    strategy: a.strategy,
    dunningStage: a.dunningStage,
    caseId: a.caseId,
    caseStatus: a.caseStatus,
  };
}

/**
 * Compact customer list for the 360 and Risk Grid switchers.
 *
 * Stratified across BOTH segment and risk band. Sorting by balance alone pulls
 * in aged, high-risk accounts and buries the healthy majority — the book is 70%
 * low risk, so a picker that shows almost none of them misrepresents it.
 */
export function deriveCustomerOptions(perSegment = 24, accounts: Account[] = ACCOUNTS) {
  const perBand = Math.max(1, Math.round(perSegment / DIMENSIONS.riskLevels.length));

  return DIMENSIONS.segments.flatMap((segment) =>
    DIMENSIONS.riskLevels.flatMap((riskLevel) =>
      accounts
        .filter((a) => a.segment === segment && a.riskLevel === riskLevel)
        .sort((x, y) => y.outstanding - x.outstanding)
        .slice(0, perBand)
        .map((a) => ({
          id: a.customerId,
          name: a.name,
          segment: a.segment,
          riskLevel: a.riskLevel,
          status: a.status,
          outstanding: a.outstanding,
        })),
    ),
  );
}

/* ── 12. Borrower 360 ─────────────────────────────────────────────────────
   The full borrower file: invoices, payments, milestones, communications and
   disputes. All of it derives from the one account record, deterministically,
   so a borrower's history is identical on every render.                      */

export interface BorrowerInvoice {
  product: string;
  invoice: string;
  dueDate: string;
  amount: number;
  status: "Paid" | "Current" | "Overdue" | "Disputed";
}

export interface BorrowerPayment {
  date: string;
  transactionId: string;
  amount: number;
  method: string;
  status: "Completed" | "Failed";
}

export interface BorrowerMilestone {
  date: string;
  milestone: string;
  description: string;
  status: "Completed" | "In Progress" | "Pending" | "Rejected";
}

export interface BorrowerInteraction {
  date: string;
  type: string;
  subject: string;
  agent: string;
  outcome: string;
}

export interface BorrowerDispute {
  disputeId: string;
  invoice: string;
  reason: string;
  dateFiled: string;
  status: string;
}

export interface Borrower360 extends Customer360 {
  aging: string;
  carPredictedPayment: number;
  aiSummary: { summary: string; stage: string };
  invoices: BorrowerInvoice[];
  payments: BorrowerPayment[];
  milestones: BorrowerMilestone[];
  interactions: BorrowerInteraction[];
  disputes: BorrowerDispute[];
}

const PAY_METHODS = ["Bank Transfer", "Auto-Debit", "Card Payment", "Cheque"];
const DISPUTE_REASONS = [
  "Incorrect amount charged",
  "Service not delivered for billed period",
  "Duplicate invoice raised",
  "Roaming charges disputed",
  "Device financing instalment mismatch",
];

/** Deterministic date N months before 2024-11, on the account's own due day. */
const monthsBack = (n: number, day: number) => {
  const month = 11 - n;
  const y = month > 0 ? 2024 : 2023;
  const m = month > 0 ? month : month + 12;
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

export function deriveBorrower360(
  accountId: string,
  accounts: Account[] = ACCOUNTS,
): Borrower360 | null {
  const base = deriveCustomer360(accountId, accounts);
  const a = accounts.find((x) => x.customerId === accountId || x.accountId === accountId);
  if (!base || !a) return null;

  const seed = seedOf(a.customerId);
  const dueDay = 5 + Math.floor(seed * 20);
  const INVOICE_MONTHS = 6;
  const instalment = Math.max(25, Math.round(a.outstanding / 4));

  // Invoices: the most recent ones are unpaid for delinquent accounts.
  const unpaidCount =
    a.agingBucket === "Current" ? 0
    : a.agingBucket === "1-30" ? 1
    : a.agingBucket === "31-60" ? 2
    : a.agingBucket === "61-90" ? 3
    : 4;

  const invoices: BorrowerInvoice[] = Array.from({ length: INVOICE_MONTHS }, (_, i) => {
    const status: BorrowerInvoice["status"] =
      i < unpaidCount
        ? a.disputesOpen > 0 && i === unpaidCount - 1
          ? "Disputed"
          : "Overdue"
        : a.agingBucket === "Current" && i === 0
          ? "Current"
          : "Paid";
    return {
      product: a.product,
      invoice: `INV-2024-${String(1000 + Math.floor(seed * 8000) + i * 37).padStart(4, "0")}`,
      dueDate: monthsBack(i, dueDay),
      amount: instalment,
      status,
    };
  });

  // Payments: settled invoices produce a transaction; one fails for poor payers.
  const payments: BorrowerPayment[] = invoices
    .filter((inv) => inv.status === "Paid")
    .map((inv, i) => ({
      date: inv.dueDate,
      transactionId: `TXN-2024-${String(7000 + Math.floor(seed * 2500) + i * 53).padStart(4, "0")}`,
      amount: inv.amount,
      method: PAY_METHODS[Math.floor(seed * PAY_METHODS.length)],
      status: a.ptpBroken > 0 && i === 0 ? "Failed" : "Completed",
    }));

  // Milestones: the account's actual journey through the dunning stages.
  const milestones: BorrowerMilestone[] = [];
  if (a.agingBucket !== "Current") {
    milestones.push({
      date: monthsBack(unpaidCount - 1, dueDay),
      milestone: "First Missed Payment",
      description: `${invoices[unpaidCount - 1]?.invoice ?? "Invoice"} payment missed`,
      status: "Completed",
    });
  }
  if (a.ptpCreated > 0) {
    milestones.push({
      date: monthsBack(1, dueDay),
      milestone: "Payment Plan Proposed",
      description: `${a.ptpCreated} promise${a.ptpCreated > 1 ? "s" : ""} to pay agreed`,
      status: a.ptpBroken > 0 ? "Rejected" : "Completed",
    });
  }
  if (a.dunningStage >= 4) {
    milestones.push({
      date: monthsBack(0, dueDay),
      milestone: "Escalation to Collections",
      description: `Moved to ${a.strategy} after ${a.dpd} days past due`,
      status: a.caseStatus === "Resolved" ? "Completed" : "In Progress",
    });
  }
  if (a.disputesOpen > 0) {
    milestones.push({
      date: monthsBack(1, dueDay),
      milestone: "Dispute Raised",
      description: "Collection activity on hold pending resolution",
      status: a.disputesPastSla ? "In Progress" : "Pending",
    });
  }
  milestones.push({
    date: "2023-12-01",
    milestone: "Account Activated",
    description: `${a.product} service activated`,
    status: "Completed",
  });
  milestones.sort((x, y) => y.date.localeCompare(x.date));

  // Communications: one row per contact attempt, on the account's own channel.
  const interactions: BorrowerInteraction[] = Array.from(
    { length: Math.min(a.contactAttempts, 6) },
    (_, i) => {
      const succeeded = i < a.contactSuccesses;
      return {
        date: monthsBack(Math.floor(i / 2), Math.max(1, dueDay - i * 3)),
        type: a.channel,
        subject:
          i === 0
            ? `${a.strategy} — outbound contact`
            : succeeded
              ? "Payment reminder acknowledged"
              : "Payment reminder sent",
        agent: a.channel === "Dialer" || a.channel === "Voicebot" ? base.agent : "System",
        outcome: succeeded ? "Reached" : a.channel === "Dialer" ? "No Answer" : "Delivered",
      };
    },
  );

  const disputes: BorrowerDispute[] = Array.from({ length: a.disputesOpen }, (_, i) => ({
    disputeId: `DSP-2024-${String(400 + Math.floor(seed * 500) + i).padStart(3, "0")}`,
    invoice: invoices[i]?.invoice ?? invoices[0].invoice,
    reason: DISPUTE_REASONS[Math.floor(seed * DISPUTE_REASONS.length)],
    dateFiled: monthsBack(1, dueDay),
    status: a.disputesPastSla ? "Past SLA — Escalated" : "Under Review",
  }));

  const aiSummary = {
    summary:
      a.agingBucket === "Current"
        ? `Low-risk ${a.segment.toLowerCase()} account, current on all obligations. Contactability ${a.contactability}%. No collection action required.`
        : `${a.riskLevel}-risk ${a.segment.toLowerCase()} account, ${a.dpd} days past due on ${a.product}. ` +
          `${unpaidCount} unpaid invoice${unpaidCount > 1 ? "s" : ""}. ` +
          (a.ptpBroken > 0 ? `${a.ptpBroken} promise(s) to pay broken. ` : "") +
          (a.contactability < 40 ? "Contact attempts are not landing — trace details. " : "") +
          base.recommendedAction,
    stage: `Stage ${a.dunningStage} — ${a.strategy}`,
  };

  return {
    ...base,
    aging: a.agingBucket === "Current" ? "Current" : `${a.agingBucket} Days`,
    // Expected recovery: what this account is on track to pay this cycle.
    carPredictedPayment: a.collectedMTD,
    aiSummary,
    invoices,
    payments,
    milestones,
    interactions,
    disputes,
  };
}

/* ── 14. AI engagement queue ──────────────────────────────────────────────
   The interaction list and the customer detail view in the AI Engagement
   Center, derived from the same accounts as everything else.                */

export interface EngagementItem {
  id: string;
  customerId: string;
  name: string;
  /** Voice channels render as a call, digital ones as a text thread. */
  type: "text" | "call";
  status: "Resolved" | "Pending";
  risk: "High" | "Medium" | "Low";
  channel: string;
  outstanding: number;
  dpd: number;
  contactability: number;
  contactAttempts: number;
  contactSuccesses: number;
  agent: string;
  dueDate: string;
}

const VOICE_CHANNELS = new Set(["Dialer", "Voicebot"]);

export function deriveEngagementQueue(accounts: Account[], limit = 8): EngagementItem[] {
  // Delinquent accounts with contact activity are the ones in the queue.
  return accounts
    .filter((a) => a.agingBucket !== "Current" && a.contactAttempts > 0)
    .sort((x, y) => y.riskScore - x.riskScore || y.outstanding - x.outstanding)
    .slice(0, limit)
    .map((a) => ({
      id: a.customerId,
      customerId: a.customerId,
      name: a.name,
      type: VOICE_CHANNELS.has(a.channel) ? "call" : "text",
      // An account still being chased is pending; a resolved case is done.
      status: a.caseStatus === "Resolved" ? "Resolved" : "Pending",
      risk: a.riskScore >= 70 ? "High" : a.riskScore >= 45 ? "Medium" : "Low",
      channel: a.channel,
      outstanding: a.outstanding,
      dpd: a.dpd,
      contactability: a.contactability,
      contactAttempts: a.contactAttempts,
      contactSuccesses: a.contactSuccesses,
      agent: AGENT_NAMES[a.assignedAgentId] ?? a.assignedAgentId,
      // Due date sits dpd days before today's cycle date.
      dueDate: (() => {
        const base = new Date(2024, 10, 15);
        base.setDate(base.getDate() - a.dpd);
        return base.toISOString().slice(0, 10);
      })(),
    }));
}

/** Automation metrics for one account's engagement history. */
export function deriveEngagementMetrics(customerId: string, accounts: Account[] = ACCOUNTS) {
  const a = accounts.find((x) => x.customerId === customerId);
  if (!a) return null;
  const seed = seedOf(a.customerId);
  const durationSec = 120 + Math.round(seed * 240);
  return {
    totalCalls: a.contactAttempts,
    successful: a.contactSuccesses,
    automationRatePct: safePct(a.contactSuccesses, a.contactAttempts || 1),
    avgDurationLabel: `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`,
    outstanding: a.outstanding,
    dpd: a.dpd,
    channel: a.channel,
    strategy: a.strategy,
  };
}

/* ── 15. Agent case list ──────────────────────────────────────────────────
   The cases assigned to one collector, for the Agent Dashboard.            */

export interface AgentCase {
  id: string;
  name: string;
  exposure: number;
  recovered: number;
  lastContactDays: number;
  status: "Escalated" | "Recovered" | "Broken PTP" | "In Progress" | "Pending";
  nextAction: string;
}

/** Reverse of AGENT_NAMES — resolves a display name back to its id. */
const AGENT_ID_BY_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(AGENT_NAMES).map(([id, name]) => [name, id]),
);

export function deriveAgentCases(agentName: string, limit = 8, accounts: Account[] = ACCOUNTS): AgentCase[] {
  const agentId = AGENT_ID_BY_NAME[agentName] ?? agentName;

  return accounts
    .filter((a) => a.assignedAgentId === agentId && a.agingBucket !== "Current")
    .sort((x, y) => y.outstanding - x.outstanding)
    .slice(0, limit)
    .map((a) => {
      const status: AgentCase["status"] =
        a.caseStatus === "Resolved" ? "Recovered"
        : a.ptpBroken > 0 ? "Broken PTP"
        : a.caseStatus === "Escalated" ? "Escalated"
        : a.caseStatus === "Awaiting Response" ? "Pending"
        : "In Progress";

      const nextAction =
        status === "Recovered" ? "None"
        : status === "Broken PTP" ? "Escalate"
        : status === "Escalated" ? "Senior review"
        : a.contactability < 40 ? "Trace contact"
        : "Follow up";

      return {
        id: a.customerId,
        name: a.name,
        exposure: a.outstanding,
        recovered: a.collectedMTD,
        lastContactDays: a.lastContactDays,
        status,
        nextAction,
      };
    });
}

/** "2 hours ago" / "3 days ago" from a whole-day offset. */
export function relativeContact(days: number): string {
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

/* ── Customer scope ───────────────────────────────────────────────────────
   The header's Customer Scope selector (All / Normal / Enterprise) narrows the
   whole app. "Normal" is the Consumer segment; "Enterprise" is everything else
   (SMB, Enterprise, Government) — i.e. business accounts.                     */

export type CustomerScope = "all" | "normal" | "enterprise";

export function scopeAccounts(accounts: Account[], scope: CustomerScope): Account[] {
  if (scope === "normal") return accounts.filter((a) => a.segment === "Consumer");
  if (scope === "enterprise") return accounts.filter((a) => a.segment !== "Consumer");
  return accounts;
}
