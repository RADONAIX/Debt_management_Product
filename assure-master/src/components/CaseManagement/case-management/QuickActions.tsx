import { Button } from "@/components/ui/button";
import { Phone, Link as LinkIcon, Calendar, AlertCircle, CheckCircle, ArrowUpCircle } from "lucide-react";
import { toast } from "sonner";

const actions = [
  { label: "Trigger Dialer", icon: Phone, variant: "outline" as const },
  { label: "Send Payment Link", icon: LinkIcon, variant: "outline" as const },
  { label: "Add PTP", icon: Calendar, variant: "secondary" as const },
  { label: "Dispute Case", icon: AlertCircle, variant: "outline" as const },
  { label: "Close Case", icon: CheckCircle, variant: "outline" as const },
  { label: "Escalate to Agency", icon: ArrowUpCircle, variant: "destructive" as const },
];

export const QuickActions = () => {
  const handleAction = (label: string) => {
    toast.success(`${label} action triggered`);
  };

  return (
    <div className="mb-4">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <Button
              key={action.label}
              size="sm"
              className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => handleAction(action.label)}
            >
              <Icon className="h-3 w-3" />
              {action.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
};
