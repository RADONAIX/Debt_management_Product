import type {
  AddOn,
  BillSummary,
  Conversation,
  DailyUsage,
  NetworkStatus,
  Offer,
  PaymentRecord,
  PlanOption,
  RechargePack,
  RoamingPack,
  ServiceRequest,
  SubscriberProfile,
  UsageAnomaly,
  UsageBucket,
} from "./telecom-types";

export const OPERATOR = {
  name: "NovaTel",
  tagline: "Subscriber Self-Service",
  supportNumber: "198",
};

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी" },
  { code: "ta", label: "தமிழ்" },
  { code: "te", label: "తెలుగు" },
  { code: "mr", label: "मराठी" },
];

export const subscriber: SubscriberProfile = {
  name: "Arjun Rao",
  msisdn: "+91 9845673210",
  customerId: "NTL-4417-88203",
  customerType: "Postpaid",
  plan: "Infinity 799 5G",
  planPrice: 799,
  accountStatus: "Active",
  balance: 245.5,
  dataUsedGb: 72,
  dataTotalGb: 100,
  voiceMinutesLeft: "Unlimited",
  smsLeft: 1840,
  billDueDate: "18 August 2026",
  billAmount: 1126,
  loyaltyTier: "Gold",
  loyaltyPoints: 12450,
  kycStatus: "Verified",
  networkType: "5G",
  simStatus: "Active",
  circle: "Karnataka",
  activeSince: "14 March 2019",
  activeServices: [
    "5G Data",
    "International Roaming (inactive)",
    "Caller Tunes",
    "NovaTel Play Premium",
    "Value Added SMS Pack",
  ],
  email: "arjun.rao@example.com",
};

export const usageBuckets: UsageBucket[] = [
  { label: "Data", used: 72, total: 100, unit: "GB" },
  { label: "Voice", used: 486, total: "Unlimited", unit: "min" },
  { label: "SMS", used: 160, total: 2000, unit: "SMS" },
  { label: "NovaTel Play", used: 14, total: 30, unit: "hrs" },
];

export const dailyUsage: DailyUsage[] = [
  { day: "Jul 30", gb: 2.4 },
  { day: "Jul 31", gb: 3.1 },
  { day: "Aug 01", gb: 2.8 },
  { day: "Aug 02", gb: 4.6 },
  { day: "Aug 03", gb: 3.9 },
  { day: "Aug 04", gb: 6.2 },
  { day: "Aug 05", gb: 5.4 },
];

export const rechargePacks: RechargePack[] = [
  {
    id: "RC-199",
    amount: 199,
    validityDays: 28,
    data: "1.5 GB / day",
    talktime: "Unlimited calls",
    highlight: "Most popular",
  },
  { id: "RC-349", amount: 349, validityDays: 28, data: "2.5 GB / day", talktime: "Unlimited calls" },
  {
    id: "RC-599",
    amount: 599,
    validityDays: 56,
    data: "2 GB / day",
    talktime: "Unlimited calls",
    highlight: "Best value",
  },
  { id: "RC-101", amount: 101, validityDays: 28, data: "6 GB add-on", talktime: "No talktime" },
];

export const plans: PlanOption[] = [
  {
    id: "PLN-799",
    name: "Infinity 799 5G",
    price: 799,
    data: "100 GB / month",
    voice: "Unlimited",
    sms: "3000 / month",
    perks: ["5G Unlimited nights", "NovaTel Play Premium"],
    current: true,
  },
  {
    id: "PLN-1099",
    name: "Infinity 1099 5G Max",
    price: 1099,
    data: "Unlimited 5G",
    voice: "Unlimited",
    sms: "3000 / month",
    perks: ["2 add-on connections", "Priority network", "OTT bundle (4 apps)"],
    recommended: true,
  },
  {
    id: "PLN-599",
    name: "Essential 599",
    price: 599,
    data: "60 GB / month",
    voice: "Unlimited",
    sms: "1000 / month",
    perks: ["Rollover data up to 100 GB"],
  },
];

