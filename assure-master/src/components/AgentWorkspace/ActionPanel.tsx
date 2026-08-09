import { useEffect, useState } from "react";
import {
  Banknote,
  FileWarning,
  HandCoins,
  Loader2,
  MessageSquare,
  PhoneCall,
  Send,
  StickyNote,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { money } from "@/lib/money";
import { ApiError } from "@/lib/api";
import {
  ACTIVITY_TYPES,
  CHANNELS,
  DISPUTE_REASONS,
  PAYMENT_METHODS,
  addActivity,
  createDispute,
  createPtp,
  getReminderTemplates,
  logPayment,
  sendReminder,
  type ReminderTemplate,
  type WorkItem,
} from "@/lib/agentDesk";
import { plusDaysISO, pretty, todayISO } from "./shared";

export type Action = "log" | "remind" | "ptp" | "payment" | "dispute";

const CALL_OUTCOMES = [
  "Reached — will pay",
  "Reached — negotiating",
  "Reached — disputes the balance",
  "Reached — refused",
  "No answer",
  "Voicemail left",
  "Wrong number",
  "Line busy",
];

/**
 * The five things a collector does on a call, in one panel. Each one writes to
 * the table that already owns it — case_activity, ptp, payment, dispute — so
 * nothing here is a parallel record of work.
 */
export const ActionPanel = ({
  action,
  customer,
  caseId,
  onDone,
  onCancel,
}: {
  action: Action;
  customer: WorkItem;
  caseId?: number | null;
  onDone: () => void;
  onCancel: () => void;
}) => {
  const [busy, setBusy] = useState(false);
  const [templates, setTemplates] = useState<ReminderTemplate[]>([]);

  // Log a contact
  const [type, setType] = useState("CALL");
  const [channel, setChannel] = useState(customer.bestChannel ?? "Dialer");
  const [outcome, setOutcome] = useState(CALL_OUTCOMES[0]);
  const [note, setNote] = useState("");

  // Reminder
  const [templateKey, setTemplateKey] = useState("overdue");
  const [reminderChannel, setReminderChannel] = useState("SMS");

  // Promise
  const [amount, setAmount] = useState(String(customer.outstanding.toFixed(2)));
  const [promiseDate, setPromiseDate] = useState(plusDaysISO(7));
  const [instalments, setInstalments] = useState("1");

  // Payment
  const [payAmount, setPayAmount] = useState(String(customer.outstanding.toFixed(2)));
  const [method, setMethod] = useState("Payment Link");
  const [paidOn, setPaidOn] = useState(todayISO());

  // Dispute
  const [reason, setReason] = useState<string>(DISPUTE_REASONS[0]);
  const [disputeAmount, setDisputeAmount] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (action === "remind" && templates.length === 0) {
      getReminderTemplates().then(setTemplates).catch(() => undefined);
    }
  }, [action, templates.length]);

  useEffect(() => {
    const t = templates.find((x) => x.key === templateKey);
    if (t) setReminderChannel(t.channel);
  }, [templateKey, templates]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That did not go through.");
    } finally {
      setBusy(false);
    }
  };

  const field = (label: string, node: React.ReactNode) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {node}
    </div>
  );

  const pick = (
    label: string,
    value: string,
    options: readonly string[],
    onChange: (v: string) => void,
  ) =>
    field(
      label,
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {pretty(o)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>,
    );

  const HEADERS: Record<Action, { title: string; icon: typeof PhoneCall; hint: string }> = {
    log: { title: "Log a contact", icon: PhoneCall, hint: "Records the attempt on the case timeline." },
    remind: {
      title: "Send a payment reminder",
      icon: Send,
      hint: "Goes out on the chosen channel and is logged as customer-facing.",
    },
    ptp: {
      title: "Take a promise to pay",
      icon: HandCoins,
      hint: "One open promise per customer. It settles itself when the money arrives.",
    },
    payment: {
      title: "Record a payment",
      icon: Banknote,
      hint: "Reduces the balance and closes any promise it satisfies.",
    },
    dispute: { title: "Raise a dispute", icon: FileWarning, hint: "Opens a dispute with a 48-hour SLA." },
  };
  const H = HEADERS[action];

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <H.icon className="h-4 w-4 text-primary mt-0.5" />
        <div>
          <h3 className="text-sm font-semibold text-foreground">{H.title}</h3>
          <p className="text-[11px] text-muted-foreground">{H.hint}</p>
        </div>
      </div>

      {action === "log" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {pick("Type", type, ACTIVITY_TYPES, setType)}
            {pick("Channel", channel, CHANNELS, setChannel)}
          </div>
          {pick("Outcome", outcome, CALL_OUTCOMES, setOutcome)}
          {field(
            "Notes",
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What was said?"
            />,
          )}
          <Button
            size="sm"
            className="w-full"
            disabled={busy || !caseId}
            title={caseId ? undefined : "Open or raise a case for this customer first"}
            onClick={() =>
              run(
                () =>
                  addActivity(caseId!, {
                    type,
                    channel,
                    direction: type === "NOTE" ? "INTERNAL" : "OUTBOUND",
                    subject: `${pretty(type)} — ${outcome}`,
                    body: note || undefined,
                    outcome,
                    visibility: type === "NOTE" ? "INTERNAL" : "CUSTOMER_FACING",
                  }),
                "Contact logged.",
              )
            }
          >
            {busy && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
            <StickyNote className="h-3.5 w-3.5 mr-1.5" />
            Log contact
          </Button>
        </>
      )}

      {action === "remind" && (
        <>
          {field(
            "Template",
            <Select value={templateKey} onValueChange={setTemplateKey}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.key} value={t.key}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>,
          )}
          {pick("Channel", reminderChannel, CHANNELS, setReminderChannel)}
          <div className="rounded-lg bg-background border border-border p-2.5">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
              <MessageSquare className="h-3 w-3" /> Preview
            </div>
            <p className="text-xs text-foreground leading-relaxed">
              {(templates.find((t) => t.key === templateKey)?.body ?? "")
                .replace("{name}", customer.customerName)
                .replace("{amount}", money(customer.outstanding))
                .replace("{account}", customer.accountCode ?? "your account")
                .replace("{dpd}", String(customer.dpd))
                .replace("{date}", customer.ptpDueOn ?? "the agreed date")
                .replace("{link}", "pay.radonaix.io/x")}
            </p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Sending to{" "}
            {reminderChannel === "Email"
              ? customer.email ?? "no email on record"
              : customer.phone ?? "no number on record"}
          </p>
          <Button
            size="sm"
            className="w-full"
            disabled={busy}
            onClick={() =>
              run(
                () =>
                  sendReminder({
                    customerId: customer.customerId,
                    accountId: customer.accountId,
                    caseId,
                    channel: reminderChannel,
                    template: templateKey,
                  }),
                "Reminder sent.",
              )
            }
          >
            {busy && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
            Send reminder
          </Button>
        </>
      )}

      {action === "ptp" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {field(
              `Amount (owes ${money(customer.outstanding)})`,
              <Input
                type="number"
                className="h-9"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />,
            )}
            {field(
              "Promised by",
              <Input
                type="date"
                className="h-9"
                min={todayISO()}
                value={promiseDate}
                onChange={(e) => setPromiseDate(e.target.value)}
              />,
            )}
          </div>
          <div className="flex gap-1.5">
            {[
              ["Tomorrow", 1],
              ["In a week", 7],
              ["In a fortnight", 14],
              ["Month end", 30],
            ].map(([label, days]) => (
              <button
                key={label as string}
                onClick={() => setPromiseDate(plusDaysISO(days as number))}
                className="flex-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted transition"
              >
                {label}
              </button>
            ))}
          </div>
          {field(
            "Instalments",
            <Input
              type="number"
              min={1}
              className="h-9"
              value={instalments}
              onChange={(e) => setInstalments(e.target.value)}
            />,
          )}
          {field(
            "Notes",
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What did they agree to?"
            />,
          )}
          <Button
            size="sm"
            className="w-full"
            disabled={busy || Number(amount) <= 0}
            onClick={() =>
              run(
                () =>
                  createPtp({
                    customerId: customer.customerId,
                    accountId: customer.accountId,
                    caseId,
                    promisedAmount: Number(amount),
                    promisedDate: promiseDate,
                    instalments: Number(instalments) || 1,
                    channel,
                    notes: note || undefined,
                  }),
                "Promise recorded.",
              )
            }
          >
            {busy && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
            Record promise of {money(Number(amount) || 0)}
          </Button>
        </>
      )}

      {action === "payment" && (
        <>
          <div className="grid grid-cols-2 gap-3">
            {field(
              "Amount",
              <Input
                type="number"
                className="h-9"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
              />,
            )}
            {field(
              "Paid on",
              <Input
                type="date"
                className="h-9"
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
              />,
            )}
          </div>
          {pick("Method", method, PAYMENT_METHODS, setMethod)}
          {field(
            "Note",
            <Input
              className="h-9"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Reference or context"
            />,
          )}
          <Button
            size="sm"
            className="w-full"
            disabled={busy || !customer.accountId || Number(payAmount) <= 0}
            onClick={() =>
              run(
                () =>
                  logPayment({
                    customerId: customer.customerId,
                    accountId: customer.accountId!,
                    amount: Number(payAmount),
                    method,
                    paidOn,
                    note: note || undefined,
                  }),
                "Payment recorded.",
              )
            }
          >
            {busy && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
            Record {money(Number(payAmount) || 0)}
          </Button>
        </>
      )}

      {action === "dispute" && (
        <>
          {pick("Reason", reason, DISPUTE_REASONS, setReason)}
          {field(
            "Disputed amount",
            <Input
              type="number"
              className="h-9"
              value={disputeAmount}
              onChange={(e) => setDisputeAmount(e.target.value)}
              placeholder="0.00"
            />,
          )}
          {field(
            "What is being disputed?",
            <Textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />,
          )}
          <Button
            size="sm"
            className="w-full"
            disabled={busy}
            onClick={() =>
              run(
                () =>
                  createDispute({
                    customerId: customer.customerId,
                    accountId: customer.accountId,
                    caseId,
                    reason,
                    description: description || undefined,
                    amount: Number(disputeAmount) || 0,
                  }),
                "Dispute raised.",
              )
            }
          >
            {busy && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
            Raise dispute
          </Button>
        </>
      )}

      <button
        onClick={onCancel}
        className="w-full text-[11px] text-muted-foreground hover:text-foreground transition"
      >
        Cancel
      </button>
    </div>
  );
};
