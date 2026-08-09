import { LucideIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface FlowNodeProps {
  icon: LucideIcon;
  label: string;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
  showConnectionPoints?: boolean;
  isConnecting?: boolean;
}

export const FlowNode = ({ 
  icon: Icon, 
  label, 
  className, 
  onClick, 
  onDelete,
  showConnectionPoints = true,
  isConnecting = false
}: FlowNodeProps) => {
  return (
    <div className="relative group">
      {/* Connection Points */}
      {showConnectionPoints && (
        <>
          {/* Top connection point */}
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-primary border-2 border-background opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-20" />
          {/* Right connection point */}
          <div className="absolute top-1/2 -right-2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary border-2 border-background opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-20" />
          {/* Bottom connection point */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-primary border-2 border-background opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-20" />
          {/* Left connection point */}
          <div className="absolute top-1/2 -left-2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary border-2 border-background opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-20" />
        </>
      )}
      
      {/* Delete button */}
      {onDelete && (
        <Button
          size="sm"
          variant="destructive"
          className="absolute -top-2 -right-2 w-6 h-6 p-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(e);
          }}
        >
          <X className="h-3 w-3" />
        </Button>
      )}

      <div 
        onClick={onClick}
        className={cn(
          "flex flex-col items-center justify-center gap-2 px-4 py-3 rounded-lg bg-node hover:bg-node-hover border border-node-border cursor-pointer transition-all min-w-[100px]",
          isConnecting && "ring-2 ring-primary ring-offset-2 ring-offset-background",
          className
        )}
      >
        <Icon className="h-5 w-5 text-primary" />
        <span className="text-xs text-center text-foreground whitespace-nowrap">{label}</span>
      </div>
    </div>
  );
};
