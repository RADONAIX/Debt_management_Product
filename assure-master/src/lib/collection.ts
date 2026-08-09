/**
 * Collection Workspace & Case Management API.
 *
 * The case itself is customer_schema.debt_case; the `collection` schema adds
 * provenance, routing, workflow, notes, attachments and audit. Customer,
 * account, payment, promise, dispute, agency and legal data is joined server
 * side from the tables that already own it.
 */

import { apiFetch } from "./api";

export const DUPLICATE_ACTIONS = ["OPEN_EXISTING", "CREATE_NEW"] as const;
export const NOTE_TYPES = ["GENERAL", "CALL", "NEGOTIATION", "ESCALATION", "RESOLUTION", "HANDOVER"] as const;
export const NOTE_VISIBILITY = ["INTERNAL", "CUSTOMER_FACING", "SUPERVISOR_ONLY"] as const;
export const DOCUMENT_TYPES = [
  "OTHER", "ID_PROOF", "PAYMENT_PROOF", "SETTLEMENT_LETTER", "DISPUTE_EVIDENCE",
  "LEGAL_NOTICE", "AGENCY_HANDOVER", "CORRESPONDENCE", "CONTRACT",
] as const;
export const COLLECTION_STAGES = [
  "Current", "Overdue", "Delinquent", "In Collection", "Promise To Pay",
  "Disputed", "Agency", "Legal",
] as const;

export interface WorkspaceRow {
  customerId: string;
  customerName: string;
  customerType: string;
  companyName?: string | null;
  phone?: string | null;
  email?: string | null;
  accountId?: number | null;
  accountCode?: string | null;
  ban?: string | null;
  servicePlan?: string | null;
  outstanding: number;
  dpd: number;
  agingBucket?: string | null;
  accountStatus?: string | null;
  riskScore: number;
  riskLevel: string;
  creditScore?: number | null;
  contactability: number;
  agentId?: number | null;
  agentName?: string | null;
  collectionStatus: string;
  openCases: number;
  openCaseCode?: string | null;
  openCaseId?: number | null;
  activePtp: boolean;
  ptpAmount?: number | null;
  ptpDueOn?: string | null;
  activeDisputes: number;
  disputedAmount: number;
  legalStatus?: string | null;
  legalStage?: string | null;
  agencyStatus?: string | null;
  agencyName?: string | null;
  lastPaymentOn?: string | null;
  lastPaymentAmount?: number | null;
  payments90d: number;
  collected90d: number;
  lastContactAt?: string | null;
  contactAttempts: number;
  strategy?: string | null;
  queueCode?: string | null;
  nextAction: string;
  priority: string;
  priorityScore: number;
}

export interface WorkspaceSummary {
  accounts: number;
  customers: number;
  totalOutstanding: number;
  needingAction: number;
  withActivePtp: number;
  inDispute: number;
  withAgency: number;
  inLegal: number;
  openCases: number;
  slaBreached: number;
  unassigned: number;
}

export interface TimelineEntry {
  at: string;
  kind: string;
  title: string;
  detail?: string | null;
  actor?: string | null;
  amount?: number | null;
}

export interface CaseRow {
  id: number;
  caseNumber: string;
  status: string;
  workflowState: string;
  stateCategory?: string | null;
  source: string;
  sourceName?: string | null;
  type: string;
  typeName?: string | null;
  priority: string;
  queueCode?: string | null;
  queueName?: string | null;
  summary?: string | null;
  customerId: string;
  customerName: string;
  customerType: string;
  accountCode?: string | null;
  outstanding: number;
  dpd: number;
  riskScore: number;
  riskLevel: string;
  amount: number;
  agentId?: number | null;
  agentName?: string | null;
  openedAt: string;
  dueDate?: string | null;
  slaDeadline?: string | null;
  slaBreached: boolean;
  hoursToSla?: number | null;
  slaPaused: boolean;
  firstResponseAt?: string | null;
  lastActivityAt?: string | null;
  closedAt?: string | null;
  resolution?: string | null;
  parentCaseId?: number | null;
  parentCaseNumber?: string | null;
  childCount: number;
  mergedIntoCaseId?: number | null;
  mergedIntoNumber?: string | null;
  reopenCount: number;
  strategy?: string | null;
  activityCount: number;
  noteCount: number;
  attachmentCount: number;
  createdByName?: string | null;
  triggerDetail?: string | null;
}

