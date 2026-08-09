import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface UpdateStatusDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (status: string, note: string) => void;
  currentStatus: string;
  disputeData: any;
}

export const UpdateStatusDialog = ({ open, onOpenChange, onSubmit, currentStatus, disputeData }: UpdateStatusDialogProps) => {
  const [status, setStatus] = useState(currentStatus);
  const [note, setNote] = useState("");
  const [aiInsight, setAiInsight] = useState<string | null>(null);

  const handleAIInsight = () => {
    // AI analyzes dispute and suggests next status
    const insights: Record<string, string> = {
      "OPEN": "Based on the dispute type and timeline, consider moving to INVESTIGATING status to begin formal review.",
      "INVESTIGATING": "Evidence gathered. Recommend ESCALATED if complex, or RESOLVED if clear resolution path exists.",
      "ESCALATED": "High-priority case. If resolved, update to RESOLVED. If pending customer response, keep ESCALATED.",
      "RESOLVED": "Dispute already resolved. Consider reopening if new information surfaces."
    };

    const insight = insights[currentStatus] || "AI suggests careful review before status change.";
    setAiInsight(insight);
    
    // Auto-suggest next logical status
    if (currentStatus === "OPEN") setStatus("INVESTIGATING");
    else if (currentStatus === "INVESTIGATING") {
      setStatus(disputeData?.priority === "HIGH" ? "ESCALATED" : "RESOLVED");
    }
    
    toast.success("AI insight generated");
  };

  const handleSubmit = () => {
    if (!status) {
      toast.error("Please select a status");
      return;
    }

    onSubmit(status, note || `Status updated to ${status}`);
    toast.success(`Status updated to ${status}`);
    onOpenChange(false);
    setStatus(currentStatus);
    setNote("");
    setAiInsight(null);
  };

  const getStatusColor = (s: string) => {
    switch(s) {
      case "OPEN": return "bg-blue-100 text-blue-800";
      case "INVESTIGATING": return "bg-yellow-100 text-yellow-800";
      case "ESCALATED": return "bg-red-100 text-red-800";
      case "RESOLVED": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Update Status</DialogTitle>
          <DialogDescription>
            Current status: <Badge className={getStatusColor(currentStatus)}>{currentStatus}</Badge>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={handleAIInsight}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            AI Status Recommendation
          </Button>

          {aiInsight && (
            <div className="bg-primary/5 border border-primary/20 p-3 rounded-lg text-sm">
              <p className="font-semibold text-primary mb-1">AI Insight:</p>
              <p>{aiInsight}</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="status">New Status *</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OPEN">Open</SelectItem>
                <SelectItem value="INVESTIGATING">Investigating</SelectItem>
                <SelectItem value="ESCALATED">Escalated</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="note">Note (optional)</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add context for this status change..."
              rows={3}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="flex-1">
            Update Status
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
