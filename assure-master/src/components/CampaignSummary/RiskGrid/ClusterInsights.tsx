interface Cluster {
  id: string;
  aging: string;
  risk: string;
  customers: number;
  outstanding: number;
  segment: string;
  avgDPD: number;
  carInflow: number;
  contactability: number;
  disputeRate: number;
  ptpSuccess: number;
  lastPayment: number;
  paymentFrequency?: number;
  volatility?: number;
  tenure?: number;
  engagementScore?: number;
}

interface ClusterInsightsProps {
  cluster: Cluster | null;
}

export const ClusterInsights = ({ cluster }: ClusterInsightsProps) => {
  if (!cluster) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 shadow-lg h-full flex items-center justify-center">
        <p className="text-muted-foreground text-center">Click on a bubble to view cluster insights</p>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return `$ ${(value / 1000000).toFixed(1)}M`;
  };

  const metrics = [
    { label: "Segment", value: cluster.segment, highlight: false },
    { label: "Customers", value: cluster.customers.toLocaleString(), highlight: true },
    { label: "Outstanding", value: formatCurrency(cluster.outstanding), highlight: true },
    { label: "Avg DPD", value: `${cluster.avgDPD} days`, highlight: false },
    { label: "CAR Predicted Inflow", value: formatCurrency(cluster.carInflow), highlight: true },
    { label: "Contactability", value: `${cluster.contactability}%`, highlight: false },
    { label: "Dispute Rate", value: `${cluster.disputeRate}%`, highlight: cluster.disputeRate > 10 },
    { label: "PTP Success", value: `${cluster.ptpSuccess}%`, highlight: false },
    { label: "Last Payment", value: `${cluster.lastPayment} days ago`, highlight: false },
  ];

  // Add ML-specific metrics if available
  if (cluster.paymentFrequency !== undefined) {
    metrics.push({ label: "Payment Freq", value: `${cluster.paymentFrequency}%`, highlight: cluster.paymentFrequency > 70 });
  }
  if (cluster.volatility !== undefined) {
    metrics.push({ label: "Volatility", value: `${cluster.volatility}%`, highlight: cluster.volatility > 60 });
  }
  if (cluster.tenure !== undefined) {
    metrics.push({ label: "Tenure", value: `${cluster.tenure} mo`, highlight: false });
  }
  if (cluster.engagementScore !== undefined) {
    metrics.push({ label: "Engagement", value: `${cluster.engagementScore}%`, highlight: cluster.engagementScore > 70 });
  }

  // Calculate risk drivers
  const portfolioAvg = {
    contactability: 75,
    disputeRate: 8,
    ptpSuccess: 45,
    avgDPD: 45,
  };

  const riskDrivers = [];
  if (cluster.contactability < portfolioAvg.contactability - 10) {
    riskDrivers.push({ 
      factor: "Low Contactability", 
      value: `${cluster.contactability}% vs ${portfolioAvg.contactability}% avg`,
      trend: "↓",
      severity: "high"
    });
  }
  if (cluster.disputeRate > portfolioAvg.disputeRate + 5) {
    riskDrivers.push({ 
      factor: "High Dispute Rate", 
      value: `${cluster.disputeRate}% vs ${portfolioAvg.disputeRate}% avg`,
      trend: "↑",
      severity: "high"
    });
  }
  if (cluster.ptpSuccess < portfolioAvg.ptpSuccess - 10) {
    riskDrivers.push({ 
      factor: "Low PTP Success", 
      value: `${cluster.ptpSuccess}% vs ${portfolioAvg.ptpSuccess}% avg`,
      trend: "↓",
      severity: "medium"
    });
  }
  if (cluster.avgDPD > portfolioAvg.avgDPD + 20) {
    riskDrivers.push({ 
      factor: "High Delinquency", 
      value: `${cluster.avgDPD} days vs ${portfolioAvg.avgDPD} days avg`,
      trend: "↑",
      severity: "high"
    });
  }

  return (
    <div className="bg-card rounded-xl border border-border p-5 shadow-md">
      <div className="mb-4">
        <h3 className="text-lg font-bold text-foreground mb-2">Cluster Insights</h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Aging Bucket:</span>
          <span className="px-3 py-1 bg-secondary rounded-md text-sm font-semibold">{cluster.aging} Days</span>
          <span className="text-sm text-muted-foreground">Risk Level:</span>
          <span
            className={`px-3 py-1 rounded-md text-sm font-semibold ${
              cluster.risk === "Critical"
                ? "bg-risk-critical text-white"
                : cluster.risk === "High"
                ? "bg-risk-high text-white"
                : cluster.risk === "Medium"
                ? "bg-risk-medium text-white"
                : "bg-risk-low text-white"
            }`}
          >
            {cluster.risk}
          </span>
        </div>
      </div>

      {/* Risk Drivers Section */}
      {riskDrivers.length > 0 && (
        <div className="mb-4 p-3 bg-risk-high/10 border border-risk-high/30 rounded-lg">
          <div className="text-xs font-semibold text-foreground mb-2 flex items-center gap-2">
            <span className="text-risk-high">⚠</span> Primary Risk Drivers
          </div>
          <div className="space-y-2">
            {riskDrivers.map((driver, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground">{driver.factor}</span>
                  <span className={`text-xs ${driver.severity === "high" ? "text-risk-high" : "text-risk-medium"}`}>
                    {driver.trend}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{driver.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 md:grid-cols-5 gap-3">
        {metrics.map((metric, index) => (
          <div key={index} className="bg-secondary/30 rounded-lg p-3 border border-border/50">
            <div className="text-[10px] text-muted-foreground mb-1">{metric.label}</div>
            <div className={`text-sm font-bold ${metric.highlight ? "text-primary" : "text-foreground"}`}>
              {metric.value}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-primary/10 border border-primary/30 rounded-lg">
        <div className="text-xs text-muted-foreground mb-1">Risk Assessment</div>
        <p className="text-sm text-foreground leading-relaxed">
          This cluster shows{" "}
          <span className="font-semibold text-primary">
            {cluster.risk.toLowerCase()} risk characteristics
          </span>{" "}
          with {cluster.customers.toLocaleString()} customers holding {formatCurrency(cluster.outstanding)} in outstanding
          debt. Average delinquency is {cluster.avgDPD} days with contactability at {cluster.contactability}%.
        </p>
      </div>
    </div>
  );
};
