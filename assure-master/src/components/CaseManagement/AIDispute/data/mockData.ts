import { Dispute, CustomerData } from "../types/dispute";

export const mockDisputes: Dispute[] = [
  {
    id: "DSP001",
    customerId: "CUST-ENT-001",
    customerName: "John Anderson",
    type: "Service Billing Error",
    amount: 250,
    status: "INVESTIGATING",
    priority: "MEDIUM",
    assignedTo: "John Smith",
    dateRaised: "2024-01-15",
    description: "Customer claims service late fee was charged incorrectly as payment was made on time.",
    timeline: [
      {
        id: "1",
        title: "Dispute Raised",
        by: "System",
        note: "Customer submitted dispute through online portal",
        date: "2024-01-15"
      },
      {
        id: "2",
        title: "Assigned to Agent",
        by: "John Smith",
        note: "Case assigned for investigation",
        date: "2024-01-16"
      },
      {
        id: "3",
        title: "Investigation Started",
        by: "John Smith",
        note: "Reviewing payment records and service logs",
        date: "2024-01-17"
      }
    ],
    attachments: [
      { name: "service_statement.pdf", type: "PDF" },
      { name: "usage_report.pdf", type: "PDF" }
    ]
  },
  {
    id: "DSP002",
    customerId: "CUST-SMB-001",
    customerName: "Sarah Mitchell",
    type: "Unauthorized Service Charge",
    amount: 500,
    status: "ESCALATED",
    priority: "HIGH",
    assignedTo: "Jennifer Lee",
    dateRaised: "2024-01-12",
    description: "Customer claims: 'I was charged $500 for a service I never used.' International calling package and data overage charges in December 2023.",
    timeline: [
      {
        id: "1",
        title: "Dispute Raised",
        by: "System",
        note: "Customer reported unauthorized charges",
        date: "2024-01-12"
      },
      {
        id: "2",
        title: "Escalated",
        by: "System",
        note: "High-value dispute auto-escalated",
        date: "2024-01-13"
      }
    ],
    attachments: [
      { name: "account_statement.pdf", type: "PDF" }
    ]
  },
  {
    id: "DSP003",
    customerId: "CUST-GOV-001",
    customerName: "David Brown",
    type: "Service Charge Dispute",
    amount: 280,
    status: "RESOLVED",
    priority: "LOW",
    assignedTo: "John Smith",
    dateRaised: "2024-08-05",
    description: "A service charge of $280 was added incorrectly. Please remove it.",
    timeline: [
      {
        id: "1",
        title: "Dispute Raised",
        by: "System",
        note: "Customer claimed incorrect service charge",
        date: "2024-08-05"
      },
      {
        id: "2",
        title: "RPA Analysis Complete",
        by: "RPA System",
        note: "Automated validation determined charge is valid late payment fee",
        date: "2024-08-06"
      },
      {
        id: "3",
        title: "Resolved",
        by: "John Smith",
        note: "Charge validated as late payment fee, explained to customer",
        date: "2024-08-30"
      }
    ],
    attachments: []
  },
  {
    id: "DSP004",
    customerId: "CUST-SMB-002",
    customerName: "David Rodriguez",
    type: "Duplicate Charge",
    amount: 89,
    status: "INVESTIGATING",
    priority: "HIGH",
    assignedTo: "Sarah Wilson",
    dateRaised: "2024-01-18",
    description: "Customer claims: 'I was charged twice for the same monthly service in January - both INV-2401A and INV-2401B show $89.99 charge.'",
    timeline: [
      {
        id: "1",
        title: "Dispute Raised",
        by: "System",
        note: "Customer reported duplicate billing",
        date: "2024-01-18"
      },
      {
        id: "2",
        title: "RPA Analysis Started",
        by: "RPA System",
        note: "Automated validation in progress",
        date: "2024-01-18"
      }
    ],
    attachments: [
      { name: "invoice_comparison.pdf", type: "PDF" }
    ]
  },
  {
    id: "DSP005",
    customerId: "CUST-SMB-003",
    customerName: "Lisa Thompson",
    type: "Missing Discount",
    amount: 45,
    status: "ESCALATED",
    priority: "MEDIUM",
    assignedTo: "Michael Chen",
    dateRaised: "2024-01-16",
    description: "Customer claims: 'My loyalty discount of $45/month was not applied to my December and January invoices. I have been a customer for 3 years.'",
    timeline: [
      {
        id: "1",
        title: "Dispute Raised",
        by: "System",
        note: "Customer reported missing loyalty discount",
        date: "2024-01-16"
      },
      {
        id: "2",
        title: "RPA Validation",
        by: "RPA System",
        note: "Confirmed: Loyalty discount active but not applied to recent invoices",
        date: "2024-01-16"
      },
      {
        id: "3",
        title: "Escalated for Credit",
        by: "System",
        note: "Valid dispute - credit approval needed",
        date: "2024-01-17"
      }
    ],
    attachments: [
      { name: "loyalty_program_terms.pdf", type: "PDF" }
    ]
  },
  {
    id: "DSP006",
    customerId: "CUST-ENT-003",
    customerName: "Robert Martinez",
    type: "Plan Charge Error",
    amount: 199,
    status: "INVESTIGATING",
    priority: "MEDIUM",
    assignedTo: "John Smith",
    dateRaised: "2024-01-19",
    description: "Customer claims: 'I am being charged $199 for Premium Plus plan but I only signed up for Basic plan at $99.'",
    timeline: [
      {
        id: "1",
        title: "Dispute Raised",
        by: "System",
        note: "Customer disputed plan pricing",
        date: "2024-01-19"
      },
      {
        id: "2",
        title: "RPA Analysis Started",
        by: "RPA System",
        note: "Checking plan history and upgrade records",
        date: "2024-01-19"
      }
    ],
    attachments: []
  },
  {
    id: "DSP007",
    customerId: "CUST-SMB-004",
    customerName: "Jennifer Lee",
    type: "Early Termination Fee",
    amount: 350,
    status: "ESCALATED",
    priority: "HIGH",
    assignedTo: "Sarah Wilson",
    dateRaised: "2024-01-17",
    description: "Customer claims: 'I was charged $350 early termination fee but I never signed any contract. This should be removed immediately.'",
    timeline: [
      {
        id: "1",
        title: "Dispute Raised",
        by: "System",
        note: "Customer disputed early termination fee",
        date: "2024-01-17"
      },
      {
        id: "2",
        title: "RPA Validation",
        by: "RPA System",
        note: "Contract record found with e-signature",
        date: "2024-01-17"
      },
      {
        id: "3",
        title: "Escalated",
        by: "System",
        note: "Customer insists - manual review required",
        date: "2024-01-18"
      }
    ],
    attachments: [
      { name: "contract_agreement.pdf", type: "PDF" }
    ]
  }
];

