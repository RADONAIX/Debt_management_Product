import { useState } from "react";
import { useParams } from "react-router-dom";
import { Search, Download, Phone, Send, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const customers = [
  { id: "CUST-CON-003", name: "Sarah Mitchell", riskScore: 85 },
  { id: "CUST-CON-002", name: "David Brown", riskScore: 62 },
  { id: "CUST-CON-004", name: "Fatima Al Zahra", riskScore: 28 },
];

const kpiData = {
  "CUST-CON-003": {
    totalOutstanding: 125000,
    daysPastDue: 67,
    aging: "60-90 Days",
    riskScore: 85,
    carPredictedPayment: 8500,
  },
  "CUST-CON-002": {
    totalOutstanding: 78000,
    daysPastDue: 23,
    aging: "30-60 Days",
    riskScore: 62,
    carPredictedPayment: 18000,
  },
  "CUST-CON-004": {
    totalOutstanding: 12000,
    daysPastDue: 0,
    aging: "Current",
    riskScore: 28,
    carPredictedPayment: 12000,
  },
};

const productsData = {
  "CUST-CON-003": [
    { product: "Personal Loan", invoice: "INV-2024-1567", dueDate: "2024-11-15", amount: 8500, status: "Overdue" },
    { product: "Personal Loan", invoice: "INV-2024-1512", dueDate: "2024-10-15", amount: 8500, status: "Overdue" },
    { product: "Personal Loan", invoice: "INV-2024-1445", dueDate: "2024-09-15", amount: 8500, status: "Disputed" },
  ],
  "CUST-CON-002": [
    { product: "Business Loan", invoice: "INV-2024-2234", dueDate: "2024-11-20", amount: 18000, status: "Overdue" },
    { product: "Business Loan", invoice: "INV-2024-2189", dueDate: "2024-10-20", amount: 18000, status: "Paid" },
  ],
  "CUST-CON-004": [
    { product: "Credit Card", invoice: "INV-2024-3123", dueDate: "2024-12-01", amount: 6000, status: "Current" },
    { product: "Credit Card", invoice: "INV-2024-3089", dueDate: "2024-11-01", amount: 6000, status: "Paid" },
  ],
};

const aiSummary = {
  "CUST-CON-003": {
    summary: "High risk customer with 5 missed payments. Business slowdown cited as reason. Recommended immediate escalation to collection agency. Recent PTP not honored.",
    stage: "Stage 3 — Automated Reminder",
  },
  "CUST-CON-002": {
    summary: "Medium risk customer with 2 missed payments. Strong payment history prior to recent delays. Recommended follow-up call and payment plan discussion.",
    stage: "Stage 2 — Soft Collection",
  },
  "CUST-CON-004": {
    summary: "Low risk customer with excellent payment history. Current on all obligations. No action required at this time.",
    stage: "Stage 1 — Monitoring",
  },
};

const paymentsData = {
  "CUST-CON-003": [
    { date: "2024-08-15", transactionId: "TXN-2024-8901", amount: 8500, method: "Bank Transfer", status: "Completed" },
    { date: "2024-07-15", transactionId: "TXN-2024-8654", amount: 8500, method: "Bank Transfer", status: "Completed" },
    { date: "2024-06-15", transactionId: "TXN-2024-8223", amount: 8500, method: "Cheque", status: "Failed" },
    { date: "2024-05-15", transactionId: "TXN-2024-7890", amount: 8500, method: "Bank Transfer", status: "Completed" },
  ],
  "CUST-CON-002": [
    { date: "2024-09-20", transactionId: "TXN-2024-9234", amount: 18000, method: "Bank Transfer", status: "Completed" },
    { date: "2024-08-20", transactionId: "TXN-2024-8767", amount: 18000, method: "Bank Transfer", status: "Completed" },
    { date: "2024-07-20", transactionId: "TXN-2024-8345", amount: 18000, method: "Bank Transfer", status: "Completed" },
  ],
  "CUST-CON-004": [
    { date: "2024-11-01", transactionId: "TXN-2024-9890", amount: 6000, method: "Auto-Debit", status: "Completed" },
    { date: "2024-10-01", transactionId: "TXN-2024-9456", amount: 6000, method: "Auto-Debit", status: "Completed" },
    { date: "2024-09-01", transactionId: "TXN-2024-9123", amount: 6000, method: "Auto-Debit", status: "Completed" },
    { date: "2024-08-01", transactionId: "TXN-2024-8678", amount: 6000, method: "Auto-Debit", status: "Completed" },
  ],
};

const milestonesData = {
  "CUST-CON-003": [
    { date: "2024-11-10", milestone: "Escalation to Collections", description: "Account escalated due to non-payment", status: "In Progress" },
    { date: "2024-10-25", milestone: "Payment Plan Proposed", description: "Restructured payment plan offered", status: "Rejected" },
    { date: "2024-09-15", milestone: "First Missed Payment", description: "INV-2024-1445 payment missed", status: "Completed" },
    { date: "2023-12-01", milestone: "Loan Disbursement", description: "Personal loan of $ 125,000 disbursed", status: "Completed" },
  ],
  "CUST-CON-002": [
    { date: "2024-11-05", milestone: "Follow-up Call Scheduled", description: "Payment plan discussion scheduled", status: "Pending" },
    { date: "2024-10-20", milestone: "First Missed Payment", description: "INV-2024-2234 payment missed", status: "Completed" },
    { date: "2024-01-15", milestone: "Loan Disbursement", description: "Business loan of $ 500,000 disbursed", status: "Completed" },
  ],
  "CUST-CON-004": [
    { date: "2024-11-01", milestone: "Regular Payment", description: "Monthly payment completed on time", status: "Completed" },
    { date: "2024-10-01", milestone: "Regular Payment", description: "Monthly payment completed on time", status: "Completed" },
    { date: "2024-03-10", milestone: "Credit Card Issued", description: "Credit card with $ 50,000 limit issued", status: "Completed" },
  ],
};

const interactionsData = {
  "CUST-CON-003": [
    { date: "2024-11-12", type: "Phone Call", subject: "Collection call - No answer", agent: "Ahmed Khan", outcome: "No Response" },
    { date: "2024-11-08", type: "SMS", subject: "Payment reminder sent", agent: "System", outcome: "Delivered" },
    { date: "2024-11-01", type: "Email", subject: "Final notice before escalation", agent: "Sara Ahmed", outcome: "Read" },
    { date: "2024-10-25", type: "Phone Call", subject: "Payment plan discussion", agent: "Ahmed Khan", outcome: "PTP Not Honored" },
    { date: "2024-10-15", type: "Email", subject: "Overdue invoice reminder", agent: "System", outcome: "Read" },
  ],
  "CUST-CON-002": [
    { date: "2024-11-10", type: "Phone Call", subject: "Payment follow-up", agent: "Jennifer Lee", outcome: "PTP Given" },
    { date: "2024-11-05", type: "Email", subject: "Payment plan options", agent: "Jennifer Lee", outcome: "Read" },
    { date: "2024-10-28", type: "SMS", subject: "Payment reminder", agent: "System", outcome: "Delivered" },
    { date: "2024-10-20", type: "Phone Call", subject: "Missed payment inquiry", agent: "Omar Ali", outcome: "Contact Made" },
  ],
  "CUST-CON-004": [
    { date: "2024-10-15", type: "Email", subject: "Monthly statement", agent: "System", outcome: "Delivered" },
    { date: "2024-09-15", type: "Email", subject: "Monthly statement", agent: "System", outcome: "Delivered" },
    { date: "2024-08-15", type: "Email", subject: "Monthly statement", agent: "System", outcome: "Delivered" },
  ],
};

const disputesData = {
  "CUST-CON-003": [
    { disputeId: "DSP-2024-445", invoice: "INV-2024-1445", reason: "Incorrect amount charged", dateFiled: "2024-09-20", status: "Under Review" },
  ],
  "CUST-CON-002": [
        { disputeId: "DSP-2024-445", invoice: "INV-2024-1445", reason: "Incorrect amount charged", dateFiled: "2024-09-20", status: "Under Review" },
  ],
  "CUST-CON-004": [
        { disputeId: "DSP-2024-445", invoice: "INV-2024-1445", reason: "Incorrect amount charged", dateFiled: "2024-09-20", status: "Under Review" },
  ],
};

const CustomerProfile = () => {
  const { customerId } = useParams();
  const [selectedCustomer, setSelectedCustomer] = useState(customerId || "");
  const [productSearch, setProductSearch] = useState("");

  const customer = customers.find((c) => c.id === selectedCustomer);
  const kpis = kpiData[selectedCustomer as keyof typeof kpiData];
  const products = productsData[selectedCustomer as keyof typeof productsData] || [];
  const summary = aiSummary[selectedCustomer as keyof typeof aiSummary];
  const payments = paymentsData[selectedCustomer as keyof typeof paymentsData] || [];
  const milestones = milestonesData[selectedCustomer as keyof typeof milestonesData] || [];
  const interactions = interactionsData[selectedCustomer as keyof typeof interactionsData] || [];
  const disputes = disputesData[selectedCustomer as keyof typeof disputesData] || [];

  const filteredProducts = products.filter(
    (product) =>
      product.product.toLowerCase().includes(productSearch.toLowerCase()) ||
      product.invoice.toLowerCase().includes(productSearch.toLowerCase())
  );

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Overdue":
        return "text-destructive";
      case "Disputed":
        return "text-risk-high";
      case "Paid":
        return "text-risk-low";
      case "Current":
        return "text-primary";
      default:
        return "text-foreground";
    }
  };

  if (!selectedCustomer) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Borrower 360</h1>
          <Card>
            <CardContent className="p-8">
              <p className="text-muted-foreground text-center">
                Please select a customer from the sidebar to view their profile.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!customer || !kpis) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold mb-6">Borrower 360</h1>
          <Card>
            <CardContent className="p-8">
              <p className="text-muted-foreground text-center">Customer not found.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-dashboard-bg min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header & Search */}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold">Borrower 360 — {customer.name}</h1>
          <div className="flex items-center gap-3">
            <Select value={selectedCustomer} onValueChange={setSelectedCustomer}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.id})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="milestones">Milestones</TabsTrigger>
            <TabsTrigger value="interaction">Interaction</TabsTrigger>
            <TabsTrigger value="disputes">Disputes</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6 mt-6">
            {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Outstanding
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(kpis.totalOutstanding)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Days Past Due
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{kpis.daysPastDue}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Aging</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.aging}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Risk Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  kpis.riskScore > 70
                    ? "text-risk-high"
                    : kpis.riskScore > 40
                    ? "text-risk-medium"
                    : "text-risk-low"
                }`}
              >
                {kpis.riskScore}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                CAR Predicted Payment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(kpis.carPredictedPayment)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Products & Invoices Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Products & Invoices</CardTitle>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search products..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-8 w-[250px]"
                  />
                </div>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Excel
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{product.product}</TableCell>
                    <TableCell>{product.invoice}</TableCell>
                    <TableCell>{product.dueDate}</TableCell>
                    <TableCell className={getStatusColor(product.status)}>
                      {formatCurrency(product.amount)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          product.status === "Overdue" || product.status === "Disputed"
                            ? "destructive"
                            : product.status === "Paid"
                            ? "secondary"
                            : "default"
                        }
                      >
                        {product.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* AI Summary Panel */}
        {summary && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>AI Summary</CardTitle>
                <Badge variant="outline" className="text-sm">
                  {summary.stage}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">{summary.summary}</p>
            </CardContent>
          </Card>
        )}

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-4">
              <Button size="lg" className="min-w-[180px] bg-primary text-primary-foreground hover:bg-primary/90">
                <Send className="h-4 w-4 mr-2" />
                Send Payment Link
              </Button>
              <Button size="lg" className="min-w-[180px] bg-primary text-primary-foreground hover:bg-primary/90">
                <Phone className="h-4 w-4 mr-2" />
                Trigger Dialer / VA
              </Button>
              <Button size="lg" className="min-w-[180px] bg-primary text-primary-foreground hover:bg-primary/90">
                <FolderOpen className="h-4 w-4 mr-2" />
                Open Case
              </Button>
            </div>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Transaction ID</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.length > 0 ? (
                      payments.map((payment, index) => (
                        <TableRow key={index}>
                          <TableCell>{payment.date}</TableCell>
                          <TableCell>{payment.transactionId}</TableCell>
                          <TableCell>{formatCurrency(payment.amount)}</TableCell>
                          <TableCell>{payment.method}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                payment.status === "Completed"
                                  ? "secondary"
                                  : payment.status === "Failed"
                                  ? "destructive"
                                  : "default"
                              }
                            >
                              {payment.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell className="text-muted-foreground" colSpan={5}>
                          No payment records available
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Milestones Tab */}
          <TabsContent value="milestones" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Key Milestones</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Milestone</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {milestones.length > 0 ? (
                      milestones.map((milestone, index) => (
                        <TableRow key={index}>
                          <TableCell>{milestone.date}</TableCell>
                          <TableCell className="font-medium">{milestone.milestone}</TableCell>
                          <TableCell>{milestone.description}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                milestone.status === "Completed"
                                  ? "secondary"
                                  : milestone.status === "Pending"
                                  ? "default"
                                  : milestone.status === "Rejected"
                                  ? "destructive"
                                  : "outline"
                              }
                            >
                              {milestone.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell className="text-muted-foreground" colSpan={4}>
                          No milestones recorded
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Interaction Tab */}
          <TabsContent value="interaction" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Communication History</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Agent</TableHead>
                      <TableHead>Outcome</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {interactions.length > 0 ? (
                      interactions.map((interaction, index) => (
                        <TableRow key={index}>
                          <TableCell>{interaction.date}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{interaction.type}</Badge>
                          </TableCell>
                          <TableCell>{interaction.subject}</TableCell>
                          <TableCell>{interaction.agent}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                interaction.outcome === "Contact Made" ||
                                interaction.outcome === "PTP Given" ||
                                interaction.outcome === "Read" ||
                                interaction.outcome === "Delivered"
                                  ? "secondary"
                                  : interaction.outcome === "No Response" ||
                                    interaction.outcome === "PTP Not Honored"
                                  ? "destructive"
                                  : "default"
                              }
                            >
                              {interaction.outcome}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell className="text-muted-foreground" colSpan={5}>
                          No interactions recorded
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Disputes Tab */}
          <TabsContent value="disputes" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Dispute Records</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Dispute ID</TableHead>
                      <TableHead>Invoice #</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Date Filed</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {disputes.length > 0 ? (
                      disputes.map((dispute, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">{dispute.disputeId}</TableCell>
                          <TableCell>{dispute.invoice}</TableCell>
                          <TableCell>{dispute.reason}</TableCell>
                          <TableCell>{dispute.dateFiled}</TableCell>
                          <TableCell>
                            <Badge variant="destructive">{dispute.status}</Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell className="text-muted-foreground" colSpan={5}>
                          No disputes recorded
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default CustomerProfile;
