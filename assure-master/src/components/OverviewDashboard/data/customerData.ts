export interface PortfolioCustomer {
  customerId: string;
  name: string;
  segment: string;
  totalOutstanding: number;
  dpd: number;
  dpdBucket: string;
  riskScore: number;
  carForecastCustomer: number;
  contactability: number;
  collections: {
    collectedMTD: number;
    recoveryRate: number;
    cureRate: number;
  };
  ptp: {
    ptpCreated: number;
    ptpHonoredPct: number;
    ptpBrokenPct: number;
  };
  strategy: {
    successRate: number;
    aiUplift: number;
    coronability: number;
  };
  automation: {
    voicebotSuccess: number;
    dialerConnect: number;
    rpaAutomationRate: number;
  };
  disputes: {
    disputeCount: number;
    resolved: number;
  };
}

export interface Customer {
  customerId: string;
  name: string;
  status: string;
  riskLevel: string;
  segment?: string;
  dpd?: number;
  totalOutstanding?: number;
  agingBucketContribution?: {
    bucket: string;
    customerSharePct: number;
    severityScore: number;
  };
  carForecastIndividual?: {
    next7Days: number;
    next30Days: number;
    confidence: string;
  };
  alertsAndExceptionsCustomer?: string[];
  majorRiskDriversCustomer?: Record<string, number>;
  codeStrategyMatrixCustomer?: Record<string, number>;
  collectionsFunnelCustomer?: Array<{
    stage: string;
    conversion: number;
    uplift: number;
  }>;
  dailyCollectionsTrendCustomer?: {
    dates: string[];
    actual: number[];
    target: number[];
  };
  accountInformation: {
    contactInformation: {
      phone: string;
      email: string | null;
      address: string;
    };
    contractDetails: {
      planName: string;
      tenureMonths: number;
      latePaymentPenalty: boolean;
      activationDate: string;
    };
  };
  currentMonthUsageBilling: {
    usageSummary: {
      dataUsedGB: number;
      voiceMinutes: number;
      smsCount: number;
      internationalMinutes: number;
    };
    billingBreakdown: {
      basePlan: number;
      deviceFinancing: number;
      roamingCharges: number;
      valueAddedServices: number;
    };
  };
  deviceInformation: {
    deviceModel: string;
    financingBalance: number;
    imei: string;
    monthlyInstallment: number;
  };
  activePaymentPlans: any[];
  paymentHistory: Array<{
    date: string;
    amount: number;
    status: string;
    method: string;
  }>;
  adjustments: Array<{
    date: string;
    type: string;
    amount: number;
    reason: string;
  }>;
  interactions: Array<{
    date: string;
    channel: string;
    agent: string;
    outcome: string;
  }>;
  disputes: any[];
}

export type UnifiedCustomer = Customer | PortfolioCustomer;


