import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Briefcase, AlertTriangle, Scale, DollarSign, ChevronDown, Calendar } from 'lucide-react';
import { PTPPromise, CaseManagement, Dispute, LegalEscalation } from '../types/customer';

interface AgentGroupViewProps {
  agentName: string;
  ptps: PTPPromise[];
  cases: CaseManagement[];
  disputes: Dispute[];
  legalEscalations: LegalEscalation[];
  onPTPClick: (ptp: PTPPromise) => void;
  onCaseClick: (caseData: CaseManagement) => void;
  onDisputeClick: (dispute: Dispute) => void;
  onLegalClick: (legal: LegalEscalation) => void;
}

export function AgentGroupView({
  agentName,
  ptps,
  cases,
  disputes,
  legalEscalations,
  onPTPClick,
  onCaseClick,
  onDisputeClick,
  onLegalClick,
}: AgentGroupViewProps) {
  const totalItems = ptps.length + cases.length + disputes.length + legalEscalations.length;
  const [open, setOpen] = useState(false);

  return (
    <Card className="mb-4">
      <CardHeader
        className="bg-muted/30 cursor-pointer select-none"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            />
            <div className="p-2 rounded-lg bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">{agentName}</CardTitle>
              <p className="text-sm text-muted-foreground">{totalItems} total items</p>
            </div>
          </div>
          <div className="flex gap-2">
            {ptps.length > 0 && <Badge variant="secondary">{ptps.length} PTPs</Badge>}
            {cases.length > 0 && <Badge variant="secondary">{cases.length} Cases</Badge>}
            {disputes.length > 0 && <Badge variant="secondary">{disputes.length} Disputes</Badge>}
            {legalEscalations.length > 0 && <Badge variant="secondary">{legalEscalations.length} Legal</Badge>}
          </div>
        </div>
      </CardHeader>
      {open && (
      <CardContent className="p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {/* PTP Column */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">PTP</h3>
            {ptps.length === 0 ? (
              <p className="text-xs text-muted-foreground">No PTPs</p>
            ) : (
              ptps.map((ptp) => (
                <Card
                  key={ptp.ptp_id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => onPTPClick(ptp)}
                >
                  <CardContent className="p-3">
                    <Badge className={`text-xs mb-2 ${ptp.status === 'Created' ? 'bg-info/10 text-info' : ptp.status === 'Broken' ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
                      {ptp.status}
                    </Badge>
                    <div className="flex items-center gap-1.5 text-xs">
                      <DollarSign className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">${ptp.promised_amount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <Calendar className="h-3 w-3" />
                      <span>{new Date(ptp.promised_date).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Case Management Column */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Case Management</h3>
            {cases.length === 0 ? (
              <p className="text-xs text-muted-foreground">No Cases</p>
            ) : (
              cases.map((caseData) => (
                <Card
                  key={caseData.case_id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => onCaseClick(caseData)}
                >
                  <CardContent className="p-3">
                    <Badge className={`text-xs mb-2 ${caseData.status === 'Closed' ? 'bg-success/10 text-success' : caseData.status === 'Open' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'}`}>
                      {caseData.status}
                    </Badge>
                    <div className="flex items-center gap-1.5 text-xs">
                      <Briefcase className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{caseData.case_type}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{caseData.summary}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Disputes Column */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Disputes</h3>
            {disputes.length === 0 ? (
              <p className="text-xs text-muted-foreground">No Disputes</p>
            ) : (
              disputes.map((dispute) => (
                <Card
                  key={dispute.dispute_id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => onDisputeClick(dispute)}
                >
                  <CardContent className="p-3">
                    <Badge className={`text-xs mb-2 ${dispute.status === 'Approved' ? 'bg-success/10 text-success' : dispute.status === 'Rejected' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'}`}>
                      {dispute.status}
                    </Badge>
                    <div className="flex items-center gap-1.5 text-xs">
                      <AlertTriangle className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">${dispute.amount?.toLocaleString() || 'N/A'}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{dispute.reason}</p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Legal Column */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Legal</h3>
            {legalEscalations.length === 0 ? (
              <p className="text-xs text-muted-foreground">No Legal</p>
            ) : (
              legalEscalations.map((legal) => (
                <Card
                  key={legal.escalation_id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => onLegalClick(legal)}
                >
                  <CardContent className="p-3">
                    <Badge className={`text-xs mb-2 ${legal.status === 'Completed' ? 'bg-success/10 text-success' : legal.status === 'Active' ? 'bg-warning/10 text-warning' : 'bg-info/10 text-info'}`}>
                      {legal.status}
                    </Badge>
                    <div className="flex items-center gap-1.5 text-xs">
                      <Scale className="h-3 w-3 text-muted-foreground" />
                      <span className="font-medium">{legal.agency_name}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Outstanding: ${legal.outstanding_amount.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Recovered: ${legal.recovered_amount.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {totalItems === 0 && (
          <p className="text-center text-muted-foreground py-4">No items assigned to this agent</p>
        )}
      </CardContent>
      )}
    </Card>
  );
}
