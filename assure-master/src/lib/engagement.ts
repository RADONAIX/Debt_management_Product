/** Shared chatbot transcript and human handoff API. */

import { apiFetch } from "./api";

export interface ChatSummary {
  waiting: number;
  active: number;
  resolvedToday: number;
}

export interface ConversationRow {
  sessionId: string;
  escalationId: number;
  status: 0 | 1 | 2;
  trigger: string;
  detail: string;
  customerId?: number | null;
  customerCode?: string | null;
  customerName: string;
  email?: string | null;
  msisdn?: string | null;
  accountCode: string;
  outstanding: number;
  dpd: number;
  assignedTo?: number | null;
  assignedToName?: string | null;
  lastMessage?: string | null;
  lastSpeaker?: string | null;
  lastMessageAt?: string | null;
  createdAt: string;
  acceptedAt?: string | null;
  resolvedAt?: string | null;
}

export interface ChatMessage {
  id: number;
  index: number;
  speaker: "debtor" | "collector" | "agent" | string;
  text: string;
  createdAt: string;
}

export interface ConversationDetail extends ConversationRow {
  messages: ChatMessage[];
}

export const getChatSummary = () =>
  apiFetch<ChatSummary>("/engagement/chat/summary");

export const getChatConversations = (
  state: "waiting" | "active" | "resolved" | "open" | "all" = "open",
) => apiFetch<ConversationRow[]>(`/engagement/chat/conversations?state=${state}`);

export const getChatConversation = (sessionId: string) =>
  apiFetch<ConversationDetail>(`/engagement/chat/conversations/${encodeURIComponent(sessionId)}`);

export const acceptChatConversation = (sessionId: string) =>
  apiFetch<{ ok: boolean }>(
    `/engagement/chat/conversations/${encodeURIComponent(sessionId)}/accept`,
    { method: "POST" },
  );

export const sendAgentChatMessage = (sessionId: string, message: string) =>
  apiFetch<{ id: number }>(
    `/engagement/chat/conversations/${encodeURIComponent(sessionId)}/messages`,
    { method: "POST", body: { message } },
  );

export const resolveChatConversation = (sessionId: string) =>
  apiFetch<{ ok: boolean }>(
    `/engagement/chat/conversations/${encodeURIComponent(sessionId)}/resolve`,
    { method: "POST" },
  );

// --- Contact history -------------------------------------------------------
export interface ChannelLine {
  channel: string; attempts: number; reached: number;
  reachRate?: number | null; automated: number;
}
export interface OutcomeLine { outcome: string; count: number }
export interface DayLine { day: string; attempts: number; reached: number; automated: number }
export interface HourLine {
  hour: number; attempts: number; reached: number; reachRate?: number | null;
}
export interface AgentContactLine {
  agentId?: number | null; agentName: string; attempts: number; reached: number;
  reachRate?: number | null; customers: number;
}

export interface ContactSummary {
  days: number;
  attempts: number;
  reached: number;
  noAnswer: number;
  delivered: number;
  /** Attempts somebody could have answered — the reach-rate denominator. */
  answerable: number;
  reachRate?: number | null;
  customers: number;
  agents: number;
  automated: number;
  automatedShare?: number | null;
  inbound: number;
  today: number;
  ledToPromise: number;
  promiseRate?: number | null;
  channels: ChannelLine[];
  outcomes: OutcomeLine[];
  byDay: DayLine[];
  byHour: HourLine[];
  agentBoard: AgentContactLine[];
}

export interface ContactRow {
  id: number; kind: string; channel: string; direction: string; subject: string;
  body?: string | null; outcome?: string | null; isAutomated: boolean;
  occurredAt: string; customerId: string; customerName: string;
  companyName?: string | null; agentName?: string | null;
  caseId?: number | null; caseNumber?: string | null;
}

export interface ContactOptions {
  channels: string[]; directions: string[]; agents: { id: number; name: string }[];
}

const contactQuery = (f: Record<string, unknown>) => {
  const q = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
};

export const getContactSummary = (f: { agentId?: number | null; days?: number } = {}) =>
  apiFetch<ContactSummary>(`/engagement/contacts/summary${contactQuery(f)}`);

export const getContactHistory = (f: {
  agentId?: number | null; days?: number; channel?: string; direction?: string;
  reached?: boolean; search?: string; limit?: number; offset?: number;
} = {}) => apiFetch<ContactRow[]>(`/engagement/contacts${contactQuery(f)}`);

export const getContactOptions = () =>
  apiFetch<ContactOptions>("/engagement/contacts/options");
