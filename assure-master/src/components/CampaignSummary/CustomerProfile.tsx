import { useEffect, useState } from "react";
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
  { id: "CUST-CON-003", name: "John Anderson", riskScore: 88 },
  { id: "CUST-CON-002", name: "Sarah Mitchell", riskScore: 60 },
  { id: "CUST-CON-001", name: "David Brown", riskScore: 12 },
];

const kpiData = {
  "CUST-CON-003": {
    totalOutstanding: 1380,
    daysPastDue: 110,
    aging: "90+ Days",
    riskScore: 88,
    carPredictedPayment: 540,
  },
  "CUST-CON-002": {
    totalOutstanding: 650,
    daysPastDue: 45,
    aging: "31–60 Days",
    riskScore: 60,
    carPredictedPayment: 420,
  },
  "CUST-CON-004": {
    totalOutstanding: 32000,
    daysPastDue: 15,
    aging: "0–30 Days",
    riskScore: 28,
    carPredictedPayment: 32000,
  },
  "CUST-CON-001": {
    totalOutstanding: 280,
    daysPastDue: 15,
    aging: "1-20 Days",
    riskScore: 12,
    carPredictedPayment: 500,
  },
};

const productsData = {
  "CUST-CON-003": [
    {
      product: "Postpaid Mobile",
      invoice: "INV-2024-1548",
      dueDate: "2024-08-05",
      amount: 100,
      status: "Partial",
    },
    {
      product: "Postpaid Mobile",
      invoice: "INV-2024-1567",
      dueDate: "2024-07-05",
      amount: 265,
      status: "Paid",
    },
    {
      product: "Postpaid Mobile",
      invoice: "INV-2024-1512",
      dueDate: "2024-06-05",
      amount: 265,
      status: "Paid",
    },
    {
      product: "Postpaid Mobile",
      invoice: "INV-2024-1445",
      dueDate: "2024-05-05",
      amount: 265,
      status: "Paid",
    },
  ],
  "CUST-CON-002": [
    {
      product: "Postpaid Mobile",
      invoice: "INV-2024-2234",
      dueDate: "2024-11-20",
      amount: 310,
      status: "Overdue",
    },
    {
      product: "Postpaid Mobile",
      invoice: "INV-2024-2189",
      dueDate: "2024-10-20",
      amount: 310,
      status: "Paid",
    },
  ],
  "CUST-CON-001": [
    {
      product: "Credit Card",
      invoice: "INV-2024-3783",
      dueDate: "2024-07-05",
      amount: 280,
      status: "Paid",
    },
    {
      product: "Credit Card",
      invoice: "INV-2024-3123",
      dueDate: "2024-06-05",
      amount: 280,
      status: "Paid",
    },
    {
      product: "Credit Card",
      invoice: "INV-2024-3089",
      dueDate: "2024-05-05",
      amount: 280,
      status: "Paid",
    },
  ],
};

const aiSummary = {
  "CUST-CON-003": {
    summary:
      "High risk customer with multiple missed payments and low contactability. Suggested structured settlement plan. Immediate escalation recommended.",
    stage: "Stage 3 — Automated Reminder",
  },
  "CUST-CON-002": {
    summary:
      "Medium risk customer with moderate delays. Prior payment history strong. Recommend personalized follow-up and payment plan.",
    stage: "Stage 2 — Soft Collection",
  },
  "CUST-CON-001": {
    summary:
      "Low risk customer with excellent payment behavior. No collection action needed.",
    stage: "Stage 1 — Monitoring",
  },
};

const paymentsData = {
  "CUST-CON-003": [
    {
      date: "2024-11-05",
      transactionId: "TXN-2024-8656",
      amount: 0,
      method: "Credit Card",
      status: "Fail",
    },
    {
      date: "2024-10-05",
      transactionId: "TXN-2024-8986",
      amount: 0,
      method: "Credit Card",
      status: "Fail",
    },
    {
      date: "2024-09-05",
      transactionId: "TXN-2024-8886",
      amount: 0,
      method: "Credit Card",
      status: "Fail",
    },
    {
      date: "2024-08-05",
      transactionId: "TXN-2024-8901",
      amount: 100,
      method: "Credit Card",
      status: "Partial",
    },
    {
      date: "2024-07-05",
      transactionId: "TXN-2024-8654",
      amount: 265,
      method: "Credit Card",
      status: "Completed",
    },
    {
      date: "2024-06-05",
      transactionId: "TXN-2024-8223",
      amount: 265,
      method: "Card",
      status: "Completed",
    },
    {
      date: "2024-05-05",
      transactionId: "TXN-2024-7890",
      amount: 265,
      method: "Credit Card",
      status: "Completed",
    },
  ],
  "CUST-CON-002": [
    {
      date: "2024-09-20",
      transactionId: "TXN-2024-9234",
      amount: 310,
      method: "Bank Transfer",
      status: "Completed",
    },
    {
      date: "2024-08-20",
      transactionId: "TXN-2024-8767",
      amount: 310,
      method: "Bank Transfer",
      status: "Completed",
    },
    {
      date: "2024-07-20",
      transactionId: "TXN-2024-8345",
      amount: 310,
      method: "Bank Transfer",
      status: "Completed",
    },
  ],
  "CUST-CON-001": [
    {
      date: "2024-08-05",
      transactionId: "TXN-2024-9890",
      amount: 0,
      method: "Auto-Debit",
      status: "Fail",
    },
    {
      date: "2024-07-05",
      transactionId: "TXN-2024-9456",
      amount: 280,
      method: "Auto-Debit",
      status: "Completed",
    },
    {
      date: "2024-06-05",
      transactionId: "TXN-2024-9123",
      amount: 280,
      method: "Auto-Debit",
      status: "Completed",
    },
    {
      date: "2024-05-05",
      transactionId: "TXN-2024-8678",
      amount: 280,
      method: "Auto-Debit",
      status: "Completed",
    },
  ],
};

