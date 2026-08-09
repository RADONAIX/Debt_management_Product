/**
 * Recovery Workspace API — external agency placement, the recovery ledger and
 * legal escalation. Everything is served from recovery_schema.
 *   /recovery/summary | /agencies | /placements | /legal | /config | /eligible
 */

import { apiFetch } from "./api";

export const AGENCY_TYPES = [
  "Consumer Debt",
  "Commercial Debt",
  "Small Business",
  "Late Stage",
  "Legal",
] as const;
export const AGENCY_STATUSES = ["ACTIVE", "SUSPENDED", "UNDER_REVIEW", "TERMINATED"] as const;
export const PLACEMENT_STATUSES = ["ACTIVE", "RECALLED", "SETTLED", "CLOSED", "LEGAL"] as const;
export const PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;
export const LEGAL_STAGES = [
  "Pre-Legal",
  "Notice Served",
  "Filed",
  "Discovery",
  "Hearing",
  "Judgment",
  "Post-Judgment",
  "Settled",
  "Withdrawn",
] as const;
export const LEGAL_STATUSES = ["OPEN", "WON", "LOST", "SETTLED", "WITHDRAWN"] as const;
export const PAYMENT_METHODS = [
  "Bank Transfer",
  "Card Payment",
  "Direct Debit",
  "Cheque",
  "Cash Deposit",
] as const;

export interface Agency {
  id: string;
  name: string;
  type: string;
  status: string;
  commissionPct: number;
  recallDays: number;
  capacity: number;
  minPlacement: number;
  maxPlacement?: number | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  city?: string | null;
  country?: string | null;
  coversRisk: string[];
  coversBucket: string[];
  onboardedOn?: string | null;
  contractEnd?: string | null;
  notes?: string | null;
  activePlacements: number;
  totalPlaced: number;
  totalRecovered: number;
  recoveryRate: number;
  commissionEarned: number;
  avgDaysToRecover?: number | null;
  performanceScore: number;
  utilisationPct: number;
}

export type AgencyWrite = Omit<
  Agency,
  | "id"
  | "activePlacements"
  | "totalPlaced"
  | "totalRecovered"
  | "recoveryRate"
  | "commissionEarned"
  | "avgDaysToRecover"
  | "performanceScore"
  | "utilisationPct"
  | "onboardedOn"
>;

export interface Placement {
  id: number;
  code: string;
  agencyId: string;
  agencyName: string;
  customerId: string;
  customerName: string;
  customerType: string;
  accountCode?: string | null;
  companyName?: string | null;
  companyId?: string | null;
  placedAmount: number;
  recoveredAmount: number;
  openAmount: number;
  recoveryPct: number;
  commissionPct: number;
  commissionAccrued: number;
  status: string;
  priority: string;
  /** Live from customer_schema.account / customer — not stored in recovery_schema. */
  dpd: number;
  riskLevel?: string | null;
  placedOn: string;
  recallDue?: string | null;
  closedOn?: string | null;
  lastActivity?: string | null;
  closeReason?: string | null;
  notes?: string | null;
  daysWithAgency: number;
  overdueRecall: boolean;
}

export interface RecoveryEntry {
  id: number;
  placementId: number;
  placementCode?: string | null;
  agencyName?: string | null;
  customerName?: string | null;
  recoveredOn: string;
  amount: number;
  commission: number;
  method: string;
  reference?: string | null;
  remitted: boolean;
  note?: string | null;
  /** True when this recovery posted a payment against the customer's account. */
  appliedToAccount?: boolean;
  customerId?: string | null;
}

export interface TimelineEvent {
  id: number;
  type: string;
  detail?: string | null;
  actor?: string | null;
  occurredAt: string;
  fromAgency?: string | null;
  toAgency?: string | null;
}

export interface PlacementDetail {
  placement: Placement;
  recoveries: RecoveryEntry[];
  events: TimelineEvent[];
}

export interface LegalCase {
  id: number;
  code: string;
  customerId: string;
  customerName: string;
  customerType?: string | null;
  riskLevel?: string | null;
  dpd: number;
  placementCode?: string | null;
  claimAmount: number;
  legalCost: number;
  recoveredAmount: number;
  stage: string;
  status: string;
  lawFirm?: string | null;
  attorney?: string | null;
  court?: string | null;
  filedOn?: string | null;
  nextHearing?: string | null;
  successProbability?: number | null;
  outcome?: string | null;
  notes?: string | null;
  events: TimelineEvent[];
}

export interface TrendPoint {
  month: string;
  placed: number;
  recovered: number;
  commission: number;
}

