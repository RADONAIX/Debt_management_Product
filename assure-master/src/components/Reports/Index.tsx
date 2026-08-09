import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { useCustomerType } from "@/contexts/CustomerTypeContext";
import { money } from "@/lib/money";
import {
  getAgencyEscalations,
  getDisputes,
  getLegalEscalations,
  getPtps,
  getReportOptions,
  type AgencyRow,
  type DisputeRow,
  type LegalRow,
  type PtpRow,
  type ReportFilterOptions,
} from "@/lib/reports";
import { RegisterTab } from "./components/RegisterTab";
import type { Column } from "./components/ReportTable";
import type { SelectFilter } from "./components/ReportFilterBar";
import type { CsvColumn } from "./utils/exportReports";

/** Status colouring is by meaning, not by table — "open" reads the same everywhere. */
const TONE: Record<string, string> = {
  KEPT: "bg-success/10 text-success border-success/20",
  PENDING: "bg-warning/10 text-warning border-warning/20",
  BROKEN: "bg-destructive/10 text-destructive border-destructive/25",
  CANCELLED: "bg-muted text-muted-foreground border-border",
  OPEN: "bg-warning/10 text-warning border-warning/20",
  INVESTIGATING: "bg-primary/10 text-primary border-primary/20",
  ESCALATED: "bg-destructive/10 text-destructive border-destructive/25",
  APPROVED: "bg-success/10 text-success border-success/20",
  REJECTED: "bg-muted text-muted-foreground border-border",
  RESOLVED: "bg-success/10 text-success border-success/20",
  WON: "bg-success/10 text-success border-success/20",
  LOST: "bg-destructive/10 text-destructive border-destructive/25",
  SETTLED: "bg-success/10 text-success border-success/20",
  WITHDRAWN: "bg-muted text-muted-foreground border-border",
  ACTIVE: "bg-primary/10 text-primary border-primary/20",
  RECALLED: "bg-warning/10 text-warning border-warning/20",
  CLOSED: "bg-muted text-muted-foreground border-border",
  LEGAL: "bg-destructive/10 text-destructive border-destructive/25",
  Critical: "bg-destructive/20 text-destructive border-destructive/40",
  High: "bg-destructive/10 text-destructive border-destructive/25",
  Medium: "bg-warning/10 text-warning border-warning/20",
  Low: "bg-muted text-muted-foreground border-border",
};

