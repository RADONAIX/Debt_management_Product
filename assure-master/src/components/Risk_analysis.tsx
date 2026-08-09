import { useMemo, useState, useEffect } from "react";
import { RiskScoringRules } from "@/components/RiskScoringRules";
import { MlPredictionBrowser } from "@/components/risk/MlPredictionBrowser";
import { listRiskCustomers, type RiskScoredCustomer } from "@/lib/risk";
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
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  AGENTS,
  getAgentBySegment,
} from "@/components/shared/agentData";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Shield,
  Activity,
  BarChart3,
  Users,
  DollarSign,
  Calendar,
  Zap,
  Edit,
  Trash2,
  Plus,
  Save,
  Brain,
  Target,
  Phone,
  Mail,
  FileText,
  Scale,
  CreditCard,
  Clock,
  Smartphone,
  Settings,
  Globe,
  UserCircle2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  ACCOUNTS,
  formatCount,
  formatMoney,
} from "@/data/portfolioStore";
import { useScopedAccounts } from "@/hooks/useScopedAccounts";

interface RiskCustomer {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  overdueDays: number;
  overdueAmount: number;
  totalOutstanding: number;
  currentBalance: number;
  tenure: number;
  paymentPattern: "good" | "irregular" | "poor";
  riskBand: "low" | "medium" | "high";
  riskScore: number;
  paymentRiskScore: number;
  probabilityOfDefault: number;
  serviceLimit: number;
  utilizationRatio: number;
  debtToIncomeRatio: number;
  lastScoreUpdate: string;
  segment: string;
  financialHealth: "excellent" | "good" | "fair" | "poor";
  behaviorScore: number;
  incomeStability: number;
  serviceHistory: number;
}

interface RiskRule {
  id: string;
  name: string;
  condition: string;
  riskBand: string;
  weight: number;
  active: boolean;
  eligibleCustomers: number;
}

interface AIRecommendation {
  id: string;
  title: string;
  priority: "high" | "medium" | "low";
  successRate: number;
  description: string;
  timeline: string;
  expectedOutcome: string;
  actionType: "payment" | "engagement" | "legal" | "support" | "predictive";
}

interface PredictivePaymentScore {
  likelihood: number;
  confidenceLevel: "high" | "medium" | "low";
  nextPaymentDate: string;
  predictedAmount: number;
  riskFactors: string[];
  positiveIndicators: string[];
}

// Interface definitions for advanced rule builder
interface RuleCondition {
  id: string;
  parameter: string;
  operator: string;
  value: string;
  connector?: "AND" | "OR";
}

interface RuleParameter {
  id: string;
  name: string;
  type: "number" | "text" | "boolean";
  description: string;
}

interface RiskSegmentationProps {
  initialCustomer?: any;
  onNavigateToCase?: (customer: any, caseData?: any) => void;
}

