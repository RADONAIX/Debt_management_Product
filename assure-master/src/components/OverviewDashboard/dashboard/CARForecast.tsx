import { Card } from "@/components/ui/card";
import { Customer } from "@/data/customerData";

interface CARForecastProps {
  selectedCustomer?: Customer | null;
}

export const CARForecast = ({ selectedCustomer }: CARForecastProps) => {
  const formatAmount = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
    return amount.toString();
  };

  const forecast7Days = selectedCustomer?.carForecastIndividual?.next7Days 
    ? formatAmount(selectedCustomer.carForecastIndividual.next7Days)
    : "24M";
  
  const forecast30Days = selectedCustomer?.carForecastIndividual?.next30Days
    ? formatAmount(selectedCustomer.carForecastIndividual.next30Days)
    : "121M";
  
  const confidence = selectedCustomer?.carForecastIndividual?.confidence;

  return (
    <Card className="bg-dashboard-card border-dashboard-border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">CAR Forecast</h3>
        {confidence && (
          <span className={`text-xs px-2 py-1 rounded ${
            confidence === "Very High" ? 'bg-success/20 text-success' :
            confidence === "High" ? 'bg-success/15 text-success' :
            confidence === "Medium-High" ? 'bg-chart-orange/20 text-chart-orange' :
            'bg-warning/20 text-warning'
          }`}>
            {confidence}
          </span>
        )}
      </div>
      
      <div className="space-y-4">
        <div>
          <div className="text-xs text-muted-foreground mb-1.5">Next 7 Days</div>
          <div className="text-3xl font-bold text-kpi-light-blue">$ {forecast7Days}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground mb-1.5">Next 30 Days</div>
          <div className="text-3xl font-bold text-kpi-light-blue">$ {forecast30Days}</div>
        </div>
      </div>
    </Card>
  );
};
