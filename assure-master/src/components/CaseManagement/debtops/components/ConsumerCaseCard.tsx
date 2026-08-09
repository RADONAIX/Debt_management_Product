import { Eye, Phone, FileText, AlertCircle, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ConsumerCaseCardProps {
  customerName: string;
  msisdn: string;
  invoiceNo: string;
  caseCategory: string;
  amountDisputed: number;
  riskScore: number;
  daysPastDue: number;
  status: string;
  agentName?: string;
  onViewDetails: () => void;
}

export const ConsumerCaseCard = ({
  customerName,
  msisdn,
  invoiceNo,
  caseCategory,
  amountDisputed,
  riskScore,
  daysPastDue,
  status,
  agentName,
  onViewDetails,
}: ConsumerCaseCardProps) => {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'open':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'in progress':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'closed':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 70) return 'text-red-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <Card className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-950/20 dark:to-purple-950/20">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-1">{customerName}</h3>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Phone className="h-3 w-3" />
                <span>{msisdn}</span>
              </div>
              <div className="flex items-center gap-1">
                <FileText className="h-3 w-3" />
                <span>{invoiceNo}</span>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onViewDetails}>
            <Eye className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Case Category</p>
            <Badge variant="outline" className="text-xs">
              {caseCategory}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Status</p>
            <Badge className={getStatusColor(status)}>{status}</Badge>
          </div>
        </div>

        {agentName && (
          <div className="mb-4 flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Assigned to:</span>
            <span className="font-medium">{agentName}</span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 pt-4 border-t">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Amount Disputed</p>
            <p className="font-semibold text-sm">${amountDisputed.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Risk Score</p>
            <div className="flex items-center gap-1">
              <AlertCircle className={`h-3 w-3 ${getRiskColor(riskScore)}`} />
              <p className={`font-semibold text-sm ${getRiskColor(riskScore)}`}>{riskScore}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Days Past Due</p>
            <p className="font-semibold text-sm">{daysPastDue}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
