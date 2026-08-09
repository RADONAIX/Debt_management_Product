import { useState, useEffect, useRef } from "react";
import { StrategyHeader } from "./components/StrategyHeader";
import { LeftSidebar } from "./components/LeftSidebar";
import { WorkflowCanvas } from "./components/WorkflowCanvas";
import { RightSidebar } from "./components/RightSidebar";
import { TargetAudiencePanel } from "./components/TargetAudiencePanel";
import { ApprovalWorkflowDialog } from "./components/ApprovalWorkflowDialog";
import { VersionHistoryDialog } from "./components/VersionHistoryDialog";
import { StrategyInsightsPanel } from "./components/StrategyInsightsPanel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "./hooks/use-toast";
import { workflowTemplates, DEFAULT_WORKFLOW } from "@/lib/workflowTemplates";
import { Play, MessageSquare, Mail, MessageCircle, Phone, Target, FileText, CreditCard, Send, AlertCircle, Brain, Radio, FolderOpen, Zap, FileCheck } from "lucide-react";

import { getWorkflow, saveWorkflow, hasSavedWorkflow } from "@/lib/workflowStore";
import {
  getStrategy,
  updateStrategy,
  type StrategyRow,
  type StrategyUpdate,
} from "@/lib/strategies";
import { ApiError } from "@/lib/api";
import { iconForType } from "@/lib/nodeIcons";
import { hasPermission } from "@/lib/auth";


interface DesignerCanvasProps {
  /** Template id chosen in the Strategy Library. */
  strategyId?: string;
  /** Returns to the library. */
  onBack?: () => void;
}