export const currentBill: BillSummary = {
  id: "INV-2026-08-4417",
  cycle: "01 Jul 2026 – 31 Jul 2026",
  amount: 1126,
  dueDate: "18 August 2026",
  status: "Due",
  breakdown: [
    { label: "Monthly plan – Infinity 799 5G", amount: 799 },
    { label: "Data add-on (20 GB)", amount: 149 },
    { label: "International SMS", amount: 32 },
    { label: "NovaTel Play Premium", amount: 99 },
    { label: "GST (18%)", amount: 47 },
  ],
};

export const bills: BillSummary[] = [
  currentBill,
  {
    id: "INV-2026-07-4417",
    cycle: "01 Jun 2026 – 30 Jun 2026",
    amount: 942,
    dueDate: "18 July 2026",
    status: "Paid",
    breakdown: [
      { label: "Monthly plan – Infinity 799 5G", amount: 799 },
      { label: "NovaTel Play Premium", amount: 99 },
      { label: "GST (18%)", amount: 44 },
    ],
  },
  {
    id: "INV-2026-06-4417",
    cycle: "01 May 2026 – 31 May 2026",
    amount: 1018,
    dueDate: "18 June 2026",
    status: "Paid",
    breakdown: [
      { label: "Monthly plan – Infinity 799 5G", amount: 799 },
      { label: "Roaming pack – Asia Lite", amount: 175 },
      { label: "GST (18%)", amount: 44 },
    ],
  },
];

export const payments: PaymentRecord[] = [
  {
    id: "PAY-90412",
    date: "16 Jul 2026",
    amount: 942,
    method: "UPI • novatel@upi",
    status: "Success",
    reference: "TXN8834920114",
  },
  {
    id: "PAY-88251",
    date: "15 Jun 2026",
    amount: 1018,
    method: "HDFC Credit Card •••• 4412",
    status: "Success",
    reference: "TXN8712004553",
  },
  {
    id: "PAY-86117",
    date: "17 May 2026",
    amount: 799,
    method: "Net Banking • ICICI",
    status: "Failed",
    reference: "TXN8590117742",
  },
];

export const addOns: AddOn[] = [
  {
    id: "ADD-20GB",
    name: "Data Booster 20 GB",
    price: 149,
    detail: "20 GB high-speed data",
    validity: "Valid till bill cycle end",
    active: true,
  },
  {
    id: "ADD-OTT",
    name: "NovaTel Play Premium",
    price: 99,
    detail: "12 OTT apps, 2 screens",
    validity: "Monthly, auto-renew",
    active: true,
  },
  {
    id: "ADD-ISD",
    name: "ISD Calling Pack",
    price: 249,
    detail: "300 ISD minutes to 12 countries",
    validity: "30 days",
    active: false,
  },
  {
    id: "ADD-NIGHT",
    name: "Night Unlimited 5G",
    price: 49,
    detail: "Unlimited data 12 AM – 6 AM",
    validity: "30 days",
    active: false,
  },
];

export const roamingPacks: RoamingPack[] = [
  {
    id: "IR-ASIA",
    name: "Asia Traveller",
    countries: "UAE, Singapore, Thailand, Malaysia +8",
    price: 1199,
    data: "5 GB",
    calls: "100 min incoming + outgoing",
    validity: "10 days",
  },
  {
    id: "IR-GLOBAL",
    name: "Global Unlimited",
    countries: "68 countries incl. USA, UK, EU",
    price: 2999,
    data: "10 GB + unlimited incoming",
    calls: "250 min",
    validity: "14 days",
  },
  {
    id: "IR-DAY",
    name: "Day Pass",
    countries: "42 countries",
    price: 649,
    data: "1 GB / day",
    calls: "30 min / day",
    validity: "1 day",
  },
];