const milestonesData = {
  "CUST-CON-003": [
    {
      date: "2024-11-10",
      milestone: "Escalation to Collections",
      description: "Account escalated due to non-payment",
      status: "In Progress",
    },
    {
      date: "2024-10-25",
      milestone: "Payment Plan Proposed",
      description: "Restructured payment plan offered",
      status: "Rejected",
    },
    {
      date: "2024-09-05",
      milestone: "First Missed Payment",
      description: "Invoice payment missed",
      status: "Completed",
    },
    {
      date: "2022-12-01",
      milestone: "Account Activation",
      description: "Postpaid line activated",
      status: "Completed",
    },
  ],
  "CUST-CON-002": [
    {
      date: "2024-11-05",
      milestone: "Follow-up Call Scheduled",
      description: "Payment plan discussion scheduled",
      status: "Pending",
    },
    {
      date: "2024-10-20",
      milestone: "First Missed Payment",
      description: "Invoice overdue",
      status: "Completed",
    },
    {
      date: "2024-03-10",
      milestone: "Account Activation",
      description: "Postpaid line activated",
      status: "Completed",
    },
  ],
  "CUST-CON-001": [
    {
      date: "2024-08-06",
      milestone: "Follow-up Call Scheduled",
      description: "Dispute Resolved",
      status: "Completed",
    },
    {
      date: "2024-08-06",
      milestone: "Follow-up Call Scheduled",
      description: "Payment plan discussion scheduled",
      status: "Pending",
    },
    {
      date: "2024-08-05",
      milestone: "First Missed Payment",
      description: "Invoice overdue",
      status: "Completed",
    },
    {
      date: "2024-07-05",
      milestone: "Regular Payment",
      description: "Monthly payment completed",
      status: "Completed",
    },
    {
      date: "2024-06-05",
      milestone: "Regular Payment",
      description: "Monthly payment completed",
      status: "Completed",
    },
    {
      date: "2023-03-10",
      milestone: "Credit Card Issued",
      description: "Credit limit assigned",
      status: "Completed",
    },
  ],
};

const interactionsData = {
  "CUST-CON-003": [
    {
      date: "2024-10-10",
      type: "Legal Notice Served",
      subject: "Payment not made, Escalated to Legal Agency",
      agent: "",
      outcome: "PTP Broken",
    },
    {
      date: "2024-10-05",
      type: "Payment Due Date",
      subject: "Payment not made, PTP Broken",
      agent: "John Smith",
      outcome: "PTP Broken",
    },
    {
      date: "2024-10-03",
      type: "Phone Call",
      subject: "Payment Remainder Through call by agent",
      agent: "John Smith",
      outcome: "PTP Created",
    },
    {
      date: "2024-10-01",
      type: "Email",
      subject: "Final notice before escalation",
      agent: "System",
      outcome: "Read",
    },
    {
      date: "2024-09-20",
      type: "SMS",
      subject: "Payment Overdue",
      agent: "System",
      outcome: "No Response",
    },
    {
      date: "2024-09-15",
      type: "SMS",
      subject: "Payment Overdue",
      agent: "System",
      outcome: "No Response",
    },
    {
      date: "2024-09-10",
      type: "SMS",
      subject: "Payment Overdue",
      agent: "System",
      outcome: "No Response",
    },
    {
      date: "2024-09-06",
      type: "SMS",
      subject: "Payment Overdue",
      agent: "System",
      outcome: "No Response",
    },
  ],
  "CUST-CON-002": [
    {
      date: "2024-11-10",
      type: "Phone Call",
      subject: "Payment follow-up",
      agent: "Jennifer Lee",
      outcome: "PTP Given",
    },
    {
      date: "2024-11-05",
      type: "Email",
      subject: "Payment plan options",
      agent: "Jennifer Lee",
      outcome: "Read",
    },
    {
      date: "2024-10-28",
      type: "SMS",
      subject: "Payment reminder",
      agent: "System",
      outcome: "Delivered",
    },
  ],
  "CUST-CON-001": [
    {
      date: "2024-08-30",
      type: "Dispute Resolved",
      subject: "legitimate user Dispute Resolved",
      agent: "",
      outcome: "Dispute Resolved",
    },
    {
      date: "2024-08-29",
      type: "Dispute Raised",
      subject: "Payment not made, Dispute Raised",
      agent: "John Smith",
      outcome: "Dispute Raised",
    },
    {
      date: "2024-08-28",
      type: "Phone Call",
      subject: "Payment Remainder Through call by agent",
      agent: "John Smith",
      outcome: "PTP Created",
    },
    {
      date: "2024-08-15",
      type: "Email",
      subject: "Final notice before escalation",
      agent: "System",
      outcome: "Read",
    },
    {
      date: "2024-08-10",
      type: "SMS",
      subject: "Payment Overdue",
      agent: "System",
      outcome: "No Response",
    },
    {
      date: "2024-08-06",
      type: "SMS",
      subject: "Payment Overdue",
      agent: "System",
      outcome: "No Response",
    },
  ],
};

