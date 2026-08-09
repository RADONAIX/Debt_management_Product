import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useCustomerType } from "@/contexts/CustomerTypeContext";
  import { 
  Search, 
  Plus, 
  Calendar, 
  DollarSign, 
  CheckCircle, 
  XCircle, 
  Clock,
  AlertTriangle,
  Bell,
  Building,
  User,
  FileText,
  Users,
  Brain,
  Phone,
  Mail,
  MessageSquare,
  CreditCard,
  History
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface RecentInteraction {
  id: string;
  date: string;
  type: "call" | "email" | "sms" | "payment" | "reminder";
  description: string;
  agent?: string;
  outcome?: "successful" | "no_response" | "partial" | "scheduled";
}

interface PTP {
  id: string;
  customerId: string;
  customerName: string;
  customerType: "normal" | "enterprise";
  committedAmount: number;
  contractValue?: number;
  dueDate: string;
  status: "open" | "fulfilled" | "broken";
  createdBy: string;
  createdDate: string;
  remarks: string;
  daysRemaining: number;
  accountManager?: string;
  contractReference?: string;
  paymentTerms?: string;
  approvalLevel?: "standard" | "manager" | "executive";
  mlPrediction?: string;
  mlAccuracy?: number;
  mlRiskLevel?: "High" | "Medium" | "Low";
  recentInteractions?: RecentInteraction[];
}

export default function PromiseToPay() {
  const { customerType } = useCustomerType();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPTP, setSelectedPTP] = useState<PTP | null>(null);
  const [newPTPDialog, setNewPTPDialog] = useState(false);

  // Mock PTP data - updated with enterprise customers
  const allPTPs: PTP[] = [
    // Normal customers
    {
      id: "PTP001",
      customerId: "CUST001",
      customerName: "John Anderson",
      customerType: "normal",
      committedAmount: 800,
      dueDate: "2024-02-05",
      status: "open",
      createdBy: "Agent Smith",
      createdDate: "2024-01-25",
      remarks: "Customer agreed to pay overdue amount by month end",
      daysRemaining: 3,
      mlPrediction: "73.2%",
      mlAccuracy: 91,
      mlRiskLevel: "Medium",
      recentInteractions: [
        {
          id: "INT001",
          date: "2024-02-01",
          type: "call",
          description: "Customer confirmed payment plan, requested 2-day extension",
          agent: "Agent Smith",
          outcome: "scheduled"
        },
        {
          id: "INT002",
          date: "2024-01-30",
          type: "email",
          description: "Sent payment reminder with account details",
          agent: "Agent Smith",
          outcome: "no_response"
        },
        {
          id: "INT003",
          date: "2024-01-28",
          type: "sms",
          description: "SMS reminder sent for upcoming due date",
          agent: "System",
          outcome: "successful"
        }
      ]
    },
    {
      id: "PTP002",
      customerId: "CUST002", 
      customerName: "Sarah Mitchell",
      customerType: "normal",
      committedAmount: 1200,
      dueDate: "2024-01-13",
      status: "broken",
      createdBy: "Agent Johnson",
      createdDate: "2024-01-20",
      remarks: "Partial payment arrangement - customer committed to 50% of overdue",
      daysRemaining: -3,
      mlPrediction: "89.1%",
      mlAccuracy: 94,
      mlRiskLevel: "High",
      recentInteractions: [
        {
          id: "INT004",
          date: "2024-01-31",
          type: "call",
          description: "Customer unable to meet commitment, requested further extension",
          agent: "Agent Johnson",
          outcome: "no_response"
        },
        {
          id: "INT005",
          date: "2024-01-29",
          type: "email",
          description: "Final notice sent before escalation",
          agent: "Agent Johnson",
          outcome: "no_response"
        },
        {
          id: "INT006",
          date: "2024-01-26",
          type: "payment",
          description: "Partial payment received - $200 of $600 committed",
          agent: "System",
          outcome: "partial"
        }
      ]
    },
    // New customers for Due Today & Overdue table
    {
      id: "PTP003",
      customerId: "CUST003",
      customerName: "Michael Chen",
      customerType: "normal",
      committedAmount: 1200,
      dueDate: "2025-09-19",
      status: "open",
      createdBy: "Agent Davis",
      createdDate: "2024-01-15",
      remarks: "Customer committed to full payment after salary payment",
      daysRemaining: -1,
      mlPrediction: "91.7%",
      mlAccuracy: 96,
      mlRiskLevel: "High",
      recentInteractions: [
        {
          id: "INT007",
          date: "2024-02-01",
          type: "call",
          description: "Customer confirmed salary delay, requesting 3-day extension",
          agent: "Agent Davis",
          outcome: "scheduled"
        },
        {
          id: "INT008",
          date: "2024-01-30",
          type: "sms",
          description: "Payment reminder for today's due date",
          agent: "System",
          outcome: "successful"
        }
      ]
    },
    {
      id: "PTP004",
      customerId: "CUST004",
      customerName: "Rebecca Johnson",
      customerType: "normal",
      committedAmount: 950,
      dueDate: "2025-09-19",
      status: "open",
      createdBy: "Agent Wilson",
      createdDate: "2024-01-20",
      remarks: "Payment plan arrangement - committed to 75% today",
      daysRemaining: 0,
      mlPrediction: "87.2%",
      mlAccuracy: 93,
      mlRiskLevel: "High",
      recentInteractions: [
        {
          id: "INT009",
          date: "2024-02-02",
          type: "call",
          description: "Customer confirmed payment today, processing expected by EOD",
          agent: "Agent Wilson",
          outcome: "successful"
        },
        {
          id: "INT010",
          date: "2024-02-01",
          type: "reminder",
          description: "Automated reminder sent for payment due tomorrow",
          agent: "System",
          outcome: "successful"
        }
      ]
    },
    {
      id: "PTP008",
      customerId: "CUST005",
      customerName: "Jennifer Lopez",
      customerType: "normal",
      committedAmount: 450,
      dueDate: "2025-09-19",
      status: "open",
      createdBy: "Agent Brown",
      createdDate: "2024-01-28",
      remarks: "Small amount commitment after expense clarification",
      daysRemaining: 0,
      mlPrediction: "81.6%",
      mlAccuracy: 94,
      mlRiskLevel: "High"
    },
    // Enterprise customers
    {
      id: "PTP005",
      customerId: "ENT001",
      customerName: "Microsoft Corporation",
      customerType: "enterprise",
      committedAmount: 75000,
      contractValue: 850000,
      dueDate: "2025-09-19",
      status: "open",
      createdBy: "Account Manager Johnson",
      createdDate: "2024-02-01",
      remarks: "Payment commitment for Q1 services. Executive approval secured for extended terms per contract MSA-2024-001.",
      daysRemaining: 42,
      accountManager: "Sarah Johnson",
      contractReference: "MSA-2024-001",
      paymentTerms: "Net 45",
      approvalLevel: "executive",
      mlPrediction: "45.3%",
      mlAccuracy: 88,
      mlRiskLevel: "Low",
      recentInteractions: [
        {
          id: "INT011",
          date: "2024-02-01",
          type: "email",
          description: "Contract review completed, payment schedule confirmed with finance team",
          agent: "Account Manager Johnson",
          outcome: "successful"
        },
        {
          id: "INT012",
          date: "2024-01-30",
          type: "call",
          description: "Executive meeting regarding Q1 payment terms and compliance requirements",
          agent: "Account Manager Johnson",
          outcome: "scheduled"
        }
      ]
    },
    {
      id: "PTP006",
      customerId: "ENT002",
      customerName: "Amazon Web Services",
      customerType: "enterprise",
      committedAmount: 125000,
      contractValue: 1200000,
      dueDate: "2025-09-19",
      status: "open",
      createdBy: "Account Manager Davis",
      createdDate: "2024-01-30",
      remarks: "Quarterly payment commitment under enterprise agreement. Legal review completed for compliance requirements.",
      daysRemaining: 25,
      accountManager: "Michael Davis",
      contractReference: "EA-AWS-2024",
      paymentTerms: "Net 60",
      approvalLevel: "manager",
      mlPrediction: "62.8%",
      mlAccuracy: 90,
      mlRiskLevel: "Medium"
    },
    {
      id: "PTP007",
      customerId: "ENT003",
      customerName: "Google Cloud Platform",
      customerType: "enterprise",
      committedAmount: 95000,
      contractValue: 950000,
      dueDate: "2025-09-19",
      status: "fulfilled",
      createdBy: "Account Manager Wilson",
      createdDate: "2024-01-10",
      remarks: "Successfully fulfilled enterprise payment commitment ahead of schedule. Contract renewal discussions initiated.",
      daysRemaining: 0,
      accountManager: "Jennifer Wilson",
      contractReference: "GCP-ENT-2024",
      paymentTerms: "Net 30",
      approvalLevel: "standard",
      mlPrediction: "28.4%",
      mlAccuracy: 93,
      mlRiskLevel: "Low"
    },
    // New enterprise customers for Due Today & Overdue
    {
      id: "PTP009",
      customerId: "ENT004",
      customerName: "Oracle Corporation",
      customerType: "enterprise",
      committedAmount: 85000,
      contractValue: 780000,
      dueDate: "2025-09-19",
      status: "open",
      createdBy: "Account Manager Thompson",
      createdDate: "2024-01-18",
      remarks: "Enterprise payment commitment under master service agreement. Approval pending from finance department.",
      daysRemaining: 0,
      accountManager: "Robert Thompson",
      contractReference: "MSA-ORC-2024",
      paymentTerms: "Net 30",
      approvalLevel: "manager",
      mlPrediction: "84.9%",
      mlAccuracy: 95,
      mlRiskLevel: "High",
      recentInteractions: [
        {
          id: "INT013",
          date: "2024-02-02",
          type: "email",
          description: "Follow-up sent to finance department for payment approval status",
          agent: "Account Manager Thompson",
          outcome: "no_response"
        },
        {
          id: "INT014",
          date: "2024-01-31",
          type: "call",
          description: "Spoke with procurement team, payment processing delayed due to internal approvals",
          agent: "Account Manager Thompson",
          outcome: "scheduled"
        },
        {
          id: "INT015",
          date: "2024-01-28",
          type: "reminder",
          description: "Contract compliance reminder sent to legal and finance teams",
          agent: "System",
          outcome: "successful"
        }
      ]
    },
    {
      id: "PTP010",
      customerId: "ENT005",
      customerName: "IBM Cloud Services",
      customerType: "enterprise",
      committedAmount: 110000,
      contractValue: 1100000,
      dueDate: "2025-09-19",
      status: "open",
      createdBy: "Account Manager Garcia",
      createdDate: "2024-01-22",
      remarks: "Quarterly payment under enterprise agreement. Contract compliance review completed.",
      daysRemaining: -1,
      accountManager: "Maria Garcia",
      contractReference: "EA-IBM-2024",
      paymentTerms: "Net 45",
      approvalLevel: "executive",
      mlPrediction: "76.3%",
      mlAccuracy: 92,
      mlRiskLevel: "Medium"
    }
  ];

  // Filter PTPs based on customer type
  const ptps = customerType === "all" 
    ? allPTPs 
    : allPTPs.filter(ptp => ptp.customerType === customerType);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "open": return "secondary";
      case "fulfilled": return "default";
      case "broken": return "destructive";
      default: return "secondary";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "open": return <Clock className="w-4 h-4" />;
      case "fulfilled": return <CheckCircle className="w-4 h-4" />;
      case "broken": return <XCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (daysRemaining: number, status: string) => {
    if (status === "broken") return "text-destructive";
    if (status === "fulfilled") return "text-success";
    if (daysRemaining < 0) return "text-destructive";
    if (daysRemaining <= 2) return "text-orange-500";
    return "text-foreground";
  };

  const filteredPTPs = ptps.filter(ptp =>
    ptp.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ptp.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ptp.createdBy.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">
            {customerType === "enterprise" ? "Payment Commitment Management" : "Promise to Pay"}
          </h2>
          <p className="text-muted-foreground">
            {customerType === "enterprise" 
              ? "Manage enterprise payment commitments and contract terms" 
              : "Track and manage payment commitments"}
          </p>
        </div>
        <Dialog open={newPTPDialog} onOpenChange={setNewPTPDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New PTP
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {customerType === "enterprise" ? "Create Payment Commitment" : "Create Promise to Pay"}
              </DialogTitle>
              <DialogDescription>
                {customerType === "enterprise" ? "Record a new enterprise payment commitment" : "Record a new payment commitment"}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Customer ID</Label>
                <Input placeholder="Enter customer ID" />
              </div>
              <div>
                <Label>Committed Amount</Label>
                <Input type="number" placeholder="Enter amount" />
              </div>
              {customerType === "enterprise" && (
                <>
                  <div>
                    <Label>Contract Reference</Label>
                    <Input placeholder="Enter contract or PO number" />
                  </div>
                  <div>
                    <Label>Payment Terms</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select payment terms" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="net30">Net 30</SelectItem>
                        <SelectItem value="net45">Net 45</SelectItem>
                        <SelectItem value="net60">Net 60</SelectItem>
                        <SelectItem value="net90">Net 90</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Approval Level</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select approval level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="manager">Manager</SelectItem>
                        <SelectItem value="executive">Executive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div>
                <Label>Due Date</Label>
                <Input type="date" />
              </div>
              <div>
                <Label>Remarks</Label>
                <Textarea placeholder={
                  customerType === "enterprise" 
                    ? "Enter contract terms, compliance requirements, and arrangement details..." 
                    : "Enter payment arrangement details..."
                } />
              </div>
              <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                {customerType === "enterprise" ? "Create Payment Commitment" : "Create PTP"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {customerType === "enterprise" ? "Open Commitments" : "Open PTPs"}
                </p>
                <p className="text-2xl font-bold text-secondary-foreground">
                  {ptps.filter(p => p.status === "open").length}
                </p>
                {customerType === "enterprise" && (
                  <p className="text-xs text-muted-foreground">
                    ${ptps.filter(p => p.status === "open").reduce((sum, p) => sum + p.committedAmount, 0).toLocaleString()}
                  </p>
                )}
              </div>
              {customerType === "enterprise" ? 
                <Building className="w-6 h-6 text-secondary-foreground" /> :
                <Clock className="w-6 h-6 text-secondary-foreground" />
              }
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {customerType === "enterprise" ? "Contract Due" : "Due Today"}
                </p>
                <p className="text-2xl font-bold text-orange-500">
                  {ptps.filter(p => p.daysRemaining <= 2 && p.status === "open").length}
                </p>
                {customerType === "enterprise" && (
                  <p className="text-xs text-muted-foreground">
                    ${ptps.filter(p => p.daysRemaining <= 2 && p.status === "open").reduce((sum, p) => sum + p.committedAmount, 0).toLocaleString()}
                  </p>
                )}
              </div>
              <Bell className="w-6 h-6 text-orange-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {customerType === "enterprise" ? "Fulfilled Contracts" : "Fulfilled"}
                </p>
                <p className="text-2xl font-bold text-success">
                  {ptps.filter(p => p.status === "fulfilled").length}
                </p>
                {customerType === "enterprise" && (
                  <p className="text-xs text-muted-foreground">
                    ${ptps.filter(p => p.status === "fulfilled").reduce((sum, p) => sum + p.committedAmount, 0).toLocaleString()}
                  </p>
                )}
              </div>
              <CheckCircle className="w-6 h-6 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  {customerType === "enterprise" ? "Escalated Cases" : "Broken"}
                </p>
                <p className="text-2xl font-bold text-destructive">
                  {ptps.filter(p => p.status === "broken").length}
                </p>
                {customerType === "enterprise" && (
                  <p className="text-xs text-muted-foreground">
                    ${ptps.filter(p => p.status === "broken").reduce((sum, p) => sum + p.committedAmount, 0).toLocaleString()}
                  </p>
                )}
              </div>
              <XCircle className="w-6 h-6 text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* PTP List */}
        <Card>
          <CardHeader>
            <CardTitle>Active PTPs</CardTitle>
            <CardDescription>Monitor payment commitments and due dates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-2 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search PTPs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredPTPs.map((ptp) => (
                <div
                  key={ptp.id}
                  className="p-3 border rounded-lg cursor-pointer hover:bg-secondary/50 transition-colors"
                  onClick={() => setSelectedPTP(ptp)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(ptp.status)}
                      <span className="font-medium">{ptp.id}</span>
                    </div>
                    <Badge variant={getStatusBadgeVariant(ptp.status)}>
                      {ptp.status.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-sm text-foreground">{ptp.customerName}</p>
                  <div className="flex justify-between items-center mt-1">
                    <p className="text-sm font-medium text-success">${ptp.committedAmount}</p>
                    <p className={`text-sm font-medium ${getPriorityColor(ptp.daysRemaining, ptp.status)}`}>
                      {ptp.status === "broken" ? "OVERDUE" : 
                       ptp.status === "fulfilled" ? "PAID" :
                       ptp.daysRemaining < 0 ? `${Math.abs(ptp.daysRemaining)} days overdue` :
                       ptp.daysRemaining === 0 ? "Due today" :
                       `${ptp.daysRemaining} days remaining`}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">Due: {ptp.dueDate}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* PTP Details */}
        <Card>
          <CardHeader>
            <CardTitle>PTP Details</CardTitle>
            <CardDescription>
              {selectedPTP ? `Details for ${selectedPTP.id}` : "Select a PTP to view details"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedPTP ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">PTP ID</Label>
                    <p className="font-medium">{selectedPTP.id}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Customer</Label>
                    <p className="font-medium">{selectedPTP.customerName}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Status</Label>
                    <Badge variant={getStatusBadgeVariant(selectedPTP.status)}>
                      {selectedPTP.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Committed Amount</Label>
                    <p className="font-medium text-success">${selectedPTP.committedAmount.toLocaleString()}</p>
                  </div>
                  {selectedPTP.customerType === "enterprise" && selectedPTP.contractValue && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Contract Value</Label>
                      <p className="font-medium text-secondary-foreground">${selectedPTP.contractValue.toLocaleString()}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-sm text-muted-foreground">Due Date</Label>
                    <p className="font-medium">{selectedPTP.dueDate}</p>
                  </div>
                  {selectedPTP.customerType === "enterprise" && selectedPTP.accountManager && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Account Manager</Label>
                      <div className="flex items-center space-x-2">
                        <User className="w-4 h-4 text-muted-foreground" />
                        <p className="font-medium">{selectedPTP.accountManager}</p>
                      </div>
                    </div>
                  )}
                  <div>
                    <Label className="text-sm text-muted-foreground">Created By</Label>
                    <p className="font-medium">{selectedPTP.createdBy}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Created Date</Label>
                    <p className="font-medium">{selectedPTP.createdDate}</p>
                  </div>
                  {selectedPTP.customerType === "enterprise" && selectedPTP.contractReference && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Contract Reference</Label>
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <p className="font-medium">{selectedPTP.contractReference}</p>
                      </div>
                    </div>
                  )}
                  {selectedPTP.customerType === "enterprise" && selectedPTP.paymentTerms && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Payment Terms</Label>
                      <p className="font-medium">{selectedPTP.paymentTerms}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-sm text-muted-foreground">Days Remaining</Label>
                    <p className={`font-medium ${getPriorityColor(selectedPTP.daysRemaining, selectedPTP.status)}`}>
                      {selectedPTP.status === "broken" ? "OVERDUE" : 
                       selectedPTP.status === "fulfilled" ? "COMPLETED" :
                       selectedPTP.daysRemaining < 0 ? `${Math.abs(selectedPTP.daysRemaining)} days overdue` :
                       selectedPTP.daysRemaining === 0 ? "Due today" :
                       `${selectedPTP.daysRemaining} days`}
                    </p>
                  </div>
                  {selectedPTP.customerType === "enterprise" && selectedPTP.approvalLevel && (
                    <div>
                      <Label className="text-sm text-muted-foreground">Approval Level</Label>
                      <Badge variant={selectedPTP.approvalLevel === "executive" ? "default" : "secondary"}>
                        {selectedPTP.approvalLevel.toUpperCase()}
                      </Badge>
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-sm text-muted-foreground">Remarks</Label>
                  <div className="p-3 bg-secondary/30 rounded text-sm mt-2">
                    {selectedPTP.remarks}
                  </div>
                </div>

                {/* Recent Interactions */}
                {selectedPTP.recentInteractions && selectedPTP.recentInteractions.length > 0 && (
                  <div>
                    <Label className="text-sm text-muted-foreground flex items-center space-x-2">
                      <History className="w-4 h-4" />
                      <span>Recent Interactions</span>
                    </Label>
                    <div className="space-y-2 mt-2">
                      {selectedPTP.recentInteractions.map((interaction) => (
                        <div key={interaction.id} className="p-3 bg-secondary/20 rounded-lg border">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              {interaction.type === "call" && <Phone className="w-4 h-4 text-blue-500" />}
                              {interaction.type === "email" && <Mail className="w-4 h-4 text-green-500" />}
                              {interaction.type === "sms" && <MessageSquare className="w-4 h-4 text-purple-500" />}
                              {interaction.type === "payment" && <CreditCard className="w-4 h-4 text-emerald-500" />}
                              {interaction.type === "reminder" && <Bell className="w-4 h-4 text-orange-500" />}
                              <span className="text-sm font-medium capitalize">{interaction.type}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              {interaction.outcome && (
                                <Badge variant={
                                  interaction.outcome === "successful" ? "default" :
                                  interaction.outcome === "partial" ? "secondary" :
                                  interaction.outcome === "scheduled" ? "outline" :
                                  "destructive"
                                }>
                                  {interaction.outcome.replace("_", " ")}
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground">{interaction.date}</span>
                            </div>
                          </div>
                          <p className="text-sm text-foreground">{interaction.description}</p>
                          {interaction.agent && (
                            <p className="text-xs text-muted-foreground mt-1">
                              By: {interaction.agent}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {selectedPTP.status === "open" && (
                    <>
                      <Button variant="outline" size="sm">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Mark Fulfilled
                      </Button>
                      <Button variant="outline" size="sm">
                        <XCircle className="w-4 h-4 mr-2" />
                        Mark Broken
                      </Button>
                      <Button variant="outline" size="sm">
                        <Bell className="w-4 h-4 mr-2" />
                        {selectedPTP.customerType === "enterprise" ? "Notify Account Manager" : "Send Reminder"}
                      </Button>
                      {selectedPTP.customerType === "enterprise" && (
                        <>
                          <Button variant="outline" size="sm">
                            <FileText className="w-4 h-4 mr-2" />
                            Contract Review
                          </Button>
                          <Button variant="outline" size="sm">
                            <Users className="w-4 h-4 mr-2" />
                            Executive Escalation
                          </Button>
                        </>
                      )}
                    </>
                  )}
                  <Button variant="outline" size="sm">
                    <Calendar className="w-4 h-4 mr-2" />
                    Extend Date
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedPTP.status === "open" && (
                    <>
                      <Button variant="outline" size="sm">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Mark Fulfilled
                      </Button>
                      <Button variant="outline" size="sm">
                        <XCircle className="w-4 h-4 mr-2" />
                        Mark Broken
                      </Button>
                      <Button variant="outline" size="sm">
                        <Bell className="w-4 h-4 mr-2" />
                        {selectedPTP.customerType === "enterprise" ? "Notify Account Manager" : "Send Reminder"}
                      </Button>
                      {selectedPTP.customerType === "enterprise" && (
                        <>
                          <Button variant="outline" size="sm">
                            <FileText className="w-4 h-4 mr-2" />
                            Contract Review
                          </Button>
                          <Button variant="outline" size="sm">
                            <Users className="w-4 h-4 mr-2" />
                            Executive Escalation
                          </Button>
                        </>
                      )}
                    </>
                  )}
                  <Button variant="outline" size="sm">
                    <Calendar className="w-4 h-4 mr-2" />
                    Extend Date
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Select a PTP from the list to view details
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Due Today Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            <span>PTPs Due Today & Overdue</span>
          </CardTitle>
          <CardDescription>Payment commitments requiring immediate attention</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PTP ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="flex items-center space-x-2">
                  <Brain className="w-4 h-4" />
                  <span>ML Predictions</span>
                </TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ptps.filter(ptp => ptp.daysRemaining <= 2 && ptp.status === "open").map((ptp) => (
                <TableRow key={ptp.id}>
                  <TableCell className="font-medium">{ptp.id}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{ptp.customerName}</p>
                      <p className="text-sm text-muted-foreground">{ptp.customerId}</p>
                    </div>
                  </TableCell>
                  <TableCell className="text-success font-medium">${ptp.committedAmount.toLocaleString()}</TableCell>
                  <TableCell>{ptp.dueDate}</TableCell>
                  <TableCell>
                    <Badge variant={ptp.daysRemaining < 0 ? "destructive" : "secondary"}>
                      {ptp.daysRemaining < 0 ? "OVERDUE" : ptp.daysRemaining === 0 ? "DUE TODAY" : "DUE SOON"}
                    </Badge>
                  </TableCell>
                   <TableCell>
                     <div className="flex items-center space-x-2">
                       <Badge variant={
                         ptp.mlRiskLevel === "High" ? "destructive" : 
                         ptp.mlRiskLevel === "Medium" ? "secondary" : 
                         "default"
                       }>
                         {ptp.mlPrediction}
                       </Badge>
                       <span className="text-xs text-muted-foreground">{ptp.mlRiskLevel} Risk</span>
                     </div>
                   </TableCell>
                  <TableCell>
                    <div className="flex space-x-1">
                      <Button variant="outline" size="sm">
                        <Bell className="w-3 h-3" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <CheckCircle className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}