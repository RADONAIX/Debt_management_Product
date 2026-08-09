import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Target, Save, Send, CheckCircle, History } from "lucide-react";

interface StrategyHeaderProps {
  targetAudience?: {
    segment: string;
    agingBucket: string;
    riskScoreMin: number;
    riskScoreMax: number;
    customerCount: number;
  } | null;
  onTargetAudienceClick: () => void;
  /** Real strategy name + status, so the header matches the library row. */
  strategyName?: string;
  strategyStatus?: string;
  onSaveDraft: () => void;
  /** False when the signed-in role cannot edit strategies. */
  canEdit?: boolean;
  onSubmitApproval: () => void;
  onPublish: () => void;
  onVersionHistory: () => void;
}

export const StrategyHeader = ({
  targetAudience,
  onTargetAudienceClick,
  strategyName,
  strategyStatus = "Draft",
  onSaveDraft,
  canEdit = true,
  onSubmitApproval,
  onPublish,
  onVersionHistory
}: StrategyHeaderProps) => {
  return (
    <div className="border-b border-border bg-card">
      {/* Target Audience Tag */}
      {targetAudience && (
        <div className="px-6 py-2 bg-primary/5 border-b border-primary/10">
          <div className="flex items-center gap-2 text-sm">
            <Target className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">Target:</span>
            <Badge variant="outline" className="bg-background">
              {targetAudience.segment}
            </Badge>
            <Separator orientation="vertical" className="h-4" />
            <Badge variant="outline" className="bg-background">
              {targetAudience.agingBucket} Days
            </Badge>
            <Separator orientation="vertical" className="h-4" />
            <Badge variant="outline" className="bg-background">
              {targetAudience.riskScoreMin}-{targetAudience.riskScoreMax} Risk
            </Badge>
            <Separator orientation="vertical" className="h-4" />
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              {targetAudience.customerCount.toLocaleString()} Customers
            </Badge>
          </div>
        </div>
      )}

      {/* Main Header */}
      <div className="px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-foreground">
              {strategyName ??
                (targetAudience
                  ? `${targetAudience.segment} ${targetAudience.agingBucket} AI Strategy`
                  : "New Strategy")}
            </h2>
            <Badge
              variant="outline"
              className={
                strategyStatus === "Active"
                  ? "bg-success/10 text-success border-success/20"
                  : strategyStatus === "Published"
                    ? "bg-primary/10 text-primary border-primary/20"
                    : "bg-warning/10 text-warning border-warning/20"
              }
            >
              {strategyStatus}
            </Badge>
            {!canEdit && (
              <Badge
                variant="outline"
                className="bg-muted text-muted-foreground border-border"
                title="Your role has no Strategy Designer edit permission"
              >
                Read-only
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {/* Workflow Actions */}
            <Button variant="ghost" size="sm" onClick={onTargetAudienceClick}>
              <Target className="h-4 w-4 mr-2" />
              Target Audience
            </Button>
            
            <Separator orientation="vertical" className="h-6" />
            
            <Button
              variant="outline"
              size="sm"
              onClick={onSaveDraft}
              disabled={!canEdit}
              title={
                canEdit
                  ? undefined
                  : "Your role has no Strategy Designer edit permission — ask an administrator in Role Management"
              }
            >
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
            
            <Button variant="outline" size="sm" onClick={onSubmitApproval}>
              <Send className="h-4 w-4 mr-2" />
              Submit for Approval
            </Button>
            
            <Button size="sm" onClick={onPublish}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Publish
            </Button>
            
            <Button variant="ghost" size="sm" onClick={onVersionHistory}>
              <History className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
