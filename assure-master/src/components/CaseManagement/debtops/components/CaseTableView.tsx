import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table';
import { PTPPromise, CaseManagement, Dispute, LegalEscalation } from '../types/customer';
import { mockCustomers } from '../lib/mockData';

interface CaseTableViewProps {
  ptps: PTPPromise[];
  cases: CaseManagement[];
  disputes: Dispute[];
  legalEscalations: LegalEscalation[];
  onPTPClick: (ptp: PTPPromise) => void;
  onCaseClick: (caseData: CaseManagement) => void;
  onDisputeClick: (dispute: Dispute) => void;
  onLegalClick: (legal: LegalEscalation) => void;
}

type CaseItem = {
  id: string;
  type: 'PTP' | 'CASE' | 'DISPUTE' | 'LEGAL';
  customerId: string;
  customerName: string;
  title: string;
  labels: string[];
  status: string;
  data: PTPPromise | CaseManagement | Dispute | LegalEscalation;
};

export function CaseTableView({
  ptps,
  cases,
  disputes,
  legalEscalations,
  onPTPClick,
  onCaseClick,
  onDisputeClick,
  onLegalClick,
}: CaseTableViewProps) {
  const getStatusVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'created':
      case 'open':
      case 'investigating':
      case 'active':
        return 'default';
      case 'fulfilled':
      case 'closed':
      case 'approved':
      case 'completed':
        return 'secondary';
      case 'broken':
      case 'rejected':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  // Combine all items into a flat list
  const allItems: CaseItem[] = [
    ...ptps.map((ptp) => {
      const customer = mockCustomers.find(c => c.customer_id === ptp.customer_id);
      return {
        id: ptp.ptp_id,
        type: 'PTP' as const,
        customerId: ptp.customer_id,
        customerName: customer?.full_name || customer?.company_name || ptp.customer_id,
        title: `Promise to Pay - $${ptp.promised_amount.toLocaleString()}`,
        labels: [
          `Due: ${new Date(ptp.promised_date).toLocaleDateString()}`,
          ptp.customer_type || 'Consumer'
        ],
        status: ptp.status,
        data: ptp
      };
    }),
    ...cases.map((caseData) => {
      const customer = mockCustomers.find(c => c.customer_id === caseData.customer_id);
      return {
        id: caseData.case_id,
        type: 'CASE' as const,
        customerId: caseData.customer_id,
        customerName: customer?.full_name || customer?.company_name || caseData.customer_id,
        title: `${caseData.case_type} - ${caseData.summary}`,
        labels: [
          `Opened: ${new Date(caseData.opened_date).toLocaleDateString()}`,
          caseData.assigned_agent || 'Unassigned'
        ],
        status: caseData.status,
        data: caseData
      };
    }),
    ...disputes.map((dispute) => {
      const customer = mockCustomers.find(c => c.customer_id === dispute.customer_id);
      return {
        id: dispute.dispute_id,
        type: 'DISPUTE' as const,
        customerId: dispute.customer_id,
        customerName: customer?.full_name || customer?.company_name || dispute.customer_id,
        title: `Dispute - ${dispute.reason}`,
        labels: [
          dispute.amount ? `$${dispute.amount.toLocaleString()}` : 'N/A',
          `Filed: ${new Date(dispute.filed_date).toLocaleDateString()}`
        ],
        status: dispute.status,
        data: dispute
      };
    }),
    ...legalEscalations.map((legal) => {
      const customer = mockCustomers.find(c => c.customer_id === legal.customer_id);
      return {
        id: legal.escalation_id,
        type: 'LEGAL' as const,
        customerId: legal.customer_id,
        customerName: customer?.full_name || customer?.company_name || legal.customer_id,
        title: `Legal Escalation - ${legal.agency_name}`,
        labels: [
          `Outstanding: $${legal.outstanding_amount.toLocaleString()}`,
          `Escalated: ${new Date(legal.escalated_at).toLocaleDateString()}`
        ],
        status: legal.status,
        data: legal
      };
    })
  ];

  const handleRowClick = (item: CaseItem) => {
    switch (item.type) {
      case 'PTP':
        onPTPClick(item.data as PTPPromise);
        break;
      case 'CASE':
        onCaseClick(item.data as CaseManagement);
        break;
      case 'DISPUTE':
        onDisputeClick(item.data as Dispute);
        break;
      case 'LEGAL':
        onLegalClick(item.data as LegalEscalation);
        break;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'PTP':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
      case 'CASE':
        return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200';
      case 'DISPUTE':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
      case 'LEGAL':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200';
    }
  };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <Table>
        <TableBody>
          {allItems.map((item) => (
            <TableRow
              key={`${item.type}-${item.id}`}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleRowClick(item)}
            >
              <TableCell className="w-12">
                <input type="checkbox" className="rounded border-border" />
              </TableCell>
              <TableCell className="font-medium w-32">
                <span className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${getTypeColor(item.type)}`}>
                  {item.id}
                </span>
              </TableCell>
              <TableCell className="max-w-md">
                <div className="flex flex-col gap-1">
                  <span className="font-medium text-foreground">{item.title}</span>
                  <span className="text-sm text-muted-foreground">{item.customerName}</span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {item.labels.map((label, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {label}
                    </Badge>
                  ))}
                </div>
              </TableCell>
              <TableCell className="w-32">
                <Badge variant={getStatusVariant(item.status)}>{item.status}</Badge>
              </TableCell>
              <TableCell className="w-16 text-center">
                <span className="text-muted-foreground">☰</span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      
      {allItems.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No cases found</p>
        </div>
      )}
    </div>
  );
}

