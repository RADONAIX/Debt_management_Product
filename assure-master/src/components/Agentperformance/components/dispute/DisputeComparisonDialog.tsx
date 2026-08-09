import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Users, TrendingUp, Calendar, DollarSign } from "lucide-react";
import { Dispute } from "@/types/dispute";
import { useState } from "react";
import { toast } from "sonner";

interface DisputeComparisonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  disputes: Dispute[];
  onBulkStatusUpdate: (disputeIds: string[], status: string) => void;
  onBulkReassign: (disputeIds: string[], agent: string) => void;
  onRemoveFromComparison: (disputeId: string) => void;
}

const statusOptions = [
  { value: "OPEN", label: "Open", color: "bg-blue-500" },
  { value: "INVESTIGATING", label: "Investigating", color: "bg-yellow-500" },
  { value: "ESCALATED", label: "Escalated", color: "bg-orange-500" },
  { value: "RESOLVED", label: "Resolved", color: "bg-green-500" }
];

const priorityColors = {
  LOW: "bg-blue-500",
  MEDIUM: "bg-yellow-500",
  HIGH: "bg-red-500"
};

const agents = ["Sarah Chen", "Mike Johnson", "Emily Rodriguez", "David Kim", "Lisa Anderson"];

export const DisputeComparisonDialog = ({
  open,
  onOpenChange,
  disputes,
  onBulkStatusUpdate,
  onBulkReassign,
  onRemoveFromComparison
}: DisputeComparisonDialogProps) => {
  const [bulkStatus, setBulkStatus] = useState<string>("");
  const [bulkAgent, setBulkAgent] = useState<string>("");

  const handleBulkStatusUpdate = () => {
    if (!bulkStatus) {
      toast.error("Please select a status");
      return;
    }
    const disputeIds = disputes.map(d => d.id);
    onBulkStatusUpdate(disputeIds, bulkStatus);
    toast.success(`Updated ${disputes.length} disputes to ${bulkStatus}`);
    setBulkStatus("");
  };

  const handleBulkReassign = () => {
    if (!bulkAgent) {
      toast.error("Please select an agent");
      return;
    }
    const disputeIds = disputes.map(d => d.id);
    onBulkReassign(disputeIds, bulkAgent);
    toast.success(`Reassigned ${disputes.length} disputes to ${bulkAgent}`);
    setBulkAgent("");
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "OPEN": return "default";
      case "INVESTIGATING": return "secondary";
      case "ESCALATED": return "destructive";
      case "RESOLVED": return "outline";
      default: return "default";
    }
  };

  const getPriorityBadgeVariant = (priority: string) => {
    switch (priority) {
      case "HIGH": return "destructive";
      case "MEDIUM": return "secondary";
      case "LOW": return "default";
      default: return "default";
    }
  };

  const totalAmount = disputes.reduce((sum, d) => sum + d.amount, 0);
  const avgAmount = disputes.length > 0 ? totalAmount / disputes.length : 0;
  const statusBreakdown = disputes.reduce((acc, d) => {
    acc[d.status] = (acc[d.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            Compare Disputes ({disputes.length})
          </DialogTitle>
          <DialogDescription>
            Analyze multiple disputes side-by-side and perform bulk actions
          </DialogDescription>
        </DialogHeader>

        {disputes.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <p>No disputes selected for comparison</p>
            <p className="text-sm mt-2">Select disputes from the list to compare them</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                </div>
                <p className="text-2xl font-bold">${totalAmount.toLocaleString()}</p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Avg Amount</p>
                </div>
                <p className="text-2xl font-bold">${avgAmount.toLocaleString()}</p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Disputes</p>
                </div>
                <p className="text-2xl font-bold">{disputes.length}</p>
              </Card>
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Status</p>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {Object.entries(statusBreakdown).map(([status, count]) => (
                    <Badge key={status} variant="outline" className="text-xs">
                      {status}: {count}
                    </Badge>
                  ))}
                </div>
              </Card>
            </div>

            <Separator />

            {/* Bulk Actions */}
            <Card className="p-4 bg-muted/30">
              <h3 className="text-sm font-semibold mb-3">Bulk Actions</h3>
              <div className="flex flex-wrap gap-3">
                <div className="flex gap-2 items-center">
                  <Select value={bulkStatus} onValueChange={setBulkStatus}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Update Status" />
                    </SelectTrigger>
                    <SelectContent>
                      {statusOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleBulkStatusUpdate} size="sm">Apply</Button>
                </div>

                <div className="flex gap-2 items-center">
                  <Select value={bulkAgent} onValueChange={setBulkAgent}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Reassign To" />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map(agent => (
                        <SelectItem key={agent} value={agent}>
                          {agent}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleBulkReassign} size="sm" variant="outline">Apply</Button>
                </div>
              </div>
            </Card>

            <Separator />

            {/* Dispute Comparison Grid */}
            <ScrollArea className="h-[500px]">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-1">
                {disputes.map((dispute) => (
                  <Card key={dispute.id} className="p-4 relative">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={() => onRemoveFromComparison(dispute.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>

                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={getStatusBadgeVariant(dispute.status)} className="text-xs">
                            {dispute.status}
                          </Badge>
                          <Badge variant={getPriorityBadgeVariant(dispute.priority)} className="text-xs">
                            {dispute.priority}
                          </Badge>
                        </div>
                        <h4 className="font-semibold text-sm">{dispute.id}</h4>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div>
                          <p className="text-muted-foreground text-xs">Customer</p>
                          <p className="font-medium">{dispute.customerName}</p>
                        </div>

                        <div>
                          <p className="text-muted-foreground text-xs">Type</p>
                          <p>{dispute.type}</p>
                        </div>

                        <div>
                          <p className="text-muted-foreground text-xs">Amount</p>
                          <p className="font-semibold text-primary">${dispute.amount.toLocaleString()}</p>
                        </div>

                        <div>
                          <p className="text-muted-foreground text-xs">Assigned To</p>
                          <p>{dispute.assignedTo}</p>
                        </div>

                        <div>
                          <p className="text-muted-foreground text-xs">Date Raised</p>
                          <p>{dispute.dateRaised}</p>
                        </div>

                        <div>
                          <p className="text-muted-foreground text-xs">Description</p>
                          <p className="text-xs line-clamp-2">{dispute.description}</p>
                        </div>

                        <div>
                          <p className="text-muted-foreground text-xs">Timeline Events</p>
                          <p className="font-medium">{dispute.timeline.length} events</p>
                        </div>

                        <div>
                          <p className="text-muted-foreground text-xs">Attachments</p>
                          <p className="font-medium">{dispute.attachments.length} files</p>
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </ScrollArea>

            <Separator />

            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)} variant="outline">
                Close Comparison
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
