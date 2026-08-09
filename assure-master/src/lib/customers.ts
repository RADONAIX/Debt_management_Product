/**
 * Customer 360 API — subscriber profile and lists.
 *   GET   /customers            list / search
 *   GET   /customers/{code}     full profile
 *   PATCH /customers/{code}/profile
 */

import { apiFetch } from "./api";

export const GRADES = ["Low", "Medium", "High"] as const;

export interface CustomerRow {
  id: string;
  name: string;
  customerType: string;
  segment: string;
  riskLevel: string;
  status: string;
}

export interface CustomerProfile extends CustomerRow {
  email?: string | null;
  phone?: string | null;
  msisdn?: string | null;
  ban?: string | null;
  region: string;
  country?: string | null;
  city?: string | null;
  address?: string | null;
  creditScore?: number | null;
  riskScore: number;
  contactability: number;
  bestContactTime?: string | null;
  bestChannel?: string | null;
  onboardedOn?: string | null;
  // Subscriber profile
  behaviourType?: string | null;
  preferredLanguage?: string | null;
  communicationPreference?: string | null;
  occupation?: string | null;
  monthlyIncome?: number | null;
  financialStress?: string | null;
  legalAwareness?: string | null;
  financialLiteracy?: string | null;
  responsibilityScore?: number | null;
  creditAwareness?: string | null;
  riskAppetite?: string | null;
  emotionalState?: string | null;
  lifeEvent?: string | null;
  employmentStability?: string | null;
  cooperationScore?: number | null;
  preferredContactTime?: string | null;
}

export type CustomerProfileUpdate = Partial<
  Pick<
    CustomerProfile,
    | "behaviourType"
    | "preferredLanguage"
    | "communicationPreference"
    | "occupation"
    | "monthlyIncome"
    | "financialStress"
    | "legalAwareness"
    | "financialLiteracy"
    | "responsibilityScore"
    | "creditAwareness"
    | "riskAppetite"
    | "emotionalState"
    | "lifeEvent"
    | "employmentStability"
    | "cooperationScore"
    | "preferredContactTime"
  >
>;

export const listCustomers = (search?: string) =>
  apiFetch<CustomerRow[]>(`/customers?limit=200${search ? `&search=${encodeURIComponent(search)}` : ""}`);

/** Individuals only — organisations are picked from the company list. */
export const listConsumers = () =>
  apiFetch<CustomerRow[]>("/customers?customerType=CONSUMER&limit=200");
export const getCustomer = (code: string) => apiFetch<CustomerProfile>(`/customers/${code}`);
export const updateCustomerProfile = (code: string, body: CustomerProfileUpdate) =>
  apiFetch<CustomerProfile>(`/customers/${code}/profile`, { method: "PATCH", body });

export interface TrendPoint { month: string; score: number }
export interface PaymentPoint { month: string; amount: number; status: string }

/** Everything the Customer 360 screen renders, straight from the database. */
export interface Customer360 extends CustomerProfile {
  subscriberNo?: string | null;
  companyName?: string | null;
  branch?: string | null;
  department?: string | null;
  billingAccountNumber?: string | null;
  invoiceNumber?: string | null;
  invoiceType?: string | null;
  serviceType?: string | null;
  plan?: string | null;
  accountStatus?: string | null;
  activationDate?: string | null;
  outstanding?: number | null;
  totalOutstanding?: number | null;
  lineCount?: number;
  currency?: string;
  companyCode?: string | null;
  currentDpd?: number | null;
  agingBucket?: string | null;
  assignedStrategy?: string | null;
  assignedAgent?: string | null;
  lastPaymentDate?: string | null;
  lastContactDate?: string | null;
  nextFollowupDate?: string | null;
  riskTrend: TrendPoint[];
  paymentHistory: PaymentPoint[];
  lastPaymentAmount?: number | null;
  disputeRate: number;
  ptpSuccess: number;
  communications: number;
  dunningStage: number;
  caseId?: string | null;
  caseStatus?: string | null;
  ptpStatus?: string | null;
  nextAction?: string | null;
  riskDrivers: string[];
}

export const getCustomer360 = (code: string) => apiFetch<Customer360>(`/customers/${code}/360`);

// --- Borrower 360 tabs -----------------------------------------------------
export interface BorrowerFile {
  invoices: { invoiceNo: string; product?: string | null; dueDate: string; amount: number;
              paid: number; status: string; invoiceType: string }[];
  payments: { reference: string; date: string; amount: number; method?: string | null;
              status: string; invoiceNo?: string | null }[];
  interactions: { occurredAt: string; type: string; channel?: string | null; direction: string;
                  subject?: string | null; outcome?: string | null; agent?: string | null;
                  automated: boolean }[];
  disputes: { disputeCode: string; reason: string; description?: string | null; amount: number;
              status: string; priority: string; filedAt: string; slaDeadline?: string | null }[];
  milestones: { label: string; date?: string | null; status: string; detail?: string | null }[];
}

export const getBorrowerFile = (code: string) =>
  apiFetch<BorrowerFile>(`/customers/${code}/borrower`);

// --- Enterprise hierarchy --------------------------------------------------
export interface SubscriberRow {
  id: string; name: string; subscriberNo?: string | null; servicePlan?: string | null;
  ban?: string | null; outstanding: number; dpd: number; riskLevel: string; status: string;
}
export interface BranchRow {
  id: string; name: string; city?: string | null; isHeadOffice: boolean;
  subscribers: number; outstanding: number; subscriberList: SubscriberRow[];
}
export interface CompanyRow {
  id: string; name: string; industry?: string | null; hqCity?: string | null;
  branches: number; subscribers: number; bans: string[]; outstanding: number;
}
export interface CompanyDetail extends CompanyRow { branchList: BranchRow[] }

export const listCompanies = () => apiFetch<CompanyRow[]>("/companies");
export const getCompany = (code: string) => apiFetch<CompanyDetail>(`/companies/${code}`);

export const getCompany360 = (code: string) => apiFetch<Customer360>(`/companies/${code}/360`);
export const getCompanyBorrower = (code: string) =>
  apiFetch<BorrowerFile>(`/companies/${code}/borrower`);

// --- Behavioural signals ---------------------------------------------------
export interface SubscriberSignals {
  behaviourType?: string | null;
  riskBand?: string | null;
  recommendedStrategy?: string | null;
  accountAgeMonths?: number | null;
  invoicesLast12m?: number | null;
  invoicesPaidOnTime?: number | null;
  onTimePct?: number | null;
  avgPaymentDelayDays?: number | null;
  ptpCount?: number | null;
  ptpHonoured?: number | null;
  ptpBroken?: number | null;
  disputesRaised?: number | null;
  complaintsRaised?: number | null;
  successfulContacts?: number | null;
  failedContacts?: number | null;
  smsResponseRate?: number | null;
  emailResponseRate?: number | null;
  callAnswerRate?: number | null;
  legalNotices?: number | null;
  settlements?: number | null;
  writeoffs?: number | null;
  financialStressScore?: number | null;
  responsibilityScore?: number | null;
  cooperationScore?: number | null;
  creditAwarenessScore?: number | null;
  legalAwarenessScore?: number | null;
  financialLiteracyScore?: number | null;
  employmentStabilityScore?: number | null;
  overallRiskScore?: number | null;
  lastCalculated?: string | null;
}

export const getSubscriberSignals = (code: string) =>
  apiFetch<SubscriberSignals | null>(`/customers/${code}/signals`);
