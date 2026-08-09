import { TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  riskLevel?: "low" | "medium" | "high";
}

interface ExtendedKPICardProps extends KPICardProps {
  onClick?: () => void;
}

export const KPICard = ({ title, value, subtitle, trend, riskLevel, onClick }: ExtendedKPICardProps) => {
  return (
    <Card 
      className={`bg-dashboard-card border-dashboard-border p-3 space-y-1 ${onClick ? 'cursor-pointer hover:bg-dashboard-card/80 transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="text-muted-foreground text-[10px] font-normal tracking-wide">{title}</div>
      <div className="flex items-baseline gap-2">
        <div className="text-2xl font-bold text-kpi-light-blue tracking-tight">{value}</div>
        {riskLevel && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
            riskLevel === 'high' ? 'bg-warning/20 text-warning' :
            riskLevel === 'medium' ? 'bg-warning/20 text-warning' :
            'bg-success/20 text-success'
          }`}>
            ★ {riskLevel === 'high' ? 'High' : riskLevel === 'medium' ? 'Medium-high' : 'Low'}
          </span>
        )}
      </div>
      {subtitle && (
        <div className="text-muted-foreground text-[10px] pt-0.5">{subtitle}</div>
      )}
      {trend && (
        <div className={`flex items-center gap-1 text-[10px] pt-0.5 ${
          trend.isPositive ? 'text-success' : 'text-kpi-light-blue'
        }`}>
          {trend.isPositive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
          <span>{trend.value}</span>
        </div>
      )}
    </Card>
  );
};