export interface TransitionRow {
  fromState: string;
  toState: string;
  label: string;
  requiredPermission?: string | null;
  requiresNote: boolean;
  requiresApproval: boolean;
  allowed: boolean;
}

export interface NoteRow {
  id: number;
  body: string;
  noteType: string;
  visibility: string;
  isPinned: boolean;
  author?: string | null;
  createdAt: string;
}

export interface AttachmentRow {
  id: number;
  fileName: string;
  fileType?: string | null;
  fileSizeBytes?: number | null;
  storageUri: string;
  documentType: string;
  uploadedBy?: string | null;
  uploadedAt: string;
}

export interface AuditRow {
  id: number;
  action: string;
  fieldName?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  actor?: string | null;
  actorRole?: string | null;
  reason?: string | null;
  occurredAt: string;
}

export interface AssignmentRow {
  id: number;
  agentName?: string | null;
  queueCode?: string | null;
  assignedByName?: string | null;
  assignmentType: string;
  reason?: string | null;
  assignedAt: string;
  releasedAt?: string | null;
}

export interface RelatedCommunication {
  id: number;
  type: string;
  channel?: string | null;
  direction: string;
  subject: string;
  outcome?: string | null;
  agent?: string | null;
  occurredAt: string;
}

export interface CaseDetail {
  case: CaseRow;
  customer: WorkspaceRow;
  transitions: TransitionRow[];
  /** What happened on this case. Empty when nobody has worked it. */
  timeline: TimelineEntry[];
  /** The customer's wider history, which exists independently of this case. */
  customerHistory: TimelineEntry[];
  communications: RelatedCommunication[];
  notes: NoteRow[];
  attachments: AttachmentRow[];
  audit: AuditRow[];
  assignments: AssignmentRow[];
  ptps: {
    id: number; code: string; promisedAmount: number; promisedDate: string;
    keptAmount: number; status: string; instalments: number;
  }[];
  disputes: {
    id: number; code: string; reason: string; amount: number; status: string; filedAt: string;
  }[];
  payments: {
    reference: string; date: string; amount: number; method: string; status: string;
  }[];
  legal: {
    id: number; code: string; stage: string; status: string; claimAmount: number;
    nextHearing?: string | null;
  }[];
  placements: {
    id: number; code: string; agencyName: string; placedAmount: number;
    recoveredAmount: number; status: string;
  }[];
  children: CaseRow[];
}

export interface CaseDashboard {
  totalOpen: number;
  unassigned: number;
  slaBreached: number;
  dueToday: number;
  createdToday: number;
  closedToday: number;
  reopened: number;
  totalValue: number;
  avgResolutionHours?: number | null;
  byState: { state: string; count: number; value: number }[];
  byQueue: { queue: string; count: number; value: number }[];
  bySource: { source: string; count: number; value: number }[];
  byPriority: { priority: string; count: number; value: number }[];
  byType: { type: string; count: number; value: number }[];
  byAgent: { agent: string; count: number; breached: number; value: number }[];
  ageing: { bucket: string; count: number }[];
}

export interface CaseTypeRow {
  code: string;
  name: string;
  description?: string | null;
  defaultPriority: string;
  defaultQueue?: string | null;
  slaHours: number;
  duplicatePolicy: string;
  requiresApproval: boolean;
  autoCloseOnPay: boolean;
  isActive: boolean;
}

