import { LucideIcon } from "lucide-react";

interface ComponentTileProps {
  icon: LucideIcon;
  label: string;
}

export const ComponentTile = ({ icon: Icon, label }: ComponentTileProps) => {
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("componentType", label);
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div 
      draggable
      onDragStart={handleDragStart}
      className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg bg-component-tile hover:bg-component-hover border border-node-border cursor-grab active:cursor-grabbing transition-colors group"
    >
      <Icon className="h-5 w-5 text-primary group-hover:text-accent-foreground transition-colors" />
      <span className="text-xs text-center text-foreground">{label}</span>
    </div>
  );
};
