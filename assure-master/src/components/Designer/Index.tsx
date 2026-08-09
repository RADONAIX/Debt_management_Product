import { useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import StrategyLibrary from "./StrategyLibrary";
import DesignerCanvas from "./DesignerCanvas";
import { workflowTemplates } from "@/lib/workflowTemplates";

/**
 * Dunning Strategy Designer.
 *
 * Two views behind one nav entry: the Strategy Library lands first, and picking
 * a strategy opens it in the canvas. The app shell owns navigation, so this uses
 * local state rather than routes.
 */
const Designer = () => {
  const [strategyId, setStrategyId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const openStrategy = (id: string) => setStrategyId(id || null);
  const backToLibrary = () => setStrategyId(null);

  if (!strategyId) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Strategy Library"
          description="Published and draft collection journeys — select one to open it in the designer"
          actions={
            <Button onClick={() => setNewOpen(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              New Strategy
            </Button>
          }
        />
        <StrategyLibrary
          onOpenStrategy={openStrategy}
          newOpen={newOpen}
          onNewOpenChange={setNewOpen}
        />
      </div>
    );
  }

  const template = workflowTemplates.find((t) => t.id === strategyId);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={backToLibrary}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Strategy Library
        </Button>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-foreground truncate">
            {template?.name ?? "New Strategy"}
          </h2>
          {template && (
            <p className="text-xs text-muted-foreground truncate">
              {template.segment} · {template.aging} · {template.version}
            </p>
          )}
        </div>
      </div>

      {/* Full-bleed canvas: cancels the shell's px-6 py-6 so it uses the whole area. */}
      <div className="-mx-6 -mb-6 h-[calc(100vh-11rem)] border-t border-border">
        <DesignerCanvas strategyId={strategyId} onBack={backToLibrary} />
      </div>
    </div>
  );
};

export default Designer;
