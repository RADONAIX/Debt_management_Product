import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight, Banknote, Clock, FileWarning, GitMerge, HandCoins, Loader2, Paperclip,
  PhoneCall, Send, Shield, StickyNote, Tag, UserCog, X,
} from "lucide-react";
import { toast } from "sonner";
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
  DOCUMENT_TYPES, NOTE_TYPES, NOTE_VISIBILITY, addAttachment, addNote, assignCase,
  getCase, mergeCase, patchCase, transferCase, transitionCase,
  type CaseDetail, type CollectionConfig,
} from "@/lib/collection";
import { CaseTree } from "./CaseTree";
import { ActionPanel, type Action } from "@/components/AgentWorkspace/ActionPanel";
import {
  KIND_ICON, PRIORITY_TONE, Pill, RISK_TONE, STATE_TONE, dateText, dateTimeText,
  pretty, relative,
} from "./shared";

type Tab = "overview" | "timeline" | "history" | "related" | "notes" | "documents" | "audit";

/**
 * The whole case: its state, everything related to it from across the system,
 * and every action the workflow allows from where it currently sits.
 */
export const CaseDrawer = ({
  caseId, config, onClose, onChanged, onOpenCustomer, canAct = true,
}: {
  caseId: number | null;
  config: CollectionConfig | null;
  onClose: () => void;
  onChanged: () => void;
  onOpenCustomer?: (code: string) => void;
  /** False for a read-only role — hides the contact actions. */
  canAct?: boolean;
}) => {
  const [d, setD] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState<
    "none" | "transition" | "assign" | "retype" | "merge" | "note" | "doc">("none");
  // Contact-level work (call, reminder, promise, payment, dispute) lives in the
  // same drawer as the workflow moves, so an agent never changes screen mid-call.
  const [contact, setContact] = useState<Action | null>(null);
  const [toState, setToState] = useState("");
  const [note, setNote] = useState("");
  const [resolution, setResolution] = useState("");
  const [agentId, setAgentId] = useState("");
  const [queueCode, setQueueCode] = useState("");
  const [mergeTarget, setMergeTarget] = useState("");
  const [newType, setNewType] = useState("");
  const [noteType, setNoteType] = useState<string>("GENERAL");
  const [noteVis, setNoteVis] = useState<string>("INTERNAL");
  const [fileName, setFileName] = useState("");
  const [docType, setDocType] = useState<string>("OTHER");

  const load = useCallback(async () => {
    if (!caseId) return;
    setLoading(true);
    try {
      setD(await getCase(caseId));
    } catch {
      toast.error("Could not load that case.");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => {
    setTab("overview");
    setPanel("none");
    setContact(null);
    setNote("");
    if (caseId) void load();
    else setD(null);
  }, [caseId, load]);

  if (!caseId) return null;
  const c = d?.case;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      setPanel("none");
      setNote("");
      await load();
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That did not go through.");
    } finally {
      setBusy(false);
    }
  };

  const TABS: [Tab, string, number][] = [
    ["overview", "Overview", 0],
    ["timeline", "Timeline", d?.timeline.length ?? 0],
    ["history", "Customer history", d?.customerHistory.length ?? 0],
    ["related", "Case tree", (d?.ptps.length ?? 0) + (d?.disputes.length ?? 0) +
      (d?.payments.length ?? 0) + (d?.legal.length ?? 0) + (d?.placements.length ?? 0)],
    ["notes", "Notes", d?.notes.length ?? 0],
    ["documents", "Documents", d?.attachments.length ?? 0],
    ["audit", "Audit", d?.audit.length ?? 0],
  ];

  const row = (l: string, v: React.ReactNode) => (
    <div className="flex justify-between gap-2 border-b border-border/50 pb-1.5">
      <span className="text-muted-foreground">{l}</span>
      <span className="text-foreground font-medium text-right">{v}</span>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 bottom-0 w-full sm:w-[600px] bg-background border-l border-border z-50 flex flex-col shadow-2xl">
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-mono text-muted-foreground">{c?.caseNumber}</span>
                {c && <Pill tone={STATE_TONE[c.workflowState]}>{pretty(c.workflowState)}</Pill>}
                {c && <Pill tone={PRIORITY_TONE[c.priority]}>{c.priority}</Pill>}
                {c?.slaBreached && (
                  <Pill tone="bg-destructive/10 text-destructive border-destructive/25">
                    SLA breached
                  </Pill>
                )}
                {c?.slaPaused && <Pill>SLA paused</Pill>}
                {c?.mergedIntoNumber && <Pill>Merged → {c.mergedIntoNumber}</Pill>}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <h2 className="text-lg font-semibold text-foreground truncate">
                  {c?.customerName}
                </h2>
                {onOpenCustomer && c && (
                  <button
                    onClick={() => onOpenCustomer(c.customerId)}
                    title="Open in Subscriber 360"
                    className="shrink-0 inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-primary hover:border-primary/40 transition"
                  >
                    360 <ArrowUpRight className="h-3 w-3" />
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {c?.typeName ?? c?.type} · {c?.queueName ?? "no queue"} · via {c?.sourceName ?? c?.source}
                {c?.parentCaseNumber ? ` · child of ${c.parentCaseNumber}` : ""}
              </p>
            </div>
            <button onClick={onClose}
              className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          {c && (
            <div className="grid grid-cols-4 gap-2 mt-3 text-center">
              {[
                ["Outstanding", money(c.outstanding)],
                ["DPD", String(c.dpd)],
                ["Risk", c.riskLevel],
                ["Next action", c.slaPaused ? "paused" : relative(c.slaDeadline)],
              ].map(([l, v]) => (
                <div key={l} className="rounded-lg bg-muted/50 py-2">
                  <div className="text-[10px] text-muted-foreground">{l}</div>
                  <div className={`text-sm font-semibold tabular-nums ${
                    l === "Risk" ? RISK_TONE[c.riskLevel] ?? "" : "text-foreground"}`}>
                    {v}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* What an agent does on the phone */}
        {d && canAct && (
          <div className="px-5 pt-2.5 flex flex-wrap gap-1.5">
            {([
              ["log", "Log contact", PhoneCall],
              ["remind", "Remind", Send],
              ["ptp", "Promise", HandCoins],
              ["payment", "Payment", Banknote],
              ["dispute", "Dispute", FileWarning],
            ] as const).map(([key, label, Icon]) => (
              <button key={key}
                onClick={() => { setContact(contact === key ? null : key); setPanel("none"); }}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium border transition ${
                  contact === key ? "bg-primary text-primary-foreground border-primary"
                                  : "border-border text-foreground hover:bg-muted"}`}>
                <Icon className="h-3.5 w-3.5" />{label}
              </button>
            ))}
          </div>
        )}

        {/* Where the case can go next, from the configured workflow */}
        {d && (
          <div className="px-5 py-2.5 border-b border-border flex flex-wrap gap-1.5">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground self-center mr-1">
              Move to
            </span>
            {d.transitions.map((t) => (
              <button
                key={t.toState}
                disabled={!t.allowed}
                title={t.allowed ? undefined : `Requires ${t.requiredPermission}`}
                onClick={() => {
                  setToState(t.toState);
                  setPanel("transition");
                }}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium border border-border text-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                {t.label}
                {t.requiresNote && <span className="text-muted-foreground"> *</span>}
              </button>
            ))}
            <div className="ml-auto flex gap-1.5">
              <button
                onClick={() => {
                  setNewType(c?.type ?? "");
                  setPanel(panel === "retype" ? "none" : "retype");
                }}
                className="rounded-lg px-2 py-1.5 border border-border hover:bg-muted"
                title="Change the case type">
                <Tag className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setPanel(panel === "assign" ? "none" : "assign")}
                className="rounded-lg px-2 py-1.5 border border-border hover:bg-muted" title="Assign or transfer">
                <UserCog className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setPanel(panel === "note" ? "none" : "note")}
                className="rounded-lg px-2 py-1.5 border border-border hover:bg-muted" title="Add a note">
                <StickyNote className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setPanel(panel === "doc" ? "none" : "doc")}
                className="rounded-lg px-2 py-1.5 border border-border hover:bg-muted" title="Attach a document">
                <Paperclip className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setPanel(panel === "merge" ? "none" : "merge")}
                className="rounded-lg px-2 py-1.5 border border-border hover:bg-muted" title="Merge into another case">
                <GitMerge className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />}

          {/* --- contact actions, borrowed from the agent desk --- */}
          {contact && d && (
            <ActionPanel
              action={contact}
              customer={{
                customerId: d.customer.customerId,
                customerName: d.customer.customerName,
                customerType: d.customer.customerType,
                accountId: d.customer.accountId ?? null,
                accountCode: d.customer.accountCode ?? null,
                outstanding: d.customer.outstanding,
                dpd: d.customer.dpd,
                agingBucket: d.customer.agingBucket ?? null,
                riskLevel: d.customer.riskLevel,
                riskScore: d.customer.riskScore,
                contactability: d.customer.contactability,
                bestChannel: null,
                bestContactTime: null,
                phone: d.customer.phone ?? null,
                email: d.customer.email ?? null,
                strategy: d.customer.strategy ?? null,
                openCases: d.customer.openCases,
                openCaseCode: d.customer.openCaseCode ?? null,
                pendingPtp: d.customer.activePtp,
                ptpDueOn: d.customer.ptpDueOn ?? null,
                lastContact: d.customer.lastContactAt ?? null,
                lastPayment: d.customer.lastPaymentOn ?? null,
                nextAction: d.customer.nextAction,
                priority: d.customer.priority,
                priorityScore: d.customer.priorityScore,
              }}
              caseId={caseId}
              onDone={() => { setContact(null); void load(); onChanged(); }}
              onCancel={() => setContact(null)}
            />
          )}

          {/* --- action panels --- */}
          {panel === "transition" && d && (
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
              <h3 className="text-sm font-semibold">
                {d.transitions.find((t) => t.toState === toState)?.label ?? "Change state"}
              </h3>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                placeholder={
                  d.transitions.find((t) => t.toState === toState)?.requiresNote
                    ? "A note is required for this move"
                    : "Optional note"} />
              {["RESOLVED", "CLOSED"].includes(toState) && (
                <Input className="h-9" value={resolution} onChange={(e) => setResolution(e.target.value)}
                  placeholder="Resolution, e.g. Paid in full" />
              )}
              <Button size="sm" className="w-full" disabled={busy}
                onClick={() => run(() => transitionCase(caseId, {
                  toState, note: note || undefined, resolution: resolution || undefined,
                }), "Case updated.")}>
                {busy && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                Confirm
              </Button>
            </div>
          )}

          {panel === "retype" && c && (
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
              <h3 className="text-sm font-semibold">Change the case type</h3>
              <p className="text-xs text-muted-foreground">
                A case is one issue, and its type says which. When that issue
                moves on — a broken promise that goes to legal — change the type
                here rather than raising a second card for the same thing. It
                re-routes the queue and restarts the SLA clock.
              </p>
              <Select value={newType} onValueChange={setNewType}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Case type" /></SelectTrigger>
                <SelectContent>
                  {config?.types.map((ct) => (
                    <SelectItem key={ct.code} value={ct.code}>
                      {ct.name}{ct.code === c.type ? " · current" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Why is it changing? e.g. Promise broken twice, referring to legal" />
              <Button size="sm" className="w-full"
                disabled={busy || !newType || newType === c.type || !note.trim()}
                onClick={() => run(() => patchCase(caseId, {
                  typeCode: newType, reason: note.trim(),
                }), `Case is now ${newType}.`)}>
                {busy && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
                {newType && newType !== c.type ? `${c.type} → ${newType}` : "Pick a new type"}
              </Button>
            </div>
          )}

          {panel === "assign" && (
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
              <h3 className="text-sm font-semibold">Assign or transfer</h3>
              <div className="grid grid-cols-2 gap-3">
                <Select value={agentId} onValueChange={setAgentId}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Agent" /></SelectTrigger>
                  <SelectContent>
                    {config?.agents.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.name} · {a.open_cases}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={queueCode} onValueChange={setQueueCode}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Queue" /></SelectTrigger>
                  <SelectContent>
                    {config?.queues.map((q) => (
                      <SelectItem key={q.code} value={q.code}>{q.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input className="h-9" value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Reason" />
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" disabled={busy || !agentId}
                  onClick={() => run(() => assignCase(caseId, {
                    agentId: Number(agentId), queueCode: queueCode || undefined,
                    reason: note || undefined }), "Case assigned.")}>
                  Assign
                </Button>
                <Button size="sm" variant="outline" className="flex-1" disabled={busy || !agentId}
                  onClick={() => run(() => transferCase(caseId, {
                    agentId: Number(agentId), queueCode: queueCode || undefined,
                    reason: note || undefined }), "Case transferred.")}>
                  Transfer
                </Button>
              </div>
            </div>
          )}

          {panel === "merge" && (
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
              <h3 className="text-sm font-semibold">Merge this case into another</h3>
              <p className="text-[11px] text-muted-foreground">
                This case closes; its notes and documents move to the target. Only cases for
                the same customer can be merged.
              </p>
              <Input className="h-9" value={mergeTarget} onChange={(e) => setMergeTarget(e.target.value)}
                placeholder="Target case id" />
              <Input className="h-9" value={note} onChange={(e) => setNote(e.target.value)}
                placeholder="Reason" />
              <Button size="sm" variant="destructive" className="w-full"
                disabled={busy || !mergeTarget}
                onClick={() => run(() => mergeCase(caseId, Number(mergeTarget), note || undefined),
                                   "Cases merged.")}>
                Merge
              </Button>
            </div>
          )}

          {panel === "note" && (
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
              <h3 className="text-sm font-semibold">Add a note</h3>
              <div className="grid grid-cols-2 gap-3">
                <Select value={noteType} onValueChange={setNoteType}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NOTE_TYPES.map((t) => <SelectItem key={t} value={t}>{pretty(t)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={noteVis} onValueChange={setNoteVis}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NOTE_VISIBILITY.map((v) => <SelectItem key={v} value={v}>{pretty(v)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
              <Button size="sm" className="w-full" disabled={busy || !note.trim()}
                onClick={() => run(() => addNote(caseId, {
                  body: note, noteType, visibility: noteVis }), "Note added.")}>
                Save note
              </Button>
            </div>
          )}

          {panel === "doc" && (
            <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
              <h3 className="text-sm font-semibold">Attach a document</h3>
              <Input className="h-9" value={fileName} onChange={(e) => setFileName(e.target.value)}
                placeholder="settlement-letter.pdf" />
              <Select value={docType} onValueChange={setDocType}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{pretty(t)}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button size="sm" className="w-full" disabled={busy || !fileName.trim()}
                onClick={() => run(() => addAttachment(caseId, {
                  fileName, storageUri: `s3://cases/${c?.caseNumber}/${fileName}`,
                  documentType: docType }), "Document attached.")}>
                Attach
              </Button>
            </div>
          )}

          {/* --- tabs --- */}
          <div className="flex gap-1 border-b border-border overflow-x-auto">
            {TABS.map(([key, label, n]) => (
              <button key={key} onClick={() => setTab(key)}
                className={`px-3 py-1.5 text-xs font-medium border-b-2 -mb-px whitespace-nowrap transition ${
                  tab === key ? "border-primary text-primary"
                              : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                {label}{n > 0 && <span className="text-[10px]"> ({n})</span>}
              </button>
            ))}
          </div>

          {tab === "overview" && c && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {row("Case number", c.caseNumber)}
              {row("Status", pretty(c.workflowState))}
              {row("Source", c.sourceName ?? c.source)}
              {row("Type", c.typeName ?? c.type)}
              {row("Priority", c.priority)}
              {row("Queue", c.queueName ?? "—")}
              {row("Assigned to", c.agentName ?? "Unassigned")}
              {row("Created by", c.createdByName ?? "System")}
              {row("Opened", dateTimeText(c.openedAt))}
              {row("Due date", dateText(c.dueDate))}
              {row("SLA deadline", c.slaPaused ? "paused" : dateTimeText(c.slaDeadline))}
              {row("First response", dateTimeText(c.firstResponseAt))}
              {row("Last worked", dateTimeText(c.lastActivityAt))}
              {row("Case value", money(c.amount))}
              {row("Strategy", c.strategy ?? "—")}
              {row("Reopened", String(c.reopenCount))}
              {c.childCount > 0 && row("Child cases", String(c.childCount))}
              {c.closedAt && row("Closed", dateTimeText(c.closedAt))}
              {c.resolution && row("Resolution", c.resolution)}
              {c.triggerDetail && (
                <p className="col-span-2 text-muted-foreground italic pt-1">{c.triggerDetail}</p>
              )}
              {d?.assignments.length ? (
                <div className="col-span-2 pt-2">
                  <h4 className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">
                    Assignment history
                  </h4>
                  {d.assignments.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 py-1 border-b border-border/40">
                      <Pill>{pretty(a.assignmentType)}</Pill>
                      <span className="text-foreground">{a.agentName ?? "Queue"}</span>
                      <span className="text-muted-foreground truncate">{a.reason}</span>
                      <span className="ml-auto text-muted-foreground shrink-0">
                        {dateTimeText(a.assignedAt)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {tab === "timeline" && d?.timeline.length === 0 && (
            <div className="rounded-xl border border-dashed border-border py-10 text-center">
              <Clock className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-foreground font-medium">Nothing has happened yet.</p>
              <p className="text-xs text-muted-foreground">
                This case is assigned but nobody has worked it. The customer's own
                history is under <span className="text-foreground">Customer history</span>.
              </p>
            </div>
          )}

          {tab === "timeline" && (
            <ol className="relative border-l border-border ml-2 space-y-3">
              {d?.timeline.map((t, i) => (
                <li key={`${t.at}-${i}`} className="ml-4">
                  <span className="absolute -left-[9px] mt-0.5 h-[18px] w-[18px] rounded-full bg-muted border border-border flex items-center justify-center text-[9px]">
                    {KIND_ICON[t.kind] ?? "•"}
                  </span>
                  <div className="text-xs font-medium text-foreground">
                    {t.title}
                    {t.amount ? <span className="text-muted-foreground"> · {money(t.amount)}</span> : null}
                  </div>
                  {t.detail && <div className="text-[11px] text-muted-foreground">{t.detail}</div>}
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="h-2.5 w-2.5" />{dateTimeText(t.at)}
                    {t.actor ? ` · ${t.actor}` : ""}
                  </div>
                </li>
              ))}
            </ol>
          )}

          {tab === "history" && (
            <>
              <p className="text-[11px] text-muted-foreground -mt-1">
                Everything on this customer — invoices, payments, promises, cases and
                placements — whether or not it relates to this case.
              </p>
              <ol className="relative border-l border-border ml-2 space-y-3">
                {d?.customerHistory.map((t, i) => (
                  <li key={`${t.at}-${i}`} className="ml-4">
                    <span className="absolute -left-[9px] mt-0.5 h-[18px] w-[18px] rounded-full bg-muted border border-border flex items-center justify-center text-[9px]">
                      {KIND_ICON[t.kind] ?? "•"}
                    </span>
                    <div className="text-xs font-medium text-foreground">
                      {t.title}
                      {t.amount ? (
                        <span className="text-muted-foreground"> · {money(t.amount)}</span>
                      ) : null}
                    </div>
                    {t.detail && (
                      <div className="text-[11px] text-muted-foreground">{t.detail}</div>
                    )}
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="h-2.5 w-2.5" />
                      {dateTimeText(t.at)}
                      {t.actor ? ` · ${t.actor}` : ""}
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}

          {tab === "related" && d && <CaseTree d={d} />}

          {tab === "notes" && (
            <div className="space-y-2">
              {d?.notes.map((n) => (
                <div key={n.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Pill>{pretty(n.noteType)}</Pill>
                    {n.visibility !== "INTERNAL" && (
                      <Pill tone="bg-warning/10 text-warning border-warning/25">
                        {pretty(n.visibility)}
                      </Pill>
                    )}
                    {n.isPinned && <Pill tone="bg-primary/10 text-primary border-primary/25">Pinned</Pill>}
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {n.author} · {dateTimeText(n.createdAt)}
                    </span>
                  </div>
                  <p className="text-xs text-foreground whitespace-pre-wrap">{n.body}</p>
                </div>
              ))}
              {!d?.notes.length && <p className="text-xs text-muted-foreground">No notes yet.</p>}
            </div>
          )}

          {tab === "documents" && (
            <div className="rounded-xl border border-border divide-y divide-border overflow-hidden">
              {d?.attachments.map((a) => (
                <div key={a.id} className="px-3 py-2 flex items-center gap-3">
                  <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-foreground truncate">{a.fileName}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {pretty(a.documentType)} · {a.uploadedBy} · {dateTimeText(a.uploadedAt)}
                    </div>
                  </div>
                </div>
              ))}
              {!d?.attachments.length && (
                <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No documents attached.
                </p>
              )}
            </div>
          )}

          {tab === "audit" && (
            <div className="space-y-1.5">
              {d?.audit.map((a) => (
                <div key={a.id} className="flex items-start gap-2 text-[11px] border-b border-border/40 pb-1.5">
                  <Shield className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-foreground font-medium">
                      {pretty(a.action)}
                      {a.fieldName && (
                        <span className="font-normal text-muted-foreground">
                          {" "}· {a.fieldName}: {a.oldValue ?? "—"} → {a.newValue ?? "—"}
                        </span>
                      )}
                    </div>
                    {a.reason && <div className="text-muted-foreground">{a.reason}</div>}
                    <div className="text-[10px] text-muted-foreground">
                      {a.actor ?? "System"}{a.actorRole ? ` (${a.actorRole})` : ""} ·{" "}
                      {dateTimeText(a.occurredAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
