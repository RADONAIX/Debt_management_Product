import { useState } from "react";
import { SHARED_CUSTOMERS } from "@/components/shared/customerData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { 
  Search, 
  Phone, 
  Mail, 
  Calendar, 
  DollarSign, 
  AlertCircle, 
  MessageSquare, 
  FileText, 
  TrendingUp,
  Users,
  CreditCard,
  Building2,
  Clock,
  CheckCircle,
  XCircle,
  User
} from "lucide-react";

interface CustomerProfileProps {
  selectedCustomer: any;
}

export default function CustomerProfile({ selectedCustomer }: CustomerProfileProps) {

  // Use shared customer data for consistency across all components
  const customers = SHARED_CUSTOMERS;

  const getRiskBadgeVariant = (risk: string) => {
    switch (risk) {
      case "low": return "default";
      case "medium": return "secondary";
      case "high": return "destructive"; 
      case "critical": return "destructive";
      default: return "secondary";
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "Active": return "default";
      case "Delinquent": return "destructive";
      case "Closed": return "secondary";
      default: return "secondary";
    }
  };

  const getMilestoneIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "in_progress": return <Clock className="w-4 h-4 text-yellow-500" />;
      case "pending": return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
      default: return <XCircle className="w-4 h-4 text-red-500" />;
    }
  };

  if (!selectedCustomer) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Select a customer to view their profile</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {selectedCustomer ? (
        <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Avatar className="h-16 w-16">
                      <AvatarFallback className="text-lg">
                        {selectedCustomer?.name?.split(' ').map((n: string) => n[0]).join('') || 'NA'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-2xl">{selectedCustomer?.name || 'Unknown Customer'}</CardTitle>
                      <CardDescription className="text-lg">{selectedCustomer?.id || 'N/A'}</CardDescription>
                      <div className="flex items-center space-x-2 mt-2">
                        <Badge variant={getStatusBadgeVariant(selectedCustomer?.accountStatus || 'Unknown')}>
                          {selectedCustomer?.accountStatus || 'Unknown'}
                        </Badge>
                        <Badge variant={getRiskBadgeVariant(selectedCustomer?.riskBand || 'unknown')}>
                          {selectedCustomer?.riskBand?.toUpperCase() || 'UNKNOWN'} RISK
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="overview" className="w-full">
                  <TabsList className="grid w-full grid-cols-6">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="payments">Payments</TabsTrigger>
                    <TabsTrigger value="milestones">Milestones</TabsTrigger>
                    <TabsTrigger value="interactions">Interactions</TabsTrigger>
                    <TabsTrigger value="disputes">Disputes</TabsTrigger>
                    <TabsTrigger value="notes">Notes</TabsTrigger>
                  </TabsList>
                  
                  {/* Overview Tab */}
                  <TabsContent value="overview" className="space-y-6">

                    {/* Account Information */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Account Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Contact Information</p>
                            <div className="flex items-center space-x-2 mt-1">
                              <Phone className="w-4 h-4 text-muted-foreground" />
                              <span>{selectedCustomer.phone}</span>
                            </div>
                            <div className="flex items-center space-x-2 mt-1">
                              <Mail className="w-4 h-4 text-muted-foreground" />
                              <span>{selectedCustomer.email}</span>
                            </div>
                            <div className="flex items-center space-x-2 mt-1">
                              {/* <Building2 className="w-4 h-4 text-muted-foreground" /> */}
                              <span className="text-sm">{selectedCustomer.address}</span>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <p className="text-sm text-muted-foreground">Contract Details</p>
                            <p className="font-medium">{selectedCustomer.contractPlan}</p>
                            <p className="text-sm">Tenure: {selectedCustomer.tenure}</p>
                            <p className="text-sm">Late Payment Penalty: {selectedCustomer.latePaymentPenaltyRate}</p>
                            <p className="text-sm">Activation: {selectedCustomer.activationDate}</p>
                          </div>
                        </div>
                      </div>
                     </div>

                     {/* Service Usage & Billing */}
                     <Separator />
                     <div>
                       <h3 className="text-lg font-semibold mb-4">Current Month Usage & Billing</h3>
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                         <Card>
                           <CardHeader>
                             <CardTitle className="text-base">Usage Summary</CardTitle>
                           </CardHeader>
                           <CardContent className="space-y-2">
                             <div className="flex justify-between">
                               <span className="text-sm">Data Used:</span>
                               <span className="font-medium">{selectedCustomer.usageThisMonth?.data || selectedCustomer.dataUsedLastMonth || "N/A"}</span>
                             </div>
                             <div className="flex justify-between">
                               <span className="text-sm">Voice Minutes:</span>
                               <span className="font-medium">{selectedCustomer.usageThisMonth?.calls ? `${selectedCustomer.usageThisMonth.calls} mins` : selectedCustomer.voiceMinutesUsed || "N/A"}</span>
                             </div>
                             <div className="flex justify-between">
                               <span className="text-sm">SMS Count:</span>
                               <span className="font-medium">{selectedCustomer.usageThisMonth?.sms || selectedCustomer.smsCount || "N/A"}</span>
                             </div>
                             <div className="flex justify-between">
                               <span className="text-sm">International:</span>
                               <span className="font-medium">{selectedCustomer.internationalCharges ? `${selectedCustomer.internationalCharges} mins` : "0 mins"}</span>
                             </div>
                           </CardContent>
                         </Card>
                         
                         <Card>
                           <CardHeader>
                             <CardTitle className="text-base">Billing Breakdown</CardTitle>
                           </CardHeader>
                           <CardContent className="space-y-2">
                             <div className="flex justify-between">
                               <span className="text-sm">Base Plan:</span>
                               <span className="font-medium">${selectedCustomer.basePlan || "N/A"}</span>
                             </div>
                             <div className="flex justify-between">
                               <span className="text-sm">Device Financing:</span>
                               <span className="font-medium">${selectedCustomer.deviceFinancing?.monthlyInstallment || "0"}</span>
                             </div>
                             <div className="flex justify-between">
                               <span className="text-sm">Roaming Charges:</span>
                               <span className="font-medium">${selectedCustomer.roamingCharges || "0"}</span>
                             </div>
                             <div className="flex justify-between">
                               <span className="text-sm">Value Added Services:</span>
                               <span className="font-medium">${selectedCustomer.vasCharges || "0"}</span>
                             </div>
                           </CardContent>
                         </Card>
                       </div>
                     </div>

                     {/* Device Information */}
                     {(selectedCustomer.deviceInfo || selectedCustomer.deviceFinancing) && (
                       <>
                         <Separator />
                         <div>
                           <h3 className="text-lg font-semibold mb-4">Device Information</h3>
                           <Card>
                             <CardContent className="p-4">
                               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                 <div>
                                   <p className="text-sm text-muted-foreground">Device Model</p>
                                   <p className="font-medium">{selectedCustomer.deviceFinancing?.device || selectedCustomer.devicePlan || "N/A"}</p>
                                 </div>
                                 <div>
                                   <p className="text-sm text-muted-foreground">IMEI</p>
                                   <p className="font-medium">{"••••••••••••" + (selectedCustomer.phone?.slice(-4) || "0000")}</p>
                                 </div>
                                 <div>
                                   <p className="text-sm text-muted-foreground">Financing Balance</p>
                                   <p className="font-medium">${selectedCustomer.deviceFinancing?.remainingBalance || "0"}</p>
                                 </div>
                                 <div>
                                   <p className="text-sm text-muted-foreground">Monthly Installment</p>
                                   <p className="font-medium">${selectedCustomer.deviceFinancing?.monthlyInstallment || "0"}</p>
                                 </div>
                               </div>
                             </CardContent>
                           </Card>
                         </div>
                       </>
                     )}

                      {/* Payment Plans */}
                      {selectedCustomer.paymentPlans && selectedCustomer.paymentPlans.length > 0 && (
                      <>
                        <Separator />
                        <div>
                          <h3 className="text-lg font-semibold mb-4">Active Payment Plans</h3>
                          {selectedCustomer.paymentPlans.map((plan: any) => (
                            <Card key={plan.id}>
                              <CardContent className="p-4">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <p className="font-medium">Plan {plan.id}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {plan.installments} installments of ${plan.monthlyAmount.toFixed(2)}
                                    </p>
                                    <p className="text-sm text-muted-foreground">
                                      {plan.startDate} to {plan.endDate}
                                    </p>
                                  </div>
                                  <Badge variant="default">{plan.status}</Badge>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </>
                    )}
                  </TabsContent>

                  {/* Payments Tab */}
                  <TabsContent value="payments" className="space-y-4">
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Payment History</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Method</TableHead>
                          </TableRow>
                        </TableHeader>
                          <TableBody>
                            {(selectedCustomer.paymentHistory || []).map((payment: any, index: number) => (
                             <TableRow key={index}>
                               <TableCell>{payment.date || payment.month || "N/A"}</TableCell>
                               <TableCell>${payment.amount}</TableCell>
                               <TableCell>
                                 <Badge variant={
                                   payment.status === 'paid' ? 'default' : 
                                   payment.status === 'late' ? 'secondary' : 'destructive'
                                 }>
                                   {payment.status}
                                 </Badge>
                               </TableCell>
                               <TableCell>{payment.method || "N/A"}</TableCell>
                             </TableRow>
                           ))}
                         </TableBody>
                      </Table>
                    </div>

                    <Separator />

                    <div>
                      <h3 className="text-lg font-semibold mb-4">Adjustments</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Reason</TableHead>
                          </TableRow>
                        </TableHeader>
                         <TableBody>
                           {(selectedCustomer.adjustments || []).map((adjustment: any, index: number) => (
                            <TableRow key={index}>
                              <TableCell>{adjustment.date}</TableCell>
                              <TableCell>{adjustment.type}</TableCell>
                              <TableCell className={adjustment.amount < 0 ? 'text-green-600' : 'text-red-600'}>
                                ${Math.abs(adjustment.amount)}
                              </TableCell>
                              <TableCell>{adjustment.reason}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>

                  {/* Milestones Tab */}
                  <TabsContent value="milestones" className="space-y-4">
                    <div>
                     <h3 className="text-lg font-semibold mb-4">Collections Milestones</h3>
                     {selectedCustomer.collectionsMilestones && selectedCustomer.collectionsMilestones.length > 0 ? (
                       <div className="space-y-3">
                         {(selectedCustomer.collectionsMilestones || []).map((milestone: any, index: number) => (
                           <Card key={index}>
                             <CardContent className="p-4">
                               <div className="flex items-center justify-between">
                                 <div className="flex items-center space-x-3">
                                   {getMilestoneIcon(milestone.status)}
                                   <div>
                                     <p className="font-medium">{milestone.milestone}</p>
                                     <p className="text-sm text-muted-foreground">{milestone.date}</p>
                                   </div>
                                 </div>
                                 <Badge variant={
                                   milestone.status === 'completed' ? 'default' :
                                   milestone.status === 'in_progress' ? 'secondary' : 'outline'
                                 }>
                                   {milestone.status ? milestone.status.replace('_', ' ') : 'Unknown'}
                                 </Badge>
                               </div>
                             </CardContent>
                           </Card>
                         ))}
                       </div>
                     ) : (
                       <div className="text-center py-8">
                         <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                         <p className="text-muted-foreground">No milestones found for this customer</p>
                       </div>
                     )}
                    </div>
                  </TabsContent>

                  {/* Interactions Tab */}
                  <TabsContent value="interactions" className="space-y-4">
                    <div>
                     <h3 className="text-lg font-semibold mb-4">Customer Interactions</h3>
                     {selectedCustomer.interactions && selectedCustomer.interactions.length > 0 ? (
                       <div className="space-y-3">
                         {(selectedCustomer.interactions || []).map((interaction: any, index: number) => (
                           <Card key={index}>
                             <CardContent className="p-4">
                               <div className="flex justify-between items-start">
                                 <div className="flex-1">
                                   <div className="flex items-center space-x-2 mb-2">
                                     <Badge variant="outline">{interaction.type}</Badge>
                                     <span className="text-sm text-muted-foreground">{interaction.date}</span>
                                     <span className="text-sm font-medium">by {interaction.agent}</span>
                                   </div>
                                   <p className="text-sm mb-2">{interaction.summary}</p>
                                   <p className="text-sm font-medium text-primary">Outcome: {interaction.outcome}</p>
                                 </div>
                               </div>
                             </CardContent>
                           </Card>
                         ))}
                       </div>
                     ) : (
                       <div className="text-center py-8">
                         <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                         <p className="text-muted-foreground">No interactions found for this customer</p>
                       </div>
                     )}
                    </div>
                  </TabsContent>

                  {/* Disputes Tab */}
                  <TabsContent value="disputes" className="space-y-4">
                    <div>
                       <h3 className="text-lg font-semibold mb-4">Disputes</h3>
                       {selectedCustomer.disputes && selectedCustomer.disputes.length > 0 ? (
                        <div className="space-y-3">
                          {selectedCustomer.disputes.map((dispute: any, index: number) => (
                            <Card key={index}>
                              <CardContent className="p-4">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <div className="flex items-center space-x-2 mb-2">
                                      <Badge variant="outline">{dispute.type}</Badge>
                                      <span className="text-sm text-muted-foreground">{dispute.date}</span>
                                    </div>
                                    <p className="text-sm mb-1">Amount: ${dispute.amount}</p>
                                    <p className="text-sm text-muted-foreground">Resolution: {dispute.resolution}</p>
                                  </div>
                                  <Badge variant={dispute.status === 'resolved' ? 'default' : 'secondary'}>
                                    {dispute.status}
                                  </Badge>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      ) : (
                        <Card>
                          <CardContent className="p-6 text-center">
                            <p className="text-muted-foreground">No disputes found for this customer.</p>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </TabsContent>

                  {/* Notes Tab */}
                  <TabsContent value="notes" className="space-y-4">
                    <div>
                     <h3 className="text-lg font-semibold mb-4">Customer Notes</h3>
                     {selectedCustomer.notes && selectedCustomer.notes.length > 0 ? (
                       <div className="space-y-3">
                         {(selectedCustomer.notes || []).map((note: any, index: number) => (
                           <Card key={index}>
                             <CardContent className="p-4">
                               <div className="flex items-start space-x-3">
                                 <Avatar className="h-8 w-8">
                                    <AvatarFallback className="text-xs">
                                      {note.agent?.split(' ').map((n: string) => n[0]).join('') || 'NA'}
                                    </AvatarFallback>
                                 </Avatar>
                                 <div className="flex-1">
                                    <div className="flex items-center space-x-2 mb-1">
                                      <span className="font-medium text-sm">{note.agent || 'Unknown Agent'}</span>
                                      <span className="text-xs text-muted-foreground">{note.date || 'Unknown Date'}</span>
                                   </div>
                                   <p className="text-sm">{note.note}</p>
                                 </div>
                               </div>
                             </CardContent>
                           </Card>
                         ))}
                       </div>
                     ) : (
                       <div className="text-center py-8">
                         <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                         <p className="text-muted-foreground">No notes found for this customer</p>
                       </div>
                     )}
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
      ) : (
        <div className="text-center py-12">
          <User className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">No Customer Selected</h3>
          <p className="text-muted-foreground">Customer details will appear here when selected from the search panel</p>
        </div>
      )}
    </div>
  );
}