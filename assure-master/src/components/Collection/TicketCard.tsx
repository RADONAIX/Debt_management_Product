import {
  AlertTriangle, Eye, FileWarning, Gavel, HandCoins, MessageSquare, Paperclip,
  Scale, TrendingUp,
} from "lucide-react";
import { money } from "@/lib/money";
import type { TicketCard as Ticket } from "@/lib/collection";
import { PRIORITY_TONE, Pill, RISK_TONE, dateText, pretty, relative } from "./shared";

/** The severity strip down the left edge — the first thing the eye lands on. */
const SEVERITY: Record<string, string> = {
  Critical: "bg-destructive",
  High: "bg-warning",
  Medium: "bg-info",
  Low: "bg-muted-foreground/40",
};

const SLA_TONE: Record<string, string> = {
  RED: "text-destructive font-medium",
  AMBER: "text-warning font-medium",
  GREEN: "text-success",
  PAUSED: "text-muted-foreground",
  DONE: "text-muted-foreground",
};

const SLA_DOT: Record<string, string> = {
  RED: "bg-destructive",
  AMBER: "bg-warning",
  GREEN: "bg-success",
  PAUSED: "bg-muted-foreground",
  DONE: "bg-muted-foreground",
};

export const TicketCardView = ({
  t, onOpen, selected, onToggleSelect, draggable = false, onDragStart, compact = false,
}: {
  t: Ticket;
  onOpen: (id: number) => void;
  selected?: boolean;
  onToggleSelect?: (id: number) => void;
  draggable?: boolean;
  onDragStart?: (id: number) => void;
  compact?: boolean;
}) => {
  const slaText =
    t.slaColour === "DONE" ? "closed"
    : t.slaColour === "PAUSED" ? "SLA paused"
    : t.hoursToSla == null ? "no SLA"
    : t.hoursToSla < 0 ? `${Math.abs(Math.round(t.hoursToSla))}h over`
    : t.hoursToSla < 24 ? `${Math.round(t.hoursToSla)}h left`
    : `${Math.round(t.hoursToSla / 24)}d left`;

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", String(t.id));
        onDragStart?.(t.id);
      }}
      onClick={() => onOpen(t.id)}
      className={`group relative rounded-xl border bg-card overflow-hidden cursor-pointer transition hover:shadow-md hover:border-primary/40 ${
        selected ? "border-primary ring-1 ring-primary/30" : "border-border"
      } ${draggable ? "active:cursor-grabbing" : ""}`}
    >
      {/* Severity strip */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${SEVERITY[t.priority] ?? "bg-border"}`} />

      <div className="pl-3 pr-2.5 py-2.5">
        {/* Header: case number, SLA, selection */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-mono text-muted-foreground">{t.caseNumber}</span>
          <span className={`h-1.5 w-1.5 rounded-full ${SLA_DOT[t.slaColour] ?? "bg-muted"}`} />
          <span className={`text-[10px] ${SLA_TONE[t.slaColour] ?? ""}`}>{slaText}</span>
          {t.isWatched && <Eye className="h-3 w-3 text-primary" />}
          {onToggleSelect && (
            <input
              type="checkbox"
              checked={!!selected}
              onClick={(e) => e.stopPropagation()}
              onChange={() => onToggleSelect(t.id)}
              className="ml-auto h-3.5 w-3.5 rounded border-border accent-primary"
              aria-label={`Select ${t.caseNumber}`}
            />
          )}
        </div>

        {/* Customer and money */}
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-sm font-medium text-foreground truncate">{t.customerName}</span>
          {t.companyName && t.companyName !== t.customerName && (
            <span className="text-[10px] text-muted-foreground truncate shrink-0 max-w-[45%]">
              {t.companyName}
            </span>
          )}
          <span className="ml-auto text-sm font-semibold tabular-nums shrink-0">
            {money(t.outstanding)}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground truncate">
          {t.accountCode} · {t.dpd} DPD ·{" "}
          <span className={RISK_TONE[t.riskLevel] ?? ""}>{t.riskLevel}</span>
          {t.typeName ? ` · ${t.typeName}` : ""}
        </div>

        {!compact && (
          <>
            {/* Indicators */}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <Pill tone={PRIORITY_TONE[t.priority]}>{t.priority}</Pill>
              {t.hasPtp && (
                <span title="Open promise">
                  <HandCoins className="h-3.5 w-3.5 text-sky-600" />
                </span>
              )}
              {t.ptpBroken && (
                <span title="Broken promise">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                </span>
              )}
              {t.hasDispute && (
                <span title="In dispute">
                  <FileWarning className="h-3.5 w-3.5 text-orange-600" />
                </span>
              )}
              {t.isEscalated && (
                <span title="Escalated">
                  <TrendingUp className="h-3.5 w-3.5 text-warning" />
                </span>
              )}
              {t.inLegal && (
                <span title="Legal">
                  <Scale className="h-3.5 w-3.5 text-destructive" />
                </span>
              )}
              {t.inAgency && (
                <span title="With an agency">
                  <Gavel className="h-3.5 w-3.5 text-purple-600" />
                </span>
              )}
            </div>

            {/* Tags */}
            {t.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {t.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded px-1.5 py-0.5 text-[9px] bg-muted text-muted-foreground"
                  >
                    {pretty(tag)}
                  </span>
                ))}
                {t.tags.length > 3 && (
                  <span className="text-[9px] text-muted-foreground">+{t.tags.length - 3}</span>
                )}
              </div>
            )}

            {/* Footer: owner, counts, next follow-up */}
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border/60 text-[10px] text-muted-foreground">
              <span className="truncate max-w-[110px]">
                {t.agentName ?? <span className="text-warning">Unassigned</span>}
              </span>
              {t.nextFollowUp && (
                <span title="Next follow-up">· {dateText(t.nextFollowUp)}</span>
              )}
              <span className="ml-auto flex items-center gap-1.5 shrink-0">
                {t.activityCount > 0 && (
                  <span className="flex items-center gap-0.5" title="Activities">
                    <MessageSquare className="h-3 w-3" />
                    {t.activityCount}
                  </span>
                )}
                {t.noteCount > 0 && (
                  <span className="flex items-center gap-0.5" title="Notes">
                    ✎{t.noteCount}
                  </span>
                )}
                {t.attachmentCount > 0 && (
                  <span className="flex items-center gap-0.5" title="Attachments">
                    <Paperclip className="h-3 w-3" />
                    {t.attachmentCount}
                  </span>
                )}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export { SLA_TONE, SLA_DOT, SEVERITY };
