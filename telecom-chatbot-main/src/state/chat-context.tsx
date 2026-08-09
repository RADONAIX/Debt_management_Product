import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { composeReply, welcomeMessage } from "@/lib/chat-engine";
import { telecomService } from "@/services/telecom-service";
import type {
  ChatAttachment,
  ChatMessage,
  Conversation,
  ResponseCard,
} from "@/lib/telecom-types";

let counter = 0;
const nextId = () => `msg-${++counter}-${Math.random().toString(36).slice(2, 7)}`;

export type ConnectionState = "online" | "reconnecting" | "offline";

interface ChatContextValue {
  messages: ChatMessage[];
  typing: boolean;
  error: string | null;
  connection: ConnectionState;
  conversations: Conversation[];
  historyLoading: boolean;
  showSuggestions: boolean;
  sendMessage: (text: string, attachment?: ChatAttachment) => Promise<void>;
  retryLast: () => void;
  pushBotMessage: (text: string, cards?: ResponseCard[]) => void;
  pushSystemMessage: (text: string) => void;
  setFeedback: (id: string, feedback: "helpful" | "not-helpful") => void;
  startNewConversation: () => void;
  openConversation: (id: string) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [welcomeMessage(nextId())]);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState>("online");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [lastPrompt, setLastPrompt] = useState<{
    text: string;
    attachment?: ChatAttachment | undefined;
  } | null>(null);

  useEffect(() => {
    let active = true;
    void telecomService
      .getConversationHistory()
      .then((list) => {
        if (active) setConversations(list);
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const online = () => setConnection("online");
    const offline = () => setConnection("offline");
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    if (!navigator.onLine) setConnection("offline");
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, []);

  const append = useCallback((message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  }, []);

  const pushBotMessage = useCallback(
    (text: string, cards?: ResponseCard[]) => {
      append({ id: nextId(), role: "bot", text, cards, timestamp: new Date().toISOString() });
    },
    [append],
  );

  const pushSystemMessage = useCallback(
    (text: string) => {
      append({ id: nextId(), role: "system", text, timestamp: new Date().toISOString() });
    },
    [append],
  );

  const sendMessage = useCallback(
    async (text: string, attachment?: ChatAttachment) => {
      const trimmed = text.trim().slice(0, 500);
      if (!trimmed) return;
      setError(null);
      setLastPrompt({ text: trimmed, attachment });
      const userMessageId = nextId();
      append({
        id: userMessageId,
        role: "user",
        text: trimmed,
        attachment,
        status: "sending",
        timestamp: new Date().toISOString(),
      });
      setTyping(true);
      try {
        if (!navigator.onLine) throw new Error("offline");
        await telecomService.sendMessage(trimmed, attachment ? { attachmentId: attachment.id } : {});
        setMessages((prev) =>
          prev.map((m) => (m.id === userMessageId ? { ...m, status: "sent" } : m)),
        );
        const reply = composeReply(trimmed);
        await new Promise((resolve) => setTimeout(resolve, 600));
        append({
          id: nextId(),
          role: "bot",
          text: reply.text,
          cards: reply.cards,
          suggestions: reply.suggestions,
          timestamp: new Date().toISOString(),
        });
      } catch {
        setMessages((prev) =>
          prev.map((m) => (m.id === userMessageId ? { ...m, status: "failed" } : m)),
        );
        setError(
          navigator.onLine
            ? "The assistant didn't respond. Retry your last message."
            : "You appear to be offline. Reconnect to continue the conversation.",
        );
        setConnection(navigator.onLine ? "reconnecting" : "offline");
      } finally {
        setTyping(false);
      }
    },
    [append],
  );

  const retryLast = useCallback(() => {
    if (!lastPrompt) return;
    setMessages((prev) => prev.filter((m) => m.status !== "failed"));
    setConnection("online");
    void sendMessage(lastPrompt.text, lastPrompt.attachment);
  }, [lastPrompt, sendMessage]);

  const setFeedback = useCallback((id: string, feedback: "helpful" | "not-helpful") => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, feedback } : m)));
  }, []);

  const startNewConversation = useCallback(() => {
    setError(null);
    setLastPrompt(null);
    setMessages([welcomeMessage(nextId())]);
    void telecomService.startNewConversation().then((conversation) => {
      setConversations((prev) => [conversation, ...prev]);
    });
  }, []);

  const openConversation = useCallback(
    (id: string) => {
      setMessages((prev) => {
        const conversation = conversations.find((c) => c.id === id);
        return [
          ...prev,
          {
            id: nextId(),
            role: "system" as const,
            text: `Opened archived conversation "${conversation?.title ?? id}" from ${conversation?.startedAt ?? "earlier"}. The transcript is read-only — continue below to raise a new request.`,
            timestamp: new Date().toISOString(),
          },
        ];
      });
    },
    [conversations],
  );

  const showSuggestions = messages.length <= 1;

  const value = useMemo<ChatContextValue>(
    () => ({
      messages,
      typing,
      error,
      connection,
      conversations,
      historyLoading,
      showSuggestions,
      sendMessage,
      retryLast,
      pushBotMessage,
      pushSystemMessage,
      setFeedback,
      startNewConversation,
      openConversation,
    }),
    [
      messages,
      typing,
      error,
      connection,
      conversations,
      historyLoading,
      showSuggestions,
      sendMessage,
      retryLast,
      pushBotMessage,
      pushSystemMessage,
      setFeedback,
      startNewConversation,
      openConversation,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside ChatProvider");
  return ctx;
}
