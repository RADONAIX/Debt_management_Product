/**
 * Domain types for the telecom self-service assistant.
 * These mirror the shape a real CRM / billing / network API would return,
 * so swapping the mock service layer for HTTP calls requires no UI changes.
 */

export type CustomerType = "Prepaid" | "Postpaid";
export type AccountStatus = "Active" | "Suspended" | "Barred";
export type KycStatus = "Verified" | "Pending" | "Rejected";
export type LoyaltyTier = "Silver" | "Gold" | "Platinum";
export type NetworkType = "4G" | "5G";
export type SimStatus = "Active" | "Blocked" | "Replacement in progress";

export interface SubscriberProfile {
  name: string;
  msisdn: string;
  customerId: string;
  customerType: CustomerType;
  plan: string;
  planPrice: number;
  accountStatus: AccountStatus;
  balance: number;
  dataUsedGb: number;
  dataTotalGb: number;
  voiceMinutesLeft: number | "Unlimited";
  smsLeft: number;
  billDueDate: string;
  billAmount: number;
  loyaltyTier: LoyaltyTier;
  loyaltyPoints: number;
  kycStatus: KycStatus;
  networkType: NetworkType;
  simStatus: SimStatus;
  circle: string;
  activeSince: string;
  activeServices: string[];
  email: string;
}

export interface UsageBucket {
  label: string;
  used: number;
  total: number | "Unlimited";
  unit: string;
}

export interface DailyUsage {
  day: string;
  gb: number;
}

export interface RechargePack {
  id: string;
  amount: number;
  validityDays: number;
  data: string;
  talktime: string;
  highlight?: string;
}

export interface PlanOption {
  id: string;
  name: string;
  price: number;
  data: string;
  voice: string;
  sms: string;
  perks: string[];
  recommended?: boolean;
  current?: boolean;
}

export interface BillSummary {
  id: string;
  cycle: string;
  amount: number;
  dueDate: string;
  status: "Due" | "Paid" | "Overdue";
  breakdown: { label: string; amount: number }[];
}

export interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  method: string;
  status: "Success" | "Failed" | "Pending";
  reference: string;
}

export interface AddOn {
  id: string;
  name: string;
  price: number;
  detail: string;
  validity: string;
  active: boolean;
}

export interface RoamingPack {
  id: string;
  name: string;
  countries: string;
  price: number;
  data: string;
  calls: string;
  validity: string;
}

export interface ServiceRequest {
  id: string;
  type: string;
  raisedOn: string;
  status: "Open" | "In progress" | "Resolved" | "Escalated";
  eta: string;
  channel: string;
  notes: string;
}

export interface NetworkStatus {
  area: string;
  severity: "Normal" | "Degraded" | "Outage";
  headline: string;
  detail: string;
  affectedServices: string[];
  restorationEta: string;
  lastUpdated: string;
}

export interface Offer {
  id: string;
  title: string;
  detail: string;
  validTill: string;
  tag: string;
}

export interface UsageAnomaly {
  metric: string;
  detail: string;
  change: string;
  detectedOn: string;
}

export interface TransactionResult {
  reference: string;
  status: "Success" | "Failed";
  message: string;
  timestamp: string;
  amount?: number;
}

/* ---------- Chat ---------- */

export type CardKind =
  | "balance"
  | "recharge"
  | "plans"
  | "bill"
  | "payments"
  | "addons"
  | "roaming"
  | "request-status"
  | "outage"
  | "ticket"
  | "sim-replacement"
  | "portability"
  | "anomaly"
  | "offers"
  | "agent"
  | "transaction";

export type TransactionalAction =
  | { kind: "recharge"; pack: RechargePack }
  | { kind: "pay-bill"; bill: BillSummary }
  | { kind: "change-plan"; plan: PlanOption }
  | { kind: "activate-addon"; addon: AddOn }
  | { kind: "activate-roaming"; pack: RoamingPack }
  | { kind: "block-sim" }
  | { kind: "sim-replacement" }
  | { kind: "portability" };

export interface ResponseCard {
  kind: CardKind;
  payload?: unknown | undefined;
}

export interface ChatMessage {
  id: string;
  role: "user" | "bot" | "system";
  text: string;
  timestamp: string;
  cards?: ResponseCard[] | undefined;
  suggestions?: string[] | undefined;
  feedback?: "helpful" | "not-helpful" | undefined;
  attachment?: ChatAttachment | undefined;
  status?: "sending" | "sent" | "failed" | undefined;
}

export interface ChatAttachment {
  id: string;
  name: string;
  sizeKb: number;
  status: "uploading" | "uploaded" | "failed";
}

export interface Conversation {
  id: string;
  title: string;
  startedAt: string;
  messages: ChatMessage[];
}
