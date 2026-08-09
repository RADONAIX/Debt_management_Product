import { Card } from "@/components/ui/card";
import { Customer } from "@/data/customerData";

const funnelData = [
  { strategy: "Soft Reminder", successRate: "52 M", uplift: "62%", totalUplift: "3.8%" },
  { strategy: "AI Dialer", successRate: "1.4 M", uplift: "87%", totalUplift: "14%" },
  { strategy: "Legal Pre-", successRate: "650 K", uplift: "68%", totalUplift: "63%" },
  { strategy: "Notification", successRate: "710 K", uplift: "80%", totalUplift: "80%" }
];

interface CollectionsFunnelProps {
  selectedCustomer?: Customer | null;
}

export const CollectionsFunnel = ({ selectedCustomer }: CollectionsFunnelProps) => {
  const displayData = selectedCustomer?.collectionsFunnelCustomer 
    ? selectedCustomer.collectionsFunnelCustomer.map(item => ({
        strategy: item.stage,
        successRate: `${item.conversion}%`,
        uplift: `${item.uplift}%`,
        totalUplift: `${item.uplift}%`
      }))
    : funnelData;

  return (
    <Card className="bg-card border-dashboard-border p-6 space-y-4">
      <h3 className="text-base font-semibold text-foreground">Collections Funnel</h3>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-dashboard-border">
              <th className="text-left py-3 px-2 text-muted-foreground font-normal">Strategy</th>
              <th className="text-right py-3 px-2 text-muted-foreground font-normal">Conversion</th>
              <th className="text-right py-3 px-2 text-muted-foreground font-normal">Uplift</th>
            </tr>
          </thead>
          <tbody>
            {displayData.map((row, idx) => (
              <tr key={idx} className="border-b border-dashboard-border/30">
                <td className="py-3 px-2 text-foreground font-normal">{row.strategy}</td>
                <td className="py-3 px-2 text-right text-foreground font-normal">{row.successRate}</td>
                <td className="py-3 px-2 text-right text-foreground font-normal">{row.uplift}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
