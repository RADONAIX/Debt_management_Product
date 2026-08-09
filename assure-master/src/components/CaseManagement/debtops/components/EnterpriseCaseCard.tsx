import { Eye, Phone, FileText, Building2, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface EnterpriseCaseCardProps {
  employeeName: string;
  companyName: string;
  ban: string;
  msisdn?: string;
  invoiceNo: string;
  caseCategory: string;
  amountDisputed: number;
  caseType: string;
  agentName?: string;
  onViewDetails: () => void;
}

export const EnterpriseCaseCard = ({
  employeeName,
  companyName,
  ban,
  msisdn,
  invoiceNo,
  caseCategory,
  amountDisputed,
  caseType,
  agentName,
  onViewDetails,
}: EnterpriseCaseCardProps) => {
  const getCaseTypeColor = (type: string) => {
    if (type.toLowerCase().includes('ban')) {
      return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    }
    return 'bg-green-500/10 text-green-500 border-green-500/20';
  };

  return (
    <Card className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-gradient-to-br from-green-50/50 to-orange-50/50 dark:from-green-950/20 dark:to-orange-950/20">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground font-medium">{companyName}</span>
            </div>
            <h3 className="font-semibold text-lg mb-1">{employeeName}</h3>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <span className="font-medium">BAN:</span>
                <span>{ban}</span>
              </div>
              {msisdn && (
                <div className="flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  <span>{msisdn}</span>
                </div>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onViewDetails}>
            <Eye className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Invoice</p>
            <div className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              <span className="text-sm font-medium">{invoiceNo}</span>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Case Type</p>
            <Badge className={getCaseTypeColor(caseType)}>{caseType}</Badge>
          </div>
        </div>

        {agentName && (
          <div className="mb-4 flex items-center gap-2 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Assigned to:</span>
            <span className="font-medium">{agentName}</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Case Category</p>
            <Badge variant="outline" className="text-xs">{caseCategory}</Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Amount Disputed</p>
            <p className="font-semibold text-sm">${amountDisputed.toLocaleString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
