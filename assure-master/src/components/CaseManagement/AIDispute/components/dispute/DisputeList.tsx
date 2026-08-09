import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, AlertCircle, GitCompare } from "lucide-react";
import { Dispute } from "@/types/dispute";

interface DisputeListProps {
  disputes: Dispute[];
  selectedDispute: Dispute | null;
  onSelectDispute: (dispute: Dispute) => void;
  selectedForComparison: string[];
  onToggleComparison: (disputeId: string) => void;
  onOpenComparison: () => void;
}

export const DisputeList = ({ 
  disputes, 
  selectedDispute, 
  onSelectDispute,
  selectedForComparison,
  onToggleComparison,
  onOpenComparison
}: DisputeListProps) => {
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
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-xl font-semibold">Active Disputes</h2>
          {selectedForComparison.length > 0 && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={onOpenComparison}
              className="gap-2"
            >
              <GitCompare className="w-4 h-4" />
              Compare ({selectedForComparison.length})
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground">Track and manage customer disputes</p>
      </div>

      <div className="p-6 border-b space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search disputes..." className="pl-10" />
        </div>
        <div className="flex gap-2">
          <Select defaultValue="all-status">
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-status">All Status</SelectItem>
              <SelectItem value="investigating">Investigating</SelectItem>
              <SelectItem value="escalated">Escalated</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="all-priority">
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="All Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-priority">All Priority</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        {disputes.map((dispute) => (
          <div
            key={dispute.id}
            className={`p-6 border-b transition-colors ${
              selectedDispute?.id === dispute.id ? "bg-muted" : "hover:bg-muted/50"
            }`}
          >
            <div className="flex items-start gap-3">
              <Checkbox
                checked={selectedForComparison.includes(dispute.id)}
                onCheckedChange={() => onToggleComparison(dispute.id)}
                onClick={(e) => e.stopPropagation()}
                className="mt-1"
              />
              <div 
                onClick={() => onSelectDispute(dispute)}
                className="flex-1 cursor-pointer"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-muted-foreground" />
                    <span className="font-semibold">{dispute.id}</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge className={getStatusColor(dispute.status)} variant="secondary">
                      {dispute.status}
                    </Badge>
                    <Badge className={getPriorityColor(dispute.priority)} variant="secondary">
                      {dispute.priority}
                    </Badge>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">{dispute.customerName}</p>
                  <p className="text-sm text-muted-foreground">{dispute.type}</p>
                  <p className="text-sm font-semibold text-destructive">${dispute.amount}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
