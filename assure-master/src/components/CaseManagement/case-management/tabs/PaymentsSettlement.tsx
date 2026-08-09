import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Payment } from "@/data/mockCases";
import { DollarSign, Link as LinkIcon, TrendingUp, CheckCircle } from "lucide-react";

interface PaymentsSettlementProps {
  payments: Payment[];
  totalAmount: number;
}

export const PaymentsSettlement = ({ payments, totalAmount }: PaymentsSettlementProps) => {
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = totalAmount - totalPaid;
  const paymentPercentage = (totalPaid / totalAmount) * 100;

  return (
    <div className="space-y-6">
      <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold">Payment Summary</h4>
            <DollarSign className="h-5 w-5 text-primary" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Total Amount</p>
              <p className="text-lg font-bold">$ {totalAmount.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Paid</p>
              <p className="text-lg font-bold text-green-600">$ {totalPaid.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Remaining</p>
              <p className="text-lg font-bold text-orange-600">$ {remaining.toLocaleString()}</p>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Payment Progress</span>
              <span className="font-medium">{paymentPercentage.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${paymentPercentage}%` }}
              />
            </div>
          </div>
        </div>
      </Card>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold">Payment Links</h4>
          <Button size="sm" className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
            <LinkIcon className="h-3 w-3" />
            Send Payment Link
          </Button>
        </div>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground">No payment links sent yet</p>
        </Card>
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-3">Payment History</h4>
        {payments.length === 0 ? (
          <Card className="p-8">
            <p className="text-sm text-muted-foreground text-center">No payments recorded yet</p>
          </Card>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="text-sm">{payment.date}</TableCell>
                    <TableCell className="font-semibold">$ {payment.amount.toLocaleString()}</TableCell>
                    <TableCell className="text-sm">{payment.method}</TableCell>
                    <TableCell>
                      <Badge className="bg-green-500 text-white gap-1">
                        <CheckCircle className="h-3 w-3" />
                        {payment.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold">Settlement Options</h4>
          <Button size="sm" variant="outline" className="gap-2">
            <TrendingUp className="h-3 w-3" />
            AI Recommendation
          </Button>
        </div>
        <Card className="p-4 border-primary">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <h5 className="font-semibold text-sm mb-1">AI Suggested Settlement</h5>
              <p className="text-sm text-muted-foreground mb-3">
                Based on customer profile and payment history, recommend 2-installment plan
              </p>
              <div className="flex gap-2">
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">Create Settlement Offer</Button>
                <Button size="sm" variant="outline">View Details</Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
