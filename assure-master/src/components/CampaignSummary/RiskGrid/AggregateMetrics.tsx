import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { formatMoney, type Account, type RiskGridSummary } from "@/data/portfolioStore";

interface AggregateMetricsProps {
  summary: RiskGridSummary;
  selectedAccount?: Account | null;
  onAgingBucketClick?: (bucket: string) => void;
}

// Risk tint per aging bucket — kept from the original design.
const bucketRisk = (bucket: string) =>
  bucket === "Current" ? "Low"
  : bucket.startsWith("1-30") ? "Low"
  : bucket.startsWith("31-60") ? "Medium"
  : bucket.startsWith("61-90") ? "High"
  : "Critical";

const getRiskColor = (risk: string) => {
  const colors = {
    Low: "hsl(var(--risk-low))",
    Medium: "hsl(var(--risk-medium))",
    High: "hsl(var(--risk-high))",
    Critical: "hsl(var(--risk-critical))",
  };
  return colors[risk as keyof typeof colors];
};

export const AggregateMetrics = ({
  summary,
  selectedAccount,
  onAgingBucketClick,
}: AggregateMetricsProps) => {
  const agingData = summary.byBucket.map((b) => ({
    bucket: b.bucket,
    outstanding: b.outstanding,
    customers: b.customers,
    risk: bucketRisk(b.bucket),
  }));

  const customerBucket = selectedAccount
    ? selectedAccount.agingBucket === "Current"
      ? "Current"
      : `${selectedAccount.agingBucket} DPD`
    : null;
  const customerName = selectedAccount?.name ?? null;

  const totalCustomers = summary.totalCustomers;
  const totalOutstanding = summary.totalOutstanding;
  const highestRiskBucket = summary.highestRiskBucket;
  const totalCarInflow = summary.predictedInflow;

  const formatCurrency = (value: number) => formatMoney(value);

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-lg">
      <h2 className="text-xl font-bold text-foreground mb-6">Portfolio Overview</h2>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">Total Customers</div>
          <div className="text-2xl font-bold text-foreground">{totalCustomers.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground mt-1">Across all segments</div>
        </div>
        
        <div className="bg-gradient-to-br from-risk-high/10 to-risk-high/5 border border-risk-high/20 rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">Total Outstanding</div>
          <div className="text-2xl font-bold text-foreground">{formatCurrency(totalOutstanding)}</div>
          <div className="text-xs text-muted-foreground mt-1">Portfolio value</div>
        </div>
        
        <div className="bg-gradient-to-br from-risk-critical/10 to-risk-critical/5 border border-risk-critical/20 rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">Highest Risk Bucket</div>
          <div className="text-xl font-bold text-foreground">{highestRiskBucket.bucket}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {formatCurrency(highestRiskBucket.outstanding)} • {highestRiskBucket.customers.toLocaleString()} customers
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-accent/10 to-accent/5 border border-accent/20 rounded-lg p-4">
          <div className="text-xs text-muted-foreground mb-1">Predicted CAR Inflow</div>
          <div className="text-2xl font-bold text-foreground">{formatCurrency(totalCarInflow)}</div>
          <div className="text-xs text-muted-foreground mt-1">Expected recovery</div>
        </div>
      </div>

      {/* Bar Chart */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-4">Outstanding Balance by Aging Bucket</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={agingData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis 
              dataKey="bucket" 
              stroke="hsl(var(--muted-foreground))" 
              fontSize={11}
              tick={{ fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))" 
              fontSize={11}
              tickFormatter={(v: number) => formatMoney(v, 0)}
              tick={{ fill: "hsl(var(--muted-foreground))" }}
              label={{ value: 'Outstanding', angle: -90, position: 'insideLeft', style: { fill: "hsl(var(--muted-foreground))", fontSize: 11 } }}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: "hsl(var(--card))", 
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px"
              }}
              formatter={(value: number, name: string) => {
                if (name === "outstanding") return [`${formatCurrency(value)}`, "Outstanding"];
                return [value, name];
              }}
            />
            <Bar 
              dataKey="outstanding" 
              radius={[8, 8, 0, 0]}
              cursor="pointer"
              onClick={(data) => onAgingBucketClick?.(data.bucket)}
            >
              {agingData.map((entry, index) => {
                const isCustomerBucket = customerBucket === entry.bucket;
                return (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={getRiskColor(entry.risk)}
                    fillOpacity={isCustomerBucket ? 1 : (selectedAccount ? 0.3 : 1)}
                    stroke={isCustomerBucket ? "hsl(var(--primary))" : "none"}
                    strokeWidth={isCustomerBucket ? 3 : 0}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {selectedAccount && customerBucket && customerName && (
          <div className="mt-3 p-3 bg-primary/10 border border-primary/30 rounded-lg text-center">
            <p className="text-sm font-semibold text-foreground">
              📍 {customerName} is in the <span className="text-primary">{customerBucket}</span> aging bucket
            </p>
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-3 text-center">
          Click on any bar to filter clusters by aging bucket • Color indicates risk level
        </p>
      </div>
    </div>
  );
};
