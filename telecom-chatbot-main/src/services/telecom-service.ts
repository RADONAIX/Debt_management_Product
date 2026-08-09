/**
 * Service layer (API placeholders).
 *
 * Every method resolves mock data behind a simulated latency so the UI already
 * handles loading / success / failure states. Replace the bodies with real HTTP
 * or server-function calls (CRM, billing, recharge, network, ticketing) without
 * touching any component.
 */
import {
  addOns,
  bills,
  currentBill,
  dailyUsage,
  networkStatus,
  offers,
  payments,
  plans,
  rechargePacks,
  roamingPacks,
  serviceRequests,
  conversationHistory,
  subscriber,
  usageAnomaly,
  usageBuckets,
} from "@/lib/mock-data";
import { referenceId } from "@/lib/format";
import type {
  AddOn,
  BillSummary,
  ChatAttachment,
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
  TransactionResult,
  UsageAnomaly,
  UsageBucket,
} from "@/lib/telecom-types";

const latency = (ms = 450) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export interface ApiResult<T> {
  data: T;
  requestId: string;
}

async function ok<T>(data: T, ms?: number): Promise<T> {
  await latency(ms);
  return data;
}

export const telecomService = {
  async getSubscriberProfile(): Promise<SubscriberProfile> {
    return ok(subscriber);
  },

  async getBalance(): Promise<{
    balance: number;
    billAmount: number;
    dueDate: string;
    validity: string;
  }> {
    return ok({
      balance: subscriber.balance,
      billAmount: subscriber.billAmount,
      dueDate: subscriber.billDueDate,
      validity: "Bill cycle ends 31 Aug 2026",
    });
  },

  async getUsage(): Promise<{ buckets: UsageBucket[]; daily: DailyUsage[]; anomaly: UsageAnomaly }> {
    return ok({ buckets: usageBuckets, daily: dailyUsage, anomaly: usageAnomaly });
  },

  async getRechargePacks(): Promise<RechargePack[]> {
    return ok(rechargePacks);
  },

  async getPlans(): Promise<PlanOption[]> {
    return ok(plans);
  },

  async getAddOns(): Promise<AddOn[]> {
    return ok(addOns);
  },

  async getRoamingPacks(): Promise<RoamingPack[]> {
    return ok(roamingPacks);
  },

  async getBills(): Promise<{ current: BillSummary; history: BillSummary[] }> {
    return ok({ current: currentBill, history: bills });
  },

  async getPaymentHistory(): Promise<PaymentRecord[]> {
    return ok(payments);
  },

  async makePayment(amount: number, method = "UPI • novatel@upi"): Promise<TransactionResult> {
    await latency(900);
    return {
      reference: referenceId("PAY"),
      status: "Success",
      message: `Payment of ₹${amount.toLocaleString("en-IN")} received via ${method}.`,
      timestamp: new Date().toISOString(),
      amount,
    };
  },

  async recharge(amount: number, packId: string): Promise<TransactionResult> {
    await latency(900);
    return {
      reference: referenceId("RCH"),
      status: "Success",
      message: `Recharge of ₹${amount.toLocaleString("en-IN")} (${packId}) applied to your number.`,
      timestamp: new Date().toISOString(),
      amount,
    };
  },

  async changePlan(planId: string): Promise<TransactionResult> {
    await latency(900);
    return {
      reference: referenceId("PLN"),
      status: "Success",
      message: `Plan change to ${planId} scheduled from your next bill cycle (01 Sep 2026).`,
      timestamp: new Date().toISOString(),
    };
  },

  async activateAddon(addonId: string, price: number): Promise<TransactionResult> {
    await latency(800);
    return {
      reference: referenceId("ADD"),
      status: "Success",
      message: `Add-on ${addonId} activated. ₹${price} will appear on your next bill.`,
      timestamp: new Date().toISOString(),
      amount: price,
    };
  },

  async activateRoaming(packId: string, price: number): Promise<TransactionResult> {
    await latency(1000);
    return {
      reference: referenceId("IRM"),
      status: "Success",
      message: `International roaming pack ${packId} is active. Charges of ₹${price} applied.`,
      timestamp: new Date().toISOString(),
      amount: price,
    };
  },

  async blockSim(): Promise<TransactionResult> {
    await latency(1000);
    return {
      reference: referenceId("SIM"),
      status: "Success",
      message:
        "Your SIM is blocked. Collect a replacement SIM from any NovaTel store with your ID proof.",
      timestamp: new Date().toISOString(),
    };
  },

  async requestSimReplacement(): Promise<TransactionResult> {
    await latency(900);
    return {
      reference: referenceId("SRP"),
      status: "Success",
      message: "SIM replacement request registered. Courier delivery in 2 working days.",
      timestamp: new Date().toISOString(),
    };
  },

  async requestPortability(): Promise<TransactionResult> {
    await latency(900);
    return {
      reference: referenceId("MNP"),
      status: "Success",
      message: "Porting code (UPC) generated and sent by SMS. Valid for 4 days.",
      timestamp: new Date().toISOString(),
    };
  },

  async createServiceRequest(type: string, notes: string): Promise<ServiceRequest> {
    await latency(900);
    return {
      id: referenceId("SR"),
      type,
      raisedOn: new Date().toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      status: "Open",
      eta: "48 hours",
      channel: "AI Assistant",
      notes,
    };
  },

  async getServiceRequestStatus(): Promise<ServiceRequest[]> {
    return ok(serviceRequests);
  },

  async getNetworkStatus(): Promise<NetworkStatus> {
    return ok(networkStatus, 600);
  },

  async getOffers(): Promise<Offer[]> {
    return ok(offers);
  },

  async escalateToAgent(): Promise<{ queuePosition: number; waitMinutes: number; agent: string }> {
    await latency(800);
    return { queuePosition: 2, waitMinutes: 3, agent: "Priya (Postpaid care)" };
  },

  async requestOtp(): Promise<{ sentTo: string; expiresInSeconds: number }> {
    await latency(600);
    return { sentTo: subscriber.msisdn, expiresInSeconds: 120 };
  },

  async verifyOtp(code: string): Promise<{ verified: boolean; message: string }> {
    await latency(700);
    if (code === "123456") return { verified: true, message: "Verified" };
    return { verified: false, message: "Incorrect OTP. Use 123456 in this demo environment." };
  },

  async sendChatMessage(text: string): Promise<{ accepted: boolean; text: string }> {
    await latency(300);
    return { accepted: true, text };
  },

  /* ---------- Chatbot placeholders (swap bodies for real endpoints) ---------- */

  /** POST /chat/messages — send a subscriber turn to the NLU/agent backend. */
  async sendMessage(
    text: string,
    options: { attachmentId?: string; conversationId?: string } = {},
  ): Promise<{ accepted: boolean; messageId: string; conversationId: string }> {
    await latency(300);
    return {
      accepted: true,
      messageId: referenceId("MSG"),
      conversationId: options.conversationId ?? "current",
    };
  },

  /** GET /chat/conversations — archived conversations for the history menu. */
  async getConversationHistory(): Promise<Conversation[]> {
    return ok(conversationHistory, 350);
  },

  /** POST /chat/conversations — open a fresh conversation server-side. */
  async startNewConversation(): Promise<Conversation> {
    await latency(300);
    return {
      id: referenceId("CONV"),
      title: "New conversation",
      startedAt: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      messages: [],
    };
  },

  /** POST /chat/attachments — upload a screenshot or document. */
  async uploadAttachment(file: { name: string; size: number }): Promise<ChatAttachment> {
    await latency(700);
    return {
      id: referenceId("ATT"),
      name: file.name,
      sizeKb: Math.max(1, Math.round(file.size / 1024)),
      status: "uploaded",
    };
  },

  /** GET /subscriber/context — compact context shown in the chat header. */
  async getSubscriberContext(): Promise<SubscriberProfile> {
    return ok(subscriber, 400);
  },
};

export type TelecomService = typeof telecomService;
