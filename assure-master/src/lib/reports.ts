/**
 * Performance Reports API.
 *
 * Four registers of collections work — promises, disputes, legal escalations
 * and agency escalations. Every one takes the same filter object and returns
 * the same page envelope, so the screen renders them through one table.
 */

import { apiFetch } from "./api";

export interface ReportFilters {
  search?: string;
  status?: string;
  /** What created the row: "Strategy Engine", "Collection Agent", … */
  source?: string;
  /** The header's Customer Scope, forwarded so every tab honours it. */
  customerScope?: "all" | "consumer" | "enterprise";
  customerType?: string;
  region?: string;
  dateFrom?: string;
  dateTo?: string;
  channel?: string;
  priority?: string;
  reason?: string;
  stage?: string;
  agency?: string;
}

export interface PtpRow {
  id: number;
  code: string;
  customerId: string;
  customerName: string;
  customerType: string;
  accountCode: string | null;
  promisedAmount: number;
  keptAmount: number;
  promisedDate: string;
  status: string;
  channel: string | null;
  agentName: string | null;
  daysOverdue: number;
  aiProbability: number | null;
  source: string;
  sourceDetail: string | null;
}

export interface DisputeRow {
  id: number;
  code: string;
  customerId: string;
  customerName: string;
  customerType: string;
  accountCode: string | null;
  reason: string;
  amount: number;
  status: string;
  priority: string;
  filedAt: string;
  slaDeadline: string | null;
  resolvedAt: string | null;
  agentName: string | null;
  ageDays: number;
  slaBreached: boolean;
  source: string;
  sourceDetail: string | null;
}

export interface LegalRow {
  id: number;
  code: string;
  customerId: string;
  customerName: string;
  customerType: string;
  claimAmount: number;
  legalCost: number;
  recoveredAmount: number;
  stage: string;
  status: string;
  lawFirm: string | null;
  court: string | null;
  filedOn: string | null;
  nextHearing: string | null;
  successProbability: number | null;
  ageDays: number;
  source: string;
  sourceDetail: string | null;
}

export interface AgencyRow {
  id: number;
  code: string;
  agencyName: string;
  customerId: string;
  customerName: string;
  customerType: string;
  accountCode: string | null;
  placedAmount: number;
  recoveredAmount: number;
  openAmount: number;
  recoveryPct: number;
  status: string;
  priority: string;
  dpd: number;
  placedOn: string;
  recallDue: string | null;
  daysWithAgency: number;
  overdueRecall: boolean;
  source: string;
  sourceDetail: string | null;
}

export interface Page<T> {
  rows: T[];
  total: number;
  totalAmount: number;
}

export interface ReportFilterOptions {
  customerTypes: string[];
  regions: string[];
  ptpStatuses: string[];
  ptpChannels: string[];
  disputeStatuses: string[];
  disputeReasons: string[];
  disputePriorities: string[];
  legalStatuses: string[];
  legalStages: string[];
  agencyStatuses: string[];
  agencyPriorities: string[];
  agencies: string[];
  ptpSources: string[];
  disputeSources: string[];
  legalSources: string[];
  agencySources: string[];
}

export interface PageQuery {
  sort?: string;
  dir?: "asc" | "desc";
  limit?: number;
  offset?: number;
}

const qs = (f: ReportFilters, q: PageQuery = {}) => {
  const p = new URLSearchParams();
  Object.entries({ ...f, ...q }).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") p.append(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const getReportOptions = () => apiFetch<ReportFilterOptions>("/reports/options");

export const getPtps = (f: ReportFilters, q: PageQuery) =>
  apiFetch<Page<PtpRow>>(`/reports/ptps${qs(f, q)}`);

export const getDisputes = (f: ReportFilters, q: PageQuery) =>
  apiFetch<Page<DisputeRow>>(`/reports/disputes${qs(f, q)}`);

export const getLegalEscalations = (f: ReportFilters, q: PageQuery) =>
  apiFetch<Page<LegalRow>>(`/reports/legal-escalations${qs(f, q)}`);

export const getAgencyEscalations = (f: ReportFilters, q: PageQuery) =>
  apiFetch<Page<AgencyRow>>(`/reports/agency-escalations${qs(f, q)}`);
