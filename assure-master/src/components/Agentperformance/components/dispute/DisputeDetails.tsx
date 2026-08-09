import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Sparkles } from "lucide-react";
import { Dispute } from "@/types/dispute";

interface DisputeDetailsProps {
  dispute: Dispute | null;
  onAIReconcile: () => void;
  onAddNote: () => void;
  onReassign: () => void;
  onUpdateStatus: () => void;
}

export const DisputeDetails = ({ dispute, onAIReconcile, onAddNote, onReassign, onUpdateStatus }: DisputeDetailsProps) => {
  if (!dispute) {
    return (
      <Card className="flex items-center justify-center p-12">
        <p className="text-muted-foreground">Select a dispute to view details</p>
      </Card>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "INVESTIGATING":
        return "bg-info text-info-foreground";
      case "ESCALATED":
        return "bg-destructive text-destructive-foreground";
      case "RESOLVED":
        return "bg-success text-success-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "HIGH":
        return "bg-destructive text-destructive-foreground";
      case "MEDIUM":
        return "bg-info text-info-foreground";
      case "LOW":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <Card>
      <div className="p-6 border-b">
        <h2 className="text-xl font-semibold mb-1">Dispute Details</h2>
        <p className="text-sm text-muted-foreground">Details for {dispute.id}</p>
      </div>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Dispute ID</p>
            <p className="font-semibold">{dispute.id}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Customer</p>
            <p className="font-semibold">{dispute.customerName}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Type</p>
            <p className="font-semibold">{dispute.type}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Amount</p>
            <p className="font-semibold text-destructive">${dispute.amount}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Status</p>
            <Badge className={getStatusColor(dispute.status)}>{dispute.status}</Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Priority</p>
            <Badge className={getPriorityColor(dispute.priority)}>{dispute.priority}</Badge>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Assigned To</p>
            <p className="font-semibold">{dispute.assignedTo}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">Date Raised</p>
            <p className="font-semibold">{dispute.dateRaised}</p>
          </div>
        </div>

        <Separator />

        <div>
          <p className="text-sm text-muted-foreground mb-2">Description</p>
          <p className="text-sm">{dispute.description}</p>
        </div>

        <Separator />

        <div>
          <p className="text-sm font-semibold mb-4">Timeline</p>
          <div className="space-y-4">
            {dispute.timeline.map((event) => (
              <div key={event.id} className="relative pl-6 border-l-2 border-muted pb-4 last:pb-0">
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-primary" />
                <div className="flex items-start justify-between mb-1">
                  <p className="font-semibold text-sm">{event.title}</p>
                  <p className="text-xs text-muted-foreground">{event.date}</p>
                </div>
                <p className="text-xs text-muted-foreground mb-1">by {event.by}</p>
                <p className="text-sm">{event.note}</p>
              </div>
            ))}
          </div>
        </div>

        {dispute.attachments.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-sm font-semibold mb-3">Attachments</p>
              <div className="space-y-2">
                {dispute.attachments.map((attachment, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm flex-1">{attachment.name}</span>
                    <Badge variant="outline">{attachment.type}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <Separator />

        <div className="space-y-3">
          <Button onClick={onAIReconcile} className="w-full bg-primary text-primary-foreground hover:bg-primary/90" size="lg">
            <Sparkles className="w-4 h-4 mr-2" />
            Reconcile RPA
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" onClick={onAddNote}>Add Note</Button>
            <Button variant="outline" className="flex-1" onClick={onReassign}>Reassign</Button>
            <Button variant="outline" className="flex-1" onClick={onUpdateStatus}>Update Status</Button>
          </div>
        </div>
      </div>
    </Card>
  );
};
