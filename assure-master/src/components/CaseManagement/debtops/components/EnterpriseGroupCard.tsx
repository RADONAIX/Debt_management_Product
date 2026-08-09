import { Eye, Building2, Users, DollarSign, AlertCircle, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface EnterpriseGroupCardProps {
  enterpriseGroup: string;
  enterpriseAccount: string;
  enterpriseSubaccount: string;
  site: string;
  ban: string;
  totalUsers: number;
  totalOutstanding: number;
  totalPaid: number;
  totalDisputed: number;
  avgRiskScore: number;
  avgDaysPastDue: number;
  onViewDetails: () => void;
}

export const EnterpriseGroupCard = ({
  enterpriseGroup,
  enterpriseAccount,
  enterpriseSubaccount,
  site,
  ban,
  totalUsers,
  totalOutstanding,
  totalPaid,
  totalDisputed,
  avgRiskScore,
  avgDaysPastDue,
  onViewDetails,
}: EnterpriseGroupCardProps) => {
  const getRiskColor = (score: number) => {
    if (score >= 70) return 'text-red-500';
    if (score >= 40) return 'text-yellow-500';
    return 'text-green-500';
  };

  return (
    <Card className="border-l-4 border-l-orange-500 hover:shadow-lg transition-shadow bg-gradient-to-br from-orange-50/30 to-green-50/30 dark:from-orange-950/20 dark:to-green-950/20">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-5 w-5 text-orange-500" />
              <h3 className="font-bold text-xl">{enterpriseGroup}</h3>
            </div>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="font-medium">Account:</span>
                <span>{enterpriseAccount}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Subaccount:</span>
                <span>{enterpriseSubaccount}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">Site:</span>
                <span>{site}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">BAN:</span>
                <Badge variant="outline" className="text-xs">{ban}</Badge>
              </div>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onViewDetails}>
            <Eye className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid grid-cols-4 gap-4 pt-4 border-t">
          <div>
            <div className="flex items-center gap-1 mb-1">
              <Users className="h-3 w-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Users</p>
            </div>
            <p className="font-bold text-lg">{totalUsers}</p>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <DollarSign className="h-3 w-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Outstanding</p>
            </div>
            <p className="font-bold text-lg text-red-500">${totalOutstanding.toLocaleString()}</p>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <TrendingUp className="h-3 w-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Paid</p>
            </div>
            <p className="font-bold text-lg text-green-500">${totalPaid.toLocaleString()}</p>
          </div>
          <div>
            <div className="flex items-center gap-1 mb-1">
              <AlertCircle className="h-3 w-3 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">Disputed</p>
            </div>
            <p className="font-bold text-lg text-orange-500">${totalDisputed.toLocaleString()}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Avg Risk Score</p>
            <div className="flex items-center gap-1">
              <AlertCircle className={`h-4 w-4 ${getRiskColor(avgRiskScore)}`} />
              <p className={`font-semibold ${getRiskColor(avgRiskScore)}`}>{avgRiskScore.toFixed(1)}</p>
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Avg Days Past Due</p>
            <p className="font-semibold">{avgDaysPastDue.toFixed(0)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
