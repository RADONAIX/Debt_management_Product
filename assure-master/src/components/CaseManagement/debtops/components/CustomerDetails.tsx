import { Customer360, PTPPromise, Dispute, CaseManagement, LegalEscalation, Invoice, Payment } from '../types/customer';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, DollarSign, AlertTriangle, Briefcase, Scale, FileText, MessageSquare, CreditCard } from 'lucide-react';
import { useState } from 'react';
import { InvoiceModal } from './InvoiceModal';
import { PaymentModal } from './PaymentModal';
import { CommunicationModal } from './CommunicationModal';
import { PTPModal } from './PTPModal';
import { CaseModal } from './CaseModal';
import { DisputeModal } from './DisputeModal';
import { LegalModal } from './LegalModal';

interface CustomerDetailsProps {
  customer: Customer360;
  ptps: PTPPromise[];
  disputes: Dispute[];
  cases: CaseManagement[];
  legalEscalations: LegalEscalation[];
  invoices: Invoice[];
  payments: Payment[];
}

export function CustomerDetails({ 
  customer, 
  ptps, 
  disputes, 
  cases, 
  legalEscalations,
  invoices,
  payments 
}: CustomerDetailsProps) {
  const [showInvoices, setShowInvoices] = useState(false);
  const [showPayments, setShowPayments] = useState(false);
  const [showCommunication, setShowCommunication] = useState(false);
  const [selectedPTP, setSelectedPTP] = useState<PTPPromise | null>(null);
  const [selectedCase, setSelectedCase] = useState<CaseManagement | null>(null);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [selectedLegal, setSelectedLegal] = useState<LegalEscalation | null>(null);

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('fulfilled') || statusLower.includes('approved') || statusLower.includes('closed') || statusLower.includes('paid') || statusLower.includes('completed')) 
      return 'bg-status-success/10 text-status-success border-status-success/20';
    if (statusLower.includes('broken') || statusLower.includes('rejected') || statusLower.includes('overdue')) 
      return 'bg-status-error/10 text-status-error border-status-error/20';
    if (statusLower.includes('investigating') || statusLower.includes('progress') || statusLower.includes('active')) 
      return 'bg-status-warning/10 text-status-warning border-status-warning/20';
    return 'bg-card-blue/10 text-card-blue border-card-blue/20';
  };

  return (
    <div className="bg-muted/30 p-4 rounded-lg border border-border">
      <div className="grid grid-cols-5 gap-3">
        {/* Info Column */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Info</h3>
          <Card className="bg-card-blue/5 border-card-blue/20">
            <CardContent className="p-3 space-y-2">
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-start h-8 text-xs"
                onClick={() => setShowInvoices(true)}
              >
                <FileText className="h-3.5 w-3.5 mr-2" />
                View Invoices ({invoices.length})
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-start h-8 text-xs"
                onClick={() => setShowCommunication(true)}
              >
                <MessageSquare className="h-3.5 w-3.5 mr-2" />
                Communication History
              </Button>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full justify-start h-8 text-xs"
                onClick={() => setShowPayments(true)}
              >
                <CreditCard className="h-3.5 w-3.5 mr-2" />
                View Payments ({payments.length})
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* PTP Column */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">PTP</h3>
          {ptps.length === 0 ? (
            <p className="text-xs text-muted-foreground">No PTPs</p>
          ) : (
            ptps.map((ptp) => (
              <Card 
                key={ptp.ptp_id} 
                className="bg-card-purple/5 border-card-purple/20 cursor-pointer hover:bg-card-purple/10 transition-colors"
                onClick={() => setSelectedPTP(ptp)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <Badge className={`text-xs ${getStatusColor(ptp.status)}`}>
                      {ptp.status}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs">
                      <DollarSign className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">${ptp.promised_amount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(ptp.promised_date).toLocaleDateString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Case Management Column */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Case Management</h3>
          {cases.length === 0 ? (
            <p className="text-xs text-muted-foreground">No Cases</p>
          ) : (
            cases.map((caseItem) => (
              <Card 
                key={caseItem.case_id} 
                className="bg-card-yellow/5 border-card-yellow/20 cursor-pointer hover:bg-card-yellow/10 transition-colors"
                onClick={() => setSelectedCase(caseItem)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <Badge className={`text-xs ${getStatusColor(caseItem.status)}`}>
                      {caseItem.status}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs">
                      <Briefcase className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{caseItem.case_type}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{caseItem.summary}</p>
                    {caseItem.assigned_agent && (
                      <p className="text-xs text-muted-foreground">Agent: {caseItem.assigned_agent}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Disputes Column */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Disputes</h3>
          {disputes.length === 0 ? (
            <p className="text-xs text-muted-foreground">No Disputes</p>
          ) : (
            disputes.map((dispute) => (
              <Card 
                key={dispute.dispute_id} 
                className="bg-card-orange/5 border-card-orange/20 cursor-pointer hover:bg-card-orange/10 transition-colors"
                onClick={() => setSelectedDispute(dispute)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <Badge className={`text-xs ${getStatusColor(dispute.status)}`}>
                      {dispute.status}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs">
                      <AlertTriangle className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{dispute.reason}</span>
                    </div>
                    {dispute.amount && (
                      <div className="text-xs text-muted-foreground">
                        Amount: ${dispute.amount.toLocaleString()}
                      </div>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Filed: {new Date(dispute.filed_date).toLocaleDateString()}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Legal Column */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Legal</h3>
          {legalEscalations.length === 0 ? (
            <p className="text-xs text-muted-foreground">No Legal Cases</p>
          ) : (
            legalEscalations.map((legal) => (
              <Card 
                key={legal.escalation_id} 
                className="bg-card-purple/5 border-card-purple/20 cursor-pointer hover:bg-card-purple/10 transition-colors"
                onClick={() => setSelectedLegal(legal)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between mb-2">
                    <Badge className={`text-xs ${getStatusColor(legal.status)}`}>
                      {legal.status}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 text-xs">
                      <Scale className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{legal.agency_name}</span>
                    </div>
                    <div className="text-xs">
                      <div className="text-muted-foreground">Outstanding: ${legal.outstanding_amount.toLocaleString()}</div>
                      <div className="text-status-success">Recovered: ${legal.recovered_amount.toLocaleString()}</div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Efficiency: {legal.efficiency_score}%
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Modals */}
      <InvoiceModal 
        open={showInvoices} 
        onClose={() => setShowInvoices(false)} 
        invoices={invoices}
        customerName={customer.full_name || customer.company_name || 'Customer'}
      />
      <PaymentModal 
        open={showPayments} 
        onClose={() => setShowPayments(false)} 
        payments={payments}
        customerName={customer.full_name || customer.company_name || 'Customer'}
      />
      <CommunicationModal 
        open={showCommunication} 
        onClose={() => setShowCommunication(false)} 
        customerId={customer.customer_id}
        customerName={customer.full_name || customer.company_name || 'Customer'}
      />
      <PTPModal
        open={selectedPTP !== null}
        onClose={() => setSelectedPTP(null)}
        ptp={selectedPTP}
        customerName={customer.full_name || customer.company_name || 'Customer'}
      />
      <CaseModal
        open={selectedCase !== null}
        onClose={() => setSelectedCase(null)}
        caseData={selectedCase}
        customerName={customer.full_name || customer.company_name || 'Customer'}
      />
      <DisputeModal
        open={selectedDispute !== null}
        onClose={() => setSelectedDispute(null)}
        dispute={selectedDispute}
        customerName={customer.full_name || customer.company_name || 'Customer'}
      />
      <LegalModal
        open={selectedLegal !== null}
        onClose={() => setSelectedLegal(null)}
        legal={selectedLegal}
        customerName={customer.full_name || customer.company_name || 'Customer'}
      />
    </div>
  );
}
