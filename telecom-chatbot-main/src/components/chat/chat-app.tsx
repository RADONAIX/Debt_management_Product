import { useEffect, useRef, useState } from "react";
import { AlertCircle, Bot, Loader2, RefreshCw, Send, Headphones, User } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

import {
  startSession,
  sendSessionMessage,
  getSessionMessages,
  getAssistantMessage,
  getSessionId,
  type LiveTranscriptResponse,
} from "@/lib/api.ts";

type UIMessage = {
  id: string;
  role: "assistant" | "user" | "agent";
  text: string;
  timestamp?: string;
};

export function ChatApp() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);

  const [input, setInput] = useState("");

  const [initializing, setInitializing] = useState(true);
  const [sending, setSending] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [handoffStatus, setHandoffStatus] = useState<number | null>(null);

  const endRef = useRef<HTMLDivElement>(null);

  /*
   * Start conversation when page loads.
   */
  useEffect(() => {
    initializeSession();
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    let active = true;
    const refresh = async () => {
      try {
        const transcript = await getSessionMessages(sessionId);
        if (active) applyTranscript(transcript);
      } catch {
        // Polling is best-effort; a send action surfaces connection errors.
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 2_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [sessionId]);

  /*
   * Auto-scroll whenever messages change.
   */
  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, sending]);

  async function initializeSession() {
    try {
      setInitializing(true);
      setError(null);
      setSessionId(null);
      setMessages([]);
      setHandoffStatus(null);

      const data = await startSession();

      console.log("Start session response:", data);

      const newSessionId = getSessionId(data);
      const firstMessage = getAssistantMessage(data);

      if (!newSessionId) {
        throw new Error("The API did not return a session_id.");
      }

      setSessionId(newSessionId);

      if (firstMessage) {
        setMessages([
          {
            id: crypto.randomUUID(),
            role: "assistant",
            text: firstMessage,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } catch (err) {
      console.error(err);

      setError(err instanceof Error ? err.message : "Unable to start conversation.");
    } finally {
      setInitializing(false);
    }
  }

  function applyTranscript(transcript: LiveTranscriptResponse) {
    setMessages(
      transcript.messages.map((item) => ({
        id: String(item.id),
        role: item.speaker === "debtor" ? "user" : item.speaker === "agent" ? "agent" : "assistant",
        text: item.dialogue,
        timestamp: item.created_at,
      })),
    );
    setHandoffStatus(transcript.escalation_status ?? null);
  }

  async function handleSend() {
    const text = input.trim();

    if (!text || !sessionId || sending) {
      return;
    }

    const userMessage: UIMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text,
      timestamp: new Date().toISOString(),
    };

    /*
     * Immediately show user's message.
     */
    setMessages((current) => [...current, userMessage]);

    setInput("");
    setSending(true);
    setError(null);

    try {
      const data = await sendSessionMessage(sessionId, text);

      console.log("Send message response:", data);

      const assistantText = getAssistantMessage(data);
      if (data?.action === "escalate" || data?.escalation_status != null) {
        setHandoffStatus(data.escalation_status ?? 0);
      }
      if (assistantText) {
        const assistantMessage: UIMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: assistantText,
          timestamp: new Date().toISOString(),
        };
        setMessages((current) => [...current, assistantMessage]);
      }
      applyTranscript(await getSessionMessages(sessionId));
    } catch (err) {
      console.error(err);

      setError(err instanceof Error ? err.message : "Unable to send message.");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  return (
    <div className="flex h-dvh flex-col bg-slate-50">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-xl bg-slate-900 text-white">
              {handoffStatus === 1 ? <Headphones className="size-5" /> : <Bot className="size-5" />}
            </div>

            <div>
              <h1 className="text-sm font-semibold text-slate-900">
                {handoffStatus === 1 ? "Live Support Agent" : "AI Assistant"}
              </h1>

              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <span
                  className={`size-2 rounded-full ${sessionId ? "bg-emerald-500" : "bg-slate-300"}`}
                />

                {sessionId
                  ? handoffStatus === 0
                    ? "Waiting for a support agent"
                    : handoffStatus === 1
                      ? "Agent connected"
                      : handoffStatus === 2
                        ? "Conversation resolved"
                        : "Connected"
                  : initializing
                    ? "Connecting..."
                    : "Disconnected"}
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={initializeSession}
            disabled={initializing || sending}
          >
            <RefreshCw className="mr-2 size-4" />
            New conversation
          </Button>
        </div>
      </header>

      {/* Conversation */}
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full max-w-4xl flex-col px-4 py-6">
          {initializing ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="size-6 animate-spin" />

              <p className="text-sm">Starting conversation...</p>
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="size-4" />

                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {messages.map((message) => {
                const assistant = message.role === "assistant";
                const agent = message.role === "agent";

                return (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${assistant || agent ? "justify-start" : "justify-end"}`}
                  >
                    {(assistant || agent) && (
                      <div
                        className={`flex size-8 shrink-0 items-center justify-center rounded-full text-white ${agent ? "bg-blue-600" : "bg-slate-900"}`}
                      >
                        {agent ? <Headphones className="size-4" /> : <Bot className="size-4" />}
                      </div>
                    )}

                    <div
                      className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                        assistant || agent
                          ? agent
                            ? "rounded-tl-sm border border-blue-200 bg-blue-50 text-slate-800"
                            : "rounded-tl-sm border bg-white text-slate-800"
                          : "rounded-tr-sm bg-slate-900 text-white"
                      }`}
                    >
                      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide opacity-55">
                        {agent ? "Support agent" : assistant ? "Chatbot" : "You"}
                      </p>
                      {message.text}
                      {message.timestamp && (
                        <p className="mt-1 text-[10px] opacity-50">
                          {new Date(message.timestamp).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      )}
                    </div>

                    {!assistant && !agent && (
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-700">
                        <User className="size-4" />
                      </div>
                    )}
                  </div>
                );
              })}

              {handoffStatus != null && (
                <div className="flex justify-center py-1">
                  <div className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-700">
                    {handoffStatus === 0
                      ? "Escalated — waiting for a support agent"
                      : handoffStatus === 1
                        ? "A support agent has joined the conversation"
                        : "This conversation has been resolved"}
                  </div>
                </div>
              )}

              {sending && handoffStatus == null && (
                <div className="flex items-center gap-3">
                  <div className="flex size-8 items-center justify-center rounded-full bg-slate-900 text-white">
                    <Bot className="size-4" />
                  </div>

                  <div className="flex items-center gap-2 rounded-2xl rounded-tl-sm border bg-white px-4 py-3 text-sm text-slate-500 shadow-sm">
                    <Loader2 className="size-4 animate-spin" />
                    Thinking...
                  </div>
                </div>
              )}

              <div ref={endRef} />
            </div>
          )}
        </div>
      </main>

      {/* Composer */}
      <footer className="border-t bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-end gap-2 rounded-2xl border bg-white p-2 shadow-sm focus-within:ring-2 focus-within:ring-slate-200">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={sessionId ? "Type your response..." : "Waiting for connection..."}
              disabled={!sessionId || initializing || sending || handoffStatus === 2}
              rows={1}
              className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-slate-400"
            />

            <Button
              size="icon"
              onClick={() => void handleSend()}
              disabled={!input.trim() || !sessionId || sending || handoffStatus === 2}
              className="size-10 shrink-0 rounded-xl"
            >
              {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>

          <p className="mt-2 text-center text-[11px] text-slate-400">
            AI-generated responses may require verification.
          </p>
        </div>
      </footer>
    </div>
  );
}
