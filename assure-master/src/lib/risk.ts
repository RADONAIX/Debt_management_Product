/**
 * Risk scoring rules — the component scores shown on Risk Analysis.
 *   GET   /risk/scores            definitions with their threshold ladders
 *   PATCH /risk/scores/{code}     mode (rule vs ML), weight, driver
 *   PUT   /risk/scores/{code}/bands   replace the thresholds
 */

import { apiFetch } from "./api";

export interface Band {
  id?: number;
  sortOrder?: number;
  /** null = the catch-all "everything else" rung. */
  minValue: number | null;
  score: number;
  label?: string | null;
  /** Grade shown on Subscriber 360 — Low / Medium / High. */
  bandValue?: string | null;
}

export interface ScoreDefinition {
  code: string;
  name: string;
  description?: string | null;
  mode: "RULE" | "ML";
  driverField?: string | null;
  weightPct: number;
  direction: string;
  sortOrder: number;
  isActive: boolean;
  bands: Band[];
}

export const listRiskScores = () => apiFetch<ScoreDefinition[]>("/risk/scores");
export const listRiskDrivers = () => apiFetch<string[]>("/risk/drivers");
export const updateRiskScore = (
  code: string,
  body: Partial<Pick<ScoreDefinition, "mode" | "driverField" | "weightPct" | "isActive" | "name">>,
) => apiFetch<ScoreDefinition>(`/risk/scores/${code}`, { method: "PATCH", body });
export const replaceRiskBands = (code: string, bands: Band[]) =>
  apiFetch<ScoreDefinition>(`/risk/scores/${code}/bands`, {
    method: "PUT",
    body: {
      bands: bands.map((b) => ({
        minValue: b.minValue,
        score: b.score,
        label: b.label,
        bandValue: b.bandValue,
      })),
    },
  });

// --- Scored output ---------------------------------------------------------
export interface BandSummary {
  band: string;
  lines: number;
  avgScore: number;
  exposure: number;
}

export interface RiskSummary {
  bands: BandSummary[];
  computedAt: string | null;
  scored?: number;
  notes?: string[];
}

export interface RiskProfileRow {
  name: string;
  subscriberNo: string | null;
  dpd: number;
  outstanding: number;
  financialStress: number | null;
  responsibility: number | null;
  cooperation: number | null;
  creditAwareness: number | null;
  legalAwareness: number | null;
  employmentStability: number | null;
  overall: number | null;
  band: string;
}

export const getRiskSummary = () => apiFetch<RiskSummary>("/risk/summary");
export const getRiskProfiles = () => apiFetch<RiskProfileRow[]>("/risk/profiles");
export const recalculateRisk = () => apiFetch<RiskSummary>("/risk/recalculate", { method: "POST" });
export const getScoringSql = () => apiFetch<{ sql: string; notes: string[] }>("/risk/scoring-sql");

export const recalculateProfiles = () =>
  apiFetch<{ profiles: number; mlComponents: string[] }>("/risk/recalculate-profiles", {
    method: "POST",
  });

// --- Risk-scored customers -------------------------------------------------
export interface RiskScoredCustomer {
  id: string;
  name: string;
  segment: string;
  customerType: string;
  overdueDays: number;
  outstanding: number;
  riskScore: number;
  riskBand: "low" | "medium" | "high" | "critical";
  contactability: number;
  recoveryProbability: number;
  probabilityOfDefault: number;
  creditScore: number | null;
  behaviour: string | null;
  brokenPromises: number;
  disputes: number;
  tenureMonths: number;
  avgPaymentDelay: number;
  recommendedStrategy: string | null;
  lastContact: string | null;
  // Scored components from subscriber_risk_profile.
  responsibilityScore: number | null;
  cooperationScore: number | null;
  employmentStabilityScore: number | null;
  financialLiteracyScore: number | null;
  creditAwarenessScore: number | null;
  legalAwarenessScore: number | null;
  financialStressScore: number | null;
}

export const listRiskCustomers = () => apiFetch<RiskScoredCustomer[]>("/risk/customers");

// --- ML prediction samples ------------------------------------------------
export interface MlPredictionColumn {
  key: string;
  label: string;
  dataType: string;
}

export interface MlPredictionSample {
  scoreCode: string;
  scoreName: string;
  tableName?: string | null;
  available: boolean;
  columns: MlPredictionColumn[];
  rows: Record<string, unknown>[];
  message?: string | null;
}

export const getMlPredictionSample = (code: string, limit = 10) =>
  apiFetch<MlPredictionSample>(`/risk/ml-predictions/${encodeURIComponent(code)}?limit=${limit}`);
