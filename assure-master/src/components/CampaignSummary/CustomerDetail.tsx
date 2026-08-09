import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Wallet,
  Calendar,
  TrendingUp,
  Phone,
  Mail,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  Clock,
  User,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lightbulb } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import BorrowerFile from "@/components/360Overview/BorrowerFile";
import { SubscriberProfile } from "@/components/360Overview/SubscriberProfile";
import { EnterpriseHierarchy } from "@/components/360Overview/EnterpriseHierarchy";
import { CustomerPicker } from "@/components/CustomerPicker";
import { money, moneyShort } from "@/lib/money";
import {
  getCustomer360,
  getCompany360,
  listConsumers,
  listCompanies,
  getCompany,
  type Customer360 as ApiCustomer360,
} from "@/lib/customers";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import React from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
} from "@/data/portfolioStore";

const CustomerDetail = ({
  customerId,
  setActiveModule,
  setSelectedCustomer,
}) => {
  // const { customerId } = useParams();
  const navigate = useNavigate();
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    () => customerId ?? "",
  );

  console.log("CustomerDetail - customerId:", customerId);

  const [showAgents, setShowAgents] = useState(false);

  const agents = [
    {
      id: 1,
      name: "John Smith",
      code: "AGENT-001",
      dept: "Premium Collections",
    },
    {
      id: 2,
      name: "Mike Johnson",
      code: "AGENT-002",
      dept: "Business Collections",
    },
    {
      id: 3,
      name: "Jennifer Lee",
      code: "AGENT-003",
      dept: "Enterprise Relations",
    },
    { id: 4, name: "Robert Kim", code: "AGT004", dept: "Customer Service" },
    { id: 5, name: "Lisa Davis", code: "AGT005", dept: "Standard Collections" },
    { id: 6, name: "Carlos Rodriguez", code: "AGT006", dept: "Recovery" },
  ];

  const [refresh, setRefresh] = useState(false);
  const [assignedAgent, setAssignedAgent] = useState<string | null>(null);

  const handleAssign = (agent) => {
    console.log("Assigning agent:", agent.name);

    // Held in local state — the canonical dataset stays read-only.
    setAssignedAgent(agent.name);
    setRefresh((prev) => !prev);

    // Close dialog
    setShowAgents(false);
  };

  // Pick one random recommended agent using your existing AI logic
  

  const [showAiDialog, setShowAiDialog] = useState(false);
  const [aiAgent, setAiAgent] = useState(null);
  const [aiScore, setAiScore] = useState(null);

  // agent list you already have
  const agentsList = [
    "John Smith",
    "Mike Johnson",
    "Jennifer Lee",
    "Lisa Davis",
    "Robert Kim",
    "Carlos Rodriguez",
  ];

  // Generate a random recommendation
  const openAiRecommendation = () => {
    const randomAgent =
      agentsList[Math.floor(Math.random() * agentsList.length)];
    const randomScore = (80 + Math.random() * 13).toFixed(1); // 80.0% to 93.0%

    setAiAgent(randomAgent);
    setAiScore(randomScore);
    setShowAiDialog(true);
  };

  const recommendedAgent = React.useMemo(() => {
    const randomAgent =
      agentsList[Math.floor(Math.random() * agentsList.length)];
    const randomScore = (80 + Math.random() * 13).toFixed(1);
    return { name: randomAgent, score: randomScore };
  }, []);

  // Must depend on customerId — with an empty dep array this only ran once, so
  // selecting a different customer elsewhere never updated this screen.
  useEffect(() => {
    if (customerId) setSelectedCustomerId(customerId);
  }, [customerId]);

  // useEffect(() => {
  //   setSelectedCustomerId(customerId); // sync with parent
  // }, [customerId])

  // Header record and detail panels both come from the database — one call.
  const [api, setApi] = useState<ApiCustomer360 | null>(null);
  // The picker lists individuals from the customer table and organisations
  // from the company table — an enterprise is a company, not a person.
  const [apiCustomers, setApiCustomers] = useState<
    { id: string; name: string; segment: string; isCompany?: boolean }[]
  >([]);

  useEffect(() => {
    Promise.all([listConsumers().catch(() => []), listCompanies().catch(() => [])]).then(
      ([consumers, companies]) => {
        setApiCustomers([
          ...companies.map((c) => ({
            id: c.id,
            name: c.name,
            segment: `Company · ${c.subscribers} subscriber${c.subscribers === 1 ? "" : "s"}`,
            isCompany: true,
          })),
          ...consumers.map((r) => ({ id: r.id, name: r.name, segment: r.segment })),
        ]);
        // Whoever opened this screen may have passed a code that no longer
        // exists; land on a real customer rather than an empty page.
        setSelectedCustomerId((current) => {
          const valid = current && consumers.some((c) => c.id === current);
          const next = valid ? current : consumers[0]?.id ?? current;
          setPickerValue((pv) => pv || next);
          return next;
        });
      },
    );
  }, []);

  /** What the dropdown itself shows — a consumer code or a company code. */
  const [pickerValue, setPickerValue] = useState("");
  /** Company to show the branch panel for, set when a company is picked. */
  const [pickedCompany, setPickedCompany] = useState<string | null>(null);

  /** A subscriber drilled into from a branch row, so the picker can show it. */
  const [drilled, setDrilled] = useState<{ id: string; name: string; segment: string } | null>(
    null,
  );
  const isCompanyView = pickerValue.startsWith("COMP-");

  const handlePick = (id: string) => {
    setPickerValue(id);
    setDrilled(null);
    if (id.startsWith("COMP-")) {
      // Show the company itself; its branches are listed below.
      setPickedCompany(id);
      return;
    }
    setPickedCompany(null);
    setSelectedCustomerId(id);
  };

  /** Clicking a subscriber inside a branch switches the view to that line. */
  const drillToSubscriber = (s: { id: string; name: string }, companyName: string) => {
    setDrilled({ id: s.id, name: s.name, segment: `${companyName} · subscriber` });
    setPickerValue(s.id);
    setSelectedCustomerId(s.id);
  };

  useEffect(() => {
    if (!selectedCustomerId && !(isCompanyView && pickedCompany)) return;
    let cancelled = false;
    const load = isCompanyView && pickedCompany
      ? getCompany360(pickedCompany)
      : getCustomer360(selectedCustomerId);
    load.then((d) => !cancelled && setApi(d)).catch(() => !cancelled && setApi(null));
    return () => {
      cancelled = true;
    };
  }, [selectedCustomerId, refresh, isCompanyView, pickedCompany]);

  /** Map the API record onto the shape this screen already renders. */
  const profile = React.useMemo(() => {
    if (!api) return null;
    return {
      id: api.id,
      name: api.name,
      segment: api.segment,
      region: api.region,
      product: api.serviceType ?? api.plan ?? "—",
      status: api.accountStatus ?? api.status,
      riskLevel: api.riskLevel,
      riskScore: Math.round(api.riskScore),
      agent: api.assignedAgent ?? "Unassigned",
      outstanding: api.totalOutstanding ?? api.outstanding ?? 0,
      dpd: api.currentDpd ?? 0,
      agingBucket: api.agingBucket ?? "Current",
      lastPayment: {
        date: api.lastPaymentDate ?? "—",
        amount: api.lastPaymentAmount ?? 0,
      },
      nextAction: api.nextAction ?? "Monitor",
      riskTrend: api.riskTrend,
      paymentHistory: api.paymentHistory.map((p) => ({ ...p, status: p.status })),
      contactability: Math.round(api.contactability),
      disputeRate: api.disputeRate,
      ptpSuccess: api.ptpSuccess,
      communications: api.communications,
      bestContactTime: api.preferredContactTime ?? api.bestContactTime ?? "—",
      bestChannel: api.communicationPreference ?? api.bestChannel ?? "—",
      // Cooperation and contactability are what the model actually has to go on.
      likelihoodToPay: Math.round(
        (api.cooperationScore ?? api.contactability) * (api.currentDpd ? 0.7 : 1),
      ),
      recommendedAction: api.nextAction ?? "Monitor",
      riskDrivers: api.riskDrivers,
      strategy: api.assignedStrategy ?? "Unassigned",
      dunningStage: api.dunningStage,
      caseId: api.caseId ?? null,
      caseStatus: api.caseStatus ?? null,
    };
  }, [api]);

  const customers = drilled ? [...apiCustomers, drilled] : apiCustomers;

  // Keep the selection inside the current Customer Scope. If the header scope
  // narrows past the selected customer (e.g. Enterprise while viewing a
  // consumer), fall back to the first in-scope customer.
  useEffect(() => {
    if (customers.length === 0) return;
    if (!customers.some((c) => c.id === selectedCustomerId)) {
      setSelectedCustomerId(customers[0].id);
    }
  }, [customers, selectedCustomerId]);
  const customer = profile;
  const details = profile;

  // Enterprise accounts carry a BAN / account hierarchy; consumers don't.
  const isEnterprise = !!profile && profile.segment !== "Consumer";
  const enterpriseInfo = profile && {
    account: `${profile.segment}-Primary`,
    subaccount: profile.id,
    site: `${profile.region} Region`,
    ban: `BAN-${profile.id.split("-")[1] ?? ""}-${profile.id.split("-")[2] ?? ""}`,
  };

  /** The customer picker, rendered both in the normal view and the empty one. */
  const backToCompany = drilled && pickedCompany && (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        setDrilled(null);
        setPickerValue(pickedCompany);
      }}
      className="gap-1.5"
    >
      <ArrowLeft className="h-4 w-4" />
      Back to {apiCustomers.find((c) => c.id === pickedCompany)?.name ?? "company"}
    </Button>
  );

  const customerPicker = (
    <div className="flex items-center gap-2">
      {backToCompany}
      <CustomerPicker options={customers} value={pickerValue} onChange={handlePick} />
    </div>
  );

  if (!customer || !details) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Customer 360"
          actions={
            <Button onClick={() => navigate("/")} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          }
        />
        <div className="flex items-center justify-end">{customerPicker}</div>
        <p className="text-muted-foreground">
          {selectedCustomerId
            ? "Loading this customer…"
            : "Select a customer or company to begin."}
        </p>
        {/* A company can still be explored while its subscriber loads. */}
        <EnterpriseHierarchy
          companyCode={pickedCompany}
          activeCustomerId={selectedCustomerId}
          onSelectSubscriber={drillToSubscriber}
        />
      </div>
    );
  }

  const formatCurrency = (value: number) => moneyShort(value);

  // Canonical risk vocabulary is Low | Medium | High | Critical.
  const getRiskColor = (risk: string) => {
    if (risk === "Critical") return "bg-risk-critical";
    if (risk === "High") return "bg-risk-high";
    if (risk === "Medium") return "bg-risk-medium";
    return "bg-risk-low";
  };

  const getStatusColor = (status: string) => {
    if (status === "Legal") return "bg-risk-critical";
    if (status === "Delinquent") return "bg-risk-high";
    if (status === "Past Due") return "bg-risk-medium";
    return "bg-risk-low";
  };

  // Aging badge severity follows the bucket, so it can never read "green" for 90+.
  const getAgingColor = (bucket: string) => {
    if (bucket === "90+") return "bg-risk-critical";
    if (bucket === "61-90") return "bg-risk-high";
    if (bucket === "31-60") return "bg-risk-medium";
    return "bg-risk-low";
  };

  return (
    <div>
      <div className="space-y-6">
        <PageHeader
          title="Customer 360"
          description="Full account view: exposure, risk drivers, engagement history and disputes."
          actions={
            <Button onClick={() => navigate("/")} variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          }
        />

        {/* Customer Search Filter */}
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-4">
            {customerPicker}
          </div>
        </div>

        {/* Customer Header Card */}
        <Card className="p-6 bg-card border-border">
          <div className="flex items-start justify-between">
            <div className="flex gap-4">
              <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
                {customer.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {customer.name}
                </h1>
                <p className="text-muted-foreground mt-1">{customer.id}</p>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {customer.segment} · {customer.product} · {customer.region}
                </p>
                <div className="flex flex-wrap gap-2 mt-3">
                  <Badge className={`${getStatusColor(customer.status)} text-white`}>
                    {customer.status}
                  </Badge>
                  <Badge className={`${getAgingColor(customer.agingBucket)} text-white`}>
                    {customer.agingBucket === "Current"
                      ? "Current"
                      : `${customer.agingBucket} Days`}
                  </Badge>
                  <Badge className={`${getRiskColor(customer.riskLevel)} text-white`}>
                    {customer.riskLevel} Risk · {customer.riskScore}/100
                  </Badge>
                </div>
              </div>
            </div>

            {isEnterprise && enterpriseInfo && (
              <div className="hidden lg:block text-sm px-6 self-center">
                <div className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1.5">
                  <span className="text-muted-foreground">Account:</span>
                  <span className="font-medium text-foreground">{enterpriseInfo.account}</span>
                  <span className="text-muted-foreground">Subaccount:</span>
                  <span className="font-medium text-foreground">{enterpriseInfo.subaccount}</span>
                  <span className="text-muted-foreground">Site:</span>
                  <span className="font-medium text-foreground">{enterpriseInfo.site}</span>
                  <span className="text-muted-foreground">BAN:</span>
                  <span>
                    <span className="inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 font-mono text-xs font-medium text-foreground">
                      {enterpriseInfo.ban}
                    </span>
                  </span>
                </div>
              </div>
            )}

            <div className="text-center">
              <p className="text-sm text-muted-foreground">Account Type</p>
              <p className="text-lg font-semibold text-foreground">{customer.segment}</p>

              {/* If agent is already assigned */}
              {customer.agent != null && (
                <div className="flex flex-col items-center mt-3">
                  <p className="text-sm text-muted-foreground">Assigned To</p>

                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-lg font-semibold text-foreground">
                      {assignedAgent ?? customer.agent}
                    </p>

                    {/* Edit Button */}
                    <button
                      onClick={() => setShowAgents(true)}
                      className="p-1.5 rounded-md border bg-card hover:bg-accent transition"
                    >
                      <Pencil className="h-4 w-4 text-foreground" />
                    </button>
                  </div>
                </div>
              )}

              {/* If no agent is assigned */}
              {customer.agent == null && (
                <div className="mt-3">
                  <p className="text-sm text-muted-foreground">Assigned To</p>
                  <Button
                    variant="outline"
                    className="w-full mt-1"
                    onClick={() => setShowAgents(true)}
                  >
                    <User />
                    Assign Agent
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-card border-border">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Outstanding</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatCurrency(details.outstanding)}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-card border-border">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Days Past Due</p>
                <p className="text-2xl font-bold text-foreground">
                  {details.dpd}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-card border-border">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Payment</p>
                <p className="text-lg font-bold text-foreground">
                  {formatCurrency(details.lastPayment.amount)}
                </p>
                <p className="text-xs text-muted-foreground">
                  {details.lastPayment.date}
                </p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-card border-border">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Next Action</p>
                <p className="text-sm font-semibold text-foreground">
                  {details.nextAction}
                </p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Risk Profile */}
          <Card className="p-6 bg-card border-border">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Risk Trend (6 Months)
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={details.riskTrend}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <RechartsTooltip contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              <h3 className="font-semibold text-foreground">Risk Drivers:</h3>
              {details.riskDrivers.map((driver, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                >
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  {driver}
                </div>
              ))}
            </div>
          </Card>

          <Dialog open={showAgents} onOpenChange={setShowAgents}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Select an Agent</DialogTitle>
              </DialogHeader>

              <div className="space-y-4 mt-3">
                {agents.map((agent) => (
                  <Button
                    key={agent.id}
                    variant="outline"
                    className="w-full flex justify-between items-center py-3"
                    onClick={() => handleAssign(agent)}
                  >
                    {/* LEFT SIDE — Agent Name */}
                    <div className="flex flex-col items-start">
                      <p className="font-medium">{agent.name}</p>
                    </div>

                    {/* RIGHT SIDE — AI RECOMMENDED BADGE (from your logic) */}
                    {agent.name === recommendedAgent.name && (
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 border border-yellow-300 shadow-sm">
                        {/* Star Icon */}
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-3.5 w-3.5 text-yellow-600"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81H7.03a1 1 0 00.95-.69l1.07-3.292z" />
                        </svg>

                        <p className="text-xs font-medium text-yellow-700">
                          AI Recommended ({recommendedAgent.score}%)
                        </p>
                      </div>
                    )}
                  </Button>
                ))}
              </div>
            </DialogContent>
          </Dialog>

          {/* Payment History */}
          <Card className="p-6 bg-card border-border">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Payment History (6 Months)
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={details.paymentHistory}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <RechartsTooltip contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="amount" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-muted-foreground">Paid</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <span className="text-muted-foreground">Partial</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-muted-foreground">Missed</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Behavioral Insights */}
        <Card className="p-6 bg-card border-border">
          <h2 className="text-xl font-bold text-foreground mb-4">
            Behavioral Insights
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Contactability Score
              </p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-bold text-foreground">
                  {details.contactability}%
                </p>
                <p className="text-sm text-muted-foreground mb-1">
                  ({details.communications} attempts)
                </p>
              </div>
              <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${details.contactability}%` }}
                />
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Dispute Rate</p>
              <p className="text-3xl font-bold text-foreground">
                {details.disputeRate}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {details.disputeRate > 10 ? "Above average" : "Below average"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                PTP Success Rate
              </p>
              <p className="text-3xl font-bold text-foreground">
                {details.ptpSuccess}%
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Promise-to-Pay fulfillment
              </p>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">
                  Best Contact Time
                </span>
              </div>
              <p className="text-foreground">{details.bestContactTime}</p>
            </div>
            <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                {details.bestChannel === "Phone Call" && (
                  <Phone className="h-4 w-4 text-primary" />
                )}
                {details.bestChannel === "Email" && (
                  <Mail className="h-4 w-4 text-primary" />
                )}
                {details.bestChannel === "SMS" && (
                  <MessageSquare className="h-4 w-4 text-primary" />
                )}
                <span className="text-sm font-semibold text-foreground">
                  Best Channel
                </span>
              </div>
              <p className="text-foreground">{details.bestChannel}</p>
            </div>
          </div>
        </Card>

        {/* AI Recommendations */}
        <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
          <h2 className="text-xl font-bold text-foreground mb-4">
            🤖 AI-Powered Recommendations
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                Predicted Likelihood to Pay
              </p>
              <div className="flex items-center gap-4">
                <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${details.likelihoodToPay}%` }}
                  />
                </div>
                <span className="text-2xl font-bold text-foreground">
                  {details.likelihoodToPay}%
                </span>
              </div>
            </div>
            <div className="p-4 bg-card border border-border rounded-lg">
              <h3 className="font-semibold text-foreground mb-2">
                Recommended Strategy:
              </h3>
              <p className="text-muted-foreground">
                {details.recommendedAction}
              </p>
            </div>
          </div>
        </Card>

        {/* Subscriber profile — read from the customer record in the database */}
        {!isCompanyView && <SubscriberProfile customerId={selectedCustomerId} />}

        {/* Company → branch → subscriber drill-down for enterprise accounts */}
        <EnterpriseHierarchy
          companyCode={pickedCompany ?? api?.companyCode ?? null}
          activeCustomerId={selectedCustomerId}
          onSelectSubscriber={drillToSubscriber}
        />

        {/* Borrower file — invoices, payments, milestones, comms, disputes */}
        <BorrowerFile
          customerId={selectedCustomerId}
          companyCode={isCompanyView ? pickedCompany : null}
        />

        {/* Action Center */}
      </div>

      <Card className="p-6 bg-card border-border">
        <h2 className="text-xl font-bold text-foreground mb-4">
          Action Center
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Button variant="outline" className="w-full">
            <Mail className="h-4 w-4 mr-2" />
            Send Reminder
          </Button>
          <Button variant="outline" className="w-full">
            <Phone className="h-4 w-4 mr-2" />
            Schedule Call
          </Button>
          <Button variant="outline" className="w-full">
            <Wallet className="h-4 w-4 mr-2" />
            Payment Plan
          </Button>
          <Button
            variant="outline"
            className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Add Note
          </Button>
        </div>
      </Card>
      <Dialog open={showAiDialog} onOpenChange={setShowAiDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>AI Recommended Agent</DialogTitle>
          </DialogHeader>

          <div className="mt-4 space-y-3 text-center">
            <p className="text-lg font-semibold text-foreground">{aiAgent}</p>
            <p className="text-sm text-muted-foreground">
              Confidence Score:{" "}
              <span className="font-bold text-success">{aiScore}%</span>
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerDetail;
