import { useState, useMemo, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CaseManagement from "./CaseManagement/CaseManagement";
import PromiseToPay from "./PromiseToPay";
import StrategyDashboard from "@/components/Strategy/StrategyDashboard";
import DunningEngine from "./DunningEngine";
import PaymentTracking from "./PaymentTracking";
import ReportsDashboard from "./ReportsDashboard";
import AdminConfig from "./AdminConfig";
import CustomerProfile from "./CustomerProfile";
import CorporateAccountManagement from "./CorporateAccountManagement";
import EmployeeProfile from "./EmployeeProfile";
import { SHARED_CUSTOMERS } from "@/components/shared/customerData";
import {
  ENTERPRISE_EMPLOYEES,
  Employee,
} from "@/components/shared/employeeData";
import { getAgentById } from "@/components/shared/agentData";
import { useCustomerType } from "@/contexts/CustomerTypeContext";
import RADONaix from "@/assets/RADONaix-logo.png";

// import { CustomerProfile as CustomerProfile2 } from "@/components/360Overview/CustomerProfile"

import {
  Search,
  DollarSign,
  AlertCircle,
  FileText,
  TrendingUp,
  Users,
  User,
  CreditCard,
  LogOut,
  Building2,
  HandHeart,
  BarChart3,
  Home,
  Megaphone,
  RefreshCw,
  PieChart,
  Settings,
  AlertOctagon,
  Target,
  Play,
  Filter,
  Calendar,
} from "lucide-react";
import CampaignSummary from "./CampaignSummary/Index";
import AiDialer from "./AiDialer/Index";
import OverviewDashbaord from "./OverviewDashboard/Index";
import Reports, { type RegisterKey } from "./Reports/Index";
import Designer from "./Designer/Index";
import CustomerDetail from "./CampaignSummary/CustomerDetail";
import CustomerProfile360 from "./CampaignSummary/CustomerProfile";
import AgentPerformance from "./Agentperformance/AgentPerformace";
import AiGuardrails from "./AiGuardrails/Index";
import RiskAnalysis from "./Risk_analysis";
import RiskGridDashboard from "./RiskGridDashboard";
import UserManagement from "./admin/UserManagement";
import RoleManagement from "./admin/RoleManagement";
import { getCurrentUser, getPermissions } from "@/lib/auth";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { groupKeyForModule, labelForModule } from "@/components/layout/navConfig";
import { PlaceholderPage } from "@/components/shared/PlaceholderPage";
import RecoveryWorkspace from "@/components/Recovery";
import CollectionsWorkspace from "@/components/Collection";
import CollectionsDashboard from "@/components/Collection/CollectionsDashboard";
import StrategyVersions from "@/components/Strategy/StrategyVersions";
import StrategySimulation from "@/components/Strategy/StrategySimulation";
import { Headset, Inbox, Wallet } from "lucide-react";
import { getChatSummary } from "@/lib/engagement";

/** Sidebar modules that have no screen yet. Empty — every module is built. */
const PLACEHOLDERS: Record<string, { title: string; description: string; icon: typeof Inbox }> = {};

/** Fallback titles for modules that aren't reachable from the sidebar. */
const EXTRA_MODULE_TITLES: Record<string, string> = {
  admin: "Admin Configuration",
  customer_profile: "Customer Profile",
  chatbot: "Chatbot Configuration",
  payments: "Payment Tracking",
};

interface DashboardProps {
  onLogout: () => void;
}



/** Remembers where the user was, so a browser refresh does not lose the page. */
const VIEW_KEY = "assure_active_view";

const readView = (): { module: string; customer: string } => {
  try {
    const raw = sessionStorage.getItem(VIEW_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* corrupt or unavailable storage just falls back to the dashboard */
  }
  return { module: "dashboard", customer: "" };
};

export default function Dashboard({ onLogout }: DashboardProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [employeeSearchTerm, setEmployeeSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<any>(() => readView().customer);
  // Set when another screen sends the user to a specific case, so the
  // workspace can open it on arrival.
  const [openCaseId, setOpenCaseId] = useState<number | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );
  const [activeModule, setActiveModule] = useState(() => readView().module);
  const [expandedMainModule, setExpandedMainModule] = useState<string | null>(
    () => groupKeyForModule(readView().module)
  );

  // Persist the view on every change, so a refresh returns to it.
  useEffect(() => {
    try {
      sessionStorage.setItem(
        VIEW_KEY,
        JSON.stringify({ module: activeModule, customer: selectedCustomer ?? "" }),
      );
    } catch {
      /* storage may be unavailable — navigation still works, it just won't persist */
    }
  }, [activeModule, selectedCustomer]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [waitingChats, setWaitingChats] = useState(0);
  const { customerType, setCustomerType } = useCustomerType();

  // RBAC comes from the backend (/auth/my-permissions), cached in localStorage.
  // `permissionsVersion` re-reads that cache after an admin edits their own role.
  const [permissionsVersion, setPermissionsVersion] = useState(0);
  /* eslint-disable react-hooks/exhaustive-deps -- both read localStorage, so
     `permissionsVersion` is the deliberate cache-busting dependency. */
  const currentUser = useMemo(() => getCurrentUser(), [permissionsVersion]);
  const userPermissions = useMemo(() => getPermissions(), [permissionsVersion]);
  /* eslint-enable react-hooks/exhaustive-deps */
  const email = currentUser?.email ?? null;

  const hasAccess = useCallback(
    // Defaults to "view" so every existing call site is unchanged; screens that
    // gate their write actions ask for "edit".
    (key: string, action: "view" | "edit" = "view") => !!userPermissions[key]?.[action],
    [userPermissions]
  );
  const onPermissionsChanged = useCallback(() => setPermissionsVersion((v) => v + 1), []);

  // The Admin Configuration screen hosts the identity screens, so either admin
  // permission is enough to open it.
  const canAdmin = hasAccess("userManagement") || hasAccess("roleManagement");

  // The badge is the live COUNT(*) of chatbot.escalations where status = 0.
  // Polling keeps both the Operations group and AI Engagement item current
  // while an agent stays anywhere in the application.
  useEffect(() => {
    if (!hasAccess("aiEngagementCenter")) {
      setWaitingChats(0);
      return;
    }
    let active = true;
    const refresh = async () => {
      try {
        const summary = await getChatSummary();
        if (active) setWaitingChats(summary.waiting);
      } catch {
        // A transient badge failure must not interrupt the rest of the shell.
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 5_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [hasAccess]);

  // Header title tracks the selected module, using the sidebar labels so the
  // two never drift apart.
  const moduleTitle = useMemo(
    () => labelForModule(activeModule) ?? EXTRA_MODULE_TITLES[activeModule] ?? "RADONaix Assure+",
    [activeModule],
  );
  
  const getRiskBadgeVariant = (risk: string) => {
    switch (risk) {
      case "low":
        return "default";
      case "medium":
        return "secondary";
      case "high":
        return "destructive";
      case "critical":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getRoleDisplayName = (role: string) => {
    const roleMap: { [key: string]: string } = {
      admin: "Administrator",
      agent: "Collection Agent",
      analyst: "Business Analyst",
      credit_controller: "Collections Specialist",
      customer_care: "Customer Care",
    };
    return roleMap[role] || role;
  };

  
  const filteredCustomers = useMemo(() => {
    return SHARED_CUSTOMERS.filter((customer) => {
      const matchesSearch =
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.id.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType =
        customerType === "all" || customer.customerType === customerType;

      return matchesSearch && matchesType;
    });
  }, [searchTerm, customerType]);

  const filteredEmployees = useMemo(() => {
    if (customerType !== "enterprise") return [];

    return ENTERPRISE_EMPLOYEES.filter((employee) => {
      const matchesSearch =
        employee.name
          .toLowerCase()
          .includes(employeeSearchTerm.toLowerCase()) ||
        employee.email
          .toLowerCase()
          .includes(employeeSearchTerm.toLowerCase()) ||
        employee.employeeId
          .toLowerCase()
          .includes(employeeSearchTerm.toLowerCase()) ||
        employee.department
          .toLowerCase()
          .includes(employeeSearchTerm.toLowerCase()) ||
        employee.position
          .toLowerCase()
          .includes(employeeSearchTerm.toLowerCase()) ||
        employee.subsidiary
          .toLowerCase()
          .includes(employeeSearchTerm.toLowerCase());

      return matchesSearch;
    });
  }, [employeeSearchTerm, customerType]);

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((c) => !c)}
        activeModule={activeModule}
        onSelectModule={setActiveModule}
        expandedGroup={expandedMainModule}
        onToggleGroup={setExpandedMainModule}
        hasAccess={hasAccess}
        notificationCounts={{ operations: waitingChats, ai_dialer: waitingChats }}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader
          title={moduleTitle}
          customerType={customerType}
          onCustomerTypeChange={setCustomerType}
          email={email}
          userName={currentUser?.name ?? null}
          roleLabel={currentUser?.roleLabel ?? currentUser?.role ?? null}
          canAdmin={canAdmin}
          onOpenAdmin={() => setActiveModule("admin")}
          onLogout={onLogout}
          onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
        />

        <main className="flex-1 px-6 py-6 overflow-x-auto">
          {/* {activeModule == "dashboard" && (
            <OverviewDashbaord
              setActiveModule={setActiveModule}
              setSelectedCustomer={setSelectedCustomer}
            />
          )} */}
          {activeModule === "ihji" && (
            <>
              {customerType === "enterprise" ? (
                <div>
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Enterprise Accounts
                            </p>
                            <p className="text-xl font-bold text-foreground">
                              {filteredCustomers.length}
                            </p>
                          </div>
                          <Building2 className="w-6 h-6 text-primary" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Avg Contract Value
                            </p>
                            <p className="text-xl font-bold text-foreground">
                              $245K
                            </p>
                          </div>
                          <DollarSign className="w-6 h-6 text-success" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Outstanding Debt
                            </p>
                            <p className="text-xl font-bold text-destructive">
                              $1.8M
                            </p>
                          </div>
                          <AlertCircle className="w-6 h-6 text-destructive" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              SLA Compliance
                            </p>
                            <p className="text-xl font-bold text-success">
                              94.2%
                            </p>
                          </div>
                          <Target className="w-6 h-6 text-success" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Contract Renewals
                            </p>
                            <p className="text-xl font-bold text-primary">12</p>
                          </div>
                          <RefreshCw className="w-6 h-6 text-primary" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-muted-foreground">
                              Escalated Cases
                            </p>
                            <p className="text-xl font-bold text-warning">8</p>
                          </div>
                          <AlertOctagon className="w-6 h-6 text-warning" />
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="mt-6">
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        <span>Corporate Account Hub</span>
                      </CardTitle>
                      <CardDescription>
                        Comprehensive management and monitoring of enterprise
                        corporate accounts with subsidiary structures
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <CorporateAccountManagement />
                    </CardContent>
                  </Card>

                  <Card className="mt-6">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center space-x-2">
                            <Users className="h-5 w-5 text-primary" />
                            <span>Employee Management</span>
                          </CardTitle>
                          <CardDescription>
                            Search and manage employees across all enterprise
                            subsidiaries
                          </CardDescription>
                        </div>
                        <div className="flex space-x-2 w-96">
                          <div className="relative flex-1">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Search by name, ID, email, or department..."
                              value={employeeSearchTerm}
                              onChange={(e) =>
                                setEmployeeSearchTerm(e.target.value)
                              }
                              className="pl-10"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Employee Quick List */}
                      {employeeSearchTerm && (
                        <div className="mt-4">
                          <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                            {filteredEmployees.slice(0, 6).map((employee) => (
                              <div
                                key={employee.id}
                                className={`px-3 py-2 border rounded-lg cursor-pointer transition-colors text-sm ${
                                  selectedEmployee?.id === employee.id
                                    ? "bg-primary/10 border-primary"
                                    : "hover:bg-secondary/50"
                                }`}
                                onClick={() => setSelectedEmployee(employee)}
                              >
                                <span className="font-medium">
                                  {employee.name}
                                </span>
                                <span className="text-muted-foreground ml-2">
                                  ({employee.employeeId})
                                </span>
                                <Badge
                                  variant={
                                    employee.status === "active"
                                      ? "default"
                                      : "secondary"
                                  }
                                  className="ml-2 text-xs"
                                >
                                  {employee.status}
                                </Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {employeeSearchTerm === "" && (
                        <div className="mt-4">
                          <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
                            {filteredEmployees.map((employee) => (
                              <div
                                key={employee.id}
                                className={`px-3 py-2 border rounded-lg cursor-pointer transition-colors text-sm w-full sm:w-auto ${
                                  selectedEmployee?.id === employee.id
                                    ? "bg-primary/10 border-primary"
                                    : "hover:bg-secondary/50"
                                }`}
                                onClick={() => setSelectedEmployee(employee)}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">
                                        {employee.name}
                                      </span>
                                      <Building2 className="h-4 w-4 text-primary" />
                                    </div>
                                    <span className="text-muted-foreground">
                                      ({employee.employeeId})
                                    </span>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {employee.position} •{" "}
                                      {employee.department}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {employee.subsidiary}
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <Badge
                                      variant={
                                        employee.status === "active"
                                          ? "default"
                                          : employee.status === "on-leave"
                                          ? "destructive"
                                          : "secondary"
                                      }
                                    >
                                      {employee.status.charAt(0).toUpperCase() +
                                        employee.status.slice(1)}
                                    </Badge>
                                    {employee.accountValue && (
                                      <Badge
                                        variant="secondary"
                                        className="text-xs"
                                      >
                                        ${employee.accountValue}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardHeader>
                    <CardContent>
                      <EmployeeProfile selectedEmployee={selectedEmployee} />
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-6">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {customerType === "all"
                              ? "Active Subscribers"
                              : "Consumer Customers"}
                          </p>
                          <p className="text-xl font-bold text-foreground">
                            {filteredCustomers.length}
                          </p>
                        </div>
                        <Users className="w-6 h-6 text-primary" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">ARPU</p>
                          <p className="text-xl font-bold text-foreground">
                            $85
                          </p>
                        </div>
                        <DollarSign className="w-6 h-6 text-success" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Outstanding Debt
                          </p>
                          <p className="text-xl font-bold text-destructive">
                            {customerType === "normal" ? "$0.6M" : "$2.4M"}
                          </p>
                        </div>
                        <AlertCircle className="w-6 h-6 text-destructive" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Service Restoration
                          </p>
                          <p className="text-xl font-bold text-success">78.5%</p>
                        </div>
                        <RefreshCw className="w-6 h-6 text-success" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Disconnected Services
                          </p>
                          <p className="text-xl font-bold text-warning">156</p>
                        </div>
                        <AlertOctagon className="w-6 h-6 text-warning" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            Bill Shock Cases
                          </p>
                          <p className="text-xl font-bold text-warning">23</p>
                        </div>
                        <Target className="w-6 h-6 text-warning" />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {customerType !== "enterprise" && (
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Customer Management</CardTitle>
                        <CardDescription>
                          Search customers and view detailed information
                        </CardDescription>
                      </div>
                      <div className="flex space-x-2 w-96">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Search by name, ID, or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Customer Quick List */}
                    {searchTerm && (
                      <div className="mt-4">
                        <div className="flex flex-wrap gap-2 max-h-24 overflow-y-auto">
                          {filteredCustomers.slice(0, 6).map((customer) => (
                            <div
                              key={customer.id}
                              className={`px-3 py-2 border rounded-lg cursor-pointer transition-colors text-sm ${
                                selectedCustomer?.id === customer.id
                                  ? "bg-primary/10 border-primary"
                                  : "hover:bg-secondary/50"
                              }`}
                              onClick={() => setSelectedCustomer(customer)}
                            >
                              <span className="font-medium">
                                {customer.name}
                              </span>
                              <span className="text-muted-foreground ml-2">
                                ({customer.id})
                              </span>
                              {customer.overdueAmount > 0 && (
                                <Badge
                                  variant="destructive"
                                  className="ml-2 text-xs"
                                >
                                  ${customer.overdueAmount}
                                </Badge>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {searchTerm == "" && (
                      <div className="mt-4">
                        <div className="flex flex-wrap gap-2 max-h-64 overflow-y-auto">
                          {filteredCustomers.map((customer) => (
                            <div
                              key={customer.id}
                              className={`px-3 py-2 border rounded-lg cursor-pointer transition-colors text-sm w-full sm:w-auto ${
                                selectedCustomer?.id === customer.id
                                  ? "bg-primary/10 border-primary"
                                  : "hover:bg-secondary/50"
                              }`}
                              onClick={() => setSelectedCustomer(customer)}
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">
                                      {customer.name}
                                    </span>
                                    {customer.customerType === "enterprise" && (
                                      <Building2 className="h-4 w-4 text-primary" />
                                    )}
                                  </div>
                                  <span className="text-muted-foreground ml-2">
                                    ({customer.id})
                                  </span>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {customer.contractPlan} •{" "}
                                    {customer.accountStatus}
                                  </div>
                                  {customer.primaryAgent &&
                                    (() => {
                                      const agent = getAgentById(
                                        customer.primaryAgent
                                      );
                                      return agent ? (
                                        <div className="text-xs text-primary mt-1 flex items-center gap-1">
                                          <User className="h-3 w-3" />
                                          Agent: {agent.name} •{" "}
                                          {agent.department}
                                        </div>
                                      ) : null;
                                    })()}
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Badge
                                    variant={
                                      customer.customerType === "enterprise"
                                        ? "default"
                                        : "secondary"
                                    }
                                  >
                                    {customer.customerType === "enterprise"
                                      ? "Enterprise"
                                      : "Normal"}
                                  </Badge>
                                  {customer.overdueAmount > 0 && (
                                    <Badge
                                      variant="destructive"
                                      className="text-xs"
                                    >
                                      ${customer.overdueAmount}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    {selectedCustomer ? (
                      <CustomerProfile selectedCustomer={selectedCustomer} />
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">
                          Select a customer from the search panel to view their
                          detailed profile
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}

          {activeModule === "cases" && <></>}
          {/* {activeModule === "cases" && <CaseManagement />} */}
          {activeModule === "ptp" && <PromiseToPay />}
          {activeModule === "risk" && <StrategyDashboard />}
          {activeModule === "dunning" && <DunningEngine />}
          {activeModule === "payments" && <PaymentTracking />}
          {/* {activeModule === "reports" && <ReportsDashboard />} */}
          {/* One screen, addressed as `report` or `report:<register>` — the
              sidebar picks the register, so it survives a refresh. */}
          {(activeModule === "report" || activeModule.startsWith("report:")) && (
            <Reports register={(activeModule.split(":")[1] as RegisterKey) || "ptp"} />
          )}

          { activeModule =='dashboard' && <OverviewDashbaord setActiveModule={setActiveModule} setSelectedCustomer={setSelectedCustomer}/>}
          {activeModule === "agent_performance" && (
            <AgentPerformance canSeeFloor={hasAccess("userManagement")} />
          )}
          {activeModule === "ai_guardrails" && (
            <AiGuardrails canEdit={hasAccess("aiGuardrails", "edit")} />
          )}

          {activeModule === "admin" && canAdmin && (
            <AdminConfig onPermissionsChanged={onPermissionsChanged} />
          )}
          {activeModule === "user_management" && hasAccess("userManagement") && (
            <UserManagement onPermissionsChanged={onPermissionsChanged} />
          )}
          {activeModule === "role_management" && hasAccess("roleManagement") && (
            <RoleManagement onPermissionsChanged={onPermissionsChanged} />
          )}

          {activeModule === "chatbot" && (
            <div className="w-full h-screen overflow-hidden">
              <iframe
                src="http://localhost:3001/admin/guardrails_configuration"
                className="w-full h-full origin-top-left border-0"
                style={{
                  transform: "scale(0.9)",
                  width: "111%",
                  height: "111%",
                  overflow: "hidden",
                  scrollbarWidth: "none", // Firefox
                }}
              />
            </div>
          )}
          {activeModule === "self_service_bi" && (
            <div className="w-full h-screen overflow-hidden">
              <iframe
                src="http://10.2.152.20:8088/superset/dashboard/p/vkXK9pYZgzp/"
                className="w-full h-full origin-top-left border-0"
                style={{
                  transform: "scale(0.9)",
                  width: "111%",
                  height: "111%",
                  overflow: "hidden",
                  scrollbarWidth: "none", // Firefox
                }}
              />
            </div>
          )}
          {activeModule === "ai_dialer" && (
            <AiDialer
              canEdit={hasAccess("aiEngagementCenter", "edit")}
              canSeeFloor={hasAccess("userManagement")}
            />
          )}
          {activeModule === "Designer" && <Designer />}
          {activeModule === "strategy_simulation" && <StrategySimulation />}
          {activeModule === "strategy_versions" && (
            <StrategyVersions
              canEdit={hasAccess("dunningStrategyDesigner", "edit")}
              onOpenDesigner={() => setActiveModule("Designer")}
            />
          )}
          {activeModule === "collections_dashboard" && (
            <CollectionsDashboard
              onOpenCustomer={(code) => {
                setSelectedCustomer(code);
                setActiveModule("customer_360");
              }}
              onOpenCase={(id) => {
                setOpenCaseId(id);
                setActiveModule("collections_workspace");
              }}
            />
          )}
          {activeModule === "collections_workspace" && (
            <CollectionsWorkspace
              initialCaseId={openCaseId}
              canEdit={hasAccess("collectionsWorkspace", "edit")}
              canSupervise={hasAccess("caseAssign", "edit") || hasAccess("userManagement")}
              onOpenCustomer={(code) => {
                setSelectedCustomer(code);
                setActiveModule("customer_360");
              }}
            />
          )}
          {activeModule === "recovery_workspace" && (
            <RecoveryWorkspace
              canEdit={hasAccess("recoveryWorkspace", "edit")}
              onOpenCustomer={(code) => {
                setSelectedCustomer(code);
                setActiveModule("customer_360");
              }}
            />
          )}
          {PLACEHOLDERS[activeModule] && (
            <PlaceholderPage {...PLACEHOLDERS[activeModule]} />
          )}
          {activeModule === "risks_segmentation" && (
            <RiskGridDashboard
              onOpenCustomer={(code) => {
                setSelectedCustomer(code);
                setActiveModule("customer_360");
              }}
            />
          )}
          {activeModule === "risks_analysis" && (
            <RiskAnalysis />
          )}
          {activeModule === "customer_360" && (
            <CustomerDetail
              setActiveModule={setActiveModule}
              customerId={selectedCustomer}
              setSelectedCustomer={setSelectedCustomer}
            />
          )}
          {activeModule === "customer_profile" && (
            <CustomerProfile360
              customerId={selectedCustomer}
              setActiveModule={setActiveModule}
            />
          )}

          {/* {activeModule === "customer_360" && <CustomerProfile2 />} */}
        </main>
      </div>
    </div>
  );
}
