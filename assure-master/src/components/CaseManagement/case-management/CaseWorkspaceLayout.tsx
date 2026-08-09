import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { FilterBar } from "./FilterBar";
import { useState } from "react";
import { CaseListTable } from "./CaseListTable";
import { CaseHeader } from "./CaseHeader";
import { CustomerSummary } from "./CustomerSummary";
import { QuickActions } from "./QuickActions";
import { CaseTabs } from "./CaseTabs";
import { BottomBar } from "./BottomBar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useCustomerType } from "@/contexts/CustomerTypeContext";
import {
  Search,
  ArrowRight,
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
  History,
} from "lucide-react";

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

interface RecentInteraction {
  id: string;
  date: string;
  type: "call" | "email" | "sms" | "payment" | "reminder";
  description: string;
  agent?: string;
  outcome?: "successful" | "no_response" | "partial" | "scheduled";
}
export const CaseWorkspaceLayout = () => {
  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pb-5">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Open Cases</p>
                <p className="text-2xl font-bold text-destructive">23</p>
              </div>
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold text-secondary-foreground">
                  45
                </p>
              </div>
              <Clock className="w-6 h-6 text-secondary-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Closed Today</p>
                <p className="text-2xl font-bold text-success">12</p>
              </div>
              <CheckCircle className="w-6 h-6 text-success" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Resolution Rate</p>
                <p className="text-2xl font-bold text-success">68%</p>
              </div>
              <ArrowRight className="w-6 h-6 text-success" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="h-screen flex flex-col bg-white">
        <FilterBar />

        <div className="h-full border-r border-border ">
          <CaseListTable />
        </div>

        <div className="h-full flex flex-col bg-white">
          <div className="flex-1  p-6 pb-20">
            <CaseHeader />
            <CustomerSummary />
            <Card className="p-6 shadow-sm border-border">
              <QuickActions />
              <CaseTabs />
            </Card>
          </div>
        </div>
        <BottomBar />
      </div>
    </div>
  );
};
