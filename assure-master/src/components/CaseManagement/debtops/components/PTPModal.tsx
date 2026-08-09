import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PTPPromise } from '../types/customer';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, DollarSign, Clock, CheckCircle2 } from 'lucide-react';

interface PTPModalProps {
  open: boolean;
  onClose: () => void;
  ptp: PTPPromise | null;
  customerName: string;
}

export function PTPModal({ open, onClose, ptp, customerName }: PTPModalProps) {
  if (!ptp) return null;

  const getStatusColor = (status: string) => {
    if (status === 'Fulfilled') return 'bg-status-success/10 text-status-success border-status-success/20';
    if (status === 'Broken') return 'bg-status-error/10 text-status-error border-status-error/20';
    return 'bg-status-info/10 text-status-info border-status-info/20';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Promise to Pay Details</DialogTitle>
          <p className="text-sm text-muted-foreground">{customerName}</p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Badge className={`${getStatusColor(ptp.status)} text-sm px-3 py-1`}>
                {ptp.status}
              </Badge>
              {ptp.customer_type && (
                <Badge variant="outline" className="text-sm px-3 py-1">
                  {ptp.customer_type}
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              ID: {ptp.ptp_id.slice(0, 12)}...
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <DollarSign className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Promised Amount</p>
                    <p className="text-2xl font-bold">${ptp.promised_amount.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <Calendar className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Promised Date</p>
                    <p className="text-lg font-semibold">
                      {new Date(ptp.promised_date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {ptp.created_at && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="text-sm text-muted-foreground">Created: </span>
                    <span className="text-sm font-medium">
                      {new Date(ptp.created_at).toLocaleString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Conditional Field Display */}
          {(ptp.ban || ptp.msisdn || ptp.invoice_no) && (
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm mb-3">Account Information</h4>
                  {ptp.ban && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">BAN:</span>
                      <span className="text-sm font-medium font-mono">{ptp.ban}</span>
                    </div>
                  )}
                  {ptp.msisdn && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">MSISDN:</span>
                      <span className="text-sm font-medium font-mono">{ptp.msisdn}</span>
                    </div>
                  )}
                  {ptp.invoice_no && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Invoice No:</span>
                      <span className="text-sm font-medium font-mono">{ptp.invoice_no}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-2 flex-1">
                  <h4 className="font-semibold text-sm">Status Information</h4>
                  <p className="text-sm text-muted-foreground">
                    {ptp.status === 'Fulfilled' && 'This promise to pay has been successfully fulfilled. Payment has been received.'}
                    {ptp.status === 'Broken' && 'This promise to pay was not honored. Follow-up action may be required.'}
                    {ptp.status === 'Created' && 'This promise to pay is active and pending fulfillment.'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