const disputesData = {
  "CUST-CON-001": [
    {
      disputeId: "DSP003",
      invoice: "INV-2024-1548",
      reason: "Incorrect amount charged",
      dateFiled: "2024-08-05",
      status: "Resolved",
    },
  ],
  "CUST-CON-002": [
    {
      disputeId: "DSP002",
      invoice: "INV-2024-1445",
      reason: "Unauthorized Service Charge",
      dateFiled: "2024-01-12",
      status: "Escalated",
    },
  ],
  "CUST-CON-003": [
    {
      disputeId: "DSP001",
      invoice: "INV-2024-1445",
      reason: "Service Billing Error",
      dateFiled: "2024-01-15",
      status: "Investigating",
    },
  ],
};

const CustomerProfile360 = ({
  customerId = "CUST-CON-003",
  setActiveModule,
}) => {
  // const { customerId } = useParams();
  const [selectedCustomer, setSelectedCustomer] = useState("");
  const [productSearch, setProductSearch] = useState("");

  useEffect(() => {
    setSelectedCustomer(customerId); // sync with parent
  }, [customerId]);

  const customer = customers.find((c) => c.id === selectedCustomer);
  const kpis = kpiData[selectedCustomer as keyof typeof kpiData];
  const products =
    productsData[selectedCustomer as keyof typeof productsData] || [];
  const summary = aiSummary[selectedCustomer as keyof typeof aiSummary];
  const payments =
    paymentsData[selectedCustomer as keyof typeof paymentsData] || [];
  const milestones =
    milestonesData[selectedCustomer as keyof typeof milestonesData] || [];
  const interactions =
    interactionsData[selectedCustomer as keyof typeof interactionsData] || [];
  const disputes =
    disputesData[selectedCustomer as keyof typeof disputesData] || [];

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
              <p className="text-muted-foreground text-center">
                Customer not found.
              </p>
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
          <h1 className="text-3xl font-bold">More Details</h1>
          {/* <div className="flex items-center gap-3">
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
          </div> */}
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
                  <div className="text-2xl font-bold">
                    {formatCurrency(kpis.totalOutstanding)}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Days Past Due
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">
                    {kpis.daysPastDue}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Aging
                  </CardTitle>
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
                        <TableCell className="font-medium">
                          {product.product}
                        </TableCell>
                        <TableCell>{product.invoice}</TableCell>
                        <TableCell>{product.dueDate}</TableCell>
                        <TableCell className={getStatusColor(product.status)}>
                          {formatCurrency(product.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              product.status === "Overdue" ||
                              product.status === "Disputed"
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
                  <p className="text-muted-foreground leading-relaxed">
                    {summary.summary}
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-4">
              <Button
                size="lg"
                className="min-w-[180px] bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Send className="h-4 w-4 mr-2" />
                Send Payment Link
              </Button>
              <Button
                size="lg"
                className="min-w-[180px] bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Phone className="h-4 w-4 mr-2" />
                Trigger Dialer / VA
              </Button>
              <Button
                size="lg"
                className="min-w-[180px] bg-primary text-primary-foreground hover:bg-primary/90"
              >
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
                          <TableCell>
                            {formatCurrency(payment.amount)}
                          </TableCell>
                          <TableCell>{payment.method}</TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                payment.status === "Completed"
                                  ? "secondary"
                                  : payment.status === "Failed" || "Fail"
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
                        <TableCell
                          className="text-muted-foreground"
                          colSpan={5}
                        >
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
                          <TableCell className="font-medium">
                            {milestone.milestone}
                          </TableCell>
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
                        <TableCell
                          className="text-muted-foreground"
                          colSpan={4}
                        >
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
                        <TableCell
                          className="text-muted-foreground"
                          colSpan={5}
                        >
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
                          <TableCell className="font-medium">
                            {dispute.disputeId}
                          </TableCell>
                          <TableCell>{dispute.invoice}</TableCell>
                          <TableCell>{dispute.reason}</TableCell>
                          <TableCell>{dispute.dateFiled}</TableCell>
                          <TableCell>
                            <Badge variant="destructive">
                              {dispute.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell
                          className="text-muted-foreground"
                          colSpan={5}
                        >
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

export default CustomerProfile360;
