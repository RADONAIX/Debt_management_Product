import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface ReassignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (agent: string) => void;
  currentAssignee: string;
  disputeData: any;
}

const agents = [
  { name: "Sarah Wilson", workload: 8, specialty: "Billing", rating: 4.8 },
  { name: "Michael Chen", workload: 12, specialty: "Technical", rating: 4.9 },
  { name: "Emily Rodriguez", workload: 6, specialty: "General", rating: 4.7 },
  { name: "David Kim", workload: 10, specialty: "Enterprise", rating: 4.6 },
  { name: "Jessica Taylor", workload: 5, specialty: "High-Priority", rating: 4.9 },
];

export const ReassignDialog = ({ open, onOpenChange, onSubmit, currentAssignee, disputeData }: ReassignDialogProps) => {
  const [selectedAgent, setSelectedAgent] = useState("");
  const [aiRecommendation, setAiRecommendation] = useState<string | null>(null);

  const handleAIRecommend = () => {
    // AI logic to recommend best agent
    const sortedAgents = [...agents].sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      // Lower workload is better
      scoreA += (15 - a.workload) * 2;
      scoreB += (15 - b.workload) * 2;

      // Higher rating is better
      scoreA += a.rating * 10;
      scoreB += b.rating * 10;

      // Specialty match
      if (disputeData?.priority === "HIGH" && a.specialty === "High-Priority") scoreA += 15;
      if (disputeData?.priority === "HIGH" && b.specialty === "High-Priority") scoreB += 15;

      if (disputeData?.type?.includes("Billing") && a.specialty === "Billing") scoreA += 10;
      if (disputeData?.type?.includes("Billing") && b.specialty === "Billing") scoreB += 10;

      return scoreB - scoreA;
    });

    const recommended = sortedAgents[0];
    setAiRecommendation(recommended.name);
    setSelectedAgent(recommended.name);
    toast.success(`AI recommends ${recommended.name} (${recommended.specialty} specialist, workload: ${recommended.workload})`);
  };

  const handleSubmit = () => {
    if (!selectedAgent) {
      toast.error("Please select an agent");
      return;
    }

    onSubmit(selectedAgent);
    toast.success(`Dispute reassigned to ${selectedAgent}`);
    onOpenChange(false);
    setSelectedAgent("");
    setAiRecommendation(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Reassign Dispute</DialogTitle>
          <DialogDescription>
            Currently assigned to: <span className="font-semibold">{currentAssignee}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Button 
            variant="outline" 
            className="w-full" 
            onClick={handleAIRecommend}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            AI Smart Assignment
          </Button>

          <div className="space-y-2">
            <Label htmlFor="agent">Assign to Agent *</Label>
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger>
                <SelectValue placeholder="Select agent" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.name} value={agent.name}>
                    <div className="flex items-center justify-between w-full">
                      <span>{agent.name}</span>
                      {aiRecommendation === agent.name && (
                        <Badge variant="secondary" className="ml-2">AI Pick</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedAgent && (
            <div className="bg-muted p-3 rounded-lg space-y-1 text-sm">
              {agents.filter(a => a.name === selectedAgent).map(agent => (
                <div key={agent.name}>
                  <p><span className="font-semibold">Specialty:</span> {agent.specialty}</p>
                  <p><span className="font-semibold">Current Workload:</span> {agent.workload} cases</p>
                  <p><span className="font-semibold">Rating:</span> {agent.rating}/5.0</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="flex-1">
            Reassign
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
