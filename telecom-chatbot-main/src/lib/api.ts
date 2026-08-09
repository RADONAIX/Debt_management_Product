const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://10.200.36.58:8007";

export const DEFAULT_SUBSCRIBER_NO = "+971580000633";

export interface StartSessionResponse {
  session_id: string;
  [key: string]: unknown;
}

export interface SendMessageResponse {
  session_id?: string;
  action?: "ask" | "offer" | "accept" | "escalate";
  dialogue?: string;
  closed?: boolean;
  escalation_status?: number | null;
  [key: string]: unknown;
}

export interface StoredChatMessage {
  id: number;
  index: number;
  speaker: "debtor" | "collector" | "agent" | string;
  dialogue: string;
  created_at: string;
}

export interface LiveTranscriptResponse {
  session_id: string;
  status: "open" | "escalated" | "closed" | string;
  escalation_status?: number | null;
  messages: StoredChatMessage[];
}

async function handleResponse<T>(response: Response): Promise<T> {
  let data: unknown;

  try {
    data = await response.json();
  } catch {
    throw new Error(`Invalid server response (${response.status})`);
  }

  if (!response.ok) {
    const error = data as { detail?: string; message?: string } | null;
    throw new Error(error?.detail || error?.message || `Request failed (${response.status})`);
  }

  return data as T;
}

/**
 * Start new conversation
 *
 * POST /sessions
 */
export async function startSession(
  subscriberNo: string = DEFAULT_SUBSCRIBER_NO,
): Promise<StartSessionResponse> {
  const response = await fetch(`${API_BASE_URL}/sessions`, {
    method: "POST",

    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },

    body: JSON.stringify({
      subscriber_no: subscriberNo,
    }),
  });

  return handleResponse<StartSessionResponse>(response);
}

/**
 * Send customer message using existing session ID
 *
 * POST /sessions/{session_id}/messages
 */
export async function sendSessionMessage(
  sessionId: string,
  message: string,
): Promise<SendMessageResponse> {
  if (!sessionId) {
    throw new Error("Session ID is missing");
  }

  if (!message.trim()) {
    throw new Error("Message cannot be empty");
  }

  const response = await fetch(
    `${API_BASE_URL}/sessions/${encodeURIComponent(sessionId)}/messages`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },

      body: JSON.stringify({
        message: message.trim(),
      }),
    },
  );

  return handleResponse<SendMessageResponse>(response);
}

/** Poll the durable transcript so human-agent replies appear in this client. */
export async function getSessionMessages(sessionId: string): Promise<LiveTranscriptResponse> {
  const response = await fetch(
    `${API_BASE_URL}/sessions/${encodeURIComponent(sessionId)}/messages`,
    { headers: { Accept: "application/json" } },
  );
  return handleResponse<LiveTranscriptResponse>(response);
}

/**
 * Get session id from start-session response
 */
export function getSessionId(data: unknown): string | null {
  const value = data as {
    session_id?: string;
    id?: string;
    session?: { session_id?: string; id?: string };
  } | null;
  return value?.session_id ?? value?.id ?? value?.session?.session_id ?? value?.session?.id ?? null;
}

/**
 * Get assistant/collector message from API response
 */
export function getAssistantMessage(data: unknown): string | null {
  const value = data as {
    dialogue?: string;
    message?: string;
    response?: string;
    assistant_message?: string;
    collector_message?: string;
    turn?: { dialogue?: string; message?: string };
    collector_turn?: { dialogue?: string; message?: string };
  } | null;
  return (
    value?.dialogue ??
    value?.message ??
    value?.response ??
    value?.assistant_message ??
    value?.collector_message ??
    value?.turn?.dialogue ??
    value?.turn?.message ??
    value?.collector_turn?.dialogue ??
    value?.collector_turn?.message ??
    null
  );
}
