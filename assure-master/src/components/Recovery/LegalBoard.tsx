import { useState } from "react";
import { ArrowUpRight, CalendarClock, Loader2, Scale, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  deleteLegalCase,
  patchLegalCase,
  LEGAL_STAGES,
  LEGAL_STATUSES,
  type LegalCase,
} from "@/lib/recovery";
import { Pill, ProgressTrack, STATUS_TONE, dateText, dateTimeText } from "./shared";

/**
 * Legal escalation as a stage pipeline rather than a list — where a case sits
 * in the process is the first thing anyone needs to know.
 */
export const LegalBoard = ({
  cases,
  canEdit,
  onChanged,
  onOpenCustomer,
}: {
  cases: LegalCase[];
  canEdit: boolean;
  onChanged: () => void;
  onOpenCustomer?: (customerCode: string) => void;
}) => {
  const [expanded, setExpanded] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const run = async (id: number, fn: () => Promise<unknown>, ok: string) => {
    setBusy(id);
    try {
      await fn();
      toast.success(ok);
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  };

  const stageIndex = (s: string) => Math.max(0, LEGAL_STAGES.indexOf(s as never));
  const openCases = cases.filter((c) => c.status === "OPEN");
  const claim = openCases.reduce((s, c) => s + c.claimAmount, 0);
  const cost = cases.reduce((s, c) => s + c.legalCost, 0);
  const recovered = cases.reduce((s, c) => s + c.recoveredAmount, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-4 gap-3">
        {[
          ["Open cases", String(openCases.length)],
          ["Claim value", money(claim)],
          ["Legal spend", money(cost)],
          ["Recovered via legal", money(recovered)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-border bg-card px-4 py-3">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="text-lg font-semibold text-foreground tabular-nums mt-0.5">{value}</div>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {cases.map((c) => {
          const isOpen = expanded === c.id;
          const idx = stageIndex(c.stage);
          return (
            <div key={c.id} className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                onClick={() => setExpanded(isOpen ? null : c.id)}
                className="w-full text-left px-4 py-3 hover:bg-muted/30 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                    <Scale className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground truncate">
                        {c.customerName}
                      </span>
                      {onOpenCustomer && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenCustomer(c.customerId);
                          }}
                          title="Open in Subscriber 360"
                          className="shrink-0 inline-flex items-center gap-0.5 rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-primary hover:border-primary/40 transition"
                        >
                          360 <ArrowUpRight className="h-3 w-3" />
                        </span>
                      )}
                      <span className="text-[11px] font-mono text-muted-foreground">{c.code}</span>
                      <Pill tone={STATUS_TONE[c.status]}>{c.status}</Pill>
                      {/* Why this debt is litigable — read live from the customer. */}
                      {c.riskLevel && (
                        <Pill
                          tone={
                            c.riskLevel === "Critical"
                              ? "bg-destructive/10 text-destructive border-destructive/25"
                              : "bg-warning/10 text-warning border-warning/25"
                          }
                        >
                          {c.riskLevel} · {c.dpd} DPD
                        </Pill>
                      )}
                      {c.customerType && <Pill>{c.customerType === "ENTERPRISE" ? "Enterprise" : "Consumer"}</Pill>}
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {c.lawFirm ?? "No firm instructed"}
                      {c.attorney ? ` · ${c.attorney}` : ""}
                      {c.court ? ` · ${c.court}` : ""}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold text-foreground tabular-nums">
                      {money(c.claimAmount)}
                    </div>
                    {c.nextHearing && (
                      <div className="text-[11px] text-muted-foreground flex items-center gap-1 justify-end">
                        <CalendarClock className="h-3 w-3" />
                        {dateText(c.nextHearing)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Stage pipeline */}
                <div className="flex items-center gap-1 mt-3">
                  {LEGAL_STAGES.slice(0, 7).map((s, i) => (
                    <div key={s} className="flex-1">
                      <div
                        className={`h-1.5 rounded-full ${
                          i <= idx ? "bg-violet-500" : "bg-muted"
                        }`}
                      />
                      <div
                        className={`text-[9px] mt-1 truncate ${
                          i === idx ? "text-foreground font-medium" : "text-muted-foreground"
                        }`}
                      >
                        {s}
                      </div>
                    </div>
                  ))}
                </div>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 border-t border-border pt-3 space-y-3">
                  <div className="grid grid-cols-4 gap-3 text-xs">
                    {[
                      ["Filed", dateText(c.filedOn)],
                      ["Legal cost", money(c.legalCost)],
                      ["Recovered", money(c.recoveredAmount)],
                      ["From placement", c.placementCode ?? "—"],
                    ].map(([l, v]) => (
                      <div key={l}>
                        <div className="text-muted-foreground text-[10px] uppercase tracking-wide">
                          {l}
                        </div>
                        <div className="font-medium text-foreground">{v}</div>
                      </div>
                    ))}
                  </div>

                  {c.successProbability != null && (
                    <div>
                      <div className="flex justify-between text-[11px] mb-1">
                        <span className="text-muted-foreground">Success probability</span>
                        <span className="font-semibold">{c.successProbability}%</span>
                      </div>
                      <ProgressTrack pct={c.successProbability} tone="bg-violet-500" />
                    </div>
                  )}

                  {canEdit && (
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground">Stage</span>
                        <Select
                          value={c.stage}
                          onValueChange={(v) =>
                            run(c.id, () => patchLegalCase(c.id, { stage: v }), "Stage updated.")
                          }
                        >
                          <SelectTrigger className="h-8 w-40 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LEGAL_STAGES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground">Status</span>
                        <Select
                          value={c.status}
                          onValueChange={(v) =>
                            run(c.id, () => patchLegalCase(c.id, { status: v }), "Case updated.")
                          }
                        >
                          <SelectTrigger className="h-8 w-32 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {LEGAL_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>
                                {s}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground">Next hearing</span>
                        <Input
                          type="date"
                          className="h-8 w-36 text-xs"
                          defaultValue={c.nextHearing ?? ""}
                          onBlur={(e) =>
                            e.target.value !== (c.nextHearing ?? "") &&
                            run(
                              c.id,
                              () => patchLegalCase(c.id, { nextHearing: e.target.value }),
                              "Hearing date saved.",
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground">Legal cost</span>
                        <Input
                          type="number"
                          className="h-8 w-28 text-xs"
                          defaultValue={c.legalCost}
                          onBlur={(e) =>
                            Number(e.target.value) !== c.legalCost &&
                            run(
                              c.id,
                              () => patchLegalCase(c.id, { legalCost: Number(e.target.value) }),
                              "Legal cost saved.",
                            )
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground">Recovered</span>
                        <Input
                          type="number"
                          className="h-8 w-28 text-xs"
                          defaultValue={c.recoveredAmount}
                          onBlur={(e) =>
                            Number(e.target.value) !== c.recoveredAmount &&
                            run(
                              c.id,
                              () =>
                                patchLegalCase(c.id, { recoveredAmount: Number(e.target.value) }),
                              "Recovery saved.",
                            )
                          }
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 ml-auto text-destructive hover:text-destructive"
                        disabled={busy === c.id}
                        onClick={() =>
                          run(c.id, () => deleteLegalCase(c.id), "Case deleted.")
                        }
                      >
                        {busy === c.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  )}

                  {c.events.length > 0 && (
                    <ol className="relative border-l border-border ml-1.5 space-y-2 pt-1">
                      {c.events.map((e) => (
                        <li key={e.id} className="ml-4">
                          <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-violet-500/60 ring-4 ring-card" />
                          <div className="text-[11px] text-foreground">{e.detail}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {dateTimeText(e.occurredAt)}
                            {e.actor ? ` · ${e.actor}` : ""}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {cases.length === 0 && (
          <div className="rounded-xl border border-dashed border-border py-12 text-center">
            <Scale className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No legal cases. Escalate a placement from the board to open one.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
