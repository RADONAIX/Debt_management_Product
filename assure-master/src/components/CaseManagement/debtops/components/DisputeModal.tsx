import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Dispute } from '../types/customer';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Calendar, DollarSign, FileText } from 'lucide-react';

interface DisputeModalProps {
  open: boolean;
  onClose: () => void;
  dispute: Dispute | null;
  customerName: string;
}

export function DisputeModal({ open, onClose, dispute, customerName }: DisputeModalProps) {
  if (!dispute) return null;

  const getStatusColor = (status: string) => {
    if (status === 'Approved') return 'bg-status-success/10 text-status-success border-status-success/20';
    if (status === 'Rejected') return 'bg-status-error/10 text-status-error border-status-error/20';
    return 'bg-status-warning/10 text-status-warning border-status-warning/20';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Dispute Details</DialogTitle>
          <p className="text-sm text-muted-foreground">{customerName}</p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Badge className={`${getStatusColor(dispute.status)} text-sm px-3 py-1`}>
                {dispute.status}
              </Badge>
              {dispute.customer_type && (
                <Badge variant="outline" className="text-sm px-3 py-1">
                  {dispute.customer_type}
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              ID: {dispute.dispute_id.slice(0, 12)}...
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {dispute.amount && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Disputed Amount</p>
                      <p className="text-2xl font-bold">${dispute.amount.toLocaleString()}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <Calendar className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Filed Date</p>
                    <p className="text-lg font-semibold">
                      {new Date(dispute.filed_date).toLocaleDateString('en-US', {
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

          {/* Conditional Field Display */}
          {(dispute.ban || dispute.msisdn || dispute.invoice_no || dispute.invoice_id || dispute.line_item_id) && (
            <Card>
              <CardContent className="p-4">
                <h4 className="font-semibold text-sm mb-3">Dispute Information</h4>
                <div className="space-y-2">
                  {dispute.ban && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">BAN:</span>
                      <span className="text-sm font-medium font-mono">{dispute.ban}</span>
                    </div>
                  )}
                  {dispute.msisdn && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">MSISDN:</span>
                      <span className="text-sm font-medium font-mono">{dispute.msisdn}</span>
                    </div>
                  )}
                  {dispute.invoice_no && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Invoice No:</span>
                      <span className="text-sm font-medium font-mono">{dispute.invoice_no}</span>
                    </div>
                  )}
                  {dispute.invoice_id && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Invoice ID:</span>
                      <span className="text-sm font-medium font-mono">{dispute.invoice_id.slice(0, 12)}...</span>
                    </div>
                  )}
                  {dispute.line_item_id && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Line Item ID:</span>
                      <span className="text-sm font-medium font-mono">{dispute.line_item_id}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-2 flex-1">
                  <h4 className="font-semibold text-sm">Dispute Reason</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {dispute.reason}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Status Information</h4>
                <p className="text-sm text-muted-foreground">
                  {dispute.status === 'Approved' && 'This dispute has been reviewed and approved. The customer account has been adjusted accordingly.'}
                  {dispute.status === 'Rejected' && 'This dispute has been reviewed and rejected. The original charges remain valid.'}
                  {dispute.status === 'Investigating' && 'This dispute is currently under investigation. Additional documentation may be required.'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