const Pill = ({ value }: { value: string }) => (
  <span
    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
      TONE[value] ?? "bg-muted text-muted-foreground border-border"
    }`}
  >
    {value}
  </span>
);

const fmtDate = (v?: string | null) =>
  v
    ? new Date(v).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

const pct = (v?: number | null) => (v === null || v === undefined ? "—" : `${v.toFixed(0)}%`);

/**
 * What created the row: the system, or a person.
 *
 * The label is one of exactly two values. The sub-line carries what the label
 * leaves out — the specific trigger, the agent, or the agency.
 */
const Source = ({ label, detail }: { label: string; detail: string | null }) => (
  <div className="min-w-0">
    <div className="text-foreground">{label}</div>
    {detail && detail !== label && (
      <div className="text-xs text-muted-foreground truncate max-w-[200px]">{detail}</div>
    )}
  </div>
);

/** Name over code — the identity of the row in one cell. */
const Party = ({ name, id }: { name: string; id: string }) => (
  <div className="min-w-0">
    <div className="font-medium text-foreground truncate max-w-[220px]">{name}</div>
    <div className="text-xs text-muted-foreground">{id}</div>
  </div>
);

// ---------------------------------------------------------------------------
// Promises to pay
// ---------------------------------------------------------------------------
const ptpColumns: Column<PtpRow>[] = [
  { key: "code", header: "PTP", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
  {
    key: "customer",
    header: "Customer",
    sortKey: "customerName",
    cell: (r) => <Party name={r.customerName} id={r.customerId} />,
  },
  {
    key: "account",
    header: "Account",
    cell: (r) => <span className="font-mono text-xs">{r.accountCode ?? "—"}</span>,
  },
  {
    key: "promised",
    header: "Promised",
    sortKey: "promisedAmount",
    align: "right",
    cell: (r) => money(r.promisedAmount),
  },
  {
    key: "kept",
    header: "Paid",
    sortKey: "keptAmount",
    align: "right",
    cell: (r) => (
      <span className={r.keptAmount > 0 ? "text-success" : "text-muted-foreground"}>
        {money(r.keptAmount)}
      </span>
    ),
  },
  {
    key: "date",
    header: "Promised date",
    sortKey: "promisedDate",
    cell: (r) => fmtDate(r.promisedDate),
  },
  {
    key: "overdue",
    header: "Overdue",
    sortKey: "daysOverdue",
    align: "right",
    cell: (r) =>
      r.daysOverdue > 0 ? (
        <span className="text-destructive font-medium">{r.daysOverdue}d</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  { key: "status", header: "Status", sortKey: "status", cell: (r) => <Pill value={r.status} /> },
  { key: "channel", header: "Channel", cell: (r) => r.channel ?? "—" },
  {
    key: "source",
    header: "Source",
    sortKey: "source",
    cell: (r) => <Source label={r.source} detail={r.sourceDetail ?? r.agentName} />,
  },
];

const ptpCsv: CsvColumn<PtpRow>[] = [
  { header: "PTP", value: (r) => r.code },
  { header: "Customer", value: (r) => r.customerName },
  { header: "Customer ID", value: (r) => r.customerId },
  { header: "Account", value: (r) => r.accountCode },
  { header: "Promised", value: (r) => r.promisedAmount },
  { header: "Paid", value: (r) => r.keptAmount },
  { header: "Promised date", value: (r) => r.promisedDate },
  { header: "Days overdue", value: (r) => r.daysOverdue },
  { header: "Status", value: (r) => r.status },
  { header: "Channel", value: (r) => r.channel },
  { header: "Source", value: (r) => r.source },
  { header: "Created by", value: (r) => r.sourceDetail ?? r.agentName },
];

// ---------------------------------------------------------------------------
// Disputes
// ---------------------------------------------------------------------------
const disputeColumns: Column<DisputeRow>[] = [
  {
    key: "code",
    header: "Dispute",
    cell: (r) => <span className="font-mono text-xs">{r.code}</span>,
  },
  {
    key: "customer",
    header: "Customer",
    sortKey: "customerName",
    cell: (r) => <Party name={r.customerName} id={r.customerId} />,
  },
  { key: "reason", header: "Reason", cell: (r) => r.reason },
  {
    key: "amount",
    header: "Amount",
    sortKey: "amount",
    align: "right",
    cell: (r) => money(r.amount),
  },
  {
    key: "priority",
    header: "Priority",
    sortKey: "priority",
    cell: (r) => <Pill value={r.priority} />,
  },
  { key: "status", header: "Status", sortKey: "status", cell: (r) => <Pill value={r.status} /> },
  { key: "filed", header: "Filed", sortKey: "filedAt", cell: (r) => fmtDate(r.filedAt) },
  {
    key: "sla",
    header: "SLA due",
    sortKey: "slaDeadline",
    cell: (r) => (
      <span className={r.slaBreached ? "text-destructive font-medium" : ""}>
        {fmtDate(r.slaDeadline)}
        {r.slaBreached ? " · breached" : ""}
      </span>
    ),
  },
  { key: "age", header: "Age", align: "right", cell: (r) => `${r.ageDays}d` },
  {
    key: "source",
    header: "Source",
    sortKey: "source",
    cell: (r) => <Source label={r.source} detail={r.sourceDetail} />,
  },
  {
    key: "agent",
    header: "Owner",
    cell: (r) => <span className="text-muted-foreground">{r.agentName ?? "Unassigned"}</span>,
  },
];

const disputeCsv: CsvColumn<DisputeRow>[] = [
  { header: "Dispute", value: (r) => r.code },
  { header: "Customer", value: (r) => r.customerName },
  { header: "Customer ID", value: (r) => r.customerId },
  { header: "Account", value: (r) => r.accountCode },
  { header: "Reason", value: (r) => r.reason },
  { header: "Amount", value: (r) => r.amount },
  { header: "Priority", value: (r) => r.priority },
  { header: "Status", value: (r) => r.status },
  { header: "Filed", value: (r) => r.filedAt },
  { header: "SLA due", value: (r) => r.slaDeadline },
  { header: "SLA breached", value: (r) => (r.slaBreached ? "Yes" : "No") },
  { header: "Resolved", value: (r) => r.resolvedAt },
  { header: "Age (days)", value: (r) => r.ageDays },
  { header: "Source", value: (r) => r.source },
  { header: "Created by", value: (r) => r.sourceDetail },
  { header: "Owner", value: (r) => r.agentName },
];

// ---------------------------------------------------------------------------
// Legal escalations
// ---------------------------------------------------------------------------
const legalColumns: Column<LegalRow>[] = [
  { key: "code", header: "Case", cell: (r) => <span className="font-mono text-xs">{r.code}</span> },
  {
    key: "customer",
    header: "Customer",
    sortKey: "customerName",
    cell: (r) => <Party name={r.customerName} id={r.customerId} />,
  },
  {
    key: "claim",
    header: "Claim",
    sortKey: "claimAmount",
    align: "right",
    cell: (r) => money(r.claimAmount),
  },
  {
    key: "recovered",
    header: "Recovered",
    sortKey: "recoveredAmount",
    align: "right",
    cell: (r) => (
      <span className={r.recoveredAmount > 0 ? "text-success" : "text-muted-foreground"}>
        {money(r.recoveredAmount)}
      </span>
    ),
  },
  { key: "cost", header: "Legal cost", align: "right", cell: (r) => money(r.legalCost) },
  { key: "stage", header: "Stage", sortKey: "stage", cell: (r) => r.stage },
  { key: "status", header: "Status", sortKey: "status", cell: (r) => <Pill value={r.status} /> },
  { key: "firm", header: "Law firm", cell: (r) => r.lawFirm ?? "—" },
  { key: "filed", header: "Filed", sortKey: "filedOn", cell: (r) => fmtDate(r.filedOn) },
  {
    key: "hearing",
    header: "Next hearing",
    sortKey: "nextHearing",
    cell: (r) => fmtDate(r.nextHearing),
  },
  {
    key: "success",
    header: "Success",
    align: "right",
    cell: (r) => pct(r.successProbability),
  },
  {
    key: "source",
    header: "Source",
    sortKey: "source",
    cell: (r) => <Source label={r.source} detail={r.sourceDetail} />,
  },
];

const legalCsv: CsvColumn<LegalRow>[] = [
  { header: "Case", value: (r) => r.code },
  { header: "Customer", value: (r) => r.customerName },
  { header: "Customer ID", value: (r) => r.customerId },
  { header: "Claim", value: (r) => r.claimAmount },
  { header: "Recovered", value: (r) => r.recoveredAmount },
  { header: "Legal cost", value: (r) => r.legalCost },
  { header: "Stage", value: (r) => r.stage },
  { header: "Status", value: (r) => r.status },
  { header: "Law firm", value: (r) => r.lawFirm },
  { header: "Court", value: (r) => r.court },
  { header: "Filed", value: (r) => r.filedOn },
  { header: "Next hearing", value: (r) => r.nextHearing },
  { header: "Success probability", value: (r) => r.successProbability },
  { header: "Age (days)", value: (r) => r.ageDays },
  { header: "Source", value: (r) => r.source },
  { header: "Escalated by", value: (r) => r.sourceDetail },
];

// ---------------------------------------------------------------------------
// Agency escalations
// ---------------------------------------------------------------------------
const agencyColumns: Column<AgencyRow>[] = [
  {
    key: "code",
    header: "Placement",
    cell: (r) => <span className="font-mono text-xs">{r.code}</span>,
  },
  { key: "agency", header: "Agency", sortKey: "agencyName", cell: (r) => r.agencyName },
  {
    key: "customer",
    header: "Customer",
    sortKey: "customerName",
    cell: (r) => <Party name={r.customerName} id={r.customerId} />,
  },
  {
    key: "placed",
    header: "Placed",
    sortKey: "placedAmount",
    align: "right",
    cell: (r) => money(r.placedAmount),
  },
  {
    key: "recovered",
    header: "Recovered",
    sortKey: "recoveredAmount",
    align: "right",
    cell: (r) => (
      <span className={r.recoveredAmount > 0 ? "text-success" : "text-muted-foreground"}>
        {money(r.recoveredAmount)}
      </span>
    ),
  },
  {
    key: "open",
    header: "Open",
    sortKey: "openAmount",
    align: "right",
    cell: (r) => money(r.openAmount),
  },
  {
    key: "rate",
    header: "Recovery",
    sortKey: "recoveryPct",
    align: "right",
    cell: (r) => `${r.recoveryPct.toFixed(1)}%`,
  },
  {
    key: "priority",
    header: "Priority",
    cell: (r) => <Pill value={r.priority} />,
  },
  { key: "status", header: "Status", sortKey: "status", cell: (r) => <Pill value={r.status} /> },
  {
    key: "dpd",
    header: "DPD",
    sortKey: "dpd",
    align: "right",
    cell: (r) => r.dpd,
  },
  { key: "placedOn", header: "Placed", sortKey: "placedOn", cell: (r) => fmtDate(r.placedOn) },
  {
    key: "recall",
    header: "Recall due",
    sortKey: "recallDue",
    cell: (r) => (
      <span className={r.overdueRecall ? "text-destructive font-medium" : ""}>
        {fmtDate(r.recallDue)}
        {r.overdueRecall ? " · overdue" : ""}
      </span>
    ),
  },
  {
    key: "source",
    header: "Source",
    sortKey: "source",
    cell: (r) => <Source label={r.source} detail={r.sourceDetail} />,
  },
];

const agencyCsv: CsvColumn<AgencyRow>[] = [
  { header: "Placement", value: (r) => r.code },
  { header: "Agency", value: (r) => r.agencyName },
  { header: "Customer", value: (r) => r.customerName },
  { header: "Customer ID", value: (r) => r.customerId },
  { header: "Account", value: (r) => r.accountCode },
  { header: "Placed", value: (r) => r.placedAmount },
  { header: "Recovered", value: (r) => r.recoveredAmount },
  { header: "Open", value: (r) => r.openAmount },
  { header: "Recovery %", value: (r) => r.recoveryPct },
  { header: "Priority", value: (r) => r.priority },
  { header: "Status", value: (r) => r.status },
  { header: "DPD", value: (r) => r.dpd },
  { header: "Placed on", value: (r) => r.placedOn },
  { header: "Recall due", value: (r) => r.recallDue },
  { header: "Days with agency", value: (r) => r.daysWithAgency },
  { header: "Recall overdue", value: (r) => (r.overdueRecall ? "Yes" : "No") },
  { header: "Source", value: (r) => r.source },
  { header: "Placed by", value: (r) => r.sourceDetail },
];

export type RegisterKey = "ptp" | "dispute" | "legal" | "agency";

/** What each register is called on screen, matching the sidebar. */
const REGISTER_TITLES: Record<RegisterKey, { title: string; description: string }> = {
  ptp: {
    title: "Promises to Pay",
    description: "Every promise on the book — what was agreed, what was paid, and what is overdue.",
  },
  dispute: {
    title: "Disputes",
    description: "What customers are contesting, who owns it, and whether the SLA still holds.",
  },
  legal: {
    title: "Legal Escalations",
    description: "Cases with the courts — the claim, the cost of pursuing it, and what came back.",
  },
  agency: {
    title: "Agency Escalations",
    description: "Accounts placed with external agencies — what was handed over and what was recovered.",
  },
};

interface ReportsProps {
  /** Which register to show. The sidebar owns this; defaults to promises. */
  register?: RegisterKey;
}

/**
 * Performance Reports.
 *
 * Four registers of collections work, read live from the database: promises to
 * pay, disputes, legal escalations and agency escalations. Each is a table
 * with its own filters — no derived charts, so what is shown is what is stored.
 *
 * The register is chosen from the app sidebar, so it is a real navigation
 * destination: it survives a refresh and the header names it.
 */
const Reports = ({ register = "ptp" }: ReportsProps) => {
  const tab = register;
  const [options, setOptions] = useState<ReportFilterOptions | null>(null);
  const { customerType } = useCustomerType();

  const scope = customerType === "normal" ? "consumer" : customerType;

  useEffect(() => {
    getReportOptions()
      .then(setOptions)
      .catch(() => setOptions(null));
  }, []);

  const selects = useMemo(() => {
    const shared: SelectFilter[] = [
      { key: "customerType", label: "Customer type", options: options?.customerTypes ?? [] },
      { key: "region", label: "Region", options: options?.regions ?? [] },
    ];
    return {
      ptp: [
        { key: "source", label: "Source", options: options?.ptpSources ?? [] },
        { key: "status", label: "Status", options: options?.ptpStatuses ?? [] },
        { key: "channel", label: "Channel", options: options?.ptpChannels ?? [] },
        ...shared,
      ] as SelectFilter[],
      dispute: [
        { key: "source", label: "Source", options: options?.disputeSources ?? [] },
        { key: "status", label: "Status", options: options?.disputeStatuses ?? [] },
        { key: "priority", label: "Priority", options: options?.disputePriorities ?? [] },
        { key: "reason", label: "Reason", options: options?.disputeReasons ?? [] },
        ...shared,
      ] as SelectFilter[],
      legal: [
        { key: "source", label: "Source", options: options?.legalSources ?? [] },
        { key: "status", label: "Status", options: options?.legalStatuses ?? [] },
        { key: "stage", label: "Stage", options: options?.legalStages ?? [] },
        ...shared,
      ] as SelectFilter[],
      agency: [
        { key: "source", label: "Source", options: options?.agencySources ?? [] },
        { key: "status", label: "Status", options: options?.agencyStatuses ?? [] },
        { key: "agency", label: "Agency", options: options?.agencies ?? [] },
        { key: "priority", label: "Priority", options: options?.agencyPriorities ?? [] },
        ...shared,
      ] as SelectFilter[],
    };
  }, [options]);

  const heading = REGISTER_TITLES[tab];

  return (
    <div className="space-y-6">
      <PageHeader title={heading.title} description={heading.description} />

      {tab === "ptp" && (
        <RegisterTab
          fetcher={getPtps}
          columns={ptpColumns}
          csvColumns={ptpCsv}
          rowKey={(r) => r.id}
          selects={selects.ptp}
          searchPlaceholder="Search PTP code, customer or account…"
          dateLabel="Promised date"
          defaultSort="promisedDate"
          amountLabel="promised"
          exportName="promises-to-pay"
          customerScope={scope}
        />
      )}
      {tab === "dispute" && (
        <RegisterTab
          fetcher={getDisputes}
          columns={disputeColumns}
          csvColumns={disputeCsv}
          rowKey={(r) => r.id}
          selects={selects.dispute}
          searchPlaceholder="Search dispute code, customer or account…"
          dateLabel="Filed"
          defaultSort="filedAt"
          amountLabel="disputed"
          exportName="disputes"
          customerScope={scope}
        />
      )}
      {tab === "legal" && (
        <RegisterTab
          fetcher={getLegalEscalations}
          columns={legalColumns}
          csvColumns={legalCsv}
          rowKey={(r) => r.id}
          selects={selects.legal}
          searchPlaceholder="Search case code, customer, firm or court…"
          dateLabel="Filed"
          defaultSort="filedOn"
          amountLabel="claimed"
          exportName="legal-escalations"
          customerScope={scope}
        />
      )}
      {tab === "agency" && (
        <RegisterTab
          fetcher={getAgencyEscalations}
          columns={agencyColumns}
          csvColumns={agencyCsv}
          rowKey={(r) => r.id}
          selects={selects.agency}
          searchPlaceholder="Search placement, customer, account or agency…"
          dateLabel="Placed"
          defaultSort="placedOn"
          amountLabel="placed"
          exportName="agency-escalations"
          customerScope={scope}
        />
      )}
    </div>
  );
};

export default Reports;
