import { Card } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Customer } from "@/data/customerData";

interface AgingBucket {
  range: string;
  buckets: { percentage: number; color: string; label: string }[];
  total: string;
}

const buckets: AgingBucket[] = [
  {
    range: "0-30",
    buckets: [
      { percentage: 25, color: "bg-chart-ab-deep-blue", label: "0-7 days: 25%" },
      { percentage: 25, color: "bg-chart-ab-blue", label: "8-14 days: 25%" },
      { percentage: 25, color: "bg-chart-ab-cyan", label: "15-21 days: 25%" },
      { percentage: 25, color: "bg-chart-ab-teal-blue", label: "22-30 days: 25%" }
    ],
    total: "55%"
  },
  {
    range: "31-60",
    buckets: [
      { percentage: 9, color: "bg-chart-ab-light-cyan", label: "31-40 days: 9%" },
      { percentage: 10, color: "bg-chart-ab-teal", label: "41-50 days: 10%" },
      { percentage: 18, color: "bg-chart-ab-blue-cyan", label: "51-60 days: 18%" }
    ],
    total: "21%"
  },
  {
    range: "61-90",
    buckets: [
      { percentage: 18, color: "bg-chart-ab-cyan-bright", label: "61-75 days: 18%" },
      { percentage: 18, color: "bg-chart-ab-soft-cyan", label: "76-90 days: 18%" }
    ],
    total: "21%"
  },
  {
    range: "31-180",
    buckets: [
      { percentage: 12, color: "bg-chart-ab-blue-light", label: "91-135 days: 12%" },
      { percentage: 13, color: "bg-chart-ab-soft-teal", label: "136-180 days: 13%" }
    ],
    total: "21%"
  },
  {
    range: "> 190",
    buckets: [
      { percentage: 5, color: "bg-chart-ab-teal-cyan", label: "Over 190 days: 5%" }
    ],
    total: "15%"
  }
];

interface AgingBucketChartProps {
  selectedCustomer?: Customer | null;
}

export const AgingBucketChart = ({ selectedCustomer }: AgingBucketChartProps) => {
  // If customer is selected, show simplified view with their bucket
  if (selectedCustomer?.agingBucketContribution) {
    const { bucket, customerSharePct, severityScore } = selectedCustomer.agingBucketContribution;
    
    return (
      <Card className="bg-white border-dashboard-border p-6 space-y-5">
        <h3 className="text-base font-semibold text-foreground">
          Aging Bucket Distribution - {selectedCustomer.name}
        </h3>
        
        <div className="space-y-4">
          <div className="p-4 bg-muted/30 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">Customer Bucket</span>
              <span className="text-lg font-bold text-foreground">{bucket} days</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">Portfolio Share</span>
              <span className="text-lg font-semibold text-kpi-light-blue">{customerSharePct}%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Severity Score</span>
              <span className={`text-lg font-semibold ${
                severityScore > 70 ? 'text-warning' : severityScore > 50 ? 'text-chart-orange' : 'text-success'
              }`}>{severityScore}/100</span>
            </div>
          </div>
          
          <div className="h-10 rounded-sm overflow-hidden flex">
            <div 
              className={`flex items-center justify-center text-xs text-white font-semibold ${
                bucket === "0-30" ? 'bg-chart-ab-deep-blue' :
                bucket === "31-60" ? 'bg-chart-ab-light-cyan' :
                bucket === "61-90" ? 'bg-chart-ab-cyan-bright' :
                bucket === "91-180" ? 'bg-chart-ab-blue-light' :
                'bg-chart-ab-teal-cyan'
              }`}
              style={{ width: '100%' }}
            >
              {bucket} days bucket
            </div>
          </div>
        </div>
      </Card>
    );
  }

  // Portfolio overview (original view)
  return (
    <TooltipProvider>
      <Card className="bg-dashboard-card border-dashboard-border p-6 space-y-5">
        <h3 className="text-base font-semibold text-foreground">Aging Bucket Distribution</h3>
        
        <div className="space-y-4">
          {buckets.map((bucket) => (
            <div key={bucket.range} className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground font-normal">{bucket.range}</span>
                <span className="text-foreground font-semibold">{bucket.total}</span>
              </div>
              <div className="flex gap-0.5 h-10 rounded-sm overflow-hidden">
                {bucket.buckets.map((b, idx) => (
                  <Tooltip key={idx}>
                    <TooltipTrigger asChild>
                      <div
                        className={`${b.color} flex items-center justify-center text-xs text-white font-semibold cursor-pointer hover:opacity-90 transition-opacity`}
                        style={{ width: `${b.percentage}%` }}
                      >
                        {b.percentage > 8 && `${b.percentage}%`}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-dashboard-card border-dashboard-border">
                      <p className="text-sm font-medium">{b.label}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Outstanding: $ {(b.percentage * 51.6).toFixed(1)}M
                      </p>
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </div>
          ))}
        </div>

      <div className="flex flex-wrap gap-5 pt-3 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm bg-legend-blue"></div>
          <span className="text-muted-foreground">0-30 days</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm bg-legend-light-blue"></div>
          <span className="text-muted-foreground">31%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm bg-legend-aqua"></div>
          <span className="text-muted-foreground">61%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm bg-legend-blue-green"></div>
          <span className="text-muted-foreground">91-180%</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-sm bg-legend-navy"></div>
          <span className="text-muted-foreground">&gt; 180%</span>
        </div>
        </div>
      </Card>
    </TooltipProvider>
  );
};
