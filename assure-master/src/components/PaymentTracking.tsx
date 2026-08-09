import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  CreditCard, 
  Upload, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
  FileText,
  DollarSign,
  Plus,
  Filter,
  Edit,
  Eye,
  Users,
  TrendingUp,
  CalendarDays
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PaymentTracking() {
  const [activeTab, setActiveTab] = useState("reconciliation");
  const [searchTerm, setSearchTerm] = useState("");
  const [planSearchTerm, setPlanSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Mock payment data
  const payments = [
    {
      id: "PAY001",
      customerId: "CUST001",
      customerName: "John Anderson",
      amount: 750,
      date: "2024-01-30",
      source: "Gateway API",
      status: "matched",
      reference: "TXN123456",
      reconciled: true
    },
    {
      id: "PAY002",
      customerId: "CUST003",
      customerName: "Michael Chen",
      amount: 850,
      date: "2024-01-30",
      source: "Manual Upload",
      status: "matched", 
      reference: "MAN789012",
      reconciled: true
    },
    {
      id: "PAY003",
      customerId: "UNKNOWN",
      customerName: "Unknown Customer",
      amount: 500,
      date: "2024-01-29",
      source: "Gateway API",
      status: "unmatched",
      reference: "TXN654321",
      reconciled: false
    }
  ];

  // Mock unmatched payments
  const unmatchedPayments = [
    {
      id: "PAY003",
      amount: 500,
      date: "2024-01-29",
      reference: "TXN654321",
      reason: "Customer ID not found",
      possibleMatches: ["CUST005", "CUST007"]
    },
    {
      id: "PAY004", 
      amount: 1200,
      date: "2024-01-28",
      reference: "TXN789456",
      reason: "Amount mismatch",
      possibleMatches: ["CUST002"]
    }
  ];

  // Mock reconciliation stats
  const reconciliationStats = {
    totalPayments: 156,
    matchedPayments: 142,
    unmatchedPayments: 14,
    totalAmount: 185420,
    matchedAmount: 168950,
    unmatchedAmount: 16470,
    reconciliationRate: 91.0
  };

  // Mock refunds and adjustments
  const adjustments = [
    {
      id: "ADJ001",
      customerId: "CUST001",
      customerName: "John Anderson",
      type: "Refund",
      amount: -200,
      date: "2024-01-28",
      reason: "Overpayment refund",
      status: "processed"
    },
    {
      id: "ADJ002",
      customerId: "CUST002",
      customerName: "Sarah Mitchell", 
      type: "Adjustment",
      amount: 50,
      date: "2024-01-27",
      reason: "Late fee waiver",
      status: "pending"
    }
  ];

  // Mock payment plans data
  const paymentPlans = [
    {
      id: "PP-001",
      customerId: "CUST-123",
      customerName: "John Smith",
      totalAmount: 5000,
      remainingBalance: 3000,
      monthlyPayment: 500,
      planType: "Fixed Monthly",
      duration: "10 months",
      startDate: "2024-01-01",
      nextPaymentDate: "2024-02-01",
      status: "Active",
      compliance: "On Track",
      paymentsCompleted: 4,
      totalPayments: 10,
      riskLevel: "Low"
    },
    {
      id: "PP-002",
      customerId: "CUST-456",
      customerName: "Maria Garcia",
      totalAmount: 2500,
      remainingBalance: 1800,
      monthlyPayment: 350,
      planType: "Graduated",
      duration: "8 months",
      startDate: "2023-12-15",
      nextPaymentDate: "2024-01-20",
      status: "Behind",
      compliance: "1 Payment Late",
      paymentsCompleted: 2,
      totalPayments: 7,
      riskLevel: "Medium"
    },
    {
      id: "PP-003",
      customerId: "CUST-789",
      customerName: "David Chen",
      totalAmount: 7500,
      remainingBalance: 4500,
      monthlyPayment: 750,
      planType: "Fixed Monthly",
      duration: "10 months",
      startDate: "2023-11-01",
      nextPaymentDate: "2024-01-25",
      status: "Active",
      compliance: "On Track",
      paymentsCompleted: 4,
      totalPayments: 10,
      riskLevel: "Low"
    },
    {
      id: "PP-004",
      customerId: "CUST-321",
      customerName: "Lisa Anderson",
      totalAmount: 3200,
      remainingBalance: 0,
      monthlyPayment: 400,
      planType: "Fixed Monthly",
      duration: "8 months",
      startDate: "2023-06-01",
      nextPaymentDate: "Completed",
      status: "Completed",
      compliance: "Successful",
      paymentsCompleted: 8,
      totalPayments: 8,
      riskLevel: "Low"
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "matched":
        return <Badge variant="default" className="flex items-center space-x-1"><CheckCircle className="w-3 h-3" /><span>Matched</span></Badge>;
      case "unmatched":
        return <Badge variant="destructive" className="flex items-center space-x-1"><XCircle className="w-3 h-3" /><span>Unmatched</span></Badge>;
      case "processed":
        return <Badge variant="default">Processed</Badge>;
      case "pending":
        return <Badge variant="secondary">Pending</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case "active": return "default";
      case "behind": return "destructive";
      case "completed": return "secondary";
      case "suspended": return "outline";
      default: return "secondary";
    }
  };

  const getRiskBadgeVariant = (risk: string) => {
    switch (risk.toLowerCase()) {
      case "low": return "secondary";
      case "medium": return "default";
      case "high": return "destructive";
      default: return "outline";
    }
  };

  const getComplianceBadgeVariant = (compliance: string) => {
    if (compliance.toLowerCase().includes("track")) return "default";
    if (compliance.toLowerCase().includes("late")) return "destructive";
    if (compliance.toLowerCase().includes("successful")) return "secondary";
    return "outline";
  };

  const filteredPayments = payments.filter(payment =>
    payment.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.customerId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.reference.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPlans = paymentPlans.filter(plan => {
    const matchesSearch = 
      plan.customerName.toLowerCase().includes(planSearchTerm.toLowerCase()) ||
      plan.customerId.toLowerCase().includes(planSearchTerm.toLowerCase()) ||
      plan.id.toLowerCase().includes(planSearchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || plan.status.toLowerCase() === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Payment plans summary statistics
  const totalPlans = paymentPlans.length;
  const activePlans = paymentPlans.filter(p => p.status === "Active").length;
  const totalCommitted = paymentPlans.reduce((sum, plan) => sum + plan.totalAmount, 0);
  const totalCollected = paymentPlans.reduce((sum, plan) => sum + (plan.totalAmount - plan.remainingBalance), 0);
  const collectionRate = totalCommitted > 0 ? ((totalCollected / totalCommitted) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Payment Tracking & Reconciliation</h2>
          <p className="text-muted-foreground">Monitor payments and manage reconciliation processes</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" className="flex items-center space-x-2">
            <Upload className="w-4 h-4" />
            <span>Import Payments</span>
          </Button>
          <Button className="flex items-center space-x-2">
            <RefreshCw className="w-4 h-4" />
            <span>Sync Gateway</span>
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Payments</p>
                <p className="text-2xl font-bold text-foreground">{reconciliationStats.totalPayments}</p>
              </div>
              <CreditCard className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Matched Amount</p>
                <p className="text-2xl font-bold text-success">${reconciliationStats.matchedAmount.toLocaleString()}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Unmatched Amount</p>
                <p className="text-2xl font-bold text-destructive">${reconciliationStats.unmatchedAmount.toLocaleString()}</p>
              </div>
              <AlertTriangle className="w-8 h-8 text-destructive" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Reconciliation Rate</p>
                <p className="text-2xl font-bold text-primary">{reconciliationStats.reconciliationRate}%</p>
              </div>
              <DollarSign className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="reconciliation">Payment Status & Reconciliation</TabsTrigger>
          <TabsTrigger value="adjustments">Adjustments & Refunds</TabsTrigger>
          <TabsTrigger value="analytics">Payment History & Analytics</TabsTrigger>
          <TabsTrigger value="plans">Payment Plans</TabsTrigger>
        </TabsList>

        <TabsContent value="reconciliation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Payment Status & Reconciliation</CardTitle>
              <CardDescription>View and manage payment matching status and unmatched payments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-2 mb-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by customer, ID, or reference..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-medium">{payment.id}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{payment.customerName}</p>
                          <p className="text-sm text-muted-foreground">{payment.customerId}</p>
                        </div>
                      </TableCell>
                      <TableCell>${payment.amount.toLocaleString()}</TableCell>
                      <TableCell>{payment.date}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{payment.source}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{payment.reference}</TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Unmatched Payments Section */}
          <Card>
            <CardHeader>
              <CardTitle>Unmatched Payments</CardTitle>
              <CardDescription>Resolve payments that couldn't be automatically matched</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {unmatchedPayments.map((payment) => (
                  <div key={payment.id} className="p-4 border rounded-lg bg-destructive/5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <AlertTriangle className="w-5 h-5 text-destructive" />
                        <div>
                          <p className="font-medium">Payment {payment.id}</p>
                          <p className="text-sm text-muted-foreground">${payment.amount} • {payment.date}</p>
                        </div>
                      </div>
                      <Badge variant="destructive">Unmatched</Badge>
                    </div>
                    
                    <div className="space-y-2">
                      <p className="text-sm"><span className="font-medium">Reference:</span> {payment.reference}</p>
                      <p className="text-sm"><span className="font-medium">Reason:</span> {payment.reason}</p>
                      {payment.possibleMatches.length > 0 && (
                        <div>
                          <p className="text-sm font-medium">Possible matches:</p>
                          <div className="flex space-x-2 mt-1">
                            {payment.possibleMatches.map((match, idx) => (
                              <Badge key={idx} variant="outline" className="cursor-pointer hover:bg-secondary">
                                {match}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    
                    <div className="flex space-x-2 mt-4">
                      <Button size="sm" variant="outline">Manual Match</Button>
                      <Button size="sm" variant="outline">Create Customer</Button>
                      <Button size="sm" variant="outline">Mark as Refund</Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="adjustments" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Refunds & Adjustments</CardTitle>
              <CardDescription>Track refunds, adjustments, and corrections</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {adjustments.map((adjustment) => (
                    <TableRow key={adjustment.id}>
                      <TableCell className="font-medium">{adjustment.id}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{adjustment.customerName}</p>
                          <p className="text-sm text-muted-foreground">{adjustment.customerId}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={adjustment.type === "Refund" ? "destructive" : "secondary"}>
                          {adjustment.type}
                        </Badge>
                      </TableCell>
                      <TableCell className={adjustment.amount < 0 ? "text-destructive" : "text-success"}>
                        ${Math.abs(adjustment.amount).toLocaleString()}
                      </TableCell>
                      <TableCell>{adjustment.date}</TableCell>
                      <TableCell>{adjustment.reason}</TableCell>
                      <TableCell>{getStatusBadge(adjustment.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Payment History Analysis</CardTitle>
                <CardDescription>Analyze payment patterns and customer behavior</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>From Date</Label>
                    <Input type="date" defaultValue="2024-01-01" />
                  </div>
                  <div>
                    <Label>To Date</Label>
                    <Input type="date" defaultValue="2024-01-30" />
                  </div>
                </div>
                <Button className="w-full flex items-center space-x-2">
                  <FileText className="w-4 h-4" />
                  <span>Export Analysis</span>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Daily Reconciliation Report</CardTitle>
                <CardDescription>Generate daily payment reconciliation summary</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Report Date</Label>
                  <Input type="date" defaultValue="2024-01-30" />
                </div>
                <Button className="w-full flex items-center space-x-2">
                  <FileText className="w-4 h-4" />
                  <span>Generate Report</span>
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment Trends</CardTitle>
                <CardDescription>View payment performance trends over time</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-3 bg-secondary/20 rounded">
                      <p className="text-sm text-muted-foreground">This Month</p>
                      <p className="text-xl font-bold text-success">$168K</p>
                    </div>
                    <div className="p-3 bg-secondary/20 rounded">
                      <p className="text-sm text-muted-foreground">Last Month</p>
                      <p className="text-xl font-bold text-foreground">$145K</p>
                    </div>
                    <div className="p-3 bg-secondary/20 rounded">
                      <p className="text-sm text-muted-foreground">Growth</p>
                      <p className="text-xl font-bold text-success">+15.8%</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment Channel Analysis</CardTitle>
                <CardDescription>Compare performance across payment channels</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Gateway API</span>
                    <span className="text-sm font-medium">65% • $98K</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Manual Upload</span>
                    <span className="text-sm font-medium">25% • $42K</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Direct Debit</span>
                    <span className="text-sm font-medium">10% • $18K</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="plans" className="space-y-6">
          {/* Payment Plans Header with Create Button */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold">Payment Plan Management</h3>
              <p className="text-muted-foreground">Create and manage customer payment plans</p>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Payment Plan
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>Create New Payment Plan</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="customer">Customer</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cust1">John Smith (CUST-123)</SelectItem>
                        <SelectItem value="cust2">Maria Garcia (CUST-456)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="total-amount">Total Amount</Label>
                    <Input id="total-amount" placeholder="Enter total amount" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plan-type">Plan Type</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select plan type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed Monthly</SelectItem>
                        <SelectItem value="graduated">Graduated Payments</SelectItem>
                        <SelectItem value="balloon">Balloon Payment</SelectItem>
                        <SelectItem value="custom">Custom Schedule</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="duration">Duration (months)</Label>
                    <Input id="duration" placeholder="Enter duration" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="monthly-payment">Monthly Payment</Label>
                    <Input id="monthly-payment" placeholder="Enter monthly payment" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input id="start-date" type="date" />
                  </div>
                  <div className="space-y-2 col-span-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea id="notes" placeholder="Additional notes or terms" />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => setIsCreateDialogOpen(false)}>
                    Create Plan
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Payment Plans Summary Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Plans</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalPlans}</div>
                <p className="text-xs text-muted-foreground">
                  {activePlans} currently active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Committed</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${totalCommitted.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  Across all payment plans
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Amount Collected</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${totalCollected.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  {collectionRate}% collection rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">This Month Due</CardTitle>
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$2,100</div>
                <p className="text-xs text-muted-foreground">
                  From 3 active plans
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Search and Filter Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search & Filter Payment Plans
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search plans, customers..."
                    value={planSearchTerm}
                    onChange={(e) => setPlanSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="behind">Behind</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline">
                  <Filter className="mr-2 h-4 w-4" />
                  Advanced Filters
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Payment Plans Table */}
          <Card>
            <CardHeader>
              <CardTitle>
                Payment Plans ({filteredPlans.length} results)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Plan Details</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Next Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Compliance</TableHead>
                    <TableHead>Risk</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPlans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">{plan.id}</TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{plan.customerName}</div>
                          <div className="text-muted-foreground">{plan.customerId}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{plan.planType}</div>
                          <div className="text-muted-foreground">
                            ${plan.monthlyPayment}/month × {plan.duration}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Started: {plan.startDate}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">${plan.totalAmount.toLocaleString()}</div>
                          <div className="text-muted-foreground">
                            Remaining: ${plan.remainingBalance.toLocaleString()}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div>{plan.paymentsCompleted}/{plan.totalPayments} payments</div>
                          <div className="w-full bg-muted rounded-full h-2 mt-1">
                            <div 
                              className="bg-primary h-2 rounded-full" 
                              style={{ width: `${(plan.paymentsCompleted / plan.totalPayments) * 100}%` }}
                            />
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {Math.round((plan.paymentsCompleted / plan.totalPayments) * 100)}% complete
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {plan.nextPaymentDate !== "Completed" ? (
                            <>
                              <div>{plan.nextPaymentDate}</div>
                              <div className="text-muted-foreground">
                                ${plan.monthlyPayment}
                              </div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">Completed</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(plan.status)}>
                          {plan.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getComplianceBadgeVariant(plan.compliance)}>
                          {plan.compliance}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getRiskBadgeVariant(plan.riskLevel)}>
                          {plan.riskLevel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}