export interface QueueRow {
  code: string;
  name: string;
  description?: string | null;
  dpdMin?: number | null;
  dpdMax?: number | null;
  amountMin?: number | null;
  amountMax?: number | null;
  riskLevels: string[];
  customerTypes: string[];
  assignmentMode: string;
  maxPerAgent: number;
  isActive: boolean;
  openCases: number;
  slaBreached: number;
  totalValue: number;
  agents: number;
}

export interface CollectionConfig {
  types: CaseTypeRow[];
  sources: { code: string; name: string; description?: string | null; isAutomated: boolean }[];
  queues: QueueRow[];
  priorities: { code: string; name: string; rank: number; sla_hours: number }[];
  states: {
    code: string; name: string; category: string; isInitial: boolean; isTerminal: boolean;
    pausesSla: boolean; colour?: string | null; caseCount: number;
  }[];
  transitions: TransitionRow[];
  rules: {
    id: number; name: string; priority: number; isActive: boolean;
    caseTypeCode?: string | null; sourceCode?: string | null;
    dpdMin?: number | null; dpdMax?: number | null;
    amountMin?: number | null; amountMax?: number | null;
    riskLevels: string[]; customerTypes: string[];
    targetQueue?: string | null; setPriority?: string | null;
  }[];
  agents: { id: number; name: string; role: string; open_cases: number }[];
}

export interface DuplicateCheck {
  hasDuplicate: boolean;
  policy: string;
  existingCaseId?: number | null;
  existingCaseNumber?: string | null;
  existingState?: string | null;
  existingOpenedAt?: string | null;
  existingType?: string | null;
  message?: string | null;
  options: string[];
}

export interface CaseCreated {
  id: number;
  caseNumber: string;
  action: string;
  queueCode?: string | null;
  agentName?: string | null;
  message: string;
}

const qs = (p: Record<string, string | number | boolean | undefined | null>) => {
  const s = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "" && v !== false) s.set(k, String(v));
  });
  const out = s.toString();
  return out ? `?${out}` : "";
};

// --- Workspace -------------------------------------------------------------
export const getWorkspace = (f: {
  search?: string; status?: string; bucket?: string; risk?: string;
  queue?: string; agentId?: number; unassigned?: boolean; limit?: number;
} = {}) => apiFetch<WorkspaceRow[]>(`/collection/workspace${qs(f)}`);

export const getWorkspaceSummary = () =>
  apiFetch<WorkspaceSummary>("/collection/workspace/summary");

export const getCustomerRow = (code: string) =>
  apiFetch<WorkspaceRow>(`/collection/customers/${code}`);

export const getCustomerTimeline = (code: string, limit = 120) =>
  apiFetch<TimelineEntry[]>(`/collection/customers/${code}/timeline?limit=${limit}`);

// --- Cases -----------------------------------------------------------------
export const getCases = (f: {
  search?: string; state?: string; category?: string; queue?: string; source?: string;
  typeCode?: string; priority?: string; agentId?: number; unassigned?: boolean;
  breached?: boolean; includeMerged?: boolean; limit?: number;
} = {}) => apiFetch<CaseRow[]>(`/collection/cases${qs(f)}`);

