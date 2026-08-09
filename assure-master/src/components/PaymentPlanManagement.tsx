import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CalendarDays, DollarSign, Users, TrendingUp, Plus, Search, Filter, Edit, Eye } from "lucide-react";

const PaymentPlanManagement = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

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
      customerId: "CUST002",
      customerName: "Sarah Mitchell",
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
      customerId: "CUST005",
      customerName: "David Brown",
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
      customerId: "CUST004",
      customerName: "Emily Chen",
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
    },
    {
      id: "PP-005",
      customerId: "CUST-555",
      customerName: "Robert Taylor",
      totalAmount: 4200,
      remainingBalance: 3500,
      monthlyPayment: 700,
      planType: "Balloon Payment",
      duration: "6 months",
      startDate: "2024-01-10",
      nextPaymentDate: "2024-02-10",
      status: "Active",
      compliance: "On Track",
      paymentsCompleted: 1,
      totalPayments: 6,
      riskLevel: "Medium"
    }
  ];

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

  const filteredPlans = paymentPlans.filter(plan => {
    const matchesSearch = 
      plan.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plan.customerId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plan.id.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || plan.status.toLowerCase() === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Summary statistics
  const totalPlans = paymentPlans.length;
  const activePlans = paymentPlans.filter(p => p.status === "Active").length;
  const totalCommitted = paymentPlans.reduce((sum, plan) => sum + plan.totalAmount, 0);
  const totalCollected = paymentPlans.reduce((sum, plan) => sum + (plan.totalAmount - plan.remainingBalance), 0);
  const collectionRate = totalCommitted > 0 ? ((totalCollected / totalCommitted) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Payment Plan Management</h1>
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

      {/* Summary Statistics */}
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
            <div className="text-2xl font-bold">$8,750</div>
            <p className="text-xs text-muted-foreground">
              From 12 active plans
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="plans" className="space-y-4">
        <TabsList>
          <TabsTrigger value="plans">Payment Plans</TabsTrigger>
          <TabsTrigger value="schedules">Payment Schedules</TabsTrigger>
          <TabsTrigger value="analytics">Performance Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="plans" className="space-y-4">
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
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
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

        <TabsContent value="schedules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Payment Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Payment schedule calendar and upcoming dues will be displayed here.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Plan Success Rates</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>Fixed Monthly</span>
                    <span className="font-medium">85% success rate</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Graduated Payments</span>
                    <span className="font-medium">78% success rate</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Balloon Payment</span>
                    <span className="font-medium">72% success rate</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Collection Effectiveness</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span>On-time Payment Rate</span>
                    <span className="font-medium">82%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Plan Completion Rate</span>
                    <span className="font-medium">76%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Average Collection Time</span>
                    <span className="font-medium">8.2 months</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PaymentPlanManagement;