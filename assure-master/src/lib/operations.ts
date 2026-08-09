/**
 * Operations API — how the platform itself is configured.
 * Currently: AI Guardrails, stored in the `operations` schema.
 */

import { apiFetch } from "./api";

export const GUARDRAIL_ACTIONS = ["BLOCK", "MASK", "REWRITE", "FLAG", "ESCALATE", "ALLOW"] as const;
export const SEVERITIES = ["Low", "Medium", "High", "Critical"] as const;

export interface GuardrailRow {
  id: number;
  kind: "INPUT_FILTER" | "OUTPUT_FILTER" | "ESCALATION_RULE" | "PROMPT_TEMPLATE";
  code: string;
  label: string;
  description?: string | null;
  action: string;
  severity: string;
  config: Record<string, unknown>;
  isEnabled: boolean;
  /** Built-in rules can be disabled but not deleted. */
  isSystem: boolean;
  sortOrder: number;
  updatedAt: string;
  updatedBy?: string | null;
  hits30d: number;
}

export interface DayCount {
  day: string; blocked: number; masked: number; escalated: number; other: number;
}

export interface GuardrailStats {
  rules: number;
  enabled: number;
  events30d: number;
  blocked30d: number;
  escalated30d: number;
  interventionRate?: number | null;
  byDay: DayCount[];
  topRules: { code: string; label: string; hits: number; outcome: string }[];
}

export interface Guardrails {
  inputFilters: GuardrailRow[];
  outputFilters: GuardrailRow[];
  escalationRules: GuardrailRow[];
  promptTemplates: GuardrailRow[];
  stats: GuardrailStats;
}

export interface EventRow {
  id: number; code: string; label?: string | null; kind: string; outcome: string;
  channel: string; sample?: string | null; detail?: string | null; createdAt: string;
}

export interface AuditRow {
  id: number; code: string; action: string; fieldName?: string | null;
  oldValue?: string | null; newValue?: string | null; reason?: string | null;
  actor?: string | null; createdAt: string;
}

export const getGuardrails = () => apiFetch<Guardrails>("/operations/guardrails");

export const getGuardrailEvents = (params: {
  kind?: string; outcome?: string; limit?: number;
} = {}) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v != null && q.set(k, String(v)));
  const s = q.toString();
  return apiFetch<EventRow[]>(`/operations/guardrails/events${s ? `?${s}` : ""}`);
};

export const getGuardrailAudit = (limit = 40) =>
  apiFetch<AuditRow[]>(`/operations/guardrails/audit?limit=${limit}`);

export const createGuardrail = (body: {
  kind: string; label: string; description?: string; action?: string;
  severity?: string; config?: Record<string, unknown>; isEnabled?: boolean;
}) => apiFetch<{ id: number }>("/operations/guardrails", { method: "POST", body });

export const patchGuardrail = (id: number, body: {
  label?: string; description?: string; action?: string; severity?: string;
  config?: Record<string, unknown>; isEnabled?: boolean; reason?: string;
}) => apiFetch<{ ok: boolean }>(`/operations/guardrails/${id}`, { method: "PATCH", body });

export const deleteGuardrail = (id: number) =>
  apiFetch<{ ok: boolean }>(`/operations/guardrails/${id}`, { method: "DELETE" });

// --- Agent Performance -----------------------------------------------------
export interface PerfMonth {
  month: string; collected: number; target: number; attainment?: number | null;
  casesAssigned: number; casesResolved: number; ptpCreated: number; ptpKept: number;
  contacts: number; slaBreaches: number;
}

export interface PeerLine {
  agentId: number; agentName: string; collected: number; target: number;
  attainment?: number | null; openCases: number; breached: number; isMe: boolean;
}

export interface NextAction {
  caseId: number; caseNumber: string; customerId: string; customerName: string;
  caseType?: string | null; priority: string; outstanding: number;
  hoursToSla: number; reason: string;
}

export interface AgentPerformance {
  agentId: number; agentName: string; email?: string | null;
  employeeCode?: string | null; skillGroup?: string | null; expertise?: string | null;
  languages: string[]; specializations: string[]; availability?: string | null;
  hiredOn?: string | null; yearsExperience?: number | null; rating?: number | null;

  collectedMtd: number; collectedToday: number; target: number;
  attainment?: number | null; payments: number;

  portfolio: number; customers: number; accounts: number;
  openCases: number; notStarted: number; closedThisMonth: number;
  maxCaseload?: number | null; caseloadPct?: number | null;
  slaBreached: number; slaDueSoon: number; slaCompliance?: number | null;
  avgDaysToClose?: number | null;

  openPromises: number; openPromiseValue: number; promisesDueToday: number;
  promisesKept: number; promisesBroken: number; keptRate?: number | null;

  contactsMtd: number; contactsToday: number; contactsReached: number;
  reachRate?: number | null;

  tasksTotal: number; tasksDone: number; tasksOverdue: number; tasksDueToday: number;
  taskCompletion?: number | null;

  openDisputes: number; disputesSettledMtd: number;

  rank?: number | null; ofAgents: number;
  history: PerfMonth[]; floor: PeerLine[]; nextUp: NextAction[];
}

/** One collector's performance — the server decides whose. */
export const getAgentPerformance = (agentId?: number | null) =>
  apiFetch<AgentPerformance>(
    `/operations/performance${agentId ? `?agentId=${agentId}` : ""}`);
