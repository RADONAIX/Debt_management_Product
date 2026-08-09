import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Settings,
  Users,
  Clock,
  AlertTriangle,
  Shield,
  Eye,
  Edit,
  Trash2,
  Plus,
  Save,
  DollarSign,
  TrendingUp,
  GripVertical,
  RotateCcw,
  Scale,
  FileText,
  Calendar,
  Building,
} from "lucide-react";
import UserManagement from "./admin/UserManagement";
import RoleManagement from "./admin/RoleManagement";
import { PageHeader } from "@/components/layout/PageHeader";

interface AdminConfigProps {
  /** Fired when the signed-in user's own permissions changed. */
  onPermissionsChanged?: () => void;
}

export default function AdminConfig({ onPermissionsChanged }: AdminConfigProps = {}) {
  const [activeTab, setActiveTab] = useState("sla");
  const [selectedCurrency, setSelectedCurrency] = useState("USD");
  const [scorePriorityOrder, setScorePriorityOrder] = useState([
    {
      id: "external_credit",
      name: "External Credit Score",
      enabled: true,
      weight: 40,
    },
    { id: "ml_model", name: "ML Risk Model Score", enabled: true, weight: 30 },
    {
      id: "system_rules",
      name: "System Risk Rules",
      enabled: true,
      weight: 20,
    },
    {
      id: "payment_history",
      name: "Payment History Score",
      enabled: true,
      weight: 10,
    },
    {
      id: "industry_risk",
      name: "Industry Risk Score",
      enabled: false,
      weight: 0,
    },
  ]);
  const [conflictResolution, setConflictResolution] =
    useState("highest_priority");
  const [varianceThreshold, setVarianceThreshold] = useState(50);

  // Mock escalation SLAs
  const escalationSLAs = [
    {
      id: "SLA001",
      riskBand: "High",
      initialResponse: 2,
      escalationTime: 24,
      maxResolutionTime: 72,
      isActive: true,
    },
    {
      id: "SLA002",
      riskBand: "Medium",
      initialResponse: 4,
      escalationTime: 48,
      maxResolutionTime: 120,
      isActive: true,
    },
    {
      id: "SLA003",
      riskBand: "Low",
      initialResponse: 8,
      escalationTime: 96,
      maxResolutionTime: 240,
      isActive: true,
    },
  ];

  // Mock user access data
  // const userAccess = [
  //   {
  //     id: "USR001",
  //     name: "Sarah Johnson",
  //     email: "sarah.johnson@company.com",
  //     role: "Agent",
  //     permissions: ["read_customers", "create_ptp", "update_cases"],
  //     lastLogin: "2024-01-30 09:15",
  //     isActive: true,
  //   },
  //   {
  //     id: "USR002",
  //     name: "Mike Rodriguez",
  //     email: "mike.rodriguez@company.com",
  //     role: "Credit Controller",
  //     permissions: [
  //       "read_customers",
  //       "create_ptp",
  //       "update_cases",
  //       "approve_writeoffs",
  //     ],
  //     lastLogin: "2024-01-30 08:45",
  //     isActive: true,
  //   },
  //   {
  //     id: "USR003",
  //     name: "Admin User",
  //     email: "admin@company.com",
  //     role: "Admin",
  //     permissions: ["all_permissions"],
  //     lastLogin: "2024-01-30 10:30",
  //     isActive: true,
  //   },
  // ]

  // Mock audit log
  const auditLogs = [
    {
      id: "LOG001",
      timestamp: "2024-01-30 10:30:15",
      user: "Admin User",
      action: "Updated Risk Threshold",
      details: "Changed high risk threshold from $10,000 to $15,000",
      ipAddress: "192.168.1.100",
    },
    {
      id: "LOG002",
      timestamp: "2024-01-30 09:45:22",
      user: "Sarah Johnson",
      action: "Created PTP",
      details: "Created PTP for customer CUST001 - $750",
      ipAddress: "192.168.1.105",
    },
    {
      id: "LOG003",
      timestamp: "2024-01-30 09:20:08",
      user: "Mike Rodriguez",
      action: "Approved Write-off",
      details: "Approved write-off WO001 for $5,200",
      ipAddress: "192.168.1.102",
    },
  ];

  // Available currencies
  const currencies = [
    { code: "USD", name: "US Dollar", symbol: "$", isDefault: true },
    { code: "EUR", name: "Euro", symbol: "€", isDefault: false },
    { code: "GBP", name: "British Pound", symbol: "£", isDefault: false },
    { code: "INR", name: "Indian Rupee", symbol: "₹", isDefault: false },
    { code: "CAD", name: "Canadian Dollar", symbol: "C$", isDefault: false },
    { code: "AUD", name: "Australian Dollar", symbol: "A$", isDefault: false },
    { code: "JPY", name: "Japanese Yen", symbol: "¥", isDefault: false },
    { code: "CNY", name: "Chinese Yuan", symbol: "¥", isDefault: false },
  ];

  // Mock score examples for preview
  const exampleCustomers = [
    {
      name: "Rebecca Johnson",
      externalScore: 720,
      mlScore: 87.2,
      systemRules: "High Risk",
      finalScore: "High Risk (87.2%)",
      reasoning:
        "External Credit Score available (720) - ML Model indicates High risk",
    },
    {
      name: "Michael Chen",
      externalScore: null,
      mlScore: 45.8,
      systemRules: "Medium Risk",
      finalScore: "Medium Risk (45.8%)",
      reasoning:
        "External Score unavailable - Using ML Model Score (Medium risk)",
    },
    {
      name: "Enterprise Corp",
      externalScore: 850,
      mlScore: 25.1,
      systemRules: "Low Risk",
      finalScore: "Low Risk (850 score)",
      reasoning:
        "External Credit Score available and excellent (850) - Override ML prediction",
    },
  ];

  // Mock data for Agency Management
  const agencies = [
    {
      id: "AGN001",
      name: "Meridian Recovery Solutions",
      contact: "contact@meridianrecovery.com",
      phone: "+1-555-0123",
      specialization: "Commercial Debt",
      performanceRating: 92,
      recoveryRate: 68.5,
      avgResponseTime: 3.2,
      commissionRate: 15,
      status: "Active",
      assignedCases: 156,
      totalRecovered: 2450000,
    },
    {
      id: "AGN002",
      name: "Elite Collection Agency",
      contact: "info@elitecollection.com",
      phone: "+1-555-0456",
      specialization: "Consumer Debt",
      performanceRating: 87,
      recoveryRate: 72.1,
      avgResponseTime: 2.8,
      commissionRate: 18,
      status: "Active",
      assignedCases: 203,
      totalRecovered: 1890000,
    },
    {
      id: "AGN003",
      name: "Regional Recovery Corp",
      contact: "support@regionalrecovery.com",
      phone: "+1-555-0789",
      specialization: "Small Business",
      performanceRating: 75,
      recoveryRate: 58.3,
      avgResponseTime: 4.1,
      commissionRate: 20,
      status: "Under Review",
      assignedCases: 89,
      totalRecovered: 680000,
    },
  ];

  // Mock data for Legal Cases
  const legalCases = [
    {
      id: "LEG001",
      customerName: "TechCorp Industries",
      amount: 125000,
      status: "Filing Judgment",
      attorney: "Sarah Mitchell",
      courtDate: "2024-02-15",
      filingDate: "2024-01-10",
      lastUpdate: "2024-01-28",
      stage: "Post-Judgment",
      probability: 85,
    },
    {
      id: "LEG002",
      customerName: "Retail Solutions LLC",
      amount: 78500,
      status: "Discovery Phase",
      attorney: "Michael Chang",
      courtDate: "2024-02-22",
      filingDate: "2023-12-05",
      lastUpdate: "2024-01-25",
      stage: "Pre-Trial",
      probability: 72,
    },
    {
      id: "LEG003",
      customerName: "Global Manufacturing",
      amount: 235000,
      status: "Settlement Negotiation",
      attorney: "Jennifer Rodriguez",
      courtDate: "2024-03-01",
      filingDate: "2023-11-20",
      lastUpdate: "2024-01-30",
      stage: "Settlement",
      probability: 90,
    },
    {
      id: "LEG004",
      customerName: "Metro Construction",
      amount: 95000,
      status: "Awaiting Service",
      attorney: "David Thompson",
      courtDate: "2024-02-08",
      filingDate: "2024-01-20",
      lastUpdate: "2024-01-29",
      stage: "Initial Filing",
      probability: 65,
    },
  ];

  const moveScoreSystem = (fromIndex: number, toIndex: number) => {
    const newOrder = [...scorePriorityOrder];
    const [removed] = newOrder.splice(fromIndex, 1);
    newOrder.splice(toIndex, 0, removed);
    setScorePriorityOrder(newOrder);
  };

  const toggleScoreSystem = (id: string) => {
    setScorePriorityOrder((prev) =>
      prev.map((system) =>
        system.id === id ? { ...system, enabled: !system.enabled } : system
      )
    );
  };

  const updateWeight = (id: string, weight: number) => {
    setScorePriorityOrder((prev) =>
      prev.map((system) => (system.id === id ? { ...system, weight } : system))
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Configuration"
        description="Manage system settings and user access"
        actions={
          <Button className="flex items-center space-x-2">
            <Save className="w-4 h-4" />
            <span>Save All Changes</span>
          </Button>
        }
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="sla">SLA Management</TabsTrigger>
          <TabsTrigger value="users">User Access</TabsTrigger>
          <TabsTrigger value="roles">Roles &amp; Permissions</TabsTrigger>
          <TabsTrigger value="scoring">Score Priority</TabsTrigger>
          <TabsTrigger value="currency">Currency Settings</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="sla" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Escalation SLA Configuration</CardTitle>
              <CardDescription>
                Set response and resolution time requirements by risk band
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Risk Band</TableHead>
                    <TableHead>Initial Response (hrs)</TableHead>
                    <TableHead>Escalation Time (hrs)</TableHead>
                    <TableHead>Max Resolution (hrs)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {escalationSLAs.map((sla) => (
                    <TableRow key={sla.id}>
                      <TableCell>
                        <Badge
                          variant={
                            sla.riskBand === "High"
                              ? "destructive"
                              : sla.riskBand === "Medium"
                              ? "secondary"
                              : "default"
                          }
                        >
                          {sla.riskBand}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={sla.initialResponse}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={sla.escalationTime}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={sla.maxResolutionTime}
                          className="w-20"
                        />
                      </TableCell>
                      <TableCell>
                        <Switch checked={sla.isActive} />
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Save className="w-4 h-4" />
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

        <TabsContent value="users" className="space-y-6">
          <UserManagement onPermissionsChanged={onPermissionsChanged} />
        </TabsContent>

        <TabsContent value="roles" className="space-y-6">
          <RoleManagement onPermissionsChanged={onPermissionsChanged} />
        </TabsContent>

        <TabsContent value="scoring" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="w-5 h-5" />
                <span>Score Priority Rules Configuration</span>
              </CardTitle>
              <CardDescription>
                Configure how different scoring systems are prioritized and how
                conflicts are resolved
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                {/* Priority Configuration */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-medium">
                      Scoring System Priority
                    </Label>
                    <p className="text-sm text-muted-foreground mb-4">
                      Drag to reorder scoring systems by priority (highest
                      first)
                    </p>
                    <div className="space-y-2">
                      {scorePriorityOrder.map((system, index) => (
                        <div
                          key={system.id}
                          className="flex items-center justify-between p-3 border rounded-lg bg-card"
                        >
                          <div className="flex items-center space-x-3">
                            <GripVertical className="w-4 h-4 text-muted-foreground cursor-move" />
                            <div className="flex items-center space-x-2">
                              <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                                {index + 1}
                              </span>
                              <span className="font-medium">{system.name}</span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            {conflictResolution === "weighted_average" && (
                              <div className="flex items-center space-x-1">
                                <Input
                                  type="number"
                                  value={system.weight}
                                  onChange={(e) =>
                                    updateWeight(
                                      system.id,
                                      parseInt(e.target.value)
                                    )
                                  }
                                  className="w-16 h-8 text-sm"
                                  min="0"
                                  max="100"
                                />
                                <span className="text-xs text-muted-foreground">
                                  %
                                </span>
                              </div>
                            )}
                            <Switch
                              checked={system.enabled}
                              onCheckedChange={() =>
                                toggleScoreSystem(system.id)
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base font-medium">
                      Conflict Resolution Method
                    </Label>
                    <Select
                      value={conflictResolution}
                      onValueChange={setConflictResolution}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="highest_priority">
                          Use Highest Priority Available
                        </SelectItem>
                        <SelectItem value="weighted_average">
                          Weighted Average of Available Scores
                        </SelectItem>
                        <SelectItem value="conservative">
                          Conservative (Use Highest Risk Score)
                        </SelectItem>
                        <SelectItem value="optimistic">
                          Optimistic (Use Lowest Risk Score)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      {conflictResolution === "highest_priority" &&
                        "Always use the score from the highest priority available system"}
                      {conflictResolution === "weighted_average" &&
                        "Calculate weighted average based on system weights"}
                      {conflictResolution === "conservative" &&
                        "When scores conflict, always choose the higher risk assessment"}
                      {conflictResolution === "optimistic" &&
                        "When scores conflict, always choose the lower risk assessment"}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <Label htmlFor="variance-threshold">
                      Score Variance Threshold
                    </Label>
                    <div className="flex items-center space-x-2">
                      <Input
                        id="variance-threshold"
                        type="number"
                        value={varianceThreshold}
                        onChange={(e) =>
                          setVarianceThreshold(parseInt(e.target.value))
                        }
                        className="w-24"
                        min="0"
                        max="100"
                      />
                      <span className="text-sm text-muted-foreground">
                        points difference
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Trigger manual review when scores differ by more than this
                      threshold
                    </p>
                  </div>
                </div>

                {/* Preview Section */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-medium">
                      Configuration Preview
                    </Label>
                    <p className="text-sm text-muted-foreground mb-4">
                      See how your priority rules would resolve for example
                      customers
                    </p>
                    <div className="space-y-3">
                      {exampleCustomers.map((customer, idx) => (
                        <Card key={idx} className="p-4">
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="font-medium">
                                {customer.name}
                              </span>
                              <Badge
                                variant={
                                  customer.finalScore.includes("High")
                                    ? "destructive"
                                    : customer.finalScore.includes("Medium")
                                    ? "secondary"
                                    : "default"
                                }
                              >
                                {customer.finalScore}
                              </Badge>
                            </div>
                            <div className="text-xs space-y-1">
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  External Credit:
                                </span>
                                <span>{customer.externalScore || "N/A"}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  ML Model:
                                </span>
                                <span>{customer.mlScore}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                  System Rules:
                                </span>
                                <span>{customer.systemRules}</span>
                              </div>
                            </div>
                            <div className="text-xs text-muted-foreground pt-1 border-t">
                              <strong>Logic:</strong> {customer.reasoning}
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-base font-medium">
                      Advanced Settings
                    </Label>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Switch id="auto-refresh" defaultChecked />
                        <Label htmlFor="auto-refresh" className="text-sm">
                          Auto-refresh scores every 24 hours
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch id="manual-review" defaultChecked />
                        <Label htmlFor="manual-review" className="text-sm">
                          Require manual review for high variance
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch id="audit-scoring" defaultChecked />
                        <Label htmlFor="audit-scoring" className="text-sm">
                          Log all scoring decisions
                        </Label>
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-2 pt-4">
                    <Button variant="outline" className="flex-1">
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Reset to Defaults
                    </Button>
                    <Button className="flex-1">
                      <Save className="w-4 h-4 mr-2" />
                      Save Configuration
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="currency" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5" />
                <span>Multicurrency Configuration</span>
              </CardTitle>
              <CardDescription>
                Manage currency display settings for the system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="default-currency">
                      Default System Currency
                    </Label>
                    <Select
                      value={selectedCurrency}
                      onValueChange={setSelectedCurrency}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select default currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map((currency) => (
                          <SelectItem key={currency.code} value={currency.code}>
                            <div className="flex items-center space-x-2">
                              <span className="font-medium">
                                {currency.symbol}
                              </span>
                              <span>{currency.code}</span>
                              <span className="text-muted-foreground">
                                - {currency.name}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground mt-1">
                      This will be the default currency for all monetary
                      displays
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Currency Display Format</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="symbol-before"
                          name="format"
                          defaultChecked
                        />
                        <Label htmlFor="symbol-before" className="text-sm">
                          Symbol before amount (
                          {
                            currencies.find((c) => c.code === selectedCurrency)
                              ?.symbol
                          }
                          1,234.56)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input type="radio" id="symbol-after" name="format" />
                        <Label htmlFor="symbol-after" className="text-sm">
                          Symbol after amount (1,234.56
                          {
                            currencies.find((c) => c.code === selectedCurrency)
                              ?.symbol
                          }
                          )
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input type="radio" id="code-format" name="format" />
                        <Label htmlFor="code-format" className="text-sm">
                          Currency code format (1,234.56 {selectedCurrency})
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>Preview</Label>
                    <Card className="p-4">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">
                            Outstanding Amount:
                          </span>
                          <span className="font-medium">
                            {
                              currencies.find(
                                (c) => c.code === selectedCurrency
                              )?.symbol
                            }
                            15,750.00
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">
                            Payment Amount:
                          </span>
                          <span className="font-medium text-green-600">
                            {
                              currencies.find(
                                (c) => c.code === selectedCurrency
                              )?.symbol
                            }
                            2,500.00
                          </span>
                        </div>
                        <div className="flex justify-between border-t pt-2">
                          <span className="text-sm font-medium">
                            Remaining Balance:
                          </span>
                          <span className="font-bold">
                            {
                              currencies.find(
                                (c) => c.code === selectedCurrency
                              )?.symbol
                            }
                            13,250.00
                          </span>
                        </div>
                      </div>
                    </Card>
                  </div>

                  <div>
                    <Label>Advanced Settings</Label>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-2">
                        <Switch id="thousand-separator" defaultChecked />
                        <Label htmlFor="thousand-separator" className="text-sm">
                          Use thousand separators (1,234.56)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch id="decimal-places" defaultChecked />
                        <Label htmlFor="decimal-places" className="text-sm">
                          Always show decimal places
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch id="multi-currency-support" />
                        <Label
                          htmlFor="multi-currency-support"
                          className="text-sm"
                        >
                          Enable multi-currency customer accounts
                        </Label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <Label>Supported Currencies</Label>
                <Table className="mt-2">
                  <TableHeader>
                    <TableRow>
                      <TableHead>Currency Code</TableHead>
                      <TableHead>Currency Name</TableHead>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Default</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currencies.map((currency) => (
                      <TableRow key={currency.code}>
                        <TableCell className="font-medium">
                          {currency.code}
                        </TableCell>
                        <TableCell>{currency.name}</TableCell>
                        <TableCell className="font-medium">
                          {currency.symbol}
                        </TableCell>
                        <TableCell>
                          <Badge variant="default">Active</Badge>
                        </TableCell>
                        <TableCell>
                          {currency.isDefault && (
                            <Badge variant="secondary">Default</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>System Audit Log</CardTitle>
              <CardDescription>
                Track all system activities and changes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm">
                        {log.timestamp}
                      </TableCell>
                      <TableCell>{log.user}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.action}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {log.details}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.ipAddress}
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
