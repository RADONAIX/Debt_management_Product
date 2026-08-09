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

export default function PTPDue() {
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