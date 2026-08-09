/**
 * Chat engine: intent detection + response composition.
 * All conversational business logic lives here, never in components.
 */
import { networkStatus, subscriber, usageAnomaly } from "@/lib/mock-data";
import { formatInr } from "@/lib/format";
import type { ChatMessage, ResponseCard } from "@/lib/telecom-types";

export interface BotReply {
  text: string;
  cards?: ResponseCard[] | undefined;
  suggestions?: string[] | undefined;
  requiresConsent?: boolean | undefined;
}

type Intent =
  | "balance"
  | "usage"
  | "recharge"
  | "bill"
  | "payments"
  | "plans"
  | "addons"
  | "roaming"
  | "network"
  | "complaint-status"
  | "block-sim"
  | "sim-replacement"
  | "portability"
  | "offers"
  | "agent"
  | "greeting"
  | "fallback";

const RULES: { intent: Intent; patterns: RegExp }[] = [
  { intent: "balance", patterns: /balance|talktime|how much.*(left|money)|outstanding/i },
  { intent: "usage", patterns: /usage|data left|data remain|consum|gb|quota|anomal/i },
  { intent: "recharge", patterns: /recharge|top ?up|top-up|voucher|pack.*(buy|amount)/i },
  { intent: "bill", patterns: /bill|invoice|statement|download.*bill|due|higher than/i },
  { intent: "payments", patterns: /payment history|past payment|receipt|paid earlier|transactions/i },
  { intent: "plans", patterns: /plan|upgrade|tariff|compare|unlimited 5g/i },
  { intent: "addons", patterns: /add-?on|booster|ott|isd|night pack/i },
  { intent: "roaming", patterns: /roam|international|abroad|travel|singapore|dubai|usa|uk trip/i },
  {
    intent: "network",
    patterns: /network|signal|slow internet|no service|call drop|outage|tower|coverage|report.*issue/i,
  },
  {
    intent: "complaint-status",
    patterns: /complaint status|ticket status|track|status of my (request|complaint)|sr-/i,
  },
  { intent: "block-sim", patterns: /block.*(sim|number)|lost (sim|phone)|stolen/i },
  { intent: "sim-replacement", patterns: /replace.*sim|new sim|esim|damaged sim/i },
  { intent: "portability", patterns: /port|mnp|switch operator|upc/i },
  { intent: "offers", patterns: /offer|discount|cashback|coupon|loyalty|reward/i },
  { intent: "agent", patterns: /agent|human|representative|talk to support|call centre|executive/i },
  { intent: "greeting", patterns: /^(hi|hello|hey|namaste|good (morning|evening|afternoon))\b/i },
];

export function detectIntent(text: string): Intent {
  for (const rule of RULES) {
    if (rule.patterns.test(text)) return rule.intent;
  }
  return "fallback";
}

const dataLeft = subscriber.dataTotalGb - subscriber.dataUsedGb;

