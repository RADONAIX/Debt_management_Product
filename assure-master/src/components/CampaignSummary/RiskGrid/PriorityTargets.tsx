import { ArrowUpRight, TrendingUp, AlertTriangle } from "lucide-react";
import { formatMoney, type Account, type derivePriorityTargets } from "@/data/portfolioStore";

type Target = ReturnType<typeof derivePriorityTargets>[number];

interface PriorityTargetsProps {
  targets: Target[];
  selectedAccount?: Account | null;
}

const getPriorityColor = (priority: string) => {
  const colors = {
    urgent: "hsl(var(--risk-critical))",
    high: "hsl(var(--risk-high))",
    medium: "hsl(var(--risk-medium))",
  };
  return colors[priority as keyof typeof colors];
};

const getPriorityIcon = (priority: string) => {
  if (priority === "urgent") return AlertTriangle;
  return TrendingUp;
};

/** Priority tier follows the risk band the account actually carries. */
const priorityFor = (riskLevel: string) =>
  riskLevel === "Critical" ? "urgent" : riskLevel === "High" ? "high" : "medium";

const timelineFor = (priority: string) =>
  priority === "urgent" ? "Target Now" : priority === "high" ? "Target This Week" : "Target Next Week";

const actionFor = (t: Target) =>
  t.contactability < 40
    ? `Low reachability (${t.contactability}%) — trace contact details before further ${t.channel} attempts.`
    : t.riskLevel === "Critical"
      ? `Escalate to ${t.strategy}: settlement terms with legal pre-notice prepared.`
      : `Run ${t.strategy} via ${t.channel} with a structured payment plan offer.`;

export const PriorityTargets = ({ targets, selectedAccount }: PriorityTargetsProps) => {
  // A selected customer pins itself to the top of the list.
  const displayTargets = (
    selectedAccount
      ? [
          ...targets.filter((t) => t.id === selectedAccount.customerId),
          ...targets.filter((t) => t.id !== selectedAccount.customerId),
        ]
      : targets
  ).map((t) => {
    const priority = priorityFor(t.riskLevel);
    return {
      ...t,
      clusterName: `${t.name} — ${t.segment}, ${t.riskLevel} Risk`,
      aging: String(t.dpd),
      risk: t.riskLevel,
      expectedROI: t.outstanding,
      predictedCollection: Math.round(t.outstanding * (t.contactability / 100)),
      opportunityScore: t.contactability,
      priority,
      timeline: timelineFor(priority),
      action: actionFor(t),
    };
  });

  const formatCurrency = (value: number) => formatMoney(value);

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-lg">
      <div className="mb-6">
        <h3 className="text-lg font-bold text-foreground mb-1">
          {selectedAccount ? "Customer Action Plan" : "Priority Targets"}
        </h3>
        <p className="text-xs text-muted-foreground">
          {selectedAccount
            ? "Recommended actions for this customer"
            : "Top accounts ranked by exposure, risk and reachability"}
        </p>
      </div>

      <div className="space-y-4">
        {displayTargets.map((target, index) => {
          const PriorityIcon = getPriorityIcon(target.priority);
          return (
            <div 
              key={target.id} 
              className="bg-gradient-to-r from-secondary/30 to-transparent border border-border rounded-lg p-4 hover:border-primary/50 transition-all duration-200 cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                    style={{ backgroundColor: getPriorityColor(target.priority), color: "white" }}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                      {target.clusterName}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{target.segment}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">{target.aging} days past due</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 border border-primary/20">
                  <PriorityIcon className="w-3 h-3 text-primary" />
                  <span className="text-xs font-semibold text-primary capitalize">{target.timeline}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="bg-card border border-border/50 rounded-md p-2">
                  <div className="text-[10px] text-muted-foreground mb-0.5">Exposure</div>
                  <div className="text-lg font-bold text-primary">{formatCurrency(target.expectedROI)}</div>
                </div>
                <div className="bg-card border border-border/50 rounded-md p-2">
                  <div className="text-[10px] text-muted-foreground mb-0.5">Expected</div>
                  <div className="text-lg font-bold text-foreground">{formatCurrency(target.predictedCollection)}</div>
                </div>
                <div className="bg-card border border-border/50 rounded-md p-2">
                  <div className="text-[10px] text-muted-foreground mb-0.5">Reachable</div>
                  <div className="text-lg font-bold text-success">{target.opportunityScore}%</div>
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/20 rounded-md p-3">
                <div className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">Recommended Action</div>
                <p className="text-xs text-foreground leading-relaxed">{target.action}</p>
              </div>

              <div className="flex items-center justify-end mt-3 text-xs text-primary group-hover:translate-x-1 transition-transform">
                View Full Strategy <ArrowUpRight className="w-3 h-3 ml-1" />
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-4 bg-accent/10 border border-accent/30 rounded-lg">
        <div className="flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-1">Portfolio-Wide Impact</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Targeting these 3 clusters could generate <span className="font-semibold text-primary">$ 25.4M in collections</span> with 
              an average uplift of <span className="font-semibold text-primary">18-22%</span> compared to traditional strategies.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
