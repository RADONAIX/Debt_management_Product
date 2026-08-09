import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Employee } from "@/components/shared/employeeData";
import {
  User,
  Mail,
  Phone,
  Building2,
  Calendar,
  MapPin,
  Activity,
  BarChart3,
  Clock,
  DollarSign,
  Users
} from "lucide-react";

interface EmployeeProfileProps {
  selectedEmployee: Employee | null;
}

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case "active": return "default";
    case "inactive": return "secondary";
    case "on-leave": return "destructive";
    default: return "secondary";
  }
};

export default function EmployeeProfile({ selectedEmployee }: EmployeeProfileProps) {
  if (!selectedEmployee) {
    return (
      <Card className="h-96 flex items-center justify-center">
        <CardContent>
          <div className="text-center text-muted-foreground">
            <User className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>Select an employee to view their profile</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Employee Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5 text-primary" />
                <span>{selectedEmployee.name}</span>
              </CardTitle>
              <CardDescription className="flex items-center space-x-4">
                <span className="flex items-center space-x-1">
                  <Building2 className="h-4 w-4" />
                  <span>{selectedEmployee.position}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <MapPin className="h-4 w-4" />
                  <span>{selectedEmployee.location}</span>
                </span>
              </CardDescription>
            </div>
            <Badge variant={getStatusBadgeVariant(selectedEmployee.status)}>
              {selectedEmployee.status.charAt(0).toUpperCase() + selectedEmployee.status.slice(1)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Employee ID</p>
              <p className="font-medium">{selectedEmployee.employeeId}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Department</p>
              <p className="font-medium">{selectedEmployee.department}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Subsidiary</p>
              <p className="font-medium">{selectedEmployee.subsidiary}</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Account Value</p>
              <p className="font-medium">${selectedEmployee.accountValue}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee Details Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="usage">Service Usage</TabsTrigger>
          <TabsTrigger value="company">Company Info</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Mail className="h-4 w-4 text-primary" />
                <span>Contact Information</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedEmployee.email}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{selectedEmployee.phone}</p>
                  </div>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-3">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Hire Date</p>
                    <p className="font-medium">{new Date(selectedEmployee.hireDate).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Manager</p>
                    <p className="font-medium">{selectedEmployee.manager}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <span>Service Usage</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedEmployee.serviceUsage ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Activity className="h-8 w-8 mx-auto mb-2 text-primary" />
                      <p className="text-2xl font-bold">{selectedEmployee.serviceUsage.dataUsed}</p>
                      <p className="text-xs text-muted-foreground">Data Used</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Phone className="h-8 w-8 mx-auto mb-2 text-success" />
                      <p className="text-2xl font-bold">{selectedEmployee.serviceUsage.callMinutes}</p>
                      <p className="text-xs text-muted-foreground">Call Minutes</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <Mail className="h-8 w-8 mx-auto mb-2 text-secondary" />
                      <p className="text-2xl font-bold">{selectedEmployee.serviceUsage.smsCount}</p>
                      <p className="text-xs text-muted-foreground">SMS Count</p>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">No usage data available</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="company" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Building2 className="h-4 w-4 text-primary" />
                <span>Company Structure</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Parent Company</p>
                  <p className="font-medium text-lg">{selectedEmployee.parentCompany}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Subsidiary</p>
                  <p className="font-medium">{selectedEmployee.subsidiary}</p>
                </div>
              </div>
              <Separator />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Department</p>
                  <p className="font-medium">{selectedEmployee.department}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Position</p>
                  <p className="font-medium">{selectedEmployee.position}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-primary" />
                <span>Recent Activity</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Last Login</p>
                    <p className="font-medium">
                      {selectedEmployee.lastLogin ? new Date(selectedEmployee.lastLogin).toLocaleDateString() : 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Monthly Account Value</p>
                    <p className="font-medium">${selectedEmployee.accountValue}</p>
                  </div>
                </div>
              </div>
              <Separator />
              <div className="text-center text-muted-foreground py-8">
                <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Detailed activity logs will be available in future updates</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}