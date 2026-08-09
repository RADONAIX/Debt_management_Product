import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useState } from "react";
import { CheckCircle, XCircle, AlertCircle, TrendingUp, Users, Target } from "lucide-react";

interface ApprovalWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  strategyData: {
    name: string;
    segment: string;
    agingBucket: string;
    riskRange: string;
    customerCount: number;
    expectedUplift: number;
  };
  onApprove: () => void;
  onReject: (comments: string) => void;
  onRequestChanges: (comments: string) => void;
}

export const ApprovalWorkflowDialog = ({
  open,
  onOpenChange,
  strategyData,
  onApprove,
  onReject,
  onRequestChanges
}: ApprovalWorkflowDialogProps) => {
  const [comments, setComments] = useState("");
  const [action, setAction] = useState<"approve" | "reject" | "changes" | null>(null);

  const handleSubmit = () => {
    if (action === "approve") {
      onApprove();
    } else if (action === "reject" && comments.trim()) {
      onReject(comments);
    } else if (action === "changes" && comments.trim()) {
      onRequestChanges(comments);
    }
    setComments("");
    setAction(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            Strategy Approval Request
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-6 py-4">
            {/* Strategy Summary */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-foreground">Strategy Summary</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted/50 rounded-lg p-3">
                  <Label className="text-xs text-muted-foreground">Strategy Name</Label>
                  <p className="text-sm font-medium text-foreground mt-1">{strategyData.name}</p>
                </div>
                
                <div className="bg-muted/50 rounded-lg p-3">
                  <Label className="text-xs text-muted-foreground">Segment</Label>
                  <p className="text-sm font-medium text-foreground mt-1">{strategyData.segment}</p>
                </div>
                
                <div className="bg-muted/50 rounded-lg p-3">
                  <Label className="text-xs text-muted-foreground">Aging Bucket</Label>
                  <p className="text-sm font-medium text-foreground mt-1">{strategyData.agingBucket}</p>
                </div>
                
                <div className="bg-muted/50 rounded-lg p-3">
                  <Label className="text-xs text-muted-foreground">Risk Range</Label>
                  <p className="text-sm font-medium text-foreground mt-1">{strategyData.riskRange}</p>
                </div>
              </div>
            </div>

            <Separator />

            {/* Target Audience */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-foreground">Target Audience</h3>
              </div>
              
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <div className="text-3xl font-bold text-primary">{strategyData.customerCount.toLocaleString()}</div>
                <p className="text-sm text-muted-foreground mt-1">customers will be impacted</p>
              </div>
            </div>

            <Separator />

            {/* ML Predictions */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <h3 className="font-semibold text-foreground">Expected Impact</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-success/10 border border-success/20 rounded-lg p-3">
                  <Label className="text-xs text-muted-foreground">Expected Uplift</Label>
                  <div className="text-2xl font-bold text-success mt-1">+{strategyData.expectedUplift}%</div>
                </div>
                
                <div className="bg-info/10 border border-info/20 rounded-lg p-3">
                  <Label className="text-xs text-muted-foreground">Confidence</Label>
                  <div className="text-2xl font-bold text-info mt-1">87%</div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Simulated Outcomes */}
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">Simulated Outcomes</h3>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <span className="text-sm text-foreground">Predicted Contactability</span>
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20">+12%</Badge>
                </div>
                
                <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <span className="text-sm text-foreground">Expected PTP Success Rate</span>
                  <Badge variant="outline" className="bg-success/10 text-success border-success/20">68%</Badge>
                </div>
                
                <div className="flex items-center justify-between p-2 bg-muted/30 rounded">
                  <span className="text-sm text-foreground">Dispute Rate</span>
                  <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">-8%</Badge>
                </div>
              </div>
            </div>

            {/* Comments Section */}
            {action && action !== "approve" && (
              <div className="space-y-2 pt-4">
                <Label className="text-foreground">
                  {action === "reject" ? "Rejection Reason" : "Change Requests"}
                  <span className="text-destructive ml-1">*</span>
                </Label>
                <Textarea
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder={action === "reject" ? "Explain why this strategy is being rejected..." : "Describe the changes needed..."}
                  className="min-h-[100px] bg-background border-border"
                />
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="flex gap-2">
          {!action ? (
            <>
              <Button
                variant="outline"
                onClick={() => setAction("changes")}
                className="flex-1"
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                Request Changes
              </Button>
              <Button
                variant="destructive"
                onClick={() => setAction("reject")}
                className="flex-1"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
              <Button
                onClick={() => {
                  setAction("approve");
                  handleSubmit();
                }}
                className="flex-1"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve & Publish
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => { setAction(null); setComments(""); }}>
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!comments.trim()}
                variant={action === "reject" ? "destructive" : "default"}
              >
                Confirm {action === "reject" ? "Rejection" : "Changes"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
