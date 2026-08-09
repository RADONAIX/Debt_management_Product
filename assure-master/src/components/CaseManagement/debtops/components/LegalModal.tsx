import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LegalEscalation } from '../types/customer';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Scale, DollarSign, TrendingUp, Calendar, Building } from 'lucide-react';

interface LegalModalProps {
  open: boolean;
  onClose: () => void;
  legal: LegalEscalation | null;
  customerName: string;
}

export function LegalModal({ open, onClose, legal, customerName }: LegalModalProps) {
  if (!legal) return null;

  const getStatusColor = (status: string) => {
    if (status === 'Completed') return 'bg-status-success/10 text-status-success border-status-success/20';
    if (status === 'Pending') return 'bg-status-warning/10 text-status-warning border-status-warning/20';
    return 'bg-status-info/10 text-status-info border-status-info/20';
  };

  const recoveryRate = ((legal.recovered_amount / legal.outstanding_amount) * 100).toFixed(1);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Legal Escalation Details</DialogTitle>
          <p className="text-sm text-muted-foreground">{customerName}</p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Badge className={`${getStatusColor(legal.status)} text-sm px-3 py-1`}>
                {legal.status}
              </Badge>
              {legal.customer_type && (
                <Badge variant="outline" className="text-sm px-3 py-1">
                  {legal.customer_type}
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              ID: {legal.escalation_id.slice(0, 12)}...
            </span>
          </div>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Building className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">Agency</p>
                  <p className="text-xl font-bold">{legal.agency_name}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-destructive/10">
                    <DollarSign className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Outstanding</p>
                    <p className="text-xl font-bold">${legal.outstanding_amount.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-status-success/10">
                    <DollarSign className="h-5 w-5 text-status-success" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Recovered</p>
                    <p className="text-xl font-bold text-status-success">${legal.recovered_amount.toLocaleString()}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-accent/10">
                    <TrendingUp className="h-5 w-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Recovery Rate</p>
                    <p className="text-xl font-bold">{recoveryRate}%</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Scale className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="text-sm text-muted-foreground">Efficiency Score: </span>
                    <span className="text-sm font-bold">{legal.efficiency_score}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="text-sm text-muted-foreground">Escalated: </span>
                  <span className="text-sm font-medium">
                    {new Date(legal.escalated_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Conditional Field Display */}
          {(legal.ban || legal.msisdn || legal.invoice_no) && (
            <Card>
              <CardContent className="p-4">
                <h4 className="font-semibold text-sm mb-3">Account Information</h4>
                <div className="space-y-2">
                  {legal.ban && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">BAN:</span>
                      <span className="text-sm font-medium font-mono">{legal.ban}</span>
                    </div>
                  )}
                  {legal.msisdn && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">MSISDN:</span>
                      <span className="text-sm font-medium font-mono">{legal.msisdn}</span>
                    </div>
                  )}
                  {legal.invoice_no && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Invoice No:</span>
                      <span className="text-sm font-medium font-mono">{legal.invoice_no}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          </div>

          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="space-y-3">
                <h4 className="font-semibold text-sm">Performance Metrics</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Remaining Balance</p>
                    <p className="font-semibold">${(legal.outstanding_amount - legal.recovered_amount).toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Days Active</p>
                    <p className="font-semibold">
                      {Math.floor((new Date().getTime() - new Date(legal.escalated_at).getTime()) / (1000 * 60 * 60 * 24))} days
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