export const customersData: Customer[] = [
  {
    customerId: "CUST-CON-001",
    name: "David Brown",
    status: "Current",
    riskLevel: "Low Risk",
    segment: "Consumer",
    dpd: 20,
    totalOutstanding: 280,
    agingBucketContribution: {
      bucket: "0-30",
      customerSharePct: 0.02,
      severityScore: 22,
    },
    carForecastIndividual: {
      next7Days: 110,
      next30Days: 190,
      confidence: "Very High",
    },
    alertsAndExceptionsCustomer: [
      "Customer requested bill copy.",
      "Very high SMS open rate.",
    ],
    majorRiskDriversCustomer: {
      "Temporary Liquidity": 12,
      "Minor Delays": 8,
    },
    codeStrategyMatrixCustomer: {
      SMS: 84,
      Email: 49,
    },
    collectionsFunnelCustomer: [
      { stage: "SMS", conversion: 78, uplift: 3.1 },
      { stage: "Email", conversion: 55, uplift: 2.0 },
    ],
    dailyCollectionsTrendCustomer: {
      dates: ["Feb 1", "Feb 5"],
      actual: [0.04, 0.08],
      target: [0.03, 0.07],
    },
    accountInformation: {
      contactInformation: {
        phone: "+97150XXXX100",
        email: null,
        address: "Dubai Marina, UAE",
      },
      contractDetails: {
        planName: "Mobile Postpaid Plan 200",
        tenureMonths: 14,
        latePaymentPenalty: true,
        activationDate: "2023-09-01",
      },
    },
    currentMonthUsageBilling: {
      usageSummary: {
        dataUsedGB: 18,
        voiceMinutes: 210,
        smsCount: 35,
        internationalMinutes: 0,
      },
      billingBreakdown: {
        basePlan: 295,
        deviceFinancing: 0,
        roamingCharges: 20,
        valueAddedServices: 15,
      },
    },
    deviceInformation: {
      deviceModel: "Samsung Galaxy S23",
      financingBalance: 0,
      imei: "••••••••8121",
      monthlyInstallment: 0,
    },
    activePaymentPlans: [],
    paymentHistory: [
      { date: "2024-10-10", amount: 150, status: "paid", method: "Wallet" },
      { date: "2024-09-05", amount: 290, status: "paid", method: "Credit Card" },
    ],
    adjustments: [],
    interactions: [
      {
        date: "2024-10-23",
        channel: "SMS",
        agent: "System",
        outcome: "Payment link delivered.",
      },
    ],
    disputes: [],
  },

  {
    customerId: "CUST-CON-002",
    name: "Sarah Mitchell",
    status: "Past Due",
    riskLevel: "Medium Risk",
    segment: "Consumer",
    dpd: 45,
    totalOutstanding: 650,
    agingBucketContribution: {
      bucket: "31-60",
      customerSharePct: 0.05,
      severityScore: 46,
    },
    carForecastIndividual: {
      next7Days: 190,
      next30Days: 420,
      confidence: "High",
    },
    alertsAndExceptionsCustomer: [
      "Voicemail left with payment link.",
      "Missed previous dialer attempt.",
    ],
    majorRiskDriversCustomer: {
      "Payment Delays": 31,
      "Moderate Contactability": 19,
    },
    codeStrategyMatrixCustomer: {
      SMS: 72,
      Dialer: 59,
      Email: 31,
    },
    collectionsFunnelCustomer: [
      { stage: "SMS", conversion: 64, uplift: 2.2 },
      { stage: "Dialer", conversion: 48, uplift: 4.4 },
      { stage: "Email", conversion: 28, uplift: 1.5 },
    ],
    dailyCollectionsTrendCustomer: {
      dates: ["Feb 1", "Feb 10"],
      actual: [0.06, 0.14],
      target: [0.08, 0.17],
    },
    accountInformation: {
      contactInformation: {
        phone: "+97150XXXX101",
        email: null,
        address: "Ajman City Center, UAE",
      },
      contractDetails: {
        planName: "Mobile Postpaid Plan 200",
        tenureMonths: 8,
        latePaymentPenalty: true,
        activationDate: "2024-03-10",
      },
    },
    currentMonthUsageBilling: {
      usageSummary: {
        dataUsedGB: 9,
        voiceMinutes: 110,
        smsCount: 12,
        internationalMinutes: 0,
      },
      billingBreakdown: {
        basePlan: 310,
        deviceFinancing: 0,
        roamingCharges: 0,
        valueAddedServices: 10,
      },
    },
    deviceInformation: {
      deviceModel: "Xiaomi Redmi Note 12",
      financingBalance: 0,
      imei: "••••••••4511",
      monthlyInstallment: 0,
    },
    activePaymentPlans: [],
    paymentHistory: [
      { date: "2024-09-20", amount: 0, status: "missed", method: "Auto Pay" },
      { date: "2024-08-20", amount: 310, status: "paid", method: "Credit Card" },
    ],
    adjustments: [
      { date: "2024-09-25", type: "Late Fee Applied", amount: 25, reason: "Missed payment" },
    ],
    interactions: [
      { date: "2024-10-30", channel: "SMS", agent: "System", outcome: "Payment reminder delivered." },
      { date: "2024-10-28", channel: "Email", agent: "System", outcome: "Invoice reminder sent." },
    ],
    disputes: [],
  },

  {
    customerId: "CUST-CON-003",
    name: "John Anderson",
    status: "Past Due",
    riskLevel: "High Risk",
    segment: "Consumer",
    dpd: 110,
    totalOutstanding: 1380,
    agingBucketContribution: {
      bucket: "90+",
      customerSharePct: 0.12,
      severityScore: 88,
    },
    carForecastIndividual: {
      next7Days: 190,
      next30Days: 540,
      confidence: "Medium",
    },
    alertsAndExceptionsCustomer: [
      "High-risk bucket for 3 cycles.",
      "Suggested 2-part settlement.",
    ],
    majorRiskDriversCustomer: {
      "High Delinquency": 38,
      "Low Contactability": 27,
    },
    codeStrategyMatrixCustomer: {
      SMS: 61,
      Dialer: 47,
      VA: 33,
    },
    collectionsFunnelCustomer: [
      { stage: "SMS", conversion: 52, uplift: 3.1 },
      { stage: "Dialer", conversion: 39, uplift: 4.2 },
      { stage: "VA", conversion: 22, uplift: 5.1 },
    ],
    dailyCollectionsTrendCustomer: {
      dates: ["Feb 1", "Feb 10"],
      actual: [0.07, 0.16],
      target: [0.09, 0.19],
    },
    accountInformation: {
      contactInformation: {
        phone: "+97150XXXX102",
        email: "fatima.zahra@mail.com",
        address: "Sharjah Al Majaz, UAE",
      },
      contractDetails: {
        planName: "Mobile Postpaid Plan 200",
        tenureMonths: 22,
        latePaymentPenalty: false,
        activationDate: "2022-12-01",
      },
    },
    currentMonthUsageBilling: {
      usageSummary: {
        dataUsedGB: 12,
        voiceMinutes: 180,
        smsCount: 22,
        internationalMinutes: 5,
      },
      billingBreakdown: {
        basePlan: 265,
        deviceFinancing: 0,
        roamingCharges: 15,
        valueAddedServices: 10,
      },
    },
    deviceInformation: {
      deviceModel: "iPhone 13",
      financingBalance: 0,
      imei: "••••••••7199",
      monthlyInstallment: 0,
    },
    activePaymentPlans: [],
    paymentHistory: [
      { date: "2024-10-05", amount: 265, status: "paid", method: "Credit Card" },
      { date: "2024-09-05", amount: 265, status: "paid", method: "Credit Card" },
    ],
    adjustments: [],
    interactions: [
      { date: "2024-10-01", channel: "Email", agent: "System", outcome: "Monthly bill delivered." },
    ],
    disputes: [],
  },
];


