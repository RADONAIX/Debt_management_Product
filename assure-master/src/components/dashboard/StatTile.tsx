import type { ReactNode } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { Delta } from "@/data/portfolioStore";

/**
 * Delta chip. The arrow shows direction of movement; the colour shows whether
 * that movement is good, which is not the same thing — a falling cost-to-collect
 * is a down arrow in success green.
 */
export function DeltaChip({ delta }: { delta: Delta }) {
  const rising = delta.value > 0;
  const good = rising === delta.higherIsBetter;
  const Icon = rising ? ArrowUp : ArrowDown;
  const magnitude = Math.abs(delta.value);

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        good ? "text-success" : "text-destructive"
      }`}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {magnitude}
      {delta.unit === "pp" ? "pp" : "%"}
      <span className="text-muted-foreground font-normal">{delta.label}</span>
    </span>
  );
}

interface StatTileProps {
  label: string;
  value: string;
  /** Small qualifier under the value, e.g. "of $1.2M target". */
  caption?: string;
  delta?: Delta;
  /** Emphasised tile — used for the headline exposure figures. */
  emphasis?: boolean;
  /** Draws attention without shouting; for the metric carrying bad news. */
  tone?: "default" | "critical";
  icon?: ReactNode;
  footer?: ReactNode;
}

export function StatTile({
  label,
  value,
  caption,
  delta,
  emphasis = false,
  tone = "default",
  icon,
  footer,
}: StatTileProps) {
  return (
    <Card
      className={`p-4 flex flex-col gap-2 ${
        tone === "critical" ? "border-destructive/30 bg-destructive/[0.03]" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground leading-tight">{label}</span>
        {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
      </div>

      <div
        className={`font-semibold tracking-tight tabular-nums text-foreground ${
          emphasis ? "text-3xl" : "text-2xl"
        }`}
      >
        {value}
      </div>

      {caption && <div className="text-xs text-muted-foreground -mt-1">{caption}</div>}
      {delta && <DeltaChip delta={delta} />}
      {footer}
    </Card>
  );
}
