import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, CalendarClock, CalendarDays, Check, FileWarning, Gavel, HandCoins,
  Loader2, PhoneCall, RefreshCw, Scale, Truck, UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { money } from "@/lib/money";
import { ApiError } from "@/lib/api";
import { getTasks, patchTask, type TaskBoard, type TaskRow } from "@/lib/collection";
import { PRIORITY_TONE, Pill, dateText, plusDaysISO, pretty, todayISO } from "./shared";

/**
 * The follow-up diary — every task laid out day by day, overdue first.
 *
 * A collector plans by date, not by case: "what am I doing today, what is
 * waiting tomorrow". Filtering to one kind of work (promises, disputes, legal)
 * turns the same diary into a focused worklist.
 */
const TYPE_ICON: Record<string, typeof PhoneCall> = {
  CALLBACK: PhoneCall,
  FOLLOW_UP: UserCheck,
  PTP_FOLLOW_UP: HandCoins,
  DISPUTE_REVIEW: FileWarning,
  LEGAL_REVIEW: Scale,
  AGENCY_REVIEW: Gavel,
  DOCUMENT_CHASE: FileWarning,
  FIELD_VISIT: Truck,
  OTHER: CalendarClock,
};

const FILTERS: [string | null, string][] = [
  [null, "Everything"],
  ["PTP_FOLLOW_UP", "Promises"],
  ["CALLBACK", "Callbacks"],
  ["DISPUTE_REVIEW", "Disputes"],
  ["LEGAL_REVIEW", "Legal"],
  ["AGENCY_REVIEW", "Agency"],
  ["FOLLOW_UP", "Follow-ups"],
  ["DOCUMENT_CHASE", "Documents"],
  ["FIELD_VISIT", "Field visits"],
];