export const getCase = (id: number) => apiFetch<CaseDetail>(`/collection/cases/${id}`);
// --- Collections Dashboard -------------------------------------------------
export interface TrendPoint {
  weekStart: string; collected: number; promised: number; opened: number; closed: number;
}
export interface AgeingLine { bucket: string; accounts: number; exposure: number }
export interface CollectorLine {
  agentId: number; agentName: string; openCases: number; exposure: number;
  breached: number; collected30d: number; keptRate?: number | null;
}
export interface ExposureLine {
  caseId: number; caseNumber: string; caseCount: number;
  customerId: string; customerName: string;
  companyName?: string | null; accountCode: string; outstanding: number; dpd: number;
  riskLevel?: string | null; caseType?: string | null; agentName?: string | null;
}
export interface SlaLine {
  caseId: number; caseNumber: string; customerId: string; customerName: string;
  priority: string; caseType?: string | null; outstanding: number; hoursToSla: number;
  agentName?: string | null;
}
export interface CollectionsOverview {
  scope: "MY_DESK" | "ALL_COLLECTIONS";
  openExposure: number; accounts: number; customers: number;
  /** Of the exposure above, what is not past due yet. */
  notYetDue: number;
  openCases: number; untouched: number; unassigned: number; awaitingClose: number;
  over90Exposure: number;
  collected30d: number; collectedToday: number; collectedPayments: number;
  collectedDeltaPct?: number | null; recoveryRatePct?: number | null;
  promiseKeptRatePct?: number | null; promisesKept: number; promisesBroken: number;
  openPromises: number; openPromiseValue: number; promisesDueToday: number;
  promisesDueTodayValue: number; promisesDueWeek: number; promisesOverdue: number;
  slaCompliancePct?: number | null; slaBreached: number; slaDueSoon: number;
  avgDaysToClose?: number | null; closedMtd: number;
  trend: TrendPoint[]; ageing: AgeingLine[]; collectors: CollectorLine[];
  topExposure: ExposureLine[]; atRisk: SlaLine[];
}

/** The collections book for whichever desk the signed-in user may see. */
export const getOverview = (agentId?: number | null, weeks = 8) =>
  apiFetch<CollectionsOverview>(`/collection/overview${qs({ agentId, weeks })}`);

export const getDashboard = () => apiFetch<CaseDashboard>("/collection/cases/dashboard");
export const getConfig = () => apiFetch<CollectionConfig>("/collection/config");

/**
 * A customer may hold several cases at once — one per issue. What counts as a
 * duplicate is a second case of the *same type* on the same account.
 */
export const checkDuplicate = (customerId: string, typeCode: string, accountId?: number | null) =>
  apiFetch<DuplicateCheck>(
    `/collection/duplicate-check${qs({ customerId, typeCode, accountId })}`);

/**
 * Edit a case in place — above all, re-type it. A case carries one type at a
 * time and it changes as the situation does: a broken promise that goes to
 * legal becomes a Legal Follow-up case rather than a second card beside it.
 */
export const patchCase = (id: number, body: {
  typeCode?: string; priority?: string; summary?: string; reason?: string;
}) => apiFetch<{ ok: boolean }>(`/collection/cases/${id}`, { method: "PATCH", body });

export const createCase = (body: {
  customerId: string; accountId?: number | null; typeCode: string; sourceCode?: string;
  reason?: string; priority?: string; queueCode?: string; agentId?: number;
  dueDate?: string; notes?: string; amount?: number; duplicateAction?: string;
  triggerDetail?: string; externalRef?: string; assignToPool?: boolean;
}) => apiFetch<CaseCreated>("/collection/cases", { method: "POST", body });

export const transitionCase = (id: number, body: {
  toState: string; note?: string; resolution?: string;
}) => apiFetch<{ ok: boolean }>(`/collection/cases/${id}/transition`, { method: "POST", body });

export const assignCase = (id: number, body: {
  agentId?: number | null; queueCode?: string; reason?: string; assignmentType?: string;
}) => apiFetch<{ ok: boolean }>(`/collection/cases/${id}/assign`, { method: "POST", body });

export const transferCase = (id: number, body: {
  agentId?: number | null; queueCode?: string; reason?: string;
}) => apiFetch<{ ok: boolean }>(`/collection/cases/${id}/transfer`, { method: "POST", body });

export const claimCase = (id: number) =>
  apiFetch<{ ok: boolean }>(`/collection/cases/${id}/claim`, { method: "POST" });

export const mergeCase = (id: number, targetCaseId: number, reason?: string) =>
  apiFetch<{ ok: boolean }>(`/collection/cases/${id}/merge`, {
    method: "POST", body: { targetCaseId, reason },
  });

