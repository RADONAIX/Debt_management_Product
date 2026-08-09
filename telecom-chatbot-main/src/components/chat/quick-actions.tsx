import {
  Activity,
  Headset,
  Layers,
  Plane,
  Receipt,
  RadioTower,
  Ticket,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { QUICK_ACTIONS } from "@/lib/mock-data";

const ICONS: Record<string, LucideIcon> = {
  wallet: Wallet,
  activity: Activity,
  receipt: Receipt,
  zap: Zap,
  layers: Layers,
  plane: Plane,
  signal: RadioTower,
  ticket: Ticket,
  headset: Headset,
};

export function QuickActions({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (prompt: string) => void;
}) {
  return (
    <div className="border-t bg-surface-2/60 px-3 py-2 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="sr-only">Telecom quick actions</h2>
        <div className="flex gap-2 overflow-x-auto scrollbar-slim pb-1">
          {QUICK_ACTIONS.map((action) => {
            const Icon = ICONS[action.icon] ?? Zap;
            return (
              <button
                key={action.label}
                type="button"
                disabled={disabled}
                onClick={() => onSelect(action.prompt)}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border bg-card px-3 text-xs font-medium text-foreground shadow-xs transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none disabled:opacity-50"
              >
                <Icon className="size-3.5 text-primary" aria-hidden="true" />
                {action.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
