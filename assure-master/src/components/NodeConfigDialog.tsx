import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useEffect } from "react";

interface NodeConfig {
  id: string;
  type: string;
  label: string;
  timing?: string;
  message?: string;
  condition?: string;
}

interface NodeConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: NodeConfig | null;
  onSave: (config: NodeConfig) => void;
}

export const NodeConfigDialog = ({ open, onOpenChange, node, onSave }: NodeConfigDialogProps) => {
  const [config, setConfig] = useState<NodeConfig | null>(null);

  useEffect(() => {
    if (node) {
      setConfig({ ...node });
    }
  }, [node]);

  const handleSave = () => {
    if (config) {
      onSave(config);
      onOpenChange(false);
    }
  };

  if (!config) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Configure {config.label}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="label">Node Label</Label>
            <Input
              id="label"
              value={config.label}
              onChange={(e) => setConfig({ ...config, label: e.target.value })}
              className="bg-background border-border"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timing">Timing</Label>
            <Select
              value={config.timing || "immediate"}
              onValueChange={(value) => setConfig({ ...config, timing: value })}
            >
              <SelectTrigger className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">Immediate</SelectItem>
                <SelectItem value="1hour">After 1 Hour</SelectItem>
                <SelectItem value="6hours">After 6 Hours</SelectItem>
                <SelectItem value="1day">After 1 Day</SelectItem>
                <SelectItem value="3days">After 3 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(config.type === "SMS" || config.type === "Email" || config.type === "WhatsApp") && (
            <div className="space-y-2">
              <Label htmlFor="message">Message Template</Label>
              <Textarea
                id="message"
                value={config.message || ""}
                onChange={(e) => setConfig({ ...config, message: e.target.value })}
                placeholder="Enter your message template..."
                className="bg-background border-border min-h-[100px]"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="condition">Condition</Label>
            <Select
              value={config.condition || "always"}
              onValueChange={(value) => setConfig({ ...config, condition: value })}
            >
              <SelectTrigger className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="always">Always Execute</SelectItem>
                <SelectItem value="no_response">If No Response</SelectItem>
                <SelectItem value="payment_pending">If Payment Pending</SelectItem>
                <SelectItem value="high_risk">If High Risk Score</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