export const portfolioCustomersData: PortfolioCustomer[] = [
  {
    customerId: "CUST-ENT-001",
    name: "Alpha Logistics LLC",
    segment: "Enterprise",
    totalOutstanding: 243300,
    dpd: 68,
    dpdBucket: "61-90",
    riskScore: 78,
    carForecastCustomer: 0.74,
    contactability: 68,
    collections: {
      collectedMTD: 80000,
      recoveryRate: 33,
      cureRate: 41,
    },
    ptp: {
      ptpCreated: 1,
      ptpHonoredPct: 100,
      ptpBrokenPct: 0,
    },
    strategy: {
      successRate: 42,
      aiUplift: 21,
      coronability: 17,
    },
    automation: {
      voicebotSuccess: 38,
      dialerConnect: 41,
      rpaAutomationRate: 81,
    },
    disputes: {
      disputeCount: 1,
      resolved: 0,
    },
  },

  {
    customerId: "CUST-ENT-002",
    name: "Gulf PetroTech",
    segment: "Enterprise",
    totalOutstanding: 167900,
    dpd: 45,
    dpdBucket: "31-60",
    riskScore: 65,
    carForecastCustomer: 0.62,
    contactability: 72,
    collections: {
      collectedMTD: 45000,
      recoveryRate: 29,
      cureRate: 36,
    },
    ptp: {
      ptpCreated: 1,
      ptpHonoredPct: 0,
      ptpBrokenPct: 100,
    },
    strategy: {
      successRate: 39,
      aiUplift: 14,
      coronability: 15,
    },
    automation: {
      voicebotSuccess: 21,
      dialerConnect: 39,
      rpaAutomationRate: 71,
    },
    disputes: {
      disputeCount: 0,
      resolved: 0,
    },
  },

  {
    customerId: "CUST-ENT-003",
    name: "SkyNet FZE",
    segment: "Enterprise",
    totalOutstanding: 389500,
    dpd: 120,
    dpdBucket: "91-180",
    riskScore: 84,
    carForecastCustomer: 0.51,
    contactability: 58,
    collections: {
      collectedMTD: 0,
      recoveryRate: 0,
      cureRate: 18,
    },
    ptp: {
      ptpCreated: 0,
      ptpHonoredPct: 0,
      ptpBrokenPct: 0,
    },
    strategy: {
      successRate: 22,
      aiUplift: 11,
      coronability: 9,
    },
    automation: {
      voicebotSuccess: 19,
      dialerConnect: 33,
      rpaAutomationRate: 60,
    },
    disputes: {
      disputeCount: 1,
      resolved: 0,
    },
  },

  {
    customerId: "CUST-ENT-004",
    name: "Desert Telecom Solutions",
    segment: "Enterprise",
    totalOutstanding: 58000,
    dpd: 12,
    dpdBucket: "0-30",
    riskScore: 49,
    carForecastCustomer: 0.88,
    contactability: 75,
    collections: {
      collectedMTD: 12000,
      recoveryRate: 22,
      cureRate: 71,
    },
    ptp: {
      ptpCreated: 0,
      ptpHonoredPct: 0,
      ptpBrokenPct: 0,
    },
    strategy: {
      successRate: 52,
      aiUplift: 18,
      coronability: 22,
    },
    automation: {
      voicebotSuccess: 28,
      dialerConnect: 44,
      rpaAutomationRate: 79,
    },
    disputes: {
      disputeCount: 0,
      resolved: 0,
    },
  },

  {
    customerId: "CUST-SMB-001",
    name: "Sunrise Pharmacy",
    segment: "SMB",
    totalOutstanding: 2200,
    dpd: 42,
    dpdBucket: "31-60",
    riskScore: 62,
    carForecastCustomer: 0.66,
    contactability: 70,
    collections: {
      collectedMTD: 2000,
      recoveryRate: 48,
      cureRate: 55,
    },
    ptp: {
      ptpCreated: 1,
      ptpHonoredPct: 100,
      ptpBrokenPct: 0,
    },
    strategy: {
      successRate: 43,
      aiUplift: 9,
      coronability: 12,
    },
    automation: {
      voicebotSuccess: 20,
      dialerConnect: 36,
      rpaAutomationRate: 54,
    },
    disputes: {
      disputeCount: 0,
      resolved: 0,
    },
  },

  {
    customerId: "CUST-SMB-002",
    name: "Star Foods LLC",
    segment: "SMB",
    totalOutstanding: 4200,
    dpd: 15,
    dpdBucket: "0-30",
    riskScore: 55,
    carForecastCustomer: 0.82,
    contactability: 78,
    collections: {
      collectedMTD: 4200,
      recoveryRate: 100,
      cureRate: 92,
    },
    ptp: {
      ptpCreated: 0,
      ptpHonoredPct: 0,
      ptpBrokenPct: 0,
    },
    strategy: {
      successRate: 58,
      aiUplift: 6,
      coronability: 16,
    },
    automation: {
      voicebotSuccess: 27,
      dialerConnect: 41,
      rpaAutomationRate: 63,
    },
    disputes: {
      disputeCount: 0,
      resolved: 0,
    },
  },

  {
    customerId: "CUST-GOV-001",
    name: "Transport Regulation Dept",
    segment: "Government",
    totalOutstanding: 500000,
    dpd: 38,
    dpdBucket: "31-60",
    riskScore: 30,
    carForecastCustomer: 0.89,
    contactability: 90,
    collections: {
      collectedMTD: 120000,
      recoveryRate: 24,
      cureRate: 78,
    },
    ptp: {
      ptpCreated: 0,
      ptpHonoredPct: 0,
      ptpBrokenPct: 0,
    },
    strategy: {
      successRate: 61,
      aiUplift: 15,
      coronability: 26,
    },
    automation: {
      voicebotSuccess: 25,
      dialerConnect: 53,
      rpaAutomationRate: 84,
    },
    disputes: {
      disputeCount: 0,
      resolved: 0,
    },
  },
];

export const unifiedCustomersData = [
  ...customersData.map((c) => ({
    ...c,
    isPortfolio: false,   // flag for consumer customers
  })),
  ...portfolioCustomersData.map((c) => ({
    ...c,
    isPortfolio: true,    // flag for enterprise/SMB/government customers
  })),
];
