import { LucideIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * What a step does, which is the only thing worth colouring a node by. A
 * reader should be able to tell a message from a decision from an ending
 * without reading a word.
 */
export type NodeKind = "channel" | "action" | "decision" | "terminal" | "start";

const KIND_STYLE: Record<NodeKind, { chip: string; icon: string; accent: string }> = {
  channel:  { chip: "bg-info/10",        icon: "text-info",        accent: "bg-info" },
  action:   { chip: "bg-primary/10",     icon: "text-primary",     accent: "bg-primary" },
  decision: { chip: "bg-warning/10",     icon: "text-warning",     accent: "bg-warning" },
  terminal: { chip: "bg-muted",          icon: "text-muted-foreground", accent: "bg-muted-foreground" },
  start:    { chip: "bg-success/10",     icon: "text-success",     accent: "bg-success" },
};

/**
 * Which kind a step is, worked out from its label and icon rather than stored,
 * so existing saved workflows get the styling without a migration.
 */
export const kindOf = (label: string, iconName?: string): NodeKind => {
  const l = label.toLowerCase();
  if (l.includes("?")) return "decision";
  if (/^(close|end|stop|exit)\b/.test(l) || l.includes("— settled") || l.includes("closed")) {
    return "terminal";
  }
  const channels = ["sms", "email", "whatsapp", "ivr", "call", "dialer", "push",
                    "voice", "notification", "statement", "nudge", "reminder"];
  if (channels.some((c) => l.includes(c))) return "channel";
  if (iconName && ["MessageSquare", "Mail", "Phone", "Bell"].includes(iconName)) {
    return "channel";
  }
  return "action";
};

interface FlowNodeProps {
  icon: LucideIcon;
  label: string;
  className?: string;
  kind?: NodeKind;
  onClick?: (e: React.MouseEvent) => void;
  onDelete?: (e: React.MouseEvent) => void;
  showConnectionPoints?: boolean;
  isConnecting?: boolean;
}

export const FlowNode = ({
  icon: Icon,
  label,
  className,
  kind,
  onClick,
  onDelete,
  showConnectionPoints = true,
  isConnecting = false,
}: FlowNodeProps) => {
  const style = KIND_STYLE[kind ?? kindOf(label)];

  return (
    <div className="relative group">
      {/* Connection points */}
      {showConnectionPoints && (
        <>
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-primary border-2 border-background opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-20" />
          <div className="absolute top-1/2 -right-2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary border-2 border-background opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-20" />
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-primary border-2 border-background opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-20" />
          <div className="absolute top-1/2 -left-2 -translate-y-1/2 w-4 h-4 rounded-full bg-primary border-2 border-background opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-20" />
        </>
      )}

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
          // A real border and a shadow, so a node sits on the canvas rather
          // than dissolving into it.
          "relative flex items-center gap-2.5 pl-4 pr-3 py-2.5 rounded-xl w-[168px]",
          "bg-node hover:bg-node-hover border border-node-border shadow-sm",
          "hover:shadow-md hover:border-primary/40 cursor-pointer transition-all overflow-hidden",
          isConnecting && "ring-2 ring-primary ring-offset-2 ring-offset-canvas",
          className,
        )}
      >
        {/* Colour strip: what kind of step this is, readable at any zoom. */}
        <span className={cn("absolute left-0 top-0 bottom-0 w-1", style.accent)} />
        <span className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                            style.chip)}>
          <Icon className={cn("h-4 w-4", style.icon)} />
        </span>
        <span className="text-[11px] leading-tight text-foreground text-left line-clamp-2">
          {label}
        </span>
      </div>
    </div>
  );
};
