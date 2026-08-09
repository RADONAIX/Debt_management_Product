import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { money as formatMoney } from "@/lib/money";
import { getBorrowerFile, getCompanyBorrower } from "@/lib/customers";

/* Status pills — colour always ships with the text label. */
const tone = (status: string) => {
  const s = status.toLowerCase();
  if (["paid", "completed", "reached", "current", "resolved"].some((t) => s.includes(t)))
    return "bg-success/10 text-success border-success/30";
  if (["overdue", "failed", "rejected", "escalated", "no answer"].some((t) => s.includes(t)))
    return "bg-destructive/10 text-destructive border-destructive/30";
  if (["disputed", "review", "progress", "pending", "sla"].some((t) => s.includes(t)))
    return "bg-warning/10 text-warning border-warning/30";
  return "bg-muted text-muted-foreground border-border";
};

const StatusPill = ({ status }: { status: string }) => (
  <Badge variant="outline" className={`font-medium ${tone(status)}`}>
    {status}
  </Badge>
);

const PAGE_SIZE = 10;

/**
 * Shared table shell so all five tabs read as one family. Pages at ten rows —
 * an account can carry a year of invoices and dozens of contacts, and an
 * unbounded list buries the recent ones that matter.
 */
const DataTable = ({
  headers,
  rows,
  empty = "Nothing recorded for this subscriber.",
}: {
  headers: string[];
  rows: React.ReactNode[][];
  empty?: string;
}) => {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  // A filter or a different subscriber can shrink the list under the cursor.
  const current = Math.min(page, pages - 1);
  const slice = rows.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border">
              {headers.map((h) => (
                <th
                  key={h}
                  className="py-2 px-3 text-left text-xs font-medium text-muted-foreground whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="py-8 text-center text-sm text-muted-foreground">
                  {empty}
                </td>
              </tr>
            ) : (
              slice.map((cells, i) => (
                <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/40">
                  {cells.map((c, j) => (
                    <td key={j} className="py-2.5 px-3 whitespace-nowrap text-foreground">
                      {c}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {rows.length > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-3 mt-1 border-t border-border">
          <p className="text-xs text-muted-foreground">
            {current * PAGE_SIZE + 1}–{Math.min(rows.length, (current + 1) * PAGE_SIZE)} of{" "}
            {rows.length}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={current === 0}
              onClick={() => setPage(current - 1)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground px-1 tabular-nums">
              {current + 1} / {pages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2"
              disabled={current >= pages - 1}
              onClick={() => setPage(current + 1)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

/** Milestones are a timeline rather than a table, but page the same way. */
const PagedTimeline = ({
  items,
}: {
  items: { date: string; milestone: string; description: string; status: string }[];
}) => {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const current = Math.min(page, pages - 1);
  const slice = items.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  if (items.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nothing recorded for this subscriber.
      </p>
    );
  }

  return (
    <div>
      <ol className="relative border-l border-border ml-2">
        {slice.map((m, i) => (
          <li key={i} className="mb-5 ml-5 last:mb-0">
            <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-foreground">{m.milestone}</span>
              <StatusPill status={m.status} />
              <span className="text-xs text-muted-foreground tabular-nums ml-auto">{m.date}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{m.description}</p>
          </li>
        ))}
      </ol>

      {items.length > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-3 mt-1 border-t border-border">
          <p className="text-xs text-muted-foreground">
            {current * PAGE_SIZE + 1}–{Math.min(items.length, (current + 1) * PAGE_SIZE)} of{" "}
            {items.length}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 px-2"
              disabled={current === 0} onClick={() => setPage(current - 1)}>
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="text-xs text-muted-foreground px-1 tabular-nums">
              {current + 1} / {pages}
            </span>
            <Button variant="outline" size="sm" className="h-7 px-2"
              disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const BorrowerFile = ({
  customerId,
  companyCode,
}: {
  customerId: string;
  /** When set, the tabs cover every line in the company. */
  companyCode?: string | null;
}) => {
  const [file, setFile] = useState<Awaited<ReturnType<typeof getBorrowerFile>> | null>(null);

  useEffect(() => {
    if (!customerId && !companyCode) return;
    let cancelled = false;
    (companyCode ? getCompanyBorrower(companyCode) : getBorrowerFile(customerId))
      .then((f) => !cancelled && setFile(f))
      .catch(() => !cancelled && setFile(null));
    return () => {
      cancelled = true;
    };
  }, [customerId, companyCode]);

  const title = (s: string) => s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, " ");

  /** Map the API payload onto the rows this component already renders. */
  const borrower = file && {
    name: customerId,
    aiSummary: {
      summary:
        `${file.invoices.length} invoices on file, ` +
        `${file.payments.length} payments received and ` +
        `${file.disputes.length} dispute(s) raised.`,
      stage: file.milestones.find((m) => m.status === "PENDING")?.label ?? "Monitoring",
    },
    invoices: file.invoices.map((i) => ({
      product: i.product ?? "—",
      invoice: i.invoiceNo,
      dueDate: i.dueDate,
      amount: i.amount,
      status: title(i.status),
    })),
    payments: file.payments.map((p) => ({
      date: p.date,
      transactionId: p.reference,
      amount: p.amount,
      method: p.method ?? "—",
      status: title(p.status),
    })),
    milestones: file.milestones.map((m) => ({
      date: m.date ?? "—",
      milestone: m.label,
      description: m.detail ?? "",
      status: title(m.status),
    })),
    interactions: file.interactions.map((i) => ({
      date: new Date(i.occurredAt).toISOString().slice(0, 10),
      type: `${title(i.type)}${i.channel ? ` · ${i.channel}` : ""}`,
      subject: i.subject ?? "—",
      agent: i.agent ?? (i.automated ? "Automated" : "—"),
      outcome: title(i.outcome ?? "—"),
    })),
    disputes: file.disputes.map((d) => ({
      disputeId: d.disputeCode,
      invoice: `$ ${d.amount.toLocaleString()}`,
      reason: d.reason,
      dateFiled: new Date(d.filedAt).toISOString().slice(0, 10),
      status: title(d.status),
    })),
  };

  if (!borrower) return null;

  if (!borrower) return null;

  return (
    <Card className="p-5">
      <div className="mb-4">
        <h3 className="text-base font-semibold text-foreground">Account Activity</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Billing, payments, milestones, contact history and disputes for {borrower.name}
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 lg:grid-cols-5 h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="interaction">Interaction</TabsTrigger>
          <TabsTrigger value="disputes">
            Disputes{borrower.disputes.length > 0 ? ` (${borrower.disputes.length})` : ""}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Products &amp; Invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                headers={["Product", "Invoice", "Due Date", "Amount", "Status"]}
                rows={borrower.invoices.map((inv) => [
                  inv.product,
                  <span className="text-muted-foreground">{inv.invoice}</span>,
                  <span className="text-muted-foreground tabular-nums">{inv.dueDate}</span>,
                  <span className="font-medium tabular-nums">{formatMoney(inv.amount)}</span>,
                  <StatusPill status={inv.status} />,
                ])}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground leading-relaxed">
                {borrower.aiSummary.summary}
              </p>
              <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Dunning stage</span>
                <Badge variant="outline" className="font-medium">
                  {borrower.aiSummary.stage}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Payment History</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                headers={["Date", "Transaction ID", "Amount", "Method", "Status"]}
                rows={borrower.payments.map((p) => [
                  <span className="tabular-nums">{p.date}</span>,
                  <span className="text-muted-foreground">{p.transactionId}</span>,
                  <span className="font-medium tabular-nums">{formatMoney(p.amount)}</span>,
                  p.method,
                  <StatusPill status={p.status} />,
                ])}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="milestones">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Key Milestones</CardTitle>
            </CardHeader>
            <CardContent>
              <PagedTimeline items={borrower.milestones} />

            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="interaction">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Communication History</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                headers={["Date", "Channel", "Subject", "Agent", "Outcome"]}
                rows={borrower.interactions.map((c) => [
                  <span className="tabular-nums">{c.date}</span>,
                  <Badge variant="outline">{c.type}</Badge>,
                  c.subject,
                  <span className="text-muted-foreground">{c.agent}</span>,
                  <StatusPill status={c.outcome} />,
                ])}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="disputes">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Dispute Records</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                headers={["Dispute ID", "Invoice", "Reason", "Date Filed", "Status"]}
                rows={borrower.disputes.map((d) => [
                  <span className="font-medium">{d.disputeId}</span>,
                  <span className="text-muted-foreground">{d.invoice}</span>,
                  d.reason,
                  <span className="tabular-nums">{d.dateFiled}</span>,
                  <StatusPill status={d.status} />,
                ])}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default BorrowerFile;
