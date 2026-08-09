import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Case } from "../data/mockCases";
import { useCaseManagement } from "../CaseManagementContext";

const getRiskBadgeColor = (risk: string) => {
  switch (risk) {
    case 'Critical': return 'bg-destructive text-destructive-foreground';
    case 'High': return 'bg-orange-500 text-white';
    case 'Medium': return 'bg-yellow-500 text-white';
    case 'Low': return 'bg-green-500 text-white';
    default: return 'bg-muted';
  }
};

const getStatusBadgeColor = (status: string) => {
  switch (status) {
    case 'Open': return 'bg-blue-500 text-white';
    case 'In Progress': return 'bg-purple-500 text-white';
    case 'Awaiting Response': return 'bg-yellow-500 text-white';
    case 'Resolved': return 'bg-green-500 text-white';
    case 'Escalated': return 'bg-orange-500 text-white';
    case 'Legal': return 'bg-red-600 text-white';
    default: return 'bg-muted';
  }
};

export const CaseListTable = () => {
  const { filteredCases, selectedCase, setSelectedCase } = useCaseManagement();

  const handleRowClick = (caseItem: Case) => {
    setSelectedCase(caseItem);
  };

  return (
    <div className="">
      <Table>
        <TableHeader className="sticky top-0 bg-card z-10">
          <TableRow>
            <TableHead className="w-[100px]">Case ID</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead className="w-[80px]">Aging</TableHead>
            <TableHead className="w-[100px]">Risk</TableHead>
            <TableHead className="w-[120px]">Amount</TableHead>
            <TableHead className="w-[140px]">Status</TableHead>
            <TableHead className="w-[120px]">Assigned To</TableHead>
            <TableHead className="w-[120px]">Last Activity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredCases.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                No cases found matching your filters
              </TableCell>
            </TableRow>
          ) : (
            filteredCases.map((caseItem) => (
              <TableRow
                key={caseItem.id}
                onClick={() => handleRowClick(caseItem)}
                className={cn(
                  "cursor-pointer hover:bg-muted/50 transition-colors",
                  selectedCase?.id === caseItem.id && "bg-muted"
                )}
              >
                <TableCell className="font-medium">{caseItem.id}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{caseItem.customerName}</span>
                    <span className="text-xs text-muted-foreground">{caseItem.customerType}</span>
                  </div>
                </TableCell>
                <TableCell>{caseItem.aging} days</TableCell>
                <TableCell>
                  <Badge className={getRiskBadgeColor(caseItem.riskLevel)}>
                    {caseItem.riskLevel}
                  </Badge>
                </TableCell>
                <TableCell className="font-semibold">
                  {caseItem.currency} {caseItem.amount.toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge className={getStatusBadgeColor(caseItem.status)}>
                    {caseItem.status}
                  </Badge>
                </TableCell>
                <TableCell>{caseItem.assignedTo}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{caseItem.lastActivity}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};
