import { Building2, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { moneyShort } from "@/lib/money";
import type { Agency } from "@/lib/recovery";
import { Pill, ProgressTrack, STATUS_TONE, pretty } from "./shared";

/**
 * The agency book as a filter rail. Each card is both a scorecard and the
 * filter for the board on the right — clicking one scopes the whole workspace
 * to that agency, which is how a recovery manager actually works.
 */
export const AgencyRail = ({
  agencies,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onAdd,
  canEdit,
}: {
  agencies: Agency[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  onEdit: (a: Agency) => void;
  onDelete: (a: Agency) => void;
  onAdd: () => void;
  canEdit: boolean;
}) => {
  const ranked = [...agencies].sort((a, b) => b.performanceScore - a.performanceScore);
  const totalOpen = agencies.reduce((s, a) => s + a.activePlacements, 0);

  return (
    <div className="w-[300px] shrink-0 flex flex-col rounded-2xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Building2 className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold text-foreground">Agencies</span>
        <span className="text-[11px] text-muted-foreground">{totalOpen} open</span>
        {canEdit && (
          <Button size="sm" variant="ghost" className="ml-auto h-7 px-2" onClick={onAdd}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <button
        onClick={() => onSelect(null)}
        className={`px-4 py-2 text-left text-xs border-b border-border transition ${
          selected === null
            ? "bg-primary/5 text-primary font-medium"
            : "text-muted-foreground hover:bg-muted/50"
        }`}
      >
        All agencies
      </button>

      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {ranked.map((a, i) => {
          const active = selected === a.id;
          return (
            <div
              key={a.id}
              onClick={() => onSelect(active ? null : a.id)}
              className={`group px-4 py-3 cursor-pointer transition ${
                active ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/40 border-l-2 border-l-transparent"
              }`}
            >
              <div className="flex items-start gap-2">
                {/* Rank badge — the leaderboard framing is the point of the rail. */}
                <span
                  className={`mt-0.5 h-5 w-5 shrink-0 rounded-md text-[10px] font-bold flex items-center justify-center ${
                    i === 0
                      ? "bg-amber-400/20 text-amber-600 dark:text-amber-400"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground truncate">{a.name}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Pill tone={STATUS_TONE[a.status]}>{pretty(a.status)}</Pill>
                    <span className="text-[10px] text-muted-foreground truncate">{a.type}</span>
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(a);
                      }}
                      className="h-6 w-6 rounded hover:bg-muted flex items-center justify-center text-muted-foreground"
                      title="Edit agency"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete(a);
                      }}
                      className="h-6 w-6 rounded hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive"
                      title="Remove agency"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-2.5 flex items-baseline justify-between text-[11px]">
                <span className="text-muted-foreground">Recovery</span>
                <span className="font-semibold text-foreground tabular-nums">
                  {a.recoveryRate}%
                  <span className="text-muted-foreground font-normal">
                    {" "}
                    · {moneyShort(a.totalRecovered)}
                  </span>
                </span>
              </div>
              <ProgressTrack
                pct={a.recoveryRate}
                className="mt-1"
                tone={
                  a.recoveryRate >= 60
                    ? "bg-success"
                    : a.recoveryRate >= 40
                      ? "bg-warning"
                      : "bg-destructive"
                }
              />

              <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {a.activePlacements}/{a.capacity}
                </span>
                <span>{a.commissionPct}% comm</span>
                {a.avgDaysToRecover != null && <span>{a.avgDaysToRecover}d avg</span>}
                <span className="ml-auto font-semibold text-foreground">{a.performanceScore}</span>
              </div>
            </div>
          );
        })}
        {agencies.length === 0 && (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            No agencies registered yet.
          </p>
        )}
      </div>
    </div>
  );
};
