import { useEffect, useState } from "react";
import {
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  CircleSlash,
  Clock,
  Gavel,
  Loader2,
  Undo2,
  X,
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
import {
  createLegalCase,
  getPlacement,
  patchPlacement,
  postRecovery,
  reassignPlacement,
  reverseRecovery,
  PAYMENT_METHODS,
  PRIORITIES,
  type Agency,
  type PlacementDetail,
} from "@/lib/recovery";
import { ApiError } from "@/lib/api";
import { PRIORITY_TONE, Pill, ProgressTrack, STATUS_TONE, dateText, dateTimeText, pretty, todayISO } from "./shared";

type Panel = "timeline" | "recover" | "reassign" | "close" | "legal";

/**
 * Everything about one placement, and every action you can take on it, in a
 * single slide-over — so working the book never means leaving the board.
 */
export const PlacementDrawer = ({
  placementId,
  agencies,
  canEdit,
  onClose,
  onChanged,
  onOpenCustomer,
}: {
  placementId: number | null;
  agencies: Agency[];
  canEdit: boolean;
  onClose: () => void;
  onChanged: () => void;
  onOpenCustomer?: (customerCode: string) => void;
}) => {
  const [detail, setDetail] = useState<PlacementDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [panel, setPanel] = useState<Panel>("timeline");
  const [busy, setBusy] = useState(false);

  // Action form state
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [reference, setReference] = useState("");
  const [recoveredOn, setRecoveredOn] = useState(todayISO());
  const [newAgency, setNewAgency] = useState("");
  const [reason, setReason] = useState("");
  const [closeStatus, setCloseStatus] = useState("RECALLED");
  const [closeReason, setCloseReason] = useState("");
  const [legal, setLegal] = useState({ firm: "", attorney: "", court: "", prob: "50" });

  const load = async () => {
    if (!placementId) return;
    setLoading(true);
    try {
      setDetail(await getPlacement(placementId));
    } catch {
      toast.error("Could not load that placement.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPanel("timeline");
    setAmount("");
    setReference("");
    setReason("");
    setCloseReason("");
    setRecoveredOn(todayISO());
    if (placementId) void load();
    else setDetail(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placementId]);

  if (!placementId) return null;
  const p = detail?.placement;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      await load();
      onChanged();
      setPanel("timeline");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That did not go through.");
    } finally {
      setBusy(false);
    }
  };

  const open = p ? p.openAmount : 0;
  const isOpen = p ? ["ACTIVE", "LEGAL"].includes(p.status) : false;

  const field = (label: string, node: React.ReactNode) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {node}
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 bottom-0 w-full sm:w-[520px] bg-background border-l border-border z-50 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-muted-foreground">{p?.code}</span>
                {p && <Pill tone={STATUS_TONE[p.status]}>{pretty(p.status)}</Pill>}
                {p?.overdueRecall && <Pill tone={STATUS_TONE.RECALLED}>Recall due</Pill>}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <h2 className="text-lg font-semibold text-foreground truncate">
                  {p?.customerName ?? "—"}
                </h2>
                {onOpenCustomer && p && (
                  <button
                    onClick={() => onOpenCustomer(p.customerId)}
                    title="Open in Subscriber 360"
                    className="shrink-0 inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-primary hover:border-primary/40 transition"
                  >
                    360 <ArrowUpRight className="h-3 w-3" />
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {p?.agencyName} · {p?.accountCode ?? p?.customerId}
              </p>
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {p && (
            <div className="mt-4">
              <div className="flex items-baseline justify-between text-xs mb-1.5">
                <span className="text-muted-foreground">
                  Recovered{" "}
                  <span className="font-semibold text-success">{money(p.recoveredAmount)}</span> of{" "}
                  {money(p.placedAmount)}
                </span>
                <span className="font-semibold text-foreground tabular-nums">{p.recoveryPct}%</span>
              </div>
              <ProgressTrack pct={p.recoveryPct} tone="bg-success" />
              <div className="grid grid-cols-4 gap-2 mt-3 text-center">
                {[
                  ["Open / account debt", money(open)],
                  ["Commission", money(p.commissionAccrued)],
                  ["With agency", `${p.daysWithAgency}d`],
                  ["Days past due", String(p.dpd)],
                ].map(([l, v]) => (
                  <div key={l} className="rounded-lg bg-muted/50 py-2">
                    <div className="text-[10px] text-muted-foreground">{l}</div>
                    <div className="text-sm font-semibold text-foreground tabular-nums">{v}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        {canEdit && isOpen && (
          <div className="px-5 py-2.5 border-b border-border flex flex-wrap gap-1.5">
            {(
              [
                ["recover", "Post recovery", Banknote],
                ["reassign", "Reassign", ArrowLeftRight],
                ["close", "Recall / close", CircleSlash],
                ["legal", "Escalate legal", Gavel],
              ] as const
            ).map(([key, label, Icon]) => (
              <button
                key={key}
                onClick={() => setPanel(panel === key ? "timeline" : key)}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition ${
                  panel === key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-foreground hover:bg-muted"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />}

          {/* --- Action panels --- */}
          {panel === "recover" && p && (
            <div className="rounded-xl border border-border p-4 space-y-3 bg-muted/20">
              <h3 className="text-sm font-semibold">Post a recovery</h3>
              <div className="grid grid-cols-2 gap-3">
                {field(
                  `Amount (max ${money(open)})`,
                  <Input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="h-9"
                  />,
                )}
                {field(
                  "Received on",
                  <Input
                    type="date"
                    value={recoveredOn}
                    onChange={(e) => setRecoveredOn(e.target.value)}
                    className="h-9"
                  />,
                )}
                {field(
                  "Method",
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAYMENT_METHODS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>,
                )}
                {field(
                  "Reference",
                  <Input
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="RCV-000000"
                    className="h-9"
                  />,
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Commission of {p.commissionPct}% is calculated automatically. Recovering the full
                balance settles and closes the placement.
              </p>
              <Button
                size="sm"
                className="w-full"
                disabled={busy || !amount || Number(amount) <= 0}
                onClick={() =>
                  run(
                    () =>
                      postRecovery(p.id, {
                        amount: Number(amount),
                        recoveredOn,
                        method,
                        reference: reference || undefined,
                      }),
                    "Recovery posted.",
                  )
                }
              >
                {busy && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                Post {amount ? money(Number(amount)) : "recovery"}
              </Button>
            </div>
          )}

          {panel === "reassign" && p && (
            <div className="rounded-xl border border-border p-4 space-y-3 bg-muted/20">
              <h3 className="text-sm font-semibold">Reassign to another agency</h3>
              {field(
                "New agency",
                <Select value={newAgency} onValueChange={setNewAgency}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Choose an agency" />
                  </SelectTrigger>
                  <SelectContent>
                    {agencies
                      .filter((a) => a.id !== p.agencyId && a.status === "ACTIVE")
                      .map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} · {a.commissionPct}% · {a.recoveryRate}% recovery
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>,
              )}
              {field(
                "Reason",
                <Textarea
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Why is this moving?"
                />,
              )}
              <p className="text-[11px] text-muted-foreground">
                The recall window and commission reset to the new agency's contract. Recoveries
                already posted stay on the placement.
              </p>
              <Button
                size="sm"
                className="w-full"
                disabled={busy || !newAgency}
                onClick={() =>
                  run(() => reassignPlacement(p.id, newAgency, reason || undefined), "Placement reassigned.")
                }
              >
                {busy && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                Reassign
              </Button>
            </div>
          )}

          {panel === "close" && p && (
            <div className="rounded-xl border border-border p-4 space-y-3 bg-muted/20">
              <h3 className="text-sm font-semibold">Recall or close</h3>
              {field(
                "Outcome",
                <Select value={closeStatus} onValueChange={setCloseStatus}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RECALLED">Recall from agency</SelectItem>
                    <SelectItem value="SETTLED">Settled</SelectItem>
                    <SelectItem value="CLOSED">Close</SelectItem>
                  </SelectContent>
                </Select>,
              )}
              {field(
                "Reason",
                <Input
                  value={closeReason}
                  onChange={(e) => setCloseReason(e.target.value)}
                  placeholder="No contact established"
                  className="h-9"
                />,
              )}
              <Button
                size="sm"
                variant="destructive"
                className="w-full"
                disabled={busy}
                onClick={() =>
                  run(
                    () =>
                      patchPlacement(p.id, {
                        status: closeStatus,
                        closeReason: closeReason || undefined,
                      }),
                    "Placement updated.",
                  )
                }
              >
                {busy && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                Confirm
              </Button>
            </div>
          )}

          {panel === "legal" && p && (
            <div className="rounded-xl border border-border p-4 space-y-3 bg-muted/20">
              <h3 className="text-sm font-semibold">Escalate to a legal case</h3>
              <p className="text-[11px] text-muted-foreground">
                Opens a case for the {money(open)} still outstanding and marks the placement as
                Legal.
              </p>
              <div className="grid grid-cols-2 gap-3">
                {field(
                  "Law firm",
                  <Input
                    value={legal.firm}
                    onChange={(e) => setLegal({ ...legal, firm: e.target.value })}
                    className="h-9"
                  />,
                )}
                {field(
                  "Attorney",
                  <Input
                    value={legal.attorney}
                    onChange={(e) => setLegal({ ...legal, attorney: e.target.value })}
                    className="h-9"
                  />,
                )}
              </div>
              {field(
                "Court",
                <Input
                  value={legal.court}
                  onChange={(e) => setLegal({ ...legal, court: e.target.value })}
                  className="h-9"
                />,
              )}
              {field(
                "Success probability (%)",
                <Input
                  type="number"
                  value={legal.prob}
                  onChange={(e) => setLegal({ ...legal, prob: e.target.value })}
                  className="h-9"
                />,
              )}
              <Button
                size="sm"
                className="w-full"
                disabled={busy || open <= 0}
                onClick={() =>
                  run(
                    () =>
                      createLegalCase({
                        customerId: p.customerId,
                        placementId: p.id,
                        claimAmount: open,
                        stage: "Pre-Legal",
                        lawFirm: legal.firm || undefined,
                        attorney: legal.attorney || undefined,
                        court: legal.court || undefined,
                        successProbability: Number(legal.prob) || undefined,
                      }),
                    "Legal case opened.",
                  )
                }
              >
                {busy && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                Open case for {money(open)}
              </Button>
            </div>
          )}

          {/* --- Placement facts --- */}
          {p && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
              {[
                ["Placed on", dateText(p.placedOn)],
                ["Recall due", dateText(p.recallDue)],
                ["Last activity", dateText(p.lastActivity)],
                ["Closed on", dateText(p.closedOn)],
                ["Risk band", p.riskLevel ?? "—"],
                ["Customer type", p.customerType],
                ["Company", p.companyName ?? "—"],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between gap-2 border-b border-border/50 pb-1.5">
                  <span className="text-muted-foreground">{l}</span>
                  <span className="text-foreground font-medium text-right">{v}</span>
                </div>
              ))}
              <div className="col-span-2 flex items-center gap-2 pt-1">
                <span className="text-muted-foreground">Priority</span>
                {canEdit && isOpen ? (
                  <Select
                    value={p.priority}
                    onValueChange={(v) =>
                      run(() => patchPlacement(p.id, { priority: v }), "Priority updated.")
                    }
                  >
                    <SelectTrigger className="h-7 w-32 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((x) => (
                        <SelectItem key={x} value={x}>
                          {x}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Pill tone={PRIORITY_TONE[p.priority]}>{p.priority}</Pill>
                )}
                {p.closeReason && (
                  <span className="ml-auto text-muted-foreground italic">{p.closeReason}</span>
                )}
              </div>
            </div>
          )}

          {/* --- Recovery ledger --- */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Recovery history · {detail?.recoveries.length ?? 0}
            </h3>
            {detail?.recoveries.length ? (
              <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
                {detail.recoveries.map((r) => (
                  <div key={r.id} className="px-3 py-2.5 flex items-center gap-3 group">
                    <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                      <Banknote className="h-4 w-4 text-success" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-foreground tabular-nums">
                        {money(r.amount)}
                        <span className="text-[11px] font-normal text-muted-foreground">
                          {" "}
                          · {money(r.commission)} commission
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {dateText(r.recoveredOn)} · {r.method}
                        {r.reference ? ` · ${r.reference}` : ""}
                        {r.appliedToAccount && " · posted to the account"}
                      </div>
                    </div>
                    <Pill
                      tone={
                        r.remitted
                          ? "bg-success/10 text-success border-success/25"
                          : "bg-warning/10 text-warning border-warning/25"
                      }
                    >
                      {r.remitted ? "Remitted" : "Pending"}
                    </Pill>
                    {canEdit && (
                      <button
                        onClick={() =>
                          run(() => reverseRecovery(r.id), "Recovery reversed.")
                        }
                        className="opacity-0 group-hover:opacity-100 h-6 w-6 rounded hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive transition"
                        title="Reverse this entry"
                      >
                        <Undo2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Nothing recovered on this placement yet.</p>
            )}
          </div>

          {/* --- Audit trail --- */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Placement history
            </h3>
            <ol className="relative border-l border-border ml-2 space-y-3">
              {detail?.events.map((e) => (
                <li key={e.id} className="ml-4">
                  <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-primary/60 ring-4 ring-background" />
                  <div className="text-xs font-medium text-foreground">
                    {pretty(e.type)}
                    {e.toAgency && e.fromAgency && (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · {e.fromAgency} → {e.toAgency}
                      </span>
                    )}
                  </div>
                  {e.detail && <div className="text-[11px] text-muted-foreground">{e.detail}</div>}
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {dateTimeText(e.occurredAt)}
                    {e.actor ? ` · ${e.actor}` : ""}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </aside>
    </>
  );
};
