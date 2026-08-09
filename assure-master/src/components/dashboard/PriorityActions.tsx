import { AlertOctagon, AlertTriangle, ChevronRight, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatCount, formatMoney, type PriorityAction } from "@/data/portfolioStore";

/* Status colours ship with an icon and a label, never colour alone. */
const SEVERITY: Record<
  PriorityAction["severity"],
  { icon: typeof AlertOctagon; className: string; label: string }
> = {
  critical: { icon: AlertOctagon, className: "text-destructive", label: "Critical" },
  warning: { icon: AlertTriangle, className: "text-warning", label: "Warning" },
  info: { icon: Info, className: "text-info", label: "Info" },
};

export function PriorityActions({
  actions,
  onNavigate,
}: {
  actions: PriorityAction[];
  onNavigate?: (moduleKey: string) => void;
}) {
  const totalAtRisk = actions.reduce((sum, a) => sum + a.valueAtRisk, 0);

  return (
    <Card className="p-5 h-full flex flex-col">
      <div>
        <h2 className="text-base font-semibold text-foreground">Needs Attention</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatMoney(totalAtRisk)} at risk across {actions.length} cohorts
        </p>
      </div>

      <ul className="mt-4 space-y-2 flex-1">
        {actions.map((action) => {
          const { icon: Icon, className, label } = SEVERITY[action.severity];
          return (
            <li key={action.id}>
              <button
                onClick={() => onNavigate?.(action.target)}
                className="w-full text-left rounded-lg border border-border p-3 hover:bg-muted/60 hover:border-primary/30 transition-colors group"
              >
                <div className="flex items-start gap-2.5">
                  <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${className}`} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {action.title}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {action.detail}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs">
                      <span className="font-semibold tabular-nums text-foreground">
                        {formatMoney(action.valueAtRisk)}
                      </span>
                      <span className="text-muted-foreground">
                        {formatCount(action.accounts)} accounts
                      </span>
                      <span className={`ml-auto font-medium ${className}`}>{label}</span>
                    </div>
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
