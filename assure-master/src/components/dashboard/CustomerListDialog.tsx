import { useState, useMemo } from "react";
import { Download, ArrowUpDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Customer } from "@/data/customerData";
import { useToast } from "@/hooks/use-toast";

interface CustomerListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: Customer[];
  title: string;
}

type SortField = "name" | "status" | "riskLevel" | "outstanding";
type SortDirection = "asc" | "desc";

export const CustomerListDialog = ({ open, onOpenChange, customers, title }: CustomerListDialogProps) => {
  const { toast } = useToast();
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const sortedCustomers = useMemo(() => {
    return [...customers].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case "name":
          aValue = a.name;
          bValue = b.name;
          break;
        case "status":
          aValue = a.status;
          bValue = b.status;
          break;
        case "riskLevel":
          aValue = a.riskLevel;
          bValue = b.riskLevel;
          break;
        case "outstanding":
          const aTotal = a.currentMonthUsageBilling.billingBreakdown;
          const bTotal = b.currentMonthUsageBilling.billingBreakdown;
          aValue = aTotal.basePlan + aTotal.deviceFinancing + aTotal.roamingCharges + aTotal.valueAddedServices;
          bValue = bTotal.basePlan + bTotal.deviceFinancing + bTotal.roamingCharges + bTotal.valueAddedServices;
          break;
      }

      if (sortDirection === "asc") {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });
  }, [customers, sortField, sortDirection]);

  const exportToCSV = () => {
    const headers = ["Customer ID", "Name", "Status", "Risk Level", "Outstanding", "Phone", "Email"];
    const csvData = sortedCustomers.map(customer => {
      const billing = customer.currentMonthUsageBilling.billingBreakdown;
      const outstanding = billing.basePlan + billing.deviceFinancing + billing.roamingCharges + billing.valueAddedServices;
      
      return [
        customer.customerId,
        customer.name,
        customer.status,
        customer.riskLevel,
        `$ ${outstanding}`,
        customer.accountInformation.contactInformation.phone,
        customer.accountInformation.contactInformation.email || "N/A"
      ];
    });

    const csv = [
      headers.join(","),
      ...csvData.map(row => row.join(","))
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customer-list-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Export Successful",
      description: "Customer list has been exported to CSV.",
    });
  };

  const getRiskBadgeColor = (riskLevel: string) => {
    if (riskLevel === "High Risk") return "bg-red-500/20 text-red-500 border-red-500/30";
    if (riskLevel === "Medium Risk") return "bg-yellow-500/20 text-yellow-500 border-yellow-500/30";
    return "bg-green-500/20 text-green-500 border-green-500/30";
  };

  const getStatusBadgeColor = (status: string) => {
    if (status === "Past Due") return "bg-orange-500/20 text-orange-500 border-orange-500/30";
    return "bg-blue-500/20 text-blue-500 border-blue-500/30";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh] bg-background border-border">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold text-foreground">{title}</DialogTitle>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={exportToCSV}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{customers.length} customer(s) found</p>
        </DialogHeader>

        <div className="overflow-auto max-h-[calc(90vh-150px)]">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleSort("name")}
                    className="flex items-center gap-1 hover:bg-muted"
                  >
                    Name
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>Customer ID</TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleSort("status")}
                    className="flex items-center gap-1 hover:bg-muted"
                  >
                    Status
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleSort("riskLevel")}
                    className="flex items-center gap-1 hover:bg-muted"
                  >
                    Risk Level
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleSort("outstanding")}
                    className="flex items-center gap-1 hover:bg-muted"
                  >
                    Outstanding
                    <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Plan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCustomers.map((customer) => {
                const billing = customer.currentMonthUsageBilling.billingBreakdown;
                const outstanding = billing.basePlan + billing.deviceFinancing + billing.roamingCharges + billing.valueAddedServices;

                return (
                  <TableRow key={customer.customerId} className="border-border">
                    <TableCell className="font-medium text-foreground">{customer.name}</TableCell>
                    <TableCell className="text-muted-foreground">{customer.customerId}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusBadgeColor(customer.status)}>
                        {customer.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getRiskBadgeColor(customer.riskLevel)}>
                        {customer.riskLevel}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">$ {outstanding}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div>{customer.accountInformation.contactInformation.phone}</div>
                      <div className="text-xs">{customer.accountInformation.contactInformation.email || "N/A"}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {customer.accountInformation.contractDetails.planName}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
};
