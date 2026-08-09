import { useEffect, useState } from "react";
import {
  ArrowUpRight, Briefcase, FileWarning, Gavel, HandCoins, Loader2, Plus, Scale,
  Send, StickyNote, UserCog, X,
} from "lucide-react";
import { money } from "@/lib/money";
import { getCustomerTimeline, type TimelineEntry, type WorkspaceRow } from "@/lib/collection";
import { KIND_ICON, Pill, RISK_TONE, STAGE_TONE, dateText, dateTimeText, pretty, relative } from "./shared";

/**
 * The full operational picture for one account, as a side sheet.
 *
 * The board keeps cards deliberately thin; everything an agent needs to decide
 * what to do lives here instead, so the board stays scannable.
 */
export const AccountSheet = ({
  row, onClose, onCreateCase, onOpenCase, onOpenCustomer, onAgentAction, canEdit,
}: {
  row: WorkspaceRow | null;
  onClose: () => void;
  onCreateCase: (r: WorkspaceRow) => void;
  onOpenCase: (caseId: number) => void;
  onOpenCustomer?: (code: string) => void;
  onAgentAction?: () => void;
  canEdit: boolean;
}) => {
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!row) return;
    setTimeline([]);
    setLoading(true);
    getCustomerTimeline(row.customerId, 30)
      .then(setTimeline)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [row]);

  if (!row) return null;

  const block = (title: string, items: [string, string][]) => (
    <div>
      <h4 className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1.5">{title}</h4>
      <div className="space-y-1 text-xs">
        {items.map(([l, v]) => (
          <div key={l} className="flex justify-between gap-2 border-b border-border/40 pb-1">
            <span className="text-muted-foreground">{l}</span>
            <span className="text-foreground font-medium text-right truncate max-w-[60%]">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const act = (label: string, Icon: typeof Send, onClick: () => void) => (
    <button key={label} onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] hover:bg-muted transition">
      <Icon className="h-3.5 w-3.5" />{label}
    </button>
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <aside className="fixed right-0 top-0 bottom-0 w-full sm:w-[520px] bg-background border-l border-border z-50 flex flex-col shadow-2xl">
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Pill tone={STAGE_TONE[row.collectionStatus]}>{row.collectionStatus}</Pill>
                <Pill>{row.customerType}</Pill>
                {row.openCaseCode && <Pill>{row.openCaseCode}</Pill>}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <h2 className="text-lg font-semibold text-foreground truncate">{row.customerName}</h2>
                {onOpenCustomer && (
                  <button onClick={() => onOpenCustomer(row.customerId)} title="Open in Subscriber 360"
                    className="shrink-0 inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-primary hover:border-primary/40 transition">
                    360 <ArrowUpRight className="h-3 w-3" />
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {row.accountCode} · {row.ban ?? "no BAN"} · {row.servicePlan ?? "—"}
              </p>
            </div>
            <button onClick={onClose}
              className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2 mt-3 text-center">
            {[
              ["Outstanding", money(row.outstanding)],
              ["DPD", String(row.dpd)],
              ["Risk", row.riskLevel],
              ["Credit", row.creditScore ? String(row.creditScore) : "—"],
            ].map(([l, v]) => (
              <div key={l} className="rounded-lg bg-muted/50 py-2">
                <div className="text-[10px] text-muted-foreground">{l}</div>
                <div className={`text-sm font-semibold tabular-nums ${
                  l === "Risk" ? RISK_TONE[row.riskLevel] ?? "" : "text-foreground"}`}>{v}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-lg border border-primary/25 bg-primary/5 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-primary/80 font-semibold">
              Recommended next action
            </div>
            <div className="text-sm text-foreground">{row.nextAction}</div>
          </div>
        </div>

        {canEdit && (
          <div className="px-5 py-2.5 border-b border-border flex flex-wrap gap-1.5">
            {act("Create case", Plus, () => onCreateCase(row))}
            {row.openCaseId ? act("Open case", Briefcase, () => onOpenCase(row.openCaseId!)) : null}
            {act("Create PTP", HandCoins, () => onAgentAction?.())}
            {act("Send reminder", Send, () => onAgentAction?.())}
            {act("Raise dispute", FileWarning, () => onAgentAction?.())}
            {row.openCaseId
              ? act("Note / assign", UserCog, () => onOpenCase(row.openCaseId!))
              : null}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Live obligations, each from its own system of record */}
          <div className="flex flex-wrap gap-2">
            {row.activePtp && (
              <div className="rounded-lg border border-info/30 bg-info/5 px-3 py-1.5 text-[11px]">
                <HandCoins className="h-3 w-3 inline mr-1 text-info" />
                Promise {money(row.ptpAmount ?? 0)} due {dateText(row.ptpDueOn)}
              </div>
            )}
            {row.activeDisputes > 0 && (
              <div className="rounded-lg border border-orange-500/30 bg-orange-500/5 px-3 py-1.5 text-[11px]">
                <FileWarning className="h-3 w-3 inline mr-1 text-orange-600" />
                {row.activeDisputes} dispute · {money(row.disputedAmount)}
              </div>
            )}
            {row.agencyStatus && (
              <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 px-3 py-1.5 text-[11px]">
                <Gavel className="h-3 w-3 inline mr-1 text-purple-600" />
                {row.agencyName} · {pretty(row.agencyStatus)}
              </div>
            )}
            {row.legalStatus && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-1.5 text-[11px]">
                <Scale className="h-3 w-3 inline mr-1 text-destructive" />
                Legal · {row.legalStage}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {block("Customer", [
              ["Type", row.customerType], ["Company", row.companyName ?? "—"],
              ["Phone", row.phone ?? "—"], ["Email", row.email ?? "—"],
              ["Reachability", `${Math.round(row.contactability)}%`]])}
            {block("Account", [
              ["Account", row.accountCode ?? "—"], ["BAN", row.ban ?? "—"],
              ["Plan", row.servicePlan ?? "—"], ["Status", pretty(row.accountStatus)],
              ["Ageing", row.agingBucket ?? "—"]])}
            {block("Position", [
              ["Outstanding", money(row.outstanding)], ["DPD", String(row.dpd)],
              ["Risk", `${row.riskLevel} (${Math.round(row.riskScore)})`],
              ["Credit score", row.creditScore ? String(row.creditScore) : "—"],
              ["Strategy", row.strategy ?? "—"]])}
            {block("Collection", [
              ["Stage", row.collectionStatus], ["Agent", row.agentName ?? "Unassigned"],
              ["Open cases", String(row.openCases)], ["Queue", row.queueCode ?? "—"],
              ["Last contact", row.lastContactAt ? relative(row.lastContactAt) : "never"]])}
          </div>

          {block("Payments", [
            ["Last payment", dateText(row.lastPaymentOn)],
            ["Amount", row.lastPaymentAmount ? money(row.lastPaymentAmount) : "—"],
            ["In last 90 days", `${row.payments90d} · ${money(row.collected90d)}`],
            ["Contact attempts", String(row.contactAttempts)]])}

          <div>
            <h4 className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">
              History
            </h4>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <ol className="relative border-l border-border ml-2 space-y-2.5">
              {timeline.map((t, i) => (
                <li key={`${t.at}-${i}`} className="ml-4">
                  <span className="absolute -left-[9px] mt-0.5 h-[18px] w-[18px] rounded-full bg-muted border border-border flex items-center justify-center text-[9px]">
                    {KIND_ICON[t.kind] ?? "•"}
                  </span>
                  <div className="text-xs text-foreground">
                    {t.title}
                    {t.amount ? <span className="text-muted-foreground"> · {money(t.amount)}</span> : null}
                  </div>
                  {t.detail && <div className="text-[11px] text-muted-foreground">{t.detail}</div>}
                  <div className="text-[10px] text-muted-foreground">
                    {dateTimeText(t.at)}{t.actor ? ` · ${t.actor}` : ""}
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
