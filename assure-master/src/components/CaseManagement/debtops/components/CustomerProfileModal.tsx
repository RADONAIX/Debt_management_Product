import { X, AlertCircle, TrendingUp, Download, User } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Customer360 } from '../types/customer';
import { Separator } from '@/components/ui/separator';

interface CustomerProfileModalProps {
  customer: Customer360 | null;
  open: boolean;
  onClose: () => void;
  isGrouped?: boolean;
  groupedCustomers?: Customer360[];
}

export function CustomerProfileModal({ customer, open, onClose, isGrouped = false, groupedCustomers = [] }: CustomerProfileModalProps) {
  if (!customer) return null;

  const getInitials = () => {
    if (customer.customer_type === 'Enterprise' && customer.company_name) {
      return customer.company_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    }
    return customer.full_name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'NA';
  };

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'bg-risk-high text-white';
    if (score >= 60) return 'bg-risk-medium text-white';
    return 'bg-risk-low text-white';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 border-2 border-border">
                <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="text-xl font-bold">
                  {customer.customer_type === 'Enterprise' ? customer.company_name : customer.full_name}
                </div>
                <div className="text-sm text-muted-foreground">{customer.customer_id}</div>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs text-muted-foreground">Outstanding</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">
                  ${customer.total_outstanding.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs text-muted-foreground">Days Past Due</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{customer.days_past_due}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs text-muted-foreground">Risk Score</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className={getRiskColor(customer.risk_score)}>
                  {customer.risk_score}
                </Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs text-muted-foreground">Credit Score</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{customer.credit_score}</div>
              </CardContent>
            </Card>
          </div>

          {/* Next Action */}
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                Next Action Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                Follow up on broken payment promise. Customer has not responded to last 3 contact attempts.
                Escalation to legal recommended if no contact within 5 days.
              </p>
            </CardContent>
          </Card>

          <Separator />

          {/* Customer Details */}
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <User className="h-4 w-4" />
                Contact Information
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Type:</span>{' '}
                  <span className="font-medium">{customer.customer_type}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Email:</span>{' '}
                  <span className="font-medium">{customer.email}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone:</span>{' '}
                  <span className="font-medium">{customer.contact_number}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Country:</span>{' '}
                  <span className="font-medium">{customer.country}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>{' '}
                  <Badge variant="outline">{customer.status}</Badge>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Account Management
              </h3>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Assigned Agent:</span>{' '}
                  <span className="font-medium">{customer.assigned_agent || 'Unassigned'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Aging Bucket:</span>{' '}
                  <Badge variant="outline">{customer.aging_bucket} days</Badge>
                </div>
                <div className="pt-2">
                  <Button variant="outline" size="sm" className="w-full">
                    Reassign Agent
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Grouped Customers Table */}
          {isGrouped && groupedCustomers.length > 0 && (
            <>
              <div>
                <h3 className="font-semibold mb-3">Individual Customer Details</h3>
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="text-left p-3 font-medium text-muted-foreground">Customer Name</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Customer ID</th>
                        <th className="text-left p-3 font-medium text-muted-foreground">Contact</th>
                        <th className="text-right p-3 font-medium text-muted-foreground">Outstanding</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">DPD</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">Risk</th>
                        <th className="text-center p-3 font-medium text-muted-foreground">Credit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupedCustomers.map((c, idx) => (
                        <tr key={c.customer_id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/30'}>
                          <td className="p-3 font-medium">{c.full_name}</td>
                          <td className="p-3 text-muted-foreground">{c.customer_id}</td>
                          <td className="p-3">
                            <div className="text-xs">
                              <div>{c.email}</div>
                              <div className="text-muted-foreground">{c.contact_number}</div>
                            </div>
                          </td>
                          <td className="p-3 text-right font-semibold text-destructive">
                            ${c.total_outstanding.toLocaleString()}
                          </td>
                          <td className="p-3 text-center">{c.days_past_due}d</td>
                          <td className="p-3 text-center">
                            <Badge className={getRiskColor(c.risk_score)}>{c.risk_score}</Badge>
                          </td>
                          <td className="p-3 text-center">{c.credit_score}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button className="flex-1">
              <User className="h-4 w-4 mr-2" />
              Assign Agent
            </Button>
            <Button variant="outline" className="flex-1">
              View Full Case
            </Button>
            <Button variant="outline" className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Download Statement
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
