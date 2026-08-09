/**
 * Agent Workspace API — the collector's desk.
 *
 * Backed entirely by the existing collections tables (debt_case, ptp,
 * case_activity, dispute, payment); this module owns no storage of its own.
 */

import { apiFetch } from "./api";

export const CASE_TYPES = [
  "Collection",
  "Broken PTP",
  "Payment Plan",
  "Dispute",
  "Billing Issue",
  "Legal Followup",
] as const;
export const CASE_STATUSES = ["OPEN", "IN_PROGRESS", "ESCALATED", "LEGAL", "CLOSED"] as const;
export const PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;
export const CHANNELS = [
  "Dialer",
  "SMS",
  "WhatsApp",
  "Email",
  "IVR",
  "Chat",
  "Voicebot",
  "Field Visit",
] as const;
export const ACTIVITY_TYPES = ["CALL", "SMS", "EMAIL", "WHATSAPP", "CHAT", "NOTE"] as const;
export const DISPUTE_REASONS = [
  "INCORRECT_AMOUNT",
  "DUPLICATE_INVOICE",
  "SERVICE_NOT_DELIVERED",
  "ROAMING_CHARGES",
  "LATE_FEE",
  "DEVICE_INSTALMENT",
] as const;
export const PAYMENT_METHODS = [
  "Payment Link",
  "Bank Transfer",
  "Credit Card",
  "Auto-Debit",
  "Cash",
  "Cheque",
] as const;

export interface Agent {
  id: number;
  name: string;
  email: string;
  role?: string | null;
  openCases: number;
  customers: number;
  pendingPtps: number;
  openDisputes: number;
  availability?: string | null;
  maxCaseload?: number | null;
}

export interface DeskSummary {
  agentId: number;
  agentName: string;
  /** From public.agent_profile — the establishment record, not a copy. */
  employeeCode?: string | null;
  skillGroup?: string | null;
  expertise?: string | null;
  languages: string[];
  specializations: string[];
  availability?: string | null;
  maxCaseload?: number | null;
  monthlyTarget?: number | null;
  performanceRating?: number | null;
  targetProgress?: number | null;
  caseloadPct?: number | null;
  /** Every customer the desk owns, whether or not under collection. */
  customers: number;
  portfolioValue: number;
  /** The subset under collection: accounts with a live case. */
  bookCustomers: number;
  bookExposure: number;
  openCases: number;
  slaBreached: number;
  dueToday: number;
  pendingPtps: number;
  ptpValue: number;
  ptpsDueToday: number;
  keptRate: number;
  openDisputes: number;
  contactsToday: number;
  collectedMtd: number;
  promisedMtd: number;
}

export interface WorkItem {
  customerId: string;
  customerName: string;
  customerType: string;
  accountId?: number | null;
  accountCode?: string | null;
  outstanding: number;
  dpd: number;
  agingBucket?: string | null;
  riskLevel: string;
  riskScore: number;
  contactability: number;
  bestChannel?: string | null;
  bestContactTime?: string | null;
  phone?: string | null;
  email?: string | null;
  strategy?: string | null;
  openCases: number;
  openCaseCode?: string | null;
  openCaseId?: number | null;
  pendingPtp: boolean;
  ptpDueOn?: string | null;
  lastContact?: string | null;
  lastPayment?: string | null;
  nextAction: string;
  priority: string;
  priorityScore: number;
  /** Owner of the customer — shown when viewing every desk. */
  agentName?: string | null;
}

export interface CaseRow {
  id: number;
  code: string;
  customerId: string;
  customerName: string;
  accountCode?: string | null;
  type: string;
  summary?: string | null;
  status: string;
  priority: string;
  riskLevel: string;
  amount: number;
  dpd: number;
  strategy?: string | null;
  dunningStage: number;
  agentId?: number | null;
  agentName?: string | null;
  openedAt: string;
  slaDeadline?: string | null;
  slaBreached: boolean;
  firstResponseAt?: string | null;
  lastActivityAt?: string | null;
  closedAt?: string | null;
  resolution?: string | null;
  activityCount: number;
  hoursToSla?: number | null;
}

export interface ActivityRow {
  id: number;
  type: string;
  channel?: string | null;
  direction: string;
  subject: string;
  body?: string | null;
  outcome?: string | null;
  visibility: string;
  isAutomated: boolean;
  agent?: string | null;
  occurredAt: string;
}

export interface PtpRow {
  id: number;
  code: string;
  customerId: string;
  customerName: string;
  accountCode?: string | null;
  caseCode?: string | null;
  promisedAmount: number;
  promisedDate: string;
  instalments: number;
  keptAmount: number;
  outstandingOnPromise: number;
  status: string;
  channel?: string | null;
  aiProbability?: number | null;
  fulfilledAt?: string | null;
  notes?: string | null;
  agentName?: string | null;
  createdAt: string;
  daysToDue?: number | null;
  overdue: boolean;
}

export interface DisputeRow {
  id: number;
  code: string;
  customerId: string;
  customerName: string;
  reason: string;
  description?: string | null;
  amount: number;
  status: string;
  priority: string;
  filedAt: string;
  slaDeadline?: string | null;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
  caseCode?: string | null;
  agentName?: string | null;
}

