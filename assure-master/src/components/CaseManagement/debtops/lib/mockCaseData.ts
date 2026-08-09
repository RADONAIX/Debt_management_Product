/**
 * Case-view cards, DERIVED from the centralized portfolio.
 *
 * mockConsumerCases / mockEnterpriseCases / getEnterpriseGroups keep the exact
 * shapes the card + drawer components read; their contents come from the same
 * accounts as the rest of the dashboard (via lib/mockData).
 */
import {
  _customerAccounts as CUSTOMER_ACCOUNTS,
  _agentName,
  _msisdn,
  _ban,
  _invoice,
} from "./mockData";
import type { Account } from "@/data/portfolioStore";

const daysAgo = (n: number) => {
  const d = new Date(2024, 10, 15);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

const consumerCategory = (a: Account) =>
  a.ptpBroken > 0 ? "Broken PTP"
  : a.disputesOpen > 0 ? "Dispute"
  : a.dunningStage >= 5 ? "Legal Followup"
  : "Billing Issue";

const consumerStatus = (a: Account) =>
  a.caseStatus === "Resolved" ? "Closed"
  : a.caseStatus === "Escalated" || a.caseStatus === "In Progress" ? "In Progress"
  : "Open";

const notesFor = (a: Account, prefix: string) => [
  { id: `${prefix}-N1`, content: `${a.strategy} opened at ${a.dpd} days past due.`, timestamp: daysAgo(a.dpd), author: _agentName(a.assignedAgentId) },
  ...(a.ptpBroken > 0
    ? [{ id: `${prefix}-N2`, content: `${a.ptpBroken} promise(s) to pay broken — re-engagement required.`, timestamp: daysAgo(5), author: _agentName(a.assignedAgentId) }]
    : []),
  ...(a.disputesOpen > 0
    ? [{ id: `${prefix}-N3`, content: `Dispute raised; collection activity on hold.`, timestamp: daysAgo(7), author: "System" }]
    : []),
];

const todosFor = (a: Account, prefix: string) =>
  [
    a.contactability < 40 ? { id: `${prefix}-T1`, task: "Trace and refresh contact details", completed: false, dueDate: daysAgo(-3) } : null,
    a.ptpBroken > 0 ? { id: `${prefix}-T2`, task: "Require part-payment before new PTP", completed: false, dueDate: daysAgo(-2) } : null,
    { id: `${prefix}-T3`, task: `Follow up via ${a.channel}`, completed: a.contactSuccesses > 0, dueDate: daysAgo(-5) },
  ].filter(Boolean);

/* ── Consumer cases ──────────────────────────────────────────────────────── */
export const mockConsumerCases = CUSTOMER_ACCOUNTS.filter(
  (a) => a.segment === "Consumer" && a.caseId,
).map((a) => ({
  id: a.caseId!,
  customerName: a.name,
  msisdn: _msisdn(a),
  invoiceNo: _invoice(a),
  caseCategory: consumerCategory(a),
  amountDisputed: a.disputeValue || Math.round(a.outstanding * 0.3),
  riskScore: a.riskScore,
  daysPastDue: a.dpd,
  status: consumerStatus(a),
  agentName: _agentName(a.assignedAgentId),
  notes: notesFor(a, a.customerId),
  todos: todosFor(a, a.customerId),
}));

/* ── Enterprise cases ────────────────────────────────────────────────────── */
const enterpriseCategory = (a: Account) =>
  a.disputesOpen > 0 ? "Service Dispute" : a.dpd > 60 ? "Usage Dispute" : "Billing Issue";

export const mockEnterpriseCases = CUSTOMER_ACCOUNTS.filter(
  (a) => a.segment !== "Consumer" && a.caseId,
).map((a) => ({
  id: a.caseId!,
  employeeName: a.name,
  companyName: a.name,
  ban: _ban(a),
  msisdn: _msisdn(a),
  invoiceNo: _invoice(a),
  caseCategory: enterpriseCategory(a),
  amountDisputed: a.disputeValue || Math.round(a.outstanding * 0.3),
  caseType: a.outstanding > 50_000 ? "BAN-level" : "MSISDN-level",
  enterpriseGroup: a.name,
  enterpriseAccount: `${a.segment}-Primary`,
  enterpriseSubaccount: `${a.customerId}`,
  site: `${a.region} Region`,
  agentName: _agentName(a.assignedAgentId),
  notes: notesFor(a, a.customerId),
  todos: todosFor(a, a.customerId),
}));

/* ── Enterprise groups (grouped-by-company view) ─────────────────────────── */
export const getEnterpriseGroups = () => {
  const groups: Record<string, any> = {};

  mockEnterpriseCases.forEach((c) => {
    if (!groups[c.ban]) {
      groups[c.ban] = {
        enterpriseGroup: c.enterpriseGroup,
        enterpriseAccount: c.enterpriseAccount,
        enterpriseSubaccount: c.enterpriseSubaccount,
        site: c.site,
        ban: c.ban,
        totalUsers: 0,
        totalOutstanding: 0,
        totalPaid: 0,
        totalDisputed: 0,
        totalCases: 0,
        avgRiskScore: 0,
        avgDaysPastDue: 0,
        largestInvoice: c.invoiceNo,
        topMSISDNs: [] as { msisdn: string; debt: number }[],
        customers: [] as any[],
        _riskSum: 0,
        _dpdSum: 0,
        notes: [
          { id: `GN-${c.ban}-1`, content: "Company accounts consolidated under this BAN.", timestamp: daysAgo(10), author: "Operations Team" },
        ],
        todos: [
          { id: `GT-${c.ban}-1`, task: "Review outstanding invoices for this company", completed: false, dueDate: daysAgo(-7) },
        ],
      };
    }

    const acc = CUSTOMER_ACCOUNTS.find((a) => a.caseId === c.id)!;
    const g = groups[c.ban];
    const outstanding = acc.outstanding;
    const disputed = c.amountDisputed;
    const paid = acc.collectedMTD;

    g.totalUsers += 1;
    g.totalOutstanding += outstanding;
    g.totalPaid += paid;
    g.totalDisputed += disputed;
    g.totalCases += 1;
    g._riskSum += acc.riskScore;
    g._dpdSum += acc.dpd;
    g.topMSISDNs.push({ msisdn: c.msisdn, debt: outstanding });
    g.customers.push({
      customerName: c.employeeName,
      msisdn: c.msisdn,
      invoiceNo: c.invoiceNo,
      outstanding,
      disputed,
      paid,
      riskScore: acc.riskScore,
      daysPastDue: acc.dpd,
      status: consumerStatus(acc),
      agentName: c.agentName,
    });
  });

  Object.values(groups).forEach((g: any) => {
    g.avgRiskScore = Math.round(g._riskSum / g.totalUsers);
    g.avgDaysPastDue = Math.round(g._dpdSum / g.totalUsers);
    g.topMSISDNs.sort((a: any, b: any) => b.debt - a.debt);
    g.topMSISDNs = g.topMSISDNs.slice(0, 5);
    delete g._riskSum;
    delete g._dpdSum;
  });

  return Object.values(groups);
};
