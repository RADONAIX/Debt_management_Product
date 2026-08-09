import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Clock, User, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useCaseManagement } from "../CaseManagementContext";

export const BottomBar = () => {
  const { selectedCase } = useCaseManagement();

  if (!selectedCase) return null;

  const calculateSLARemaining = (deadline: string) => {
    const now = new Date();
    const end = new Date(deadline);
    const diff = end.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const progress = Math.max(0, Math.min(100, (hours / 24) * 100));
    return { hours, progress };
  };

  const { hours, progress } = calculateSLARemaining(selectedCase.slaDeadline);

  const handleApplySuggestion = () => {
    toast.success('AI suggestion applied to case');
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-card/95 backdrop-blur-sm p-3 shadow-lg z-20">
      <div className="max-w-7xl mx-auto grid grid-cols-3 gap-4 items-center">
        {/* SLA Section */}
        <div className="flex items-center gap-3">
          <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold">{hours}h</span>
              <Badge variant={hours < 6 ? "destructive" : hours < 12 ? "default" : "secondary"} className="text-xs">
                {hours < 6 ? "Urgent" : hours < 12 ? "Attention" : "On Track"}
              </Badge>
            </div>
            <Progress value={progress} className="h-1" />
          </div>
        </div>

        {/* Agent Load Section */}
        <div className="flex items-center gap-3">
          <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold truncate">{selectedCase.assignedTo}</p>
            <p className="text-xs text-muted-foreground">22 cases</p>
          </div>
          <Button variant="outline" size="sm" className="flex-shrink-0">Reassign</Button>
        </div>

        {/* AI Suggestion Section */}
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary flex-shrink-0" />
          <p className="text-xs flex-1 truncate">
            Call via Dialer + 2-installment settlement
          </p>
          <Button size="sm" onClick={handleApplySuggestion} className="gap-1 flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/90">
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
};
