import { Card } from "@/components/ui/card";
import { LineChart, Line, XAxis, ResponsiveContainer, Tooltip } from "recharts";
import { Customer } from "@/data/customerData";

const data = [
  { day: "Feb 6", actual: 320, target: 300 },
  { day: "", actual: 330, target: 305 },
  { day: "", actual: 340, target: 310 },
  { day: "14.6", actual: 360, target: 315 },
  { day: "", actual: 380, target: 320 },
  { day: "", actual: 400, target: 325 },
  { day: "61.8", actual: 420, target: 330 },
  { day: "", actual: 450, target: 335 },
  { day: "", actual: 480, target: 340 },
  { day: "", actual: 510, target: 345 },
  { day: "Feb 18", actual: 540, target: 350 }
];

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-dashboard-card border border-dashboard-border p-3 rounded-lg shadow-lg">
        <p className="text-xs text-muted-foreground mb-2">{payload[0].payload.day}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-sm">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-foreground capitalize">{entry.dataKey}:</span>
            <span className="font-semibold text-foreground">$ {entry.value}K</span>
          </div>
        ))}
        <p className="text-xs text-muted-foreground mt-2">
          Variance: {payload[0] && payload[1] 
            ? `${((payload[0].value - payload[1].value) / payload[1].value * 100).toFixed(1)}%`
            : "N/A"
          }
        </p>
      </div>
    );
  }
  return null;
};

interface TrendChartProps {
  selectedCustomer?: Customer | null;
}

export const TrendChart = ({ selectedCustomer }: TrendChartProps) => {
  const chartData = selectedCustomer?.dailyCollectionsTrendCustomer
    ? selectedCustomer.dailyCollectionsTrendCustomer.dates.map((date, idx) => ({
        day: date,
        actual: selectedCustomer.dailyCollectionsTrendCustomer!.actual[idx] * 1000,
        target: selectedCustomer.dailyCollectionsTrendCustomer!.target[idx] * 1000
      }))
    : data;

  return (
    <Card className="bg-card border-dashboard-border p-6 space-y-4">
      <h3 className="text-base font-semibold text-foreground">Daily Collections Trend</h3>

      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <XAxis 
              dataKey="day" 
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Line 
              type="monotone" 
              dataKey="actual" 
              stroke="hsl(var(--chart-cyan))" 
              strokeWidth={3}
              dot={false}
            />
            <Line 
              type="monotone" 
              dataKey="target" 
              stroke="hsl(var(--chart-blue))" 
              strokeWidth={2.5}
              dot={false}
              strokeDasharray="5 5"
              opacity={0.8}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex gap-6 text-[11px]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5 bg-chart-cyan rounded-full"></div>
          <span className="text-muted-foreground">Actual</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5 bg-chart-blue rounded-full opacity-80" style={{ backgroundImage: 'repeating-linear-gradient(90deg, hsl(var(--chart-blue)) 0, hsl(var(--chart-blue)) 4px, transparent 4px, transparent 8px)' }}></div>
          <span className="text-muted-foreground">Target</span>
        </div>
      </div>
    </Card>
  );
};