export const TaskDiary = ({
  canEdit, onOpenCase, onOpenCustomer,
}: {
  canEdit: boolean;
  onOpenCase: (id: number) => void;
  onOpenCustomer?: (code: string) => void;
}) => {
  const [board, setBoard] = useState<TaskBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState(false);
  const [taskType, setTaskType] = useState<string | null>(null);
  const [includeDone, setIncludeDone] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  // Rescheduling opens on the task's own due date, so the agent moves it
  // rather than re-entering it.
  const [reschedule, setReschedule] = useState<TaskRow | null>(null);
  const [newDate, setNewDate] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBoard(await getTasks({
        mine, taskType: taskType ?? undefined, includeDone, daysAhead: 60,
      }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load the diary.");
    } finally {
      setLoading(false);
    }
  }, [mine, taskType, includeDone]);

  useEffect(() => {
    void load();
  }, [load]);

  const openReschedule = (t: TaskRow) => {
    setReschedule(t);
    setNewDate(t.dueDate);
  };

  const saveReschedule = async () => {
    if (!reschedule || !newDate) return;
    setSaving(true);
    try {
      await patchTask(reschedule.id, { dueDate: newDate });
      const moved = newDate !== reschedule.dueDate;
      toast.success(moved
        ? `Moved to ${new Date(newDate).toLocaleDateString("en-US",
            { day: "numeric", month: "short", year: "numeric" })}.`
        : "Task updated.");
      setReschedule(null);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not reschedule the task.");
    } finally {
      setSaving(false);
    }
  };

  const complete = async (t: TaskRow) => {
    setBusy(t.id);
    try {
      await patchTask(t.id, { status: "DONE", outcome: "Completed" });
      toast.success("Task completed.");
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not update the task.");
    } finally {
      setBusy(null);
    }
  };

  const kpi = (label: string, value: number, tone = "text-foreground") => (
    <div className="px-4 py-3 rounded-xl border border-border bg-card">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-xl font-semibold tabular-nums mt-0.5 ${tone}`}>{value}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {kpi("Overdue", board?.overdue ?? 0,
          (board?.overdue ?? 0) > 0 ? "text-destructive" : "text-foreground")}
        {kpi("Today", board?.today ?? 0, "text-primary")}
        {kpi("Tomorrow", board?.tomorrow ?? 0)}
        {kpi("Next 7 days", board?.thisWeek ?? 0)}
        {kpi("All open", board?.totalOpen ?? 0)}
      </div>

      {/* Filters — the "just promises / just legal" cut */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5 flex-wrap">
          {FILTERS.map(([k, label]) => {
            const n = k ? board?.byType.find((b) => b.type === k)?.count : board?.totalOpen;
            return (
              <button key={label} onClick={() => setTaskType(k)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                  taskType === k ? "bg-primary text-primary-foreground"
                                 : "text-muted-foreground hover:text-foreground"}`}>
                {label}
                {n ? <span className="ml-1 opacity-70">{n}</span> : null}
              </button>
            );
          })}
        </div>
        <button onClick={() => setMine(!mine)}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
            mine ? "bg-primary text-primary-foreground border-primary"
                 : "border-border text-muted-foreground hover:text-foreground"}`}>
          <UserCheck className="h-3.5 w-3.5" /> Mine only
        </button>
        <button onClick={() => setIncludeDone(!includeDone)}
          className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
            includeDone ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-muted-foreground hover:text-foreground"}`}>
          Show completed
        </button>
        <Button size="sm" variant="ghost" className="h-9 px-2 ml-auto" onClick={() => void load()}>
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {loading && (
        <div className="py-16 text-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
        </div>
      )}

      {/* The diary itself */}
      {!loading && (
        <div className="space-y-4">
          {board?.days.map((day) => (
            <div key={day.date}>
              {/* Day header — the line the spec asked for */}
              <div className="flex items-center gap-3 mb-2">
                <div
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${
                    day.isOverdue
                      ? "bg-destructive/10 text-destructive"
                      : day.isToday
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                  }`}
                >
                  {day.isOverdue && <AlertTriangle className="h-3.5 w-3.5" />}
                  <span className="text-xs font-semibold">{day.label}</span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {day.open} open · {money(day.value)} in play
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              <div className="space-y-1.5">
                {day.tasks.map((t) => {
                  const Icon = TYPE_ICON[t.taskType] ?? CalendarClock;
                  const done = t.status === "DONE";
                  return (
                    <div
                      key={t.id}
                      onClick={() => t.caseId && onOpenCase(t.caseId)}
                      className={`group flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5 transition ${
                        t.caseId ? "cursor-pointer hover:border-primary/40" : ""
                      } ${done ? "opacity-60" : ""} ${
                        t.overdue ? "border-destructive/30" : "border-border"
                      }`}
                    >
                      <div
                        className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                          done ? "bg-success/10" : "bg-muted"
                        }`}
                      >
                        {done ? (
                          <Check className="h-4 w-4 text-success" />
                        ) : (
                          <Icon className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`text-sm font-medium text-foreground truncate ${
                              done ? "line-through" : ""
                            }`}
                          >
                            {t.title}
                          </span>
                          <Pill tone={PRIORITY_TONE[t.priority]}>{t.priority}</Pill>
                          <Pill>{pretty(t.taskType)}</Pill>
                          {t.overdue && (
                            <Pill tone="bg-destructive/10 text-destructive border-destructive/25">
                              Overdue
                            </Pill>
                          )}
                        </div>
                        {t.detail && (
                          <div className="text-[11px] text-muted-foreground truncate">
                            {t.detail}
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground">
                          {t.dueTime ? `${t.dueTime.slice(0, 5)} · ` : ""}
                          {t.caseNumber ? `${t.caseNumber} · ` : ""}
                          {t.customerName}
                          {t.outstanding > 0 ? ` · ${money(t.outstanding)} · ${t.dpd} DPD` : ""}
                          {t.assignedToName ? ` · ${t.assignedToName}` : ""}
                        </div>
                      </div>

                      {canEdit && !done && (
                        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px]"
                            title="Change the due date"
                            onClick={(e) => {
                              e.stopPropagation();
                              openReschedule(t);
                            }}
                          >
                            <CalendarDays className="h-3 w-3 mr-1" />
                            Reschedule
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px]"
                            disabled={busy === t.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              void complete(t);
                            }}
                          >
                            {busy === t.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <>
                                <Check className="h-3 w-3 mr-1" />
                                Done
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {!board?.days.length && (
            <div className="rounded-xl border border-dashed border-border py-16 text-center">
              <Check className="h-6 w-6 text-success mx-auto mb-2" />
              <p className="text-sm text-foreground font-medium">Nothing scheduled.</p>
              <p className="text-xs text-muted-foreground">
                {taskType ? "No work of this kind is due." : "The diary is clear."}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Reschedule — opens on the task's current due date */}
      <Dialog open={!!reschedule} onOpenChange={(v) => !v && setReschedule(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reschedule task</DialogTitle>
            <DialogDescription>{reschedule?.title}</DialogDescription>
          </DialogHeader>

          {reschedule && (
            <div className="space-y-4 py-1">
              <div className="rounded-xl border border-border bg-muted/20 p-3 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Currently due</span>
                  <span className="font-medium text-foreground">
                    {dateText(reschedule.dueDate)}
                    {reschedule.dueTime ? ` at ${reschedule.dueTime.slice(0, 5)}` : ""}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="font-medium text-foreground">{reschedule.customerName}</span>
                </div>
                {reschedule.caseNumber && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Case</span>
                    <span className="font-mono text-foreground">{reschedule.caseNumber}</span>
                  </div>
                )}
                {reschedule.overdue && (
                  <p className="text-destructive pt-1">
                    This task is already overdue.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">New due date</Label>
                <Input type="date" className="h-9" value={newDate}
                  onChange={(e) => setNewDate(e.target.value)} />
              </div>

              <div className="flex gap-1.5">
                {([
                  ["Today", todayISO()],
                  ["Tomorrow", plusDaysISO(1)],
                  ["In 3 days", plusDaysISO(3)],
                  ["Next week", plusDaysISO(7)],
                ] as const).map(([label, value]) => (
                  <button key={label} onClick={() => setNewDate(value)}
                    className={`flex-1 rounded-md border px-2 py-1.5 text-[11px] transition ${
                      newDate === value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border hover:bg-muted"}`}>
                    {label}
                  </button>
                ))}
              </div>

              {newDate && newDate !== reschedule.dueDate && (
                <p className="text-[11px] text-muted-foreground">
                  Moving from {dateText(reschedule.dueDate)} to {dateText(newDate)}.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setReschedule(null)}>Cancel</Button>
            <Button onClick={saveReschedule}
              disabled={saving || !newDate || newDate === reschedule?.dueDate}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Update due date
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
