/**
 * Strategy performance API.
 *
 * Measures that are only meaningful about a strategy — whether it beats leaving
 * the account alone, what it costs to run, whether it is aimed at the right
 * accounts — rather than another restatement of how the portfolio is doing.
 */

import { apiFetch } from "./api";

export interface StrategySummary {
  activeStrategies: number;
  coveredAccounts: number;
  uncoveredAccounts: number;
  coveredValue: number;
  uncoveredValue: number;
  coveragePct: number;
  uncoveredAvgDpd: number;
  recoveryRate: number;
  controlRate: number;
  liftPct: number;
  collected: number;
  touchCost: number;
  costPer100: number;
  touches: number;
  responseRate: number;
  promises: number;
  promiseKeptRate: number;
  escalationRate: number;
  routingAccuracy: number;
  offTarget: number;
}

export interface StrategyPerformance {
  strategyId: string;
  name: string;
  status: string;
  version: string | null;
  accounts: number;
  liveAccounts: number;
  outstanding: number;
  collected: number;
  recoveryRate: number;
  /** Null when no unmanaged account of the same age exists to compare against. */
  liftPct: number | null;
  controlRate: number | null;
  controlCoveragePct: number;
  touches: number;
  touchesPerAccount: number;
  cost: number;
  costPer100: number;
  responseRate: number;
  promises: number;
  promiseKeptRate: number;
  escalationRate: number;
  offTarget: number;
  offTargetValue: number;
  daysToFirstPayment: number | null;
  lastPublished: string | null;
}

export interface ChannelEconomics {
  channel: string;
  label: string;
  touches: number;
  cost: number;
  unitCost: number;
  responses: number;
  responseRate: number;
  promises: number;
  costPerResponse: number | null;
}

export interface FatiguePoint {
  touchNo: number;
  touches: number;
  responses: number;
  responseRate: number;
  cost: number;
}

export interface CoverageGap {
  bucket: string;
  accounts: number;
  outstanding: number;
  avgDpd: number;
  worstRisk: string | null;
}

export interface VersionImpact {
  strategyId: string;
  name: string;
  version: string | null;
  publishedAt: string | null;
  daysSince: number;
  collectedBefore: number;
  collectedAfter: number;
  windowDays: number;
  /** False until the window after the publish has fully elapsed. */
  mature: boolean;
  changePct: number | null;
}

export interface Instrumentation {
  stepEvents: number;
  stepEventsWithNode: number;
  nodeCoveragePct: number;
  enrolments: number;
  backfilledEnrolments: number;
}

const base = "/strategies/dashboard";

export const getStrategySummary = () => apiFetch<StrategySummary>(`${base}/summary`);
export const getStrategyPerformance = () =>
  apiFetch<StrategyPerformance[]>(`${base}/performance`);
export const getChannelEconomics = () => apiFetch<ChannelEconomics[]>(`${base}/channels`);
export const getFatigueCurve = () => apiFetch<FatiguePoint[]>(`${base}/fatigue`);
export const getCoverageGap = () => apiFetch<CoverageGap[]>(`${base}/coverage-gap`);
export const getVersionImpact = () => apiFetch<VersionImpact[]>(`${base}/version-impact`);
export const getInstrumentation = () => apiFetch<Instrumentation>(`${base}/instrumentation`);

/* ---------------------------------------------------------------------------
 * Target audience sizing
 *
 * Both the options and the count come from the live book, so the designer can
 * only pick filters that match something, and the size it reports is real.
 * ------------------------------------------------------------------------ */

export interface AudienceOption {
  value: string;
  label: string;
  customers: number;
  accounts: number;
}

export interface AudienceOptions {
  segments: AudienceOption[];
  agingBuckets: AudienceOption[];
  riskMin: number;
  riskMax: number;
  contactability: AudienceOption[];
  balanceBands: AudienceOption[];
  creditClasses: AudienceOption[];
}

export interface AudienceEstimate {
  customers: number;
  accounts: number;
  outstanding: number;
  avgDpd: number;
  avgRisk: number;
  shareOfAccountsPct: number;
  shareOfValuePct: number;
  totalCustomers: number;
  totalAccounts: number;
}

export interface AudienceCriteria {
  segment?: string;
  agingBucket?: string;
  riskMin?: number;
  riskMax?: number;
  contactability?: string;
  balanceBand?: string;
  creditClass?: string;
}

export const getAudienceOptions = () =>
  apiFetch<AudienceOptions>("/strategies/audience/options");

export const getAudienceEstimate = (c: AudienceCriteria) => {
  const p = new URLSearchParams();
  Object.entries(c).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") p.append(k, String(v));
  });
  const q = p.toString();
  return apiFetch<AudienceEstimate>(`/strategies/audience/estimate${q ? `?${q}` : ""}`);
};
