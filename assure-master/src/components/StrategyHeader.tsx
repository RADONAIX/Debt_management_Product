import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Target, Trash2, Download, Upload, LayoutGrid, Play, Save, Send, CheckCircle, History } from "lucide-react";

interface StrategyHeaderProps {
  targetAudience?: {
    segment: string;
    agingBucket: string;
    riskScoreMin: number;
    riskScoreMax: number;
    customerCount: number;
  } | null;
  onTargetAudienceClick: () => void;
  onClearConnections: () => void;
  onExport: () => void;
  onImport: () => void;
  onAutoLayout: () => void;
  onSimulate: () => void;
  onSaveDraft: () => void;
  onSubmitApproval: () => void;
  onPublish: () => void;
  onVersionHistory: () => void;
}

export const StrategyHeader = ({
  targetAudience,
  onTargetAudienceClick,
  onClearConnections,
  onExport,
  onImport,
  onAutoLayout,
  onSimulate,
  onSaveDraft,
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
              {targetAudience ? `${targetAudience.segment} ${targetAudience.agingBucket} AI Strategy` : "New Strategy"}
            </h2>
            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">Draft</Badge>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Workflow Actions */}
            <Button variant="ghost" size="sm" onClick={onTargetAudienceClick}>
              <Target className="h-4 w-4 mr-2" />
              Target Audience
            </Button>
            
            <Separator orientation="vertical" className="h-6" />
            
            <Button variant="ghost" size="sm" onClick={onClearConnections}>
              <Trash2 className="h-4 w-4 mr-2" />
              Clear
            </Button>
            
            <Button variant="ghost" size="sm" onClick={onExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            
            <Button variant="ghost" size="sm" onClick={onImport}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>
            
            <Button variant="ghost" size="sm" onClick={onAutoLayout}>
              <LayoutGrid className="h-4 w-4 mr-2" />
              Auto-Layout
            </Button>
            
            <Button variant="ghost" size="sm" onClick={onSimulate}>
              <Play className="h-4 w-4 mr-2" />
              Simulate
            </Button>
            
            <Separator orientation="vertical" className="h-6" />
            
            <Button variant="outline" size="sm" onClick={onSaveDraft}>
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
