import { useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Download,
  FileText,
  Gauge,
  Gift,
  Headphones,
  Plane,
  Radio,
  RefreshCw,
  Repeat,
  ShieldAlert,
  Signal,
  Smartphone,
  Sparkle,
  TicketCheck,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatInr, percent } from "@/lib/format";
import {
  addOns,
  currentBill,
  dailyUsage,
  networkStatus,
  offers,
  payments,
  plans,
  rechargePacks,
  roamingPacks,
  serviceRequests,
  subscriber,
  usageAnomaly,
  usageBuckets,
} from "@/lib/mock-data";
import {
  addonTransaction,
  blockSimTransaction,
  changePlanTransaction,
  payBillTransaction,
  portabilityTransaction,
  rechargeTransaction,
  roamingTransaction,
  simReplacementTransaction,
} from "@/lib/transactions";
import { telecomService } from "@/services/telecom-service";
import { useChat } from "@/state/chat-context";
import { useTransactions } from "@/state/transaction-context";
import type { ResponseCard } from "@/lib/telecom-types";

function CardShell({
  title,
  icon: Icon,
  tone = "default",
  children,
  action,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "warning" | "danger" | "teal";
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const toneRing =
    tone === "warning"
      ? "border-warning/50 bg-warning/5"
      : tone === "danger"
        ? "border-destructive/40 bg-destructive/5"
        : tone === "teal"
          ? "border-teal/40 bg-teal/5"
          : "border-border bg-card";

  return (
    <Card className={`w-full max-w-xl gap-0 overflow-hidden py-0 shadow-card ${toneRing}`}>
      <CardHeader className="flex-row items-center justify-between gap-3 border-b bg-surface-2/60 px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className="size-4 text-primary" aria-hidden="true" />
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent className="space-y-3 px-4 py-4 text-sm">{children}</CardContent>
    </Card>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold text-foreground" : "text-foreground"}>{value}</span>
    </div>
  );
}

function useTxn() {
  const { start } = useTransactions();
  const { pushSystemMessage } = useChat();
  return (descriptor: Parameters<typeof start>[0]) =>
    start(descriptor, (result) => {
      pushSystemMessage(
        `${result.status === "Success" ? "✔" : "✖"} ${descriptor.successTitle} — ${result.message} Reference ID: ${result.reference}`,
      );
      if (result.status === "Success") toast.success(`${descriptor.successTitle} • ${result.reference}`);
      else toast.error(result.message);
    });
}

/* ---------------- Balance & usage ---------------- */

export function BalanceUsageCard() {
  const dataPct = percent(subscriber.dataUsedGb, subscriber.dataTotalGb);
  return (
    <CardShell title="Balance & usage summary" icon={Wallet}>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-surface-2/60 p-3">
          <p className="text-xs text-muted-foreground">Unbilled amount</p>
          <p className="text-lg font-semibold">{formatInr(subscriber.billAmount)}</p>
          <p className="text-xs text-muted-foreground">Due {subscriber.billDueDate}</p>
        </div>
        <div className="rounded-lg border bg-surface-2/60 p-3">
          <p className="text-xs text-muted-foreground">Advance balance</p>
          <p className="text-lg font-semibold">{formatInr(subscriber.balance, true)}</p>
          <p className="text-xs text-muted-foreground">Loyalty: {subscriber.loyaltyTier}</p>
        </div>
      </div>
      <Separator />
      <div className="space-y-3">
        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Data</span>
            <span className="font-medium">
              {subscriber.dataUsedGb} GB of {subscriber.dataTotalGb} GB
            </span>
          </div>
          <Progress value={dataPct} aria-label={`Data used ${dataPct} percent`} />
        </div>
        {usageBuckets.slice(1).map((bucket) => (
          <Row
            key={bucket.label}
            label={bucket.label}
            value={
              bucket.total === "Unlimited"
                ? `${bucket.used} ${bucket.unit} used • Unlimited`
                : `${bucket.used} of ${bucket.total} ${bucket.unit}`
            }
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted-foreground">
        Last 7 days:{" "}
        {dailyUsage.map((d) => (
          <span key={d.day} className="rounded bg-surface-2 px-1.5 py-0.5">
            {d.day.split(" ")[1]}: {d.gb} GB
          </span>
        ))}
      </div>
    </CardShell>
  );
}

/* ---------------- Recharge ---------------- */

export function RechargePacksCard() {
  const startTxn = useTxn();
  return (
    <CardShell title="Recharge packages" icon={Repeat}>
      <div className="space-y-2">
        {rechargePacks.map((pack) => (
          <div
            key={pack.id}
            className="flex items-center justify-between gap-3 rounded-lg border bg-surface p-3"
          >
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold">{formatInr(pack.amount)}</p>
                {pack.highlight ? (
                  <Badge className="bg-teal/20 text-teal-foreground hover:bg-teal/20">
                    {pack.highlight}
                  </Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {pack.data} • {pack.validityDays} days • {pack.talktime}
              </p>
            </div>
            <Button size="sm" onClick={() => startTxn(rechargeTransaction(pack))}>
              Recharge
            </Button>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

/* ---------------- Plans ---------------- */

export function PlansCard() {
  const startTxn = useTxn();
  return (
    <CardShell title="Recommended plans" icon={Gauge}>
      <div className="space-y-2">
        {plans.map((plan) => (
          <div key={plan.id} className="rounded-lg border bg-surface p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{plan.name}</p>
                  {plan.current ? <Badge variant="secondary">Current plan</Badge> : null}
                  {plan.recommended ? (
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/10">
                      Recommended
                    </Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {plan.data} • {plan.voice} calls • {plan.sms}
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                  {plan.perks.map((perk) => (
                    <li key={perk} className="flex items-center gap-1">
                      <CheckCircle2 className="size-3 text-success" aria-hidden="true" />
                      {perk}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatInr(plan.price)}</p>
                <p className="text-xs text-muted-foreground">/ month</p>
              </div>
            </div>
            {!plan.current && (
              <Button
                size="sm"
                variant="outline"
                className="mt-3"
                onClick={() => startTxn(changePlanTransaction(plan))}
              >
                Switch to this plan <ArrowRight className="ml-1 size-3.5" aria-hidden="true" />
              </Button>
            )}
          </div>
        ))}
      </div>
    </CardShell>
  );
}

/* ---------------- Bill ---------------- */

export function CurrentBillCard() {
  const startTxn = useTxn();
  return (
    <CardShell
      title="Current bill"
      icon={FileText}
      action={
        <Button
          size="sm"
          variant="ghost"
          onClick={() => toast.success(`Statement ${currentBill.id} downloaded as PDF`)}
        >
          <Download className="mr-1 size-3.5" aria-hidden="true" /> PDF
        </Button>
      }
    >
      <div className="flex items-end justify-between">
        <div>
          <p className="text-2xl font-semibold">{formatInr(currentBill.amount)}</p>
          <p className="text-xs text-muted-foreground">{currentBill.cycle}</p>
        </div>
        <Badge className="bg-warning/20 text-warning-foreground hover:bg-warning/20">
          {currentBill.status} • {currentBill.dueDate}
        </Badge>
      </div>
      <Separator />
      <div className="space-y-1.5">
        {currentBill.breakdown.map((line) => (
          <Row key={line.label} label={line.label} value={formatInr(line.amount)} />
        ))}
      </div>
      <Separator />
      <Row label="Invoice" value={currentBill.id} strong />
      <Button className="w-full" onClick={() => startTxn(payBillTransaction(currentBill))}>
        Pay {formatInr(currentBill.amount)} now
      </Button>
    </CardShell>
  );
}

/* ---------------- Payments ---------------- */

export function PaymentHistoryCard() {
  return (
    <CardShell title="Payment history" icon={BadgeCheck}>
      <div className="space-y-2">
        {payments.map((payment) => (
          <div key={payment.id} className="rounded-lg border bg-surface p-3">
            <div className="flex items-center justify-between">
              <p className="font-semibold">{formatInr(payment.amount)}</p>
              <Badge
                className={
                  payment.status === "Success"
                    ? "bg-success/15 text-success hover:bg-success/15"
                    : "bg-destructive/15 text-destructive hover:bg-destructive/15"
                }
              >
                {payment.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {payment.date} • {payment.method}
            </p>
            <p className="text-xs text-muted-foreground">Ref {payment.reference}</p>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

/* ---------------- Add-ons ---------------- */

export function AddOnsCard() {
  const startTxn = useTxn();
  return (
    <CardShell title="Add-ons" icon={Sparkle}>
      <div className="space-y-2">
        {addOns.map((addon) => (
          <div
            key={addon.id}
            className="flex items-center justify-between gap-3 rounded-lg border bg-surface p-3"
          >
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium">{addon.name}</p>
                {addon.active ? (
                  <Badge className="bg-success/15 text-success hover:bg-success/15">Active</Badge>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {addon.detail} • {addon.validity}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold">{formatInr(addon.price)}</p>
              {!addon.active && (
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-1"
                  onClick={() => startTxn(addonTransaction(addon))}
                >
                  Activate
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

/* ---------------- Roaming ---------------- */

export function RoamingPacksCard() {
  const startTxn = useTxn();
  return (
    <CardShell title="International roaming packs" icon={Plane} tone="teal">
      <div className="space-y-2">
        {roamingPacks.map((pack) => (
          <div key={pack.id} className="rounded-lg border bg-surface p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{pack.name}</p>
                <p className="text-xs text-muted-foreground">{pack.countries}</p>
                <p className="text-xs text-muted-foreground">
                  {pack.data} • {pack.calls} • {pack.validity}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatInr(pack.price)}</p>
                <Button
                  size="sm"
                  className="mt-1"
                  onClick={() => startTxn(roamingTransaction(pack))}
                >
                  Activate
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Roaming activates within 15 minutes. Charges apply from first network registration abroad.
      </p>
    </CardShell>
  );
}

/* ---------------- Service requests ---------------- */

export function ServiceRequestStatusCard() {
  return (
    <CardShell title="Service request status" icon={TicketCheck}>
      <div className="space-y-2">
        {serviceRequests.map((request) => (
          <div key={request.id} className="rounded-lg border bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{request.type}</p>
              <Badge
                className={
                  request.status === "Resolved"
                    ? "bg-success/15 text-success hover:bg-success/15"
                    : request.status === "Escalated"
                      ? "bg-destructive/15 text-destructive hover:bg-destructive/15"
                      : "bg-info/15 text-info hover:bg-info/15"
                }
              >
                {request.status}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {request.id} • Raised {request.raisedOn} • {request.channel}
            </p>
            <p className="mt-1 text-xs text-foreground">{request.notes}</p>
            <p className="text-xs text-muted-foreground">Target: {request.eta}</p>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

/* ---------------- Network outage ---------------- */

export function NetworkStatusCard() {
  return (
    <CardShell title="Network status in your area" icon={Signal} tone="warning">
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{networkStatus.headline}</p>
        <Badge className="bg-warning/20 text-warning-foreground hover:bg-warning/20">
          {networkStatus.severity}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">{networkStatus.area}</p>
      <p className="text-sm">{networkStatus.detail}</p>
      <Row label="Affected services" value={networkStatus.affectedServices.join(", ")} />
      <Row label="Restoration ETA" value={networkStatus.restorationEta} />
      <Row label="Last updated" value={networkStatus.lastUpdated} />
    </CardShell>
  );
}

/* ---------------- Ticket creation ---------------- */

export function CreateTicketCard() {
  const { pushSystemMessage } = useChat();
  const [notes, setNotes] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [reference, setReference] = useState("");

  const submit = async () => {
    setState("saving");
    const request = await telecomService.createServiceRequest(
      "Network – Reported via AI Assistant",
      notes.trim() || "Subscriber reported degraded indoor coverage.",
    );
    setReference(request.id);
    setState("done");
    pushSystemMessage(
      `✔ Complaint registered. Ticket ${request.id} • target resolution ${request.eta}.`,
    );
    toast.success(`Complaint ${request.id} registered`);
  };

  if (state === "done") {
    return (
      <CardShell title="Complaint registered" icon={CheckCircle2} tone="teal">
        <p className="text-sm">
          Your complaint has been logged. A network engineer will update you by SMS.
        </p>
        <Row label="Ticket ID" value={reference} strong />
        <Row label="Target resolution" value="48 hours" />
      </CardShell>
    );
  }

  return (
    <CardShell title="Register a network complaint" icon={Radio}>
      <label className="text-xs text-muted-foreground" htmlFor="ticket-notes">
        Describe the issue (optional)
      </label>
      <Textarea
        id="ticket-notes"
        value={notes}
        maxLength={400}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="e.g. No 5G indoors after 8 PM, calls drop on the 3rd floor"
        className="min-h-20"
      />
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Location: {networkStatus.area}</p>
        <Button size="sm" onClick={() => void submit()} disabled={state === "saving"}>
          {state === "saving" ? (
            <>
              <RefreshCw className="mr-1 size-3.5 animate-spin" aria-hidden="true" /> Registering
            </>
          ) : (
            "Register complaint"
          )}
        </Button>
      </div>
    </CardShell>
  );
}

/* ---------------- SIM services ---------------- */

export function SimServicesCard() {
  const startTxn = useTxn();
  return (
    <CardShell title="SIM services" icon={Smartphone} tone="danger">
      <Row label="Current SIM status" value={subscriber.simStatus} strong />
      <Row label="Network" value={`${subscriber.networkType} • ${subscriber.circle}`} />
      <p className="text-xs text-muted-foreground">
        Blocking a SIM stops all services immediately and cannot be undone from this portal.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="destructive"
          onClick={() => startTxn(blockSimTransaction(subscriber.msisdn))}
        >
          <ShieldAlert className="mr-1 size-3.5" aria-hidden="true" /> Block lost SIM
        </Button>
        <Button size="sm" variant="outline" onClick={() => startTxn(simReplacementTransaction())}>
          Request replacement SIM
        </Button>
      </div>
    </CardShell>
  );
}

export function PortabilityCard() {
  const startTxn = useTxn();
  return (
    <CardShell title="Mobile number portability" icon={Repeat}>
      <p className="text-sm">
        Generating a UPC starts the porting process. Your Gold tier benefits and retention offers
        will lapse once porting completes.
      </p>
      <Row label="Outstanding dues" value={formatInr(currentBill.amount)} />
      <Row label="UPC validity" value="4 days" />
      <Button size="sm" variant="outline" onClick={() => startTxn(portabilityTransaction())}>
        Generate porting code
      </Button>
    </CardShell>
  );
}

/* ---------------- Anomaly & offers ---------------- */

export function UsageAnomalyCard() {
  return (
    <CardShell title="Usage anomaly detected" icon={TrendingUp} tone="warning">
      <div className="flex items-center justify-between">
        <p className="font-medium">{usageAnomaly.metric}</p>
        <Badge className="bg-warning/20 text-warning-foreground hover:bg-warning/20">
          {usageAnomaly.change}
        </Badge>
      </div>
      <p className="text-sm">{usageAnomaly.detail}</p>
      <p className="text-xs text-muted-foreground">Detected on {usageAnomaly.detectedOn}</p>
    </CardShell>
  );
}

export function OffersCard() {
  return (
    <CardShell title="Personalised offers" icon={Gift} tone="teal">
      <div className="space-y-2">
        {offers.map((offer) => (
          <div key={offer.id} className="rounded-lg border bg-surface p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium">{offer.title}</p>
              <Badge variant="secondary">{offer.tag}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{offer.detail}</p>
            <div className="mt-2 flex items-center justify-between">
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarClock className="size-3.5" aria-hidden="true" /> Valid till {offer.validTill}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => toast.success(`Offer ${offer.id} claimed. Applied within 24 hours.`)}
              >
                Claim
              </Button>
            </div>
          </div>
        ))}
      </div>
    </CardShell>
  );
}

/* ---------------- Live agent ---------------- */

export function LiveAgentCard() {
  const { pushSystemMessage } = useChat();
  const [state, setState] = useState<"idle" | "connecting" | "connected">("idle");
  const [queue, setQueue] = useState<{ queuePosition: number; waitMinutes: number; agent: string }>();

  const connect = async () => {
    setState("connecting");
    const result = await telecomService.escalateToAgent();
    setQueue(result);
    setState("connected");
    pushSystemMessage(
      `You are connected with ${result.agent}. Your account context and chat transcript have been shared securely.`,
    );
  };

  return (
    <CardShell title="Talk to a care specialist" icon={Headphones}>
      {state === "connected" && queue ? (
        <>
          <p className="text-sm">
            Connected with <span className="font-semibold">{queue.agent}</span>. Average handling
            time 6 minutes.
          </p>
          <Row label="Queue position" value={`${queue.queuePosition}`} />
          <Row label="Estimated wait" value={`${queue.waitMinutes} minutes`} />
        </>
      ) : (
        <>
          <p className="text-sm">
            A postpaid care specialist can take over this conversation. Support hours: 24×7 on{" "}
            {"198"}.
          </p>
          <Button size="sm" onClick={() => void connect()} disabled={state === "connecting"}>
            {state === "connecting" ? (
              <>
                <RefreshCw className="mr-1 size-3.5 animate-spin" aria-hidden="true" /> Connecting
              </>
            ) : (
              "Connect me to an agent"
            )}
          </Button>
        </>
      )}
    </CardShell>
  );
}

/* ---------------- Renderer ---------------- */

export function ResponseCardRenderer({ card }: { card: ResponseCard }) {
  switch (card.kind) {
    case "balance":
      return <BalanceUsageCard />;
    case "recharge":
      return <RechargePacksCard />;
    case "plans":
      return <PlansCard />;
    case "bill":
      return <CurrentBillCard />;
    case "payments":
      return <PaymentHistoryCard />;
    case "addons":
      return <AddOnsCard />;
    case "roaming":
      return <RoamingPacksCard />;
    case "request-status":
      return <ServiceRequestStatusCard />;
    case "outage":
      return <NetworkStatusCard />;
    case "ticket":
      return <CreateTicketCard />;
    case "sim-replacement":
      return <SimServicesCard />;
    case "portability":
      return <PortabilityCard />;
    case "anomaly":
      return <UsageAnomalyCard />;
    case "offers":
      return <OffersCard />;
    case "agent":
      return <LiveAgentCard />;
    default:
      return (
        <CardShell title="Unsupported response" icon={AlertTriangle} tone="warning">
          <p className="text-sm">This response type isn't available in your app version.</p>
        </CardShell>
      );
  }
}
