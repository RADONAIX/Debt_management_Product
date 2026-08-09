/**
 * Portfolio Dashboard API — the application-wide overview behind the landing
 * screen. Everything is read live from the collections database.
 */

import { apiFetch } from "./api";

export interface MonthPoint { month: string; billed: number; collected: number }
export interface AgeingLine { bucket: string; accounts: number; balance: number }
/** One slice of the delinquent balance. Slices are mutually exclusive. */
export interface StageLine { stage: string; accounts: number; balance: number }

export interface SegmentLine {
  name: string; accounts: number; balance: number;
  delinquent: number; delinquentPct?: number | null;
}
export interface StrategyLine {
  code: string; name: string; status: string; version: string;
  accounts: number; balance: number; successRate?: number | null;
}

export interface PortfolioOverview {
  receivables: number;
  accounts: number;
  customers: number;
  enterpriseCustomers: number;
  companies: number;
  receivablesDeltaPct?: number | null;

  delinquent: number;
  delinquentAccounts: number;
  delinquentPct?: number | null;
  severe: number;
  severePct?: number | null;

  underCase: number;
  coveragePct?: number | null;
  uncovered: number;
  openCases: number;
  closedThisMonth: number;

  billedThisMonth: number;
  collectedThisMonth: number;
  cashCollectionPct?: number | null;
  collectedDeltaPct?: number | null;

  /** The delinquent balance split by where it sits — these sum to `delinquent`. */
  stages: StageLine[];

  /** Commitments and cash movements. NOT slices of the delinquent balance. */
  promised: number;
  disputed: number;
  placedFaceValue: number;
  claimed: number;
  agencyRecovered: number;

  riskyAccounts: number;
  riskyValue: number;
  accountsOnStrategy: number;
  accountsOffStrategy: number;
  activeUsers: number;
  agents: number;
  roles: number;

  trend: MonthPoint[];
  ageing: AgeingLine[];
  products: SegmentLine[];
  strategies: StrategyLine[];
}

export const getPortfolioOverview = () =>
  apiFetch<PortfolioOverview>("/portfolio/overview");
