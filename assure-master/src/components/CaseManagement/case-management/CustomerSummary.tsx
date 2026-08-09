import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Calendar } from "lucide-react";
import { useCaseManagement } from "../CaseManagementContext";

export const CustomerSummary = () => {
  const { selectedCase } = useCaseManagement();

  if (!selectedCase) return null;

  return (
    <Card className="p-4 mb-4 shadow-sm border-border">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-lg font-semibold text-foreground truncate">{selectedCase.customerName}</h2>
            <Badge variant="outline" className="text-xs">{selectedCase.segment}</Badge>
          </div>
          <p className="text-2xl font-bold text-primary mb-2">
            {selectedCase.currency} {selectedCase.amount.toLocaleString()}
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>Last payment: {selectedCase.lastPaymentDate}</span>
            <span>Contactability: {selectedCase.contactability}%</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground mb-1">Predicted Payment</div>
          <p className="text-lg font-bold text-green-600">
            {selectedCase.currency} {selectedCase.predictedPayment.toLocaleString()}
          </p>
        </div>
      </div>
    </Card>
  );
};
