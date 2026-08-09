import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { 
  Building2, 
  Users, 
  DollarSign, 
  TrendingUp, 
  ChevronRight, 
  ChevronDown,
  AlertCircle,
  CheckCircle,
  Clock,
  FileText,
  CreditCard,
  Calendar,
  Target
} from "lucide-react";

interface CorporateAccount {
  parentId: string;
  parentName: string;
  totalAccounts: number;
  subsidiaryAccounts: SubsidiaryAccount[];
  consolidatedDebt: number;
  totalRevenue: number;
  paymentStatus: 'current' | 'overdue' | 'critical';
  contractValue: number;
  slaCompliance: number;
  lastReviewDate: string;
  accountManager: string;
}

interface SubsidiaryAccount {
  id: string;
  name: string;
  location: string;
  outstandingAmount: number;
  lastPayment: string;
  status: 'active' | 'suspended' | 'terminated';
  employeeCount: number;
  monthlyRevenue: number;
}

export const CORPORATE_ACCOUNTS: CorporateAccount[] = [
  {
    parentId: "CORP001",
    parentName: "TechCorp Industries",
    totalAccounts: 8,
    consolidatedDebt: 45000,
    totalRevenue: 850000,
    paymentStatus: 'current',
    contractValue: 2400000,
    slaCompliance: 98.5,
    lastReviewDate: "2024-01-15",
    accountManager: "Jennifer Lee",
    subsidiaryAccounts: [
      {
        id: "CUST003",
        name: "TechCorp HQ",
        location: "Chicago, IL",
        outstandingAmount: 0,
        lastPayment: "2024-01-25",
        status: 'active',
        employeeCount: 500,
        monthlyRevenue: 85000
      },
      {
        id: "SUB001",
        name: "TechCorp West",
        location: "San Francisco, CA",
        outstandingAmount: 15000,
        lastPayment: "2024-01-20",
        status: 'active',
        employeeCount: 200,
        monthlyRevenue: 45000
      },
      {
        id: "SUB002",
        name: "TechCorp East",
        location: "New York, NY",
        outstandingAmount: 30000,
        lastPayment: "2024-01-10",
        status: 'active',
        employeeCount: 150,
        monthlyRevenue: 35000
      }
    ]
  },
  {
    parentId: "CORP002",
    parentName: "Global Manufacturing Co",
    totalAccounts: 12,
    consolidatedDebt: 125000,
    totalRevenue: 1200000,
    paymentStatus: 'overdue',
    contractValue: 3600000,
    slaCompliance: 92.3,
    lastReviewDate: "2024-01-10",
    accountManager: "Michael Chen",
    subsidiaryAccounts: [
      {
        id: "SUB003",
        name: "Manufacturing Plant A",
        location: "Detroit, MI",
        outstandingAmount: 75000,
        lastPayment: "2023-12-15",
        status: 'suspended',
        employeeCount: 800,
        monthlyRevenue: 95000
      },
      {
        id: "SUB004",
        name: "Manufacturing Plant B",
        location: "Houston, TX",
        outstandingAmount: 50000,
        lastPayment: "2024-01-05",
        status: 'active',
        employeeCount: 600,
        monthlyRevenue: 75000
      }
    ]
  }
];

