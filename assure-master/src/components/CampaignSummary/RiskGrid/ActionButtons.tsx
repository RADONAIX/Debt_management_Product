import { Button } from "@/components/ui/button";
import { PlayCircle, Phone, Building2, Download, FolderOpen } from "lucide-react";
import { toast } from "sonner";

export const ActionButtons = () => {
  const handleAction = (action: string) => {
    toast.success(`${action} initiated`, {
      description: "Processing your request...",
    });
  };

  return (
    <div className="flex flex-wrap gap-3">
      {/* <Button
        onClick={() => handleAction("CoDE Strategy")}
        className="flex-1 min-w-[180px] bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg"
      >
        <PlayCircle className="w-4 h-4 mr-2" />
        Apply CoDE Strategy
      </Button> */}

      <Button
        onClick={() => handleAction("AI Dialer Campaign")}
        className="flex-1 min-w-[180px] bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold border border-border"
      >
        <Phone className="w-4 h-4 mr-2" />
        Launch AI Dialer Campaign
      </Button>

      <Button
        onClick={() => handleAction("Agency Assignment")}
        className="flex-1 min-w-[180px] bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold border border-border"
      >
        <Building2 className="w-4 h-4 mr-2" />
        Assign Agency
      </Button>

      <Button
        onClick={() => handleAction("Cluster Export")}
        className="flex-1 min-w-[180px] bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold border border-border"
      >
        <Download className="w-4 h-4 mr-2" />
        Export Cluster
      </Button>

      <Button
        onClick={() => handleAction("Case Manager")}
        className="flex-1 min-w-[180px] bg-secondary hover:bg-secondary/80 text-secondary-foreground font-semibold border border-border"
      >
        <FolderOpen className="w-4 h-4 mr-2" />
        Open Case Manager
      </Button>
    </div>
  );
};
