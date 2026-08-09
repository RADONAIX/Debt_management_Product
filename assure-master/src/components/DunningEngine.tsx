import { useState } from "react"
import { SHARED_CUSTOMERS } from "@/components/shared/customerData"
import { useCustomerType } from "@/contexts/CustomerTypeContext"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Progress } from "@/components/ui/progress"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  MessageSquare,
  Mail,
  Phone,
  Calendar,
  Settings,
  Send,
  Edit,
  Plus,
  Clock,
  FileText,
  Users,
  CheckCircle,
  XCircle,
  Target,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Shield,
  Activity,
  BarChart3,
  DollarSign,
  Search,
  Trash2,
  Save,
  Brain,
  Globe,
  Smartphone,
  CreditCard,
  Play,
} from "lucide-react"

// Interface definitions for rule builder
interface RuleCondition {
  id: string
  parameter: string
  operator: string
  value: string
  connector?: "AND" | "OR"
}

interface RuleParameter {
  id: string
  name: string
  type: "number" | "text" | "boolean"
  description: string
}

export default function DunningEngine() {
  const { toast } = useToast()
  const { customerType } = useCustomerType()
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null)
  const [activeTab, setActiveTab] = useState("campaigns")
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([])
  const [selectedRiskSegments, setSelectedRiskSegments] = useState<string[]>([])
  const [selectedRiskRules, setSelectedRiskRules] = useState<string[]>([])
  const [ptpDialog, setPtpDialog] = useState(false)
  const [selectedPtpCustomer, setSelectedPtpCustomer] = useState<any>(null)

  // Advanced Rule Builder State
  const [selectedParameter, setSelectedParameter] = useState("")
  const [selectedOperator, setSelectedOperator] = useState("")
  const [ruleValue, setRuleValue] = useState("")
  const [ruleName, setRuleName] = useState("")
  const [selectedRiskBand, setSelectedRiskBand] = useState("medium")
  const [ruleWeight, setRuleWeight] = useState("30")
  const [ruleConditions, setRuleConditions] = useState<RuleCondition[]>([])
  const [customRules, setCustomRules] = useState<any[]>([])
  const [ruleJustSaved, setRuleJustSaved] = useState<string | null>(null)

  // A/B Testing State
  const [abTestName, setAbTestName] = useState("")
  const [abTestDescription, setAbTestDescription] = useState("")
  const [testDuration, setTestDuration] = useState({ start: "", end: "" })
  const [confidenceLevel, setConfidenceLevel] = useState("95")
  const [testVariants, setTestVariants] = useState([
    {
      id: "A",
      name: "Control",
      channel: "Email",
      template: "",
      split: 50,
      color: "blue",
    },
    {
      id: "B",
      name: "Variant B",
      channel: "SMS",
      template: "",
      split: 50,
      color: "green",
    },
  ])
  const [primaryMetric, setPrimaryMetric] = useState("response_rate")
  const [secondaryMetrics, setSecondaryMetrics] = useState<string[]>([])
  const [activeTest, setActiveTest] = useState<any>(null)
  const [testResults, setTestResults] = useState<any>(null)

  // What-If Analysis State
  const [scenarioName, setScenarioName] = useState("")
  const [contactFrequency, setContactFrequency] = useState(3)
  const [riskThresholds, setRiskThresholds] = useState({
    high: 90,
    medium: 30,
    low: 10,
  })
  const [channelMix, setChannelMix] = useState({
    email: 40,
    sms: 35,
    phone: 20,
    other: 5,
  })
  const [scenarios, setScenarios] = useState<any[]>([
    {
      id: "scenario1",
      name: "Current Strategy",
      contactFrequency: 3,
      riskThresholds: { high: 90, medium: 30, low: 10 },
      channelMix: { email: 40, sms: 35, phone: 20, other: 5 },
      predictions: {
        responseRate: 68.5,
        recoveryAmount: 145200,
        campaignCost: 8750,
        netROI: 2.34,
        timeToResolution: 12.3,
      },
      confidence: "High",
    },
  ])
  const [selectedScenarios, setSelectedScenarios] = useState<string[]>([
    "scenario1",
  ])
  const [simulationResults, setSimulationResults] = useState<any>(null)

  // Template filtering state
  const [channelFilter, setChannelFilter] = useState<string>("All")
  const [currentTests, setCurrentTests] = useState([
    {
      id: "TEST001",
      name: "Email vs SMS Response Test",
      status: "running",
      startDate: "2024-01-25",
      endDate: "2024-02-08",
      variants: [
        {
          id: "A",
          name: "Email Only",
          customers: 78,
          responses: 12,
          recovery: 18500,
          cost: 390,
        },
        {
          id: "B",
          name: "SMS Only",
          customers: 82,
          responses: 18,
          recovery: 22100,
          cost: 246,
        },
      ],
      significance: 0.82,
      winner: null,
      confidence: "82%",
    },
  ])

  // Available parameters for rule creation (enterprise-specific)
  const baseRuleParameters: RuleParameter[] = [
    {
      id: "overdue_days",
      name: "Overdue Days",
      type: "number",
      description: "Number of days payment is overdue",
    },
    {
      id: "overdue_amount",
      name: "Overdue Amount",
      type: "number",
      description: "Total amount currently overdue",
    },
    {
      id: "payment_pattern",
      name: "Service Payment Score",
      type: "number",
      description: "Historical service payment behavior score (0-100)",
    },
    {
      id: "customer_tenure",
      name: "Customer Tenure",
      type: "number",
      description: "Months as customer",
    },
    {
      id: "contact_attempts",
      name: "Contact Attempts",
      type: "number",
      description: "Number of contact attempts made",
    },
    {
      id: "promise_breaks",
      name: "Broken Promises",
      type: "number",
      description: "Number of broken payment promises",
    },
    {
      id: "dispute_count",
      name: "Dispute Count",
      type: "number",
      description: "Number of active disputes",
    },
    {
      id: "total_balance",
      name: "Total Balance",
      type: "number",
      description: "Total account balance",
    },
    {
      id: "last_payment_days",
      name: "Days Since Last Payment",
      type: "number",
      description: "Days since last payment received",
    },
    {
      id: "account_status",
      name: "Account Status",
      type: "text",
      description: "Current account status",
    },
  ]

  const enterpriseRuleParameters: RuleParameter[] = [
    ...baseRuleParameters,
    {
      id: "contract_value",
      name: "Contract Value",
      type: "number",
      description: "Total annual contract value",
    },
    {
      id: "sla_compliance",
      name: "SLA Compliance %",
      type: "number",
      description: "Service level agreement compliance percentage",
    },
    {
      id: "service_disruption",
      name: "Service Disruption Risk",
      type: "number",
      description: "Risk score for service disruption impact (1-10)",
    },
    {
      id: "account_manager_escalated",
      name: "Account Manager Escalated",
      type: "boolean",
      description: "Whether account manager has been notified",
    },
    {
      id: "contract_breach_count",
      name: "Contract Breach Count",
      type: "number",
      description: "Number of contract breaches",
    },
    {
      id: "multi_service_bundle",
      name: "Multi-Service Bundle",
      type: "boolean",
      description: "Customer has multiple service bundles",
    },
    {
      id: "parent_company_rating",
      name: "Parent Company Credit Rating",
      type: "number",
      description: "Parent company credit score",
    },
    {
      id: "regulatory_compliance",
      name: "Regulatory Compliance Score",
      type: "number",
      description: "Regulatory compliance score (0-100)",
    },
  ]

  const ruleParameters =
    customerType === "enterprise"
      ? enterpriseRuleParameters
      : baseRuleParameters

  const operators = [
    { value: "gt", label: "Greater Than", symbol: ">" },
    { value: "gte", label: "Greater Than or Equal", symbol: "≥" },
    { value: "lt", label: "Less Than", symbol: "<" },
    { value: "lte", label: "Less Than or Equal", symbol: "≤" },
    { value: "eq", label: "Equal To", symbol: "=" },
    { value: "between", label: "Between", symbol: "⟷" },
    { value: "in", label: "In List", symbol: "∈" },
  ]

  // Campaigns Summary Data (enterprise-specific rules)
  const normalRiskRules = [
    {
      id: "RULE001",
      name: "High Risk - Extended Overdue",
      condition: "Overdue Days ≥ 90 AND Overdue Amount > $1500",
      riskBand: "High",
      weight: 40,
      active: true,
      eligibleCustomers: 8,
    },
    {
      id: "RULE002",
      name: "Medium Risk - Amount Threshold",
      condition: "Overdue Amount ≥ $1000 AND < $2000",
      riskBand: "Medium",
      weight: 30,
      active: true,
      eligibleCustomers: 15,
    },
    {
      id: "RULE003",
      name: "Medium Risk - New Customer",
      condition: "Customer Tenure < 12 months AND Overdue Days > 30",
      riskBand: "Medium",
      weight: 25,
      active: true,
      eligibleCustomers: 22,
    },
    {
      id: "RULE004",
      name: "Low Risk - Good Payment History",
      condition: "Payment Pattern Score > 80 AND Overdue Days < 30",
      riskBand: "Low",
      weight: 35,
      active: true,
      eligibleCustomers: 45,
    },
  ]

  const enterpriseRiskRules = [
    {
      id: "ENT001",
      name: "High Risk - Contract Breach & Service Impact",
      condition: "Contract Breach Count ≥ 2 AND Service Disruption Risk > 7",
      riskBand: "High",
      weight: 45,
      active: true,
      eligibleCustomers: 5,
    },
    {
      id: "ENT002",
      name: "High Risk - High Value Overdue",
      condition: "Contract Value > $100000 AND Overdue Days ≥ 60",
      riskBand: "High",
      weight: 40,
      active: true,
      eligibleCustomers: 8,
    },
    {
      id: "ENT003",
      name: "Medium Risk - SLA Compliance Issues",
      condition: "SLA Compliance < 85 AND Overdue Amount > $5000",
      riskBand: "Medium",
      weight: 35,
      active: true,
      eligibleCustomers: 12,
    },
    {
      id: "ENT004",
      name: "Medium Risk - Account Manager Escalation",
      condition: "Account Manager Escalated = true AND Overdue Days > 30",
      riskBand: "Medium",
      weight: 30,
      active: true,
      eligibleCustomers: 15,
    },
    {
      id: "ENT005",
      name: "Low Risk - High Value Good Standing",
      condition: "Contract Value > $50000 AND Regulatory Compliance > 90",
      riskBand: "Low",
      weight: 25,
      active: true,
      eligibleCustomers: 20,
    },
  ]

  const riskRules =
    customerType === "enterprise" ? enterpriseRiskRules : normalRiskRules

  const normalRiskSegments = [
    {
      id: "HIGH_RISK",
      name: "High Risk Customers",
      description: "Extended overdue with high probability of default",
      customerCount: 28,
      avgOutstanding: 3250,
      color: "destructive",
    },
    {
      id: "MEDIUM_RISK",
      name: "Medium Risk Customers",
      description: "Moderate risk requiring attention",
      customerCount: 67,
      avgOutstanding: 1850,
      color: "secondary",
    },
    {
      id: "LOW_RISK",
      name: "Low Risk Customers",
      description: "Generally good payment history",
      customerCount: 45,
      avgOutstanding: 650,
      color: "default",
    },
  ]

  const enterpriseRiskSegments = [
    {
      id: "HIGH_RISK_ENT",
      name: "High Risk Enterprise Accounts",
      description:
        "Contract breaches, service disruption risk, high-value overdue",
      customerCount: 8,
      avgOutstanding: 125000,
      color: "destructive",
    },
    {
      id: "MEDIUM_RISK_ENT",
      name: "Medium Risk Enterprise Accounts",
      description: "SLA compliance issues, account manager escalation required",
      customerCount: 15,
      avgOutstanding: 75000,
      color: "secondary",
    },
    {
      id: "LOW_RISK_ENT",
      name: "Low Risk Enterprise Accounts",
      description:
        "High-value accounts with good compliance and payment history",
      customerCount: 12,
      avgOutstanding: 25000,
      color: "default",
    },
  ]

  const riskSegments =
    customerType === "enterprise" ? enterpriseRiskSegments : normalRiskSegments

  // Template data with multi-channel options
  const normalTemplates = [
    // SMS Templates
    {
      id: "T001",
      name: "Gentle Reminder",
      type: "SMS",
      stage: "D+0",
      content:
        "Hi {customer_name}, your payment of ${amount} is due today. Please pay to avoid late fees.",
      isActive: true,
      assignedToSegments: ["LOW_RISK"],
      characterCount: 89,
      costPerMessage: 0.05,
    },
    {
      id: "T002",
      name: "Urgent Payment SMS",
      type: "SMS",
      stage: "D+5",
      content:
        "URGENT: {customer_name}, ${amount} payment is 5 days overdue. Pay now to avoid penalties. Reply STOP to opt out.",
      isActive: true,
      assignedToSegments: ["MEDIUM_RISK", "HIGH_RISK"],
      characterCount: 126,
      costPerMessage: 0.05,
    },
    {
      id: "T003",
      name: "Final SMS Notice",
      type: "SMS",
      stage: "D+15",
      content:
        "FINAL NOTICE: {customer_name}, immediate payment of ${amount} required. Call {support_number} now.",
      isActive: true,
      assignedToSegments: ["HIGH_RISK"],
      characterCount: 110,
      costPerMessage: 0.05,
    },
    {
      id: "T004",
      name: "Payment Confirmation SMS",
      type: "SMS",
      stage: "Payment",
      content:
        "Thank you {customer_name}! Payment of ${amount} received. Your account is now current.",
      isActive: true,
      assignedToSegments: ["LOW_RISK", "MEDIUM_RISK", "HIGH_RISK"],
      characterCount: 89,
      costPerMessage: 0.05,
    },

    // Email Templates
    {
      id: "T005",
      name: "Payment Due Notice",
      type: "Email",
      stage: "D+0",
      content:
        "Dear {customer_name}, This is a friendly reminder that your payment of ${amount} is due today. Please log into your account or call us to make payment.",
      isActive: true,
      assignedToSegments: ["MEDIUM_RISK"],
      costPerMessage: 0.02,
    },
    {
      id: "T006",
      name: "Escalated Notice",
      type: "Email",
      stage: "D+5",
      content:
        "Dear {customer_name}, Your payment of ${amount} is now 5 days overdue. Please settle immediately to avoid service interruption and additional fees.",
      isActive: true,
      assignedToSegments: ["MEDIUM_RISK", "HIGH_RISK"],
      costPerMessage: 0.02,
    },
    {
      id: "T007",
      name: "Legal Warning Email",
      type: "Email",
      stage: "D+15",
      content:
        "URGENT: Your account is seriously delinquent. Legal action may be taken if payment is not received within 7 days. Contact us immediately.",
      isActive: true,
      assignedToSegments: ["HIGH_RISK"],
      costPerMessage: 0.02,
    },

    // Phone Script Templates
    {
      id: "T008",
      name: "Friendly Reminder Call",
      type: "Phone",
      stage: "D+3",
      content:
        "Hi {customer_name}, this is {agent_name} calling about your account. We show a payment of ${amount} that's past due. Can we process payment today?",
      isActive: true,
      assignedToSegments: ["MEDIUM_RISK"],
      estimatedDuration: "3-5 min",
      costPerMessage: 2.5,
    },
    {
      id: "T009",
      name: "Payment Arrangement Call",
      type: "Phone",
      stage: "D+7",
      content:
        "Hello {customer_name}, I'm calling regarding your overdue balance of ${amount}. Let's work together to arrange a payment plan that works for you.",
      isActive: true,
      assignedToSegments: ["MEDIUM_RISK", "HIGH_RISK"],
      estimatedDuration: "5-10 min",
      costPerMessage: 2.5,
    },
    {
      id: "T010",
      name: "Final Demand Call",
      type: "Phone",
      stage: "D+20",
      content:
        "This is a final notice call for {customer_name}. Your account balance of ${amount} must be paid immediately to avoid collection proceedings.",
      isActive: true,
      assignedToSegments: ["HIGH_RISK"],
      estimatedDuration: "2-5 min",
      costPerMessage: 2.5,
    },

    // Push Notification Templates
    {
      id: "T011",
      name: "Payment Due Push",
      type: "Push",
      stage: "D+0",
      content:
        "Payment due today: ${amount}. Tap to pay now and avoid late fees.",
      isActive: true,
      assignedToSegments: ["LOW_RISK"],
      costPerMessage: 0.01,
    },
    {
      id: "T012",
      name: "Overdue Alert Push",
      type: "Push",
      stage: "D+5",
      content:
        "Account overdue: ${amount}. Pay now to avoid service interruption.",
      isActive: true,
      assignedToSegments: ["MEDIUM_RISK", "HIGH_RISK"],
      costPerMessage: 0.01,
    },

    // Letter/Mail Templates
    {
      id: "T013",
      name: "Formal Demand Letter",
      type: "Letter",
      stage: "D+30",
      content:
        "FORMAL NOTICE OF DEMAND: Dear {customer_name}, You are hereby notified that payment of ${amount} is seriously overdue. Immediate payment is required to avoid legal action.",
      isActive: true,
      assignedToSegments: ["HIGH_RISK"],
      costPerMessage: 1.25,
    },
    {
      id: "T014",
      name: "Legal Notice Letter",
      type: "Letter",
      stage: "D+45",
      content:
        "LEGAL NOTICE: This is your final opportunity to resolve the outstanding debt of ${amount} before legal proceedings commence. Contact us immediately.",
      isActive: true,
      assignedToSegments: ["HIGH_RISK"],
      costPerMessage: 1.25,
    },

    // WhatsApp Templates
    {
      id: "T015",
      name: "WhatsApp Payment Reminder",
      type: "WhatsApp",
      stage: "D+2",
      content:
        "Hi {customer_name} 👋 Your payment of ${amount} is now 2 days overdue. Please pay to keep your account current. Need help? Reply to this message.",
      isActive: true,
      assignedToSegments: ["MEDIUM_RISK"],
      costPerMessage: 0.08,
    },
    {
      id: "T016",
      name: "WhatsApp Payment Plan Offer",
      type: "WhatsApp",
      stage: "D+10",
      content:
        "Hi {customer_name}, we can offer a payment plan for your ${amount} balance. Reply 'PLAN' to discuss options or 'PAY' to settle now.",
      isActive: true,
      assignedToSegments: ["MEDIUM_RISK", "HIGH_RISK"],
      costPerMessage: 0.08,
    },

    // In-App Message Templates
    {
      id: "T017",
      name: "In-App Payment Banner",
      type: "In-App",
      stage: "D+1",
      content:
        "Payment due: ${amount}. Tap here to pay securely and avoid late fees.",
      isActive: true,
      assignedToSegments: ["LOW_RISK", "MEDIUM_RISK"],
      costPerMessage: 0.0,
    },
    {
      id: "T018",
      name: "In-App Account Alert",
      type: "In-App",
      stage: "D+7",
      content:
        "Action required: Your account has an overdue balance of ${amount}. Pay now to maintain service.",
      isActive: true,
      assignedToSegments: ["MEDIUM_RISK", "HIGH_RISK"],
      costPerMessage: 0.0,
    },
  ]

  const enterpriseTemplates = [
    // Email Templates
    {
      id: "ENT_T001",
      name: "Contract Reminder - Professional",
      type: "Email",
      stage: "D+0",
      content:
        "Dear {customer_name}, As per our service agreement dated {contract_date}, payment of ${amount} is due today. Please remit payment to maintain service continuity. Contact your account manager {account_manager} for any questions.",
      isActive: true,
      assignedToSegments: ["LOW_RISK_ENT"],
      costPerMessage: 0.02,
    },
    {
      id: "ENT_T002",
      name: "Account Manager Notification",
      type: "Email",
      stage: "D+3",
      content:
        "Dear {customer_name}, Your account manager {account_manager} has been notified of the overdue amount of ${amount}. Please contact them directly at {account_manager_email} to discuss payment arrangements.",
      isActive: true,
      assignedToSegments: ["MEDIUM_RISK_ENT"],
      costPerMessage: 0.02,
    },
    {
      id: "ENT_T003",
      name: "Executive Escalation Notice",
      type: "Email",
      stage: "D+7",
      content:
        "Dear {customer_name}, Your account requires immediate attention. The overdue amount of ${amount} may impact our service level agreements. Our executive team has been notified. Please contact {account_manager} to resolve this matter urgently.",
      isActive: true,
      assignedToSegments: ["MEDIUM_RISK_ENT", "HIGH_RISK_ENT"],
      costPerMessage: 0.02,
    },
    {
      id: "ENT_T004",
      name: "Contract Review & Legal Notice",
      type: "Email",
      stage: "D+30",
      content:
        "IMPORTANT: Your account is significantly overdue (${amount}). This constitutes a material breach of our service agreement. Please arrange immediate payment to avoid contract termination and potential legal proceedings. Contact {account_manager} immediately.",
      isActive: true,
      assignedToSegments: ["HIGH_RISK_ENT"],
      costPerMessage: 0.02,
    },
    {
      id: "ENT_T005",
      name: "Service Suspension Warning",
      type: "Email",
      stage: "D+45",
      content:
        "FINAL NOTICE: Due to non-payment of ${amount}, we will suspend services in 7 days as per contract terms. This will impact your operations. Contact your account manager {account_manager} immediately to prevent service interruption.",
      isActive: true,
      assignedToSegments: ["HIGH_RISK_ENT"],
      costPerMessage: 0.02,
    },

    // SMS Templates for Account Managers
    {
      id: "ENT_T006",
      name: "Account Manager SMS Alert",
      type: "SMS",
      stage: "D+1",
      content:
        "Account Manager Alert: {customer_name} payment of ${amount} overdue. Immediate attention required.",
      isActive: true,
      assignedToSegments: ["MEDIUM_RISK_ENT", "HIGH_RISK_ENT"],
      characterCount: 98,
      costPerMessage: 0.05,
    },
    {
      id: "ENT_T007",
      name: "Executive SMS Notification",
      type: "SMS",
      stage: "D+5",
      content:
        "Executive Alert: High-value account {customer_name} - ${amount} overdue. Review required.",
      isActive: true,
      assignedToSegments: ["HIGH_RISK_ENT"],
      characterCount: 89,
      costPerMessage: 0.05,
    },

    // Phone Scripts for Enterprise
    {
      id: "ENT_T008",
      name: "Account Manager Direct Call",
      type: "Phone",
      stage: "D+2",
      content:
        "Hello {customer_name}, this is {account_manager} calling about your account. I see a payment of ${amount} that's overdue. Can we discuss resolution options?",
      isActive: true,
      assignedToSegments: ["MEDIUM_RISK_ENT"],
      estimatedDuration: "5-10 min",
      costPerMessage: 2.5,
    },
    {
      id: "ENT_T009",
      name: "Executive Escalation Call",
      type: "Phone",
      stage: "D+10",
      content:
        "This is {executive_name} from our executive team calling {customer_name}. Your ${amount} overdue balance requires immediate executive attention. Let's resolve this today.",
      isActive: true,
      assignedToSegments: ["HIGH_RISK_ENT"],
      estimatedDuration: "10-15 min",
      costPerMessage: 2.5,
    },
    {
      id: "ENT_T010",
      name: "Service Impact Discussion",
      type: "Phone",
      stage: "D+20",
      content:
        "Hello {customer_name}, this is regarding your ${amount} balance. We need to discuss potential service impacts and contract implications. When can we schedule a call?",
      isActive: true,
      assignedToSegments: ["HIGH_RISK_ENT"],
      estimatedDuration: "15-20 min",
      costPerMessage: 2.5,
    },

    // WhatsApp for Account Managers
    {
      id: "ENT_T011",
      name: "Account Manager WhatsApp",
      type: "WhatsApp",
      stage: "D+3",
      content:
        "Hi {customer_name}, this is {account_manager}. I see your ${amount} payment is overdue. Can we arrange payment today? I'm here to help.",
      isActive: true,
      assignedToSegments: ["MEDIUM_RISK_ENT"],
      costPerMessage: 0.08,
    },
    {
      id: "ENT_T012",
      name: "Executive WhatsApp Follow-up",
      type: "WhatsApp",
      stage: "D+7",
      content:
        "Dear {customer_name}, this is {executive_name}. Your account requires urgent attention. Please contact me directly to resolve the ${amount} balance.",
      isActive: true,
      assignedToSegments: ["HIGH_RISK_ENT"],
      costPerMessage: 0.08,
    },

    // Letter Templates for Enterprise
    {
      id: "ENT_T013",
      name: "Contract Breach Notice",
      type: "Letter",
      stage: "D+15",
      content:
        "NOTICE OF CONTRACT BREACH: Your failure to pay ${amount} by the due date constitutes a material breach of our service agreement. Immediate payment is required to avoid contract termination.",
      isActive: true,
      assignedToSegments: ["HIGH_RISK_ENT"],
      costPerMessage: 1.25,
    },
    {
      id: "ENT_T014",
      name: "Service Termination Notice",
      type: "Letter",
      stage: "D+30",
      content:
        "FINAL NOTICE OF SERVICE TERMINATION: Due to continued non-payment of ${amount}, services will be terminated in 14 days. This action may result in operational disruption to your business.",
      isActive: true,
      assignedToSegments: ["HIGH_RISK_ENT"],
      costPerMessage: 1.25,
    },

    // In-App Messages for Enterprise Portals
    {
      id: "ENT_T015",
      name: "Enterprise Portal Alert",
      type: "In-App",
      stage: "D+1",
      content:
        "Account Notice: Payment of ${amount} is overdue. Contact your account manager {account_manager} immediately.",
      isActive: true,
      assignedToSegments: ["MEDIUM_RISK_ENT", "HIGH_RISK_ENT"],
      costPerMessage: 0.0,
    },
    {
      id: "ENT_T016",
      name: "Service Impact Warning",
      type: "In-App",
      stage: "D+14",
      content:
        "URGENT: Overdue balance of ${amount} may impact service delivery. Immediate payment required to avoid disruption.",
      isActive: true,
      assignedToSegments: ["HIGH_RISK_ENT"],
      costPerMessage: 0.0,
    },
  ]

  const templates =
    customerType === "enterprise" ? enterpriseTemplates : normalTemplates

  // Filter templates by channel
  const filteredTemplates =
    channelFilter === "All"
      ? templates
      : templates.filter((template) => template.type === channelFilter)

  // Get unique channel types for filter options
  const channelTypes = [
    "All",
    ...Array.from(new Set(templates.map((t) => t.type))),
  ]

  // Enhanced campaign data with channel performance analytics
  const campaigns = [
    {
      id: "C001",
      name: "Daily Overdue Sweep",
      status: "active",
      lastRun: "2024-01-30 09:00",
      customersTargeted: 156,
      sentCount: 156,
      responseRate: "12%",
      riskSegmentBreakdown: {
        High: { targeted: 28, responded: 2 },
        Medium: { targeted: 83, responded: 12 },
        Low: { targeted: 45, responded: 7 },
      },
      recoveryAmount: 48500,
      channelBreakdown: {
        Email: {
          sent: 89,
          delivered: 86,
          responses: 8,
          recovery: 28500,
          cost: 445,
          avgResponseTime: "4.2h",
          deliveryRate: "96.6%",
          responseRate: "9.3%",
        },
        SMS: {
          sent: 52,
          delivered: 51,
          responses: 10,
          recovery: 15200,
          cost: 156,
          avgResponseTime: "1.8h",
          deliveryRate: "98.1%",
          responseRate: "19.6%",
        },
        Phone: {
          sent: 15,
          delivered: 12,
          responses: 3,
          recovery: 4800,
          cost: 225,
          avgResponseTime: "0.5h",
          deliveryRate: "80.0%",
          responseRate: "25.0%",
        },
      },
      totalCost: 826,
      roi: 5768,
    },
    {
      id: "C002",
      name: "Weekly Escalation",
      status: "active",
      lastRun: "2024-01-29 14:30",
      customersTargeted: 89,
      sentCount: 89,
      responseRate: "8%",
      riskSegmentBreakdown: {
        High: { targeted: 15, responded: 1 },
        Medium: { targeted: 54, responded: 5 },
        Low: { targeted: 20, responded: 1 },
      },
      recoveryAmount: 22100,
      channelBreakdown: {
        Email: {
          sent: 65,
          delivered: 62,
          responses: 4,
          recovery: 12800,
          cost: 325,
          avgResponseTime: "6.1h",
          deliveryRate: "95.4%",
          responseRate: "6.5%",
        },
        SMS: {
          sent: 24,
          delivered: 23,
          responses: 3,
          recovery: 9300,
          cost: 72,
          avgResponseTime: "2.3h",
          deliveryRate: "95.8%",
          responseRate: "13.0%",
        },
      },
      totalCost: 397,
      roi: 5468,
    },
    {
      id: "C003",
      name: "High Risk Intensive Campaign",
      status: "completed",
      lastRun: "2024-01-28 11:15",
      customersTargeted: 28,
      sentCount: 28,
      responseRate: "25%",
      riskSegmentBreakdown: {
        High: { targeted: 28, responded: 7 },
      },
      recoveryAmount: 18750,
      channelBreakdown: {
        Email: {
          sent: 28,
          delivered: 26,
          responses: 3,
          recovery: 8200,
          cost: 140,
          avgResponseTime: "8.5h",
          deliveryRate: "92.9%",
          responseRate: "11.5%",
        },
        Phone: {
          sent: 28,
          delivered: 22,
          responses: 4,
          recovery: 10550,
          cost: 420,
          avgResponseTime: "0.3h",
          deliveryRate: "78.6%",
          responseRate: "18.2%",
        },
      },
      totalCost: 560,
      roi: 3249,
    },
  ]

  // Use shared customer data filtered by customer type
  const filteredCustomers =
    customerType === "all"
      ? SHARED_CUSTOMERS
      : SHARED_CUSTOMERS.filter(
          (customer) => customer.customerType === customerType
        )

  const eligibleCustomers = filteredCustomers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    accountNumber: customer.id.replace("CUST", "ACC") + "123",
    balance: customer.totalOutstanding,
    daysPastDue:
      customer.overdueAmount > 0
        ? Math.floor(
            (new Date().getTime() -
              new Date(customer.lastPaymentDate).getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : 0,
    lastContact:
      customer.interactions.length > 0 ? customer.interactions[0].date : "N/A",
    riskBand:
      customer.riskBand.charAt(0).toUpperCase() + customer.riskBand.slice(1),
    riskScore:
      customer.riskBand === "high"
        ? 320
        : customer.riskBand === "medium"
        ? 650
        : 850,
    segment: customer.segment,
    customerType: customer.customerType,
    contractValue:
      customer.customerType === "enterprise"
        ? Math.floor(Math.random() * 200000) + 50000
        : null,
    accountManager:
      customer.customerType === "enterprise"
        ? ["Sarah Johnson", "Michael Chen", "Emily Rodriguez", "David Park"][
            Math.floor(Math.random() * 4)
          ]
        : null,
    slaCompliance:
      customer.customerType === "enterprise"
        ? Math.floor(Math.random() * 30) + 70
        : null,
    applicableRules:
      customer.riskBand === "high"
        ? customerType === "enterprise"
          ? ["ENT001", "ENT002"]
          : ["RULE001"]
        : customer.riskBand === "medium"
        ? customerType === "enterprise"
          ? ["ENT003", "ENT004"]
          : ["RULE002", "RULE003"]
        : customerType === "enterprise"
        ? ["ENT005"]
        : ["RULE004"],
  }))

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "SMS":
        return <MessageSquare className="w-4 h-4" />
      case "Email":
        return <Mail className="w-4 h-4" />
      case "Phone":
        return <Phone className="w-4 h-4" />
      case "Push":
        return <Smartphone className="w-4 h-4" />
      case "Letter":
        return <FileText className="w-4 h-4" />
      case "WhatsApp":
        return <MessageSquare className="w-4 h-4 text-green-600" />
      case "In-App":
        return <Globe className="w-4 h-4" />
      default:
        return <MessageSquare className="w-4 h-4" />
    }
  }

  const getStageColor = (stage: string) => {
    switch (stage) {
      case "D+0":
        return "default"
      case "D+3":
        return "outline"
      case "D+5":
        return "secondary"
      case "D+7":
        return "secondary"
      case "D+15":
        return "destructive"
      default:
        return "secondary"
    }
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default"
      case "active":
        return "secondary"
      case "pending":
        return "outline"
      case "failed":
        return "destructive"
      default:
        return "outline"
    }
  }

  const getRiskBadgeVariant = (risk: string) => {
    switch (risk.toLowerCase()) {
      case "high":
        return "destructive"
      case "medium":
        return "secondary"
      case "low":
        return "default"
      default:
        return "outline"
    }
  }

  const handleRiskSegmentSelect = (segmentId: string) => {
    setSelectedRiskSegments((prev) =>
      prev.includes(segmentId)
        ? prev.filter((id) => id !== segmentId)
        : [...prev, segmentId]
    )
  }

  const handleRiskRuleSelect = (ruleId: string) => {
    setSelectedRiskRules((prev) =>
      prev.includes(ruleId)
        ? prev.filter((id) => id !== ruleId)
        : [...prev, ruleId]
    )
  }

  // Advanced Rule Builder Functions
  const addCondition = () => {
    if (selectedParameter && selectedOperator && ruleValue) {
      const newCondition: RuleCondition = {
        id: Date.now().toString(),
        parameter: selectedParameter,
        operator: selectedOperator,
        value: ruleValue,
        connector: ruleConditions.length > 0 ? "AND" : undefined,
      }
      setRuleConditions([...ruleConditions, newCondition])
      setSelectedParameter("")
      setSelectedOperator("")
      setRuleValue("")
    }
  }

  const removeCondition = (id: string) => {
    setRuleConditions(ruleConditions.filter((condition) => condition.id !== id))
  }

  const updateConnector = (id: string, connector: "AND" | "OR") => {
    setRuleConditions(
      ruleConditions.map((condition) =>
        condition.id === id ? { ...condition, connector } : condition
      )
    )
  }

  const saveRule = () => {
    if (ruleName && ruleConditions.length > 0) {
      const conditionText = ruleConditions
        .map((condition, index) => {
          const paramName = ruleParameters.find(
            (p) => p.id === condition.parameter
          )?.name
          const opSymbol = operators.find(
            (o) => o.value === condition.operator
          )?.symbol
          const connector = index > 0 ? ` ${condition.connector} ` : ""
          return `${connector}${paramName} ${opSymbol} ${condition.value}`
        })
        .join("")

      const newRule = {
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
      }

      setCustomRules([...customRules, newRule])
      setRuleJustSaved(newRule.id)

      // Show success toast
      toast({
        title: "Rule Created Successfully",
        description: `"${ruleName}" has been saved and is ready for template assignment.`,
      })

      resetRuleBuilder()

      // Navigate to template assignment after a short delay
      setTimeout(() => {
        setActiveTab("template-assignment")
      }, 1500)
    }
  }

  const resetRuleBuilder = () => {
    setRuleName("")
    setRuleConditions([])
    setSelectedParameter("")
    setSelectedOperator("")
    setRuleValue("")
    setSelectedRiskBand("medium")
    setRuleWeight("30")
    // Clear the "just saved" indicator after some time
    setTimeout(() => setRuleJustSaved(null), 3000)
  }

  // Combine default rules with custom rules
  const allRiskRules = [...riskRules, ...customRules]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">
            {customerType === "enterprise"
              ? "Enterprise Campaign Summary"
              : "Campaign Summary"}
          </h2>
          {customerType === "enterprise" && (
            <p className="text-muted-foreground mt-1">
              Contract-focused collection strategies for enterprise accounts
            </p>
          )}
          <p className="text-muted-foreground">
            Risk-based automated communication and collection management
          </p>
        </div>
        <Button className="flex items-center space-x-2 bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="w-4 h-4" />
          <span>New Recovery Strategies</span>
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="campaigns">Campaigns & Results</TabsTrigger>
          <TabsTrigger value="target-selection">Target Selection</TabsTrigger>
          <TabsTrigger value="template-assignment">
            Template Assignment
          </TabsTrigger>
          <TabsTrigger value="ab-testing">A/B Testing</TabsTrigger>
          <TabsTrigger value="what-if">What-If Analysis</TabsTrigger>
          <TabsTrigger value="schedule-timing">Schedule & Timing</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        {/* TAB 1: Campaigns & Results */}
        <TabsContent value="campaigns" className="space-y-6">
          {/* Performance Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Campaigns
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">3</div>
                <p className="text-xs text-muted-foreground">
                  +1 from last week
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Recovery
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">$89.4k</div>
                <p className="text-xs text-muted-foreground">
                  +12.3% from last month
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Response Rate
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">15.2%</div>
                <p className="text-xs text-muted-foreground">
                  +2.1% from last month
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Customers Processed
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">273</div>
                <p className="text-xs text-muted-foreground">This month</p>
              </CardContent>
            </Card>
          </div>

          {/* Channel Performance Analytics */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Email Performance
                </CardTitle>
                <Mail className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">8.9%</div>
                <p className="text-xs text-muted-foreground">
                  Avg Response Rate
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="font-medium">$49.5k</div>
                    <div className="text-muted-foreground">Recovery</div>
                  </div>
                  <div>
                    <div className="font-medium">96.3%</div>
                    <div className="text-muted-foreground">Delivery</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  SMS Performance
                </CardTitle>
                <Smartphone className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">16.1%</div>
                <p className="text-xs text-muted-foreground">
                  Avg Response Rate
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="font-medium">$24.5k</div>
                    <div className="text-muted-foreground">Recovery</div>
                  </div>
                  <div>
                    <div className="font-medium">97.0%</div>
                    <div className="text-muted-foreground">Delivery</div>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Phone Performance
                </CardTitle>
                <Phone className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">21.6%</div>
                <p className="text-xs text-muted-foreground">
                  Avg Response Rate
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="font-medium">$15.4k</div>
                    <div className="text-muted-foreground">Recovery</div>
                  </div>
                  <div>
                    <div className="font-medium">79.3%</div>
                    <div className="text-muted-foreground">Delivery</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Channel Performance Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Channel ROI Analysis</CardTitle>
                <CardDescription>
                  Return on investment by communication channel
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Phone className="w-5 h-5 text-blue-500" />
                      <div>
                        <p className="font-medium">Phone</p>
                        <p className="text-sm text-muted-foreground">
                          High-touch personal contact
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">
                        2,387%
                      </div>
                      <div className="text-xs text-muted-foreground">ROI</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Smartphone className="w-5 h-5 text-green-500" />
                      <div>
                        <p className="font-medium">SMS</p>
                        <p className="text-sm text-muted-foreground">
                          Quick instant messaging
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">
                        10,737%
                      </div>
                      <div className="text-xs text-muted-foreground">ROI</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-secondary/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Mail className="w-5 h-5 text-orange-500" />
                      <div>
                        <p className="font-medium">Email</p>
                        <p className="text-sm text-muted-foreground">
                          Detailed formal communication
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-green-600">
                        5,385%
                      </div>
                      <div className="text-xs text-muted-foreground">ROI</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Channel Response Insights</CardTitle>
                <CardDescription>
                  Customer response patterns by channel
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">
                        SMS - Fastest Response
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Avg: 2.1h
                      </span>
                    </div>
                    <Progress value={85} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">
                        Phone - Immediate Response
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Avg: 0.4h
                      </span>
                    </div>
                    <Progress value={95} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">
                        Email - Delayed Response
                      </span>
                      <span className="text-sm text-muted-foreground">
                        Avg: 6.3h
                      </span>
                    </div>
                    <Progress value={45} className="h-2" />
                  </div>
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-2">
                      <Brain className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">
                        AI Insight
                      </span>
                    </div>
                    <p className="text-xs text-blue-700 mt-1">
                      Customers respond 65% faster to SMS than email. Consider
                      SMS-first approach for urgent collections.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Campaigns Table */}
          <Card>
            <CardHeader>
              <CardTitle>Campaign Performance</CardTitle>
              <CardDescription>
                Monitor campaign effectiveness by risk segment and communication
                channel
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Run</TableHead>
                    <TableHead>Customers</TableHead>
                    <TableHead>Response Rate</TableHead>
                    <TableHead>Recovery</TableHead>
                    <TableHead>Best Channel</TableHead>
                    <TableHead>ROI</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {campaigns.map((campaign) => {
                    // Calculate best performing channel
                    const channels = Object.entries(
                      campaign.channelBreakdown || {}
                    )
                    const bestChannel = channels.reduce<{
                      channel: string
                      data: any
                    } | null>((best, [channel, data]) => {
                      const responseRate = (data.responses / data.sent) * 100
                      const bestResponseRate = best
                        ? (best.data.responses / best.data.sent) * 100
                        : 0
                      return responseRate > bestResponseRate
                        ? { channel, data }
                        : best
                    }, null)

                    return (
                      <TableRow key={campaign.id}>
                        <TableCell className="font-medium">
                          {campaign.name}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={getStatusBadgeVariant(campaign.status)}
                          >
                            {campaign.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{campaign.lastRun}</TableCell>
                        <TableCell>{campaign.customersTargeted}</TableCell>
                        <TableCell>{campaign.responseRate}</TableCell>
                        <TableCell>
                          ${campaign.recoveryAmount.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {bestChannel && (
                            <div className="flex items-center space-x-2">
                              {bestChannel.channel === "Email" && (
                                <Mail className="w-4 h-4 text-orange-500" />
                              )}
                              {bestChannel.channel === "SMS" && (
                                <Smartphone className="w-4 h-4 text-green-500" />
                              )}
                              {bestChannel.channel === "Phone" && (
                                <Phone className="w-4 h-4 text-blue-500" />
                              )}
                              <span className="text-sm font-medium">
                                {bestChannel.channel}
                              </span>
                              <Badge variant="secondary" className="text-xs">
                                {(
                                  (bestChannel.data.responses /
                                    bestChannel.data.sent) *
                                  100
                                ).toFixed(1)}
                                %
                              </Badge>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-green-600 font-medium">
                            {(
                              (campaign.recoveryAmount /
                                (campaign.totalCost || 1)) *
                              100
                            ).toFixed(0)}
                            %
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button variant="outline" size="sm">
                              <BarChart3 className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm">
                              <Settings className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Detailed Channel Performance Matrix */}
          <Card>
            <CardHeader>
              <CardTitle>Channel Performance Matrix</CardTitle>
              <CardDescription>
                Detailed breakdown of communication channel effectiveness across
                all campaigns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Campaign</TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <Mail className="w-4 h-4" />
                          <span>Email</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <Smartphone className="w-4 h-4" />
                          <span>SMS</span>
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex items-center justify-center space-x-1">
                          <Phone className="w-4 h-4" />
                          <span>Phone</span>
                        </div>
                      </TableHead>
                      <TableHead>Total Recovery</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns.map((campaign) => (
                      <TableRow key={campaign.id}>
                        <TableCell className="font-medium">
                          {campaign.name}
                        </TableCell>
                        <TableCell className="text-center">
                          {campaign.channelBreakdown?.Email ? (
                            <div className="space-y-1">
                              <div className="text-sm font-medium">
                                {campaign.channelBreakdown.Email.responseRate}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                $
                                {campaign.channelBreakdown.Email.recovery.toLocaleString()}
                              </div>
                              <div className="text-xs text-green-600">
                                {campaign.channelBreakdown.Email.sent} sent
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {campaign.channelBreakdown?.SMS ? (
                            <div className="space-y-1">
                              <div className="text-sm font-medium">
                                {campaign.channelBreakdown.SMS.responseRate}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                $
                                {campaign.channelBreakdown.SMS.recovery.toLocaleString()}
                              </div>
                              <div className="text-xs text-green-600">
                                {campaign.channelBreakdown.SMS.sent} sent
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {campaign.channelBreakdown?.Phone ? (
                            <div className="space-y-1">
                              <div className="text-sm font-medium">
                                {campaign.channelBreakdown.Phone.responseRate}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                $
                                {campaign.channelBreakdown.Phone.recovery.toLocaleString()}
                              </div>
                              <div className="text-xs text-green-600">
                                {campaign.channelBreakdown.Phone.sent} sent
                              </div>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="text-right">
                            <div className="text-lg font-medium">
                              ${campaign.recoveryAmount.toLocaleString()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Cost: $
                              {(campaign.totalCost || 0).toLocaleString()}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: Target Selection */}
        <TabsContent value="target-selection" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Risk Segments */}
            <Card>
              <CardHeader>
                <CardTitle>Risk Segments</CardTitle>
                <CardDescription>
                  Select customer segments for targeting
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {riskSegments.map((segment) => (
                    <div
                      key={segment.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedRiskSegments.includes(segment.id)
                          ? "bg-primary/10 border-primary"
                          : "hover:bg-secondary/50"
                      }`}
                      onClick={() => handleRiskSegmentSelect(segment.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            checked={selectedRiskSegments.includes(segment.id)}
                            onChange={() => {}}
                          />
                          <div>
                            <p className="font-medium">{segment.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {segment.description}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={segment.color as any}>
                            {segment.customerCount}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            Avg: ${segment.avgOutstanding}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Risk Rules */}
            <Card>
              <CardHeader>
                <CardTitle>Risk-Based Rules</CardTitle>
                <CardDescription>
                  Custom rules from Campaigns Summary
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {allRiskRules.map((rule) => (
                    <div
                      key={rule.id}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        selectedRiskRules.includes(rule.id)
                          ? "bg-primary/10 border-primary"
                          : "hover:bg-secondary/50"
                      }`}
                      onClick={() => handleRiskRuleSelect(rule.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            checked={selectedRiskRules.includes(rule.id)}
                            onChange={() => {}}
                          />
                          <div>
                            <p className="font-medium">{rule.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {rule.condition}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={getRiskBadgeVariant(rule.riskBand)}>
                            {rule.riskBand}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {rule.eligibleCustomers} eligible
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Custom Rules Display */}
          {customRules.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <span>Created Custom Rules</span>
                </CardTitle>
                <CardDescription>
                  Your recently created rules - ready for template assignment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {customRules.map((rule) => (
                    <div
                      key={rule.id}
                      className={`p-4 border rounded-lg transition-colors ${
                        ruleJustSaved === rule.id
                          ? "bg-green-50 border-green-200 ring-2 ring-green-100"
                          : selectedRiskRules.includes(rule.id)
                          ? "bg-primary/10 border-primary"
                          : "hover:bg-secondary/50"
                      } cursor-pointer`}
                      onClick={() => handleRiskRuleSelect(rule.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            checked={selectedRiskRules.includes(rule.id)}
                            onChange={() => {}}
                          />
                          <div>
                            <div className="flex items-center space-x-2">
                              <p className="font-medium">{rule.name}</p>
                              {ruleJustSaved === rule.id && (
                                <Badge
                                  variant="default"
                                  className="text-xs bg-green-100 text-green-800"
                                >
                                  New
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {rule.condition}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={getRiskBadgeVariant(rule.riskBand)}>
                            {rule.riskBand}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {rule.eligibleCustomers} eligible
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    Select rules to assign templates in the next step
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => setActiveTab("template-assignment")}
                    className="flex items-center space-x-2"
                  >
                    <span>Assign Templates</span>
                    <Edit className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Advanced Rule Creator */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Brain className="w-5 h-5" />
                <span>Advanced Rule Creator</span>
              </CardTitle>
              <CardDescription>
                Build custom targeting rules with multiple conditions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Rule Builder */}
                <div className="space-y-4">
                  <div>
                    <Label>Rule Name</Label>
                    <Input
                      value={ruleName}
                      onChange={(e) => setRuleName(e.target.value)}
                      placeholder="e.g., High Value Overdue Customers"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Risk Band</Label>
                      <Select
                        value={selectedRiskBand}
                        onValueChange={setSelectedRiskBand}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Low Risk</SelectItem>
                          <SelectItem value="medium">Medium Risk</SelectItem>
                          <SelectItem value="high">High Risk</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Weight</Label>
                      <Input
                        value={ruleWeight}
                        onChange={(e) => setRuleWeight(e.target.value)}
                        placeholder="30"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label>Add Conditions</Label>
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-4">
                        <Select
                          value={selectedParameter}
                          onValueChange={setSelectedParameter}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Parameter" />
                          </SelectTrigger>
                          <SelectContent>
                            {ruleParameters.map((param) => (
                              <SelectItem key={param.id} value={param.id}>
                                {param.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-3">
                        <Select
                          value={selectedOperator}
                          onValueChange={setSelectedOperator}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Operator" />
                          </SelectTrigger>
                          <SelectContent>
                            {operators.map((op) => (
                              <SelectItem key={op.value} value={op.value}>
                                {op.symbol} {op.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-3">
                        <Input
                          value={ruleValue}
                          onChange={(e) => setRuleValue(e.target.value)}
                          placeholder="Value"
                        />
                      </div>
                      <div className="col-span-2">
                        <Button
                          onClick={addCondition}
                          disabled={
                            !selectedParameter ||
                            !selectedOperator ||
                            !ruleValue
                          }
                          className="w-full"
                        >
                          <Plus className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Conditions List */}
                  {ruleConditions.length > 0 && (
                    <div className="space-y-2">
                      <Label>Current Conditions</Label>
                      {ruleConditions.map((condition, index) => (
                        <div
                          key={condition.id}
                          className="flex items-center space-x-2 p-2 border rounded"
                        >
                          {index > 0 && (
                            <Select
                              value={condition.connector}
                              onValueChange={(value) =>
                                updateConnector(
                                  condition.id,
                                  value as "AND" | "OR"
                                )
                              }
                            >
                              <SelectTrigger className="w-20">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="AND">AND</SelectItem>
                                <SelectItem value="OR">OR</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                          <span className="text-sm flex-1">
                            {
                              ruleParameters.find(
                                (p) => p.id === condition.parameter
                              )?.name
                            }{" "}
                            {
                              operators.find(
                                (o) => o.value === condition.operator
                              )?.symbol
                            }{" "}
                            {condition.value}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => removeCondition(condition.id)}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex space-x-2">
                    <Button
                      onClick={saveRule}
                      disabled={!ruleName || ruleConditions.length === 0}
                      className="flex items-center space-x-2"
                    >
                      <Save className="w-4 h-4" />
                      <span>Save Rule</span>
                    </Button>
                    <Button variant="outline" onClick={resetRuleBuilder}>
                      Reset
                    </Button>
                  </div>
                </div>

                {/* Rule Preview */}
                <div className="space-y-4">
                  <div>
                    <Label>Rule Preview</Label>
                    <div className="p-4 border rounded-lg bg-secondary/10">
                      {ruleName ? (
                        <div>
                          <p className="font-medium">{ruleName}</p>
                          <Badge
                            variant={getRiskBadgeVariant(selectedRiskBand)}
                            className="my-2"
                          >
                            {selectedRiskBand} Risk
                          </Badge>
                          {ruleConditions.length > 0 && (
                            <p className="text-sm text-muted-foreground mt-2">
                              {ruleConditions
                                .map((condition, index) => {
                                  const paramName = ruleParameters.find(
                                    (p) => p.id === condition.parameter
                                  )?.name
                                  const opSymbol = operators.find(
                                    (o) => o.value === condition.operator
                                  )?.symbol
                                  const connector =
                                    index > 0 ? ` ${condition.connector} ` : ""
                                  return `${connector}${paramName} ${opSymbol} ${condition.value}`
                                })
                                .join("")}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="text-muted-foreground">
                          Start building your rule...
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label>Estimated Impact</Label>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center p-2 bg-secondary/10 rounded">
                        <span className="text-sm">Eligible Customers</span>
                        <Badge variant="outline">
                          ~{Math.floor(Math.random() * 50) + 5}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center p-2 bg-secondary/10 rounded">
                        <span className="text-sm">Est. Recovery</span>
                        <Badge variant="outline">
                          $
                          {(
                            Math.floor(Math.random() * 50000) + 10000
                          ).toLocaleString()}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: Template Assignment */}
        <TabsContent value="template-assignment" className="space-y-6">
          {/* Selected Segments Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Selected Target Segments</CardTitle>
              <CardDescription>
                Segments selected in Target Selection - assign templates to
                these segments
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedRiskSegments.length === 0 &&
              selectedRiskRules.length === 0 ? (
                <div className="text-center py-8">
                  <Target className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No segments selected</p>
                  <p className="text-sm text-muted-foreground">
                    Go to Target Selection to choose risk segments first
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedRiskSegments.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium">
                        Selected Risk Segments
                      </Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {riskSegments
                          .filter((segment) =>
                            selectedRiskSegments.includes(segment.id)
                          )
                          .map((segment) => (
                            <Badge
                              key={segment.id}
                              variant={segment.color as any}
                            >
                              {segment.name} ({segment.customerCount} customers)
                            </Badge>
                          ))}
                      </div>
                    </div>
                  )}

                  {selectedRiskRules.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium">
                        Selected Rules
                      </Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {allRiskRules
                          .filter((rule) => selectedRiskRules.includes(rule.id))
                          .map((rule) => (
                            <Badge
                              key={rule.id}
                              variant={getRiskBadgeVariant(rule.riskBand)}
                            >
                              {rule.name} ({rule.eligibleCustomers} eligible)
                            </Badge>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {(selectedRiskSegments.length > 0 ||
            selectedRiskRules.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Template List */}
              <Card>
                <CardHeader>
                  <CardTitle>Communication Templates</CardTitle>
                  <CardDescription>
                    Select templates to assign to your target segments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Channel Filter */}
                  <div className="mb-4">
                    <Label className="text-sm font-medium mb-2 block">
                      Filter by Channel
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {channelTypes.map((channel) => (
                        <Button
                          key={channel}
                          variant={
                            channelFilter === channel ? "default" : "outline"
                          }
                          size="sm"
                          onClick={() => setChannelFilter(channel)}
                          className="flex items-center space-x-1"
                        >
                          {channel !== "All" && getTypeIcon(channel)}
                          <span>{channel}</span>
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {filteredTemplates.map((template) => (
                      <div
                        key={template.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedTemplate?.id === template.id
                            ? "bg-primary/10 border-primary"
                            : "hover:bg-secondary/50"
                        }`}
                        onClick={() => setSelectedTemplate(template)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {getTypeIcon(template.type)}
                            <div>
                              <p className="font-medium text-foreground">
                                {template.name}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {template.type} • {template.stage}
                                {template.costPerMessage && (
                                  <span> • ${template.costPerMessage}/msg</span>
                                )}
                                {template.characterCount && (
                                  <span>
                                    {" "}
                                    • {template.characterCount} chars
                                  </span>
                                )}
                                {template.estimatedDuration && (
                                  <span> • {template.estimatedDuration}</span>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Badge variant={getStageColor(template.stage)}>
                              {template.stage}
                            </Badge>
                            <Badge
                              variant={
                                template.isActive ? "default" : "secondary"
                              }
                            >
                              {template.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Template Assignment */}
              <Card>
                <CardHeader>
                  <CardTitle>Assign Template</CardTitle>
                  <CardDescription>
                    {selectedTemplate
                      ? `Assign "${selectedTemplate.name}" to selected segments`
                      : "Select a template to assign"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {selectedTemplate ? (
                    <div className="space-y-4">
                      <div className="p-4 bg-secondary/10 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                          {getTypeIcon(selectedTemplate.type)}
                          <span className="font-medium">
                            {selectedTemplate.name}
                          </span>
                          <Badge
                            variant={getStageColor(selectedTemplate.stage)}
                          >
                            {selectedTemplate.stage}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {selectedTemplate.content}
                        </p>
                      </div>

                      <div className="space-y-4">
                        <Label>Assign to selected targets:</Label>

                        {selectedRiskSegments.length > 0 && (
                          <div>
                            <Label className="text-sm text-muted-foreground">
                              Risk Segments
                            </Label>
                            <div className="space-y-2 mt-2">
                              {riskSegments
                                .filter((segment) =>
                                  selectedRiskSegments.includes(segment.id)
                                )
                                .map((segment) => (
                                  <div
                                    key={segment.id}
                                    className="flex items-center justify-between p-3 border rounded-lg"
                                  >
                                    <div className="flex items-center space-x-3">
                                      <Checkbox
                                        id={`assign-${segment.id}`}
                                        defaultChecked={selectedTemplate.assignedToSegments.includes(
                                          segment.id
                                        )}
                                      />
                                      <div>
                                        <p className="font-medium">
                                          {segment.name}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {segment.customerCount} customers
                                        </p>
                                      </div>
                                    </div>
                                    <Badge variant={segment.color as any}>
                                      ${segment.avgOutstanding} avg
                                    </Badge>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {selectedRiskRules.length > 0 && (
                          <div>
                            <Label className="text-sm text-muted-foreground">
                              Custom Rules
                            </Label>
                            <div className="space-y-2 mt-2">
                              {allRiskRules
                                .filter((rule) =>
                                  selectedRiskRules.includes(rule.id)
                                )
                                .map((rule) => (
                                  <div
                                    key={rule.id}
                                    className="flex items-center justify-between p-3 border rounded-lg"
                                  >
                                    <div className="flex items-center space-x-3">
                                      <Checkbox
                                        id={`assign-rule-${rule.id}`}
                                        defaultChecked={false}
                                      />
                                      <div>
                                        <div className="flex items-center space-x-2">
                                          <p className="font-medium">
                                            {rule.name}
                                          </p>
                                          {customRules.find(
                                            (cr) => cr.id === rule.id
                                          ) && (
                                            <Badge
                                              variant="outline"
                                              className="text-xs"
                                            >
                                              Custom
                                            </Badge>
                                          )}
                                        </div>
                                        <p className="text-xs text-muted-foreground truncate max-w-xs">
                                          {rule.condition}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <Badge
                                        variant={getRiskBadgeVariant(
                                          rule.riskBand
                                        )}
                                      >
                                        {rule.riskBand}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">
                                        {rule.eligibleCustomers}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        <div className="flex space-x-2">
                          <Button
                            className="flex items-center space-x-2"
                            onClick={() => {
                              toast({
                                title: "Template Assigned Successfully",
                                description: `"${selectedTemplate.name}" has been assigned to selected targets.`,
                              })
                            }}
                          >
                            <Edit className="w-4 h-4" />
                            <span>Assign Template</span>
                          </Button>
                          <Button variant="outline">Preview</Button>
                          <Dialog open={ptpDialog} onOpenChange={setPtpDialog}>
                            <DialogTrigger asChild>
                              <Button
                                variant="outline"
                                className="flex items-center space-x-2"
                                onClick={() => {
                                  // Pre-select first customer from targeted segments for quick PTP creation
                                  const firstCustomer = eligibleCustomers.find(
                                    (customer) =>
                                      selectedRiskSegments.some(
                                        (segmentId) =>
                                          customer.riskBand.toLowerCase() ===
                                          segmentId
                                            .toLowerCase()
                                            .replace("_risk", "")
                                      )
                                  )
                                  setSelectedPtpCustomer(firstCustomer || null)
                                }}
                              >
                                <DollarSign className="w-4 h-4" />
                                <span>Create PTP</span>
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl">
                              <DialogHeader>
                                <DialogTitle>Create Promise to Pay</DialogTitle>
                                <DialogDescription>
                                  Create a payment commitment from dunning
                                  campaign: "{selectedTemplate.name}"
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>Customer</Label>
                                    <Select
                                      defaultValue={selectedPtpCustomer?.id}
                                      onValueChange={(value) => {
                                        const customer = eligibleCustomers.find(
                                          (c) => c.id === value
                                        )
                                        setSelectedPtpCustomer(customer)
                                      }}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Select customer" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {eligibleCustomers
                                          .filter(
                                            (customer) =>
                                              selectedRiskSegments.some(
                                                (segmentId) =>
                                                  customer.riskBand.toLowerCase() ===
                                                  segmentId
                                                    .toLowerCase()
                                                    .replace("_risk", "")
                                              ) ||
                                              customer.applicableRules.some(
                                                (ruleId) =>
                                                  selectedRiskRules.includes(
                                                    ruleId
                                                  )
                                              )
                                          )
                                          .map((customer) => (
                                            <SelectItem
                                              key={customer.id}
                                              value={customer.id}
                                            >
                                              {customer.name} - $
                                              {customer.balance} outstanding
                                            </SelectItem>
                                          ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div>
                                    <Label>Outstanding Balance</Label>
                                    <Input
                                      value={
                                        selectedPtpCustomer
                                          ? `$${selectedPtpCustomer.balance}`
                                          : ""
                                      }
                                      readOnly
                                      className="bg-secondary/20"
                                    />
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>Committed Amount</Label>
                                    <Input
                                      type="number"
                                      placeholder="Enter commitment amount"
                                      defaultValue={
                                        selectedPtpCustomer
                                          ? Math.floor(
                                              selectedPtpCustomer.balance * 0.5
                                            )
                                          : ""
                                      }
                                    />
                                  </div>
                                  <div>
                                    <Label>Due Date</Label>
                                    <Input
                                      type="date"
                                      defaultValue={
                                        new Date(
                                          Date.now() + 14 * 24 * 60 * 60 * 1000
                                        )
                                          .toISOString()
                                          .split("T")[0]
                                      }
                                    />
                                  </div>
                                </div>

                                <div>
                                  <Label>Campaign Reference</Label>
                                  <Input
                                    value={`Dunning Campaign: ${selectedTemplate.name} (${selectedTemplate.stage})`}
                                    readOnly
                                    className="bg-secondary/20"
                                  />
                                </div>

                                <div>
                                  <Label>Remarks</Label>
                                  <Textarea
                                    placeholder="Enter payment arrangement details..."
                                    defaultValue={`PTP created from dunning template "${selectedTemplate.name}". Customer contacted via ${selectedTemplate.type}.`}
                                  />
                                </div>

                                <div className="flex space-x-2">
                                  <Button
                                    className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                                    onClick={() => {
                                      toast({
                                        title: "PTP Created Successfully",
                                        description: `Promise to Pay created for ${
                                          selectedPtpCustomer?.name ||
                                          "selected customer"
                                        } from dunning campaign.`,
                                      })
                                      setPtpDialog(false)
                                    }}
                                  >
                                    Create PTP
                                  </Button>
                                  <Button
                                    variant="outline"
                                    onClick={() => setPtpDialog(false)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        Select a template to assign
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* TAB 4: A/B Testing */}
        <TabsContent value="ab-testing" className="space-y-6">
          {/* A/B Testing Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Tests
                </CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currentTests.filter((t) => t.status === "running").length}
                </div>
                <p className="text-xs text-muted-foreground">
                  Currently running
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Statistical Confidence
                </CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currentTests.length > 0 ? currentTests[0].confidence : "0%"}
                </div>
                <p className="text-xs text-muted-foreground">
                  Current test confidence
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Test Participants
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {currentTests.length > 0
                    ? currentTests[0].variants.reduce(
                        (sum, v) => sum + v.customers,
                        0
                      )
                    : 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  Total customers in tests
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Current Tests */}
          {currentTests.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Active A/B Tests</CardTitle>
                <CardDescription>
                  Monitor ongoing tests and their performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                {currentTests.map((test) => (
                  <div
                    key={test.id}
                    className="border rounded-lg p-4 space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">{test.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {test.startDate} - {test.endDate}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge
                          variant={
                            test.status === "running" ? "default" : "secondary"
                          }
                        >
                          {test.status}
                        </Badge>
                        <Badge variant="outline">
                          {test.confidence} confident
                        </Badge>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span>Statistical Significance</span>
                        <span>{test.confidence}</span>
                      </div>
                      <Progress
                        value={parseFloat(test.confidence)}
                        className="h-2"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {test.variants.map((variant, index) => (
                        <div key={variant.id} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">
                              Variant {variant.id}: {variant.name}
                            </span>
                            {test.winner === variant.id && (
                              <Badge variant="default">Winner</Badge>
                            )}
                          </div>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Customers:</span>
                              <span>{variant.customers}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Responses:</span>
                              <span>{variant.responses}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Response Rate:</span>
                              <span>
                                {(
                                  (variant.responses / variant.customers) *
                                  100
                                ).toFixed(1)}
                                %
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Recovery:</span>
                              <span>${variant.recovery.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Cost per Response:</span>
                              <span>
                                ${(variant.cost / variant.responses).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex justify-end space-x-2">
                      <Button variant="outline" size="sm">
                        View Details
                      </Button>
                      {test.status === "running" &&
                        parseFloat(test.confidence) >= 95 && (
                          <Button
                            size="sm"
                            onClick={() => {
                              toast({
                                title: "Test Concluded",
                                description:
                                  "Winner has been determined with 95% confidence.",
                              })
                            }}
                          >
                            Conclude Test
                          </Button>
                        )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Create New A/B Test */}
          <Card>
            <CardHeader>
              <CardTitle>Create New A/B Test</CardTitle>
              <CardDescription>
                Test different communication channels and templates to optimize
                your dunning strategy
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Test Configuration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="test-name">Test Name</Label>
                  <Input
                    id="test-name"
                    placeholder="e.g., Email vs SMS Response Test"
                    value={abTestName}
                    onChange={(e) => setAbTestName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="confidence-level">Confidence Level</Label>
                  <Select
                    value={confidenceLevel}
                    onValueChange={setConfidenceLevel}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="90">90%</SelectItem>
                      <SelectItem value="95">95%</SelectItem>
                      <SelectItem value="99">99%</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="test-description">Test Description</Label>
                <Textarea
                  id="test-description"
                  placeholder="Describe what you want to test and your hypothesis..."
                  value={abTestDescription}
                  onChange={(e) => setAbTestDescription(e.target.value)}
                  rows={3}
                />
              </div>

              {/* Test Duration */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={testDuration.start}
                    onChange={(e) =>
                      setTestDuration((prev) => ({
                        ...prev,
                        start: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="end-date">End Date</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={testDuration.end}
                    onChange={(e) =>
                      setTestDuration((prev) => ({
                        ...prev,
                        end: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              {/* Success Metrics */}
              <div>
                <Label>Primary Success Metric</Label>
                <Select value={primaryMetric} onValueChange={setPrimaryMetric}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="response_rate">Response Rate</SelectItem>
                    <SelectItem value="recovery_amount">
                      Recovery Amount
                    </SelectItem>
                    <SelectItem value="contact_success">
                      Contact Success Rate
                    </SelectItem>
                    <SelectItem value="cost_per_response">
                      Cost per Response
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Test Variants */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Test Variants</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (testVariants.length < 4) {
                        const newVariant = {
                          id: String.fromCharCode(65 + testVariants.length),
                          name: `Variant ${String.fromCharCode(
                            65 + testVariants.length
                          )}`,
                          channel: "Email",
                          template: "",
                          split: Math.floor(100 / (testVariants.length + 1)),
                          color: ["blue", "green", "purple", "orange"][
                            testVariants.length
                          ],
                        }
                        setTestVariants([...testVariants, newVariant])
                      }
                    }}
                    disabled={testVariants.length >= 4}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Variant
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {testVariants.map((variant, index) => (
                    <div
                      key={variant.id}
                      className="border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <Label className="font-medium">
                          Variant {variant.id}
                        </Label>
                        {testVariants.length > 2 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setTestVariants(
                                testVariants.filter((v) => v.id !== variant.id)
                              )
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>

                      <div>
                        <Label htmlFor={`variant-name-${variant.id}`}>
                          Variant Name
                        </Label>
                        <Input
                          id={`variant-name-${variant.id}`}
                          value={variant.name}
                          onChange={(e) => {
                            setTestVariants(
                              testVariants.map((v) =>
                                v.id === variant.id
                                  ? { ...v, name: e.target.value }
                                  : v
                              )
                            )
                          }}
                        />
                      </div>

                      <div>
                        <Label htmlFor={`variant-channel-${variant.id}`}>
                          Communication Channel
                        </Label>
                        <Select
                          value={variant.channel}
                          onValueChange={(value) => {
                            setTestVariants(
                              testVariants.map((v) =>
                                v.id === variant.id
                                  ? { ...v, channel: value }
                                  : v
                              )
                            )
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Email">
                              <div className="flex items-center space-x-2">
                                <Mail className="w-4 h-4" />
                                <span>Email</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="SMS">
                              <div className="flex items-center space-x-2">
                                <MessageSquare className="w-4 h-4" />
                                <span>SMS</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="Phone">
                              <div className="flex items-center space-x-2">
                                <Phone className="w-4 h-4" />
                                <span>Phone</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="Email+SMS">
                              <div className="flex items-center space-x-2">
                                <Mail className="w-4 h-4" />
                                <MessageSquare className="w-4 h-4" />
                                <span>Email + SMS</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor={`variant-template-${variant.id}`}>
                          Template
                        </Label>
                        <Select
                          value={variant.template}
                          onValueChange={(value) => {
                            setTestVariants(
                              testVariants.map((v) =>
                                v.id === variant.id
                                  ? { ...v, template: value }
                                  : v
                              )
                            )
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select template" />
                          </SelectTrigger>
                          <SelectContent>
                            {templates
                              .filter(
                                (t) =>
                                  t.type === variant.channel ||
                                  variant.channel === "Email+SMS"
                              )
                              .map((template) => (
                                <SelectItem
                                  key={template.id}
                                  value={template.id}
                                >
                                  {template.name} ({template.stage})
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <Label htmlFor={`variant-split-${variant.id}`}>
                          Traffic Split %
                        </Label>
                        <Input
                          id={`variant-split-${variant.id}`}
                          type="number"
                          min="1"
                          max="100"
                          value={variant.split}
                          onChange={(e) => {
                            setTestVariants(
                              testVariants.map((v) =>
                                v.id === variant.id
                                  ? {
                                      ...v,
                                      split: parseInt(e.target.value) || 0,
                                    }
                                  : v
                              )
                            )
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Traffic Split Validation */}
                <div className="p-3 bg-secondary/10 rounded-lg">
                  <div className="flex items-center justify-between text-sm">
                    <span>Total Traffic Split:</span>
                    <span
                      className={`font-medium ${
                        testVariants.reduce((sum, v) => sum + v.split, 0) ===
                        100
                          ? "text-green-600"
                          : "text-destructive"
                      }`}
                    >
                      {testVariants.reduce((sum, v) => sum + v.split, 0)}%
                    </span>
                  </div>
                  {testVariants.reduce((sum, v) => sum + v.split, 0) !==
                    100 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Traffic split must equal 100%
                    </p>
                  )}
                </div>
              </div>

              {/* Sample Size Calculator */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    Sample Size & Duration
                  </CardTitle>
                  <CardDescription>
                    Estimated test requirements based on your configuration
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-primary">
                        {Math.max(
                          160,
                          Math.ceil((selectedCustomers.length || 200) * 0.8)
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Min Sample Size
                      </p>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-primary">
                        {Math.ceil(
                          Math.max(
                            160,
                            Math.ceil((selectedCustomers.length || 200) * 0.8)
                          ) / testVariants.length
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Per Variant
                      </p>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-primary">
                        7-14
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Days Recommended
                      </p>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-primary">
                        {confidenceLevel}%
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Confidence Level
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3">
                <Button variant="outline">Save as Draft</Button>
                <Button
                  disabled={
                    !abTestName ||
                    !testDuration.start ||
                    !testDuration.end ||
                    testVariants.reduce((sum, v) => sum + v.split, 0) !== 100 ||
                    testVariants.some((v) => !v.template)
                  }
                  onClick={() => {
                    const newTest = {
                      id: `TEST${String(currentTests.length + 1).padStart(
                        3,
                        "0"
                      )}`,
                      name: abTestName,
                      status: "running",
                      startDate: testDuration.start,
                      endDate: testDuration.end,
                      variants: testVariants.map((v) => ({
                        id: v.id,
                        name: v.name,
                        customers: Math.floor(
                          (selectedCustomers.length || 160) * (v.split / 100)
                        ),
                        responses: 0,
                        recovery: 0,
                        cost: 0,
                      })),
                      significance: 0,
                      winner: null,
                      confidence: "0%",
                    }

                    setCurrentTests([...currentTests, newTest])

                    toast({
                      title: "A/B Test Created",
                      description: `"${abTestName}" is now running with ${testVariants.length} variants.`,
                    })

                    // Reset form
                    setAbTestName("")
                    setAbTestDescription("")
                    setTestDuration({ start: "", end: "" })
                    setTestVariants([
                      {
                        id: "A",
                        name: "Control",
                        channel: "Email",
                        template: "",
                        split: 50,
                        color: "blue",
                      },
                      {
                        id: "B",
                        name: "Variant B",
                        channel: "SMS",
                        template: "",
                        split: 50,
                        color: "green",
                      },
                    ])
                  }}
                >
                  <Play className="w-4 h-4 mr-2" />
                  Launch Test
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: What-If Analysis */}
        <TabsContent value="what-if" className="space-y-6">
          <div className="grid gap-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">
                  What-If Scenario Analysis
                </h3>
                <p className="text-sm text-muted-foreground">
                  Simulate different dunning parameters to predict campaign
                  outcomes
                </p>
              </div>
              <Button
                onClick={() => {
                  const newScenario = {
                    id: `scenario${Date.now()}`,
                    name: scenarioName || `Scenario ${scenarios.length + 1}`,
                    contactFrequency,
                    riskThresholds,
                    channelMix,
                    predictions: {
                      responseRate: Math.random() * 20 + 60,
                      recoveryAmount: Math.random() * 50000 + 100000,
                      campaignCost: Math.random() * 5000 + 5000,
                      netROI: Math.random() * 2 + 1.5,
                      timeToResolution: Math.random() * 10 + 8,
                    },
                    confidence: Math.random() > 0.3 ? "High" : "Medium",
                  }
                  setScenarios([...scenarios, newScenario])
                  toast({
                    title: "Scenario Created",
                    description: "New what-if scenario has been saved",
                  })
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Save Scenario
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Parameter Controls */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Scenario Parameters
                  </CardTitle>
                  <CardDescription>
                    Adjust dunning parameters to see predicted outcomes
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Scenario Name */}
                  <div className="space-y-2">
                    <Label htmlFor="scenario-name">Scenario Name</Label>
                    <Input
                      id="scenario-name"
                      value={scenarioName}
                      onChange={(e) => setScenarioName(e.target.value)}
                      placeholder="Enter scenario name"
                    />
                  </div>

                  {/* Contact Frequency */}
                  <div className="space-y-2">
                    <Label htmlFor="contact-frequency">
                      Contact Frequency (Days)
                    </Label>
                    <div className="flex items-center space-x-4">
                      <input
                        type="range"
                        min="1"
                        max="14"
                        value={contactFrequency}
                        onChange={(e) =>
                          setContactFrequency(Number(e.target.value))
                        }
                        className="flex-1"
                      />
                      <span className="w-12 text-center font-medium">
                        {contactFrequency}
                      </span>
                    </div>
                  </div>

                  {/* Risk Thresholds */}
                  <div className="space-y-3">
                    <Label>Risk Segment Thresholds (Days Overdue)</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <Label htmlFor="high-risk" className="text-xs">
                          High Risk
                        </Label>
                        <Input
                          id="high-risk"
                          type="number"
                          value={riskThresholds.high}
                          onChange={(e) =>
                            setRiskThresholds({
                              ...riskThresholds,
                              high: Number(e.target.value),
                            })
                          }
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="medium-risk" className="text-xs">
                          Medium Risk
                        </Label>
                        <Input
                          id="medium-risk"
                          type="number"
                          value={riskThresholds.medium}
                          onChange={(e) =>
                            setRiskThresholds({
                              ...riskThresholds,
                              medium: Number(e.target.value),
                            })
                          }
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="low-risk" className="text-xs">
                          Low Risk
                        </Label>
                        <Input
                          id="low-risk"
                          type="number"
                          value={riskThresholds.low}
                          onChange={(e) =>
                            setRiskThresholds({
                              ...riskThresholds,
                              low: Number(e.target.value),
                            })
                          }
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Channel Mix */}
                  <div className="space-y-3">
                    <Label>Communication Channel Distribution (%)</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="email-mix" className="text-xs">
                          Email
                        </Label>
                        <Input
                          id="email-mix"
                          type="number"
                          value={channelMix.email}
                          onChange={(e) =>
                            setChannelMix({
                              ...channelMix,
                              email: Number(e.target.value),
                            })
                          }
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="sms-mix" className="text-xs">
                          SMS
                        </Label>
                        <Input
                          id="sms-mix"
                          type="number"
                          value={channelMix.sms}
                          onChange={(e) =>
                            setChannelMix({
                              ...channelMix,
                              sms: Number(e.target.value),
                            })
                          }
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="phone-mix" className="text-xs">
                          Phone
                        </Label>
                        <Input
                          id="phone-mix"
                          type="number"
                          value={channelMix.phone}
                          onChange={(e) =>
                            setChannelMix({
                              ...channelMix,
                              phone: Number(e.target.value),
                            })
                          }
                          className="text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="other-mix" className="text-xs">
                          Other
                        </Label>
                        <Input
                          id="other-mix"
                          type="number"
                          value={channelMix.other}
                          onChange={(e) =>
                            setChannelMix({
                              ...channelMix,
                              other: Number(e.target.value),
                            })
                          }
                          className="text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Simulate Button */}
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => {
                      setSimulationResults({
                        responseRate: Math.random() * 20 + 60,
                        recoveryAmount: Math.random() * 50000 + 100000,
                        campaignCost: Math.random() * 5000 + 5000,
                        netROI: Math.random() * 2 + 1.5,
                        timeToResolution: Math.random() * 10 + 8,
                        confidence: Math.random() > 0.3 ? "High" : "Medium",
                      })
                      toast({
                        title: "Simulation Complete",
                        description:
                          "Updated predictions based on your parameters",
                      })
                    }}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Run Simulation
                  </Button>
                </CardContent>
              </Card>

              {/* Live Predictions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5" />
                    Predicted Outcomes
                  </CardTitle>
                  <CardDescription>
                    Real-time predictions based on current parameters
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {simulationResults ? (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">
                              Response Rate
                            </p>
                            <p className="text-2xl font-bold text-primary">
                              {simulationResults.responseRate.toFixed(1)}%
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">
                              Recovery Amount
                            </p>
                            <p className="text-2xl font-bold text-green-600">
                              $
                              {simulationResults.recoveryAmount.toLocaleString()}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">
                              Campaign Cost
                            </p>
                            <p className="text-2xl font-bold text-orange-600">
                              ${simulationResults.campaignCost.toLocaleString()}
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">
                              Net ROI
                            </p>
                            <p className="text-2xl font-bold text-blue-600">
                              {simulationResults.netROI.toFixed(2)}x
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">
                              Avg. Resolution Time
                            </p>
                            <p className="text-lg font-semibold">
                              {simulationResults.timeToResolution.toFixed(1)}{" "}
                              days
                            </p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-sm text-muted-foreground">
                              Confidence Level
                            </p>
                            <Badge
                              variant={
                                simulationResults.confidence === "High"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {simulationResults.confidence}
                            </Badge>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Click "Run Simulation" to see predictions</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Scenario Comparison */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Scenario Comparison
                </CardTitle>
                <CardDescription>
                  Compare multiple scenarios side-by-side
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Scenario Selection */}
                  <div className="flex flex-wrap gap-2">
                    {scenarios.map((scenario) => (
                      <div
                        key={scenario.id}
                        className="flex items-center space-x-2"
                      >
                        <Checkbox
                          id={scenario.id}
                          checked={selectedScenarios.includes(scenario.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedScenarios([
                                ...selectedScenarios,
                                scenario.id,
                              ])
                            } else {
                              setSelectedScenarios(
                                selectedScenarios.filter(
                                  (id) => id !== scenario.id
                                )
                              )
                            }
                          }}
                        />
                        <Label htmlFor={scenario.id} className="text-sm">
                          {scenario.name}
                        </Label>
                      </div>
                    ))}
                  </div>

                  {/* Comparison Table */}
                  {selectedScenarios.length > 0 && (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Metric</TableHead>
                            {selectedScenarios.map((scenarioId) => {
                              const scenario = scenarios.find(
                                (s) => s.id === scenarioId
                              )
                              return (
                                <TableHead key={scenarioId}>
                                  {scenario?.name}
                                </TableHead>
                              )
                            })}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium">
                              Response Rate
                            </TableCell>
                            {selectedScenarios.map((scenarioId) => {
                              const scenario = scenarios.find(
                                (s) => s.id === scenarioId
                              )
                              return (
                                <TableCell key={scenarioId}>
                                  {scenario?.predictions.responseRate.toFixed(
                                    1
                                  )}
                                  %
                                </TableCell>
                              )
                            })}
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">
                              Recovery Amount
                            </TableCell>
                            {selectedScenarios.map((scenarioId) => {
                              const scenario = scenarios.find(
                                (s) => s.id === scenarioId
                              )
                              return (
                                <TableCell key={scenarioId}>
                                  $
                                  {scenario?.predictions.recoveryAmount.toLocaleString()}
                                </TableCell>
                              )
                            })}
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">
                              Campaign Cost
                            </TableCell>
                            {selectedScenarios.map((scenarioId) => {
                              const scenario = scenarios.find(
                                (s) => s.id === scenarioId
                              )
                              return (
                                <TableCell key={scenarioId}>
                                  $
                                  {scenario?.predictions.campaignCost.toLocaleString()}
                                </TableCell>
                              )
                            })}
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">
                              Net ROI
                            </TableCell>
                            {selectedScenarios.map((scenarioId) => {
                              const scenario = scenarios.find(
                                (s) => s.id === scenarioId
                              )
                              return (
                                <TableCell key={scenarioId}>
                                  {scenario?.predictions.netROI.toFixed(2)}x
                                </TableCell>
                              )
                            })}
                          </TableRow>
                          <TableRow>
                            <TableCell className="font-medium">
                              Resolution Time
                            </TableCell>
                            {selectedScenarios.map((scenarioId) => {
                              const scenario = scenarios.find(
                                (s) => s.id === scenarioId
                              )
                              return (
                                <TableCell key={scenarioId}>
                                  {scenario?.predictions.timeToResolution.toFixed(
                                    1
                                  )}{" "}
                                  days
                                </TableCell>
                              )
                            })}
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-4">
                    <Button variant="outline" size="sm">
                      <Save className="h-4 w-4 mr-2" />
                      Export Analysis
                    </Button>
                    <Button variant="outline" size="sm">
                      Apply to A/B Testing
                    </Button>
                    <Button variant="outline" size="sm">
                      Use for Scheduling
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TAB 6: Schedule & Timing */}
        <TabsContent value="schedule-timing" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Campaign Schedule */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5" />
                  <span>Campaign Schedule</span>
                </CardTitle>
                <CardDescription>
                  Set when your dunning campaigns should run
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Campaign Type</Label>
                  <Select defaultValue="recurring">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one-time">
                        One-time Campaign
                      </SelectItem>
                      <SelectItem value="recurring">
                        Recurring Campaign
                      </SelectItem>
                      <SelectItem value="triggered">Event Triggered</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Start Date</Label>
                  <div className="relative">
                    <Input
                      type="date"
                      defaultValue={new Date().toISOString().split("T")[0]}
                      className="pr-10"
                    />
                    <Calendar className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                  </div>
                </div>

                <div>
                  <Label>Frequency</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Select defaultValue="daily">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Every 1 day(s)" />
                  </div>
                </div>

                <div>
                  <Label>Execution Time</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="time" defaultValue="09:00" />
                    <Select defaultValue="local">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="local">Local Time</SelectItem>
                        <SelectItem value="utc">UTC</SelectItem>
                        <SelectItem value="customer">Customer Time</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch id="active-schedule" defaultChecked />
                  <Label htmlFor="active-schedule">Active Schedule</Label>
                </div>
              </CardContent>
            </Card>

            {/* Risk-Based Timing */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Clock className="w-5 h-5" />
                  <span>Risk-Based Timing</span>
                </CardTitle>
                <CardDescription>
                  Different timing strategies for different risk levels
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="destructive">High Risk</Badge>
                      <span className="text-sm text-muted-foreground">
                        Accelerated
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <Label className="text-xs">First Contact</Label>
                        <Input type="number" defaultValue="0" className="h-8" />
                        <span className="text-xs text-muted-foreground">
                          days after due
                        </span>
                      </div>
                      <div>
                        <Label className="text-xs">Escalation</Label>
                        <Input type="number" defaultValue="3" className="h-8" />
                        <span className="text-xs text-muted-foreground">
                          days interval
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="secondary">Medium Risk</Badge>
                      <span className="text-sm text-muted-foreground">
                        Standard
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <Label className="text-xs">First Contact</Label>
                        <Input type="number" defaultValue="1" className="h-8" />
                        <span className="text-xs text-muted-foreground">
                          days after due
                        </span>
                      </div>
                      <div>
                        <Label className="text-xs">Escalation</Label>
                        <Input type="number" defaultValue="7" className="h-8" />
                        <span className="text-xs text-muted-foreground">
                          days interval
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <Badge variant="default">Low Risk</Badge>
                      <span className="text-sm text-muted-foreground">
                        Extended
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <Label className="text-xs">First Contact</Label>
                        <Input type="number" defaultValue="3" className="h-8" />
                        <span className="text-xs text-muted-foreground">
                          days after due
                        </span>
                      </div>
                      <div>
                        <Label className="text-xs">Escalation</Label>
                        <Input
                          type="number"
                          defaultValue="14"
                          className="h-8"
                        />
                        <span className="text-xs text-muted-foreground">
                          days interval
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Communication Timing Controls */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <MessageSquare className="w-5 h-5" />
                <span>Communication Timing</span>
              </CardTitle>
              <CardDescription>
                Control when and how communications are sent
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Business Hours */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Business Hours</Label>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Start Time</Label>
                        <Input
                          type="time"
                          defaultValue="09:00"
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">End Time</Label>
                        <Input
                          type="time"
                          defaultValue="17:00"
                          className="h-8"
                        />
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch id="respect-hours" defaultChecked />
                      <Label htmlFor="respect-hours" className="text-xs">
                        Respect business hours
                      </Label>
                    </div>
                  </div>
                </div>

                {/* Rate Limiting */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Rate Limiting</Label>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">Daily Limit</Label>
                      <Input type="number" defaultValue="500" className="h-8" />
                      <span className="text-xs text-muted-foreground">
                        messages per day
                      </span>
                    </div>
                    <div>
                      <Label className="text-xs">Hourly Limit</Label>
                      <Input type="number" defaultValue="50" className="h-8" />
                      <span className="text-xs text-muted-foreground">
                        messages per hour
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contact Frequency */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    Contact Frequency
                  </Label>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs">
                        Min Gap Between Contacts
                      </Label>
                      <Input type="number" defaultValue="24" className="h-8" />
                      <span className="text-xs text-muted-foreground">
                        hours
                      </span>
                    </div>
                    <div>
                      <Label className="text-xs">Max Contacts Per Week</Label>
                      <Input type="number" defaultValue="3" className="h-8" />
                      <span className="text-xs text-muted-foreground">
                        per customer
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Schedule Preview</h4>
                    <p className="text-sm text-muted-foreground">
                      Next campaign will run: Today at 09:00 AM
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      className="flex items-center space-x-2"
                    >
                      <Calendar className="w-4 h-4" />
                      <span>View Schedule</span>
                    </Button>
                    <Button className="flex items-center space-x-2">
                      <Save className="w-4 h-4" />
                      <span>Save Schedule</span>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Holiday & Blackout Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5" />
                <span>Holiday & Blackout Dates</span>
              </CardTitle>
              <CardDescription>
                Manage dates when campaigns should not run
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label>Add Blackout Date</Label>
                  <div className="flex space-x-2">
                    <Input type="date" className="flex-1" />
                    <Button size="sm">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label>Holiday Calendar</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select country/region" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="us">United States</SelectItem>
                      <SelectItem value="uk">United Kingdom</SelectItem>
                      <SelectItem value="ca">Canada</SelectItem>
                      <SelectItem value="au">Australia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Current Blackout Dates</Label>
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">2024-12-25 - Christmas Day</span>
                    <Button variant="outline" size="sm">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <div className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">2024-01-01 - New Year's Day</span>
                    <Button variant="outline" size="sm">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: Settings */}
        <TabsContent value="settings" className="space-y-6">
          {/* External Communication Integration */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Globe className="w-5 h-5" />
                <span>External Communication Integration</span>
              </CardTitle>
              <CardDescription>
                Configure third-party communication services and channels
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Email Service Configuration */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold flex items-center space-x-2">
                    <Mail className="w-4 h-4" />
                    <span>Email Service</span>
                  </h4>
                  <Switch defaultChecked />
                </div>

                <div className="grid grid-cols-2 gap-4 ml-6">
                  <div className="space-y-2">
                    <Label htmlFor="email-provider">Email Provider</Label>
                    <Select defaultValue="sendgrid">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sendgrid">SendGrid</SelectItem>
                        <SelectItem value="ses">Amazon SES</SelectItem>
                        <SelectItem value="mailgun">Mailgun</SelectItem>
                        <SelectItem value="smtp">Custom SMTP</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email-api-key">API Key</Label>
                    <Input
                      id="email-api-key"
                      type="password"
                      placeholder="••••••••••••••••"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sender-email">From Email</Label>
                    <Input
                      id="sender-email"
                      type="email"
                      placeholder="noreply@company.com"
                      defaultValue="noreply@company.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sender-name">From Name</Label>
                    <Input
                      id="sender-name"
                      placeholder="Company Collections"
                      defaultValue="Company Collections"
                    />
                  </div>
                </div>
              </div>

              {/* SMS Service Configuration */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold flex items-center space-x-2">
                    <Smartphone className="w-4 h-4" />
                    <span>SMS Service</span>
                  </h4>
                  <Switch defaultChecked />
                </div>

                <div className="grid grid-cols-2 gap-4 ml-6">
                  <div className="space-y-2">
                    <Label htmlFor="sms-provider">SMS Provider</Label>
                    <Select defaultValue="twilio">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="twilio">Twilio</SelectItem>
                        <SelectItem value="nexmo">Vonage (Nexmo)</SelectItem>
                        <SelectItem value="aws-sns">AWS SNS</SelectItem>
                        <SelectItem value="clicksend">ClickSend</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sms-api-key">API Key</Label>
                    <Input
                      id="sms-api-key"
                      type="password"
                      placeholder="••••••••••••••••"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sms-number">From Number</Label>
                    <Input
                      id="sms-number"
                      placeholder="+1234567890"
                      defaultValue="+1234567890"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="sms-webhook">Webhook URL</Label>
                    <Input
                      id="sms-webhook"
                      placeholder="https://api.company.com/sms/webhook"
                    />
                  </div>
                </div>
              </div>

              {/* Voice/Call Service Configuration */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold flex items-center space-x-2">
                    <Phone className="w-4 h-4" />
                    <span>Voice/Call Service</span>
                  </h4>
                  <Switch />
                </div>

                <div className="grid grid-cols-2 gap-4 ml-6">
                  <div className="space-y-2">
                    <Label htmlFor="voice-provider">Voice Provider</Label>
                    <Select defaultValue="twilio">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="twilio">Twilio Voice</SelectItem>
                        <SelectItem value="plivo">Plivo</SelectItem>
                        <SelectItem value="aws-connect">AWS Connect</SelectItem>
                        <SelectItem value="vonage">Vonage Voice</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="voice-api-key">API Key</Label>
                    <Input
                      id="voice-api-key"
                      type="password"
                      placeholder="••••••••••••••••"
                    />
                  </div>
                </div>
              </div>

              {/* Webhook Configuration */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold flex items-center space-x-2">
                    <RefreshCw className="w-4 h-4" />
                    <span>Webhook Notifications</span>
                  </h4>
                  <Switch defaultChecked />
                </div>

                <div className="grid grid-cols-1 gap-4 ml-6">
                  <div className="space-y-2">
                    <Label htmlFor="webhook-url">Webhook URL</Label>
                    <Input
                      id="webhook-url"
                      placeholder="https://api.company.com/dunning/webhook"
                      defaultValue="https://api.company.com/dunning/webhook"
                    />
                    <p className="text-xs text-muted-foreground">
                      Receive real-time notifications about campaign results
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox id="webhook-delivery" defaultChecked />
                    <Label htmlFor="webhook-delivery" className="text-sm">
                      Delivery notifications
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox id="webhook-response" defaultChecked />
                    <Label htmlFor="webhook-response" className="text-sm">
                      Customer response notifications
                    </Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox id="webhook-failure" defaultChecked />
                    <Label htmlFor="webhook-failure" className="text-sm">
                      Failure notifications
                    </Label>
                  </div>
                </div>
              </div>

              <div className="flex space-x-2">
                <Button>
                  <Save className="w-4 h-4 mr-2" />
                  Save Integration Settings
                </Button>
                <Button variant="outline">Test Connections</Button>
              </div>
            </CardContent>
          </Card>

          {/* Template Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="w-5 h-5" />
                <span>Template Management</span>
              </CardTitle>
              <CardDescription>
                Create, edit, and manage communication templates
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Template Library */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Template Library</h4>
                  <Button size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    New Template
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className="border rounded-lg p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {getTypeIcon(template.type)}
                          <div>
                            <h5 className="font-medium">{template.name}</h5>
                            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                              <Badge variant={getStageColor(template.stage)}>
                                {template.stage}
                              </Badge>
                              <span>•</span>
                              <span>{template.type}</span>
                              <span>•</span>
                              <span>
                                {template.assignedToSegments.length} segment(s)
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <Switch defaultChecked={template.isActive} />
                          <Button variant="outline" size="sm">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="outline" size="sm">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div className="text-sm text-muted-foreground bg-muted p-3 rounded">
                        {template.content}
                      </div>

                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        <span>Assigned to:</span>
                        {template.assignedToSegments.map((segment) => (
                          <Badge key={segment} variant="outline">
                            {riskSegments.find((s) => s.id === segment)?.name ||
                              segment}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Template Variables */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold">Available Variables</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    "{customer_name}",
                    "{amount}",
                    "{due_date}",
                    "{account_number}",
                    "{days_overdue}",
                    "{payment_url}",
                    "{contact_number}",
                    "{company_name}",
                    ...(customerType === "enterprise"
                      ? [
                          "{contract_date}",
                          "{account_manager}",
                          "{account_manager_email}",
                          "{contract_value}",
                          "{sla_terms}",
                          "{service_level}",
                          "{escalation_contact}",
                          "{legal_department}",
                        ]
                      : []),
                  ].map((variable) => (
                    <Badge
                      key={variable}
                      variant="outline"
                      className="justify-center py-1"
                    >
                      {variable}
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {customerType === "enterprise"
                    ? "Use these variables in your enterprise templates to automatically personalize professional communications with contract and account manager details."
                    : "Use these variables in your templates to automatically personalize communications."}
                </p>
              </div>

              {/* Template Categories */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold">
                  {customerType === "enterprise"
                    ? "Enterprise Template Categories"
                    : "Template Categories"}
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {customerType === "enterprise" ? (
                    <>
                      <Card className="p-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge variant="default">D+0</Badge>
                          <span className="text-sm font-medium">
                            Professional Reminders
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Contract-based payment reminders with account manager
                          contact
                        </p>
                        <div className="mt-2 text-xs text-muted-foreground">
                          1 active template
                        </div>
                      </Card>

                      <Card className="p-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge variant="secondary">D+7</Badge>
                          <span className="text-sm font-medium">
                            Account Manager Escalation
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Professional escalation with account manager
                          involvement
                        </p>
                        <div className="mt-2 text-xs text-muted-foreground">
                          2 active templates
                        </div>
                      </Card>

                      <Card className="p-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge variant="destructive">D+30</Badge>
                          <span className="text-sm font-medium">
                            Contract Breach Notice
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Legal notice regarding contract violations
                        </p>
                        <div className="mt-2 text-xs text-muted-foreground">
                          2 active templates
                        </div>
                      </Card>
                    </>
                  ) : (
                    <>
                      <Card className="p-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge variant="default">D+0</Badge>
                          <span className="text-sm font-medium">
                            Reminder Templates
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Gentle reminders for due payments
                        </p>
                        <div className="mt-2 text-xs text-muted-foreground">
                          2 active templates
                        </div>
                      </Card>

                      <Card className="p-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge variant="secondary">D+5</Badge>
                          <span className="text-sm font-medium">
                            Escalation Templates
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Follow-up for overdue payments
                        </p>
                        <div className="mt-2 text-xs text-muted-foreground">
                          1 active template
                        </div>
                      </Card>

                      <Card className="p-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <Badge variant="destructive">D+15</Badge>
                          <span className="text-sm font-medium">
                            Final Notice Templates
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Final warnings before legal action
                        </p>
                        <div className="mt-2 text-xs text-muted-foreground">
                          1 active template
                        </div>
                      </Card>
                    </>
                  )}
                </div>
              </div>

              <div className="flex space-x-2">
                <Button>
                  <Save className="w-4 h-4 mr-2" />
                  Save Template Changes
                </Button>
                <Button variant="outline">Import Templates</Button>
                <Button variant="outline">Export Templates</Button>
              </div>
            </CardContent>
          </Card>

          {/* Global System Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="w-5 h-5" />
                <span>System Configuration</span>
              </CardTitle>
              <CardDescription>
                Configure system-wide settings and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Global Campaign Settings */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold">Global Settings</h4>
                  <div>
                    <Label>Business Hours</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input placeholder="09:00" defaultValue="09:00" />
                      <Input placeholder="17:00" defaultValue="17:00" />
                    </div>
                  </div>

                  <div>
                    <Label>
                      {customerType === "enterprise"
                        ? "Daily Communication Limits"
                        : "Daily Send Limits"}
                    </Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Email limit"
                        defaultValue={
                          customerType === "enterprise" ? "200" : "500"
                        }
                      />
                      <Input
                        placeholder="SMS limit"
                        defaultValue={
                          customerType === "enterprise" ? "50" : "1000"
                        }
                      />
                    </div>
                    {customerType === "enterprise" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Lower limits for enterprise due to more targeted,
                        relationship-based approach
                      </p>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Automatic Processing</Label>
                      <p className="text-sm text-muted-foreground">
                        Automatically process campaigns based on schedule
                      </p>
                    </div>
                    <Switch defaultChecked />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Weekend Processing</Label>
                      <p className="text-sm text-muted-foreground">
                        Allow campaigns to run on weekends
                      </p>
                    </div>
                    <Switch />
                  </div>
                </div>

                {/* Risk Configuration */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold">Risk Configuration</h4>
                  <div>
                    <Label>Risk Thresholds</Label>
                    <div className="grid grid-cols-3 gap-2">
                      <Input placeholder="High: 0-300" defaultValue="0-300" />
                      <Input
                        placeholder="Med: 301-700"
                        defaultValue="301-700"
                      />
                      <Input
                        placeholder="Low: 701-850"
                        defaultValue="701-850"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>AI Recommendations</Label>
                      <p className="text-sm text-muted-foreground">
                        Enable AI-powered recommendations
                      </p>
                    </div>
                    <Switch />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="retry-attempts">Retry Attempts</Label>
                    <Select defaultValue="3">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 attempt</SelectItem>
                        <SelectItem value="2">2 attempts</SelectItem>
                        <SelectItem value="3">3 attempts</SelectItem>
                        <SelectItem value="5">5 attempts</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="flex space-x-2">
                <Button>
                  <Save className="w-4 h-4 mr-2" />
                  Save System Settings
                </Button>
                <Button variant="outline">Reset to Defaults</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
