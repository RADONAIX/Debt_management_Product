import { Card } from "@/components/ui/card";
import { Customer } from "@/data/customerData";

interface MatrixCell {
  value: string;
  color: string;
}

const matrixData = [
  {
    strategy: "Government",
    segment: "SMB",
    cells: [
      { value: "28%", color: "bg-chart-blue/40 text-chart-blue" },
      { value: "45%", color: "bg-chart-blue/50 text-chart-blue" },
      { value: "92%", color: "bg-chart-teal/60 text-chart-teal" },
      { value: "12%", color: "bg-chart-orange text-white" }
    ]
  },
  {
    strategy: "AI Dialer",
    segment: "Enter",
    cells: [
      { value: "55%", color: "bg-chart-blue/60 text-chart-blue" },
      { value: "54%", color: "bg-chart-blue/55 text-chart-blue" },
      { value: "37%", color: "bg-chart-teal/50 text-chart-teal" },
      { value: "12%", color: "bg-chart-orange text-white" }
    ]
  },
  {
    strategy: "Legal Pre-in",
    segment: "Consumer",
    cells: [
      { value: "22%", color: "bg-chart-blue/30 text-chart-blue" },
      { value: "32%", color: "bg-chart-blue/40 text-chart-blue" },
      { value: "62%", color: "bg-chart-teal/60 text-chart-teal" },
      { value: "8%", color: "bg-chart-orange text-white" }
    ]
  },
  {
    strategy: "VA Negotiation",
    segment: "Gov",
    cells: [
      { value: "46%", color: "bg-chart-blue/50 text-chart-blue" },
      { value: "63%", color: "bg-chart-blue/60 text-chart-blue" },
      { value: "30%", color: "bg-chart-teal/45 text-chart-teal" },
      { value: "16%", color: "bg-chart-orange text-white" }
    ]
  }
];

interface StrategyMatrixProps {
  selectedCustomer?: Customer | null;
}

export const StrategyMatrix = ({ selectedCustomer }: StrategyMatrixProps) => {
  // If customer is selected, show their strategy effectiveness
  if (selectedCustomer?.codeStrategyMatrixCustomer) {
    const strategies = selectedCustomer.codeStrategyMatrixCustomer;
    
    return (
      <Card className="bg-card border-dashboard-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">
            CoDE Strategy - {selectedCustomer.name}
          </h3>
          <span className="text-[11px] text-muted-foreground">Customer View</span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(strategies).map(([strategy, effectiveness]) => (
            <div key={strategy} className="p-4 bg-muted/30 rounded-lg">
              <div className="text-xs text-muted-foreground mb-2">{strategy}</div>
              <div className={`text-2xl font-bold ${
                effectiveness > 70 ? 'text-success' :
                effectiveness > 50 ? 'text-kpi-light-blue' :
                'text-chart-orange'
              }`}>
                {effectiveness}%
              </div>
              <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${
                    effectiveness > 70 ? 'bg-success' :
                    effectiveness > 50 ? 'bg-kpi-light-blue' :
                    'bg-chart-orange'
                  }`}
                  style={{ width: `${effectiveness}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  // Portfolio overview (original view)
  return (
    <Card className="bg-dashboard-card border-dashboard-border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">CoDE Strategy</h3>
        <span className="text-[11px] text-muted-foreground">CoDE '23</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-dashboard-border">
              <th className="text-left py-3 px-3 text-muted-foreground font-normal text-xs">AI Risk</th>
              <th className="text-left py-3 px-3 text-muted-foreground font-normal text-xs">Segmentation</th>
              <th className="text-center py-3 px-3 text-muted-foreground font-normal text-xs">Government</th>
              <th className="text-center py-3 px-3 text-muted-foreground font-normal text-xs">Enterprise</th>
              <th className="text-center py-3 px-3 text-muted-foreground font-normal text-xs">SMB</th>
              <th className="text-center py-3 px-3 text-muted-foreground font-normal text-xs">Consumer</th>
            </tr>
          </thead>
          <tbody>
            {matrixData.map((row, idx) => (
              <tr key={idx} className="border-b border-dashboard-border/30">
                <td className="py-3 px-3 text-foreground text-sm">{row.strategy}</td>
                <td className="py-3 px-3 text-muted-foreground text-sm">{row.segment}</td>
                {row.cells.map((cell, cellIdx) => (
                  <td key={cellIdx} className="py-3 px-3">
                    <div className={` rounded-md px-3 py-2 text-center font-semibold text-sm`}>
                      {cell.value}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