export const addNote = (id: number, body: {
  body: string; noteType?: string; visibility?: string; isPinned?: boolean;
}) => apiFetch<{ id: number }>(`/collection/cases/${id}/notes`, { method: "POST", body });

export const addAttachment = (id: number, body: {
  fileName: string; fileType?: string; fileSizeBytes?: number; storageUri: string;
  documentType?: string;
}) => apiFetch<{ id: number }>(`/collection/cases/${id}/attachments`, { method: "POST", body });

export const saveQueue = (body: Partial<QueueRow> & { code: string; name: string }) =>
  apiFetch<{ ok: boolean }>("/collection/config/queues", { method: "PUT", body });

export const saveCaseType = (body: Partial<CaseTypeRow> & { code: string; name: string }) =>
  apiFetch<{ ok: boolean }>("/collection/config/case-types", { method: "PUT", body });

// --- Case candidates: defaulters with no case ------------------------------
export interface CandidateRow {
  customerId: string;
  customerName: string;
  customerType: string;
  companyName?: string | null;
  accountId: number;
  accountCode: string;
  ban?: string | null;
  outstanding: number;
  dpd: number;
  agingBucket?: string | null;
  riskLevel: string;
  riskScore: number;
  creditScore?: number | null;
  agentId?: number | null;
  agentName?: string | null;
  lastPaymentOn?: string | null;
  lastContactAt?: string | null;
  strategy?: string | null;
  /** Why this account is on the list. */
  triggerCode: string;
  triggerLabel: string;
  triggerDetail: string;
  /** What the system would raise for it. */
  suggestedType: string;
  suggestedTypeName: string;
  suggestedPriority: string;
  suggestedQueue?: string | null;
  urgency: number;
  brokenPtpCode?: string | null;
  brokenPtpAmount?: number | null;
  overduePtpDate?: string | null;
  openDisputes: number;
}

export interface CandidateSummary {
  total: number;
  totalValue: number;
  mine: number;
  byTrigger: { trigger: string; label: string; count: number; value: number }[];
}

export interface BulkCaseResult {
  created: number;
  skipped: number;
  cases: { accountId: number; caseId: number; caseNumber: string; customer: string }[];
  messages: string[];
}

export const getCandidates = (f: {
  mine?: boolean; agentId?: number; search?: string; trigger?: string;
  minDpd?: number; limit?: number;
} = {}) => apiFetch<CandidateRow[]>(`/collection/candidates${qs(f)}`);

export const getCandidateSummary = () =>
  apiFetch<CandidateSummary>("/collection/candidates/summary");

export const createCasesFromCandidates = (body: {
  accountIds: number[]; assignToMe?: boolean; agentId?: number;
  overrideType?: string; overridePriority?: string; note?: string;
}) => apiFetch<BulkCaseResult>("/collection/candidates/create-cases", { method: "POST", body });

// --- Ticketing: board, grouping, tasks, escalation, bulk -------------------
export const GROUP_LABELS: Record<string, string> = {
  CUSTOMER: "Customer", COMPANY: "Company", STATUS: "Status", CASE_TYPE: "Case type", PRIORITY: "Priority",
  RISK: "Risk", COLLECTOR: "Collector", QUEUE: "Queue", DPD_BUCKET: "DPD bucket",
  PRODUCT: "Product", STRATEGY: "Strategy", REGION: "Region", BRANCH: "Branch",
  PORTFOLIO: "Portfolio", ASSIGNMENT: "Assignment", SOURCE: "Source", PTP: "Promise",
  DISPUTE: "Dispute", LEGAL: "Legal", AGENCY: "Agency", SKIP_TRACE: "Skip trace",
  NONE: "Ungrouped",
};

