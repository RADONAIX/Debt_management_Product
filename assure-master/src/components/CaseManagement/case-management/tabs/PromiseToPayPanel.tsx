import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PTP } from "@/data/mockCases";
import { Calendar, Plus, CheckCircle, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";

interface PromiseToPayPanelProps {
  ptps: PTP[];
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'Honored': return CheckCircle;
    case 'Missed': return XCircle;
    case 'Pending': return Clock;
    default: return Clock;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'Honored': return 'bg-green-500 text-white';
    case 'Missed': return 'bg-red-500 text-white';
    case 'Pending': return 'bg-yellow-500 text-white';
    default: return 'bg-muted';
  }
};

export const PromiseToPayPanel = ({ ptps }: PromiseToPayPanelProps) => {
  const [open, setOpen] = useState(false);
  const [ptpAmount, setPtpAmount] = useState('');
  const [ptpDate, setPtpDate] = useState('');

  const currentPTP = ptps.find(p => p.status === 'Pending');

  const handleCreatePTP = () => {
    if (!ptpAmount || !ptpDate) {
      toast.error('Please fill in all fields');
      return;
    }
    toast.success('Promise to Pay created successfully');
    setOpen(false);
    setPtpAmount('');
    setPtpDate('');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Promise to Pay</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4" />
              Create PTP
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Promise to Pay</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount ($)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Enter amount"
                  value={ptpAmount}
                  onChange={(e) => setPtpAmount(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date">Payment Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={ptpDate}
                  onChange={(e) => setPtpDate(e.target.value)}
                />
              </div>
              <Button onClick={handleCreatePTP} className="w-full">
                Create Promise to Pay
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {currentPTP && (
        <Card className="p-4 border-primary">
          <div className="flex items-start justify-between mb-3">
            <h4 className="text-sm font-semibold">Current PTP</h4>
            <Badge className={getStatusColor(currentPTP.status)}>
              {currentPTP.status}
            </Badge>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Amount:</span>
              <span className="text-lg font-bold">$ {currentPTP.amount.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Payment Date:</span>
              <span className="text-sm font-medium flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {currentPTP.date}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Created:</span>
              <span className="text-sm">{currentPTP.createdAt}</span>
            </div>
          </div>
        </Card>
      )}

      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3">PTP History</h4>
        <div className="space-y-2">
          {ptps.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No PTPs created yet</p>
          ) : (
            ptps.map((ptp) => {
              const StatusIcon = getStatusIcon(ptp.status);
              return (
                <div key={ptp.id} className="flex items-center justify-between p-3 border border-border rounded-lg">
                  <div className="flex items-center gap-3">
                    <StatusIcon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">$ {ptp.amount.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground">Due: {ptp.date}</p>
                    </div>
                  </div>
                  <Badge className={getStatusColor(ptp.status)}>
                    {ptp.status}
                  </Badge>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
