import { useState } from "react";
import {
  ChevronDown,
  Eye,
  EyeOff,
  Globe,
  History,
  Plus,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import operatorLogo from "@/assets/novatel-logo.png";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LANGUAGES, OPERATOR } from "@/lib/mock-data";
import { maskId, maskMsisdn } from "@/lib/format";
import { useChat, type ConnectionState } from "@/state/chat-context";
import { useSubscriber } from "@/state/subscriber-context";

const CONNECTION_LABEL: Record<ConnectionState, string> = {
  online: "Online • Secure session",
  reconnecting: "Reconnecting…",
  offline: "Disconnected",
};

export function ChatHeader() {
  const { conversations, historyLoading, connection, startNewConversation, openConversation } =
    useChat();
  const { profile, loading, reveal, toggleReveal } = useSubscriber();
  const [language, setLanguage] = useState(LANGUAGES[0]!);

  const initials = profile?.name
    ? profile.name
        .split(" ")
        .map((part) => part[0])
        .join("")
    : "";

  return (
    <header className="shrink-0 border-b bg-surface">
      <div className="mx-auto grid max-w-5xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <img
            src={operatorLogo}
            alt={`${OPERATOR.name} logo`}
            width={36}
            height={36}
            className="size-9 shrink-0 rounded-lg"
          />
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold sm:text-base">
              {OPERATOR.name} Assist
            </h1>
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span
                className={`size-1.5 shrink-0 rounded-full ${
                  connection === "online"
                    ? "bg-success"
                    : connection === "reconnecting"
                      ? "bg-warning"
                      : "bg-destructive"
                }`}
                aria-hidden="true"
              />
              <span className="truncate">{CONNECTION_LABEL[connection]}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <span className="hidden items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-[11px] text-success md:flex">
            <ShieldCheck className="size-3" aria-hidden="true" /> Encrypted
          </span>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1 px-2">
                <Globe className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">{language.label}</span>
                <ChevronDown className="size-3" aria-hidden="true" />
                <span className="sr-only">Change language</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Language</DropdownMenuLabel>
              {LANGUAGES.map((item) => (
                <DropdownMenuItem key={item.code} onClick={() => setLanguage(item)}>
                  {item.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Conversation history">
                <History className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>Conversation history</DropdownMenuLabel>
              {historyLoading ? (
                <div className="space-y-2 p-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-36" />
                </div>
              ) : conversations.length === 0 ? (
                <p className="p-2 text-xs text-muted-foreground">No earlier conversations yet.</p>
              ) : (
                conversations.map((conversation) => (
                  <DropdownMenuItem
                    key={conversation.id}
                    onClick={() => openConversation(conversation.id)}
                    className="flex-col items-start gap-0.5"
                  >
                    <span className="text-sm">{conversation.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {conversation.id} • {conversation.startedAt}
                    </span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="sm"
            variant="secondary"
            className="gap-1.5"
            onClick={startNewConversation}
          >
            <Plus className="size-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">New chat</span>
            <span className="sr-only sm:hidden">New chat</span>
          </Button>

          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-navy text-[11px] font-semibold text-navy-foreground"
            title={profile?.name ?? "Subscriber"}
          >
            {initials || <UserRound className="size-4" aria-hidden="true" />}
          </span>
        </div>
      </div>

      <SubscriberContextCard
        loading={loading}
        reveal={reveal}
        onToggleReveal={toggleReveal}
        name={profile?.name}
        msisdn={profile?.msisdn}
        customerId={profile?.customerId}
        customerType={profile?.customerType}
        plan={profile?.plan}
        accountStatus={profile?.accountStatus}
      />
    </header>
  );
}

function SubscriberContextCard({
  loading,
  reveal,
  onToggleReveal,
  name,
  msisdn,
  customerId,
  customerType,
  plan,
  accountStatus,
}: {
  loading: boolean;
  reveal: boolean;
  onToggleReveal: () => void;
  name?: string | undefined;
  msisdn?: string | undefined;
  customerId?: string | undefined;
  customerType?: string | undefined;
  plan?: string | undefined;
  accountStatus?: string | undefined;
}) {
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-3 pb-2 sm:px-6">
        <Skeleton className="h-8 w-full max-w-sm rounded-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-3 pb-2 sm:px-6">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-full border bg-surface-2 px-3 py-1.5 text-left text-[11px] transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none sm:w-auto"
            aria-label="Toggle account context details"
          >
            <span className="font-medium">{msisdn ? maskMsisdn(msisdn, reveal) : "—"}</span>
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">
              {customerType ?? "Subscriber"}
            </Badge>
            <span className="truncate text-muted-foreground">{plan}</span>
            <ChevronDown
              className={`ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <dl className="mt-2 grid gap-x-6 gap-y-1.5 rounded-xl border bg-card p-3 text-xs sm:grid-cols-2">
            <Row label="Subscriber" value={name ?? "—"} />
            <Row label="Mobile number" value={msisdn ? maskMsisdn(msisdn, reveal) : "—"} />
            <Row label="Customer ID" value={customerId ? maskId(customerId, reveal) : "—"} />
            <Row label="Connection" value={customerType ?? "—"} />
            <Row label="Active plan" value={plan ?? "—"} />
            <Row label="Account status" value={accountStatus ?? "—"} />
            <div className="sm:col-span-2 mt-1 flex items-center justify-between gap-2">
              <p className="text-[11px] text-muted-foreground">
                Identifiers are masked by default; unmasking is audit-logged.
              </p>
              <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={onToggleReveal}>
                {reveal ? (
                  <>
                    <EyeOff className="mr-1 size-3" aria-hidden="true" /> Hide
                  </>
                ) : (
                  <>
                    <Eye className="mr-1 size-3" aria-hidden="true" /> Reveal
                  </>
                )}
              </Button>
            </div>
          </dl>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed py-1 last:border-0 sm:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}