export const serviceRequests: ServiceRequest[] = [
  {
    id: "SR-77120",
    type: "Network – Indoor signal weak",
    raisedOn: "02 Aug 2026, 10:12",
    status: "In progress",
    eta: "07 Aug 2026",
    channel: "AI Assistant",
    notes: "Field engineer assigned. Tower NTL-BLR-2214 capacity upgrade scheduled.",
  },
  {
    id: "SR-76884",
    type: "Billing – Disputed data charge",
    raisedOn: "24 Jul 2026, 18:40",
    status: "Resolved",
    eta: "Closed 27 Jul 2026",
    channel: "Call centre",
    notes: "Credit of ₹149 adjusted in the August bill cycle.",
  },
  {
    id: "SR-75201",
    type: "SIM – eSIM profile activation",
    raisedOn: "09 Jul 2026, 09:05",
    status: "Resolved",
    eta: "Closed 09 Jul 2026",
    channel: "Retail store",
    notes: "eSIM provisioned on secondary device.",
  },
];

export const networkStatus: NetworkStatus = {
  area: "Indiranagar, Bengaluru – 560038",
  severity: "Degraded",
  headline: "Planned 5G capacity upgrade in your area",
  detail:
    "Two of four sectors on tower NTL-BLR-2214 are offline for a capacity upgrade. You may see reduced indoor speeds between 11 PM and 5 AM.",
  affectedServices: ["5G Data", "VoLTE (intermittent)"],
  restorationEta: "07 August 2026, 06:00 IST",
  lastUpdated: "06 August 2026, 09:40 IST",
};

export const offers: Offer[] = [
  {
    id: "OFF-GOLD1",
    title: "Gold tier: 30 GB bonus data",
    detail: "Claim 30 GB extra data free with any plan upgrade this month.",
    validTill: "31 August 2026",
    tag: "Loyalty",
  },
  {
    id: "OFF-UPI",
    title: "₹100 cashback on UPI bill payment",
    detail: "Pay your August bill via UPI and get ₹100 credited within 3 days.",
    validTill: "18 August 2026",
    tag: "Payments",
  },
  {
    id: "OFF-OTT",
    title: "3 months OTT bundle at ₹1",
    detail: "Add 4 premium OTT apps to your Infinity plan for ₹1 for 3 months.",
    validTill: "25 August 2026",
    tag: "Entertainment",
  },
];

export const usageAnomaly: UsageAnomaly = {
  metric: "Daily data usage",
  detail:
    "Your data usage on 04 Aug (6.2 GB) was 118% above your 30-day average. At this rate your 100 GB quota will exhaust 6 days early.",
  change: "+118% vs average",
  detectedOn: "05 August 2026",
};

export const conversationHistory: Conversation[] = [
  {
    id: "CONV-3391",
    title: "Roaming for Singapore trip",
    startedAt: "02 Aug 2026",
    messages: [],
  },
  { id: "CONV-3374", title: "Disputed data charge", startedAt: "24 Jul 2026", messages: [] },
  { id: "CONV-3350", title: "Bill download – June", startedAt: "16 Jul 2026", messages: [] },
  { id: "CONV-3318", title: "Weak indoor signal", startedAt: "09 Jul 2026", messages: [] },
];

export const QUICK_ACTIONS = [
  { label: "Check balance", prompt: "Check balance", icon: "wallet" },
  { label: "View data usage", prompt: "View data usage", icon: "activity" },
  { label: "Current bill", prompt: "Show my current bill", icon: "receipt" },
  { label: "Recharge", prompt: "Recharge my number", icon: "zap" },
  { label: "Change plan", prompt: "Change my plan", icon: "layers" },
  { label: "Activate roaming", prompt: "Activate international roaming", icon: "plane" },
  { label: "Report network issue", prompt: "Report a network issue", icon: "signal" },
  { label: "Track complaint", prompt: "Check complaint status", icon: "ticket" },
  { label: "Speak to agent", prompt: "Talk to a support agent", icon: "headset" },
] as const;

export const SUGGESTED_PROMPTS = [
  "How much data do I have left this cycle?",
  "Why is my bill higher than last month?",
  "Best plan for unlimited 5G?",
  "Activate roaming for Singapore",
] as const;
