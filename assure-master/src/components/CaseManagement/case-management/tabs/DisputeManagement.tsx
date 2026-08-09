import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dispute } from "@/data/mockCases";
import { AlertCircle, Clock, CheckCircle, XCircle, Upload } from "lucide-react";

interface DisputeManagementProps {
  disputes: Dispute[];
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'Submitted': return AlertCircle;
    case 'Under Review': return Clock;
    case 'Resolved': return CheckCircle;
    case 'Rejected': return XCircle;
    default: return AlertCircle;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Submitted': return 'bg-blue-500 text-white';
    case 'Under Review': return 'bg-yellow-500 text-white';
    case 'Resolved': return 'bg-green-500 text-white';
    case 'Rejected': return 'bg-red-500 text-white';
    default: return 'bg-muted';
  }
};

export const DisputeManagement = ({ disputes }: DisputeManagementProps) => {
  const calculateTimeRemaining = (deadline: string) => {
    const now = new Date();
    const end = new Date(deadline);
    const diff = end.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    return hours > 0 ? `${hours}h remaining` : 'Overdue';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Dispute Management</h3>
        <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
          <AlertCircle className="h-4 w-4" />
          Create Dispute
        </Button>
      </div>

      {disputes.length === 0 ? (
        <Card className="p-8">
          <div className="text-center space-y-2">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <h4 className="font-medium">No Active Disputes</h4>
            <p className="text-sm text-muted-foreground">This case has no disputes recorded</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {disputes.map((dispute) => {
            const StatusIcon = getStatusIcon(dispute.status);
            return (
              <Card key={dispute.id} className="p-4">
                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                        <StatusIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm">{dispute.reason}</h4>
                        <p className="text-xs text-muted-foreground">Created: {dispute.createdAt}</p>
                      </div>
                    </div>
                    <Badge className={getStatusColor(dispute.status)}>
                      {dispute.status}
                    </Badge>
                  </div>

                  {dispute.status === 'Under Review' && (
                    <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-950 rounded-md">
                      <Clock className="h-4 w-4 text-yellow-600" />
                      <span className="text-xs font-medium text-yellow-600">
                        SLA: {calculateTimeRemaining(dispute.slaDeadline)}
                      </span>
                    </div>
                  )}

                  <div>
                    <h5 className="text-xs font-semibold text-muted-foreground mb-2">Evidence</h5>
                    <div className="flex gap-2 flex-wrap">
                      {dispute.evidence.map((file, idx) => (
                        <div key={idx} className="flex items-center gap-1 px-3 py-1 bg-muted rounded-md text-xs">
                          <Upload className="h-3 w-3" />
                          {file}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline">View Details</Button>
                    {dispute.status === 'Under Review' && (
                      <>
                        <Button size="sm" variant="default">Resolve</Button>
                        <Button size="sm" variant="destructive">Reject</Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};