export interface PaymentRow {
  reference: string;
  date: string;
  amount: number;
  method: string;
  status: string;
  invoiceNo?: string | null;
  notes?: string | null;
}

export interface CaseDetail {
  case: CaseRow;
  customer: WorkItem;
  activities: ActivityRow[];
  ptps: PtpRow[];
  disputes: DisputeRow[];
  payments: PaymentRow[];
}

export interface ReminderTemplate {
  key: string;
  label: string;
  channel: string;
  subject: string;
  body: string;
}

const qs = (p: Record<string, string | number | boolean | undefined | null>) => {
  const s = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "" && v !== false) s.set(k, String(v));
  });
  const out = s.toString();
  return out ? `?${out}` : "";
};

// --- Desk ------------------------------------------------------------------
/** agentId = 0 means every desk; only granted to User Management holders. */
export const ALL_DESKS = 0;

export const getScope = () =>
  apiFetch<{ agentId: number; canViewAllDesks: boolean }>("/agent/scope");

export const getAgents = () => apiFetch<Agent[]>("/agent/agents");
export const getDeskSummary = (agentId?: number) =>
  apiFetch<DeskSummary>(`/agent/summary${qs({ agentId })}`);
export const settlePromises = (agentId?: number) =>
  apiFetch<{ kept: number; broken: number }>(`/agent/settle-promises${qs({ agentId })}`, {
    method: "POST",
  });

// --- Worklist --------------------------------------------------------------
export const getWorklist = (f: {
  agentId?: number;
  search?: string;
  priority?: string;
  bucket?: string;
  risk?: string;
} = {}) => apiFetch<WorkItem[]>(`/agent/worklist${qs(f)}`);

// --- Cases -----------------------------------------------------------------
export const getCases = (f: {
  agentId?: number;
  status?: string;
  priority?: string;
  search?: string;
  breached?: boolean;
} = {}) => apiFetch<CaseRow[]>(`/agent/cases${qs(f)}`);

export const getCase = (id: number) => apiFetch<CaseDetail>(`/agent/cases/${id}`);

export const createCase = (body: {
  customerId: string;
  accountId?: number | null;
  type?: string;
  summary?: string;
  priority?: string;
  amount?: number;
}) => apiFetch<{ id: number }>("/agent/cases", { method: "POST", body });

export const patchCase = (
  id: number,
  body: {
    status?: string;
    priority?: string;
    summary?: string;
    resolution?: string;
    agentId?: number;
  },
) => apiFetch<{ ok: boolean }>(`/agent/cases/${id}`, { method: "PATCH", body });

export const addActivity = (
  id: number,
  body: {
    type?: string;
    channel?: string;
    direction?: string;
    subject: string;
    body?: string;
    outcome?: string;
    visibility?: string;
  },
) => apiFetch<{ ok: boolean }>(`/agent/cases/${id}/activities`, { method: "POST", body });

// --- Promises --------------------------------------------------------------
export const getPtps = (f: { agentId?: number; status?: string; search?: string } = {}) =>
  apiFetch<PtpRow[]>(`/agent/ptps${qs(f)}`);

export const createPtp = (body: {
  customerId: string;
  accountId?: number | null;
  caseId?: number | null;
  promisedAmount: number;
  promisedDate: string;
  instalments?: number;
  channel?: string;
  notes?: string;
}) => apiFetch<{ id: number }>("/agent/ptps", { method: "POST", body });

export const patchPtp = (
  id: number,
  body: {
    status?: string;
    keptAmount?: number;
    promisedDate?: string;
    promisedAmount?: number;
    notes?: string;
  },
) => apiFetch<{ ok: boolean }>(`/agent/ptps/${id}`, { method: "PATCH", body });

// --- Reminders -------------------------------------------------------------
export const getReminderTemplates = () =>
  apiFetch<ReminderTemplate[]>("/agent/reminder-templates");

export const sendReminder = (body: {
  customerId: string;
  accountId?: number | null;
  caseId?: number | null;
  channel?: string;
  template?: string;
  message?: string;
}) => apiFetch<{ message: string }>("/agent/reminders", { method: "POST", body });

// --- Disputes --------------------------------------------------------------
export const getDisputes = (f: { agentId?: number; status?: string } = {}) =>
  apiFetch<DisputeRow[]>(`/agent/disputes${qs(f)}`);

export const createDispute = (body: {
  customerId: string;
  accountId?: number | null;
  caseId?: number | null;
  reason: string;
  description?: string;
  amount?: number;
  priority?: string;
}) => apiFetch<{ id: number }>("/agent/disputes", { method: "POST", body });

export const patchDispute = (
  id: number,
  body: { status?: string; priority?: string; resolutionNote?: string },
) => apiFetch<{ ok: boolean }>(`/agent/disputes/${id}`, { method: "PATCH", body });

// --- Payments --------------------------------------------------------------
export const logPayment = (body: {
  customerId: string;
  accountId: number;
  amount: number;
  method?: string;
  reference?: string;
  paidOn?: string;
  ptpId?: number | null;
  note?: string;
}) => apiFetch<{ ok: boolean }>("/agent/payments", { method: "POST", body });
