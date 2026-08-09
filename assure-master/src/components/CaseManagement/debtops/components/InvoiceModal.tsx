import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Invoice } from '../types/customer';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface InvoiceModalProps {
  open: boolean;
  onClose: () => void;
  invoices: Invoice[];
  customerName: string;
}

export function InvoiceModal({ open, onClose, invoices, customerName }: InvoiceModalProps) {
  const getStatusColor = (status: string) => {
    if (status === 'Paid') return 'bg-status-success/10 text-status-success border-status-success/20';
    if (status === 'Overdue') return 'bg-status-error/10 text-status-error border-status-error/20';
    return 'bg-status-warning/10 text-status-warning border-status-warning/20';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Invoices - {customerName}</DialogTitle>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice ID</TableHead>
              <TableHead>Service</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice) => (
              <TableRow key={invoice.invoice_id}>
                <TableCell className="font-mono text-xs">{invoice.invoice_id.slice(0, 8)}</TableCell>
                <TableCell>{invoice.service}</TableCell>
                <TableCell className="text-xs">
                  {new Date(invoice.bill_period_start).toLocaleDateString()} - {new Date(invoice.bill_period_end).toLocaleDateString()}
                </TableCell>
                <TableCell>{new Date(invoice.due_date).toLocaleDateString()}</TableCell>
                <TableCell className="font-semibold">${invoice.amount.toLocaleString()}</TableCell>
                <TableCell>
                  <Badge className={getStatusColor(invoice.status)}>{invoice.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
