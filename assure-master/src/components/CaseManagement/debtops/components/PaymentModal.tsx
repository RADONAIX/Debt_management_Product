import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Payment } from '../types/customer';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface PaymentModalProps {
  open: boolean;
  onClose: () => void;
  payments: Payment[];
  customerName: string;
}

export function PaymentModal({ open, onClose, payments, customerName }: PaymentModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Payment History - {customerName}</DialogTitle>
        </DialogHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Payment ID</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Method</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => (
              <TableRow key={payment.payment_id}>
                <TableCell className="font-mono text-xs">{payment.payment_id.slice(0, 8)}</TableCell>
                <TableCell>{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                <TableCell className="font-semibold">${payment.amount_paid.toLocaleString()}</TableCell>
                <TableCell>{payment.method}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{payment.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}