export const SORT_OPTIONS = [
  ["PRIORITY", "Priority"], ["RISK", "Risk"], ["OUTSTANDING", "Outstanding"],
  ["DPD", "DPD"], ["CREATED", "Created"], ["MODIFIED", "Modified"],
  ["COLLECTOR", "Collector"], ["FOLLOW_UP", "Next follow-up"],
  ["CUSTOMER", "Customer"], ["SLA", "SLA"],
] as const;

export const ESCALATION_TARGETS = [
  ["LEGAL", "Legal"], ["RECOVERY_AGENCY", "Recovery Agency"], ["SUPERVISOR", "Supervisor"],
  ["FRAUD_TEAM", "Fraud Team"], ["INVESTIGATION", "Investigation"],
  ["COLLECTIONS_MANAGER", "Collections Manager"], ["RISK_TEAM", "Risk Team"],
  ["COMPLIANCE", "Compliance"],
] as const;

export const TASK_TYPES = [
  "FOLLOW_UP", "CALLBACK", "PTP_FOLLOW_UP", "DISPUTE_REVIEW", "LEGAL_REVIEW",
  "AGENCY_REVIEW", "DOCUMENT_CHASE", "FIELD_VISIT", "OTHER",
] as const;

export interface TagRow {
  code: string; label: string; colour: string; description?: string | null;
}

export interface TicketCard {
  id: number; caseNumber: string; customerId: string;
  /** The person. The company they belong to is separate, not a substitute. */
  customerName: string; companyName?: string | null;
  customerType: string; accountCode?: string | null; outstanding: number; amount: number;
  dpd: number; dpdBucket?: string | null; priority: string; riskLevel: string;
  riskScore: number; type: string; typeName?: string | null; source: string;
  workflowState: string; stateCategory?: string | null;
  queueCode?: string | null; queueName?: string | null;
  agentId?: number | null; agentName?: string | null;
  strategy?: string | null; region?: string | null; branch?: string | null;
  product?: string | null; openedAt: string; dueDate?: string | null;
  slaDeadline?: string | null; slaBreached: boolean; slaPaused: boolean;
  hoursToSla?: number | null; slaColour: string; nextFollowUp?: string | null;
  hasPtp: boolean; ptpBroken: boolean; hasDispute: boolean; isEscalated: boolean;
  inLegal: boolean; inAgency: boolean; isWatched: boolean;
  activityCount: number; noteCount: number; attachmentCount: number; taskCount: number;
  tags: string[];
}

export interface BoardColumn {
  key: string; label: string; colour?: string | null; count: number; value: number;
  cards: TicketCard[];
}

export interface CustomerGroup {
  key: string; customerId: string; customerName: string; customerType: string;
  totalOutstanding: number; accounts: number; people: number; cases: number;
  openPtps: number;
  disputes: number; totalExposure: number; worstPriority: string; riskLevel: string;
  agentName?: string | null; unassigned: number; breached: number; tickets: TicketCard[];
}

export interface BoardResponse {
  groupBy: string; columns: BoardColumn[]; customerGroups: CustomerGroup[];
  total: number; totalValue: number;
}

export interface TaskRow {
  id: number; caseId?: number | null; caseNumber?: string | null; customerId: string;
  customerName: string; title: string; detail?: string | null; taskType: string;
  dueDate: string; dueTime?: string | null; assignedTo?: number | null;
  assignedToName?: string | null; status: string; priority: string;
  outcome?: string | null; completedAt?: string | null; outstanding: number;
  dpd: number; overdue: boolean;
}

export interface TaskDay {
  date: string; label: string; relative: string; isToday: boolean; isOverdue: boolean;
  total: number; open: number; value: number; tasks: TaskRow[];
}

export interface TaskBoard {
  days: TaskDay[]; totalOpen: number; overdue: number; today: number;
  tomorrow: number; thisWeek: number; byType: { type: string; count: number }[];
}

