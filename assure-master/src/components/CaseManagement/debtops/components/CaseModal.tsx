import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { CaseManagement } from '../types/customer';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Briefcase, Calendar, User, FileText } from 'lucide-react';

interface CaseModalProps {
  open: boolean;
  onClose: () => void;
  caseData: CaseManagement | null;
  customerName: string;
}

export function CaseModal({ open, onClose, caseData, customerName }: CaseModalProps) {
  if (!caseData) return null;

  const getStatusColor = (status: string) => {
    if (status === 'Closed') return 'bg-status-success/10 text-status-success border-status-success/20';
    if (status === 'Open') return 'bg-status-error/10 text-status-error border-status-error/20';
    return 'bg-status-warning/10 text-status-warning border-status-warning/20';
  };

  const getCaseTypeColor = (type: string) => {
    if (type === 'Legal Followup') return 'bg-card-purple/10 text-card-purple border-card-purple/20';
    if (type === 'Broken PTP') return 'bg-card-orange/10 text-card-orange border-card-orange/20';
    return 'bg-card-blue/10 text-card-blue border-card-blue/20';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Case Management Details</DialogTitle>
          <p className="text-sm text-muted-foreground">{customerName}</p>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Badge className={`${getStatusColor(caseData.status)} text-sm px-3 py-1`}>
                {caseData.status}
              </Badge>
              <Badge className={`${getCaseTypeColor(caseData.case_type)} text-sm px-3 py-1`}>
                {caseData.case_type}
              </Badge>
              {caseData.customer_type && (
                <Badge variant="outline" className="text-sm px-3 py-1">
                  {caseData.customer_type}
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground font-mono">
              ID: {caseData.case_id.slice(0, 12)}...
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Briefcase className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Case Type</p>
                    <p className="text-lg font-semibold">{caseData.case_type}</p>
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
                    <p className="text-xs text-muted-foreground mb-1">Opened Date</p>
                    <p className="text-lg font-semibold">
                      {new Date(caseData.opened_date).toLocaleDateString('en-US', {
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
          {(caseData.ban || caseData.msisdn || caseData.invoice_no || caseData.line_item_id || caseData.amount_disputed) && (
            <Card>
              <CardContent className="p-4">
                <h4 className="font-semibold text-sm mb-3">Case Details</h4>
                <div className="space-y-2">
                  {caseData.ban && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">BAN:</span>
                      <span className="text-sm font-medium font-mono">{caseData.ban}</span>
                    </div>
                  )}
                  {caseData.msisdn && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">MSISDN:</span>
                      <span className="text-sm font-medium font-mono">{caseData.msisdn}</span>
                    </div>
                  )}
                  {caseData.invoice_no && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Invoice No:</span>
                      <span className="text-sm font-medium font-mono">{caseData.invoice_no}</span>
                    </div>
                  )}
                  {caseData.line_item_id && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Line Item ID:</span>
                      <span className="text-sm font-medium font-mono">{caseData.line_item_id}</span>
                    </div>
                  )}
                  {caseData.amount_disputed && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Amount Disputed:</span>
                      <span className="text-sm font-medium">${caseData.amount_disputed.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {caseData.assigned_agent && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <span className="text-sm text-muted-foreground">Assigned Agent: </span>
                    <span className="text-sm font-medium">{caseData.assigned_agent}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-muted/30">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-2 flex-1">
                  <h4 className="font-semibold text-sm">Case Summary</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {caseData.summary}
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
