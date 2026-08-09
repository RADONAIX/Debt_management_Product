import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { Customer } from "@/data/customerData";

const alerts = [
  "High-risk surge in SMB+ (60-bucket)",
  "Payment failure spike",
  "Dispute queue growing",
  "Dialer contactability drop"
];

const drivers = [
  "Delayed payments in Enterprise (31%)",
  "Invoice disparities (19%)",
  "Low contactability (29%)"
];

interface AlertsSectionProps {
  selectedCustomer?: Customer | null;
}

export const AlertsSection = ({ selectedCustomer }: AlertsSectionProps) => {
  const displayAlerts = selectedCustomer?.alertsAndExceptionsCustomer || alerts;
  const displayDrivers = selectedCustomer?.majorRiskDriversCustomer 
    ? Object.entries(selectedCustomer.majorRiskDriversCustomer).map(([key, value]) => 
        `${key.replace(/([A-Z])/g, ' $1').trim()}: ${value}%`
      )
    : drivers;

  return (
    <div className="space-y-4">
      <Card className="bg-dashboard-card bg-card border-dashboard-border p-6 space-y-4">
        <h3 className="text-base font-semibold text-foreground">Alerts & Exceptions</h3>
        <ul className="space-y-2.5">
          {displayAlerts.map((alert, idx) => (
            <li key={idx} className="flex items-start gap-2 text-xs leading-relaxed">
              <span className="text-warning mt-0.5">•</span>
              <span className="text-muted-foreground">{alert}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="bg-dashboard-card bg-card border-dashboard-border p-6 space-y-4">
        <h3 className="text-base font-semibold text-foreground">Major risk drivers</h3>
        <ul className="space-y-2.5">
          {displayDrivers.map((driver, idx) => (
            <li key={idx} className="flex items-start gap-2 text-xs leading-relaxed">
              <span className="text-chart-orange mt-0.5">•</span>
              <span className="text-muted-foreground">{driver}</span>
            </li>
          ))}
        </ul>
        
        <div className="pt-3 border-t border-dashboard-border">
          <div className="text-xs text-muted-foreground leading-relaxed">
            <div className="font-medium text-foreground mb-1">Potential Collection Lift Strategy</div>
            <div>AI / 17-strategy / Re:morv</div>
          </div>
        </div>
      </Card>
    </div>
  );
};
