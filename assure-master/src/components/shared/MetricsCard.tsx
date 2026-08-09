import type { ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";

/**
 * A single headline figure with its icon and movement.
 *
 * Lives in shared/ because it is a dashboard building block, not part of any
 * one module's reporting.
 */
export interface MetricsCardProps {
  title: string;
  value: string;
  icon?: ReactNode;
  trend?: "up" | "down";
  trendValue?: string;
  variant?: "default" | "success" | "warning" | "destructive";
}

const accent: Record<NonNullable<MetricsCardProps["variant"]>, string> = {
  default: "border-border",
  success: "border-success/30 bg-success/[0.03]",
  warning: "border-warning/30 bg-warning/[0.03]",
  destructive: "border-destructive/30 bg-destructive/[0.03]",
};

export function MetricsCard({
  title,
  value,
  icon,
  trend,
  trendValue,
  variant = "default",
}: MetricsCardProps) {
  const Arrow = trend === "down" ? TrendingDown : TrendingUp;

  return (
    <Card className={`p-4 ${accent[variant]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-medium text-muted-foreground">{title}</div>
        {icon}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-foreground">
        {value}
      </div>
      {trendValue && (
        <div
          className={`mt-1 flex items-center gap-1 text-xs ${
            trend === "down" ? "text-destructive" : "text-success"
          }`}
        >
          {trend && <Arrow className="h-3 w-3" />}
          {trendValue}
        </div>
      )}
    </Card>
  );
}