export function composeReply(text: string): BotReply {
  const intent = detectIntent(text);

  switch (intent) {
    case "greeting":
      return {
        text: `Hello ${subscriber.name.split(" ")[0]}! I can help with balance, usage, recharges, bills, plans, roaming and network complaints. What would you like to do?`,
        suggestions: ["Check balance", "View data usage", "Download bill", "Change plan"],
      };
    case "balance":
      return {
        text: `Here's your account summary for ${subscriber.plan}. Your unbilled amount is ${formatInr(subscriber.billAmount)} and advance balance is ${formatInr(subscriber.balance, true)}.`,
        cards: [{ kind: "balance" }],
        suggestions: ["Pay my bill", "View data usage", "See offers"],
        requiresConsent: true,
      };
    case "usage":
      return {
        text: `You've used ${subscriber.dataUsedGb} GB of ${subscriber.dataTotalGb} GB this cycle — ${dataLeft} GB remaining. I also spotted an unusual spike worth reviewing.`,
        cards: [{ kind: "balance" }, { kind: "anomaly" }],
        suggestions: ["Add a data booster", "Change plan", "Why is my bill higher?"],
        requiresConsent: true,
      };
    case "recharge":
      return {
        text: "Here are the recharge packs available for your number. Select one and I'll take you through a secure confirmation.",
        cards: [{ kind: "recharge" }],
        suggestions: ["Check balance", "See offers"],
      };
    case "bill":
      return {
        text: `Your August statement of ${formatInr(subscriber.billAmount)} is due on ${subscriber.billDueDate}. The increase versus July comes from a 20 GB data booster and international SMS.`,
        cards: [{ kind: "bill" }],
        suggestions: ["Pay my bill", "View payment history", "Raise a billing complaint"],
        requiresConsent: true,
      };
    case "payments":
      return {
        text: "Here are your last three payments with reference IDs for your records.",
        cards: [{ kind: "payments" }],
        suggestions: ["Download bill", "Pay my bill"],
      };
    case "plans":
      return {
        text: "Based on your 72 GB average monthly usage and 5G handset, here's how your current plan compares with recommended options.",
        cards: [{ kind: "plans" }],
        suggestions: ["Activate roaming", "See offers", "Add a data booster"],
      };
    case "addons":
      return {
        text: "These are your active add-ons and packs you can activate instantly.",
        cards: [{ kind: "addons" }],
        suggestions: ["Change plan", "Check balance"],
      };
    case "roaming":
      return {
        text: "International roaming is currently inactive on your number. Choose a pack and I'll activate it after OTP verification.",
        cards: [{ kind: "roaming" }],
        suggestions: ["Check complaint status", "Talk to support"],
      };
    case "network":
      return {
        text: `I checked the network around ${networkStatus.area}. There is a known ${networkStatus.severity.toLowerCase()} condition. You can also register a complaint and a field engineer will follow up.`,
        cards: [{ kind: "outage" }, { kind: "ticket" }],
        suggestions: ["Check complaint status", "Talk to support"],
      };
    case "complaint-status":
      return {
        text: "Here's the live status of your service requests.",
        cards: [{ kind: "request-status" }],
        suggestions: ["Report network issue", "Talk to support"],
      };
    case "block-sim":
      return {
        text: "I can block your SIM immediately to prevent misuse. This is irreversible and will disconnect all services on this number until a replacement SIM is activated.",
        cards: [{ kind: "sim-replacement" }],
        suggestions: ["Talk to support", "Check complaint status"],
      };
    case "sim-replacement":
      return {
        text: "You can request a replacement SIM or eSIM profile. KYC is already verified, so no re-verification is needed.",
        cards: [{ kind: "sim-replacement" }],
        suggestions: ["Block lost SIM", "Talk to support"],
      };
    case "portability":
      return {
        text: "Before you port out — you're a Gold tier subscriber with retention benefits available. Here's the porting request and the best retention offer.",
        cards: [{ kind: "portability" }, { kind: "offers" }],
        suggestions: ["See offers", "Talk to support"],
      };
    case "offers":
      return {
        text: `As a ${subscriber.loyaltyTier} tier subscriber you have ${subscriber.loyaltyPoints.toLocaleString("en-IN")} points and these personalised offers.`,
        cards: [{ kind: "offers" }],
        suggestions: ["Change plan", "Pay my bill"],
      };
    case "agent":
      return {
        text: "I can connect you to a care specialist. Your conversation summary and account context will be shared with them.",
        cards: [{ kind: "agent" }],
        suggestions: ["Check complaint status", "Report network issue"],
      };
    default:
      return {
        text: `I'm not sure I understood that. I can help with balance and usage, recharges and payments, bills, plans and add-ons, roaming, network complaints, SIM services and complaint tracking. ${usageAnomaly.metric} alerts are also available.`,
        suggestions: ["Check balance", "Download bill", "Report network issue", "Talk to support"],
      };
  }
}

export function welcomeMessage(id: string): ChatMessage {
  return {
    id,
    role: "bot",
    timestamp: new Date().toISOString(),
    text: `Hi ${subscriber.name.split(" ")[0]}, welcome to ${"NovaTel"} Assist. I can see your ${subscriber.customerType} account ending ${subscriber.msisdn.slice(-4)} is active on ${subscriber.plan}. How can I help today?`,
    suggestions: [
      "Check balance",
      "View data usage",
      "Download bill",
      "Activate roaming",
      "Report network issue",
    ],
  };
}
