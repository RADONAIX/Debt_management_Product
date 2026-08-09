import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Briefcase, AlertTriangle, Scale } from 'lucide-react';
import { PTPPromise, CaseManagement, Dispute, LegalEscalation } from '../types/customer';

interface CaseGridViewProps {
  ptps: PTPPromise[];
  cases: CaseManagement[];
  disputes: Dispute[];
  legalEscalations: LegalEscalation[];
  onPTPClick: (ptp: PTPPromise) => void;
  onCaseClick: (caseData: CaseManagement) => void;
  onDisputeClick: (dispute: Dispute) => void;
  onLegalClick: (legal: LegalEscalation) => void;
}

export function CaseGridView({
  ptps,
  cases,
  disputes,
  legalEscalations,
  onPTPClick,
  onCaseClick,
  onDisputeClick,
  onLegalClick,
}: CaseGridViewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* PTP Column */}
      <div>
        <CardHeader className="px-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            PTP ({ptps.length})
          </CardTitle>
        </CardHeader>
        <div className="space-y-2">
          {ptps.map((ptp) => (
            <Card
              key={ptp.ptp_id}
              className="cursor-pointer hover:bg-card-ptp/30 transition-colors"
              onClick={() => onPTPClick(ptp)}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">${ptp.promised_amount.toLocaleString()}</span>
                  <Badge className={`text-xs ${ptp.status === 'Created' ? 'bg-info/10 text-info' : ptp.status === 'Broken' ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'}`}>
                    {ptp.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">Due: {new Date(ptp.promised_date).toLocaleDateString()}</p>
                {ptp.msisdn && <p className="text-xs text-muted-foreground mt-1">MSISDN: {ptp.msisdn}</p>}
                {ptp.ban && <p className="text-xs text-muted-foreground mt-1">BAN: {ptp.ban}</p>}
              </CardContent>
            </Card>
          ))}
          {ptps.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No PTPs</p>
          )}
        </div>
      </div>

      {/* Case Management Column */}
      <div>
        <CardHeader className="px-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Case Management ({cases.length})
          </CardTitle>
        </CardHeader>
        <div className="space-y-2">
          {cases.map((caseData) => (
            <Card
              key={caseData.case_id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => onCaseClick(caseData)}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">{caseData.case_type}</span>
                  <Badge className={`text-xs ${caseData.status === 'Closed' ? 'bg-success/10 text-success' : caseData.status === 'Open' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'}`}>
                    {caseData.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{caseData.summary}</p>
                {caseData.msisdn && <p className="text-xs text-muted-foreground mt-1">MSISDN: {caseData.msisdn}</p>}
                {caseData.ban && <p className="text-xs text-muted-foreground mt-1">BAN: {caseData.ban}</p>}
              </CardContent>
            </Card>
          ))}
          {cases.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No cases</p>
          )}
        </div>
      </div>

      {/* Disputes Column */}
      <div>
        <CardHeader className="px-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Disputes ({disputes.length})
          </CardTitle>
        </CardHeader>
        <div className="space-y-2">
          {disputes.map((dispute) => (
            <Card
              key={dispute.dispute_id}
              className="cursor-pointer hover:bg-card-dispute/30 transition-colors"
              onClick={() => onDisputeClick(dispute)}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">${dispute.amount?.toLocaleString() || 'N/A'}</span>
                  <Badge className={`text-xs ${dispute.status === 'Approved' ? 'bg-success/10 text-success' : dispute.status === 'Rejected' ? 'bg-destructive/10 text-destructive' : 'bg-warning/10 text-warning'}`}>
                    {dispute.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{dispute.reason}</p>
                {dispute.msisdn && <p className="text-xs text-muted-foreground mt-1">MSISDN: {dispute.msisdn}</p>}
                {dispute.ban && <p className="text-xs text-muted-foreground mt-1">BAN: {dispute.ban}</p>}
              </CardContent>
            </Card>
          ))}
          {disputes.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No disputes</p>
          )}
        </div>
      </div>

      {/* Legal Column */}
      <div>
        <CardHeader className="px-0 pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Scale className="h-4 w-4" />
            Legal ({legalEscalations.length})
          </CardTitle>
        </CardHeader>
        <div className="space-y-2">
          {legalEscalations.map((legal) => (
            <Card
              key={legal.escalation_id}
              className="cursor-pointer hover:bg-card-legal/30 transition-colors"
              onClick={() => onLegalClick(legal)}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">{legal.agency_name}</span>
                  <Badge className={`text-xs ${legal.status === 'Completed' ? 'bg-success/10 text-success' : legal.status === 'Active' ? 'bg-warning/10 text-warning' : 'bg-info/10 text-info'}`}>
                    {legal.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">Outstanding: ${legal.outstanding_amount.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Recovered: ${legal.recovered_amount.toLocaleString()}</p>
                {legal.msisdn && <p className="text-xs text-muted-foreground mt-1">MSISDN: {legal.msisdn}</p>}
                {legal.ban && <p className="text-xs text-muted-foreground mt-1">BAN: {legal.ban}</p>}
              </CardContent>
            </Card>
          ))}
          {legalEscalations.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No legal cases</p>
          )}
        </div>
      </div>
    </div>
  );
}
