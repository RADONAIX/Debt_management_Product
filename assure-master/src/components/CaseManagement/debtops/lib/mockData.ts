/**
 * Debtops dashboard data, DERIVED from the app's centralized portfolio.
 *
 * The dashboard components are untouched — they still import the same names
 * (mockCustomers, mockPTPs, …) with the same shapes. Everything below is
 * generated from `@/data/portfolioStore` ACCOUNTS so this screen reconciles
 * with the rest of the app instead of carrying its own roster.
 */
import { ACCOUNTS, type Account } from "@/data/portfolioStore";
import type {
  Customer360,
  PTPPromise,
  Dispute,
  CaseManagement,
  LegalEscalation,
  Invoice,
  Payment,
} from "../types/customer";

const AGENT_NAMES: Record<string, string> = {
  "AGENT-001": "John Smith",
  "AGENT-002": "Mike Johnson",
  "AGENT-003": "Jennifer Lee",
  "AGENT-004": "Lisa Davis",
  "AGENT-005": "Robert Kim",
  "AGENT-006": "Maria Garcia",
};

/** Stable per-id pseudo-value so synthesized fields never change between renders. */
const seed = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7);
const pick = <T,>(arr: T[], id: string) => arr[seed(id) % arr.length];

const COUNTRIES = ["USA", "UK", "China", "India", "Nigeria"];

const custType = (a: Account): "Consumer" | "Enterprise" =>
  a.segment === "Consumer" ? "Consumer" : "Enterprise";

/** Canonical buckets (Current/1-30/…) → the dashboard's 0-30/31-60/61-90/90+. */
const agingBucket = (a: Account): Customer360["aging_bucket"] =>
  a.agingBucket === "Current" || a.agingBucket === "1-30"
    ? "0-30"
    : (a.agingBucket as "31-60" | "61-90" | "90+");

const msisdnOf = (a: Account) => `+1-555-${String(1000 + (seed(a.customerId) % 8999)).padStart(4, "0")}`;
const banOf = (a: Account) => `BAN-${a.customerId.split("-")[1]}-${a.customerId.split("-")[2]}`;
const invoiceOf = (a: Account) => `INV-2024-${a.customerId.split("-").pop()}`;
const emailOf = (a: Account) =>
  `${a.name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@example.com`;

/** Credit score inverted from risk: 300 (worst) … 850 (best). */
const creditScore = (a: Account) => Math.round(850 - (a.riskScore / 100) * 550);

/* ── Which accounts appear ─────────────────────────────────────────────────
   A representative, stratified slice — top by exposure per segment — so the
   list stays demo-sized while spanning consumer through government.        */
const CUSTOMER_ACCOUNTS: Account[] = ["Consumer", "SMB", "Enterprise", "Government"].flatMap(
  (segment) =>
    ACCOUNTS.filter((a) => a.segment === segment && a.agingBucket !== "Current")
      .sort((x, y) => y.outstanding - x.outstanding)
      .slice(0, segment === "Consumer" ? 8 : 6),
);

export const mockCustomers: Customer360[] = CUSTOMER_ACCOUNTS.map((a) => {
  const enterprise = custType(a) === "Enterprise";
  return {
    customer_id: a.customerId,
    customer_type: custType(a),
    full_name: enterprise ? undefined : a.name,
    company_name: enterprise ? a.name : undefined,
    contact_number: msisdnOf(a),
    email: emailOf(a),
    country: pick(COUNTRIES, a.customerId),
    risk_score: a.riskScore,
    credit_score: creditScore(a),
    days_past_due: a.dpd,
    aging_bucket: agingBucket(a),
    total_outstanding: a.outstanding,
    status: a.status,
    assigned_agent: AGENT_NAMES[a.assignedAgentId] ?? a.assignedAgentId,
    ban: enterprise ? banOf(a) : undefined,
    msisdn: msisdnOf(a),
  };
});

const accountById = new Map(CUSTOMER_ACCOUNTS.map((a) => [a.customerId, a]));

/** Group builder keyed by customer id, only for accounts with the given activity. */
function byCustomer<T>(build: (a: Account) => T[]): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const a of CUSTOMER_ACCOUNTS) {
    const items = build(a);
    if (items.length) out[a.customerId] = items;
  }
  return out;
}

