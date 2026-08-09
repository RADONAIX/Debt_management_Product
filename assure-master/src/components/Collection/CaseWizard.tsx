import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Check, Loader2, Paperclip, Search } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { money } from "@/lib/money";
import { ApiError } from "@/lib/api";
import {
  addAttachment, checkDuplicate, createCase, searchCustomers, DOCUMENT_TYPES,
  type CollectionConfig, type CustomerHit, type DuplicateCheck, type WorkspaceRow,
} from "@/lib/collection";
import { PRIORITY_TONE, Pill, RISK_TONE, dateTimeText, plusDaysISO, pretty } from "./shared";

/**
 * Manual case creation. Customer and account details are read from the
 * database — the agent chooses only what the system cannot know: the type,
 * reason, priority, who works it, when it is due, and any evidence.
 */
export const CaseWizard = ({
  open,
  customer,
  config,
  suggestedType,
  suggestedReason,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  customer: WorkspaceRow | null;
  config: CollectionConfig | null;
  /** Pre-filled when raised from the defaulter list, so the agent confirms
   *  rather than re-deriving what the system already worked out. */
  suggestedType?: string;
  suggestedReason?: string;
  onOpenChange: (v: boolean) => void;
  onCreated: (caseId: number) => void;
}) => {
  const [step, setStep] = useState(1);
  const [typeCode, setTypeCode] = useState("");
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState("");
  const [queueCode, setQueueCode] = useState("");
  const [agentId, setAgentId] = useState<string>("auto");
  const [dueDate, setDueDate] = useState(plusDaysISO(7));
  const [notes, setNotes] = useState("");
  const [fileName, setFileName] = useState("");
  const [docType, setDocType] = useState<string>("OTHER");
  const [dup, setDup] = useState<DuplicateCheck | null>(null);
  const [dupAction, setDupAction] = useState<string>("");
  const [saving, setSaving] = useState(false);
  // When opened without a customer, the first step is finding one.
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<CustomerHit | null>(null);

  const type = useMemo(
    () => config?.types.find((t) => t.code === typeCode) ?? null,
    [config, typeCode],
  );

  /** The customer the case is for: passed in, or chosen here. */
  const target = useMemo(() => {
    if (customer) return customer;
    if (!picked) return null;
    return {
      customerId: picked.customerId,
      customerName: picked.name,
      customerType: picked.customerType,
      accountId: picked.accountId ?? null,
      accountCode: picked.accountCode ?? null,
      outstanding: picked.outstanding,
      dpd: picked.dpd,
      riskLevel: picked.riskLevel,
      collectionStatus: picked.openCases ? "In Collection" : "No case",
    } as unknown as WorkspaceRow;
  }, [customer, picked]);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setTypeCode(suggestedType ?? "");
    setReason(suggestedReason ?? "");
    setPriority("");
    setQueueCode("");
    setAgentId("auto");
    setDueDate(plusDaysISO(7));
    setNotes("");
    setFileName("");
    setDup(null);
    setDupAction("");
    setQuery("");
    setHits([]);
    setPicked(null);
  }, [open, suggestedType, suggestedReason]);

  useEffect(() => {
    if (!open || customer || query.trim().length < 2) {
      setHits([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = setTimeout(() => {
      searchCustomers(query.trim())
        .then((r) => !cancelled && setHits(r))
        .catch(() => undefined)
        .finally(() => !cancelled && setSearching(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [open, customer, query]);

  // The type carries its own defaults; show them rather than making the agent guess.
  useEffect(() => {
    if (!type) return;
    setPriority(type.defaultPriority);
    setQueueCode(type.defaultQueue ?? "");
  }, [type]);

  // An account holds one live case, so before any work is done: is this
  // account already being worked, and by which case?
  useEffect(() => {
    if (!open || !target || !typeCode) {
      setDup(null);
      return;
    }
    let cancelled = false;
    checkDuplicate(target.customerId, typeCode, target.accountId)
      .then((d) => {
        if (cancelled) return;
        setDup(d);
        setDupAction(d.options[0] ?? "");
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, target, typeCode]);

  const submit = async () => {
    if (!target || !typeCode) return;
    setSaving(true);
    try {
      const res = await createCase({
        customerId: target.customerId,
        accountId: target.accountId,
        typeCode,
        sourceCode: "AGENT_MANUAL",
        reason: reason || undefined,
        priority: priority || undefined,
        queueCode: queueCode || undefined,
        // "pool" means deliberately unassigned, so it lands in Needs a case
        // instead of following the customer's existing owner.
        agentId: ["auto", "pool"].includes(agentId) ? undefined : Number(agentId),
        assignToPool: agentId === "pool",
        dueDate: dueDate || undefined,
        notes: notes || undefined,
        duplicateAction: dup?.hasDuplicate ? dupAction : undefined,
      });
      if (fileName.trim()) {
        await addAttachment(res.id, {
          fileName: fileName.trim(),
          storageUri: `s3://cases/${res.caseNumber}/${fileName.trim()}`,
          documentType: docType,
        });
      }
      toast.success(res.message);
      onCreated(res.id);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not create the case.");
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, node: React.ReactNode, hint?: string) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {node}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );

  const STEPS = ["Type & reason", "Assignment & SLA", "Review"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create a case</DialogTitle>
          <DialogDescription>
            {target
              ? `${target.customerName} · ${target.accountCode ?? target.customerId}`
              : "Search for the customer this case is about"}
          </DialogDescription>
        </DialogHeader>

        {/* Step rail */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2 flex-1">
              <div
                className={`h-6 w-6 rounded-full text-[11px] font-semibold flex items-center justify-center shrink-0 ${
                  step > i + 1
                    ? "bg-success text-success-foreground"
                    : step === i + 1
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {step > i + 1 ? <Check className="h-3 w-3" /> : i + 1}
              </div>
              <span
                className={`text-xs ${step === i + 1 ? "text-foreground font-medium" : "text-muted-foreground"}`}
              >
                {s}
              </span>
              {i < STEPS.length - 1 && <div className="h-px flex-1 bg-border" />}
            </div>
          ))}
        </div>

        {/* The account, straight from the database — never typed in */}
        {target && (
          <div className="rounded-xl border border-border bg-muted/20 p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-foreground">{target.customerName}</span>
              <Pill>{target.customerType}</Pill>
              <span className={`text-xs font-medium ${RISK_TONE[target.riskLevel] ?? ""}`}>
                {target.riskLevel} risk
              </span>
              <span className="ml-auto text-[11px] text-muted-foreground">
                populated from the customer record
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                ["Outstanding", money(target.outstanding)],
                ["DPD", String(target.dpd)],
                ["Account", target.accountCode ?? "—"],
                ["Stage", target.collectionStatus],
              ].map(([l, v]) => (
                <div key={l} className="rounded-lg bg-background py-1.5">
                  <div className="text-[10px] text-muted-foreground">{l}</div>
                  <div className="text-xs font-semibold text-foreground truncate px-1">{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 1 && !customer && !picked && (
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input className="h-9 pl-8 text-sm" autoFocus value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name, company, account, phone or email" />
            </div>
            <div className="rounded-xl border border-border divide-y divide-border max-h-[300px] overflow-y-auto">
              {searching && (
                <div className="p-6 text-center">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mx-auto" />
                </div>
              )}
              {!searching && hits.map((h) => (
                <button key={h.customerId} onClick={() => setPicked(h)}
                  className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">{h.name}</span>
                    {h.companyName && (
                      <span className="text-[10px] text-muted-foreground truncate">
                        {h.companyName}
                      </span>
                    )}
                    <span className="ml-auto text-sm font-semibold tabular-nums">
                      {money(h.outstanding)}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {h.accountCode} · {h.dpd} DPD · {h.riskLevel}
                    {h.ownerName ? ` · ${h.ownerName}` : " · unassigned"}
                    {h.openCases ? ` · ${h.openCases} open case${h.openCases === 1 ? "" : "s"}` : ""}
                  </div>
                </button>
              ))}
              {!searching && query.trim().length >= 2 && hits.length === 0 && (
                <p className="p-6 text-center text-xs text-muted-foreground">
                  Nobody matches that search.
                </p>
              )}
              {query.trim().length < 2 && (
                <p className="p-6 text-center text-xs text-muted-foreground">
                  Type at least two characters to find a customer.
                </p>
              )}
            </div>
          </div>
        )}

        {step === 1 && (customer || picked) && (
          <div className="space-y-3">
            {!customer && picked && (
              <button onClick={() => { setPicked(null); setTypeCode(""); }}
                className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
                ← Choose a different customer
              </button>
            )}
            {field(
              "Case type",
              <Select value={typeCode} onValueChange={setTypeCode}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="What kind of case is this?" />
                </SelectTrigger>
                <SelectContent>
                  {config?.types
                    .filter((t) => t.isActive)
                    .map((t) => (
                      <SelectItem key={t.code} value={t.code}>
                        {t.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>,
              type
                ? `${type.description ?? ""} SLA ${type.slaHours}h · routes to ${
                    type.defaultQueue ?? "rules"}.`.trim()
                : undefined,
            )}

            {/* The same issue is already on a card — surfaced before any work is done */}
            {dup?.hasDuplicate && (
              <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-foreground">{dup.message}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {dup.existingCaseNumber} · {pretty(dup.existingState)} · opened{" "}
                      {dateTimeText(dup.existingOpenedAt)}
                    </p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-muted-foreground">
                    A customer can hold several cases at once, but not two of the same type.
                  </Label>
                  <div className="grid grid-cols-2 gap-1.5">
                    {dup.options.map((o) => (
                      <button
                        key={o}
                        onClick={() => setDupAction(o)}
                        className={`rounded-lg border px-2 py-1.5 text-[11px] text-left transition ${
                          dupAction === o
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border hover:bg-muted"
                        }`}
                      >
                        {o === "OPEN_EXISTING"
                          ? "Open the case that is already there"
                          : "Raise it anyway as a separate case"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {field(
              "Description",
              <Textarea
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why is this case being raised? Every case needs one."
                className={reason.trim() ? "" : "border-warning/50"}
              />,
              reason.trim() ? undefined : "Required — whoever picks this up needs to know why.",
            )}
            {field(
              "Priority",
              <div className="flex gap-1.5">
                {config?.priorities.map((p) => (
                  <button
                    key={p.code}
                    onClick={() => setPriority(p.code)}
                    className={`flex-1 rounded-lg border px-2 py-1.5 text-[11px] transition ${
                      priority === p.code
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {p.name}
                    <span className="block text-[10px] opacity-70">{p.sla_hours}h</span>
                  </button>
                ))}
              </div>,
            )}
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {field(
                "Queue",
                <Select value={queueCode} onValueChange={setQueueCode}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Routed by rules" />
                  </SelectTrigger>
                  <SelectContent>
                    {config?.queues
                      .filter((q) => q.isActive)
                      .map((q) => (
                        <SelectItem key={q.code} value={q.code}>
                          {q.name} · {q.openCases} open
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>,
                "Leave as the default to let the assignment rules decide.",
              )}
              {field(
                "Assign to",
                <Select value={agentId} onValueChange={setAgentId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pool">
                      Leave unassigned — goes to Needs a case
                    </SelectItem>
                    <SelectItem value="auto">Auto — by queue rules</SelectItem>
                    {config?.agents.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.name} · {a.open_cases} cases
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>,
              )}
            </div>
            {field(
              "Due date",
              <Input
                type="date"
                className="h-9"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />,
            )}
            {field(
              "Notes",
              <Textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything the next person should know."
              />,
            )}
            <div className="grid grid-cols-2 gap-3">
              {field(
                "Attachment",
                <div className="flex items-center gap-1.5">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Input
                    className="h-9"
                    value={fileName}
                    onChange={(e) => setFileName(e.target.value)}
                    placeholder="evidence.pdf"
                  />
                </div>,
              )}
              {field(
                "Document type",
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((d) => (
                      <SelectItem key={d} value={d}>
                        {pretty(d)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>,
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-2 text-sm">
            {[
              ["Customer", customer?.customerName ?? "—"],
              ["Account", customer?.accountCode ?? "—"],
              ["Outstanding", customer ? money(target.outstanding) : "—"],
              ["Type", type?.name ?? "—"],
              ["Reason", reason || "—"],
              ["Priority", priority || "—"],
              ["Queue", config?.queues.find((q) => q.code === queueCode)?.name ?? "By rules"],
              [
                "Assign to",
                agentId === "auto"
                  ? "Auto — by queue rules"
                  : agentId === "pool"
                    ? "Unassigned — will appear in Needs a case"
                    : config?.agents.find((a) => String(a.id) === agentId)?.name ?? "—",
              ],
              ["Due", dueDate || "—"],
              ["Attachment", fileName || "none"],
              ...(dup?.hasDuplicate
                ? [["Existing case", dupAction === "OPEN_EXISTING"
                      ? `${dup.existingCaseNumber} opened instead`
                      : `raised alongside ${dup.existingCaseNumber}`]]
                : []),
            ].map(([l, v]) => (
              <div key={l} className="flex justify-between border-b border-border/50 pb-1.5">
                <span className="text-muted-foreground text-xs">{l}</span>
                <span className="text-foreground font-medium text-xs text-right">{v}</span>
              </div>
            ))}
            {priority && (
              <p className="text-[11px] text-muted-foreground pt-1">
                SLA: {config?.priorities.find((p) => p.code === priority)?.sla_hours}h to the next
                action, and every change from here is recorded on the case audit trail.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)}
              disabled={step === 1 && (!typeCode || !reason.trim())}>
              Continue <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Button>
          ) : (
            <Button onClick={submit} disabled={saving || !typeCode || !reason.trim()}>
              {saving && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
              {!dup?.hasDuplicate || dupAction === "CREATE_NEW"
                ? "Create case"
                : "Open the existing case"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
