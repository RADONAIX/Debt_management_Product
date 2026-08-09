import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";

interface NewDisputeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (dispute: any) => void;
}

export const NewDisputeDialog = ({ open, onOpenChange, onSubmit }: NewDisputeDialogProps) => {
  const [customerName, setCustomerName] = useState("");
  const [type, setType] = useState("");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"LOW" | "MEDIUM" | "HIGH">("MEDIUM");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments([...attachments, ...Array.from(e.target.files)]);
      toast.success(`${e.target.files.length} file(s) uploaded`);
    }
  };

  const handleAIAssist = () => {
    setAiAnalyzing(true);
    
    // Simulate AI analysis
    setTimeout(() => {
      // Auto-detect type based on description keywords
      const desc = description.toLowerCase();
      if (desc.includes("billing") || desc.includes("charge")) {
        setType("Service Billing Error");
      } else if (desc.includes("unauthorized")) {
        setType("Unauthorized Service Charge");
      } else if (desc.includes("dispute") || desc.includes("incorrect")) {
        setType("Service Charge Dispute");
      }

      // Auto-set priority based on amount and keywords
      const amountNum = parseFloat(amount);
      if (amountNum > 1000 || desc.includes("urgent") || desc.includes("immediate")) {
        setPriority("HIGH");
      } else if (amountNum > 300) {
        setPriority("MEDIUM");
      } else {
        setPriority("LOW");
      }

      setAiAnalyzing(false);
      toast.success("AI analysis complete - fields auto-populated");
    }, 1500);
  };

  const handleSubmit = () => {
    if (!customerName || !type || !amount || !description) {
      toast.error("Please fill all required fields");
      return;
    }

    const newDispute = {
      id: `DSP${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
      customerId: `CUST-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`,
      customerName,
      type,
      amount: parseFloat(amount),
      status: "OPEN" as const,
      priority,
      assignedTo: "Auto-Assigned",
      dateRaised: new Date().toISOString().split('T')[0],
      description,
      timeline: [
        {
          id: "1",
          title: "Dispute Raised",
          by: "System",
          note: "Dispute created via portal",
          date: new Date().toISOString().split('T')[0]
        }
      ],
      attachments: attachments.map(f => ({ name: f.name, type: f.type }))
    };

    onSubmit(newDispute);
    toast.success("Dispute created successfully");
    onOpenChange(false);
    
    // Reset form
    setCustomerName("");
    setType("");
    setAmount("");
    setDescription("");
    setPriority("MEDIUM");
    setAttachments([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Dispute</DialogTitle>
          <DialogDescription>Enter dispute details. AI will help categorize and prioritize.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="customerName">Customer Name *</Label>
            <Input
              id="customerName"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter customer name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount ($) *</Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue..."
              rows={4}
            />
          </div>

          <Button 
            variant="outline" 
            className="w-full" 
            onClick={handleAIAssist}
            disabled={aiAnalyzing || !description}
          >
            <Sparkles className="w-4 h-4 mr-2" />
            {aiAnalyzing ? "AI Analyzing..." : "AI Auto-Categorize"}
          </Button>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="type">Dispute Type *</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Service Billing Error">Service Billing Error</SelectItem>
                  <SelectItem value="Unauthorized Service Charge">Unauthorized Service Charge</SelectItem>
                  <SelectItem value="Service Charge Dispute">Service Charge Dispute</SelectItem>
                  <SelectItem value="Payment Processing Error">Payment Processing Error</SelectItem>
                  <SelectItem value="Late Fee Dispute">Late Fee Dispute</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority *</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Attachments</Label>
            <div className="border-2 border-dashed rounded-lg p-4 text-center">
              <Input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Click to upload files</p>
              </label>
            </div>
            {attachments.length > 0 && (
              <div className="text-sm text-muted-foreground">
                {attachments.length} file(s) selected: {attachments.map(f => f.name).join(", ")}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90">
            Create Dispute
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