export const customerData: Record<string, CustomerData> = {
  "CUST-ENT-001": {
    customerId: "CUST-ENT-001",
    name: "Alpha Logistics LLC",
    segment: "Enterprise",
    topMetrics: {
      totalOutstanding: 243300,
      atRiskAmount: 243300,
      collectionsToday: 0,
      dpd: 68,
      carForecastNext30Days: 120000,
      carConfidence: "Medium-High"
    },
    collectionsPTP: {
      totalCollections: 80000,
      recoveryRate: 33,
      cureRate: 41,
      ptpRate: 32,
      ptpHonoredPct: 100,
      ptpBrokenPct: 0,
      ptpCreatedToday: 1
    },
    strategySummary: {
      successRate: 42,
      contactability: 68,
      aiUplift: 21,
      coronability: 17,
      riskUplift: 7
    },
    automationAI: {
      voicebotSuccess: 38,
      dialerConnect: 41,
      disputeCount: 1,
      slaSummary: { openCases: 18, resolved: 12 },
      rpaAutomationRate: 81
    },
    agingBucket: {
      bucket: "61-90 days",
      portfolioSharePct: 0.21,
      severityScore: 72
    },
    carForecast: {
      next7Days: 19000,
      next30Days: 120000
    },
    alertsAndExceptions: [
      "Dispute raised for IoT usage",
      "Customer requested invoice verification",
      "High-risk payment slippage detected"
    ],
    majorRiskDrivers: [
      { driver: "Delayed enterprise payments", value: 31 },
      { driver: "Invoice discrepancies", value: 19 },
      { driver: "Low contactability", value: 29 }
    ],
    codeStrategy: {
      sms: 72,
      dialer: 59,
      email: 31
    },
    collectionsFunnel: {
      sms: { success: 68, uplift: 3.2 },
      dialer: { success: 48, uplift: 4.1 },
      email: { success: 29, uplift: 1.1 }
    },
    dailyCollectionsTrend: {
      dates: ["Feb 1", "Feb 5", "Feb 10", "Feb 15", "Feb 20"],
      actual: [3.8, 6.1, 7.4, 8.2, 9.0],
      target: [4.0, 6.5, 7.8, 9.1, 10.0]
    },
    invoices: [
      { id: "INV-2024-001", date: "2024-01-15", amount: 125000, dueDate: "2024-02-15", status: "Overdue", items: ["IoT Device Management - Jan", "Platform Subscription", "Support Services"] },
      { id: "INV-2024-002", date: "2024-02-15", amount: 118300, dueDate: "2024-03-15", status: "Overdue", items: ["IoT Device Management - Feb", "Platform Subscription", "Data Analytics"] },
      { id: "INV-2024-003", date: "2024-03-15", amount: 130000, dueDate: "2024-04-15", status: "Pending", items: ["IoT Device Management - Mar", "Platform Subscription", "Premium Support"] }
    ],
    billingData: [
      { id: "BILL-Q1-2024", period: "Q1 2024", totalBilled: 373300, totalPaid: 130000, outstanding: 243300, services: ["IoT Device Management", "Platform Subscription", "Support Services", "Data Analytics"] },
      { id: "BILL-Q4-2023", period: "Q4 2023", totalBilled: 360000, totalPaid: 360000, outstanding: 0, services: ["IoT Device Management", "Platform Subscription", "Support Services"] }
    ]
  },
  "CUST-SMB-001": {
    customerId: "CUST-SMB-001",
    name: "Sarah Mitchell Telecom Account",
    segment: "SMB",
    topMetrics: {
      totalOutstanding: 720,
      atRiskAmount: 720,
      collectionsToday: 0,
      dpd: 45,
      carForecastNext30Days: 350,
      carConfidence: "Medium"
    },
    collectionsPTP: {
      totalCollections: 450,
      recoveryRate: 24,
      cureRate: 31,
      ptpRate: 18,
      ptpHonoredPct: 67,
      ptpBrokenPct: 33,
      ptpCreatedToday: 1
    },
    strategySummary: {
      successRate: 38,
      contactability: 72,
      aiUplift: 12,
      coronability: 15,
      riskUplift: 8
    },
    automationAI: {
      voicebotSuccess: 28,
      dialerConnect: 42,
      disputeCount: 1,
      slaSummary: { openCases: 1, resolved: 0 },
      rpaAutomationRate: 68
    },
    agingBucket: {
      bucket: "31-60 days",
      portfolioSharePct: 0.08,
      severityScore: 52
    },
    carForecast: {
      next7Days: 150,
      next30Days: 350
    },
    alertsAndExceptions: [
      "Payment rate dropped 72% in last 60 days",
      "Dispute raised on high-value charge",
      "Usage spike detected: 52GB vs avg 10GB",
      "International package activated from customer device on Dec 3"
    ],
    majorRiskDrivers: [
      { driver: "Payment rate decline", value: 72 },
      { driver: "Disputed invoice outstanding", value: 69 },
      { driver: "Service usage pattern change", value: 48 }
    ],
    codeStrategy: {
      sms: 75,
      dialer: 52,
      email: 38
    },
    collectionsFunnel: {
      sms: { success: 68, uplift: 3.1 },
      dialer: { success: 51, uplift: 2.9 },
      email: { success: 35, uplift: 1.5 }
    },
    dailyCollectionsTrend: {
      dates: ["Jan 1", "Jan 7", "Jan 14", "Jan 21", "Jan 28"],
      actual: [0, 0, 0, 0, 0],
      target: [50, 120, 220, 350, 500]
    },
    invoices: [
      { id: "INV-2310", date: "2023-10-01", amount: 200, dueDate: "2023-10-25", status: "Paid", items: ["Mobile Service Plan", "Standard Data 10GB"] },
      { id: "INV-2311", date: "2023-11-01", amount: 250, dueDate: "2023-11-25", status: "Paid", items: ["Mobile Service Plan", "Standard Data 10GB", "Device Insurance"] },
      { id: "INV-2312", date: "2023-12-01", amount: 500, dueDate: "2023-12-25", status: "Overdue", items: ["Mobile Service Plan", "International Calling Package $180", "Data Overage 42GB @ $5/GB = $210", "Roaming Charges $60", "Device Insurance $50"] },
      { id: "INV-2401", date: "2024-01-01", amount: 220, dueDate: "2024-01-25", status: "Pending", items: ["Mobile Service Plan", "Standard Data 10GB", "Device Insurance"] }
    ],
    billingData: [
      { id: "BILL-2401", period: "Jan 2024", totalBilled: 220, totalPaid: 0, outstanding: 220, services: ["Mobile Service", "Data Plan", "Insurance"] },
      { id: "BILL-2312", period: "Dec 2023", totalBilled: 500, totalPaid: 0, outstanding: 500, services: ["Mobile Service", "International Package", "Data Overage", "Roaming"] },
      { id: "BILL-2311", period: "Nov 2023", totalBilled: 250, totalPaid: 250, outstanding: 0, services: ["Mobile Service", "Data Plan", "Insurance"] },
      { id: "BILL-2310", period: "Oct 2023", totalBilled: 200, totalPaid: 200, outstanding: 0, services: ["Mobile Service", "Data Plan"] },
      { id: "BILL-2309", period: "Sep 2023", totalBilled: 200, totalPaid: 200, outstanding: 0, services: ["Mobile Service", "Data Plan"] },
      { id: "BILL-2308", period: "Aug 2023", totalBilled: 195, totalPaid: 195, outstanding: 0, services: ["Mobile Service", "Data Plan"] }
    ]
  },
  "CUST-GOV-001": {
    customerId: "CUST-GOV-001",
    name: "Michael Chen - Government Account",
    segment: "Government",
    topMetrics: {
      totalOutstanding: 252519,
      atRiskAmount: 252519,
      collectionsToday: 0,
      dpd: 13,
      carForecastNext30Days: 252519,
      carConfidence: "High"
    },
    collectionsPTP: {
      totalCollections: 0,
      recoveryRate: 95,
      cureRate: 98,
      ptpRate: 12,
      ptpHonoredPct: 100,
      ptpBrokenPct: 0,
      ptpCreatedToday: 0
    },
    strategySummary: {
      successRate: 92,
      contactability: 98,
      aiUplift: 8,
      coronability: 88,
      riskUplift: 2
    },
    automationAI: {
      voicebotSuccess: 65,
      dialerConnect: 85,
      disputeCount: 1,
      slaSummary: { openCases: 1, resolved: 1 },
      rpaAutomationRate: 92
    },
    agingBucket: {
      bucket: "11-30 days",
      portfolioSharePct: 0.08,
      severityScore: 22
    },
    carForecast: {
      next7Days: 252519,
      next30Days: 252519
    },
    alertsAndExceptions: [
      "Payment 13 days late - Late Payment Fee applied per policy LPF-10",
      "Dispute raised: Customer claimed service charge",
      "RPA Analysis: Fee correctly identified as Late Payment Fee"
    ],
    majorRiskDrivers: [
      { driver: "Late payment pattern", value: 18 },
      { driver: "Policy misunderstanding", value: 12 }
    ],
    codeStrategy: {
      sms: 88,
      dialer: 75,
      email: 52
    },
    collectionsFunnel: {
      sms: { success: 82, uplift: 4.2 },
      dialer: { success: 68, uplift: 3.8 },
      email: { success: 45, uplift: 2.1 }
    },
    dailyCollectionsTrend: {
      dates: ["Jan 1", "Jan 5", "Jan 10", "Jan 15", "Jan 20"],
      actual: [0, 0, 0, 0, 0],
      target: [50000, 100000, 150000, 200000, 250000]
    },
    invoices: [
      { 
        id: "INV-GOV-001", 
        date: "2024-01-01", 
        amount: 252519, 
        dueDate: "2024-01-11", 
        status: "Overdue", 
        items: [
          "Monthly Plan - $250,000 (Government Contract Rate)",
          "Late Payment Fee - $19 (Applied Jan 21 - Payment 13 days overdue per Policy LPF-10)",
          "Regulatory Tax - $2,500 (Mandatory Government Fee)"
        ]
      },
      { 
        id: "INV-GOV-002", 
        date: "2023-12-01", 
        amount: 252519, 
        dueDate: "2023-12-11", 
        status: "Paid", 
        items: [
          "Monthly Plan - $250,000",
          "Late Payment Fee - $19 (Applied Dec 21 - Payment 11 days overdue)",
          "Regulatory Tax - $2,500"
        ]
      },
      { 
        id: "INV-GOV-003", 
        date: "2023-11-01", 
        amount: 252500, 
        dueDate: "2023-11-11", 
        status: "Paid", 
        items: [
          "Monthly Plan - $250,000",
          "Regulatory Tax - $2,500"
        ]
      },
      { 
        id: "INV-GOV-004", 
        date: "2023-10-01", 
        amount: 252500, 
        dueDate: "2023-10-11", 
        status: "Paid", 
        items: [
          "Monthly Plan - $250,000",
          "Regulatory Tax - $2,500"
        ]
      },
      { 
        id: "INV-GOV-005", 
        date: "2023-09-01", 
        amount: 252519, 
        dueDate: "2023-09-11", 
        status: "Paid", 
        items: [
          "Monthly Plan - $250,000",
          "Late Payment Fee - $19 (Applied Sep 21 - Payment 12 days overdue)",
          "Regulatory Tax - $2,500"
        ]
      },
      { 
        id: "INV-GOV-006", 
        date: "2023-08-01", 
        amount: 252500, 
        dueDate: "2023-08-11", 
        status: "Paid", 
        items: [
          "Monthly Plan - $250,000",
          "Regulatory Tax - $2,500"
        ]
      }
    ],
    billingData: [
      { 
        id: "BILL-GOV-JAN", 
        period: "Jan 2024", 
        totalBilled: 252519, 
        totalPaid: 0, 
        outstanding: 252519, 
        services: ["Government Monthly Plan", "Late Payment Fee", "Regulatory Tax"]
      },
      { 
        id: "BILL-GOV-DEC", 
        period: "Dec 2023", 
        totalBilled: 252519, 
        totalPaid: 252519, 
        outstanding: 0, 
        services: ["Government Monthly Plan", "Late Payment Fee", "Regulatory Tax"]
      },
      { 
        id: "BILL-GOV-NOV", 
        period: "Nov 2023", 
        totalBilled: 252500, 
        totalPaid: 252500, 
        outstanding: 0, 
        services: ["Government Monthly Plan", "Regulatory Tax"]
      },
      { 
        id: "BILL-GOV-OCT", 
        period: "Oct 2023", 
        totalBilled: 252500, 
        totalPaid: 252500, 
        outstanding: 0, 
        services: ["Government Monthly Plan", "Regulatory Tax"]
      },
      { 
        id: "BILL-GOV-SEP", 
        period: "Sep 2023", 
        totalBilled: 252519, 
        totalPaid: 252519, 
        outstanding: 0, 
        services: ["Government Monthly Plan", "Late Payment Fee", "Regulatory Tax"]
      },
      { 
        id: "BILL-GOV-AUG", 
        period: "Aug 2023", 
        totalBilled: 252500, 
        totalPaid: 252500, 
        outstanding: 0, 
        services: ["Government Monthly Plan", "Regulatory Tax"]
      }
    ]
  },
  "CUST-ENT-002": {
    customerId: "CUST-ENT-002",
    name: "Falcon Manufacturing Co.",
    segment: "Enterprise",
    topMetrics: {
      totalOutstanding: 386000,
      atRiskAmount: 386000,
      collectionsToday: 12000,
      dpd: 74,
      carForecastNext30Days: 221000,
      carConfidence: "Medium"
    },
    collectionsPTP: {
      totalCollections: 12000,
      recoveryRate: 29,
      cureRate: 44,
      ptpRate: 21,
      ptpHonoredPct: 92,
      ptpBrokenPct: 8,
      ptpCreatedToday: 1
    },
    strategySummary: {
      successRate: 39,
      contactability: 63,
      aiUplift: 17,
      coronability: 14,
      riskUplift: 6
    },
    automationAI: {
      voicebotSuccess: 35,
      dialerConnect: 39,
      disputeCount: 2,
      slaSummary: { openCases: 21, resolved: 8 },
      rpaAutomationRate: 78
    },
    agingBucket: {
      bucket: "61-90 days",
      portfolioSharePct: 0.27,
      severityScore: 68
    },
    carForecast: {
      next7Days: 26000,
      next30Days: 221000
    },
    alertsAndExceptions: [
      "Pending dispute on circuit charges",
      "Customer requested phased payment plan"
    ],
    majorRiskDrivers: [
      { driver: "Heavy monthly bill variance", value: 32 },
      { driver: "Multiple circuit upgrades", value: 18 }
    ],
    codeStrategy: {
      sms: 61,
      dialer: 44,
      email: 22
    },
    collectionsFunnel: {
      sms: { success: 61, uplift: 2.8 },
      dialer: { success: 44, uplift: 3.5 },
      email: { success: 22, uplift: 0.9 }
    },
    invoices: [
      { id: "INV-ENT-002-001", date: "2024-01-10", amount: 193000, dueDate: "2024-02-10", status: "Overdue", items: ["Enterprise Telecom - Jan", "Circuit Upgrades", "Premium Support"] },
      { id: "INV-ENT-002-002", date: "2024-02-10", amount: 193000, dueDate: "2024-03-10", status: "Overdue", items: ["Enterprise Telecom - Feb", "Circuit Maintenance", "Premium Support"] }
    ],
    billingData: [
      { id: "BILL-ENT-002-Q1", period: "Q1 2024", totalBilled: 579000, totalPaid: 193000, outstanding: 386000, services: ["Enterprise Telecom", "Circuit Services", "Premium Support", "Network Monitoring"] },
      { id: "BILL-ENT-002-Q4", period: "Q4 2023", totalBilled: 550000, totalPaid: 550000, outstanding: 0, services: ["Enterprise Telecom", "Circuit Services", "Premium Support"] }
    ]
  },
  "CUST-SMB-002": {
    customerId: "CUST-SMB-002",
    name: "David Rodriguez Business Account",
    segment: "SMB",
    topMetrics: {
      totalOutstanding: 179,
      atRiskAmount: 179,
      collectionsToday: 0,
      dpd: 8,
      carForecastNext30Days: 179,
      carConfidence: "High"
    },
    collectionsPTP: {
      totalCollections: 0,
      recoveryRate: 88,
      cureRate: 92,
      ptpRate: 15,
      ptpHonoredPct: 95,
      ptpBrokenPct: 5,
      ptpCreatedToday: 0
    },
    strategySummary: {
      successRate: 85,
      contactability: 95,
      aiUplift: 12,
      coronability: 78,
      riskUplift: 4
    },
    automationAI: {
      voicebotSuccess: 68,
      dialerConnect: 82,
      disputeCount: 1,
      slaSummary: { openCases: 1, resolved: 0 },
      rpaAutomationRate: 88
    },
    agingBucket: {
      bucket: "1-10 days",
      portfolioSharePct: 0.02,
      severityScore: 8
    },
    carForecast: {
      next7Days: 179,
      next30Days: 179
    },
    alertsAndExceptions: [
      "CRITICAL: Duplicate billing detected",
      "RPA Analysis: Two invoices (INV-2401A, INV-2401B) contain identical charges",
      "System error: Monthly service billed twice on same date",
      "Billing engine logged duplicate transaction IDs"
    ],
    majorRiskDrivers: [
      { driver: "Duplicate charge error", value: 95 },
      { driver: "System billing glitch", value: 88 }
    ],
    codeStrategy: {
      sms: 92,
      dialer: 78,
      email: 65
    },
    collectionsFunnel: {
      sms: { success: 88, uplift: 5.2 },
      dialer: { success: 72, uplift: 4.8 },
      email: { success: 58, uplift: 3.1 }
    },
    dailyCollectionsTrend: {
      dates: ["Jan 10", "Jan 12", "Jan 14", "Jan 16", "Jan 18"],
      actual: [0, 0, 0, 0, 0],
      target: [0, 0, 89, 89, 179]
    },
    invoices: [
      { 
        id: "INV-2401A", 
        date: "2024-01-05", 
        amount: 89.99, 
        dueDate: "2024-01-25", 
        status: "Pending", 
        items: [
          "Business Phone Service - Jan 2024 - $49.99",
          "High-Speed Internet 500Mbps - $40.00"
        ]
      },
      { 
        id: "INV-2401B", 
        date: "2024-01-05", 
        amount: 89.99, 
        dueDate: "2024-01-25", 
        status: "Pending", 
        items: [
          "Business Phone Service - Jan 2024 - $49.99 (DUPLICATE)",
          "High-Speed Internet 500Mbps - $40.00 (DUPLICATE)"
        ]
      },
      { 
        id: "INV-2312", 
        date: "2023-12-05", 
        amount: 89.99, 
        dueDate: "2023-12-25", 
        status: "Paid", 
        items: [
          "Business Phone Service - Dec 2023 - $49.99",
          "High-Speed Internet 500Mbps - $40.00"
        ]
      },
      { 
        id: "INV-2311", 
        date: "2023-11-05", 
        amount: 89.99, 
        dueDate: "2023-11-25", 
        status: "Paid", 
        items: [
          "Business Phone Service - Nov 2023 - $49.99",
          "High-Speed Internet 500Mbps - $40.00"
        ]
      }
    ],
    billingData: [
      { 
        id: "BILL-2401", 
        period: "Jan 2024", 
        totalBilled: 179.98, 
        totalPaid: 0, 
        outstanding: 179.98, 
        services: ["Business Phone (DUPLICATE ERROR)", "Internet"]
      },
      { 
        id: "BILL-2312", 
        period: "Dec 2023", 
        totalBilled: 89.99, 
        totalPaid: 89.99, 
        outstanding: 0, 
        services: ["Business Phone", "Internet"]
      },
      { 
        id: "BILL-2311", 
        period: "Nov 2023", 
        totalBilled: 89.99, 
        totalPaid: 89.99, 
        outstanding: 0, 
        services: ["Business Phone", "Internet"]
      }
    ]
  },
  "CUST-SMB-003": {
    customerId: "CUST-SMB-003",
    name: "Lisa Thompson Retail Business",
    segment: "SMB",
    topMetrics: {
      totalOutstanding: 448,
      atRiskAmount: 448,
      collectionsToday: 0,
      dpd: 18,
      carForecastNext30Days: 448,
      carConfidence: "Medium-High"
    },
    collectionsPTP: {
      totalCollections: 0,
      recoveryRate: 78,
      cureRate: 82,
      ptpRate: 22,
      ptpHonoredPct: 88,
      ptpBrokenPct: 12,
      ptpCreatedToday: 1
    },
    strategySummary: {
      successRate: 75,
      contactability: 88,
      aiUplift: 15,
      coronability: 68,
      riskUplift: 8
    },
    automationAI: {
      voicebotSuccess: 62,
      dialerConnect: 75,
      disputeCount: 1,
      slaSummary: { openCases: 1, resolved: 0 },
      rpaAutomationRate: 85
    },
    agingBucket: {
      bucket: "11-30 days",
      portfolioSharePct: 0.05,
      severityScore: 28
    },
    carForecast: {
      next7Days: 224,
      next30Days: 448
    },
    alertsAndExceptions: [
      "CRITICAL: Loyalty discount not applied",
      "Customer account: 3 years 4 months tenure - Qualifies for LOYALTY-3Y discount",
      "RPA Analysis: Discount code LOYALTY-3Y active but not applied since Dec 2023",
      "System error: Discount engine failure detected on Nov 28, 2023",
      "Expected monthly discount: $45/month ($540/year)"
    ],
    majorRiskDrivers: [
      { driver: "Missing loyalty benefit", value: 82 },
      { driver: "Customer dissatisfaction risk", value: 65 },
      { driver: "System discount error", value: 88 }
    ],
    codeStrategy: {
      sms: 85,
      dialer: 72,
      email: 58
    },
    collectionsFunnel: {
      sms: { success: 78, uplift: 4.5 },
      dialer: { success: 68, uplift: 3.9 },
      email: { success: 52, uplift: 2.8 }
    },
    dailyCollectionsTrend: {
      dates: ["Jan 5", "Jan 10", "Jan 15", "Jan 20", "Jan 25"],
      actual: [0, 0, 0, 0, 0],
      target: [100, 200, 300, 400, 448]
    },
    invoices: [
      { 
        id: "INV-SMB-2401", 
        date: "2024-01-01", 
        amount: 224, 
        dueDate: "2024-01-15", 
        status: "Overdue", 
        items: [
          "Business Premium Plan - $179/month",
          "Multi-line Service (3 lines) - $90",
          "Equipment Rental - $40",
          "MISSING: Loyalty Discount 3-Year (-$45)"
        ]
      },
      { 
        id: "INV-SMB-2312", 
        date: "2023-12-01", 
        amount: 224, 
        dueDate: "2023-12-15", 
        status: "Overdue", 
        items: [
          "Business Premium Plan - $179/month",
          "Multi-line Service (3 lines) - $90",
          "Equipment Rental - $40",
          "MISSING: Loyalty Discount 3-Year (-$45)"
        ]
      },
      { 
        id: "INV-SMB-2311", 
        date: "2023-11-01", 
        amount: 179, 
        dueDate: "2023-11-15", 
        status: "Paid", 
        items: [
          "Business Premium Plan - $179/month",
          "Multi-line Service (3 lines) - $90",
          "Equipment Rental - $40",
          "Loyalty Discount 3-Year - (-$45) ✓ APPLIED"
        ]
      },
      { 
        id: "INV-SMB-2310", 
        date: "2023-10-01", 
        amount: 179, 
        dueDate: "2023-10-15", 
        status: "Paid", 
        items: [
          "Business Premium Plan - $179/month",
          "Multi-line Service (3 lines) - $90",
          "Equipment Rental - $40",
          "Loyalty Discount 3-Year - (-$45) ✓ APPLIED"
        ]
      }
    ],
    billingData: [
      { 
        id: "BILL-2401", 
        period: "Jan 2024", 
        totalBilled: 224, 
        totalPaid: 0, 
        outstanding: 224, 
        services: ["Business Premium", "Multi-line", "Equipment", "DISCOUNT ERROR"]
      },
      { 
        id: "BILL-2312", 
        period: "Dec 2023", 
        totalBilled: 224, 
        totalPaid: 0, 
        outstanding: 224, 
        services: ["Business Premium", "Multi-line", "Equipment", "DISCOUNT ERROR"]
      },
      { 
        id: "BILL-2311", 
        period: "Nov 2023", 
        totalBilled: 179, 
        totalPaid: 179, 
        outstanding: 0, 
        services: ["Business Premium", "Multi-line", "Equipment", "Loyalty Discount"]
      },
      { 
        id: "BILL-2310", 
        period: "Oct 2023", 
        totalBilled: 179, 
        totalPaid: 179, 
        outstanding: 0, 
        services: ["Business Premium", "Multi-line", "Equipment", "Loyalty Discount"]
      }
    ]
  },
  "CUST-ENT-003": {
    customerId: "CUST-ENT-003",
    name: "Robert Martinez Enterprise Corp",
    segment: "Enterprise",
    topMetrics: {
      totalOutstanding: 199,
      atRiskAmount: 199,
      collectionsToday: 0,
      dpd: 5,
      carForecastNext30Days: 199,
      carConfidence: "Very High"
    },
    collectionsPTP: {
      totalCollections: 0,
      recoveryRate: 95,
      cureRate: 98,
      ptpRate: 8,
      ptpHonoredPct: 100,
      ptpBrokenPct: 0,
      ptpCreatedToday: 0
    },
    strategySummary: {
      successRate: 92,
      contactability: 98,
      aiUplift: 5,
      coronability: 85,
      riskUplift: 2
    },
    automationAI: {
      voicebotSuccess: 72,
      dialerConnect: 88,
      disputeCount: 1,
      slaSummary: { openCases: 1, resolved: 0 },
      rpaAutomationRate: 95
    },
    agingBucket: {
      bucket: "1-10 days",
      portfolioSharePct: 0.01,
      severityScore: 5
    },
    carForecast: {
      next7Days: 199,
      next30Days: 199
    },
    alertsAndExceptions: [
      "Customer disputed Premium Plus charge",
      "RPA Analysis: Customer upgraded plan via self-service on Dec 15, 2023",
      "System logs: Upgrade confirmed from device IP matching customer office",
      "Upgrade email confirmation sent to customer primary email",
      "No service downgrade requests logged"
    ],
    majorRiskDrivers: [
      { driver: "Plan upgrade confusion", value: 15 },
      { driver: "Communication gap", value: 8 }
    ],
    codeStrategy: {
      sms: 95,
      dialer: 82,
      email: 68
    },
    collectionsFunnel: {
      sms: { success: 92, uplift: 6.2 },
      dialer: { success: 85, uplift: 5.8 },
      email: { success: 65, uplift: 4.1 }
    },
    dailyCollectionsTrend: {
      dates: ["Jan 15", "Jan 17", "Jan 19", "Jan 21", "Jan 23"],
      actual: [0, 0, 0, 0, 0],
      target: [199, 199, 199, 199, 199]
    },
    invoices: [
      { 
        id: "INV-ENT-2401", 
        date: "2024-01-01", 
        amount: 199, 
        dueDate: "2024-01-20", 
        status: "Pending", 
        items: [
          "Premium Plus Plan - $199/month (Upgraded Dec 15, 2023)"
        ]
      },
      { 
        id: "INV-ENT-2312", 
        date: "2023-12-15", 
        amount: 149.50, 
        dueDate: "2024-01-05", 
        status: "Paid", 
        items: [
          "Basic Plan - $99/month (Dec 1-14: $46.50 prorated)",
          "Premium Plus Plan - $199/month (Dec 15-31: $103 prorated)"
        ]
      },
      { 
        id: "INV-ENT-2311", 
        date: "2023-11-01", 
        amount: 99, 
        dueDate: "2023-11-20", 
        status: "Paid", 
        items: [
          "Basic Plan - $99/month"
        ]
      },
      { 
        id: "INV-ENT-2310", 
        date: "2023-10-01", 
        amount: 99, 
        dueDate: "2023-10-20", 
        status: "Paid", 
        items: [
          "Basic Plan - $99/month"
        ]
      }
    ],
    billingData: [
      { 
        id: "BILL-ENT-2401", 
        period: "Jan 2024", 
        totalBilled: 199, 
        totalPaid: 0, 
        outstanding: 199, 
        services: ["Premium Plus Plan (CUSTOMER UPGRADED)"]
      },
      { 
        id: "BILL-ENT-2312", 
        period: "Dec 2023", 
        totalBilled: 149.50, 
        totalPaid: 149.50, 
        outstanding: 0, 
        services: ["Basic Plan (partial)", "Premium Plus Plan (partial - upgraded)"]
      },
      { 
        id: "BILL-ENT-2311", 
        period: "Nov 2023", 
        totalBilled: 99, 
        totalPaid: 99, 
        outstanding: 0, 
        services: ["Basic Plan"]
      },
      { 
        id: "BILL-ENT-2310", 
        period: "Oct 2023", 
        totalBilled: 99, 
        totalPaid: 99, 
        outstanding: 0, 
        services: ["Basic Plan"]
      }
    ]
  },
  "CUST-SMB-004": {
    customerId: "CUST-SMB-004",
    name: "Jennifer Lee Mobile Account",
    segment: "SMB",
    topMetrics: {
      totalOutstanding: 350,
      atRiskAmount: 350,
      collectionsToday: 0,
      dpd: 12,
      carForecastNext30Days: 0,
      carConfidence: "Low"
    },
    collectionsPTP: {
      totalCollections: 0,
      recoveryRate: 18,
      cureRate: 22,
      ptpRate: 5,
      ptpHonoredPct: 40,
      ptpBrokenPct: 60,
      ptpCreatedToday: 0
    },
    strategySummary: {
      successRate: 25,
      contactability: 52,
      aiUplift: 8,
      coronability: 18,
      riskUplift: 15
    },
    automationAI: {
      voicebotSuccess: 22,
      dialerConnect: 45,
      disputeCount: 1,
      slaSummary: { openCases: 1, resolved: 0 },
      rpaAutomationRate: 78
    },
    agingBucket: {
      bucket: "11-30 days",
      portfolioSharePct: 0.03,
      severityScore: 68
    },
    carForecast: {
      next7Days: 0,
      next30Days: 0
    },
    alertsAndExceptions: [
      "CRITICAL: Early termination fee dispute",
      "RPA Analysis: 24-month contract signed via e-signature on Sep 15, 2022",
      "Contract document ID: CTR-2022-0915-JL",
      "E-signature timestamp: 2022-09-15 14:23:18 UTC",
      "IP Address: 192.168.45.122 (Verified customer location)",
      "Service terminated Jan 8, 2024 (16 months into 24-month contract)",
      "Early termination clause: $350 fee applies (per section 4.2 of contract)"
    ],
    majorRiskDrivers: [
      { driver: "Contract dispute", value: 85 },
      { driver: "Low payment intent", value: 78 },
      { driver: "Service termination", value: 92 }
    ],
    codeStrategy: {
      sms: 68,
      dialer: 55,
      email: 42
    },
    collectionsFunnel: {
      sms: { success: 45, uplift: 2.2 },
      dialer: { success: 38, uplift: 1.8 },
      email: { success: 28, uplift: 1.1 }
    },
    dailyCollectionsTrend: {
      dates: ["Jan 8", "Jan 12", "Jan 17", "Jan 22", "Jan 26"],
      actual: [0, 0, 0, 0, 0],
      target: [0, 100, 200, 300, 350]
    },
    invoices: [
      { 
        id: "INV-TERM-2401", 
        date: "2024-01-08", 
        amount: 350, 
        dueDate: "2024-01-22", 
        status: "Overdue", 
        items: [
          "Early Termination Fee - $350",
          "Contract CTR-2022-0915-JL: 24-month commitment",
          "Service start: Sep 15, 2022",
          "Service end: Jan 8, 2024 (16 months completed)",
          "Remaining contract: 8 months",
          "Per Section 4.2: Early termination = $350 flat fee"
        ]
      },
      { 
        id: "INV-2312", 
        date: "2023-12-01", 
        amount: 75, 
        dueDate: "2023-12-20", 
        status: "Paid", 
        items: [
          "Mobile Service Plan - $75/month"
        ]
      },
      { 
        id: "INV-2311", 
        date: "2023-11-01", 
        amount: 75, 
        dueDate: "2023-11-20", 
        status: "Paid", 
        items: [
          "Mobile Service Plan - $75/month"
        ]
      }
    ],
    billingData: [
      { 
        id: "BILL-TERM-2401", 
        period: "Jan 2024", 
        totalBilled: 350, 
        totalPaid: 0, 
        outstanding: 350, 
        services: ["Early Termination Fee (CONTRACT VALID)"]
      },
      { 
        id: "BILL-2312", 
        period: "Dec 2023", 
        totalBilled: 75, 
        totalPaid: 75, 
        outstanding: 0, 
        services: ["Mobile Service"]
      },
      { 
        id: "BILL-2311", 
        period: "Nov 2023", 
        totalBilled: 75, 
        totalPaid: 75, 
        outstanding: 0, 
        services: ["Mobile Service"]
      }
    ]
  }
};
