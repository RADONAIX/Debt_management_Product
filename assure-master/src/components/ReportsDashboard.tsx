import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useCustomerType } from "@/contexts/CustomerTypeContext";
import { 
  BarChart, 
  TrendingUp, 
  TrendingDown,
  Users, 
  DollarSign,
  Calendar,
  Download,
  FileText,
  PieChart,
  Activity,
  Target,
  Clock,
  Phone,
  AlertCircle,
  CheckCircle,
  XCircle,
  Percent,
  BarChart3,
  TrendingDownIcon,
  AlertTriangle,
  Ban,
  Shield,
  Filter
} from "lucide-react";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Line, LineChart, Area, AreaChart } from 'recharts';

export default function ReportsDashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedPeriod, setSelectedPeriod] = useState("week");
  const [selectedMilestone, setSelectedMilestone] = useState("all");
  const { customerType } = useCustomerType();

  // Monthly collection trend data
  const monthlyCollectionData = [
    { month: "Sep 2024", collected: 850000, target: 1000000, recovery_rate: 85 },
    { month: "Oct 2024", collected: 920000, target: 1000000, recovery_rate: 92 },
    { month: "Nov 2024", collected: 780000, target: 1000000, recovery_rate: 78 },
    { month: "Dec 2024", collected: 1050000, target: 1000000, recovery_rate: 105 },
    { month: "Jan 2025", collected: 980000, target: 1000000, recovery_rate: 98 },
    { month: "Feb 2025", collected: 1120000, target: 1000000, recovery_rate: 112 },
  ];

  const chartConfig = {
    collected: {
      label: "Amount Collected",
      color: "hsl(var(--primary))",
    },
    target: {
      label: "Target",
      color: "hsl(var(--muted-foreground))",
    },
    recovery_rate: {
      label: "Recovery Rate (%)",
      color: "hsl(var(--secondary))",
    },
  };

  // Mock agent performance data
  const agentPerformance = [
    {
      id: "AGT001",
      name: "Sarah Johnson",
      assignedCases: 45,
      closedCases: 38,
      recoveryAmount: 125000,
      avgResolutionTime: 3.2,
      contactRate: 78,
      ptpSuccess: 65
    },
    {
      id: "AGT002", 
      name: "Mike Rodriguez",
      assignedCases: 52,
      closedCases: 41,
      recoveryAmount: 142000,
      avgResolutionTime: 2.8,
      contactRate: 82,
      ptpSuccess: 71
    },
    {
      id: "AGT003",
      name: "Lisa Chen",
      assignedCases: 38,
      closedCases: 33,
      recoveryAmount: 98000,
      avgResolutionTime: 3.5,
      contactRate: 75,
      ptpSuccess: 58
    }
  ];

  // Mock controller metrics
  const controllerMetrics = {
    riskExposure: {
      highRisk: 485000,
      mediumRisk: 680000,
      lowRisk: 320000,
      total: 1485000
    },
    collectionTrends: {
      thisWeek: 156000,
      lastWeek: 142000,
      growth: 9.9
    },
    agingBuckets: {
      current: 2400000,
      days30: 680000,
      days60: 340000,
      days90: 485000
    }
  };

  // Mock PTP summary
  const ptpSummary = {
    totalPTPs: 156,
    fulfilled: 98,
    broken: 42,
    pending: 16,
    totalCommitted: 485000,
    collected: 312000
  };

  // Mock write-off data
  const writeOffs = [
    {
      id: "WO001",
      customerId: "CUST045",
      customerName: "Robert Wilson",
      amount: 5200,
      date: "2024-01-29",
      reason: "Bankruptcy",
      approvedBy: "Controller"
    },
    {
      id: "WO002",
      customerId: "CUST078", 
      customerName: "Emma Davis",
      amount: 3400,
      date: "2024-01-28",
      reason: "Uncollectable",
      approvedBy: "Manager"
    }
  ];

  // Dynamic KPIs based on customer type
  const getCollectionKPIs = () => {
    if (customerType === 'enterprise') {
      return {
        totalServiceRevenue: 2845000,
        activeSubscribers: 2100,
        avgRevPerUser: 245000,
        collectedToday: 85000,
        collectedThisWeek: 425000,
        collectedThisMonth: 1650000,
        targetThisMonth: 1800000,
        serviceRestorationRate: 94.2,
        contractComplianceRate: 96.8,
        slaCompliance: 94.2,
        avgContractValue: 245000,
        contractRenewalRate: 89.5,
        escalationRate: 5.2,
        accountManagerEfficiency: 91.3,
        multiServicePenetration: 78.4,
        enterpriseChurnRisk: 8.7,
        contractDisputes: 12,
        regulatoryCompliance: 98.9,
        customSolutionAdoption: 67.3,
        enterpriseSettlementRate: 45.8,
        avgPaymentTerm: 45,
        wireTransferPreference: 67.8
      };
    } else if (customerType === 'normal') {
      return {
        totalServiceRevenue: 1060000,
        activeSubscribers: 123500,
        avgRevPerUser: 85.40,
        collectedToday: 28500,
        collectedThisWeek: 98000,
        collectedThisMonth: 450000,
        targetThisMonth: 520000,
        serviceRestorationRate: 78.5,
        billShockRecoveryRate: 24.3,
        firstCallResolution: 32.8,
        rightPartyContact: 68.4,
        promiseToPayFulfillment: 62.8,
        serviceDisconnectionRate: 18.7,
        daysToServiceRestoration: 12.4,
        costPerSubscriberRecovery: 18.50,
        agentUtilization: 78.2,
        callsPerHour: 15.6,
        smsResponseRate: 45.3,
        settlementRate: 28.9,
        roamingDebtRecovery: 67.8,
        vasDebtCollection: 72.1,
        deviceFinancingRecovery: 89.3
      };
    } else {
      return {
        totalServiceRevenue: 3905000,
        activeSubscribers: 125600,
        avgRevPerUser: 85.40,
        collectedToday: 42500,
        collectedThisWeek: 156000,
        collectedThisMonth: 642000,
        targetThisMonth: 750000,
        serviceRestorationRate: 85.6,
        billShockRecoveryRate: 24.3,
        firstCallResolution: 32.8,
        rightPartyContact: 68.4,
        promiseToPayFulfillment: 62.8,
        serviceDisconnectionRate: 18.7,
        daysToServiceRestoration: 12.4,
        costPerSubscriberRecovery: 18.50,
        agentUtilization: 78.2,
        callsPerHour: 15.6,
        smsResponseRate: 45.3,
        settlementRate: 28.9,
        roamingDebtRecovery: 67.8,
        vasDebtCollection: 72.1,
        deviceFinancingRecovery: 89.3
      };
    }
  };

  const collectionKPIs = getCollectionKPIs();

  // Telecom Collection Efficiency Metrics
  const efficiencyMetrics = {
    avgServiceDebtAge: 28.5,
    totalCustomerContacts: 1248,
    successfulContacts: 854,
    contactsPerSubscriber: 3.2,
    servicesRestoredToday: 23,
    newDebtCasesAssigned: 31,
    escalatedToLegal: 8,
    selfPaymentRate: 15.2,
    paymentArrangementsCreated: 67,
    billingDisputeResolution: 92.3,
    regulatoryComplianceScore: 98.1,
    billShockResolutionTime: 4.2,
    roamingDebtResolutionTime: 6.8,
    deviceFinancingDefaultRate: 3.2,
    serviceReactivationTime: 2.1,
    usageBasedDebtRecovery: 78.9
  };

  // Telecom Risk Assessment Data
  const riskMetrics = {
    highRiskSubscribers: 342,
    mediumRiskSubscribers: 567,
    lowRiskSubscribers: 891,
    fraudSuspiciousActivity: 12,
    bankruptcyPetitions: 8,
    deceasedAccounts: 5,
    disputedServiceCharges: 125000,
    litigationCases: 18,
    hardshipRequests: 24,
    billShockCases: 45,
    roamingFraudSuspicion: 8,
    deviceFinancingDefaults: 23,
    internationalCallFraud: 6,
    prepaidToPostpaidRisk: 34,
    multiServiceBundleRisk: 156,
    vasUnauthorizedCharges: 19
  };

  // Milestone Analytics Data
  const milestoneTypes = [
    { id: "first_notice", name: "First Notice", color: "bg-blue-500" },
    { id: "second_notice", name: "Second Notice", color: "bg-orange-500" },
    { id: "final_notice", name: "Final Notice", color: "bg-red-500" },
    { id: "legal_action", name: "Legal Action", color: "bg-purple-500" },
    { id: "settlement", name: "Settlement", color: "bg-green-500" }
  ];

  const milestonePerformance = [
    {
      milestone: "First Notice",
      total: 1250,
      successful: 987,
      failed: 125,
      cancelled: 85,
      exempted: 53,
      successRate: 78.96,
      trend: 5.2
    },
    {
      milestone: "Second Notice",
      total: 842,
      successful: 634,
      failed: 98,
      cancelled: 67,
      exempted: 43,
      successRate: 75.3,
      trend: -2.1
    },
    {
      milestone: "Final Notice",
      total: 567,
      successful: 398,
      failed: 89,
      cancelled: 45,
      exempted: 35,
      successRate: 70.2,
      trend: 1.8
    },
    {
      milestone: "Legal Action",
      total: 234,
      successful: 189,
      failed: 23,
      cancelled: 12,
      exempted: 10,
      successRate: 80.8,
      trend: 8.5
    }
  ];

  const cancellationReasons = [
    { reason: "Payment Received", count: 156, percentage: 42.3 },
    { reason: "Customer Dispute", count: 89, percentage: 24.1 },
    { reason: "Payment Plan Activated", count: 67, percentage: 18.2 },
    { reason: "Account Closed", count: 34, percentage: 9.2 },
    { reason: "System Error", count: 23, percentage: 6.2 }
  ];

  const exemptionReasons = [
    { reason: "Hardship", count: 78, percentage: 35.6 },
    { reason: "Legal Protection", count: 56, percentage: 25.6 },
    { reason: "Account Under Review", count: 43, percentage: 19.6 },
    { reason: "Customer Deceased", count: 32, percentage: 14.6 },
    { reason: "Bankruptcy Filed", count: 10, percentage: 4.6 }
  ];

  const batchRunHistory = [
    {
      id: "BR_001",
      date: "2024-01-28",
      milestone: "First Notice",
      customers: 450,
      successful: 342,
      failed: 67,
      cancelled: 28,
      exempted: 13,
      duration: "2h 15m"
    },
    {
      id: "BR_002",
      date: "2024-01-27",
      milestone: "Second Notice",
      customers: 287,
      successful: 198,
      failed: 45,
      cancelled: 31,
      exempted: 13,
      duration: "1h 45m"
    }
  ];

  const getRecoveryTrend = (current: number, previous: number) => {
    const change = ((current - previous) / previous) * 100;
    return {
      percentage: Math.abs(change).toFixed(1),
      isPositive: change > 0,
      icon: change > 0 ? TrendingUp : TrendingDown
    };
  };

  const getStatusColor = (type: string) => {
    switch (type) {
      case "successful": return "text-green-600";
      case "failed": return "text-red-600";
      case "cancelled": return "text-orange-600";
      case "exempted": return "text-blue-600";
      default: return "text-gray-600";
    }
  };

  const getTrendIcon = (trend: number) => {
    return trend > 0 ? (
      <TrendingUp className="w-4 h-4 text-green-600" />
    ) : (
      <TrendingDown className="w-4 h-4 text-red-600" />
    );
  };

  const trend = getRecoveryTrend(controllerMetrics.collectionTrends.thisWeek, controllerMetrics.collectionTrends.lastWeek);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Reports & Analytics</h2>
          <p className="text-muted-foreground">Comprehensive performance and collection insights</p>
        </div>
        <div className="flex items-center space-x-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="quarter">This Quarter</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" className="flex items-center space-x-2">
            <Download className="w-4 h-4" />
            <span>Export</span>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={`grid w-full ${customerType === 'enterprise' ? 'grid-cols-8' : 'grid-cols-7'}`}>
          <TabsTrigger value="overview">Collection Overview</TabsTrigger>
          <TabsTrigger value="efficiency">Efficiency Metrics</TabsTrigger>
          <TabsTrigger value="agent">Agent Performance</TabsTrigger>
          <TabsTrigger value="risk">Risk Analysis</TabsTrigger>
          {customerType === 'enterprise' && (
            <TabsTrigger value="controller">Enterprise Controller</TabsTrigger>
          )}
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="summary">PTP Summary</TabsTrigger>
          <TabsTrigger value="writeoff">Write-offs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Dynamic Collection Overview KPIs based on Customer Type */}
          {customerType === 'enterprise' ? (
            // Enterprise-Specific KPIs
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Contract Revenue</p>
                      <p className="text-2xl font-bold text-foreground">${(collectionKPIs.totalServiceRevenue / 1000000).toFixed(1)}M</p>
                    </div>
                    <DollarSign className="w-8 h-8 text-primary" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Monthly Target</p>
                      <p className="text-2xl font-bold text-success">${(collectionKPIs.targetThisMonth / 1000).toFixed(0)}K</p>
                      <div className="flex items-center mt-2">
                        <Progress value={(collectionKPIs.collectedThisMonth / collectionKPIs.targetThisMonth) * 100} className="w-20 mr-2" />
                        <span className="text-xs text-muted-foreground">{Math.round((collectionKPIs.collectedThisMonth / collectionKPIs.targetThisMonth) * 100)}%</span>
                      </div>
                    </div>
                    <Target className="w-8 h-8 text-success" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">SLA Compliance</p>
                      <p className="text-2xl font-bold text-primary">{collectionKPIs.slaCompliance}%</p>
                    </div>
                    <Shield className="w-8 h-8 text-primary" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Contract Renewal Rate</p>
                      <p className="text-2xl font-bold text-success">{collectionKPIs.contractRenewalRate}%</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-success" />
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            // Normal/All Customer KPIs
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Service Revenue</p>
                      <p className="text-2xl font-bold text-foreground">${(collectionKPIs.totalServiceRevenue / 1000000).toFixed(1)}M</p>
                    </div>
                    <DollarSign className="w-8 h-8 text-primary" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Monthly Target</p>
                      <p className="text-2xl font-bold text-success">${(collectionKPIs.targetThisMonth / 1000).toFixed(0)}K</p>
                      <div className="flex items-center mt-2">
                        <Progress value={(collectionKPIs.collectedThisMonth / collectionKPIs.targetThisMonth) * 100} className="w-20 mr-2" />
                        <span className="text-xs text-muted-foreground">{Math.round((collectionKPIs.collectedThisMonth / collectionKPIs.targetThisMonth) * 100)}%</span>
                      </div>
                    </div>
                    <Target className="w-8 h-8 text-success" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Service Restoration Rate</p>
                      <p className="text-2xl font-bold text-primary">{collectionKPIs.serviceRestorationRate}%</p>
                    </div>
                    <BarChart3 className="w-8 h-8 text-primary" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {customerType === 'normal' ? 'Bill Shock Recovery' : 'Bill Shock Recovery'}
                      </p>
                      <p className="text-2xl font-bold text-success">
                        {customerType === 'normal' ? collectionKPIs.billShockRecoveryRate : collectionKPIs.billShockRecoveryRate}%
                      </p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-success" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Performance Metrics Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Collection Performance</CardTitle>
                <CardDescription>Key collection metrics and targets</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Collected Today</span>
                  <span className="font-medium text-success">${collectionKPIs.collectedToday.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Collected This Week</span>
                  <span className="font-medium">${collectionKPIs.collectedThisWeek.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Collected This Month</span>
                  <span className="font-medium text-primary">${collectionKPIs.collectedThisMonth.toLocaleString()}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm">First Call Resolution</span>
                  <Badge variant="secondary">{collectionKPIs.firstCallResolution}%</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Right Party Contact</span>
                  <Badge variant="secondary">{collectionKPIs.rightPartyContact}%</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">PTP Fulfillment</span>
                  <Badge variant="secondary">{collectionKPIs.promiseToPayFulfillment}%</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Operational Metrics</CardTitle>
                <CardDescription>Efficiency and cost metrics</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Service Disconnection Rate</span>
                  <span className="font-medium text-success">{collectionKPIs.serviceDisconnectionRate}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Days to Service Restoration</span>
                  <span className="font-medium">{collectionKPIs.daysToServiceRestoration} days</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Cost per Subscriber Recovery</span>
                  <span className="font-medium text-primary">${collectionKPIs.costPerSubscriberRecovery}</span>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm">Agent Utilization</span>
                  <Badge variant="default">{collectionKPIs.agentUtilization}%</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Calls per Hour</span>
                  <Badge variant="secondary">{collectionKPIs.callsPerHour}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Settlement Rate</span>
                  <Badge variant="secondary">{collectionKPIs.settlementRate}%</Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Monthly Collection Trend Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Monthly Collection Trend</CardTitle>
                <CardDescription>Collection performance over the last 6 months</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={monthlyCollectionData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="month" 
                        className="text-xs fill-muted-foreground"
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis 
                        className="text-xs fill-muted-foreground"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                      />
                      <ChartTooltip 
                        content={<ChartTooltipContent />}
                        formatter={(value, name) => [
                          name === 'recovery_rate' ? `${value}%` : `$${(Number(value) / 1000).toFixed(0)}K`,
                          name === 'collected' ? 'Amount Collected' : 
                          name === 'target' ? 'Target' : 'Recovery Rate'
                        ]}
                      />
                      <Bar 
                        dataKey="collected" 
                        fill="var(--color-collected)" 
                        radius={4}
                        name="Amount Collected"
                      />
                      <Bar 
                        dataKey="target" 
                        fill="var(--color-target)" 
                        radius={4}
                        opacity={0.6}
                        name="Target"
                      />
                    </RechartsBarChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>

            {/* Recovery Rate Trend Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Recovery Rate Trend</CardTitle>
                <CardDescription>Monthly recovery rate performance</CardDescription>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyCollectionData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis 
                        dataKey="month" 
                        className="text-xs fill-muted-foreground"
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis 
                        className="text-xs fill-muted-foreground"
                        tick={{ fontSize: 12 }}
                        tickFormatter={(value) => `${value}%`}
                        domain={[70, 120]}
                      />
                      <ChartTooltip 
                        content={<ChartTooltipContent />}
                        formatter={(value, name) => [`${value}%`, 'Recovery Rate']}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="recovery_rate" 
                        stroke="var(--color-recovery_rate)" 
                        strokeWidth={3}
                        dot={{ fill: "var(--color-recovery_rate)", strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, fill: "var(--color-recovery_rate)" }}
                      />
                      {/* Target line at 100% */}
                      <Line 
                        type="monotone" 
                        dataKey={() => 100} 
                        stroke="var(--color-target)" 
                        strokeDasharray="5 5"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="efficiency" className="space-y-6">
          {/* Efficiency KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Service Debt Age</p>
                    <p className="text-2xl font-bold text-foreground">{efficiencyMetrics.avgServiceDebtAge} days</p>
                  </div>
                  <Clock className="w-8 h-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Contact Success</p>
                    <p className="text-2xl font-bold text-success">{Math.round((efficiencyMetrics.successfulContacts / efficiencyMetrics.totalCustomerContacts) * 100)}%</p>
                  </div>
                  <Phone className="w-8 h-8 text-success" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Self Payment Rate</p>
                    <p className="text-2xl font-bold text-primary">{efficiencyMetrics.selfPaymentRate}%</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Regulatory Compliance</p>
                    <p className="text-2xl font-bold text-success">{efficiencyMetrics.regulatoryComplianceScore}%</p>
                  </div>
                  <Activity className="w-8 h-8 text-success" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detailed Efficiency Metrics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Daily Activity Metrics</CardTitle>
                <CardDescription>Today's collection activity summary</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Services Restored Today</span>
                  <Badge variant="default">{efficiencyMetrics.servicesRestoredToday}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">New Debt Cases Assigned</span>
                  <Badge variant="secondary">{efficiencyMetrics.newDebtCasesAssigned}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Escalated to Legal</span>
                  <Badge variant="destructive">{efficiencyMetrics.escalatedToLegal}</Badge>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm">Total Customer Contacts</span>
                  <span className="font-medium">{efficiencyMetrics.totalCustomerContacts}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Successful Contacts</span>
                  <span className="font-medium text-success">{efficiencyMetrics.successfulContacts}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Contacts per Subscriber</span>
                  <span className="font-medium">{efficiencyMetrics.contactsPerSubscriber}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resolution Metrics</CardTitle>
                <CardDescription>Payment arrangements and dispute handling</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Payment Arrangements Created</span>
                  <Badge variant="default">{efficiencyMetrics.paymentArrangementsCreated}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Billing Dispute Resolution</span>
                  <Badge variant="secondary">{efficiencyMetrics.billingDisputeResolution}%</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">SMS Response Rate</span>
                  <Badge variant="secondary">{collectionKPIs.smsResponseRate}%</Badge>
                </div>
                <Separator />
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Productivity Score</span>
                    <span className="font-medium">87%</span>
                  </div>
                  <Progress value={87} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Quality Score</span>
                    <span className="font-medium">92%</span>
                  </div>
                  <Progress value={92} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="agent" className="space-y-6">
          {/* Agent Performance Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Cases</p>
                    <p className="text-2xl font-bold text-foreground">135</p>
                  </div>
                  <Users className="w-8 h-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Recovery</p>
                    <p className="text-2xl font-bold text-success">$365K</p>
                  </div>
                  <DollarSign className="w-8 h-8 text-success" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Resolution</p>
                    <p className="text-2xl font-bold text-foreground">3.2 days</p>
                  </div>
                  <Calendar className="w-8 h-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">PTP Success</p>
                    <p className="text-2xl font-bold text-success">65%</p>
                  </div>
                  <Activity className="w-8 h-8 text-success" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Agent Performance Table */}
          <Card>
            <CardHeader>
              <CardTitle>Agent Performance</CardTitle>
              <CardDescription>Individual agent metrics and performance indicators</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Agent</TableHead>
                    <TableHead>Assigned</TableHead>
                    <TableHead>Closed</TableHead>
                    <TableHead>Recovery Amount</TableHead>
                    <TableHead>Avg Resolution</TableHead>
                    <TableHead>Contact Rate</TableHead>
                    <TableHead>PTP Success</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agentPerformance.map((agent) => (
                    <TableRow key={agent.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{agent.name}</p>
                          <p className="text-sm text-muted-foreground">{agent.id}</p>
                        </div>
                      </TableCell>
                      <TableCell>{agent.assignedCases}</TableCell>
                      <TableCell>{agent.closedCases}</TableCell>
                      <TableCell className="text-success font-medium">${agent.recoveryAmount.toLocaleString()}</TableCell>
                      <TableCell>{agent.avgResolutionTime} days</TableCell>
                      <TableCell>
                        <Badge variant={agent.contactRate >= 80 ? "default" : "secondary"}>
                          {agent.contactRate}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={agent.ptpSuccess >= 70 ? "default" : "secondary"}>
                          {agent.ptpSuccess}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="space-y-6">
          {/* Risk Assessment KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">High Risk Subscribers</p>
                    <p className="text-2xl font-bold text-destructive">{riskMetrics.highRiskSubscribers}</p>
                  </div>
                  <AlertCircle className="w-8 h-8 text-destructive" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Medium Risk</p>
                    <p className="text-2xl font-bold text-secondary-foreground">{riskMetrics.mediumRiskSubscribers}</p>
                  </div>
                  <AlertCircle className="w-8 h-8 text-secondary-foreground" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Low Risk</p>
                    <p className="text-2xl font-bold text-success">{riskMetrics.lowRiskSubscribers}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-success" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Litigation Cases</p>
                    <p className="text-2xl font-bold text-primary">{riskMetrics.litigationCases}</p>
                  </div>
                  <FileText className="w-8 h-8 text-primary" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Risk Analysis Details */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Special Handling Cases</CardTitle>
                <CardDescription>Accounts requiring special attention</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Fraud Suspicious</span>
                  <Badge variant="destructive">{riskMetrics.fraudSuspiciousActivity}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Bankruptcy Petitions</span>
                  <Badge variant="destructive">{riskMetrics.bankruptcyPetitions}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Deceased Accounts</span>
                  <Badge variant="secondary">{riskMetrics.deceasedAccounts}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Hardship Requests</span>
                  <Badge variant="secondary">{riskMetrics.hardshipRequests}</Badge>
                </div>
                <Separator />
                <div className="flex justify-between items-center">
                  <span className="text-sm">Disputed Amounts</span>
                  <span className="font-medium text-primary">${riskMetrics.disputedServiceCharges.toLocaleString()}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Risk Distribution</CardTitle>
                <CardDescription>Portfolio risk breakdown by category</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">High Risk</span>
                    <span className="font-medium text-destructive">${controllerMetrics.riskExposure.highRisk.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Medium Risk</span>
                    <span className="font-medium text-secondary-foreground">${controllerMetrics.riskExposure.mediumRisk.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Low Risk</span>
                    <span className="font-medium text-success">${controllerMetrics.riskExposure.lowRisk.toLocaleString()}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center font-medium">
                    <span>Total Exposure</span>
                    <span>${controllerMetrics.riskExposure.total.toLocaleString()}</span>
                  </div>
                  <div className="pt-4">
                    <div className="text-sm mb-2">Risk Score Distribution</div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span>High Risk (700+)</span>
                        <span>32.7%</span>
                      </div>
                      <Progress value={32.7} className="h-2" />
                      <div className="flex justify-between text-xs">
                        <span>Medium Risk (400-699)</span>
                        <span>45.8%</span>
                      </div>
                      <Progress value={45.8} className="h-2" />
                      <div className="flex justify-between text-xs">
                        <span>Low Risk (&lt;400)</span>
                        <span>21.5%</span>
                      </div>
                      <Progress value={21.5} className="h-2" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Aging Analysis */}
          <Card>
            <CardHeader>
              <CardTitle>Aging Analysis</CardTitle>
              <CardDescription>Outstanding balances by aging buckets with collection priorities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">Current</p>
                  <p className="text-xl font-bold text-success">${controllerMetrics.agingBuckets.current.toLocaleString()}</p>
                  <Badge variant="secondary" className="mt-2">Low Priority</Badge>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">30+ Days</p>
                  <p className="text-xl font-bold">${controllerMetrics.agingBuckets.days30.toLocaleString()}</p>
                  <Badge variant="default" className="mt-2">Medium Priority</Badge>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">60+ Days</p>
                  <p className="text-xl font-bold text-secondary-foreground">${controllerMetrics.agingBuckets.days60.toLocaleString()}</p>
                  <Badge variant="destructive" className="mt-2">High Priority</Badge>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <p className="text-sm text-muted-foreground">90+ Days</p>
                  <p className="text-xl font-bold text-destructive">${controllerMetrics.agingBuckets.days90.toLocaleString()}</p>
                  <Badge variant="destructive" className="mt-2">Critical</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="controller" className="space-y-6">
          {/* Controller Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Risk Exposure</CardTitle>
                <CardDescription>Portfolio risk distribution</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">High Risk</span>
                    <span className="font-medium text-destructive">${controllerMetrics.riskExposure.highRisk.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Medium Risk</span>
                    <span className="font-medium text-secondary-foreground">${controllerMetrics.riskExposure.mediumRisk.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Low Risk</span>
                    <span className="font-medium text-success">${controllerMetrics.riskExposure.lowRisk.toLocaleString()}</span>
                  </div>
                  <div className="border-t pt-2">
                    <div className="flex justify-between items-center font-medium">
                      <span>Total Exposure</span>
                      <span>${controllerMetrics.riskExposure.total.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Collection Trends</CardTitle>
                <CardDescription>Weekly collection performance</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">This Week</p>
                    <p className="text-2xl font-bold text-foreground">${controllerMetrics.collectionTrends.thisWeek.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <trend.icon className={`w-4 h-4 ${trend.isPositive ? 'text-success' : 'text-destructive'}`} />
                    <span className={`text-sm font-medium ${trend.isPositive ? 'text-success' : 'text-destructive'}`}>
                      {trend.percentage}% vs last week
                    </span>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Week</p>
                    <p className="text-lg">${controllerMetrics.collectionTrends.lastWeek.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Aging Analysis</CardTitle>
                <CardDescription>Outstanding by aging buckets</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Current</span>
                    <span className="font-medium text-success">${controllerMetrics.agingBuckets.current.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">30+ days</span>
                    <span className="font-medium">${controllerMetrics.agingBuckets.days30.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">60+ days</span>
                    <span className="font-medium text-secondary-foreground">${controllerMetrics.agingBuckets.days60.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">90+ days</span>
                    <span className="font-medium text-destructive">${controllerMetrics.agingBuckets.days90.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Daily Recovery Sheet */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Recovery Sheet</CardTitle>
              <CardDescription>Generate daily collection summary report</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Report Date</Label>
                  <Input type="date" defaultValue="2024-01-30" />
                </div>
                <div>
                  <Label>Agent Group</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="All agents" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Agents</SelectItem>
                      <SelectItem value="team-a">Team A</SelectItem>
                      <SelectItem value="team-b">Team B</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button className="w-full flex items-center space-x-2">
                    <FileText className="w-4 h-4" />
                    <span>Generate Sheet</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="summary" className="space-y-6">
          {/* PTP Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total PTPs</p>
                    <p className="text-2xl font-bold text-foreground">{ptpSummary.totalPTPs}</p>
                  </div>
                  <FileText className="w-8 h-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Fulfilled</p>
                    <p className="text-2xl font-bold text-success">{ptpSummary.fulfilled}</p>
                  </div>
                  <Activity className="w-8 h-8 text-success" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Broken</p>
                    <p className="text-2xl font-bold text-destructive">{ptpSummary.broken}</p>
                  </div>
                  <TrendingDown className="w-8 h-8 text-destructive" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Success Rate</p>
                    <p className="text-2xl font-bold text-primary">
                      {Math.round((ptpSummary.fulfilled / ptpSummary.totalPTPs) * 100)}%
                    </p>
                  </div>
                  <PieChart className="w-8 h-8 text-primary" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* PTP Performance */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Commitment vs Collection</CardTitle>
                <CardDescription>PTP commitment and actual collection amounts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Committed</span>
                    <span className="font-medium text-primary">${ptpSummary.totalCommitted.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Actual Collected</span>
                    <span className="font-medium text-success">${ptpSummary.collected.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Collection Rate</span>
                    <span className="font-medium">
                      {Math.round((ptpSummary.collected / ptpSummary.totalCommitted) * 100)}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Export Options</CardTitle>
                <CardDescription>Download PTP reports in various formats</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  <Download className="w-4 h-4 mr-2" />
                  Export as Excel (.xlsx)
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Download className="w-4 h-4 mr-2" />
                  Export as CSV (.csv)
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Download className="w-4 h-4 mr-2" />
                  Export as PDF (.pdf)
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Enterprise Controller Tab - Only visible for Enterprise customer type */}
        {customerType === 'enterprise' && (
          <TabsContent value="controller" className="space-y-6">
            {/* Enterprise Controller Header */}
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Enterprise Controller Dashboard</h3>
                <p className="text-muted-foreground">Advanced analytics and management tools for enterprise accounts</p>
              </div>
              <div className="flex items-center gap-4">
                <Button variant="outline">
                  <Download className="w-4 h-4 mr-2" />
                  Export Enterprise Report
                </Button>
              </div>
            </div>

            {/* Enterprise-Specific KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Avg Contract Value</p>
                      <p className="text-2xl font-bold text-foreground">${collectionKPIs.avgContractValue.toLocaleString()}</p>
                    </div>
                    <DollarSign className="w-8 h-8 text-primary" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">SLA Compliance</p>
                      <p className="text-2xl font-bold text-success">{collectionKPIs.slaCompliance}%</p>
                    </div>
                    <Shield className="w-8 h-8 text-success" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Contract Disputes</p>
                      <p className="text-2xl font-bold text-warning">{collectionKPIs.contractDisputes}</p>
                    </div>
                    <AlertTriangle className="w-8 h-8 text-warning" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Escalation Rate</p>
                      <p className="text-2xl font-bold text-destructive">{collectionKPIs.escalationRate}%</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-destructive" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Enterprise Analytics Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Contract Performance</CardTitle>
                  <CardDescription>Enterprise contract and renewal metrics</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Contract Renewal Rate</span>
                    <span className="font-medium text-success">{collectionKPIs.contractRenewalRate}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Multi-Service Penetration</span>
                    <span className="font-medium">{collectionKPIs.multiServicePenetration}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Enterprise Churn Risk</span>
                    <span className="font-medium text-warning">{collectionKPIs.enterpriseChurnRisk}%</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Custom Solution Adoption</span>
                    <Badge variant="secondary">{collectionKPIs.customSolutionAdoption}%</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Account Manager Efficiency</span>
                    <Badge variant="secondary">{collectionKPIs.accountManagerEfficiency}%</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Payment & Settlement</CardTitle>
                  <CardDescription>Enterprise-specific payment patterns</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Avg Payment Terms</span>
                    <span className="font-medium text-primary">{collectionKPIs.avgPaymentTerm} days</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Wire Transfer Preference</span>
                    <span className="font-medium">{collectionKPIs.wireTransferPreference}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Enterprise Settlement Rate</span>
                    <span className="font-medium text-success">{collectionKPIs.enterpriseSettlementRate}%</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Regulatory Compliance</span>
                    <Badge variant="default">{collectionKPIs.regulatoryCompliance}%</Badge>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Enterprise Action Center */}
            <Card className="bg-card">
              <CardHeader>
                <CardTitle>Enterprise Action Center</CardTitle>
                <CardDescription>Quick actions and enterprise-specific tools</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Button variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2">
                    <FileText className="w-6 h-6" />
                    <span>Contract Analysis</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2">
                    <Target className="w-6 h-6" />
                    <span>SLA Monitoring</span>
                  </Button>
                  <Button variant="outline" className="h-20 flex flex-col items-center justify-center space-y-2">
                    <AlertTriangle className="w-6 h-6" />
                    <span>Escalation Management</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="milestones" className="space-y-6">
          {/* Milestone Analytics Header */}
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Milestone Analytics</h3>
              <p className="text-muted-foreground">Track automated collection milestone performance and outcomes</p>
            </div>
            <div className="flex items-center gap-4">
              <Select value={selectedMilestone} onValueChange={setSelectedMilestone}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select milestone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Milestones</SelectItem>
                  {milestoneTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      {type.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" className="bg-primary text-primary-foreground hover:bg-primary/90" >
                <Filter className="w-4 h-4 mr-2" />
                Export Report
              </Button>
            </div>
          </div>

          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Milestones</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">2,893</div>
                <p className="text-xs text-muted-foreground">
                  +12.5% from last period
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">76.4%</div>
                <p className="text-xs text-muted-foreground">
                  +3.2% from last period
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Cancellations</CardTitle>
                <Ban className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">369</div>
                <p className="text-xs text-muted-foreground">
                  -5.8% from last period
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Exemptions</CardTitle>
                <Shield className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">141</div>
                <p className="text-xs text-muted-foreground">
                  +1.2% from last period
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="performance" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="performance">Performance Analysis</TabsTrigger>
              <TabsTrigger value="cancellations">Cancellations</TabsTrigger>
              <TabsTrigger value="exemptions">Exemptions</TabsTrigger>
              <TabsTrigger value="batch-runs">Batch Runs</TabsTrigger>
            </TabsList>

            <TabsContent value="performance" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Milestone Performance Breakdown</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Milestone</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Successful</TableHead>
                        <TableHead>Failed</TableHead>
                        <TableHead>Cancelled</TableHead>
                        <TableHead>Exempted</TableHead>
                        <TableHead>Success Rate</TableHead>
                        <TableHead>Trend</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {milestonePerformance.map((milestone) => (
                        <TableRow key={milestone.milestone}>
                          <TableCell className="font-medium">{milestone.milestone}</TableCell>
                          <TableCell>{milestone.total.toLocaleString()}</TableCell>
                          <TableCell className="text-green-600">
                            {milestone.successful.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-red-600">
                            {milestone.failed.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-orange-600">
                            {milestone.cancelled.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-blue-600">
                            {milestone.exempted.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Progress value={milestone.successRate} className="w-16" />
                              <span className="text-sm">{milestone.successRate}%</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-1">
                              {getTrendIcon(milestone.trend)}
                              <span className={milestone.trend > 0 ? "text-green-600" : "text-red-600"}>
                                {Math.abs(milestone.trend)}%
                              </span>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cancellations" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Cancellation Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {cancellationReasons.map((reason, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{reason.reason}</span>
                            <span className="text-sm text-muted-foreground">
                              {reason.count} cases ({reason.percentage}%)
                            </span>
                          </div>
                          <Progress value={reason.percentage} className="h-2" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="exemptions" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Exemption Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {exemptionReasons.map((reason, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{reason.reason}</span>
                            <span className="text-sm text-muted-foreground">
                              {reason.count} cases ({reason.percentage}%)
                            </span>
                          </div>
                          <Progress value={reason.percentage} className="h-2" />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="batch-runs" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Recent Batch Runs</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Run ID</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Milestone</TableHead>
                        <TableHead>Customers</TableHead>
                        <TableHead>Successful</TableHead>
                        <TableHead>Failed</TableHead>
                        <TableHead>Cancelled</TableHead>
                        <TableHead>Exempted</TableHead>
                        <TableHead>Duration</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {batchRunHistory.map((run) => (
                        <TableRow key={run.id}>
                          <TableCell className="font-mono">{run.id}</TableCell>
                          <TableCell>{run.date}</TableCell>
                          <TableCell>{run.milestone}</TableCell>
                          <TableCell>{run.customers}</TableCell>
                          <TableCell className="text-green-600">{run.successful}</TableCell>
                          <TableCell className="text-red-600">{run.failed}</TableCell>
                          <TableCell className="text-orange-600">{run.cancelled}</TableCell>
                          <TableCell className="text-blue-600">{run.exempted}</TableCell>
                          <TableCell>{run.duration}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="writeoff" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Write-off Tracker</CardTitle>
              <CardDescription>Monitor and manage account write-offs</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Write-off ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Approved By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {writeOffs.map((writeOff) => (
                    <TableRow key={writeOff.id}>
                      <TableCell className="font-medium">{writeOff.id}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{writeOff.customerName}</p>
                          <p className="text-sm text-muted-foreground">{writeOff.customerId}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-destructive font-medium">
                        ${writeOff.amount.toLocaleString()}
                      </TableCell>
                      <TableCell>{writeOff.date}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{writeOff.reason}</Badge>
                      </TableCell>
                      <TableCell>{writeOff.approvedBy}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="mt-6 p-4 bg-secondary/20 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Total Write-offs This Month</span>
                  <span className="text-lg font-bold text-destructive">
                    ${writeOffs.reduce((sum, wo) => sum + wo.amount, 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}