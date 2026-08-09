import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { History, User, Calendar, CheckCircle, XCircle, AlertCircle, Download } from "lucide-react";

interface VersionHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const versionHistory = [
  {
    version: "v1.3",
    date: "2025-11-14 14:30",
    author: "Sarah Ahmed",
    action: "Published",
    status: "published",
    changes: "Added AI PTP Probability node and updated risk scoring logic"
  },
  {
    version: "v1.2",
    date: "2025-11-13 16:45",
    author: "Ahmed Khan",
    action: "Approved",
    status: "approved",
    changes: "Modified dialer time optimization and VA routing"
  },
  {
    version: "v1.1",
    date: "2025-11-12 11:20",
    author: "Sarah Ahmed",
    action: "Changes Requested",
    status: "changes",
    changes: "Requested adjustment to dispute classification threshold"
  },
  {
    version: "v1.0",
    date: "2025-11-10 09:15",
    author: "Sarah Ahmed",
    action: "Draft Created",
    status: "draft",
    changes: "Initial strategy created with AI nodes and channel configuration"
  }
];

export const VersionHistoryDialog = ({ open, onOpenChange }: VersionHistoryDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Version History
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4 py-4">
            {versionHistory.map((version, index) => (
              <div key={version.version}>
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 mt-1">
                    {version.status === "published" && (
                      <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-success" />
                      </div>
                    )}
                    {version.status === "approved" && (
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <CheckCircle className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    {version.status === "changes" && (
                      <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
                        <AlertCircle className="h-5 w-5 text-warning" />
                      </div>
                    )}
                    {version.status === "draft" && (
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <History className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-foreground">{version.version}</span>
                      <Badge
                        variant="outline"
                        className={
                          version.status === "published"
                            ? "bg-success/10 text-success border-success/20"
                            : version.status === "approved"
                            ? "bg-primary/10 text-primary border-primary/20"
                            : version.status === "changes"
                            ? "bg-warning/10 text-warning border-warning/20"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {version.action}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>{version.author}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        <span>{version.date}</span>
                      </div>
                    </div>

                    <p className="text-sm text-foreground">{version.changes}</p>

                    <div className="flex gap-2 mt-3">
                      <Button variant="outline" size="sm">
                        <Download className="h-3 w-3 mr-2" />
                        Export
                      </Button>
                      {version.status === "published" && (
                        <Button variant="outline" size="sm">
                          Restore
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                
                {index < versionHistory.length - 1 && (
                  <Separator className="my-4" />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
