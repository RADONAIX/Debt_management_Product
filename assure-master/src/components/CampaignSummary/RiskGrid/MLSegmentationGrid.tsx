import {
  BEHAVIOUR_PROFILES,
  DIMENSIONS,
  formatMoney,
  profileFor,
  type Account,
  type RiskCluster,
} from "@/data/portfolioStore";

interface MLSegmentationGridProps {
  clusters: RiskCluster[];
  onClusterClick?: (cluster: RiskCluster) => void;
  selectedCluster?: RiskCluster | null;
  selectedAccount?: Account | null;
}

const behaviorProfiles = [...BEHAVIOUR_PROFILES];
const mlSegments = DIMENSIONS.segments;

const getSegmentColor = (segment: string) => {
  const colors: Record<string, string> = {
    Consumer: "#4CAF50",
    SMB: "#FF9800",
    Enterprise: "#407BFF",
    Government: "#9C27B0",
  };
  return colors[segment] ?? "#78909C";
};

export const MLSegmentationGrid = ({
  clusters,
  onClusterClick,
  selectedCluster,
  selectedAccount,
}: MLSegmentationGridProps) => {
  const displayClusters = clusters;

  const handleBubbleClick = (cluster: RiskCluster) => {
    onClusterClick?.(cluster);
  };

  // Scale to the largest populated cell so the grid reads at any filter width.
  const maxCustomers = Math.max(...displayClusters.map((c) => c.customers), 1);
  const getBubbleSize = (customers: number) => {
    const minSize = 24;
    const maxSize = 72;
    return minSize + Math.min(customers / maxCustomers, 1) * (maxSize - minSize);
  };

  const getClusterForCell = (behavior: string, segment: string) =>
    displayClusters.find((c) => c.aging === behavior && c.risk === segment);

  const isCustomerCluster = (behavior: string, segment: string) =>
    Boolean(
      selectedAccount &&
        profileFor(selectedAccount.riskScore) === behavior &&
        selectedAccount.segment === segment,
    );

  return (
    <div className="bg-card rounded-xl border border-border p-8 shadow-lg">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">ML Segmentation - Behavior Profile Grid</h2>
        <p className="text-xs text-muted-foreground mt-1">AI-driven clustering based on payment patterns, volatility & engagement</p>
      </div>

      <div className="relative">
        {/* Grid Container */}
        <div className="grid grid-cols-5 gap-0 border-l border-t border-border/30 shadow-inner">
          {/* Header Row */}
          <div className="border-b border-r border-border/30 p-3 bg-secondary/20">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">BEHAVIOR →</div>
            <div className="text-[10px] font-semibold text-muted-foreground mt-0.5 uppercase tracking-wide">SEGMENT ↓</div>
          </div>
          {behaviorProfiles.map((profile) => (
            <div key={profile} className="border-b border-r border-border/30 p-3 bg-secondary/10 text-center">
              <div className="text-xs font-semibold text-foreground">{profile}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">Profile</div>
            </div>
          ))}

          {/* Grid Cells */}
          {mlSegments.map((segment) => (
            <div key={segment} className="contents">
              <div key={`label-${segment}`} className="border-b border-r border-border/30 p-3 bg-secondary/10 flex items-center">
                <div className="text-xs font-semibold text-foreground">{segment}</div>
              </div>
              {behaviorProfiles.map((behavior) => {
                const cluster = getClusterForCell(behavior, segment);
                return (
                  <div
                    key={`${segment}-${behavior}`}
                    className="border-b border-r border-border/30 p-2 min-h-[90px] flex items-center justify-center bg-dashboard-bg/20 relative group"
                  >
                    {cluster && (
                      <button
                        onClick={() => handleBubbleClick(cluster)}
                        className={`rounded-full transition-all duration-300 hover:scale-110 cursor-pointer flex items-center justify-center text-white font-semibold shadow-md hover:shadow-xl ${selectedCluster?.id === cluster.id ? "ring-2 ring-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.5)]" : ""
                          } ${isCustomerCluster(behavior, segment) ? 'ring-4 ring-primary animate-pulse' : ''}`}
                        style={{
                          width: `${getBubbleSize(cluster.customers)}px`,
                          height: `${getBubbleSize(cluster.customers)}px`,
                          backgroundColor: getSegmentColor(cluster.risk),
                          opacity: isCustomerCluster(behavior, segment) ? 1 : (selectedAccount ? 0.4 : (selectedCluster?.id === cluster.id ? 1 : 0.4)),
                        }}
                      >
                        <div className="text-center">
                          <div className="text-[10px] opacity-90">{cluster.customers}</div>
                          <div className="text-[8px] opacity-75">{formatMoney(cluster.outstanding, 0)}</div>
                        </div>
                      </button>
                    )}
                    {cluster && isCustomerCluster(behavior, segment) && selectedAccount && (
                      <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-bold text-primary whitespace-nowrap">
                        📍 {selectedAccount.name}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-4 text-[10px] flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getSegmentColor("Stable Payers") }}></div>
            <span className="text-muted-foreground">Stable Payers</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getSegmentColor("At-Risk Drifters") }}></div>
            <span className="text-muted-foreground">At-Risk Drifters</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getSegmentColor("High Value - High Risk") }}></div>
            <span className="text-muted-foreground">High Value - High Risk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getSegmentColor("High Risk - Low Value") }}></div>
            <span className="text-muted-foreground">High Risk - Low Value</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: getSegmentColor("Volatile / Unpredictable") }}></div>
            <span className="text-muted-foreground">Volatile / Unpredictable</span>
          </div>
          <div className="ml-auto text-muted-foreground text-[9px]">
            ML Clustering: K-Means + DBSCAN | Selected = 100% opacity
          </div>
        </div>

        {/* ML Inputs Info */}
        <div className="mt-3 p-3 bg-secondary/20 rounded-lg border border-border/30">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2">ML Input Features:</div>
          <div className="flex flex-wrap gap-3 text-[10px] text-foreground/80">
            <span>• Payment Frequency</span>
            <span>• Aging Trajectory</span>
            <span>• Balance Volatility</span>
            <span>• Plan Type</span>
            <span>• Tenure</span>
            <span>• Engagement History</span>
          </div>
        </div>
      </div>
    </div>
  );
};