export interface TicketCounters {
  needsCase: number; openCases: number; inProgress: number; waitingCustomer: number;
  promiseDueToday: number; brokenPromises: number; disputes: number; legalCases: number;
  agencyCases: number; overSla: number; resolvedToday: number; collectedToday: number;
  recoveredAmount: number;
  /** Finished, waiting to be closed off — deliberately not part of openCases. */
  awaitingClose: number;
}

export interface EscalationRow {
  id: number; caseId: number; caseNumber?: string | null; customerName?: string | null;
  escalateTo: string; reason?: string | null; fromState?: string | null;
  toState?: string | null; raisedByName?: string | null; assignedToName?: string | null;
  status: string; raisedAt: string; resolvedAt?: string | null;
}

export interface BoardFilters {
  groupBy?: string; sortBy?: string; search?: string; state?: string; category?: string;
  queue?: string; source?: string; typeCode?: string; priority?: string; risk?: string;
  bucket?: string; region?: string; product?: string; portfolio?: string;
  agentId?: number; unassigned?: boolean; breached?: boolean; hasPtp?: boolean;
  hasDispute?: boolean; inLegal?: boolean; inAgency?: boolean;
  minOutstanding?: number; minDpd?: number; limit?: number;
}

export const getBoard = (f: BoardFilters = {}) =>
  apiFetch<BoardResponse>(`/collection/board${qs(f as Record<string, never>)}`);

export const getGroupOptions = () =>
  apiFetch<{ key: string; label: string }[]>("/collection/board/group-options");

export const getCounters = () => apiFetch<TicketCounters>("/collection/counters");

export const getTasks = (f: {
  mine?: boolean; agentId?: number; taskType?: string; includeDone?: boolean;
  daysAhead?: number;
} = {}) => apiFetch<TaskBoard>(`/collection/tasks${qs(f)}`);

export const createTask = (body: {
  caseId?: number | null; customerId?: string; title: string; detail?: string;
  taskType?: string; dueDate: string; dueTime?: string; assignedTo?: number;
  priority?: string;
}) => apiFetch<{ id: number }>("/collection/tasks", { method: "POST", body });

export const patchTask = (id: number, body: {
  status?: string; outcome?: string; dueDate?: string; assignedTo?: number; priority?: string;
}) => apiFetch<{ ok: boolean }>(`/collection/tasks/${id}`, { method: "PATCH", body });

export const escalateCase = (id: number, body: {
  escalateTo: string; reason: string; assignedTo?: number; queueCode?: string;
}) => apiFetch<{ ok: boolean }>(`/collection/cases/${id}/escalate`, { method: "POST", body });

export const getEscalations = (f: { target?: string; status?: string } = {}) =>
  apiFetch<EscalationRow[]>(`/collection/escalations${qs(f)}`);

export const bulkAction = (body: {
  caseIds: number[]; action: string; agentId?: number; queueCode?: string;
  priority?: string; toState?: string; tags?: string[]; followUpDate?: string;
  escalateTo?: string; reason?: string;
}) => apiFetch<{ ok: number; failed: number; messages: string[] }>(
  "/collection/cases/bulk", { method: "POST", body });

export const getTags = () => apiFetch<TagRow[]>("/collection/tags");

export const setCaseTags = (id: number, codes: string[]) =>
  apiFetch<{ ok: boolean }>(`/collection/cases/${id}/tags`, { method: "PUT", body: codes });

export const watchCase = (id: number, on = true) =>
  apiFetch<{ ok: boolean }>(`/collection/cases/${id}/watch?on=${on}`, { method: "POST" });

export interface CustomerHit {
  customerId: string; name: string; companyName?: string | null; customerType: string;
  phone?: string | null; email?: string | null; accountId?: number | null;
  accountCode?: string | null; outstanding: number; dpd: number; riskLevel: string;
  ownerName?: string | null; openCases: number;
}

export const searchCustomers = (q: string, limit = 25) =>
  apiFetch<CustomerHit[]>(`/collection/customer-search${qs({ q, limit })}`);
