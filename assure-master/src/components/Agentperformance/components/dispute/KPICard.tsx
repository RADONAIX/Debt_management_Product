import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: "up" | "down";
  iconColor?: string;
}

export const KPICard = ({ title, value, icon: Icon, trend, iconColor = "text-primary" }: KPICardProps) => {
  return (
    <Card className="p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground mb-1">{title}</p>
          <p className="text-3xl font-bold text-foreground">{value}</p>
        </div>
        <div className={`p-3 rounded-lg bg-muted ${iconColor}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      {trend && (
        <div className="mt-4 flex items-center text-xs">
          <span className={trend === "up" ? "text-success" : "text-destructive"}>
            {trend === "up" ? "↑" : "↓"}
          </span>
        </div>
      )}
    </Card>
  );
};
