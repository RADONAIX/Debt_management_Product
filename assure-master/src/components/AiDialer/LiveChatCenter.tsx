import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  Headphones,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError } from "@/lib/api";
import {
  acceptChatConversation,
  getChatConversation,
  getChatConversations,
  getChatSummary,
  resolveChatConversation,
  sendAgentChatMessage,
  type ChatMessage,
  type ChatSummary,
  type ConversationDetail,
  type ConversationRow,
} from "@/lib/engagement";
import { formatMoney } from "@/data/portfolioStore";

type QueueState = "open" | "waiting" | "active" | "resolved";

const errorMessage = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

const shortTime = (iso?: string | null) => iso
  ? new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  : "";

const relativeTime = (iso?: string | null) => {
  if (!iso) return "";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1_440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1_440)}d`;
};

const speakerLabel = (speaker: string) => {
  if (speaker === "debtor") return "Client";
  if (speaker === "agent") return "Agent";
  return "Chatbot";
};

const MessageBubble = ({ message }: { message: ChatMessage }) => {
  const client = message.speaker === "debtor";
  const agent = message.speaker === "agent";
  return (
    <div className={`flex ${client ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[82%] rounded-2xl px-4 py-2.5 shadow-sm ${
        client
          ? "rounded-bl-md bg-muted text-foreground"
          : agent
            ? "rounded-br-md bg-primary text-primary-foreground"
            : "rounded-br-md border border-info/25 bg-info/10 text-foreground"
      }`}>
        <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide opacity-70">
          {client ? <UserRound className="h-3 w-3" /> : agent ? <Headphones className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
          {speakerLabel(message.speaker)}
        </div>
        <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.text}</p>
        <p className="mt-1 text-[10px] opacity-60">{shortTime(message.createdAt)}</p>
      </div>
    </div>
  );
};

export default function LiveChatCenter({ canEdit = true }: { canEdit?: boolean }) {
  const [queueState, setQueueState] = useState<QueueState>("open");
  const [summary, setSummary] = useState<ChatSummary>({ waiting: 0, active: 0, resolvedToday: 0 });
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const refreshQueue = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const [nextSummary, rows] = await Promise.all([
        getChatSummary(),
        getChatConversations(queueState),
      ]);
      setSummary(nextSummary);
      setConversations(rows);
      setSelectedId((current) => {
        if (current && rows.some((row) => row.sessionId === current)) return current;
        return rows[0]?.sessionId ?? null;
      });
    } catch (error) {
      if (!quiet) toast.error(errorMessage(error, "Could not load live conversations."));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [queueState]);

  const refreshSelected = useCallback(async (quiet = false) => {
    if (!selectedId) {
      setSelected(null);
      return;
    }
    try {
      setSelected(await getChatConversation(selectedId));
    } catch (error) {
      if (!quiet) toast.error(errorMessage(error, "Could not load the transcript."));
    }
  }, [selectedId]);

  useEffect(() => { void refreshQueue(); }, [refreshQueue]);
  useEffect(() => { void refreshSelected(); }, [refreshSelected]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshQueue(true);
      void refreshSelected(true);
    }, 3_000);
    return () => window.clearInterval(timer);
  }, [refreshQueue, refreshSelected]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [selected?.messages.length]);

  const accept = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await acceptChatConversation(selected.sessionId);
      toast.success("Chat accepted. The client is now connected to you.");
      await Promise.all([refreshQueue(true), refreshSelected(true)]);
    } catch (error) {
      toast.error(errorMessage(error, "Could not accept this chat."));
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    const body = message.trim();
    if (!selected || !body || busy) return;
    setBusy(true);
    setMessage("");
    try {
      await sendAgentChatMessage(selected.sessionId, body);
      await Promise.all([refreshQueue(true), refreshSelected(true)]);
    } catch (error) {
      setMessage(body);
      toast.error(errorMessage(error, "Message was not sent."));
    } finally {
      setBusy(false);
    }
  };

  const resolve = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await resolveChatConversation(selected.sessionId);
      toast.success("Conversation resolved.");
      setSelected(null);
      setSelectedId(null);
      await refreshQueue(true);
    } catch (error) {
      toast.error(errorMessage(error, "Could not resolve this conversation."));
    } finally {
      setBusy(false);
    }
  };

  const queueCounts = useMemo(() => ({
    open: summary.waiting + summary.active,
    waiting: summary.waiting,
    active: summary.active,
    resolved: summary.resolvedToday,
  }), [summary]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive"><Clock3 className="h-5 w-5" /></span>
          <div><p className="text-xs text-muted-foreground">Waiting for agent</p><p className="text-2xl font-semibold">{summary.waiting}</p></div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><MessageCircle className="h-5 w-5" /></span>
          <div><p className="text-xs text-muted-foreground">Active live chats</p><p className="text-2xl font-semibold">{summary.active}</p></div>
        </Card>
        <Card className="flex items-center gap-3 p-4">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10 text-success"><CheckCircle2 className="h-5 w-5" /></span>
          <div><p className="text-xs text-muted-foreground">Resolved today</p><p className="text-2xl font-semibold">{summary.resolvedToday}</p></div>
        </Card>
      </div>

      <Card className="grid overflow-hidden lg:h-[500px] lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="border-b border-border lg:border-b-0 lg:border-r">
          <div className="border-b border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Live conversation queue</h2>
                <p className="text-xs text-muted-foreground">Bot escalations and assigned chats</p>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void refreshQueue()}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <Tabs value={queueState} onValueChange={(value) => setQueueState(value as QueueState)}>
              <TabsList className="grid h-auto w-full grid-cols-4">
                {(["open", "waiting", "active", "resolved"] as QueueState[]).map((state) => (
                  <TabsTrigger key={state} value={state} className="gap-1 px-2 text-[11px] capitalize">
                    {state}<span className="text-[10px] opacity-60">{queueCounts[state]}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
          <ScrollArea className="h-[360px] lg:h-[392px]">
            {loading && !conversations.length ? (
              <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : conversations.length ? (
              <div className="divide-y divide-border">
                {conversations.map((row) => (
                  <button
                    key={row.sessionId}
                    onClick={() => setSelectedId(row.sessionId)}
                    className={`w-full p-4 text-left transition-colors ${selectedId === row.sessionId ? "bg-primary/10" : "hover:bg-muted/50"}`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${row.status === 0 ? "bg-destructive" : row.status === 1 ? "bg-success" : "bg-muted-foreground"}`} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">{row.customerName}</span>
                          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">{relativeTime(row.lastMessageAt ?? row.createdAt)}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{row.accountCode} · {row.dpd}d past due</span>
                        <span className="mt-2 block truncate text-xs text-foreground/80">
                          <span className="font-medium">{row.lastSpeaker ? `${speakerLabel(row.lastSpeaker)}: ` : ""}</span>{row.lastMessage || row.detail}
                        </span>
                        <span className="mt-2 flex items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] ${row.status === 0 ? "border-destructive/30 bg-destructive/10 text-destructive" : row.status === 1 ? "border-success/30 bg-success/10 text-success" : ""}`}>
                            {row.status === 0 ? "Waiting" : row.status === 1 ? "Live" : "Resolved"}
                          </Badge>
                          {row.assignedToName && <span className="truncate text-[10px] text-muted-foreground">{row.assignedToName}</span>}
                        </span>
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center px-6 py-16 text-center">
                <CheckCircle2 className="mb-3 h-8 w-8 text-success" />
                <p className="text-sm font-medium">Queue is clear</p>
                <p className="mt-1 text-xs text-muted-foreground">New status 0 escalations will appear here automatically.</p>
              </div>
            )}
          </ScrollArea>
        </div>

        {selected ? (
          <div className="flex h-[500px] min-w-0 flex-col">
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"><UserRound className="h-5 w-5" /></div>
              <div className="min-w-0">
                <h3 className="truncate font-semibold">{selected.customerName}</h3>
                <p className="truncate text-xs text-muted-foreground">{selected.customerCode ?? selected.accountCode} · {selected.msisdn ?? "No phone"} · {formatMoney(selected.outstanding)} outstanding</p>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <Badge variant="outline" className={selected.status === 0 ? "border-destructive/30 bg-destructive/10 text-destructive" : selected.status === 1 ? "border-success/30 bg-success/10 text-success" : ""}>
                  {selected.status === 0 ? "Waiting for agent" : selected.status === 1 ? "Agent connected" : "Resolved"}
                </Badge>
                {canEdit && selected.status === 0 && <Button size="sm" onClick={() => void accept()} disabled={busy}><Headphones className="mr-2 h-4 w-4" />Accept chat</Button>}
                {canEdit && selected.status === 1 && <Button size="sm" variant="outline" onClick={() => void resolve()} disabled={busy}><Check className="mr-2 h-4 w-4" />Resolve</Button>}
              </div>
            </div>

            <div className="border-b border-border bg-muted/20 px-5 py-2.5 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Escalation:</span> {selected.detail || selected.trigger.replace(/_/g, " ")}
              {selected.assignedToName && <span> · Assigned to {selected.assignedToName}</span>}
            </div>

            <ScrollArea className="min-h-0 flex-1">
              <div className="space-y-3 p-5">
                {selected.messages.map((item) => <MessageBubble key={item.id} message={item} />)}
                <div className="flex justify-center py-2">
                  <span className="rounded-full border border-warning/25 bg-warning/10 px-3 py-1 text-[10px] font-medium text-warning">
                    {selected.status === 0 ? "Escalated to a human agent" : selected.status === 1 ? "Human agent joined the conversation" : "Conversation resolved"}
                  </span>
                </div>
                <div ref={endRef} />
              </div>
            </ScrollArea>

            <div className="border-t border-border p-4">
              <div className="flex gap-2">
                <Input
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                  placeholder={selected.status === 0 ? "Accept the chat before replying" : selected.status === 2 ? "Conversation resolved" : "Type a message to the client..."}
                  disabled={!canEdit || selected.status !== 1 || busy}
                />
                <Button size="icon" onClick={() => void send()} disabled={!canEdit || selected.status !== 1 || !message.trim() || busy}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground"><Circle className="h-2.5 w-2.5 fill-success text-success" />Messages are written to the same transcript the client is polling.</p>
            </div>
          </div>
        ) : (
          <div className="flex h-[500px] flex-col items-center justify-center p-8 text-center">
            <MessageCircle className="mb-3 h-10 w-10 text-muted-foreground/50" />
            <h3 className="font-semibold">Select a conversation</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">The full chatbot history appears here before you accept the handoff.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
