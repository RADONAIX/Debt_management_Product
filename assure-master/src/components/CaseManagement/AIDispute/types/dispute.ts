export interface Dispute {
  id: string;
  customerId: string;
  customerName: string;
  type: string;
  amount: number;
  status: 'INVESTIGATING' | 'ESCALATED' | 'RESOLVED' | 'OPEN';
  priority: 'LOW' | 'MEDIUM' | 'HIGH';
  assignedTo: string;
  dateRaised: string;
  description: string;
  timeline: TimelineEvent[];
  attachments: Attachment[];
}

export interface TimelineEvent {
  id: string;
  title: string;
  by: string;
  note: string;
  date: string;
}

export interface Attachment {
  name: string;
  type: string;
}

export interface CustomerData {
  customerId: string;
  name: string;
  segment: string;
  topMetrics: {
    totalOutstanding: number;
    atRiskAmount: number;
    collectionsToday: number;
    dpd: number;
    carForecastNext30Days: number;
    carConfidence: string;
  };
  collectionsPTP: {
    totalCollections: number;
    recoveryRate: number;
    cureRate: number;
    ptpRate: number;
    ptpHonoredPct: number;
    ptpBrokenPct: number;
    ptpCreatedToday: number;
  };
  strategySummary: {
    successRate: number;
    contactability: number;
    aiUplift: number;
    coronability: number;
    riskUplift: number;
  };
  automationAI: {
    voicebotSuccess: number;
    dialerConnect: number;
    disputeCount: number;
    slaSummary: { openCases: number; resolved: number };
    rpaAutomationRate: number;
  };
  agingBucket: {
    bucket: string;
    portfolioSharePct: number;
    severityScore: number;
  };
  carForecast: {
    next7Days: number;
    next30Days: number;
  };
  alertsAndExceptions: string[];
  majorRiskDrivers: Array<{ driver: string; value: number }>;
  codeStrategy: {
    sms: number;
    dialer: number;
    email: number;
  };
  collectionsFunnel: {
    sms: { success: number; uplift: number };
    dialer: { success: number; uplift: number };
    email: { success: number; uplift: number };
  };
  dailyCollectionsTrend?: {
    dates: string[];
    actual: number[];
    target: number[];
  };
  invoices: Invoice[];
  billingData: BillingRecord[];
}

export interface Invoice {
  id: string;
  date: string;
  amount: number;
  dueDate: string;
  status: 'Paid' | 'Pending' | 'Overdue';
  items: string[];
}

export interface BillingRecord {
  id: string;
  period: string;
  totalBilled: number;
  totalPaid: number;
  outstanding: number;
  services: string[];
}

export interface AIReconciliationResult {
  confidence: number;
  dispute_validity: {
    is_valid: boolean;
    validity_score: number;
    evidence_found: string[];
    contradictions: string[];
    conclusion: string;
    relevant_invoices: Invoice[];
    relevant_billing: BillingRecord[];
  };
  customer_and_issue: string;
  invoices_and_payments: string;
  behaviour_and_risk: string;
  recommended_actions_internal: string[];
  customer_message: string;
  payment_history_badge: string;
  customer_behavior_badge: string;
  financial_health_badge: string;
  risk_assessment_short: string;
  suggested_resolution_short: string;
  invoiceAnalysis: {
    totalInvoices: number;
    overdueInvoices: number;
    pendingAmount: number;
    insights: string[];
  };
  billingAnalysis: {
    totalBilled: number;
    totalPaid: number;
    paymentRate: number;
    insights: string[];
  };
  sampleInvoices: Invoice[];
  sampleBillingRecords: BillingRecord[];
}