export default function CorporateAccountManagement() {
  const [expandedAccount, setExpandedAccount] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'current': return 'text-success';
      case 'overdue': return 'text-warning';
      case 'critical': return 'text-destructive';
      case 'active': return 'text-success';
      case 'suspended': return 'text-warning';
      case 'terminated': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'current':
      case 'active':
        return <CheckCircle className="h-4 w-4 text-success" />;
      case 'overdue':
      case 'suspended':
        return <Clock className="h-4 w-4 text-warning" />;
      case 'critical':
      case 'terminated':
        return <AlertCircle className="h-4 w-4 text-destructive" />;
      default:
        return <CheckCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const totalCorporateAccounts = CORPORATE_ACCOUNTS.length;
  const totalSubsidiaries = CORPORATE_ACCOUNTS.reduce((sum, corp) => sum + corp.totalAccounts, 0);
  const totalConsolidatedDebt = CORPORATE_ACCOUNTS.reduce((sum, corp) => sum + corp.consolidatedDebt, 0);
  const averageSLA = CORPORATE_ACCOUNTS.reduce((sum, corp) => sum + corp.slaCompliance, 0) / CORPORATE_ACCOUNTS.length;

  return (
    <div className="space-y-6">

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Account Overview</TabsTrigger>
          <TabsTrigger value="hierarchy">Corporate Hierarchy</TabsTrigger>
          <TabsTrigger value="consolidation">Debt Consolidation</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Contract & SLA Overview Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5 text-success" />
                <span>Contract & SLA Overview</span>
              </CardTitle>
              <CardDescription>
                Monitor contract renewals, SLA performance, and service delivery metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Upcoming Renewals */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-foreground">Upcoming Renewals</h4>
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">TechCorp Inc.</span>
                      <span className="text-warning font-medium">30 days</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Global Solutions</span>
                      <span className="text-warning font-medium">45 days</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Enterprise Ltd.</span>
                      <span className="text-success font-medium">90 days</span>
                    </div>
                  </div>
                </div>

                {/* SLA Performance */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-foreground">SLA Performance</h4>
                    <Target className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Uptime SLA</span>
                      <span className="text-success font-medium">99.8%</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Response Time</span>
                      <span className="text-success font-medium">98.2%</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Resolution Time</span>
                      <span className="text-warning font-medium">92.1%</span>
                    </div>
                  </div>
                </div>

                {/* Contract Value Summary */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-foreground">Contract Value</h4>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Total ARR</span>
                      <span className="text-foreground font-medium">$12.4M</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">YoY Growth</span>
                      <span className="text-success font-medium">+18.5%</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Avg Deal Size</span>
                      <span className="text-foreground font-medium">$245K</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Corporate Account Groups</CardTitle>
              <CardDescription>
                Manage and monitor corporate accounts with multiple subsidiaries
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {CORPORATE_ACCOUNTS.map((account) => (
                <div key={account.parentId} className="border rounded-lg p-4">
                  <div 
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => setExpandedAccount(
                      expandedAccount === account.parentId ? null : account.parentId
                    )}
                  >
                    <div className="flex items-center space-x-4">
                      <Building2 className="h-6 w-6 text-primary" />
                      <div>
                        <h3 className="font-semibold text-lg">{account.parentName}</h3>
                        <p className="text-sm text-muted-foreground">
                          {account.totalAccounts} subsidiary accounts • 
                          Contract Value: ${account.contractValue.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <Badge 
                        variant={account.paymentStatus === 'current' ? 'default' : 'destructive'}
                        className="capitalize"
                      >
                        {account.paymentStatus}
                      </Badge>
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          ${account.consolidatedDebt.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground">Outstanding</p>
                      </div>
                      {expandedAccount === account.parentId ? 
                        <ChevronDown className="h-4 w-4" /> : 
                        <ChevronRight className="h-4 w-4" />
                      }
                    </div>
                  </div>

                  {expandedAccount === account.parentId && (
                    <div className="mt-4 space-y-3 animate-fade-in">
                      <div className="grid grid-cols-3 gap-4 p-3 bg-muted/30 rounded-lg">
                        <div>
                          <p className="text-xs text-muted-foreground">Account Manager</p>
                          <p className="font-medium">{account.accountManager}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">SLA Compliance</p>
                          <p className="font-medium">{account.slaCompliance}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Last Review</p>
                          <p className="font-medium">{account.lastReviewDate}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="font-medium">Subsidiary Accounts</h4>
                        {account.subsidiaryAccounts.map((sub) => (
                          <div key={sub.id} className="flex items-center justify-between p-3 border rounded-lg bg-card">
                            <div className="flex items-center space-x-3">
                              {getStatusIcon(sub.status)}
                              <div>
                                <p className="font-medium">{sub.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {sub.location} • {sub.employeeCount} employees
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">${sub.outstandingAmount.toLocaleString()}</p>
                              <p className="text-xs text-muted-foreground">Last: {sub.lastPayment}</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="flex space-x-2 pt-2">
                        <Button size="sm" variant="outline">
                          <FileText className="h-4 w-4 mr-2" />
                          View Details
                        </Button>
                        <Button size="sm" variant="outline">
                          <CreditCard className="h-4 w-4 mr-2" />
                          Payment Plan
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hierarchy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Corporate Hierarchy View</CardTitle>
              <CardDescription>
                Visualize parent-subsidiary relationships and account structures
              </CardDescription>
            </CardHeader>
            <CardContent>
              {CORPORATE_ACCOUNTS.map((account) => (
                <div key={account.parentId} className="mb-6">
                  <div className="flex items-center space-x-2 mb-3">
                    <Building2 className="h-6 w-6 text-primary" />
                    <h3 className="font-bold text-lg">{account.parentName}</h3>
                    <Badge variant="outline">{account.totalAccounts} locations</Badge>
                  </div>
                  
                  <div className="grid gap-3 ml-8">
                    {account.subsidiaryAccounts.map((sub, index) => (
                      <div key={sub.id} className="flex items-center space-x-3">
                        <div className="flex items-center">
                          <div className="w-4 h-px bg-border" />
                          <div className={`w-2 h-2 rounded-full ${
                            index === account.subsidiaryAccounts.length - 1 ? 'bg-border' : 'bg-primary'
                          }`} />
                        </div>
                        <div className="flex-1 flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center space-x-3">
                            {getStatusIcon(sub.status)}
                            <div>
                              <p className="font-medium">{sub.name}</p>
                              <p className="text-sm text-muted-foreground">{sub.location}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">${sub.monthlyRevenue.toLocaleString()}/mo</p>
                            <p className={`text-sm ${getStatusColor(sub.status)}`}>
                              {sub.status.charAt(0).toUpperCase() + sub.status.slice(1)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consolidation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Consolidated Debt Management</CardTitle>
              <CardDescription>
                Cross-account payment coordination and consolidated billing overview
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {CORPORATE_ACCOUNTS.map((account) => (
                <div key={account.parentId} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg">{account.parentName}</h3>
                    <Badge 
                      variant={account.paymentStatus === 'current' ? 'default' : 'destructive'}
                      className="capitalize"
                    >
                      {account.paymentStatus}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Outstanding</p>
                      <p className="text-2xl font-bold text-destructive">
                        ${account.consolidatedDebt.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Monthly Revenue</p>
                      <p className="text-2xl font-bold text-success">
                        ${account.totalRevenue.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Debt Distribution</span>
                      <span className="text-sm text-muted-foreground">
                        {account.subsidiaryAccounts.length} accounts
                      </span>
                    </div>
                    
                    {account.subsidiaryAccounts.map((sub) => {
                      const percentage = (sub.outstandingAmount / account.consolidatedDebt) * 100;
                      return (
                        <div key={sub.id} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span>{sub.name}</span>
                            <span className="font-medium">${sub.outstandingAmount.toLocaleString()}</span>
                          </div>
                          <Progress value={percentage} className="h-2" />
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex space-x-2 mt-4 pt-4 border-t">
                    <Button size="sm">
                      <CreditCard className="h-4 w-4 mr-2" />
                      Consolidated Payment
                    </Button>
                    <Button size="sm" variant="outline">
                      <FileText className="h-4 w-4 mr-2" />
                      Payment Plan
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}