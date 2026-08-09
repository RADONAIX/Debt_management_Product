import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, History, AlertCircle } from "lucide-react";
import { useCaseManagement } from "../CaseManagementContext";

export const CaseHeader = () => {
  const { selectedCase } = useCaseManagement();

  if (!selectedCase) return null;

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'bg-red-500 text-white';
      case 'Medium': return 'bg-yellow-500 text-white';
      case 'Low': return 'bg-green-500 text-white';
      default: return 'bg-muted';
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Critical': return 'bg-destructive text-destructive-foreground';
      case 'High': return 'bg-orange-500 text-white';
      case 'Medium': return 'bg-yellow-500 text-white';
      case 'Low': return 'bg-green-500 text-white';
      default: return 'bg-muted';
    }
  };

  return (
    <header className="mb-6 pb-4 border-b border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-foreground">{selectedCase.id}</h1>
          <Badge className={getPriorityColor(selectedCase.priority)}>
            {selectedCase.priority}
          </Badge>
          <Badge className={getRiskColor(selectedCase.riskLevel)}>
            {selectedCase.riskLevel}
          </Badge>
        </div>
        <Button size="sm" className="gap-2">
          <Plus className="h-3 w-3" />
          Add Note
        </Button>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>{selectedCase.aging} days aging</span>
        <span>•</span>
        <span>{selectedCase.strategy}</span>
        <span>•</span>
        <span>{selectedCase.dunningStage}</span>
      </div>
    </header>
  );
};
