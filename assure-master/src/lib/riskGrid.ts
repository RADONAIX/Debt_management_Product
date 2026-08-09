/**
 * Risk Grid Analysis API. Every widget takes the same filter object, so
 * clicking a matrix cell can narrow the whole page at once.
 */

import { apiFetch } from "./api";

export interface RiskGridFilters {
  dateFrom?: string;
  dateTo?: string;
  customerType?: string;
  riskLevel?: string;
  dpdBucket?: string;
  region?: string;
  accountStatus?: string;
  strategy?: string;
  behaviour?: string;
}

export interface KpiSummary {
  portfolioHealth: number;
  portfolioHealthTrend: number;
  totalOutstanding: number;
  consumerOutstanding: number;
  enterpriseOutstanding: number;
  expectedRecovery30d: number;
  expectedRecoveryPct: number;
  highRiskAccounts: number;
  highRiskOutstanding: number;
  avgRecoveryProbability: number;
  totalAccounts: number;
  totalCustomers: number;
}

export interface MatrixCell {
  riskLevel: string;
  dpdBucket: string;
  accounts: number;
  customers: number;
  outstanding: number;
  avgRecovery: number;
}

export interface BehaviourSegment {
  profile: string;
  accounts: number;
  outstanding: number;
  avgRecovery: number;
  avgRisk: number;
  share: number;
}

export interface StrategyRow {
  strategy: string;
  code: string | null;
  accounts: number;
  outstanding: number;
  collected90d: number;
  recoveryRate: number;
  avgRecoveryProbability: number;
}

export interface MigrationCell {
  fromBand: string;
  toBand: string;
  accounts: number;
  outstanding: number;
  direction: "improved" | "stable" | "deteriorated";
}

export interface RiskDriver {
  driver: string;
  avgScore: number;
  weightPct: number;
  contribution: number;
  accountsAffected: number;
}

export interface DistributionBand {
  riskLevel: string;
  accounts: number;
  customers: number;
  outstanding: number;
  sharePct: number;
  exposurePct: number;
  avgDpd: number;
  avgRecovery: number;
}

export interface Recommendation {
  action: string;
  reason: string;
  channels: string[];
  coverage: number;
  outstanding: number;
}

export interface FunnelStage {
  stage: string;
  accounts: number;
  outstanding: number;
  conversionPct: number;
  ofPortfolioPct: number;
}

export interface PriorityTarget {
  rank: number;
  customerId: string;
  customerName: string;
  customerType: string;
  accountCode: string;
  subscriberNo: string | null;
  outstanding: number;
  dpd: number;
  riskLevel: string;
  behaviourProfile: string;
  recoveryProbability: number;
  recommendedStrategy: string;
  lastContact: string | null;
  nextAction: string | null;
  priorityScore: number;
}

export interface EnterpriseNode {
  level: string;
  id: string;
  name: string;
  parentId: string | null;
  accounts: number;
  outstanding: number;
  avgDpd: number;
  riskLevel: string;
  recoveryProbability: number;
}

export interface FilterOptions {
  customerTypes: string[];
  riskLevels: string[];
  dpdBuckets: string[];
  regions: string[];
  accountStatuses: string[];
  strategies: string[];
  behaviours: string[];
}

const qs = (f: RiskGridFilters, extra: Record<string, string | number | undefined> = {}) => {
  const p = new URLSearchParams();
  Object.entries({ ...f, ...extra }).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") p.append(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const getRiskGridOptions = () => apiFetch<FilterOptions>("/risk-grid/options");
export const getRiskGridSummary = (f: RiskGridFilters) =>
  apiFetch<KpiSummary>(`/risk-grid/summary${qs(f)}`);
export const getRiskGridMatrix = (f: RiskGridFilters) =>
  apiFetch<MatrixCell[]>(`/risk-grid/matrix${qs(f)}`);
export const getRiskGridBehaviour = (f: RiskGridFilters) =>
  apiFetch<BehaviourSegment[]>(`/risk-grid/customer-behaviour${qs(f)}`);
export const getRiskGridStrategies = (f: RiskGridFilters) =>
  apiFetch<StrategyRow[]>(`/risk-grid/strategies${qs(f)}`);
export const getRiskGridMigration = (f: RiskGridFilters) =>
  apiFetch<MigrationCell[]>(`/risk-grid/migration${qs(f)}`);
export const getRiskGridDrivers = (f: RiskGridFilters) =>
  apiFetch<RiskDriver[]>(`/risk-grid/drivers${qs(f)}`);
export const getRiskGridDistribution = (f: RiskGridFilters) =>
  apiFetch<DistributionBand[]>(`/risk-grid/distribution${qs(f)}`);
export const getRiskGridRecommendation = (f: RiskGridFilters) =>
  apiFetch<Recommendation>(`/risk-grid/recommendation${qs(f)}`);
export const getRiskGridFunnel = (f: RiskGridFilters) =>
  apiFetch<FunnelStage[]>(`/risk-grid/funnel${qs(f)}`);
export const getRiskGridTargets = (f: RiskGridFilters, search?: string, limit = 10, offset = 0) =>
  apiFetch<{ rows: PriorityTarget[]; total: number }>(
    `/risk-grid/priority-targets${qs(f, { search, limit, offset })}`,
  );
export const getRiskGridEnterprise = (f: RiskGridFilters, company?: string) =>
  apiFetch<EnterpriseNode[]>(`/risk-grid/enterprise-exposure${qs(f, { company })}`);
