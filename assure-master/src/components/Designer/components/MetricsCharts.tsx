import { Card } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";

const collectionData = [
  { month: "Jan", rate: 65, target: 70 },
  { month: "Feb", rate: 68, target: 70 },
  { month: "Mar", rate: 72, target: 70 },
  { month: "Apr", rate: 75, target: 75 },
  { month: "May", rate: 78, target: 75 },
  { month: "Jun", rate: 82, target: 80 },
];

const contactData = [
  { channel: "SMS", success: 85, attempts: 100 },
  { channel: "Email", success: 62, attempts: 100 },
  { channel: "WhatsApp", success: 78, attempts: 100 },
  { channel: "IVR", success: 45, attempts: 100 },
  { channel: "AI Dialer", success: 91, attempts: 100 },
];

const aiPredictionData = [
  { day: "Mon", predicted: 45, actual: 42 },
  { day: "Tue", predicted: 52, actual: 55 },
  { day: "Wed", predicted: 48, actual: 46 },
  { day: "Thu", predicted: 65, actual: 68 },
  { day: "Fri", predicted: 58, actual: 56 },
];

export const MetricsCharts = () => {
  return (
    <div className="space-y-6 p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Collection Rate Trends</h3>
        <Card className="bg-card border-border p-4">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={collectionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--card))", 
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px"
                }} 
              />
              <Legend />
              <Line type="monotone" dataKey="rate" stroke="hsl(var(--primary))" strokeWidth={2} name="Collection Rate %" />
              <Line type="monotone" dataKey="target" stroke="hsl(var(--success))" strokeWidth={2} strokeDasharray="5 5" name="Target %" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Contact Success by Channel</h3>
        <Card className="bg-card border-border p-4">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={contactData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="channel" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--card))", 
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px"
                }} 
              />
              <Legend />
              <Bar dataKey="success" fill="hsl(var(--primary))" name="Success Rate %" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">AI Prediction Accuracy</h3>
        <Card className="bg-card border-border p-4">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={aiPredictionData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--card))", 
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px"
                }} 
              />
              <Legend />
              <Area type="monotone" dataKey="predicted" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" name="AI Predicted" />
              <Area type="monotone" dataKey="actual" stroke="hsl(var(--success))" fill="hsl(var(--success) / 0.2)" name="Actual Results" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
};
