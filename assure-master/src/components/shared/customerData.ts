// Shared customer data across all modules - 5 consistent customers
import { getAgentBySegment } from './agentData';

export const SHARED_CUSTOMERS = [
  {
    id: "CUST001",
    name: "John Anderson",
    email: "john.anderson@email.com",
    phone: "+1-555-0123",
    segment: "Premium",
    riskBand: "medium",
    customerType: "normal",
    primaryAgent: "AGT001", // Sarah Wilson
    currentDue: 800,
    overdueAmount: 800,
    lastPaymentDate: "2024-01-10",
    totalOutstanding: 2500,
    contractPlan: "Premium Package",
    tenure: "36 months",
    activationDate: "2021-06-15",
    accountStatus: "Past Due",
    devicePlan: "iPhone 15 Pro",
    billedAmount: 3300,
    paidToDate: 2500,
    currentBalance: 800,
    usageThisMonth: { calls: 450, data: "35GB", sms: 120 },
    // Service Usage Data
    monthlyDataLimit: "50GB",
    dataUsedLastMonth: "35GB",
    voiceMinutesUsed: "450 mins",
    smsCount: "120 SMS",
    roamingCharges: 50,
    valueAddedServices: ["Netflix", "Apple Music"],
    deviceFinancing: {
      device: "iPhone 15 Pro",
      remainingBalance: 500,
      monthlyInstallment: 50
    },
    serviceStatus: "Active",
    basePlan: 120,
    overageCharges: 30,
    internationalCharges: 0,
    vasCharges: 25,
    paymentHistory: [
      { date: "2024-01-15", amount: 0, status: "missed", method: "Auto Pay" },
      { date: "2023-12-15", amount: 150, status: "paid", method: "Credit Card" },
      { date: "2023-11-15", amount: 150, status: "paid", method: "Bank Transfer" },
      { date: "2023-10-20", amount: 150, status: "late", method: "Credit Card" },
      { date: "2023-09-15", amount: 150, status: "paid", method: "Auto Pay" },
      { date: "2023-08-15", amount: 150, status: "paid", method: "Credit Card" }
    ],
    dunningActions: [
      { date: "2024-01-25", action: "SMS Reminder", status: "sent" },
      { date: "2024-01-20", action: "Email Notice", status: "delivered" },
      { date: "2024-01-15", action: "Phone Call", status: "connected" }
    ],
    address: "123 Main St, New York, NY 10001",
    milestones: [
      {
        id: "MS001",
        type: "Payment Plan Setup",
        status: "completed",
        date: "2024-01-25",
        description: "Customer enrolled in 3-month payment plan",
        completedBy: "John Smith"
      },
      {
        id: "MS002", 
        type: "First Payment Due",
        status: "upcoming",
        date: "2024-02-01",
        description: "First installment payment due: $833.33"
      }
    ],
    interactions: [
      {
        date: "2024-01-25",
        type: "Phone Call",
        agent: "John Smith",
        note: "Customer experiencing temporary financial hardship due to medical bills. Agreed to payment plan.",
        outcome: "Payment plan established"
      },
      {
        date: "2024-01-20",
        type: "Email",
        agent: "System",
        note: "Automated overdue notice sent for $800 outstanding balance.",
        outcome: "Delivered"
      },
      {
        date: "2024-01-15",
        type: "SMS",
        agent: "System", 
        note: "Payment reminder sent via SMS.",
        outcome: "Delivered"
      }
    ],
    disputes: [
      {
        id: "DISP001",
        type: "Billing Dispute",
        status: "resolved",
        dateCreated: "2024-01-10",
        dateResolved: "2024-01-15",
        amount: 25,
        description: "Customer disputed late fee charges",
        resolution: "Late fee waived as goodwill gesture",
        resolvedBy: "John Smith"
      }
    ],
    notes: [
      {
        id: "NOTE001",
        date: "2024-01-25",
        type: "Payment Plan",
        priority: "high",
        author: "John Smith",
        content: "Customer set up on 3-month payment plan due to medical expenses. Very cooperative and committed to payments. Next payment due 2/1/24."
      },
      {
        id: "NOTE002", 
        date: "2024-01-20",
        type: "Account Review",
        priority: "medium",
        author: "System",
        content: "Account flagged for follow-up due to missed January payment. Customer has good payment history prior to this month."
      }
    ],
    adjustments: [
      { date: "2024-01-10", type: "Late Fee Waiver", amount: -25, reason: "Goodwill gesture" },
      { date: "2023-12-05", type: "Processing Fee", amount: 15, reason: "Payment processing" }
    ],
    paymentPlans: [
      {
        id: "PP001",
        startDate: "2024-02-01",
        endDate: "2024-05-01",
        totalAmount: 2500,
        installments: 3,
        monthlyAmount: 833.33,
        status: "active"
      }
    ]
  },
  {
    id: "CUST002",
    name: "Sarah Mitchell",
    email: "sarah.mitchell@email.com",
    phone: "+1-555-0124",
    segment: "Business",
    riskBand: "high",
    customerType: "normal",
    primaryAgent: "AGT002", // Mike Johnson
    currentDue: 1200,
    overdueAmount: 1200,
    lastPaymentDate: "2023-12-10",
    totalOutstanding: 3600,
    contractPlan: "Business Broadband",
    tenure: "24 months",
    activationDate: "2022-03-15",
    accountStatus: "Delinquent",
    devicePlan: "Samsung Galaxy S24",
    billedAmount: 4800,
    paidToDate: 2400,
    currentBalance: 1200,
    usageThisMonth: { calls: 680, data: "50GB", sms: 200 },
    // Service Usage Data
    monthlyDataLimit: "75GB",
    dataUsedLastMonth: "68GB",
    voiceMinutesUsed: "680 mins",
    smsCount: "200 SMS",
    roamingCharges: 120,
    valueAddedServices: ["Office 365", "Teams Premium"],
    deviceFinancing: {
      device: "Samsung Galaxy S24",
      remainingBalance: 400,
      monthlyInstallment: 35
    },
    serviceStatus: "Suspended",
    basePlan: 180,
    overageCharges: 45,
    internationalCharges: 85,
    vasCharges: 40,
    paymentHistory: [
      { date: "2024-01-13", amount: 0, status: "missed", method: "Auto Pay" },
      { date: "2023-12-20", amount: 200, status: "partial", method: "Bank Transfer" },
      { date: "2023-11-15", amount: 400, status: "paid", method: "Credit Card" },
      { date: "2023-10-15", amount: 400, status: "paid", method: "Credit Card" },
      { date: "2023-09-22", amount: 400, status: "late", method: "Bank Transfer" },
      { date: "2023-08-15", amount: 400, status: "paid", method: "Auto Pay" }
    ],
    dunningActions: [
      { date: "2024-01-22", action: "Legal Notice", status: "sent" },
      { date: "2024-01-19", action: "Final Demand", status: "delivered" },
      { date: "2024-01-15", action: "Phone Call", status: "connected" }
    ],
    address: "456 Oak Ave, Los Angeles, CA 90210",
    milestones: [
      {
        id: "MS003",
        type: "Service Suspension",
        status: "completed", 
        date: "2024-01-20",
        description: "Service suspended due to non-payment",
        completedBy: "System"
      },
      {
        id: "MS004",
        type: "Legal Notice Sent",
        status: "completed",
        date: "2024-01-22", 
        description: "Final legal notice dispatched",
        completedBy: "Collections Team"
      },
      {
        id: "MS005",
        type: "Dispute Resolution",
        status: "in_progress",
        date: "2024-01-25",
        description: "Billing dispute under investigation"
      }
    ],
    interactions: [
      {
        date: "2024-01-22",
        type: "Email",
        agent: "Mike Johnson",
        note: "Customer disputes recent charges. Investigation initiated.",
        outcome: "Dispute case opened"
      },
      {
        date: "2024-01-19",
        type: "Phone Call",
        agent: "Mike Johnson", 
        note: "Attempted contact regarding overdue balance. Customer did not answer.",
        outcome: "No contact"
      },
      {
        date: "2024-01-15",
        type: "Letter",
        agent: "System",
        note: "Final demand notice sent via certified mail.",
        outcome: "Delivered"
      },
      {
        date: "2024-01-10",
        type: "SMS",
        agent: "System",
        note: "Payment reminder sent. Customer replied requesting dispute information.",
        outcome: "Customer response received"
      }
    ],
    disputes: [
      {
        id: "DISP002",
        type: "Service Charges",
        status: "in_progress",
        dateCreated: "2024-01-22",
        amount: 200,
        description: "Customer disputes international roaming charges from December",
        assignedTo: "Mike Johnson",
        priority: "high"
      },
      {
        id: "DISP003",
        type: "Overage Fees", 
        status: "under_review",
        dateCreated: "2024-01-18",
        amount: 45,
        description: "Data overage charges disputed - customer claims plan includes unlimited data",
        assignedTo: "Billing Team"
      }
    ],
    notes: [
      {
        id: "NOTE003",
        date: "2024-01-22",
        type: "Dispute",
        priority: "high", 
        author: "Mike Johnson",
        content: "Customer disputing $200 in international charges. Reviewing call logs and usage data. Customer seems genuine but account shows suspicious roaming activity."
      },
      {
        id: "NOTE004",
        date: "2024-01-20",
        type: "Service Action",
        priority: "medium",
        author: "System",
        content: "Service suspended due to 45+ days overdue. Legal notice process initiated. Account flagged for escalation to collections agency if no payment by month end."
      },
      {
        id: "NOTE005",
        date: "2024-01-15",
        type: "Collection",
        priority: "high",
        author: "Collections Team",
        content: "Final demand sent. Customer has high-value business account but payment pattern deteriorating. Recommend urgent contact attempt before legal action."
      }
    ],
    adjustments: [
      { date: "2024-01-05", type: "Dispute Credit", amount: -100, reason: "Billing error correction" }
    ],
    paymentPlans: []
  },
  {
    id: "CUST003",
    name: "Michael Rodriguez",
    email: "michael.rodriguez@email.com",
    phone: "+1-555-0125",
    segment: "Enterprise",
    riskBand: "low",
    customerType: "enterprise",
    primaryAgent: "AGT003", // Jennifer Lee
    currentDue: 0,
    overdueAmount: 0,
    lastPaymentDate: "2024-01-25",
    totalOutstanding: 0,
    contractPlan: "Enterprise Suite",
    tenure: "12 months",
    activationDate: "2023-02-01",
    accountStatus: "Current",
    devicePlan: "iPhone 15 Pro Max",
    billedAmount: 9600,
    paidToDate: 9600,
    currentBalance: 0,
    usageThisMonth: { calls: 1200, data: "100GB", sms: 500 },
    // Service Usage Data
    monthlyDataLimit: "Unlimited",
    dataUsedLastMonth: "125GB",
    voiceMinutesUsed: "1200 mins",
    smsCount: "500 SMS",
    roamingCharges: 200,
    valueAddedServices: ["Microsoft 365", "Security Suite", "VPN"],
    deviceFinancing: {
      device: "iPhone 15 Pro Max",
      remainingBalance: 0,
      monthlyInstallment: 0
    },
    serviceStatus: "Active",
    basePlan: 600,
    overageCharges: 0,
    internationalCharges: 150,
    vasCharges: 100,
    paymentHistory: [
      { date: "2024-01-25", amount: 800, status: "paid", method: "Bank Transfer" },
      { date: "2023-12-25", amount: 800, status: "paid", method: "Bank Transfer" },
      { date: "2023-11-25", amount: 800, status: "paid", method: "Bank Transfer" },
      { date: "2023-10-25", amount: 800, status: "paid", method: "Bank Transfer" },
      { date: "2023-09-25", amount: 800, status: "paid", method: "Bank Transfer" },
      { date: "2023-08-25", amount: 800, status: "paid", method: "Bank Transfer" }
    ],
    dunningActions: [],
    address: "789 Business Blvd, Chicago, IL 60601",
    interactions: [
      {
        date: "2024-01-20",
        type: "Account Review",
        agent: "Jennifer Lee",
        note: "Regular account review. Customer satisfied with service."
      }
    ],
    adjustments: [],
    paymentPlans: []
  },
  {
    id: "CUST004",
    name: "Emily Chen",
    email: "emily.chen@email.com",
    phone: "+1-555-0126",
    segment: "Premium",
    riskBand: "low",
    customerType: "normal",
    primaryAgent: "AGT004", // Robert Kim
    currentDue: 320,
    overdueAmount: 0,
    lastPaymentDate: "2024-01-20",
    totalOutstanding: 320,
    contractPlan: "Premium Mobile",
    tenure: "18 months",
    activationDate: "2022-07-10",
    accountStatus: "Current",
    devicePlan: "Google Pixel 8 Pro",
    billedAmount: 5760,
    paidToDate: 5440,
    currentBalance: 320,
    usageThisMonth: { calls: 320, data: "25GB", sms: 80 },
    // Service Usage Data
    monthlyDataLimit: "40GB",
    dataUsedLastMonth: "22GB",
    voiceMinutesUsed: "320 mins",
    smsCount: "80 SMS",
    roamingCharges: 0,
    valueAddedServices: ["Spotify", "YouTube Premium"],
    deviceFinancing: {
      device: "Google Pixel 8 Pro",
      remainingBalance: 200,
      monthlyInstallment: 25
    },
    serviceStatus: "Active",
    basePlan: 95,
    overageCharges: 0,
    internationalCharges: 0,
    vasCharges: 20,
    paymentHistory: [
      { date: "2024-01-20", amount: 320, status: "paid", method: "Credit Card" },
      { date: "2023-12-20", amount: 320, status: "paid", method: "Credit Card" },
      { date: "2023-11-20", amount: 320, status: "paid", method: "Auto Pay" },
      { date: "2023-10-20", amount: 320, status: "paid", method: "Credit Card" },
      { date: "2023-09-20", amount: 320, status: "paid", method: "Credit Card" },
      { date: "2023-08-20", amount: 320, status: "paid", method: "Auto Pay" }
    ],
    dunningActions: [],
    address: "321 Tech Avenue, Seattle, WA 98101",
    milestones: [
      {
        id: "MS006",
        type: "Service Upgrade",
        status: "completed",
        date: "2024-01-18",
        description: "Successfully upgraded to unlimited data plan",
        completedBy: "Robert Kim"
      },
      {
        id: "MS007",
        type: "Device Payment Complete",
        status: "upcoming",
        date: "2024-08-20",
        description: "Final device payment scheduled"
      }
    ],
    interactions: [
      {
        date: "2024-01-18",
        type: "Service Upgrade",
        agent: "Robert Kim",
        note: "Customer upgraded to unlimited data plan.",
        outcome: "Plan upgraded successfully"
      },
      {
        date: "2024-01-10",
        type: "Phone Call",
        agent: "Robert Kim",
        note: "Customer called to inquire about data overage fees. Recommended plan upgrade.",
        outcome: "Upgrade scheduled"
      },
      {
        date: "2023-12-15",
        type: "Account Review",
        agent: "System",
        note: "Regular account review - customer in good standing with consistent payments.",
        outcome: "No action required"
      }
    ],
    disputes: [],
    notes: [
      {
        id: "NOTE006",
        date: "2024-01-18",
        type: "Service Change",
        priority: "low",
        author: "Robert Kim",
        content: "Customer upgraded to unlimited data plan. Very satisfied with service. Excellent payment history, no concerns."
      },
      {
        id: "NOTE007",
        date: "2024-01-10",
        type: "Customer Service",
        priority: "low",
        author: "Robert Kim",
        content: "Customer inquiry about data usage. Provided usage tips and plan options. Customer appreciates proactive service."
      }
    ],
    adjustments: [],
    paymentPlans: []
  },
  {
    id: "CUST005",
    name: "David Brown",
    email: "david.brown@email.com",
    phone: "+1-555-0127",
    segment: "Standard",
    riskBand: "medium",
    customerType: "normal",
    primaryAgent: "AGT005", // Lisa Davis
    currentDue: 600,
    overdueAmount: 150,
    lastPaymentDate: "2024-01-05",
    totalOutstanding: 1350,
    contractPlan: "Standard Package",
    tenure: "24 months",
    activationDate: "2022-01-20",
    accountStatus: "Past Due",
    devicePlan: "Samsung Galaxy A54",
    billedAmount: 3600,
    paidToDate: 2250,
    currentBalance: 600,
    usageThisMonth: { calls: 280, data: "15GB", sms: 150 },
    // Service Usage Data
    monthlyDataLimit: "20GB",
    dataUsedLastMonth: "18GB",
    voiceMinutesUsed: "280 mins",
    smsCount: "150 SMS",
    roamingCharges: 30,
    valueAddedServices: ["Music Streaming"],
    deviceFinancing: {
      device: "Samsung Galaxy A54",
      remainingBalance: 150,
      monthlyInstallment: 20
    },
    serviceStatus: "Active",
    basePlan: 65,
    overageCharges: 15,
    internationalCharges: 10,
    vasCharges: 12,
    paymentHistory: [
      { date: "2024-01-15", amount: 0, status: "missed", method: "Auto Pay" },
      { date: "2023-12-15", amount: 450, status: "paid", method: "Bank Transfer" },
      { date: "2023-11-23", amount: 450, status: "late", method: "Credit Card" },
      { date: "2023-10-15", amount: 450, status: "paid", method: "Auto Pay" },
      { date: "2023-09-15", amount: 450, status: "paid", method: "Credit Card" },
      { date: "2023-08-15", amount: 450, status: "paid", method: "Auto Pay" }
    ],
    dunningActions: [
      { date: "2024-01-28", action: "SMS Reminder", status: "sent" },
      { date: "2024-01-23", action: "Email Notice", status: "delivered" }
    ],
    address: "654 Suburban Lane, Houston, TX 77001",
    milestones: [
      {
        id: "MS008",
        type: "Payment Plan Request",
        status: "pending_approval",
        date: "2024-01-25",
        description: "Customer requested 3-month payment plan for outstanding balance",
        requestedBy: "Lisa Davis"
      },
      {
        id: "MS009",
        type: "Late Fee Applied",
        status: "completed",
        date: "2024-01-12",
        description: "Late fee of $25 applied to account",
        completedBy: "System"
      }
    ],
    interactions: [
      {
        date: "2024-01-15",
        type: "Payment Reminder",
        agent: "Lisa Davis", 
        note: "Customer acknowledged missed payment, committed to pay by month end.",
        outcome: "Customer commitment received"
      },
      {
        date: "2024-01-12",
        type: "Phone Call",
        agent: "Lisa Davis",
        note: "Called regarding overdue payment. Customer explained temporary financial difficulty.",
        outcome: "Payment plan discussion initiated"
      },
      {
        date: "2024-01-08",
        type: "Email",
        agent: "System",
        note: "Automated payment reminder sent for missed January payment.",
        outcome: "Delivered"
      }
    ],
    disputes: [
      {
        id: "DISP004",
        type: "Late Fee Dispute",
        status: "resolved",
        dateCreated: "2024-01-13",
        dateResolved: "2024-01-15",
        amount: 25,
        description: "Customer disputed late fee claiming payment was submitted on time",
        resolution: "Late fee upheld - payment received after due date",
        resolvedBy: "Lisa Davis"
      }
    ],
    notes: [
      {
        id: "NOTE008",
        date: "2024-01-25",
        type: "Payment Plan",
        priority: "medium",
        author: "Lisa Davis",
        content: "Customer experiencing temporary financial hardship. Requesting 3-month payment plan. Good payment history overall, recommend approval."
      },
      {
        id: "NOTE009",
        date: "2024-01-15",
        type: "Customer Contact",
        priority: "medium",
        author: "Lisa Davis",
        content: "Customer was cooperative and understanding about situation. Committed to payment by month end. Will follow up if needed."
      },
      {
        id: "NOTE010",
        date: "2024-01-12",
        type: "Account Status",
        priority: "high",
        author: "System",
        content: "Account flagged for collections risk. Customer has medium risk profile but showing payment pattern deterioration."
      }
    ],
    adjustments: [
      { date: "2024-01-12", type: "Late Fee", amount: 25, reason: "Payment overdue" }
    ],
    paymentPlans: [
      {
        id: "PP005",
        startDate: "2024-02-01",
        endDate: "2024-04-01",
        totalAmount: 1350,
        installments: 3,
        monthlyAmount: 450,
        status: "pending"
      }
    ]
  }
];