import { useState } from "react";
import { DIMENSIONS, formatMoney, type Account, type RiskCluster } from "@/data/portfolioStore";

interface HeatmapGridProps {
  clusters: RiskCluster[];
  onClusterClick: (cluster: RiskCluster) => void;
  selectedCluster?: RiskCluster | null;
  selectedAccount?: Account | null;
}

// Axes come from the dataset's own vocabulary, so the grid can never show a
// bucket the data does not use.
const agingBuckets = DIMENSIONS.buckets;
const riskLevels = ["Critical", "High", "Medium", "Low"];

// ---------------- SIMPLE FIXED COLORS (NO VARIABLES) ----------------
const getRiskColor = (risk: string) => {
  const colors: Record<string, string> = {
    Low: "#4CAF50",        // Green
    Medium: "#FF9800",     // Orange
    High: "#F44336",       // Red
    Critical: "#9C27B0",   // Purple
  };
  return colors[risk] ?? "#78909C"; // fallback grey
};

export const HeatmapGrid = ({
  clusters,
  onClusterClick,
  selectedCluster,
  selectedAccount,
}: HeatmapGridProps) => {
  const displayClusters = clusters;

  const handleBubbleClick = (cluster: RiskCluster) => {
    onClusterClick(cluster);
  };

  // Bubble size scales to the largest populated cell, so the grid stays
  // readable whatever the filters leave behind.
  const maxCustomers = Math.max(...displayClusters.map((c) => c.customers), 1);
  const getBubbleSize = (customers: number) => {
    const min = 24,
      max = 72;
    return min + Math.min(customers / maxCustomers, 1) * (max - min);
  };

  const getClusterForCell = (aging: string, risk: string) =>
    displayClusters.find((c) => c.aging === aging && c.risk === risk);

  const isCustomerCluster = (aging: string, risk: string) =>
    Boolean(
      selectedAccount &&
        selectedAccount.agingBucket === aging &&
        selectedAccount.riskLevel === risk,
    );

  return (
    <div className="bg-card rounded-xl border p-8 shadow-lg" style={{ height: "100%" }}>
      <div className="mb-6">
        <h2 className="text-xl font-bold">Risk Grid - Aggregated AI Segmentation</h2>
        <p className="text-xs text-muted-foreground">Click any bubble to view cluster insights</p>
      </div>

      <div className="grid grid-cols-6 border-l border-t border-border/30 shadow-inner">

        {/* Header */}
        <div className="border-b border-r p-3 bg-secondary/20">
          <div className="text-[10px] font-semibold">AGING →</div>
          <div className="text-[10px] font-semibold mt-1">RISK ↓</div>
        </div>

        {agingBuckets.map((a) => (
          <div key={a} className="border-b border-r p-3 text-center bg-secondary/10">
            <div className="text-xs font-semibold">{a === "Current" ? "Current" : a}</div>
            <div className="text-[10px] text-muted-foreground">{a === "Current" ? "" : "Days"}</div>
          </div>
        ))}

        {/* Grid Cells */}
        {riskLevels.map((risk) => (
          <div key={risk} className="contents">
            <div className="border-b border-r p-3 bg-secondary/10 flex items-center font-semibold text-xs">
              {risk}
            </div>

            {agingBuckets.map((aging) => {
              const cluster = getClusterForCell(aging, risk);
              if (!cluster)
                return <div key={`${aging}-${risk}`} className="border-b border-r p-2 min-h-[90px]" />;

              const isCust = isCustomerCluster(aging, risk);
              const isSelected = selectedCluster?.id === cluster.id;
              const filtered = Boolean(selectedAccount);

              const bubbleStyle = {
                backgroundColor: getRiskColor(cluster.risk),
                width: `${getBubbleSize(cluster.customers)}px`,
                height: `${getBubbleSize(cluster.customers)}px`,

                opacity: isCust
                  ? 1
                  : filtered
                  ? 0.35
                  : isSelected
                  ? 1
                  : 0.5,

                boxShadow: isCust
                  ? "0 0 12px rgba(64,123,255,0.9)"
                  : "none",

                border: isCust ? "3px solid #407BFF" : "none",
              };

              return (
                <div key={`${aging}-${risk}`} className="border-b border-r p-2 min-h-[90px] flex items-center justify-center">
                  <button
                    onClick={() => handleBubbleClick(cluster)}
                    style={bubbleStyle}
                    className="rounded-full transition-all duration-300 hover:scale-110 text-white font-semibold flex items-center justify-center"
                  >
                    <div className="text-center leading-tight">
                      <div className="text-[10px]">{cluster.customers}</div>
                      <div className="text-[8px] opacity-80">
                        {formatMoney(cluster.outstanding, 0)}
                      </div>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
