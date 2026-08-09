import { useState } from "react";
import { Button } from "./components/ui/button";
import { KPICard } from "./components/dispute/KPICard";
import { DisputeList } from "./components/dispute/DisputeList";
import { DisputeDetails } from "./components/dispute/DisputeDetails";
import { AIReconciliationDialog } from "./components/dispute/AIReconciliationDialog";
import { DisputeComparisonDialog } from "./components/dispute/DisputeComparisonDialog";
import { NewDisputeDialog } from "./components/dispute/NewDisputeDialog";
import { AddNoteDialog } from "./components/dispute/AddNoteDialog";
import { ReassignDialog } from "./components/dispute/ReassignDialog";
import { UpdateStatusDialog } from "./components/dispute/UpdateStatusDialog";
import { AlertCircle, Clock, CheckCircle, TrendingUp, Plus } from "lucide-react";
import { mockDisputes, customerData } from "./data/mockData";
import { Dispute, AIReconciliationResult } from "./types/dispute";
import { performAIReconciliation } from "./utils/aiReconciliation";
import { toast } from "sonner";

const AiDispute = () => {
  const [disputes, setDisputes] = useState<Dispute[]>(mockDisputes);
  const [selectedDispute, setSelectedDispute] = useState<Dispute | null>(null);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [aiResult, setAiResult] = useState<AIReconciliationResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Comparison state
  const [selectedForComparison, setSelectedForComparison] = useState<string[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  
  // Dialog states
  const [showNewDispute, setShowNewDispute] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [showReassign, setShowReassign] = useState(false);
  const [showUpdateStatus, setShowUpdateStatus] = useState(false);

  const handleSelectDispute = (dispute: Dispute) => {
    setSelectedDispute(dispute);
  };

  const handleNewDispute = (newDispute: Dispute) => {
    setDisputes([newDispute, ...disputes]);
    setSelectedDispute(newDispute);
  };

  const handleAddNote = (note: string, attachments: File[]) => {
    if (!selectedDispute) return;

    const newTimelineEvent = {
      id: String(selectedDispute.timeline.length + 1),
      title: "Note Added",
      by: "Current User",
      note,
      date: new Date().toISOString().split('T')[0]
    };

    const newAttachments = attachments.map(f => ({ name: f.name, type: f.type }));

    const updatedDispute = {
      ...selectedDispute,
      timeline: [...selectedDispute.timeline, newTimelineEvent],
      attachments: [...selectedDispute.attachments, ...newAttachments]
    };

    setDisputes(disputes.map(d => d.id === selectedDispute.id ? updatedDispute : d));
    setSelectedDispute(updatedDispute);
  };

  const handleReassign = (agent: string) => {
    if (!selectedDispute) return;

    const newTimelineEvent = {
      id: String(selectedDispute.timeline.length + 1),
      title: "Reassigned",
      by: "System",
      note: `Dispute reassigned to ${agent}`,
      date: new Date().toISOString().split('T')[0]
    };

    const updatedDispute = {
      ...selectedDispute,
      assignedTo: agent,
      timeline: [...selectedDispute.timeline, newTimelineEvent]
    };

    setDisputes(disputes.map(d => d.id === selectedDispute.id ? updatedDispute : d));
    setSelectedDispute(updatedDispute);
  };

  const handleUpdateStatus = (status: string, note: string) => {
    if (!selectedDispute) return;

    const newTimelineEvent = {
      id: String(selectedDispute.timeline.length + 1),
      title: `Status Updated to ${status}`,
      by: "Current User",
      note,
      date: new Date().toISOString().split('T')[0]
    };

    const updatedDispute = {
      ...selectedDispute,
      status: status as any,
      timeline: [...selectedDispute.timeline, newTimelineEvent]
    };

    setDisputes(disputes.map(d => d.id === selectedDispute.id ? updatedDispute : d));
    setSelectedDispute(updatedDispute);
  };

  const handleToggleComparison = (disputeId: string) => {
    setSelectedForComparison(prev => 
      prev.includes(disputeId) 
        ? prev.filter(id => id !== disputeId)
        : [...prev, disputeId]
    );
  };

  const handleRemoveFromComparison = (disputeId: string) => {
    setSelectedForComparison(prev => prev.filter(id => id !== disputeId));
  };

  const handleBulkStatusUpdate = (disputeIds: string[], status: string) => {
    const updatedDisputes = disputes.map(d => 
      disputeIds.includes(d.id) 
        ? { ...d, status: status as any, timeline: [...d.timeline, {
            id: String(d.timeline.length + 1),
            title: `Bulk Status Update to ${status}`,
            by: "Current User",
            note: "Updated via bulk comparison action",
            date: new Date().toISOString().split('T')[0]
          }]}
        : d
    );
    setDisputes(updatedDisputes);
    
    // Update selected dispute if it was affected
    if (selectedDispute && disputeIds.includes(selectedDispute.id)) {
      const updated = updatedDisputes.find(d => d.id === selectedDispute.id);
      if (updated) setSelectedDispute(updated);
    }
  };

  const handleBulkReassign = (disputeIds: string[], agent: string) => {
    const updatedDisputes = disputes.map(d => 
      disputeIds.includes(d.id) 
        ? { ...d, assignedTo: agent, timeline: [...d.timeline, {
            id: String(d.timeline.length + 1),
            title: "Bulk Reassignment",
            by: "System",
            note: `Dispute reassigned to ${agent} via bulk comparison action`,
            date: new Date().toISOString().split('T')[0]
          }]}
        : d
    );
    setDisputes(updatedDisputes);
    
    // Update selected dispute if it was affected
    if (selectedDispute && disputeIds.includes(selectedDispute.id)) {
      const updated = updatedDisputes.find(d => d.id === selectedDispute.id);
      if (updated) setSelectedDispute(updated);
    }
  };

  const handleAIReconcile = async () => {
    if (!selectedDispute) return;

    const customer = customerData[selectedDispute.customerId];
    if (!customer) {
      toast.error("Customer data not found");
      return;
    }

    setShowAIDialog(true);
    setIsAnalyzing(true);
    setAiResult(null);

    try {
      const result = await performAIReconciliation(customer, selectedDispute.description);
      setAiResult(result);
      toast.success("AI analysis completed successfully");
    } catch (error) {
      toast.error("Failed to perform AI reconciliation");
      setShowAIDialog(false);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const kpiData = [
    {
      title: "Open Disputes",
      value: mockDisputes.filter(d => d.status !== "RESOLVED").length,
      icon: AlertCircle,
      iconColor: "text-destructive"
    },
    {
      title: "Investigating",
      value: mockDisputes.filter(d => d.status === "INVESTIGATING").length,
      icon: Clock,
      iconColor: "text-info"
    },
    {
      title: "Resolved Today",
      value: mockDisputes.filter(d => d.status === "RESOLVED").length,
      icon: CheckCircle,
      iconColor: "text-success"
    },
    {
      title: "Resolution Rate",
      value: "85%",
      icon: TrendingUp,
      iconColor: "text-primary"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Dispute Management</h1>
              <p className="text-muted-foreground mt-1">Handle customer disputes and service billing issues</p>
            </div>
            <Button size="lg">
              <Plus className="w-4 h-4 mr-2" />
              New Dispute
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-6 py-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          {kpiData.map((kpi, idx) => (
            <KPICard key={idx} {...kpi} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <DisputeList
              disputes={disputes}
              selectedDispute={selectedDispute}
              onSelectDispute={handleSelectDispute}
              selectedForComparison={selectedForComparison}
              onToggleComparison={handleToggleComparison}
              onOpenComparison={() => setShowComparison(true)}
            />
          </div>
          <div className="lg:col-span-2">
            <DisputeDetails 
              dispute={selectedDispute} 
              onAIReconcile={handleAIReconcile}
              onAddNote={() => setShowAddNote(true)}
              onReassign={() => setShowReassign(true)}
              onUpdateStatus={() => setShowUpdateStatus(true)}
            />
          </div>
        </div>
      </main>

      <AIReconciliationDialog
        open={showAIDialog}
        onOpenChange={setShowAIDialog}
        result={aiResult}
        isAnalyzing={isAnalyzing}
      />

      <DisputeComparisonDialog
        open={showComparison}
        onOpenChange={setShowComparison}
        disputes={disputes.filter(d => selectedForComparison.includes(d.id))}
        onBulkStatusUpdate={handleBulkStatusUpdate}
        onBulkReassign={handleBulkReassign}
        onRemoveFromComparison={handleRemoveFromComparison}
      />

      <NewDisputeDialog
        open={showNewDispute}
        onOpenChange={setShowNewDispute}
        onSubmit={handleNewDispute}
      />

      {selectedDispute && (
        <>
          <AddNoteDialog
            open={showAddNote}
            onOpenChange={setShowAddNote}
            onSubmit={handleAddNote}
            disputeId={selectedDispute.id}
          />

          <ReassignDialog
            open={showReassign}
            onOpenChange={setShowReassign}
            onSubmit={handleReassign}
            currentAssignee={selectedDispute.assignedTo}
            disputeData={selectedDispute}
          />

          <UpdateStatusDialog
            open={showUpdateStatus}
            onOpenChange={setShowUpdateStatus}
            onSubmit={handleUpdateStatus}
            currentStatus={selectedDispute.status}
            disputeData={selectedDispute}
          />
        </>
      )}
    </div>
  );
};

export default AiDispute;
