import { useState } from "react";
import { CustomerRow } from "./components/CustomerRow";
import { CustomerProfileModal } from "./components/CustomerProfileModal";
import { FilterBar, FilterOptions } from "./components/FilterBar";
import { AgentGroupView } from "./components/AgentGroupView";
import { CaseGridView } from "./components/CaseGridView";
import { CaseTableView } from "./components/CaseTableView";
import { PTPModal } from "./components/PTPModal";
import { CaseModal } from "./components/CaseModal";
import { DisputeModal } from "./components/DisputeModal";
import { LegalModal } from "./components/LegalModal";
import {
  mockCustomers as _mockCustomers,
  mockPTPs as _mockPTPs,
  mockCases as _mockCases,
  mockDisputes as _mockDisputes,
  mockLegalEscalations as _mockLegalEscalations,
} from "./lib/mockData";
import {
  mockConsumerCases as _mockConsumerCases,
  mockEnterpriseCases as _mockEnterpriseCases,
  getEnterpriseGroups as _getEnterpriseGroups,
} from "./lib/mockCaseData";
import { useMemo } from "react";
import { useCustomerType } from "@/contexts/CustomerTypeContext";
import { ConsumerCaseCard } from "./components/ConsumerCaseCard";
import { EnterpriseCaseCard } from "./components/EnterpriseCaseCard";
import { EnterpriseGroupCard } from "./components/EnterpriseGroupCard";
import { ConsumerCaseDrawer } from "./components/ConsumerCaseDrawer";
import { EnterpriseCaseDrawer } from "./components/EnterpriseCaseDrawer";
import { EnterpriseGroupModal } from "./components/EnterpriseGroupModal";
import { Customer360 } from "./types/customer";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const CaseDashboard = () => {
  // Header Customer Scope (All / Normal / Enterprise) narrows the whole screen.
  // normal = Consumer accounts, enterprise = business accounts (everything else).
  const { customerType } = useCustomerType();
  const scope = useMemo(() => {
    const allowConsumer = customerType === "all" || customerType === "normal";
    const allowEnterprise = customerType === "all" || customerType === "enterprise";

    const mockCustomers = _mockCustomers.filter((c) =>
      c.customer_type === "Consumer" ? allowConsumer : allowEnterprise,
    );
    const allowedIds = new Set(mockCustomers.map((c) => c.customer_id));
    const scopeRecord = <T,>(rec: Record<string, T[]>): Record<string, T[]> =>
      Object.fromEntries(Object.entries(rec).filter(([id]) => allowedIds.has(id)));

    return {
      mockCustomers,
      mockPTPs: scopeRecord(_mockPTPs),
      mockCases: scopeRecord(_mockCases),
      mockDisputes: scopeRecord(_mockDisputes),
      mockLegalEscalations: scopeRecord(_mockLegalEscalations),
      mockConsumerCases: allowConsumer ? _mockConsumerCases : [],
      mockEnterpriseCases: allowEnterprise ? _mockEnterpriseCases : [],
      // Enterprise groups only make sense when enterprise cases are in scope.
      getEnterpriseGroups: () => (allowEnterprise ? _getEnterpriseGroups() : []),
    };
  }, [customerType]);

  const {
    mockCustomers,
    mockPTPs,
    mockCases,
    mockDisputes,
    mockLegalEscalations,
    mockConsumerCases,
    mockEnterpriseCases,
    getEnterpriseGroups,
  } = scope;
  const [selectedCustomer, setSelectedCustomer] = useState<Customer360 | null>(null);
  const [selectedPTP, setSelectedPTP] = useState<any>(null);
  const [selectedCase, setSelectedCase] = useState<any>(null);
  const [selectedDispute, setSelectedDispute] = useState<any>(null);
  const [selectedLegal, setSelectedLegal] = useState<any>(null);

  // Case Management specific state
  const [selectedConsumerCase, setSelectedConsumerCase] = useState<any>(null);
  const [selectedEnterpriseCase, setSelectedEnterpriseCase] = useState<any>(null);
  const [selectedEnterpriseGroup, setSelectedEnterpriseGroup] = useState<any>(null);
  const [consumerDrawerOpen, setConsumerDrawerOpen] = useState(false);
  const [enterpriseDrawerOpen, setEnterpriseDrawerOpen] = useState(false);
  const [enterpriseGroupModalOpen, setEnterpriseGroupModalOpen] = useState(false);

  const [filters, setFilters] = useState<FilterOptions>({
    viewMode: "customer",
    casesViewMode: "grid",
    groupEnterpriseByCompany: false,
    selectedAgent: "",
    searchQuery: "",
    customerType: "",
    company: "",
    country: "",
    agingBucket: "",
    riskLevel: "",
    creditScoreRange: "",
    dpdRange: "",
    assignedAgent: "",
    ptpStatus: "",
    disputeStatus: "",
    caseStatus: "",
    legalStatus: "",
    paymentStatus: "",
    dateFrom: "",
    dateTo: "",
  });

  const filteredCustomers = mockCustomers.filter((customer) => {
    // Search query
    if (filters.searchQuery) {
      const searchLower = filters.searchQuery.toLowerCase();
      const matchesSearch =
        customer.full_name?.toLowerCase().includes(searchLower) ||
        customer.company_name?.toLowerCase().includes(searchLower) ||
        customer.country.toLowerCase().includes(searchLower) ||
        customer.customer_id.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Customer Type
    if (filters.customerType && filters.customerType !== "all") {
      if (customer.customer_type !== filters.customerType) return false;
    }

    // Company (for Enterprise only)
    if (filters.company && filters.company !== "all") {
      if (customer.company_name !== filters.company) return false;
    }

    // Country
    if (filters.country && filters.country !== "all") {
      if (customer.country !== filters.country) return false;
    }

    // Aging Bucket
    if (filters.agingBucket && filters.agingBucket !== "all") {
      if (customer.aging_bucket !== filters.agingBucket) return false;
    }

    // Risk Level
    if (filters.riskLevel && filters.riskLevel !== "all") {
      const riskScore = customer.risk_score;
      if (filters.riskLevel === "Low" && riskScore >= 60) return false;
      if (filters.riskLevel === "Medium" && (riskScore < 60 || riskScore >= 80)) return false;
      if (filters.riskLevel === "High" && riskScore < 80) return false;
    }

    // Credit Score Range
    if (filters.creditScoreRange && filters.creditScoreRange !== "all") {
      const creditScore = customer.credit_score;
      if (filters.creditScoreRange === "Excellent" && creditScore < 750) return false;
      if (filters.creditScoreRange === "Good" && (creditScore < 650 || creditScore >= 750)) return false;
      if (filters.creditScoreRange === "Fair" && (creditScore < 550 || creditScore >= 650)) return false;
      if (filters.creditScoreRange === "Poor" && creditScore >= 550) return false;
    }

    // Days Past Due Range
    if (filters.dpdRange && filters.dpdRange !== "all") {
      const dpd = customer.days_past_due;
      if (filters.dpdRange === "0-30" && (dpd < 0 || dpd > 30)) return false;
      if (filters.dpdRange === "31-60" && (dpd < 31 || dpd > 60)) return false;
      if (filters.dpdRange === "61-90" && (dpd < 61 || dpd > 90)) return false;
      if (filters.dpdRange === "90+" && dpd <= 90) return false;
    }

    // Assigned Agent
    if (filters.assignedAgent && filters.assignedAgent !== "all") {
      if (filters.assignedAgent === "unassigned" && customer.assigned_agent) return false;
      if (filters.assignedAgent !== "unassigned" && customer.assigned_agent !== filters.assignedAgent) return false;
    }

    return true;
  });

  // Group enterprise customers by company if toggle is enabled
  const displayCustomers = filters.groupEnterpriseByCompany
    ? filteredCustomers.reduce((acc, customer) => {
        if (customer.customer_type === "Enterprise" && customer.company_name) {
          // Check if company group already exists
          const existingCompany = acc.find(
            (c) => c.customer_type === "Enterprise" && c.company_name === customer.company_name,
          );
          if (!existingCompany) {
            // Aggregate all enterprise customers with this company name
            const companyCustomers = filteredCustomers.filter(
              (c) => c.customer_type === "Enterprise" && c.company_name === customer.company_name,
            );

            // Create aggregated customer object
            const aggregated: Customer360 = {
              ...customer,
              total_outstanding: companyCustomers.reduce((sum, c) => sum + c.total_outstanding, 0),
              days_past_due: Math.max(...companyCustomers.map((c) => c.days_past_due)),
              risk_score: Math.round(
                companyCustomers.reduce((sum, c) => sum + c.risk_score, 0) / companyCustomers.length,
              ),
              credit_score: Math.round(
                companyCustomers.reduce((sum, c) => sum + c.credit_score, 0) / companyCustomers.length,
              ),
              aging_bucket: companyCustomers.sort((a, b) => {
                const order = { "0-30": 0, "31-60": 1, "61-90": 2, "90+": 3 };
                return order[b.aging_bucket] - order[a.aging_bucket];
              })[0].aging_bucket,
            };
            acc.push(aggregated);
          }
        } else {
          acc.push(customer);
        }
        return acc;
      }, [] as Customer360[])
    : filteredCustomers;

  // Get all items for agent and case views
  const allPTPs = Object.values(mockPTPs).flat();
  const allCases = Object.values(mockCases).flat();
  const allDisputes = Object.values(mockDisputes).flat();
  const allLegal = Object.values(mockLegalEscalations).flat();

  // Filter consumer cases
  const filteredConsumerCases = mockConsumerCases.filter((case_) => {
    // Search query
    if (filters.searchQuery) {
      const searchLower = filters.searchQuery.toLowerCase();
      const matchesSearch =
        case_.customerName?.toLowerCase().includes(searchLower) ||
        case_.msisdn?.toLowerCase().includes(searchLower) ||
        case_.invoiceNo?.toLowerCase().includes(searchLower) ||
        case_.caseCategory?.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Case Status
    if (filters.caseStatus && filters.caseStatus !== "all") {
      if (case_.status !== filters.caseStatus) return false;
    }

    return true;
  });

  // Filter enterprise cases
  const filteredEnterpriseCases = mockEnterpriseCases.filter((case_) => {
    // Search query
    if (filters.searchQuery) {
      const searchLower = filters.searchQuery.toLowerCase();
      const matchesSearch =
        case_.employeeName?.toLowerCase().includes(searchLower) ||
        case_.companyName?.toLowerCase().includes(searchLower) ||
        case_.msisdn?.toLowerCase().includes(searchLower) ||
        case_.invoiceNo?.toLowerCase().includes(searchLower) ||
        case_.caseCategory?.toLowerCase().includes(searchLower) ||
        case_.ban?.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Case Status - map from caseType to status-like filtering
    if (filters.caseStatus && filters.caseStatus !== "all") {
      if (case_.caseType !== filters.caseStatus) return false;
    }

    return true;
  });

  // Group items by agent
  const getAgentGroups = () => {
    const agents = new Set<string>();
    allPTPs.forEach((p) => {
      const customer = mockCustomers.find((c) => c.customer_id === p.customer_id);
      if (customer?.assigned_agent) agents.add(customer.assigned_agent);
    });
    allCases.forEach((c) => c.assigned_agent && agents.add(c.assigned_agent));

    return Array.from(agents)
      .map((agent) => ({
        agent,
        ptps: allPTPs.filter(
          (p) => mockCustomers.find((c) => c.customer_id === p.customer_id)?.assigned_agent === agent,
        ),
        cases: allCases.filter((c) => c.assigned_agent === agent),
        disputes: allDisputes.filter(
          (d) => mockCustomers.find((c) => c.customer_id === d.customer_id)?.assigned_agent === agent,
        ),
        legal: allLegal.filter(
          (l) => mockCustomers.find((c) => c.customer_id === l.customer_id)?.assigned_agent === agent,
        ),
      }))
      .filter((g) => !filters.selectedAgent || filters.selectedAgent === "all" || g.agent === filters.selectedAgent);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Case Management"
        description="Manage telecom debt collection cases, disputes, and workflows"
        actions={
          <span className="text-sm text-muted-foreground tabular-nums">
            {filters.viewMode === "customer" && `${displayCustomers.length} customers`}
            {filters.viewMode === "agent" && `${getAgentGroups().length} agents`}
            {filters.viewMode === "cases" &&
              `${allPTPs.length + allCases.length + allDisputes.length + allLegal.length} total items`}
          </span>
        }
      />

      <FilterBar onFilterChange={setFilters} />

      {/* Main Content */}
      <main>
        <div className="space-y-2">
          {filters.viewMode === "customer" && (
            <>
              {/* Column Headers */}
              <div className="grid grid-cols-[auto,2fr,1fr,1fr,1fr,1.5fr,1fr,1fr,1fr,1fr,1.5fr,auto] gap-4 px-4 pb-3 text-xs font-medium text-muted-foreground">
                <div className="w-4"></div>
                <div>CUSTOMER</div>
                <div>TYPE</div>
                <div>COUNTRY</div>
                <div>OUTSTANDING</div>
                <div>AGING</div>
                <div>DPD</div>
                <div>RISK</div>
                <div>CREDIT</div>
                <div>AGENT</div>
                <div></div>
              </div>

              {/* Customer Rows */}
              {displayCustomers.map((customer) => (
                <CustomerRow
                  key={customer.customer_id}
                  customer={customer}
                  onViewProfile={() => setSelectedCustomer(customer)}
                />
              ))}

              {displayCustomers.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">No customers found matching your filters</p>
                </div>
              )}
            </>
          )}

          {filters.viewMode === "agent" &&
            getAgentGroups().map((group) => (
              <AgentGroupView
                key={group.agent}
                agentName={group.agent}
                ptps={group.ptps}
                cases={group.cases}
                disputes={group.disputes}
                legalEscalations={group.legal}
                onPTPClick={(ptp) => setSelectedPTP(ptp)}
                onCaseClick={(caseData) => setSelectedCase(caseData)}
                onDisputeClick={(dispute) => setSelectedDispute(dispute)}
                onLegalClick={(legal) => setSelectedLegal(legal)}
              />
            ))}

          {filters.viewMode === "cases" && (
            <>
              {filters.casesViewMode === "grid" ? (
                <div className="space-y-6">
                  {/* Consumer Cases */}
                  {!filters.groupEnterpriseByCompany && (
                    <>
                      <div>
                        <h2 className="text-lg font-semibold text-muted-foreground mb-4">Consumer Cases</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {filteredConsumerCases.map((case_) => (
                            <ConsumerCaseCard
                              key={case_.id}
                              customerName={case_.customerName}
                              msisdn={case_.msisdn}
                              invoiceNo={case_.invoiceNo}
                              caseCategory={case_.caseCategory}
                              amountDisputed={case_.amountDisputed}
                              riskScore={case_.riskScore}
                              daysPastDue={case_.daysPastDue}
                              status={case_.status}
                              agentName={case_.agentName}
                              onViewDetails={() => {
                                setSelectedConsumerCase(case_);
                                setConsumerDrawerOpen(true);
                              }}
                            />
                          ))}
                        </div>
                      </div>

                      <div>
                        <h2 className="text-lg font-semibold text-muted-foreground mb-4">
                          Enterprise Cases (Individual)
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {filteredEnterpriseCases.map((case_) => (
                            <EnterpriseCaseCard
                              key={case_.id}
                              employeeName={case_.employeeName}
                              companyName={case_.companyName}
                              ban={case_.ban}
                              msisdn={case_.msisdn}
                              invoiceNo={case_.invoiceNo}
                              caseCategory={case_.caseCategory}
                              amountDisputed={case_.amountDisputed}
                              caseType={case_.caseType}
                              agentName={case_.agentName}
                              onViewDetails={() => {
                                setSelectedEnterpriseCase(case_);
                                setEnterpriseDrawerOpen(true);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Enterprise Grouped View */}
                  {filters.groupEnterpriseByCompany && (
                    <>
                      <div>
                        <h2 className="text-lg font-semibold text-muted-foreground mb-4">Consumer Cases</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {filteredConsumerCases.map((case_) => (
                            <ConsumerCaseCard
                              key={case_.id}
                              customerName={case_.customerName}
                              msisdn={case_.msisdn}
                              invoiceNo={case_.invoiceNo}
                              caseCategory={case_.caseCategory}
                              amountDisputed={case_.amountDisputed}
                              riskScore={case_.riskScore}
                              daysPastDue={case_.daysPastDue}
                              status={case_.status}
                              agentName={case_.agentName}
                              onViewDetails={() => {
                                setSelectedConsumerCase(case_);
                                setConsumerDrawerOpen(true);
                              }}
                            />
                          ))}
                        </div>
                      </div>

                      <div>
                        <h2 className="text-lg font-semibold text-muted-foreground mb-4">
                          Enterprise Groups (By Company)
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {getEnterpriseGroups().map((group: any) => (
                            <EnterpriseGroupCard
                              key={group.ban}
                              enterpriseGroup={group.enterpriseGroup}
                              enterpriseAccount={group.enterpriseAccount}
                              enterpriseSubaccount={group.enterpriseSubaccount}
                              site={group.site}
                              ban={group.ban}
                              totalUsers={group.totalUsers}
                              totalOutstanding={group.totalOutstanding}
                              totalPaid={group.totalPaid}
                              totalDisputed={group.totalDisputed}
                              avgRiskScore={group.avgRiskScore}
                              avgDaysPastDue={group.avgDaysPastDue}
                              onViewDetails={() => {
                                setSelectedEnterpriseGroup(group);
                                setEnterpriseGroupModalOpen(true);
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Table View */}
                  <div>
                    <h2 className="text-lg font-semibold text-muted-foreground mb-4">All Cases</h2>
                    <div className="bg-card rounded-lg border border-border overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-muted/50">
                          <tr className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            <th className="px-4 py-3 w-12">
                              <input type="checkbox" className="rounded border-border" />
                            </th>
                            <th className="px-4 py-3">Customer</th>
                            <th className="px-4 py-3">Type</th>
                            <th className="px-4 py-3">Invoice</th>
                            <th className="px-4 py-3">Category</th>
                            <th className="px-4 py-3 text-right">Amount</th>
                            <th className="px-4 py-3 text-center">Risk</th>
                            <th className="px-4 py-3 text-center">DPD</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Agent</th>
                            <th className="px-4 py-3"></th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredConsumerCases.map((case_) => (
                            <tr
                              key={case_.id}
                              className="border-t border-border hover:bg-muted/30 cursor-pointer transition-colors"
                              onClick={() => {
                                setSelectedConsumerCase(case_);
                                setConsumerDrawerOpen(true);
                              }}
                            >
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  className="rounded border-border"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col">
                                  <span className="font-medium text-foreground">{case_.customerName}</span>
                                  <span className="text-xs text-muted-foreground">{case_.msisdn}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant="outline">Consumer</Badge>
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">{case_.invoiceNo}</td>
                              <td className="px-4 py-3 text-sm">{case_.caseCategory}</td>
                              <td className="px-4 py-3 text-right font-semibold">
                                ${case_.amountDisputed.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Badge
                                  className={`${case_.riskScore >= 80 ? "bg-risk-high" : case_.riskScore >= 60 ? "bg-risk-medium" : "bg-risk-low"} text-white`}
                                >
                                  {case_.riskScore}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-center text-sm">{case_.daysPastDue}d</td>
                              <td className="px-4 py-3">
                                <Badge
                                  variant={
                                    case_.status === "Open"
                                      ? "destructive"
                                      : case_.status === "Closed"
                                        ? "secondary"
                                        : "default"
                                  }
                                >
                                  {case_.status}
                                </Badge>
                              </td>
                              <td className="px-4 py-3">
                                {case_.agentName && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Avatar className="h-8 w-8 cursor-pointer">
                                          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                                            {case_.agentName
                                              .split(" ")
                                              .map((n: string) => n[0])
                                              .join("")}
                                          </AvatarFallback>
                                        </Avatar>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{case_.agentName}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Button variant="ghost" size="sm">
                                  View
                                </Button>
                              </td>
                            </tr>
                          ))}
                          {filteredEnterpriseCases.map((case_) => (
                            <tr
                              key={case_.id}
                              className="border-t border-border hover:bg-muted/30 cursor-pointer transition-colors"
                              onClick={() => {
                                setSelectedEnterpriseCase(case_);
                                setEnterpriseDrawerOpen(true);
                              }}
                            >
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  className="rounded border-border"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col">
                                  <span className="font-medium text-foreground">{case_.employeeName}</span>
                                  <span className="text-xs text-muted-foreground">{case_.companyName}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant="outline">Enterprise</Badge>
                              </td>
                              <td className="px-4 py-3 text-sm text-muted-foreground">{case_.invoiceNo}</td>
                              <td className="px-4 py-3 text-sm">{case_.caseCategory}</td>
                              <td className="px-4 py-3 text-right font-semibold">
                                ${case_.amountDisputed.toLocaleString()}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Badge variant="outline">N/A</Badge>
                              </td>
                              <td className="px-4 py-3 text-center text-sm">-</td>
                              <td className="px-4 py-3">
                                <Badge variant="outline">{case_.caseType}</Badge>
                              </td>
                              <td className="px-4 py-3">
                                {case_.agentName && (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Avatar className="h-8 w-8 cursor-pointer">
                                          <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                                            {case_.agentName
                                              .split(" ")
                                              .map((n: string) => n[0])
                                              .join("")}
                                          </AvatarFallback>
                                        </Avatar>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{case_.agentName}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <Button variant="ghost" size="sm">
                                  View
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {filteredConsumerCases.length === 0 && filteredEnterpriseCases.length === 0 && (
                        <div className="text-center py-12">
                          <p className="text-muted-foreground">No cases found</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* Modals */}
      <CustomerProfileModal
        customer={selectedCustomer}
        open={!!selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
        isGrouped={filters.groupEnterpriseByCompany && selectedCustomer?.customer_type === "Enterprise"}
        groupedCustomers={
          filters.groupEnterpriseByCompany &&
          selectedCustomer?.customer_type === "Enterprise" &&
          selectedCustomer?.company_name
            ? filteredCustomers.filter(
                (c) => c.customer_type === "Enterprise" && c.company_name === selectedCustomer.company_name,
              )
            : []
        }
      />
      <PTPModal
        open={!!selectedPTP}
        onClose={() => setSelectedPTP(null)}
        ptp={selectedPTP}
        customerName={
          selectedPTP
            ? mockCustomers.find((c) => c.customer_id === selectedPTP.customer_id)?.full_name || selectedPTP.customer_id
            : ""
        }
      />
      <CaseModal
        open={!!selectedCase}
        onClose={() => setSelectedCase(null)}
        caseData={selectedCase}
        customerName={
          selectedCase
            ? mockCustomers.find((c) => c.customer_id === selectedCase.customer_id)?.full_name ||
              selectedCase.customer_id
            : ""
        }
      />
      <DisputeModal
        open={!!selectedDispute}
        onClose={() => setSelectedDispute(null)}
        dispute={selectedDispute}
        customerName={
          selectedDispute
            ? mockCustomers.find((c) => c.customer_id === selectedDispute.customer_id)?.full_name ||
              selectedDispute.customer_id
            : ""
        }
      />
      <LegalModal
        open={!!selectedLegal}
        onClose={() => setSelectedLegal(null)}
        legal={selectedLegal}
        customerName={
          selectedLegal
            ? mockCustomers.find((c) => c.customer_id === selectedLegal.customer_id)?.full_name ||
              selectedLegal.customer_id
            : ""
        }
      />

      {/* Case Management Modals */}
      {selectedConsumerCase && (
        <ConsumerCaseDrawer
          open={consumerDrawerOpen}
          onClose={() => setConsumerDrawerOpen(false)}
          caseData={selectedConsumerCase}
        />
      )}

      {selectedEnterpriseCase && (
        <EnterpriseCaseDrawer
          open={enterpriseDrawerOpen}
          onClose={() => setEnterpriseDrawerOpen(false)}
          caseData={selectedEnterpriseCase}
        />
      )}

      {selectedEnterpriseGroup && (
        <EnterpriseGroupModal
          open={enterpriseGroupModalOpen}
          onClose={() => setEnterpriseGroupModalOpen(false)}
          groupData={selectedEnterpriseGroup}
          onViewCustomer={(customer) => {
            // Find matching enterprise case and open drawer
            const matchingCase = mockEnterpriseCases.find(
              (c) => c.employeeName === customer.customerName && c.msisdn === customer.msisdn,
            );
            if (matchingCase) {
              setSelectedEnterpriseCase(matchingCase);
              setEnterpriseDrawerOpen(true);
            }
          }}
        />
      )}
    </div>
  );
};

export default CaseDashboard;
