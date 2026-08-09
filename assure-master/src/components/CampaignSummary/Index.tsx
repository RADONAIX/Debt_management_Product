import { useEffect, useMemo, useState } from "react";
import { FilterBar } from "./RiskGrid/FilterBar";
import { HeatmapGrid } from "./RiskGrid/HeatmapGrid";
import { MLSegmentationGrid } from "./RiskGrid/MLSegmentationGrid";
import { AIRecommendation } from "./RiskGrid/AIRecommendation";
import { ActionButtons } from "./RiskGrid/ActionButtons";
import { AggregateMetrics } from "./RiskGrid/AggregateMetrics";
import { PriorityTargets } from "./RiskGrid/PriorityTargets";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  ACCOUNTS,
  DEFAULT_FILTERS,
  deriveBehaviourGrid,
  derivePriorityTargets,
  deriveRiskGrid,
  deriveRiskGridSummary,
  filterAccounts,
  type PortfolioFilters,
  type RiskCluster,
} from "@/data/portfolioStore";
import { useScopedAccounts } from "@/hooks/useScopedAccounts";

/**
 * Risk Grid Analytics.
 *
 * Layout is unchanged; the data underneath now comes from the canonical account
 * list. The filter bar and the customer search both narrow the SAME list, and
 * every panel derives from the result — so the panels cannot disagree.
 */
const CampaignSummary = ({ setActiveModule, setSelectedCustomerView }) => {
  const [filters, setFilters] = useState<PortfolioFilters>(DEFAULT_FILTERS);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<RiskCluster | null>(null);

  useEffect(() => {
    setSelectedCustomerView?.(selectedCustomer);
  }, [selectedCustomer, setSelectedCustomerView]);

  const scoped = useScopedAccounts();
  const filtered = useMemo(() => filterAccounts(scoped, filters), [scoped, filters]);

  // The customer search highlights rather than removes, so the grid keeps its
  // shape while the selected customer's position is emphasised.
  const summary = useMemo(() => deriveRiskGridSummary(filtered), [filtered]);
  const clusters = useMemo(() => deriveRiskGrid(filtered), [filtered]);
  const targets = useMemo(() => derivePriorityTargets(filtered, 3), [filtered]);
  const mlClusters = useMemo(() => deriveBehaviourGrid(filtered), [filtered]);

  const selectedAccount = useMemo(
    () => filtered.find((a) => a.customerId === selectedCustomer) ?? null,
    [filtered, selectedCustomer],
  );

  // A cluster selected under one filter may not exist under the next.
  useEffect(() => {
    if (selectedCluster && !clusters.some((c) => c.id === selectedCluster.id)) {
      setSelectedCluster(null);
    }
  }, [clusters, selectedCluster]);

  return (
    <div>
      <div className="space-y-6">
        <PageHeader
          title="Risk Grid Analytics"
          description="Diagnostic + Prescriptive Analytics Dashboard | AI-Powered Segmentation & Strategy Recommendations"
          actions={
            selectedCustomer ? (
              <span className="text-sm font-medium text-primary">• Customer View Active</span>
            ) : undefined
          }
        />

        {/* Filter Bar */}
        <FilterBar
          accounts={scoped}
          filters={filters}
          onFilterChange={(key, value) => setFilters((prev) => ({ ...prev, [key]: value }))}
          onReset={() => setFilters(DEFAULT_FILTERS)}
          matchCount={filtered.length}
          onCustomerSearch={setSelectedCustomer}
          selectedCustomer={selectedCustomer}
          setActiveModule={setActiveModule}
          setSelectedCustomerID={setSelectedCustomerView}
        />

        {/* Aggregate Metrics */}
        <AggregateMetrics summary={summary} selectedAccount={selectedAccount} />

        {/* Risk Grid Layout - Grid Left, AI Right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <HeatmapGrid
              clusters={clusters}
              onClusterClick={setSelectedCluster}
              selectedCluster={selectedCluster}
              selectedAccount={selectedAccount}
            />
          </div>
          <div>
            <AIRecommendation cluster={selectedCluster} />
          </div>
        </div>

        {/* ML Segmentation Grid Layout - Grid Left, Priority Targets Right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <MLSegmentationGrid clusters={mlClusters} selectedAccount={selectedAccount} />
            <div className="bg-card rounded-xl border border-border p-6 shadow-lg mt-6">
              <h3 className="text-lg font-semibold text-foreground mb-4">Bulk Actions</h3>
              <ActionButtons />
            </div>
          </div>

          <div>
            <PriorityTargets targets={targets} selectedAccount={selectedAccount} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CampaignSummary;
