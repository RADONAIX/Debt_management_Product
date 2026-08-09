import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Settings, Phone, Users, PieChart, Zap, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ActionDialog = "strategy" | "dialer" | "agency" | "segment" | "launch" | "exceptions" | null;

export const QuickActions = () => {
  const { toast } = useToast();
  const [activeDialog, setActiveDialog] = useState<ActionDialog>(null);
  const [formData, setFormData] = useState({
    strategy: "",
    segment: "",
    priority: "",
    agency: "",
    campaign: "",
    contactMethod: "",
    notes: ""
  });

  const handleSubmit = (action: string) => {
    toast({
      title: `${action} Submitted`,
      description: "Your request has been processed successfully."
    });
    setActiveDialog(null);
    setFormData({
      strategy: "",
      segment: "",
      priority: "",
      agency: "",
      campaign: "",
      contactMethod: "",
      notes: ""
    });
  };

  return (
    <>
      <Card className="bg-dashboard-card border-dashboard-border p-6 space-y-4">
        <h3 className="text-base font-semibold text-foreground">Quick Actions</h3>
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4 hover:bg-muted/50"
            onClick={() => setActiveDialog("strategy")}
          >
            <Settings className="h-5 w-5 text-kpi-light-blue" />
            <span className="text-xs text-center leading-tight">Adjust Strategy</span>
          </Button>
          
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4 hover:bg-muted/50"
            onClick={() => setActiveDialog("dialer")}
          >
            <Phone className="h-5 w-5 text-kpi-light-blue" />
            <span className="text-xs text-center leading-tight">Launch AI Dialer Campaign</span>
          </Button>
          
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4 hover:bg-muted/50"
            onClick={() => setActiveDialog("agency")}
          >
            <Users className="h-5 w-5 text-kpi-light-blue" />
            <span className="text-xs text-center leading-tight">Assign to Agency</span>
          </Button>
          
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4 hover:bg-muted/50"
            onClick={() => setActiveDialog("segment")}
          >
            <PieChart className="h-5 w-5 text-kpi-light-blue" />
            <span className="text-xs text-center leading-tight">View Segment</span>
          </Button>
          
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4 hover:bg-muted/50"
            onClick={() => setActiveDialog("launch")}
          >
            <Zap className="h-5 w-5 text-kpi-light-blue" />
            <span className="text-xs text-center leading-tight">Launch & Dialer</span>
          </Button>
          
          <Button
            variant="outline"
            className="flex flex-col items-center gap-2 h-auto py-4 hover:bg-muted/50"
            onClick={() => setActiveDialog("exceptions")}
          >
            <AlertTriangle className="h-5 w-5 text-kpi-light-blue" />
            <span className="text-xs text-center leading-tight">Quick A Exceptions</span>
          </Button>
        </div>
      </Card>

      {/* Adjust Strategy Dialog */}
      <Dialog open={activeDialog === "strategy"} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust Collection Strategy</DialogTitle>
            <DialogDescription>Configure collection strategy parameters</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="strategy">Strategy Type</Label>
              <Select value={formData.strategy} onValueChange={(value) => setFormData({...formData, strategy: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select strategy" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="soft-reminder">Soft Reminder</SelectItem>
                  <SelectItem value="ai-dialer">AI Dialer</SelectItem>
                  <SelectItem value="legal-pre">Legal Pre-Action</SelectItem>
                  <SelectItem value="va-negotiation">VA Negotiation</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="segment">Target Segment</Label>
              <Select value={formData.segment} onValueChange={(value) => setFormData({...formData, segment: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select segment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                  <SelectItem value="smb">SMB</SelectItem>
                  <SelectItem value="government">Government</SelectItem>
                  <SelectItem value="consumer">Consumer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Priority Level</Label>
              <Select value={formData.priority} onValueChange={(value) => setFormData({...formData, priority: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={() => handleSubmit("Strategy Adjustment")}>
              Apply Strategy
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Dialer Campaign Dialog */}
      <Dialog open={activeDialog === "dialer"} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Launch AI Dialer Campaign</DialogTitle>
            <DialogDescription>Configure and launch automated dialer campaign</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="campaign">Campaign Name</Label>
              <Input 
                id="campaign"
                value={formData.campaign}
                onChange={(e) => setFormData({...formData, campaign: e.target.value})}
                placeholder="Enter campaign name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="segment">Target Segment</Label>
              <Select value={formData.segment} onValueChange={(value) => setFormData({...formData, segment: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select segment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  <SelectItem value="high-risk">High Risk Only</SelectItem>
                  <SelectItem value="60plus">60+ DPD</SelectItem>
                  <SelectItem value="90plus">90+ DPD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contactMethod">Contact Method</Label>
              <Select value={formData.contactMethod} onValueChange={(value) => setFormData({...formData, contactMethod: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="voice">Voice Call</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="all">All Methods</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={() => handleSubmit("AI Dialer Campaign")}>
              Launch Campaign
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign to Agency Dialog */}
      <Dialog open={activeDialog === "agency"} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign to Collection Agency</DialogTitle>
            <DialogDescription>Transfer accounts to external collection agency</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="agency">Collection Agency</Label>
              <Select value={formData.agency} onValueChange={(value) => setFormData({...formData, agency: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select agency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="agency1">Premium Collections Ltd</SelectItem>
                  <SelectItem value="agency2">Gulf Recovery Services</SelectItem>
                  <SelectItem value="agency3">Elite Debt Recovery</SelectItem>
                  <SelectItem value="agency4">National Collections Bureau</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="segment">Account Segment</Label>
              <Select value={formData.segment} onValueChange={(value) => setFormData({...formData, segment: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select segment" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="90plus">90+ DPD</SelectItem>
                  <SelectItem value="120plus">120+ DPD</SelectItem>
                  <SelectItem value="legal">Legal Action Required</SelectItem>
                  <SelectItem value="disputed">Disputed Accounts</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Transfer Notes</Label>
              <Textarea 
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                placeholder="Add notes for the agency..."
                rows={3}
              />
            </div>
            <Button className="w-full" onClick={() => handleSubmit("Agency Assignment")}>
              Assign Accounts
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Segment Dialog */}
      <Dialog open={activeDialog === "segment"} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Segment Analysis</DialogTitle>
            <DialogDescription>View detailed segment breakdown and metrics</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Enterprise</div>
                <div className="text-2xl font-bold text-foreground">$ 32M</div>
                <div className="text-xs text-success mt-1">↓ 12% improvement</div>
              </div>
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">SMB</div>
                <div className="text-2xl font-bold text-foreground">$ 8.2M</div>
                <div className="text-xs text-warning mt-1">↑ 5% increase</div>
              </div>
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Government</div>
                <div className="text-2xl font-bold text-foreground">$ 9.1M</div>
                <div className="text-xs text-success mt-1">↓ 8% improvement</div>
              </div>
              <div className="p-4 bg-muted/30 rounded-lg">
                <div className="text-xs text-muted-foreground mb-1">Consumer</div>
                <div className="text-2xl font-bold text-foreground">$ 2.3M</div>
                <div className="text-xs text-chart-orange mt-1">→ Stable</div>
              </div>
            </div>
            <Button className="w-full" onClick={() => setActiveDialog(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Launch & Dialer Dialog */}
      <Dialog open={activeDialog === "launch"} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick Launch Dialer</DialogTitle>
            <DialogDescription>Instantly launch dialer for selected accounts</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="segment">Target Accounts</Label>
              <Select value={formData.segment} onValueChange={(value) => setFormData({...formData, segment: value})}>
                <SelectTrigger>
                  <SelectValue placeholder="Select target" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="overdue">All Overdue</SelectItem>
                  <SelectItem value="high-risk">High Risk</SelectItem>
                  <SelectItem value="recent">Recently Overdue</SelectItem>
                  <SelectItem value="custom">Custom Selection</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-4 bg-muted/30 rounded-lg space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Target Accounts:</span>
                <span className="font-semibold text-foreground">248</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Estimated Duration:</span>
                <span className="font-semibold text-foreground">~4 hours</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Expected Contact Rate:</span>
                <span className="font-semibold text-success">68%</span>
              </div>
            </div>
            <Button className="w-full" onClick={() => handleSubmit("Quick Launch")}>
              Start Dialer Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Quick Exceptions Dialog */}
      <Dialog open={activeDialog === "exceptions"} onOpenChange={(open) => !open && setActiveDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Active Exceptions & Alerts</DialogTitle>
            <DialogDescription>Critical items requiring immediate attention</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4 max-h-96 overflow-y-auto">
            <div className="p-3 border border-warning/30 rounded-lg bg-warning/5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-sm text-foreground">High-risk surge in SMB+ (60-bucket)</div>
                  <div className="text-xs text-muted-foreground mt-1">Affected: 42 accounts • $ 3.2M</div>
                </div>
                <span className="text-xs px-2 py-1 bg-warning/20 text-warning rounded">Critical</span>
              </div>
            </div>
            <div className="p-3 border border-chart-orange/30 rounded-lg bg-chart-orange/5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-sm text-foreground">Payment failure spike detected</div>
                  <div className="text-xs text-muted-foreground mt-1">Last 24h: 18 failed payments</div>
                </div>
                <span className="text-xs px-2 py-1 bg-chart-orange/20 text-chart-orange rounded">High</span>
              </div>
            </div>
            <div className="p-3 border border-chart-orange/30 rounded-lg bg-chart-orange/5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-sm text-foreground">Dispute queue growing</div>
                  <div className="text-xs text-muted-foreground mt-1">28 unresolved disputes</div>
                </div>
                <span className="text-xs px-2 py-1 bg-chart-orange/20 text-chart-orange rounded">High</span>
              </div>
            </div>
            <div className="p-3 border border-muted rounded-lg bg-muted/5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold text-sm text-foreground">Dialer contactability drop</div>
                  <div className="text-xs text-muted-foreground mt-1">Down 12% from last week</div>
                </div>
                <span className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded">Medium</span>
              </div>
            </div>
          </div>
          <Button className="w-full" onClick={() => setActiveDialog(null)}>
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
};
