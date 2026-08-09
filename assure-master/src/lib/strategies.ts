/**
 * Strategy API — the Dunning Strategy Library / Designer.
 *   GET/POST /strategies, PATCH/DELETE /strategies/{code}
 *   POST /strategies/{code}/activate | /deactivate
 */

import { apiFetch } from "./api";

export const AGING_BUCKETS = ["Current", "1-30", "31-60", "61-90", "90+"] as const;
export const RISK_LEVELS = ["Low", "Medium", "High", "Critical"] as const;

export interface StrategyRow {
  id: string;
  name: string;
  description?: string | null;
  segment?: string | null;
  aging?: string[] | null;
  riskLevel?: string[] | null;
  status: string;
  version: string;
  workflow: Record<string, unknown>;
  targetAudience: Record<string, unknown>;
  abTest: Record<string, unknown>;
  settings: Record<string, unknown>;
  uplift?: number | null;
  behaviour?: string[] | null;
  emotion?: string[] | null;
  minIncome?: number | null;
  maxIncome?: number | null;
  minLoan?: number | null;
  maxLoan?: number | null;
  averageRecovery?: number | null;
  averageTurns?: number | null;
  failureRate?: number | null;
  successRate?: number | null;
  isDefault: boolean;
  activatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StrategyCreate {
  name: string;
  id?: string;
  description?: string;
  segment?: string;
  aging?: string[];
  riskLevel?: string[];
  status?: string;
  behaviour?: string[];
  emotion?: string[];
  minIncome?: number;
  maxIncome?: number;
  minLoan?: number;
  maxLoan?: number;
  successRate?: number;
  averageRecovery?: number;
  averageTurns?: number;
  workflow?: Record<string, unknown>;
  settings?: Record<string, unknown>;
}

export type StrategyUpdate = Partial<StrategyCreate> & { version?: string };

export const listStrategies = () => apiFetch<StrategyRow[]>("/strategies");
export const getStrategy = (id: string) => apiFetch<StrategyRow>(`/strategies/${id}`);
export const createStrategy = (body: StrategyCreate) =>
  apiFetch<StrategyRow>("/strategies", { method: "POST", body });
export const updateStrategy = (id: string, body: StrategyUpdate) =>
  apiFetch<StrategyRow>(`/strategies/${id}`, { method: "PATCH", body });
export const deleteStrategy = (id: string) =>
  apiFetch<{ ok: boolean }>(`/strategies/${id}`, { method: "DELETE" });
export const setStrategyActive = (id: string, active: boolean) =>
  apiFetch<StrategyRow>(`/strategies/${id}/${active ? "activate" : "deactivate"}`, {
    method: "POST",
  });

// --- Version history -------------------------------------------------------
export interface VersionRow {
  id: number;
  version: string;
  summary?: string | null;
  /** Why this version exists: BASELINE, EDIT, RESTORE or CLONE. */
  kind: string;
  changedFields: string[];
  restoredFrom?: string | null;
  author?: string | null;
  createdAt: string;
  name?: string | null;
  strategyStatus?: string | null;
  nodes: number;
  edges: number;
}

export interface VersionDetail extends VersionRow {
  snapshot: Record<string, unknown>;
}

export interface FieldDiff { field: string; before: string; after: string }
export interface VersionCompare { left: string; right: string; differences: FieldDiff[] }

export interface RestoreResult {
  ok: boolean; version: string; restoredFrom: string; changed: string[]; detail: string;
}

export const listVersions = (code: string) =>
  apiFetch<VersionRow[]>(`/strategies/${code}/versions`);

export const getVersion = (code: string, version: string) =>
  apiFetch<VersionDetail>(`/strategies/${code}/versions/${version}`);

/** Differences against another version, or against the live definition. */
export const compareVersion = (code: string, version: string, against?: string) =>
  apiFetch<VersionCompare>(
    `/strategies/${code}/versions/${version}/compare${against ? `?against=${against}` : ""}`);

/** Replace the live definition with this older version of it. */
export const restoreVersion = (code: string, version: string) =>
  apiFetch<RestoreResult>(`/strategies/${code}/versions/${version}/restore`, {
    method: "POST", body: {},
  });

/** Start a new strategy from this version, leaving the original alone. */
export const cloneVersion = (code: string, version: string,
                             body: { name: string; id?: string; description?: string }) =>
  apiFetch<StrategyRow>(`/strategies/${code}/versions/${version}/clone`, {
    method: "POST", body,
  });

// --- Simulation ------------------------------------------------------------
export interface SimChannelRate {
  channel: string; label: string; costPerTouch: number;
  reachRate: number; /** Measured from the book, or assumed — and on what. */ source: string;
}
export interface SimFactor { key: string; factor: number }

export interface SimAssumptions {
  channels: SimChannelRate[];
  promiseKeptRate: number; promiseKeptSource: string;
  settlementShare: number; settlementSource: string;
  riskFactors: SimFactor[]; ageFactors: SimFactor[];
}

export interface SimulationRequest {
  useTargeting?: boolean;
  agingBuckets?: string[];
  riskLevels?: string[];
  maxAccounts?: number;
  horizonDays?: number;
  promiseKeptRate?: number;
  settlementShare?: number;
  responseLiftPct?: number;
  save?: boolean;
  label?: string;
}

export interface SimFunnelStage { stage: string; accounts: number }
export interface SimStep {
  nodeId: string; label: string; kind: string; channel?: string | null;
  entered: number; succeeded: number; cost: number; successRate?: number | null;
}
export interface SimChannelResult {
  channel: string; touches: number; reached: number; cost: number;
  reachRate?: number | null;
}
export interface SimDay { day: number; recovered: number; touches: number; cost: number }
export interface SimOutcome {
  accountCode: string; customerName: string; outstanding: number;
  riskLevel?: string | null; bucket?: string | null; outcome: string; recovered: number;
}

export interface SimulationResult {
  strategyCode: string; strategyName: string; strategyVersion?: string | null;
  seed: number; accounts: number; exposure: number; horizonDays: number;
  touches: number; cost: number; recovered: number;
  recoveryRate?: number | null; costPerRecovered?: number | null;
  costPerAccount: number; avgDaysToSettle?: number | null;
  funnel: SimFunnelStage[]; steps: SimStep[]; channels: SimChannelResult[];
  curve: SimDay[]; sample: SimOutcome[]; assumptions: SimAssumptions;
}

export interface SimulationRunRow {
  id: number; strategyCode: string; strategyVersion?: string | null;
  label?: string | null; accounts: number; horizonDays: number;
  exposure: number; recovered: number; cost: number;
  recoveryRate?: number | null; seed: number;
  createdAt: string; createdBy?: string | null;
}

export const getSimulationAssumptions = () =>
  apiFetch<SimAssumptions>("/strategies/simulation/assumptions");

export const runSimulation = (code: string, body: SimulationRequest) =>
  apiFetch<SimulationResult>(`/strategies/${code}/simulate`, { method: "POST", body });

export const listSimulationRuns = (code?: string, limit = 20) =>
  apiFetch<SimulationRunRow[]>(
    `/strategies/simulation/runs?limit=${limit}${code ? `&code=${code}` : ""}`);

export const getSimulationRun = (id: number) =>
  apiFetch<SimulationResult>(`/strategies/simulation/runs/${id}`);