const DesignerCanvas = ({ strategyId, onBack }: DesignerCanvasProps) => {
  const { toast } = useToast();
  const [targetAudienceOpen, setTargetAudienceOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [strategyInsightsOpen, setStrategyInsightsOpen] = useState(false);
  const [targetAudience, setTargetAudience] = useState<any>(null);
  const [workflowNodes, setWorkflowNodes] = useState<any[] | undefined>(undefined);
  const [workflowConnections, setWorkflowConnections] = useState<any[] | undefined>(undefined);
  const [currentWorkflow, setCurrentWorkflow] = useState<{ nodes: any[]; connections: any[] }>({ nodes: [], connections: [] });

  const [strategy, setStrategy] = useState<StrategyRow | null>(null);
  const canEdit = hasPermission("dunningStrategyDesigner", "edit");
  /** Save the Configuration panel's fields (suitability, outcomes, dialer). */
  const saveConfiguration = async (patch: StrategyUpdate): Promise<boolean> => {
    const sid = strategyId as string;
    if (!sid || sid === "new") return false;
    try {
      const saved = await updateStrategy(sid, patch);
      setStrategy(saved);
      // Every save that changes something is filed in Strategy Versions, so
      // say which version this became — it is what a rollback would name.
      toast({ title: "Configuration saved", description: `Filed as ${saved.version}.` });
      return true;
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof ApiError ? e.message : "Could not reach the server.",
        variant: "destructive",
      });
      return false;
    }
  };

  const [draftPromptOpen, setDraftPromptOpen] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);

  /** Save the canvas, then either return to the library or carry on editing. */
  const saveDraft = async (exit: boolean) => {
    setSavingDraft(true);
    const ok = await persist();
    setSavingDraft(false);
    if (!ok) return;
    setDraftPromptOpen(false);
    toast({
      title: "Draft saved",
      // Filed in Strategy Versions, where it can be compared or rolled back.
      description: `Canvas stored on the strategy as ${ok}.`,
    });
    if (exit) setTimeout(() => onBack?.(), 400);
  };

  /** Re-attach the lucide icon a node type maps to — icons aren't persisted. */
  const withIcons = (nodes: any[]) =>
    nodes.map((node: any) => ({ ...node, icon: iconForType(node.type) }));

  // Load the strategy's canvas from the database.
  useEffect(() => {
    const sid = strategyId as string;
    if (!sid) return;

    // A brand-new strategy opens on a blank canvas — no template, no nodes.
    if (sid === "new") {
      setStrategy(null);
      setWorkflowNodes([]);
      setWorkflowConnections([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const row = await getStrategy(sid);
        if (cancelled) return;
        setStrategy(row);
        const wf = (row.workflow ?? {}) as { nodes?: any[]; edges?: any[] };
        setWorkflowNodes(withIcons(wf.nodes ?? []));
        setWorkflowConnections(wf.edges ?? []);
      } catch (e) {
        if (cancelled) return;
        // Fall back to whatever was saved locally so work in progress isn't lost.
        const saved = getWorkflow(sid);
        setWorkflowNodes(withIcons(saved?.nodes ?? []));
        setWorkflowConnections(saved?.edges ?? []);
        toast({
          title: "Could not load the strategy",
          description: e instanceof ApiError ? e.message : "Showing the local copy.",
          variant: "destructive",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [strategyId, toast]);

  /** Persist the canvas — node positions, configuration and edges — to the strategy. */
  const persist = async (status?: string): Promise<string | false> => {
    const sid = strategyId as string;
    if (!sid || sid === "new") {
      toast({
        title: "Save the strategy first",
        description: "Create it from the Strategy Library so it has somewhere to save to.",
        variant: "destructive",
      });
      return false;
    }
    // Icons are React components — strip them before they reach JSON.
    const nodes = currentWorkflow.nodes.map(({ icon, ...rest }: any) => rest);
    let savedVersion = "";
    try {
      const row = await updateStrategy(sid, {
        workflow: { nodes, edges: currentWorkflow.connections },
        ...(status ? { status } : {}),
      });
      setStrategy(row);
      savedVersion = row.version;
      // Keep the local mirror in step for offline reloads.
      saveWorkflow(sid, {
        nodes,
        edges: currentWorkflow.connections,
        metadata: {
          name: row.name,
          segment: row.segment ?? "—",
          aging: (row.aging ?? []).join(", ") || "—",
          lastModified: row.updatedAt,
        },
      });
      return savedVersion;
    } catch (e) {
      toast({
        title: "Save failed",
        description: e instanceof ApiError ? e.message : "Could not reach the server.",
        variant: "destructive",
      });
      return false;
    }
  };

  const handleDisputeClassifier = () => {
    const disputes = [
      "Financial Hardship - High Priority (Requires payment plan)",
      "Documentation Error - Medium Priority (Verify account details)",
      "Service Complaint - Low Priority (Route to customer service)",
      "Payment Already Made - High Priority (Reconcile payment records)",
      "Fraudulent Charge - Critical Priority (Escalate immediately)"
    ];
    const randomDispute = disputes[Math.floor(Math.random() * disputes.length)];
    toast({
      title: "AI Dispute Classification",
      description: randomDispute,
    });
  };

  const handleConfirmAudience = (audience: any) => {
    setTargetAudience(audience);
    toast({
      title: "Target Audience Confirmed",
      description: `${audience.customerCount.toLocaleString()} customers selected`,
    });
  };

  const handleApprove = () => {
    void handlePublish();
    toast({
      title: "Strategy Approved",
      description: "Strategy has been published successfully",
    });
  };

  const handlePublish = async () => {
    if (!(await persist("Active"))) return;
    toast({
      title: "Strategy published",
      description: `${strategy?.name ?? "Strategy"} is now active.`,
    });
    setTimeout(() => onBack?.(), 800);
  };

  const handleReject = (comments: string) => {
    toast({
      title: "Strategy Rejected",
      description: comments,
      variant: "destructive",
    });
  };

  const handleRequestChanges = (comments: string) => {
    toast({
      title: "Changes Requested",
      description: comments,
    });
  };

  return (
    <div className="flex flex-col bg-background h-full">
      <StrategyHeader
        canEdit={canEdit}
        targetAudience={targetAudience}
        strategyName={strategy?.name ?? (strategyId === "new" ? "New Strategy" : undefined)}
        strategyStatus={strategy?.status ?? "Draft"}
        onTargetAudienceClick={() => setTargetAudienceOpen(true)}
        onSaveDraft={() => setDraftPromptOpen(true)}
        onSubmitApproval={() => setApprovalDialogOpen(true)}
        onPublish={handlePublish}
        onVersionHistory={() => setVersionHistoryOpen(true)}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          <LeftSidebar onStrategyInsights={() => setStrategyInsightsOpen(true)} />
          {workflowNodes !== undefined && (
            <WorkflowCanvas
              initialNodes={workflowNodes}
              initialConnections={workflowConnections}
              onWorkflowChange={(data) => setCurrentWorkflow(data)}
              // An empty stored canvas is a real state, not "load the template".
              blank={workflowNodes.length === 0}
            />
          )}
          <RightSidebar
            onDisputeClassifier={handleDisputeClassifier}
            strategy={strategy}
            canEdit={canEdit}
            onSaveStrategy={saveConfiguration}
          />
        </div>
      </div>

      <Dialog open={draftPromptOpen} onOpenChange={setDraftPromptOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save draft</DialogTitle>
            <DialogDescription>
              Store the current canvas on {strategy?.name ?? "this strategy"}. Do you want to keep
              editing afterwards?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="ghost"
              onClick={() => setDraftPromptOpen(false)}
              disabled={savingDraft}
            >
              Cancel
            </Button>
            <Button variant="outline" onClick={() => saveDraft(false)} disabled={savingDraft}>
              Save &amp; stay
            </Button>
            <Button onClick={() => saveDraft(true)} disabled={savingDraft}>
              {savingDraft && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save &amp; exit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TargetAudiencePanel
        open={targetAudienceOpen}
        onOpenChange={setTargetAudienceOpen}
        onConfirm={handleConfirmAudience}
      />

      <ApprovalWorkflowDialog
        open={approvalDialogOpen}
        onOpenChange={setApprovalDialogOpen}
        strategyData={{
          name: targetAudience ? `${targetAudience.segment} ${targetAudience.agingBucket} AI Strategy` : "New Strategy",
          segment: targetAudience?.segment || "Enterprise",
          agingBucket: targetAudience?.agingBucket || "61-90",
          riskRange: targetAudience ? `${targetAudience.riskScoreMin}-${targetAudience.riskScoreMax}` : "14-44",
          // 0 when no audience has been chosen yet — the approver should see
          // that, not a stand-in figure.
          customerCount: targetAudience?.customerCount ?? 0,
          expectedUplift: 14.2
        }}
        onApprove={handleApprove}
        onReject={handleReject}
        onRequestChanges={handleRequestChanges}
      />

      <VersionHistoryDialog
        open={versionHistoryOpen}
        onOpenChange={setVersionHistoryOpen}
      />

      <Dialog open={strategyInsightsOpen} onOpenChange={setStrategyInsightsOpen}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Strategy Insights - Real-time Analytics</DialogTitle>
          </DialogHeader>
          <StrategyInsightsPanel />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DesignerCanvas;