export default function RiskAnalysis({
  initialCustomer,
  onNavigateToCase,
}: RiskSegmentationProps = {}) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  // Scored across the whole book — this screen has no filter bar of its own.
  const scopedAccounts = useScopedAccounts();
  // Scored customers come from the database — the same rules the Scoring Rules
  // tab configures, not a client-side derivation.
  const [scored, setScored] = useState<RiskScoredCustomer[]>([]);
  useEffect(() => {
    listRiskCustomers()
      .then(setScored)
      .catch(() => setScored([]));
  }, []);

  const riskViews = useMemo(
    () =>
      scored.map((c) => ({
        id: c.id,
        name: c.name,
        overdueDays: c.overdueDays,
        overdueAmount: c.outstanding,
        totalOutstanding: c.outstanding,
        riskScore: Math.round(c.riskScore),
        riskBand: c.riskBand,
        // The screen renders this as `value * 100`, so hand it a fraction.
        probabilityOfDefault: c.probabilityOfDefault / 100,
        paymentPattern: c.behaviour ?? "—",
        segment: c.segment,
        contactability: Math.round(c.contactability),
        lastContactDays: c.lastContact
          ? Math.max(
              0,
              Math.round((Date.now() - new Date(c.lastContact).getTime()) / 86_400_000),
            )
          : 0,
        tenureMonths: c.tenureMonths,
        responsibilityScore: c.responsibilityScore,
        cooperationScore: c.cooperationScore,
        employmentStabilityScore: c.employmentStabilityScore,
      })),
    [scored],
  );
  const riskSummary = useMemo(() => {
    const count = (band: string) => scored.filter((c) => c.riskBand === band).length;
    return {
      total: scored.length,
      low: count("low"),
      medium: count("medium"),
      high: count("high"),
      critical: count("critical"),
    };
  }, [scored]);
  const [selectedCustomer, setSelectedCustomer] = useState<RiskCustomer | null>(
    null
  );

  // Advanced Rule Builder State
  const [selectedParameter, setSelectedParameter] = useState("");
  const [selectedOperator, setSelectedOperator] = useState("");
  const [ruleValue, setRuleValue] = useState("");
  const [ruleName, setRuleName] = useState("");
  const [selectedRiskBand, setSelectedRiskBand] = useState("medium");
  const [ruleWeight, setRuleWeight] = useState("30");
  const [ruleConditions, setRuleConditions] = useState<RuleCondition[]>([]);
  const [customRules, setCustomRules] = useState<RiskRule[]>([]);
  const [ruleJustSaved, setRuleJustSaved] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<AIRecommendation[]>(
    []
  );
  const [predictiveScore, setPredictiveScore] =
    useState<PredictivePaymentScore | null>(null);

  // Case creation dialog state
  const [createCaseDialog, setCreateCaseDialog] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [caseNotes, setCaseNotes] = useState("");
  const [caseType, setCaseType] = useState<"collection" | "dispute">(
    "collection"
  );

  // Auto-select customer when navigated from CustomerProfile
  useEffect(() => {
    if (initialCustomer) {
      const matchingCustomer = riskCustomers.find(
        (c) => c.id === initialCustomer.id || c.name === initialCustomer.name
      );
      if (matchingCustomer) {
        setSelectedCustomer(matchingCustomer);
        const recs = generateRecommendations(matchingCustomer);
        setRecommendations(recs);
        const predScore = calculatePredictivePaymentScore(matchingCustomer);
        setPredictiveScore(predScore);
      }
    }
  }, [initialCustomer]);

  // Available parameters for risk rule creation
  const riskRuleParameters: RuleParameter[] = [
    {
      id: "credit_score",
      name: "Credit Score",
      type: "number",
      description: "Current credit score",
    },
    {
      id: "total_outstanding",
      name: "Total Outstanding",
      type: "number",
      description: "Total amount owed",
    },
    {
      id: "overdue_amount",
      name: "Overdue Amount",
      type: "number",
      description: "Amount currently overdue",
    },
    {
      id: "days_past_due",
      name: "Days Past Due",
      type: "number",
      description: "Number of days payment is overdue",
    },
    {
      id: "account_age",
      name: "Account Age (months)",
      type: "number",
      description: "Age of the account in months",
    },
    {
      id: "payment_history",
      name: "Payment Pattern Score",
      type: "number",
      description: "Historical payment behavior score (0-100)",
    },
    {
      id: "debt_to_income",
      name: "Debt-to-Income Ratio",
      type: "number",
      description: "Current debt-to-income ratio",
    },
    {
      id: "utilization_rate",
      name: "Credit Utilization %",
      type: "number",
      description: "Credit utilization percentage",
    },
    {
      id: "monthly_income",
      name: "Monthly Income",
      type: "number",
      description: "Verified monthly income",
    },
    {
      id: "employment_tenure",
      name: "Employment Tenure",
      type: "number",
      description: "Months in current employment",
    },
    {
      id: "transaction_frequency",
      name: "Transaction Frequency",
      type: "number",
      description: "Monthly transaction count",
    },
    {
      id: "industry_risk",
      name: "Industry Risk Score",
      type: "number",
      description: "Industry-specific risk score (1-10)",
    },
    {
      id: "geographic_risk",
      name: "Geographic Risk",
      type: "number",
      description: "Location-based risk assessment",
    },
    {
      id: "behavioral_score",
      name: "Behavioral Score",
      type: "number",
      description: "Customer behavior analysis score",
    },
  ];

  const operators = [
    { value: "gt", label: "Greater Than", symbol: ">" },
    { value: "gte", label: "Greater Than or Equal", symbol: "≥" },
    { value: "lt", label: "Less Than", symbol: "<" },
    { value: "lte", label: "Less Than or Equal", symbol: "≤" },
    { value: "eq", label: "Equal To", symbol: "=" },
    { value: "between", label: "Between", symbol: "⟷" },
    { value: "in", label: "In List", symbol: "∈" },
  ];

  const [riskRules, setRules] = useState<RiskRule[]>([
    {
      id: "RULE001",
      name: "High Risk - Poor Credit & High Outstanding",
      condition: "Credit Score < 650 AND Total Outstanding > $25000",
      riskBand: "High",
      weight: 40,
      active: true,
      eligibleCustomers: 28,
    },
    {
      id: "RULE002",
      name: "Medium Risk - Moderate Credit Issues",
      condition: "Credit Score ≥ 650 AND < 750 AND Days Past Due > 30",
      riskBand: "Medium",
      weight: 30,
      active: true,
      eligibleCustomers: 45,
    },
    {
      id: "RULE003",
      name: "Low Risk - Good Credit & Payment History",
      condition: "Credit Score ≥ 750 AND Payment Pattern Score > 80",
      riskBand: "Low",
      weight: 25,
      active: true,
      eligibleCustomers: 67,
    },
  ]);

  // Advanced Rule Builder Functions
  const addCondition = () => {
    if (selectedParameter && selectedOperator && ruleValue) {
      const newCondition: RuleCondition = {
        id: Date.now().toString(),
        parameter: selectedParameter,
        operator: selectedOperator,
        value: ruleValue,
        connector: ruleConditions.length > 0 ? "AND" : undefined,
      };
      setRuleConditions([...ruleConditions, newCondition]);
      setSelectedParameter("");
      setSelectedOperator("");
      setRuleValue("");
    }
  };

  const removeCondition = (id: string) => {
    setRuleConditions(
      ruleConditions.filter((condition) => condition.id !== id)
    );
  };

  const updateConnector = (id: string, connector: "AND" | "OR") => {
    setRuleConditions(
      ruleConditions.map((condition) =>
        condition.id === id ? { ...condition, connector } : condition
      )
    );
  };

  const saveRule = () => {
    if (ruleName && ruleConditions.length > 0) {
      const conditionText = ruleConditions
        .map((condition, index) => {
          const paramName = riskRuleParameters.find(
            (p) => p.id === condition.parameter
          )?.name;
          const opSymbol = operators.find(
            (o) => o.value === condition.operator
          )?.symbol;
          const connector = index > 0 ? ` ${condition.connector} ` : "";
          return `${connector}${paramName} ${opSymbol} ${condition.value}`;
        })
        .join("");

      const newRule: RiskRule = {
        id: `RULE${String(riskRules.length + customRules.length + 1).padStart(
          3,
          "0"
        )}`,
        name: ruleName,
        condition: conditionText,
        riskBand: selectedRiskBand,
        weight: parseInt(ruleWeight),
        active: true,
        eligibleCustomers: Math.floor(Math.random() * 50) + 5,
      };

      setCustomRules([...customRules, newRule]);
      setRuleJustSaved(newRule.id);

      // Show success toast
      toast({
        title: "Risk Rule Created Successfully",
        description: `"${ruleName}" has been added to active scoring rules.`,
      });

      resetRuleBuilder();
    }
  };

  const resetRuleBuilder = () => {
    setRuleName("");
    setRuleConditions([]);
    setSelectedParameter("");
    setSelectedOperator("");
    setRuleValue("");
    setSelectedRiskBand("medium");
    setRuleWeight("30");
    // Clear the "just saved" indicator after some time
    setTimeout(() => setRuleJustSaved(null), 3000);
  };

  // Combine default rules with custom rules
  const allRiskRules = [...riskRules, ...customRules];

  // Mock data for risk customers
  /**
   * Risk customers come from the canonical account list — the same records the
   * Portfolio Dashboard and Performance Reports read. Every score here is on a
   * single 0-100 scale and the band is derived from that score, so a badge can
   * never disagree with the number beside it.
   */
  const riskCustomers: RiskCustomer[] = riskViews.map((v) => {
    // Secondary indicators are deterministic functions of the same account, so
    // they move together with the score instead of being independently invented.
    const utilization = Math.min(99, Math.round(40 + v.riskScore * 0.55));
    const behaviour = Math.max(5, Math.min(98, 100 - v.riskScore));
    return {
      id: v.id,
      name: v.name,
      overdueDays: v.overdueDays,
      overdueAmount: v.overdueAmount,
      totalOutstanding: v.totalOutstanding,
      currentBalance: Math.round(v.totalOutstanding - v.overdueAmount),
      tenure: v.tenureMonths || 12,
      paymentPattern: v.paymentPattern,
      riskBand: v.riskBand === "critical" ? "high" : v.riskBand,
      riskScore: v.riskScore,
      // Credit-style score, inverted from risk: 300 (worst) to 850 (best).
      paymentRiskScore: Math.round(850 - (v.riskScore / 100) * 550),
      probabilityOfDefault: v.probabilityOfDefault,
      serviceLimit: Math.max(1000, Math.round(v.totalOutstanding * 2.5)),
      utilizationRatio: utilization,
      debtToIncomeRatio: Math.min(85, Math.round(v.riskScore * 0.7)),
      lastScoreUpdate: `${v.lastContactDays}d ago`,
      segment: v.segment,
      financialHealth:
        v.riskScore >= 85 ? "poor" : v.riskScore >= 70 ? "poor" : v.riskScore >= 45 ? "fair" : "good",
      // Straight from subscriber_risk_profile — responsibility is payment
      // behaviour, employment stability stands in for income stability, and
      // cooperation is the engagement record. No client-side derivation.
      behaviorScore: Math.round(v.responsibilityScore ?? behaviour),
      incomeStability: Math.round(v.employmentStabilityScore ?? v.contactability),
      serviceHistory: Math.round(v.cooperationScore ?? behaviour),
    } as RiskCustomer;
  });

  const totalCustomers = riskSummary.total;
  const riskDistribution = {
    low: riskSummary.low,
    medium: riskSummary.medium,
    // Critical folds into High for the legacy three-band views below.
    high: riskSummary.high + riskSummary.critical,
  };

  const filteredCustomers = riskCustomers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRiskBadgeVariant = (riskBand: string) => {
    switch (riskBand.toLowerCase()) {
      case "low":
        return "default";
      case "medium":
        return "secondary";
      case "high":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const calculatePredictivePaymentScore = (
    customer: RiskCustomer
  ): PredictivePaymentScore => {
    // Calculate likelihood based on multiple factors
    let likelihood = 50; // Base likelihood

    // Payment pattern influence
    if (customer.paymentPattern === "good") likelihood += 30;
    else if (customer.paymentPattern === "irregular") likelihood += 5;
    else likelihood -= 20;

    // Payment risk score influence
    if (customer.paymentRiskScore >= 700) likelihood += 20;
    else if (customer.paymentRiskScore >= 600) likelihood += 10;
    else if (customer.paymentRiskScore < 500) likelihood -= 15;

    // Behavioral score influence
    if (customer.behaviorScore >= 80) likelihood += 10;
    else if (customer.behaviorScore < 50) likelihood -= 10;

    // Income stability influence
    if (customer.incomeStability >= 80) likelihood += 10;
    else if (customer.incomeStability < 60) likelihood -= 10;

    // Overdue status influence
    if (customer.overdueDays === 0) likelihood += 15;
    else if (customer.overdueDays > 60) likelihood -= 20;
    else if (customer.overdueDays > 30) likelihood -= 10;

    // Cap likelihood between 0 and 100
    likelihood = Math.max(5, Math.min(100, likelihood));

    // Determine confidence level
    let confidenceLevel: "high" | "medium" | "low";
    if (customer.tenure > 36 && customer.serviceHistory > 80)
      confidenceLevel = "high";
    else if (customer.tenure > 12) confidenceLevel = "medium";
    else confidenceLevel = "low";

    // Calculate next payment date (estimate based on overdue days)
    const daysUntilPayment =
      customer.overdueDays > 0 ? Math.max(7, 30 - customer.overdueDays) : 30;
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + daysUntilPayment);

    // Predicted amount based on current balance and pattern
    const predictedAmount =
      customer.paymentPattern === "good"
        ? customer.currentBalance
        : customer.currentBalance * 0.5;

    // Risk factors
    const riskFactors: string[] = [];
    if (customer.overdueDays > 30)
      riskFactors.push(`${customer.overdueDays} days overdue`);
    if (customer.paymentPattern === "poor")
      riskFactors.push("Poor payment history");
    if (customer.utilizationRatio > 80)
      riskFactors.push("High utilization ratio");
    if (customer.debtToIncomeRatio > 35)
      riskFactors.push("High debt-to-income ratio");
    if (customer.behaviorScore < 50) riskFactors.push("Low behavioral score");
    if (customer.incomeStability < 60) riskFactors.push("Unstable income");

    // Positive indicators
    const positiveIndicators: string[] = [];
    if (customer.paymentPattern === "good")
      positiveIndicators.push("Consistent payment history");
    if (customer.tenure > 36)
      positiveIndicators.push(`Long tenure (${customer.tenure} months)`);
    if (customer.behaviorScore > 70)
      positiveIndicators.push("Strong behavioral score");
    if (customer.incomeStability > 75) positiveIndicators.push("Stable income");
    if (customer.serviceHistory > 80)
      positiveIndicators.push("Excellent service history");
    if (customer.utilizationRatio < 50)
      positiveIndicators.push("Low credit utilization");

    return {
      likelihood,
      confidenceLevel,
      nextPaymentDate: nextDate.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      predictedAmount: Math.round(predictedAmount),
      riskFactors,
      positiveIndicators,
    };
  };

  const generateRecommendations = (
    customer: RiskCustomer
  ): AIRecommendation[] => {
    const recs: AIRecommendation[] = [];
    const predScore = calculatePredictivePaymentScore(customer);

    // Add predictive payment recommendations first (highest priority)
    if (predScore.likelihood >= 70) {
      recs.push({
        id: "PRED001",
        title: "High Payment Probability Detected",
        priority: "high",
        successRate: predScore.likelihood,
        description: `Strong indicators suggest customer will pay $${
          predScore.predictedAmount
        } by ${predScore.nextPaymentDate}. ${predScore.positiveIndicators
          .slice(0, 2)
          .join(". ")}.`,
        timeline: predScore.nextPaymentDate,
        expectedOutcome: "Expected payment without intervention",
        actionType: "predictive",
      });
    } else if (predScore.likelihood >= 40) {
      recs.push({
        id: "PRED002",
        title: "Moderate Payment Risk Identified",
        priority: "medium",
        successRate: predScore.likelihood,
        description: `Customer shows mixed payment signals. Key concerns: ${predScore.riskFactors
          .slice(0, 2)
          .join(", ")}. Proactive engagement recommended.`,
        timeline: `Before ${predScore.nextPaymentDate}`,
        expectedOutcome: "Improved payment likelihood with intervention",
        actionType: "predictive",
      });
    } else {
      recs.push({
        id: "PRED003",
        title: "Low Payment Probability Alert",
        priority: "high",
        successRate: predScore.likelihood,
        description: `Critical risk factors identified: ${predScore.riskFactors
          .slice(0, 3)
          .join(", ")}. Immediate intervention required.`,
        timeline: "Next 48 hours",
        expectedOutcome: "Prevention of further delinquency",
        actionType: "predictive",
      });
    }

    // Add existing recommendations based on risk band
    if (customer.riskBand === "high") {
      recs.push({
        id: "REC001",
        title: "Immediate Payment Arrangement",
        priority: "high",
        successRate: 78,
        description:
          "Contact customer to arrange immediate payment plan for overdue amount",
        timeline: "24 hours",
        expectedOutcome: "Reduce overdue balance by 60%",
        actionType: "payment",
      });
      recs.push({
        id: "REC002",
        title: "Legal Notice Preparation",
        priority: "medium",
        successRate: 65,
        description: "Prepare formal legal notice for debt recovery",
        timeline: "3-5 days",
        expectedOutcome: "Prompt payment response",
        actionType: "legal",
      });
    }

    if (customer.riskBand === "medium") {
      recs.push({
        id: "REC003",
        title: "Payment Reminder Campaign",
        priority: "medium",
        successRate: 85,
        description: "Send automated payment reminders via SMS and email",
        timeline: "2 hours",
        expectedOutcome: "30% payment completion rate",
        actionType: "engagement",
      });
      recs.push({
        id: "REC004",
        title: "Credit Limit Review",
        priority: "low",
        successRate: 72,
        description:
          "Review and potentially adjust credit limit based on payment behavior",
        timeline: "1-2 days",
        expectedOutcome: "Improved payment discipline",
        actionType: "support",
      });
    }

    if (customer.riskBand === "low") {
      recs.push({
        id: "REC005",
        title: "Early Settlement Discount",
        priority: "low",
        successRate: 92,
        description:
          "Offer 5% discount for early payment of outstanding balance",
        timeline: "1 hour",
        expectedOutcome: "Full balance clearance",
        actionType: "payment",
      });
    }

    return recs;
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case "high":
        return "destructive";
      case "medium":
        return "secondary";
      case "low":
        return "default";
      default:
        return "secondary";
    }
  };

  const handleCreateCase = () => {
    if (selectedCustomer) {
      // Pre-select agent based on customer segment and risk
      const suggestedAgent = getAgentBySegment(
        selectedCustomer.segment || "Standard",
        selectedCustomer.riskBand || "medium"
      );
      setSelectedAgent(suggestedAgent);
      setCaseNotes("");
      setCreateCaseDialog(true);
    }
  };

  const handleSubmitCase = () => {
    if (!selectedCustomer || !selectedAgent) {
      toast({
        title: "Missing Information",
        description: "Please select an agent to assign the case.",
        variant: "destructive",
      });
      return;
    }

    const agent = AGENTS.find((a) => a.id === selectedAgent);

    toast({
      title: "Case Created Successfully",
      description: `Case assigned to ${agent?.name || "agent"} for customer ${
        selectedCustomer.name
      }`,
    });

    setCreateCaseDialog(false);

    // Optional: Navigate to Case Management module if callback provided
    if (onNavigateToCase) {
      onNavigateToCase(selectedCustomer, {
        assignedAgent: selectedAgent,
        notes: caseNotes,
        caseType: caseType,
      });
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Risk Analysis"
        description="Automated risk scoring and customer segmentation"
        actions={
          <Button>
            <Zap className="w-4 h-4 mr-2" />
            Run Nightly Update
          </Button>
        }
      />
      {/* Risk band distribution — counts and the exposure they carry */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: "Low Risk", count: riskSummary.low, tone: "text-success", Icon: Shield, hint: "Score 0–29" },
          { label: "Medium Risk", count: riskSummary.medium, tone: "text-warning", Icon: Activity, hint: "Score 30–54" },
          { label: "High Risk", count: riskSummary.high, tone: "text-destructive", Icon: AlertTriangle, hint: "Score 55–74" },
          { label: "Critical Risk", count: riskSummary.critical, tone: "text-destructive", Icon: AlertTriangle, hint: "Score 75+" },
        ].map(({ label, count, tone, Icon, hint }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <p className={`text-2xl font-semibold tabular-nums mt-1 ${tone}`}>
                    {formatCount(count)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {totalCustomers ? ((count / totalCustomers) * 100).toFixed(1) : "0.0"}% · {hint}
                  </p>
                </div>
                <Icon className={`w-4 h-4 shrink-0 ${tone}`} />
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden mt-3">
                <div
                  className={`h-full rounded-full ${
                    tone === "text-success" ? "bg-success" : tone === "text-warning" ? "bg-warning" : "bg-destructive"
                  }`}
                  style={{ width: `${totalCustomers ? (count / totalCustomers) * 100 : 0}%` }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="customers" className="space-y-6">
        <TabsList>
          <TabsTrigger value="customers">Risk Customers</TabsTrigger>
          {/* <TabsTrigger value="credit-scoring">Credit Scoring</TabsTrigger> */}
          <TabsTrigger value="rules">Scoring Rules</TabsTrigger>
          {/* <TabsTrigger value="segments">Segments</TabsTrigger> */}
          <TabsTrigger value="ml-prediction">ML Prediction</TabsTrigger>
        </TabsList>

        <TabsContent value="customers" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Customer List */}
            <Card>
              <CardHeader>
                <CardTitle>Risk-Scored Customers</CardTitle>
                <CardDescription>
                  Customers with automated risk assessments
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex space-x-2 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search customers..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
                  {filteredCustomers.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No customers match this search and filter combination.
                    </p>
                  )}
                  {filteredCustomers.slice(0, 50).map((customer) => {
                    const selected = selectedCustomer?.id === customer.id;
                    // One scale throughout: 0-100, higher is riskier.
                    const tone =
                      customer.riskScore >= 85
                        ? "bg-destructive"
                        : customer.riskScore >= 70
                          ? "bg-destructive/70"
                          : customer.riskScore >= 45
                            ? "bg-warning"
                            : "bg-success";
                    return (
                      <button
                        key={customer.id}
                        type="button"
                        className={`w-full text-left p-3 border rounded-lg transition-colors ${
                          selected
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/60 hover:border-primary/30"
                        }`}
                        onClick={() => {
                          setSelectedCustomer(customer);
                          setRecommendations(generateRecommendations(customer));
                          setPredictiveScore(calculatePredictivePaymentScore(customer));
                        }}
                      >
                        <div className="flex items-start justify-between gap-2 mb-1.5">
                          <div className="min-w-0">
                            <div className="font-medium text-foreground truncate">
                              {customer.name}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {customer.id} · {customer.segment}
                            </div>
                          </div>
                          <Badge variant={getRiskBadgeVariant(customer.riskBand)} className="shrink-0">
                            {customer.riskBand.toUpperCase()}
                          </Badge>
                        </div>

                        <div className="flex items-center gap-2 mb-2">
                          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${tone}`}
                              style={{ width: `${customer.riskScore}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold tabular-nums text-foreground w-14 text-right">
                            {customer.riskScore}/100
                          </span>
                        </div>

                        <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                          <span>
                            {customer.overdueDays > 0
                              ? `${customer.overdueDays} days overdue`
                              : "Current"}
                          </span>
                          <span className="font-medium text-foreground">
                            {formatMoney(customer.totalOutstanding)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                  {filteredCustomers.length > 50 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Showing the 50 highest-scoring of {formatCount(filteredCustomers.length)} —
                      narrow the filters to see more.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Customer Detail */}
            <Card>
              <CardHeader>
                <CardTitle>Risk Analysis Detail</CardTitle>
                <CardDescription>
                  Comprehensive risk assessment for selected customer
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedCustomer ? (
                  <div className="space-y-6">
                    {/* Customer Header */}
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-semibold">
                          {selectedCustomer.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {selectedCustomer.id} • {selectedCustomer.segment}
                        </p>
                      </div>
                      <Badge
                        variant={getRiskBadgeVariant(selectedCustomer.riskBand)}
                        className="text-sm"
                      >
                        {selectedCustomer.riskBand.toUpperCase()} RISK
                      </Badge>
                    </div>

                    {/* Risk Metrics */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Risk Score:</span>
                          <span className="font-medium">
                            {selectedCustomer.riskScore}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Default Probability:</span>
                          <span className="font-medium text-destructive">
                            {(
                              selectedCustomer.probabilityOfDefault * 100
                            ).toFixed(1)}
                            %
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Payment Score:</span>
                          <span className="font-medium">
                            {selectedCustomer.paymentRiskScore}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Overdue Days:</span>
                          <span className="font-medium">
                            {selectedCustomer.overdueDays}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Outstanding:</span>
                          <span className="font-medium">
                            $
                            {selectedCustomer.totalOutstanding.toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Utilization:</span>
                          <span className="font-medium">
                            {selectedCustomer.utilizationRatio}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Risk Factors */}
                    <div>
                      <h4 className="font-medium mb-3">
                        Risk Factors Analysis
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Responsibility</span>
                            <span>{selectedCustomer.behaviorScore}/100</span>
                          </div>
                          <Progress value={selectedCustomer.behaviorScore} />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Employment Stability</span>
                            <span>{selectedCustomer.incomeStability}/100</span>
                          </div>
                          <Progress value={selectedCustomer.incomeStability} />
                        </div>
                        <div>
                          <div className="flex justify-between text-sm mb-1">
                            <span>Cooperation</span>
                            <span>{selectedCustomer.serviceHistory}/100</span>
                          </div>
                          <Progress value={selectedCustomer.serviceHistory} />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Select a customer from the list to view risk analysis
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Predictive Payment Analysis */}
            {predictiveScore && selectedCustomer && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Future Payment Prediction
                  </CardTitle>
                  <CardDescription>
                    AI-powered payment likelihood forecast
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Payment Likelihood Gauge */}
                  <div className="text-center mb-4">
                    <div className="mb-2">
                      <span className="text-3xl font-bold text-foreground">
                        {predictiveScore.likelihood}%
                      </span>
                    </div>
                    <Progress
                      value={predictiveScore.likelihood}
                      className={`h-3 ${
                        predictiveScore.likelihood > 70
                          ? "[&>div]:bg-success"
                          : predictiveScore.likelihood > 40
                          ? "[&>div]:bg-orange-500"
                          : "[&>div]:bg-destructive"
                      }`}
                    />
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <Badge
                        variant={
                          predictiveScore.likelihood > 70
                            ? "default"
                            : predictiveScore.likelihood > 40
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {predictiveScore.likelihood > 70
                          ? "High"
                          : predictiveScore.likelihood > 40
                          ? "Moderate"
                          : "Low"}{" "}
                        Likelihood
                      </Badge>
                      <Badge variant="outline">
                        {predictiveScore.confidenceLevel.toUpperCase()}{" "}
                        Confidence
                      </Badge>
                    </div>
                  </div>

                  {/* Expected Payment Details */}
                  <div className="grid grid-cols-2 gap-4 p-3 bg-secondary/30 rounded-lg">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Expected Date
                      </p>
                      <p className="font-medium text-sm flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {predictiveScore.nextPaymentDate}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">
                        Predicted Amount
                      </p>
                      <p className="font-medium text-sm flex items-center gap-1">
                        <DollarSign className="w-3 h-3" />
                        {predictiveScore.predictedAmount}
                      </p>
                    </div>
                  </div>

                  {/* Risk Factors */}
                  {predictiveScore.riskFactors.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium flex items-center gap-1 mb-2">
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                        Risk Factors
                      </h5>
                      <ul className="space-y-1">
                        {predictiveScore.riskFactors.map((factor, idx) => (
                          <li
                            key={idx}
                            className="text-xs text-muted-foreground flex items-start gap-1"
                          >
                            <span className="text-destructive">•</span>
                            <span>{factor}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Positive Indicators */}
                  {predictiveScore.positiveIndicators.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium flex items-center gap-1 mb-2">
                        <Shield className="w-4 h-4 text-success" />
                        Positive Indicators
                      </h5>
                      <ul className="space-y-1">
                        {predictiveScore.positiveIndicators.map(
                          (indicator, idx) => (
                            <li
                              key={idx}
                              className="text-xs text-muted-foreground flex items-start gap-1"
                            >
                              <span className="text-success">•</span>
                              <span>{indicator}</span>
                            </li>
                          )
                        )}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* AI Recommended Actions */}
            <div className="space-y-4">
              <div>
                <h2 className="text-2xl font-semibold flex items-center gap-2">
                  <Brain className="w-5 h-5" />
                  AI Recommended Actions
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Intelligent actions based on risk analysis
                </p>
              </div>

              {selectedCustomer && recommendations.length > 0 ? (
                <>
                  <div className="space-y-4">
                    {recommendations.map((rec) => (
                      <Card
                        key={rec.id}
                        className={`
                          border-2 shadow-md hover:shadow-xl 
                          transition-all duration-300 
                          bg-card
                          ${
                            rec.actionType === "predictive"
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/50"
                          }
                        `}
                      >
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-3">
                                <Badge
                                  variant={getPriorityBadgeVariant(
                                    rec.priority
                                  )}
                                >
                                  {rec.priority.toUpperCase()}
                                </Badge>
                                {rec.actionType === "predictive" && (
                                  <Badge variant="outline">
                                    <TrendingUp className="w-3 h-3 mr-1" />
                                    PREDICTIVE
                                  </Badge>
                                )}
                              </div>

                              <h4 className="font-semibold text-lg mb-2">
                                {rec.title}
                              </h4>
                              <p className="text-sm text-muted-foreground mb-4">
                                {rec.description}
                              </p>

                              <div className="flex items-center gap-6 text-sm">
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <Clock className="w-4 h-4" />
                                  <span>{rec.timeline}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <Target className="w-4 h-4" />
                                  <span>{rec.expectedOutcome}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-3">
                              <div className="text-right">
                                <span className="text-2xl font-bold text-success">
                                  {rec.successRate}%
                                </span>
                                <p className="text-xs text-muted-foreground">
                                  Success Rate
                                </p>
                              </div>
                              <Button
                                onClick={() => {
                                  toast({
                                    title: "Action Executed",
                                    description: `"${rec.title}" has been initiated for ${selectedCustomer.name}.`,
                                  });
                                }}
                              >
                                Execute Action
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  {/* Create Case Button */}
                  <Card className="border-dashed">
                    <CardContent className="p-6">
                      <div className="text-center space-y-3">
                        <p className="text-sm text-muted-foreground">
                          None of these actions suitable?
                        </p>
                        <Button
                          variant="outline"
                          className="w-full md:w-auto"
                          onClick={handleCreateCase}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create New Case
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <Card>
                  <CardContent className="py-8">
                    <p className="text-muted-foreground text-center">
                      Select a customer to view AI-powered action
                      recommendations
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="credit-scoring" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Credit Score Overview */}
            <Card>
              <CardHeader>
                <CardTitle>Credit Score Distribution</CardTitle>
                <CardDescription>Credit worthiness analysis</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Excellent (750+)</span>
                      <span className="font-medium">
                        {
                          riskCustomers.filter((c) => c.paymentRiskScore >= 750)
                            .length
                        }
                      </span>
                    </div>
                    <Progress
                      value={
                        (riskCustomers.filter((c) => c.paymentRiskScore >= 750)
                          .length /
                          totalCustomers) *
                        100
                      }
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Good (650-749)</span>
                      <span className="font-medium">
                        {
                          riskCustomers.filter(
                            (c) =>
                              c.paymentRiskScore >= 650 &&
                              c.paymentRiskScore < 750
                          ).length
                        }
                      </span>
                    </div>
                    <Progress
                      value={
                        (riskCustomers.filter(
                          (c) =>
                            c.paymentRiskScore >= 650 &&
                            c.paymentRiskScore < 750
                        ).length /
                          totalCustomers) *
                        100
                      }
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Fair (550-649)</span>
                      <span className="font-medium">
                        {
                          riskCustomers.filter(
                            (c) =>
                              c.paymentRiskScore >= 550 &&
                              c.paymentRiskScore < 650
                          ).length
                        }
                      </span>
                    </div>
                    <Progress
                      value={
                        (riskCustomers.filter(
                          (c) =>
                            c.paymentRiskScore >= 550 &&
                            c.paymentRiskScore < 650
                        ).length /
                          totalCustomers) *
                        100
                      }
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Poor (300-549)</span>
                      <span className="font-medium text-destructive">
                        {
                          riskCustomers.filter((c) => c.paymentRiskScore < 550)
                            .length
                        }
                      </span>
                    </div>
                    <Progress
                      value={
                        (riskCustomers.filter((c) => c.paymentRiskScore < 550)
                          .length /
                          totalCustomers) *
                        100
                      }
                      className="[&>div]:bg-destructive"
                    />
                  </div>
                </div>
                <div className="pt-4 border-t">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">
                      {Math.round(
                        riskCustomers.reduce(
                          (sum, c) => sum + c.paymentRiskScore,
                          0
                        ) / totalCustomers
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Average Payment Risk Score
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Financial Health Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Financial Health Analysis</CardTitle>
                <CardDescription>
                  Comprehensive financial indicators
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedCustomer ? (
                  <>
                    <div className="text-center mb-4">
                      <Badge
                        variant={
                          selectedCustomer.financialHealth === "excellent"
                            ? "default"
                            : selectedCustomer.financialHealth === "good"
                            ? "secondary"
                            : selectedCustomer.financialHealth === "fair"
                            ? "secondary"
                            : "destructive"
                        }
                      >
                        {selectedCustomer.financialHealth.toUpperCase()} HEALTH
                      </Badge>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Debt-to-Income Ratio</span>
                          <span
                            className={
                              selectedCustomer.debtToIncomeRatio > 40
                                ? "text-destructive"
                                : "text-success"
                            }
                          >
                            {selectedCustomer.debtToIncomeRatio}%
                          </span>
                        </div>
                        <Progress value={selectedCustomer.debtToIncomeRatio} />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Service Utilization</span>
                          <span
                            className={
                              selectedCustomer.utilizationRatio > 85
                                ? "text-destructive"
                                : "text-success"
                            }
                          >
                            {selectedCustomer.utilizationRatio}%
                          </span>
                        </div>
                        <Progress value={selectedCustomer.utilizationRatio} />
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span>Customer Tenure</span>
                          <span className="text-success">
                            {selectedCustomer.tenure} months
                          </span>
                        </div>
                        <Progress
                          value={Math.min(
                            (selectedCustomer.tenure / 60) * 100,
                            100
                          )}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-muted-foreground text-center py-8">
                    Select a customer to view financial health metrics
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Scoring Model Performance */}
            <Card>
              <CardHeader>
                <CardTitle>Scoring Model Performance</CardTitle>
                <CardDescription>
                  Model accuracy and validation metrics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Model Accuracy:</span>
                    <span className="font-medium text-success">97.75%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Precision:</span>
                    <span className="font-medium">96.03%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Recall:</span>
                    <span className="font-medium">96.00%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">F1 Score:</span>
                    <span className="font-medium">96.01%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">AUC:</span>
                    <span className="font-medium">99.72%</span>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Last Model Update:</span>
                      <span className="text-muted-foreground">2 days ago</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Training Data Size:</span>
                      <span className="text-muted-foreground">
                        12,450 records
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Validation Set Size:</span>
                      <span className="text-muted-foreground">
                        3,112 records
                      </span>
                    </div>
                  </div>
                </div>

                <Button className="w-full mt-4  bg-primary text-primary-foreground hover:bg-primary/90">
                  <Brain className="w-4 h-4 mr-2" />
                  Retrain Model
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rules" className="space-y-6">
          <RiskScoringRules />

</TabsContent>

        <TabsContent value="segments" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-success">
                  <Shield className="w-5 h-5" />
                  <span>Low Risk</span>
                </CardTitle>
                <CardDescription>
                  Premium customers with excellent payment history
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Count:</span>
                    <span className="font-medium">{riskDistribution.low}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Criteria:</span>
                    <span className="text-sm text-success">
                      {"<30 days overdue"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Actions:</span>
                    <span className="text-sm">Standard monitoring</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-orange-500">
                  <Activity className="w-5 h-5" />
                  <span>Medium Risk</span>
                </CardTitle>
                <CardDescription>
                  Customers requiring increased attention
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Count:</span>
                    <span className="font-medium">
                      {riskDistribution.medium}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Criteria:</span>
                    <span className="text-sm text-orange-500">
                      30-90 days overdue
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Actions:</span>
                    <span className="text-sm">Enhanced monitoring</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-destructive">
                  <AlertTriangle className="w-5 h-5" />
                  <span>High Risk</span>
                </CardTitle>
                <CardDescription>
                  Critical accounts requiring immediate action
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm">Count:</span>
                    <span className="font-medium">{riskDistribution.high}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Criteria:</span>
                    <span className="text-sm text-destructive">
                      {"90+ days overdue"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm">Actions:</span>
                    <span className="text-sm">Intensive collection</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ml-prediction">
          <MlPredictionBrowser />
        </TabsContent>

      </Tabs>

      {/* Create Case Dialog */}
      <Dialog open={createCaseDialog} onOpenChange={setCreateCaseDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Case</DialogTitle>
            <DialogDescription>
              Create a collection or dispute case with auto-filled customer
              information
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Customer Information - Auto-filled */}
            <div className="bg-secondary/20 p-4 rounded-lg border">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <UserCircle2 className="w-4 h-4" />
                Customer Information
              </h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Customer Name</Label>
                  <p className="font-medium">{selectedCustomer?.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Customer ID</Label>
                  <p className="font-medium">{selectedCustomer?.id}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-medium text-xs">
                    {selectedCustomer?.email || "N/A"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Phone</Label>
                  <p className="font-medium">
                    {selectedCustomer?.phone || "N/A"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">
                    Overdue Amount
                  </Label>
                  <p className="font-medium text-destructive">
                    ${selectedCustomer?.overdueAmount?.toLocaleString() || 0}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Risk Band</Label>
                  <Badge
                    variant={
                      selectedCustomer?.riskBand === "high"
                        ? "destructive"
                        : "secondary"
                    }
                  >
                    {selectedCustomer?.riskBand || "N/A"}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Case Type Selection */}
            <div>
              <Label>Case Type</Label>
              <Select
                value={caseType}
                onValueChange={(value: any) => setCaseType(value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="collection">Collection</SelectItem>
                  <SelectItem value="dispute">Dispute</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Agent Assignment */}
            <div>
              <Label>Assign to Agent</Label>
              <Select value={selectedAgent} onValueChange={setSelectedAgent}>
                <SelectTrigger>
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  {AGENTS.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id}>
                      <div className="flex items-center justify-between w-full">
                        <div>
                          <p className="font-medium">{agent.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {agent.department} • {agent.expertise}
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <Badge
                            variant={
                              agent.status === "available"
                                ? "default"
                                : "secondary"
                            }
                            className="text-xs"
                          >
                            {agent.status}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {agent.currentCaseload}/{agent.maxCaseload} cases
                          </p>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Agent is pre-selected based on customer segment and risk level
              </p>
            </div>

            {/* Initial Notes */}
            <div>
              <Label>Initial Case Notes</Label>
              <Textarea
                placeholder="Enter initial notes about this case..."
                value={caseNotes}
                onChange={(e) => setCaseNotes(e.target.value)}
                rows={4}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                className="flex-1"
                onClick={handleSubmitCase}
                disabled={!selectedAgent}
              >
                Create Case
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  handleSubmitCase();
                }}
              >
                Create & Go to Case Management
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
