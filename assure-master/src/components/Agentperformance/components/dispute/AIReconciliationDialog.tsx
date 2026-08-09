import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Download, Sparkles, TrendingUp, AlertTriangle, CheckCircle2, User, DollarSign, Activity, FileText, Receipt, Brain, AlertCircle, XCircle, Scale } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AIReconciliationResult } from "@/types/dispute";

interface AIReconciliationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: AIReconciliationResult | null;
  isAnalyzing: boolean;
}

export const AIReconciliationDialog = ({ open, onOpenChange, result, isAnalyzing }: AIReconciliationDialogProps) => {
  const handleDownloadReport = () => {
    if (!result) return;

    const reportContent = `
AI RECONCILIATION REPORT
========================

Confidence: ${(result.confidence * 100).toFixed(0)}%

Customer & Issue:
${result.customer_and_issue}

Invoices & Payments:
${result.invoices_and_payments}

Behaviour & Risk:
${result.behaviour_and_risk}

Payment History: ${result.payment_history_badge}
Customer Behavior: ${result.customer_behavior_badge}
Financial Health: ${result.financial_health_badge}

Risk Assessment:
${result.risk_assessment_short}

Recommended Actions:
${result.recommended_actions_internal.map((action, idx) => `${idx + 1}. ${action}`).join('\n')}

Suggested Resolution:
${result.suggested_resolution_short}

Customer Message:
${result.customer_message}
    `;

    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-reconciliation-report-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            Reconcile RPA Summary Report
          </DialogTitle>
          <DialogDescription>
            Structured dispute analysis with recommended actions
          </DialogDescription>
        </DialogHeader>

        {isAnalyzing ? (
          <div className="py-12 space-y-6">
            <div className="flex flex-col items-center gap-4">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              <p className="text-lg font-medium">Analyzing customer data...</p>
              <p className="text-sm text-muted-foreground">AI is processing payment history, behavior patterns, and financial metrics</p>
            </div>
            <Progress value={66} className="w-full" />
          </div>
        ) : result ? (
          <div className="space-y-6">
            {/* Dispute Validity Analysis */}
            <div className="space-y-4 p-6 bg-muted/30 rounded-lg border-2 border-primary/30">
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Dispute Validity Assessment</h3>
              </div>
              
              <div className="grid gap-4">
                {/* Validity Score */}
                <div className="flex items-center justify-between p-4 bg-background rounded-lg border-2 border-border">
                  <div className="flex items-center gap-3">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                      result.dispute_validity.is_valid 
                        ? 'bg-green-500/20 text-green-600' 
                        : 'bg-red-500/20 text-red-600'
                    }`}>
                      {result.dispute_validity.is_valid ? (
                        <CheckCircle2 className="h-6 w-6" />
                      ) : (
                        <XCircle className="h-6 w-6" />
                      )}
                    </div>
                    <div>
                      <p className="font-semibold text-lg">
                        {result.dispute_validity.is_valid ? 'Dispute is Valid' : 'Dispute is Not Valid'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Final Conclusion */}
                <div className={`p-4 rounded-lg border-2 ${
                  result.dispute_validity.is_valid 
                    ? 'bg-green-500/10 border-green-500/50' 
                    : 'bg-red-500/10 border-red-500/50'
                }`}>
                  <p className="font-semibold mb-2 flex items-center gap-2">
                    {result.dispute_validity.is_valid ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-red-600" />
                    )}
                    <span>Analysis Conclusion</span>
                  </p>
                  <p className="text-sm text-foreground">{result.dispute_validity.conclusion}</p>
                </div>

                {/* Relevant Invoice Records - Raw Data */}
                {result.dispute_validity.relevant_invoices && result.dispute_validity.relevant_invoices.length > 0 && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Relevant Invoice Records (Raw Data)
                    </p>
                    <div className="space-y-3">
                      {result.dispute_validity.relevant_invoices.map((invoice) => (
                        <div key={invoice.id} className="bg-muted/20 rounded-md p-4 border">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-bold">{invoice.id}</span>
                            <Badge variant={invoice.status === 'Paid' ? 'default' : invoice.status === 'Overdue' ? 'destructive' : 'secondary'}>
                              {invoice.status}
                            </Badge>
                          </div>
                          <Table>
                            <TableBody>
                              <TableRow>
                                <TableCell className="font-medium text-xs">Invoice ID</TableCell>
                                <TableCell className="text-xs">{invoice.id}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium text-xs">Invoice Date</TableCell>
                                <TableCell className="text-xs">{invoice.date}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium text-xs">Amount</TableCell>
                                <TableCell className="text-xs font-semibold">${invoice.amount.toLocaleString()}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium text-xs">Due Date</TableCell>
                                <TableCell className="text-xs">{invoice.dueDate}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium text-xs">Status</TableCell>
                                <TableCell className="text-xs">{invoice.status}</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                          {invoice.items && invoice.items.length > 0 && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-xs font-semibold mb-2">Line Items Breakdown:</p>
                              <div className="bg-background/50 rounded p-2">
                                <ul className="space-y-1">
                                  {invoice.items.map((item, idx) => (
                                    <li key={idx} className="text-xs text-foreground font-mono">
                                      {idx + 1}. {item}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Relevant Billing Records - Raw Data */}
                {result.dispute_validity.relevant_billing && result.dispute_validity.relevant_billing.length > 0 && (
                  <div className="pt-4 border-t">
                    <p className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Receipt className="h-4 w-4" />
                      Relevant Billing Records (Raw Data)
                    </p>
                    <div className="space-y-3">
                      {result.dispute_validity.relevant_billing.map((billing) => (
                        <div key={billing.id} className="bg-muted/20 rounded-md p-4 border">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-sm font-bold">{billing.period}</span>
                            {billing.outstanding > 0 && (
                              <Badge variant="destructive">Outstanding</Badge>
                            )}
                          </div>
                          <Table>
                            <TableBody>
                              <TableRow>
                                <TableCell className="font-medium text-xs">Billing ID</TableCell>
                                <TableCell className="text-xs">{billing.id}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium text-xs">Billing Period</TableCell>
                                <TableCell className="text-xs">{billing.period}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium text-xs">Total Billed</TableCell>
                                <TableCell className="text-xs font-semibold">${billing.totalBilled.toLocaleString()}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium text-xs">Total Paid</TableCell>
                                <TableCell className="text-xs text-green-600 font-semibold">${billing.totalPaid.toLocaleString()}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell className="font-medium text-xs">Outstanding Balance</TableCell>
                                <TableCell className="text-xs font-semibold text-destructive">${billing.outstanding.toLocaleString()}</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                          {billing.services && billing.services.length > 0 && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-xs font-semibold mb-2">Services Included:</p>
                              <div className="bg-background/50 rounded p-2">
                                <ul className="space-y-1">
                                  {billing.services.map((service, idx) => (
                                    <li key={idx} className="text-xs text-foreground font-mono">
                                      {idx + 1}. {service}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>


            {/* Customer & Issue */}
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-semibold mb-2">Customer & Issue</h3>
                  <p className="text-sm text-muted-foreground">{result.customer_and_issue}</p>
                </div>
              </div>
            </Card>

            {/* Invoices & Payments */}
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <DollarSign className="w-5 h-5 text-primary mt-0.5" />
                <div>
                  <h3 className="font-semibold mb-2">Invoices & Payments</h3>
                  <p className="text-sm text-muted-foreground">{result.invoices_and_payments}</p>
                </div>
              </div>
            </Card>

            {/* Behaviour & Risk */}
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <Activity className="w-5 h-5 text-primary mt-0.5" />
                <div className="w-full">
                  <h3 className="font-semibold mb-2">Behaviour & Risk</h3>
                  <p className="text-sm text-muted-foreground mb-3">{result.behaviour_and_risk}</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                    <div className="p-3 bg-muted/30 rounded">
                      <p className="text-xs text-muted-foreground mb-1">Payment History</p>
                      <Badge variant="outline" className="w-full justify-center text-xs">
                        {result.payment_history_badge}
                      </Badge>
                    </div>
                    <div className="p-3 bg-muted/30 rounded">
                      <p className="text-xs text-muted-foreground mb-1">Customer Behavior</p>
                      <Badge variant="outline" className="w-full justify-center text-xs">
                        {result.customer_behavior_badge}
                      </Badge>
                    </div>
                    <div className="p-3 bg-muted/30 rounded">
                      <p className="text-xs text-muted-foreground mb-1">Financial Health</p>
                      <Badge variant="outline" className="w-full justify-center text-xs">
                        {result.financial_health_badge}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Separator />

            {/* Risk Assessment */}
            <Card className="p-4 border-l-4 border-l-yellow-500">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold mb-2">Risk Assessment</h3>
                  <p className="text-sm text-muted-foreground">{result.risk_assessment_short}</p>
                </div>
              </div>
            </Card>

            {/* Recommended Actions */}
            <Card className="p-4 border-l-4 border-l-blue-500">
              <div className="flex items-start gap-3">
                <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="w-full">
                  <h3 className="font-semibold mb-3">Recommended Actions</h3>
                  <ul className="space-y-2">
                    {result.recommended_actions_internal.map((action, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <span className="text-primary font-semibold mt-0.5">{idx + 1}.</span>
                        <span className="text-muted-foreground">{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>

            {/* Suggested Resolution */}
            <Card className="p-4 border-l-4 border-l-green-500">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                <div>
                  <h3 className="font-semibold mb-2">Suggested Resolution</h3>
                  <p className="text-sm text-muted-foreground">{result.suggested_resolution_short}</p>
                </div>
              </div>
            </Card>

            {/* Customer Message */}
            <Card className="p-4 bg-primary/5">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <span>Message to Customer</span>
              </h3>
              <p className="text-sm text-muted-foreground italic">{result.customer_message}</p>
            </Card>

            {/* Actions */}
            <div className="flex justify-between pt-4">
              <Button variant="outline" onClick={handleDownloadReport}>
                <Download className="w-4 h-4 mr-2" />
                Download Report
              </Button>
              <Button onClick={() => onOpenChange(false)}>Close</Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
};
