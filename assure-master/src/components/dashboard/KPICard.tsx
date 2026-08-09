import { TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  riskLevel?: "low" | "medium" | "high";
}

interface ExtendedKPICardProps extends KPICardProps {
  onClick?: () => void;
}


export const KPICard = ({ title, value, subtitle, icon, color }) => (
  <div
    style={{
      background: "white",
      borderRadius: "14px",
      padding: "20px",
      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      border: "1px solid #EEF2F6",
      transition: "0.25s",
      cursor: "pointer",
    }}
    onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.03)")}
    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
  >
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <div>
        <div style={{ fontSize: "13px", color: "#64748B", fontWeight: 500 }}>
          {title}
        </div>

        <div
          style={{
            fontSize: "30px",
            fontWeight: 700,
            marginTop: "6px",
            color: "#0F172A",
          }}
        >
          {value}
        </div>

        {subtitle && (
          <div
            style={{
              marginTop: "8px",
              fontSize: "12px",
              color: "#94A3B8",
            }}
          >
            {subtitle}
          </div>
        )}
      </div>

      <div
        style={{
          width: "38px",
          height: "38px",
          borderRadius: "10px",
          // background: color,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "22px",
          color: "white",
        }}
      >
        {icon}
      </div>
    </div>
  </div>
);


// export const KPICard = ({ title, value, subtitle, trend, riskLevel, onClick }: ExtendedKPICardProps) => {
//   return (
//     <Card 
//       className={` bg-card border-dashboard-border p-3 space-y-1 ${onClick ? 'cursor-pointer hover:bg-dashboard-card/80 transition-colors' : ''}`}
//       onClick={onClick}
//     >
//       <div className="text-muted-foreground text-[10px] font-normal tracking-wide">{title}</div>
//       <div className="flex items-baseline gap-2">
//         <div className="text-2xl font-bold text-kpi-light-blue tracking-tight">{value}</div>
//         {riskLevel && (
//           <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
//             riskLevel === 'high' ? 'bg-warning/20 text-warning' :
//             riskLevel === 'medium' ? 'bg-warning/20 text-warning' :
//             'bg-success/20 text-success'
//           }`}>
//             ★ {riskLevel === 'high' ? 'High' : riskLevel === 'medium' ? 'Medium-high' : 'Low'}
//           </span>
//         )}
//       </div>
//       {subtitle && (
//         <div className="text-muted-foreground text-[10px] pt-0.5">{subtitle}</div>
//       )}
//       {trend && (
//         <div className={`flex items-center gap-1 text-[10px] pt-0.5 ${
//           trend.isPositive ? 'text-success' : 'text-kpi-light-blue'
//         }`}>
//           {trend.isPositive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
//           <span>{trend.value}</span>
//         </div>
//       )}
//     </Card>
//   );
// };