export interface RecoverySummary {
  activePlacements: number;
  placedValue: number;
  recoveredValue: number;
  openValue: number;
  recoveryRate: number;
  commissionAccrued: number;
  overdueRecalls: number;
  legalOpen: number;
  legalClaimValue: number;
  agencies: number;
  recoveredThisMonth: number;
  avgDaysToRecover?: number | null;
  trend: TrendPoint[];
}

export interface ConfigRow {
  key: string;
  value: string;
  label: string;
  description?: string | null;
  valueType: string;
}

export interface EligibleAccount {
  accountId: number;
  accountCode: string;
  customerId: string;
  customerName: string;
  customerType: string;
  outstanding: number;
  dpd: number;
  agingBucket: string;
  riskLevel: string;
}

const qs = (params: Record<string, string | boolean | undefined>) => {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== false) s.set(k, String(v));
  });
  const out = s.toString();
  return out ? `?${out}` : "";
};

// --- Overview --------------------------------------------------------------
export const getSummary = () => apiFetch<RecoverySummary>("/recovery/summary");
export const getLedger = (limit = 200) =>
  apiFetch<RecoveryEntry[]>(`/recovery/ledger?limit=${limit}`);

// --- Agencies --------------------------------------------------------------
export const getAgencies = () => apiFetch<Agency[]>("/recovery/agencies");
export const createAgency = (body: AgencyWrite) =>
  apiFetch<{ id: string }>("/recovery/agencies", { method: "POST", body });
export const updateAgency = (code: string, body: AgencyWrite) =>
  apiFetch<{ ok: boolean }>(`/recovery/agencies/${code}`, { method: "PUT", body });
export const deleteAgency = (code: string) =>
  apiFetch<void>(`/recovery/agencies/${code}`, { method: "DELETE" });

// --- Placements ------------------------------------------------------------
export const getPlacements = (f: {
  agency?: string;
  status?: string;
  priority?: string;
  search?: string;
  overdue?: boolean;
} = {}) => apiFetch<Placement[]>(`/recovery/placements${qs(f)}`);

export const getPlacement = (id: number) =>
  apiFetch<PlacementDetail>(`/recovery/placements/${id}`);

export const createPlacement = (body: {
  agencyId: string;
  customerId: string;
  accountId?: number | null;
  placedAmount: number;
  priority?: string;
  notes?: string | null;
}) => apiFetch<{ id: number }>("/recovery/placements", { method: "POST", body });

export const patchPlacement = (
  id: number,
  body: { priority?: string; notes?: string; status?: string; closeReason?: string },
) => apiFetch<{ ok: boolean }>(`/recovery/placements/${id}`, { method: "PATCH", body });

export const reassignPlacement = (id: number, agencyId: string, reason?: string) =>
  apiFetch<{ ok: boolean }>(`/recovery/placements/${id}/reassign`, {
    method: "POST",
    body: { agencyId, reason },
  });

export const postRecovery = (
  id: number,
  body: { amount: number; recoveredOn?: string; method?: string; reference?: string; note?: string },
) => apiFetch<{ ok: boolean }>(`/recovery/placements/${id}/recoveries`, { method: "POST", body });

export const reverseRecovery = (id: number) =>
  apiFetch<void>(`/recovery/recoveries/${id}`, { method: "DELETE" });

export const getEligible = (search?: string) =>
  apiFetch<EligibleAccount[]>(`/recovery/eligible${qs({ search })}`);

// --- Legal -----------------------------------------------------------------
export const getLegalCases = (status?: string) =>
  apiFetch<LegalCase[]>(`/recovery/legal${qs({ status })}`);

export const createLegalCase = (body: {
  customerId: string;
  placementId?: number | null;
  claimAmount: number;
  stage?: string;
  lawFirm?: string;
  attorney?: string;
  court?: string;
  filedOn?: string;
  nextHearing?: string;
  successProbability?: number;
  notes?: string;
}) => apiFetch<{ id: number }>("/recovery/legal", { method: "POST", body });

export const patchLegalCase = (id: number, body: Record<string, unknown>) =>
  apiFetch<{ ok: boolean }>(`/recovery/legal/${id}`, { method: "PATCH", body });

export const deleteLegalCase = (id: number) =>
  apiFetch<void>(`/recovery/legal/${id}`, { method: "DELETE" });

// --- Configuration ---------------------------------------------------------
export const getRecoveryConfig = () => apiFetch<ConfigRow[]>("/recovery/config");
export const saveRecoveryConfig = (values: Record<string, string>) =>
  apiFetch<{ ok: boolean }>("/recovery/config", { method: "PUT", body: values });