const daysAgo = (n: number) => {
  const d = new Date(2024, 10, 15);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

/* ── Promises to pay ─────────────────────────────────────────────────────── */
export const mockPTPs: Record<string, PTPPromise[]> = byCustomer((a) => {
  const promises: PTPPromise[] = [];
  const base = {
    customer_id: a.customerId,
    customer_type: custType(a),
    ban: custType(a) === "Enterprise" ? banOf(a) : undefined,
    msisdn: msisdnOf(a),
    invoice_no: invoiceOf(a),
  };
  for (let i = 0; i < a.ptpKept; i++)
    promises.push({ ...base, ptp_id: `PTP-${a.customerId}-K${i}`, promised_amount: Math.round(a.outstanding * 0.4), promised_date: daysAgo(5), status: "Fulfilled", created_at: daysAgo(20) });
  for (let i = 0; i < a.ptpBroken; i++)
    promises.push({ ...base, ptp_id: `PTP-${a.customerId}-B${i}`, promised_amount: Math.round(a.outstanding * 0.3), promised_date: daysAgo(3), status: "Broken", created_at: daysAgo(18) });
  if (a.ptpCreated > a.ptpKept + a.ptpBroken)
    promises.push({ ...base, ptp_id: `PTP-${a.customerId}-C`, promised_amount: Math.round(a.outstanding * 0.5), promised_date: daysAgo(-7), status: "Created", created_at: daysAgo(2) });
  return promises;
});

/* ── Disputes ────────────────────────────────────────────────────────────── */
const DISPUTE_REASONS = [
  "Incorrect amount charged",
  "Service not delivered for billed period",
  "Duplicate invoice raised",
  "Roaming charges disputed",
  "Device financing instalment mismatch",
];
export const mockDisputes: Record<string, Dispute[]> = byCustomer((a) =>
  Array.from({ length: a.disputesOpen }, (_, i) => ({
    dispute_id: `DSP-${a.customerId}-${i}`,
    customer_id: a.customerId,
    customer_type: custType(a),
    invoice_no: invoiceOf(a),
    ban: custType(a) === "Enterprise" ? banOf(a) : undefined,
    msisdn: msisdnOf(a),
    reason: pick(DISPUTE_REASONS, a.customerId + i),
    status: a.disputesPastSla ? "Investigating" : "Investigating",
    filed_date: daysAgo(20),
    amount: a.disputeValue,
  })),
);

/* ── Cases ───────────────────────────────────────────────────────────────── */
export const mockCases: Record<string, CaseManagement[]> = byCustomer((a) => {
  if (!a.caseId) return [];
  const caseType: CaseManagement["case_type"] =
    a.ptpBroken > 0 ? "Broken PTP" : a.dunningStage >= 5 ? "Legal Followup" : "Billing Issue";
  const status: CaseManagement["status"] =
    a.caseStatus === "Resolved" ? "Closed" : a.caseStatus === "Escalated" ? "In Progress" : "Open";
  return [
    {
      case_id: a.caseId,
      customer_id: a.customerId,
      customer_type: custType(a),
      case_type: caseType,
      opened_date: daysAgo(a.dpd),
      status,
      summary: `${a.strategy} in progress — ${a.dpd} days past due, ${a.contactability}% contactable.`,
      assigned_agent: AGENT_NAMES[a.assignedAgentId] ?? a.assignedAgentId,
      ban: custType(a) === "Enterprise" ? banOf(a) : undefined,
      msisdn: msisdnOf(a),
      invoice_no: invoiceOf(a),
      amount_disputed: a.disputeValue || undefined,
    },
  ];
});

/* ── Legal escalations ───────────────────────────────────────────────────── */
const AGENCIES = ["Meridian Recovery", "Apex Collections", "Sentinel Legal", "Cardinal Recovery"];
export const mockLegalEscalations: Record<string, LegalEscalation[]> = byCustomer((a) => {
  if (a.dunningStage < 5) return [];
  const recovered = Math.round(a.collectedMTD);
  return [
    {
      escalation_id: `LEG-${a.customerId}`,
      customer_id: a.customerId,
      customer_type: custType(a),
      agency_name: pick(AGENCIES, a.customerId),
      outstanding_amount: a.outstanding,
      recovered_amount: recovered,
      efficiency_score: Math.min(99, Math.round((recovered / a.outstanding) * 100) + 20),
      status: a.caseStatus === "Resolved" ? "Completed" : "Active",
      escalated_at: daysAgo(a.dpd - 20),
      ban: custType(a) === "Enterprise" ? banOf(a) : undefined,
      msisdn: msisdnOf(a),
      invoice_no: invoiceOf(a),
    },
  ];
});

/* ── Invoices ────────────────────────────────────────────────────────────── */
export const mockInvoices: Record<string, Invoice[]> = byCustomer((a) => {
  const instalment = Math.max(25, Math.round(a.outstanding / 4));
  return Array.from({ length: 4 }, (_, i) => ({
    invoice_id: `${invoiceOf(a)}-${i}`,
    account_id: a.customerId,
    bill_period_start: daysAgo(30 * (i + 1)),
    bill_period_end: daysAgo(30 * i + 1),
    due_date: daysAgo(30 * i),
    amount: instalment,
    service: a.product,
    status: i === 0 ? "Overdue" : i === 1 ? "Unpaid" : "Paid",
  }));
});

/* ── Payments ────────────────────────────────────────────────────────────── */
const METHODS = ["Bank Transfer", "Auto-Debit", "Card Payment", "Cheque"];
export const mockPayments: Record<string, Payment[]> = byCustomer((a) => {
  const instalment = Math.max(25, Math.round(a.outstanding / 4));
  return Array.from({ length: 3 }, (_, i) => ({
    payment_id: `PAY-${a.customerId}-${i}`,
    customer_id: a.customerId,
    invoice_id: `${invoiceOf(a)}-${i + 1}`,
    amount_paid: instalment,
    payment_date: daysAgo(30 * (i + 1)),
    method: pick(METHODS, a.customerId + i),
    status: "Completed",
  }));
});

/** Accounts backing the derivation, exported for mockCaseData to reuse. */
export const _customerAccounts = CUSTOMER_ACCOUNTS;
export const _agentName = (id: string) => AGENT_NAMES[id] ?? id;
export const _seed = seed;
export const _msisdn = msisdnOf;
export const _ban = banOf;
export const _invoice = invoiceOf;

/* ── Filter option lists — the values actually present in the derived data,
   so a dropdown can never offer an agent/company/country nobody has. ─────── */
export const AGENT_OPTIONS: string[] = [
  ...new Set(mockCustomers.map((c) => c.assigned_agent).filter(Boolean) as string[]),
].sort();

export const COMPANY_OPTIONS: string[] = [
  ...new Set(
    mockCustomers
      .filter((c) => c.customer_type === "Enterprise")
      .map((c) => c.company_name!)
      .filter(Boolean),
  ),
].sort();

export const COUNTRY_OPTIONS: string[] = [
  ...new Set(mockCustomers.map((c) => c.country)),
].sort();
