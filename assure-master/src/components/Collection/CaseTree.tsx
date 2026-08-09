import { useState } from "react";
import {
  Banknote, Briefcase, ChevronDown, ChevronRight, FileWarning, Gavel, HandCoins,
  MessageSquare, Paperclip, Scale, StickyNote,
} from "lucide-react";
import { money } from "@/lib/money";
import type { CaseDetail } from "@/lib/collection";
import { PRIORITY_TONE, Pill, STATE_TONE, dateText, dateTimeText, pretty } from "./shared";

type Branch = {
  key: string;
  label: string;
  icon: typeof HandCoins;
  tone: string;
  children: {
    id: string | number;
    title: string;
    subtitle: string;
    status?: string;
    statusTone?: string;
    amount?: number;
    detail?: string;
  }[];
};

/**
 * The case and everything hanging off it, as one tree.
 *
 * A collections case is not a flat record — it accumulates promises, disputes,
 * payments, an agency placement and possibly a legal matter, and what an agent
 * needs is to see those *under* the case rather than as separate lists.
 */
export const CaseTree = ({ d }: { d: CaseDetail }) => {
  const c = d.case;
  const [open, setOpen] = useState<Record<string, boolean>>({
    ptp: true, dispute: true, payment: true,
  });

  const toggle = (k: string) => setOpen((o) => ({ ...o, [k]: !o[k] }));

  const branches: Branch[] = [
    {
      key: "ptp", label: "Promises to pay", icon: HandCoins,
      tone: "text-info",
      children: d.ptps.map((p) => ({
        id: p.id,
        title: money(p.promisedAmount),
        subtitle: `${p.code} · due ${dateText(p.promisedDate)}${
          p.instalments > 1 ? ` · ${p.instalments} instalments` : ""}`,
        status: p.status,
        statusTone: p.status === "KEPT" ? "bg-success/10 text-success border-success/25"
                  : p.status === "BROKEN" ? "bg-destructive/10 text-destructive border-destructive/25"
                  : "bg-info/10 text-info border-info/25",
        detail: p.keptAmount > 0 ? `${money(p.keptAmount)} received` : undefined,
      })),
    },
    {
      key: "dispute", label: "Disputes", icon: FileWarning,
      tone: "text-orange-600 dark:text-orange-400",
      children: d.disputes.map((x) => ({
        id: x.id,
        title: pretty(x.reason),
        subtitle: `${x.code} · filed ${dateText(x.filedAt)}`,
        status: x.status,
        statusTone: ["RESOLVED", "APPROVED"].includes(x.status)
          ? "bg-success/10 text-success border-success/25"
          : x.status === "REJECTED" ? "bg-muted text-muted-foreground border-border"
          : "bg-orange-500/10 text-orange-600 border-orange-500/25",
        amount: x.amount,
      })),
    },
    {
      key: "payment", label: "Payments", icon: Banknote,
      tone: "text-success",
      children: d.payments.map((p) => ({
        id: p.reference,
        title: money(p.amount),
        subtitle: `${p.reference} · ${p.method}`,
        status: p.status,
        statusTone: "bg-success/10 text-success border-success/25",
        detail: dateText(p.date),
      })),
    },
    {
      key: "agency", label: "Agency placements", icon: Gavel,
      tone: "text-purple-600 dark:text-purple-400",
      children: d.placements.map((p) => ({
        id: p.id,
        title: p.agencyName,
        subtitle: `${p.code} · placed ${money(p.placedAmount)}`,
        status: p.status,
        statusTone: "bg-purple-500/10 text-purple-600 border-purple-500/25",
        detail: p.recoveredAmount > 0 ? `${money(p.recoveredAmount)} recovered` : "nothing recovered",
      })),
    },
    {
      key: "legal", label: "Legal matters", icon: Scale,
      tone: "text-destructive",
      children: d.legal.map((l) => ({
        id: l.id,
        title: l.stage,
        subtitle: `${l.code} · claim ${money(l.claimAmount)}`,
        status: l.status,
        statusTone: "bg-destructive/10 text-destructive border-destructive/25",
        detail: l.nextHearing ? `hearing ${dateText(l.nextHearing)}` : undefined,
      })),
    },
    {
      key: "comms", label: "Communications", icon: MessageSquare,
      tone: "text-muted-foreground",
      children: d.communications.slice(0, 15).map((x) => ({
        id: x.id,
        title: `${x.type}${x.channel ? ` · ${x.channel}` : ""}`,
        subtitle: x.subject,
        status: x.direction,
        detail: dateTimeText(x.occurredAt),
      })),
    },
    {
      key: "notes", label: "Notes", icon: StickyNote,
      tone: "text-muted-foreground",
      children: d.notes.map((n) => ({
        id: n.id,
        title: pretty(n.noteType),
        subtitle: n.body,
        status: n.isPinned ? "PINNED" : undefined,
        detail: `${n.author ?? "—"} · ${dateTimeText(n.createdAt)}`,
      })),
    },
    {
      key: "docs", label: "Documents", icon: Paperclip,
      tone: "text-muted-foreground",
      children: d.attachments.map((a) => ({
        id: a.id,
        title: a.fileName,
        subtitle: pretty(a.documentType),
        detail: `${a.uploadedBy ?? "—"} · ${dateTimeText(a.uploadedAt)}`,
      })),
    },
    {
      key: "children", label: "Child cases", icon: Briefcase,
      tone: "text-primary",
      children: d.children.map((ch) => ({
        id: ch.id,
        title: ch.caseNumber,
        subtitle: `${ch.typeName ?? ch.type} · ${ch.agentName ?? "unassigned"}`,
        status: ch.workflowState,
        statusTone: STATE_TONE[ch.workflowState],
        amount: ch.amount,
      })),
    },
  ].filter((b) => b.children.length > 0);

  return (
    <div className="space-y-2">
      {/* Root — the case itself */}
      <div className="rounded-xl border border-primary/30 bg-primary/5 px-3 py-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <Briefcase className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm font-semibold text-foreground">{c.caseNumber}</span>
          <Pill tone={STATE_TONE[c.workflowState]}>{pretty(c.workflowState)}</Pill>
          <Pill tone={PRIORITY_TONE[c.priority]}>{c.priority}</Pill>
          <span className="ml-auto text-sm font-semibold tabular-nums">{money(c.amount)}</span>
        </div>
        <div className="text-[11px] text-muted-foreground mt-0.5 ml-6">
          {c.typeName ?? c.type} · {c.customerName} · {c.accountCode ?? c.customerId}
          {c.parentCaseNumber ? ` · child of ${c.parentCaseNumber}` : ""}
        </div>
      </div>

      {/* Branches */}
      <div className="relative pl-4">
        {/* The trunk the branches hang from */}
        <div className="absolute left-[7px] top-0 bottom-4 w-px bg-border" />
        {branches.map((b) => {
          const isOpen = open[b.key];
          const total = b.children.reduce((s, ch) => s + (ch.amount ?? 0), 0);
          return (
            <div key={b.key} className="relative">
              {/* Elbow into this branch */}
              <div className="absolute left-[-9px] top-[18px] w-3 h-px bg-border" />
              <button
                onClick={() => toggle(b.key)}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-muted/50 transition text-left"
              >
                {isOpen ? (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                )}
                <b.icon className={`h-3.5 w-3.5 shrink-0 ${b.tone}`} />
                <span className="text-xs font-medium text-foreground">{b.label}</span>
                <Pill>{b.children.length}</Pill>
                {total > 0 && (
                  <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
                    {money(total)}
                  </span>
                )}
              </button>

              {isOpen && (
                <div className="relative pl-6 pb-1">
                  <div className="absolute left-[10px] top-0 bottom-3 w-px bg-border" />
                  {b.children.map((ch) => (
                    <div key={ch.id} className="relative">
                      <div className="absolute left-[-12px] top-[15px] w-3 h-px bg-border" />
                      <div className="px-2.5 py-1.5 rounded-lg hover:bg-muted/40 transition">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-foreground truncate">
                            {ch.title}
                          </span>
                          {ch.amount !== undefined && ch.amount > 0 && (
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {money(ch.amount)}
                            </span>
                          )}
                          {ch.status && (
                            <Pill tone={ch.statusTone} className="ml-auto">
                              {pretty(ch.status)}
                            </Pill>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {ch.subtitle}
                          {ch.detail ? ` · ${ch.detail}` : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {branches.length === 0 && (
          <p className="px-2 py-4 text-xs text-muted-foreground">
            Nothing attached to this case yet.
          </p>
        )}
      </div>
    </div>
  );
};
