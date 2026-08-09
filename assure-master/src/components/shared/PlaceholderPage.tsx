import { Card } from "@/components/ui/card";
import { Construction, type LucideIcon } from "lucide-react";

/**
 * Stands in for a sidebar module that has no screen yet, so the navigation is
 * complete and nothing dead-ends on a blank pane.
 */
export const PlaceholderPage = ({
  title,
  description,
  icon: Icon = Construction,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
}) => (
  <Card className="p-12 flex flex-col items-center justify-center text-center min-h-[420px] gap-3">
    <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
      <Icon className="h-7 w-7 text-primary" />
    </div>
    <h2 className="text-lg font-semibold text-foreground">{title}</h2>
    <p className="text-sm text-muted-foreground max-w-md">
      {description ?? "This workspace has not been built yet."}
    </p>
  </Card>
);

export default PlaceholderPage;
