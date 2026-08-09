import React from "react";
import { Play, MessageSquare, Phone, FileText, Users, Scale, ArrowDown, ArrowRight, Mail, MessageCircle, Target, CreditCard, Send, FileCheck, Zap, FolderOpen, AlertCircle, Grid3x3, PlayCircle, TrendingUp, ZoomIn, ZoomOut, Maximize, Minimize, ChevronDown, ChevronUp, Brain, Radio } from "lucide-react";
import { FlowNode } from "./FlowNode";
import { useState } from "react";
import { EnhancedNodeConfigDialog } from "./EnhancedNodeConfigDialog";
import { SimulationDialog } from "./SimulationDialog";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  icon: LucideIcon;
  x: number;
  y: number;
  timing?: string;
  message?: string;
  condition?: string;
}

interface Connection {
  from: string;
  to: string;
}

const iconMap: Record<string, LucideIcon> = {
  "SMS": MessageSquare,
  "Email": Mail,
  "WhatsApp": MessageCircle,
  "IVR": Phone,
  "AI Dialer": Target,
  "VA": FileText,
  "Creds PTP": CreditCard,
  "Send Payment": Send,
  "Generate Settlement": FileCheck,
  "AI Proactive/Discovery": Zap,
  "Create Case": FolderOpen,
  "AI Next Best Action": Brain,
  "AI Recommend Channel": Radio,
};

export const WorkflowCanvas = () => {
  const { toast } = useToast();
  const [nodes, setNodes] = useState<WorkflowNode[]>([
    { id: "start", type: "start", label: "Start", icon: Play, x: 100, y: 50 },
    { id: "1", type: "SMS", label: "SMS Reminder", icon: MessageSquare, x: 100, y: 150 },
    { id: "2", type: "SMS", label: "2nd Reminder", icon: MessageSquare, x: 300, y: 150 },
    { id: "3", type: "WhatsApp", label: "WA Call", icon: Phone, x: 500, y: 150 },
    { id: "4", type: "Payment", label: "Payment Link", icon: FileText, x: 700, y: 150 },
  ]);
  
  const [connections, setConnections] = useState<Connection[]>([
    { from: "start", to: "1" },
    { from: "1", to: "2" },
    { from: "2", to: "3" },
    { from: "3", to: "4" },
  ]);
  
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [simulationOpen, setSimulationOpen] = useState(false);
  const [activeSimulationNodes, setActiveSimulationNodes] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [insightsPanelCollapsed, setInsightsPanelCollapsed] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const componentType = e.dataTransfer.getData("componentType");
    
    if (componentType) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      const newNode: WorkflowNode = {
        id: `node-${Date.now()}`,
        type: componentType,
        label: componentType,
        icon: iconMap[componentType] || MessageSquare,
        x: x - 50,
        y: y - 25,
      };
      
      setNodes([...nodes, newNode]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const hasCircularDependency = (from: string, to: string): boolean => {
    if (from === to) return true;
    
    const visited = new Set<string>();
    const queue = [to];
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === from) return true;
      
      if (visited.has(current)) continue;
      visited.add(current);
      
      const outgoing = connections.filter(c => c.from === current);
      queue.push(...outgoing.map(c => c.to));
    }
    
    return false;
  };

  const handleNodeClick = (node: WorkflowNode, e: React.MouseEvent) => {
    if (connectingFrom === null) {
      // Start connection mode
      setConnectingFrom(node.id);
      toast({
        title: "Connection Mode",
        description: "Click another node to connect, or click this node again to cancel.",
      });
    } else if (connectingFrom === node.id) {
      // Cancel connection mode
      setConnectingFrom(null);
      toast({
        title: "Cancelled",
        description: "Connection mode cancelled.",
      });
    } else {
      // Validate connection
      if (hasCircularDependency(connectingFrom, node.id)) {
        toast({
          title: "Invalid Connection",
          description: "This connection would create a circular dependency.",
          variant: "destructive",
        });
        setConnectingFrom(null);
        return;
      }
      
      // Complete the connection
      const newConnection = { from: connectingFrom, to: node.id };
      // Check if connection already exists
      const exists = connections.some(
        conn => conn.from === newConnection.from && conn.to === newConnection.to
      );
      if (!exists) {
        setConnections([...connections, newConnection]);
        toast({
          title: "Connected",
          description: "Nodes connected successfully.",
        });
      }
      setConnectingFrom(null);
    }
  };

  const handleNodeDoubleClick = (node: WorkflowNode) => {
    setSelectedNode(node);
    setDialogOpen(true);
  };

  const handleDeleteNode = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Don't allow deleting the start node
    if (nodeId === "start") {
      toast({
        title: "Cannot Delete",
        description: "The start node cannot be deleted.",
        variant: "destructive",
      });
      return;
    }
    
    // Remove the node
    setNodes(nodes.filter(n => n.id !== nodeId));
    // Remove any connections involving this node
    setConnections(connections.filter(c => c.from !== nodeId && c.to !== nodeId));
    
    toast({
      title: "Node Deleted",
      description: "Node and its connections have been removed.",
    });
  };

  const handleSaveConfig = (config: WorkflowNode) => {
    setNodes(nodes.map(n => n.id === config.id ? config : n));
    toast({
      title: "Configuration Saved",
      description: "Node configuration updated successfully.",
    });
  };

  const handleNodeMouseDown = (nodeId: string, e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    setDraggingNode(nodeId);
    
    const node = nodes.find(n => n.id === nodeId);
    if (node) {
      const rect = e.currentTarget.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (!draggingNode) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - dragOffset.x;
    const y = e.clientY - rect.top - dragOffset.y;
    
    setNodes(nodes.map(n => 
      n.id === draggingNode ? { ...n, x, y } : n
    ));
  };

  const handleCanvasMouseUp = () => {
    setDraggingNode(null);
  };

  const exportWorkflow = () => {
    const workflow = { nodes, connections };
    const dataStr = JSON.stringify(workflow, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `workflow-${Date.now()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    toast({
      title: "Workflow Exported",
      description: "Your workflow has been downloaded as JSON.",
    });
  };

  const importWorkflow = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const workflow = JSON.parse(event.target?.result as string);
        
        if (workflow.nodes && workflow.connections) {
          // Map icons back
          const importedNodes = workflow.nodes.map((node: WorkflowNode) => ({
            ...node,
            icon: iconMap[node.type] || MessageSquare
          }));
          
          setNodes(importedNodes);
          setConnections(workflow.connections);
          
          toast({
            title: "Workflow Imported",
            description: "Your workflow has been loaded successfully.",
          });
        } else {
          throw new Error("Invalid workflow format");
        }
      } catch (error) {
        toast({
          title: "Import Failed",
          description: "Failed to import workflow. Please check the file format.",
          variant: "destructive",
        });
      }
    };
    reader.readAsText(file);
  };

  const getNodeCenter = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };

    if (node.id === "start") {
      return { x: node.x + 24, y: node.y + 24 }; // Center of circular start node
    }
    return { x: node.x + 50, y: node.y + 25 }; // Center of rectangular node
  };

  /** Half-extents of a node, used to place edge endpoints on its border. */
  const nodeHalfSize = (nodeId: string) =>
    nodeId === "start" ? { w: 24, h: 24 } : { w: 50, h: 25 };

  /**
   * A connection as a smooth vertical bezier running from the bottom edge of
   * the source to the top edge of the target (or the sides, when the nodes sit
   * roughly level). Endpoints stop at the border so the arrowhead stays visible
   * instead of disappearing under the target box.
   */
  const getConnectionPath = (fromId: string, toId: string) => {
    const a = getNodeCenter(fromId);
    const b = getNodeCenter(toId);
    const fa = nodeHalfSize(fromId);
    const fb = nodeHalfSize(toId);
    const GAP = 6; // breathing room between the arrow tip and the node

    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const horizontal = Math.abs(dx) > Math.abs(dy) * 1.5;

    if (horizontal) {
      const dir = dx >= 0 ? 1 : -1;
      const x1 = a.x + dir * fa.w;
      const x2 = b.x - dir * (fb.w + GAP);
      const c = Math.max(30, Math.abs(x2 - x1) / 2);
      return `M ${x1} ${a.y} C ${x1 + dir * c} ${a.y}, ${x2 - dir * c} ${b.y}, ${x2} ${b.y}`;
    }

    const dir = dy >= 0 ? 1 : -1;
    const y1 = a.y + dir * fa.h;
    const y2 = b.y - dir * (fb.h + GAP);
    const c = Math.max(30, Math.abs(y2 - y1) / 2);
    return `M ${a.x} ${y1} C ${a.x} ${y1 + dir * c}, ${b.x} ${y2 - dir * c}, ${b.x} ${y2}`;
  };

  const clearConnections = () => {
    setConnections([]);
    setConnectingFrom(null);
  };

  const autoLayout = () => {
    const startNode = nodes.find(n => n.type === "start");
    if (!startNode) return;

    const positioned = new Set<string>();
    const newNodes = [...nodes];
    const layers: string[][] = [[]];
    
    // Build layers using BFS
    const queue: Array<{ id: string; layer: number }> = [{ id: startNode.id, layer: 0 }];
    positioned.add(startNode.id);
    
    while (queue.length > 0) {
      const { id, layer } = queue.shift()!;
      
      if (!layers[layer]) layers[layer] = [];
      layers[layer].push(id);
      
      const outgoing = connections.filter(c => c.from === id);
      outgoing.forEach(conn => {
        if (!positioned.has(conn.to)) {
          positioned.add(conn.to);
          queue.push({ id: conn.to, layer: layer + 1 });
        }
      });
    }
    
    // Position nodes in layers
    const horizontalSpacing = 200;
    const verticalSpacing = 150;
    const startX = 100;
    const startY = 50;
    
    layers.forEach((layer, layerIndex) => {
      layer.forEach((nodeId, nodeIndex) => {
        const nodeIdx = newNodes.findIndex(n => n.id === nodeId);
        if (nodeIdx !== -1) {
          newNodes[nodeIdx].x = startX + (layerIndex * horizontalSpacing);
          newNodes[nodeIdx].y = startY + (nodeIndex * verticalSpacing);
        }
      });
    });
    
    setNodes(newNodes);
    toast({
      title: "Layout Applied",
      description: "Nodes have been arranged automatically.",
    });
  };

  const handlePreviewImpact = () => {
    setPreviewOpen(true);
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.1, 2));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.1, 0.5));
  };

  const handleZoomReset = () => {
    setZoom(1);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <>
      <div 
        className="flex-1 bg-canvas overflow-auto p-8 relative"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
        onMouseLeave={handleCanvasMouseUp}
      >
        {/* Connection mode indicator */}
        {connectingFrom && (
          <div className="absolute top-4 right-4 bg-primary text-primary-foreground px-4 py-2 rounded-md text-sm z-50 flex items-center gap-2">
            <span>🔗 Click another node to connect</span>
            <Button 
              size="sm"
              variant="secondary"
              onClick={() => setConnectingFrom(null)}
            >
              Cancel
            </Button>
          </div>
        )}

        {/* Controls */}
        <div className="absolute top-4 left-4 flex flex-wrap gap-2 z-50 max-w-3xl">
          <Button 
            variant="outline" 
            size="sm"
            onClick={clearConnections}
          >
            Clear Connections
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={exportWorkflow}
          >
            Export
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => document.getElementById('import-workflow')?.click()}
          >
            Import
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={autoLayout}
          >
            <Grid3x3 className="h-4 w-4 mr-1" />
            Auto-Layout
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setSimulationOpen(true)}
          >
            <PlayCircle className="h-4 w-4 mr-1" />
            Simulate
          </Button>
          <div className="flex gap-1 border-l pl-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleZoomOut}
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleZoomReset}
              title="Reset Zoom"
            >
              {Math.round(zoom * 100)}%
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleZoomIn}
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
          <input
            id="import-workflow"
            type="file"
            accept=".json"
            className="hidden"
            onChange={importWorkflow}
          />
        </div>

        <div 
          className="min-h-full relative transition-transform origin-top-left"
          style={{ transform: `scale(${zoom})` }}
        >
          {/* SVG for connections */}
          <svg 
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 1 }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="9"
                markerHeight="7"
                refX="8"
                refY="3.5"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M 0 0 L 9 3.5 L 0 7 z" fill="hsl(var(--primary))" />
              </marker>
              <marker
                id="arrowhead-muted"
                markerWidth="9"
                markerHeight="7"
                refX="8"
                refY="3.5"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M 0 0 L 9 3.5 L 0 7 z" fill="hsl(var(--primary) / 0.55)" />
              </marker>
            </defs>
            {connections.map((conn, idx) => {
              const isActiveConnection = activeSimulationNodes.includes(conn.from) && activeSimulationNodes.includes(conn.to);

              return (
                <path
                  key={idx}
                  d={getConnectionPath(conn.from, conn.to)}
                  fill="none"
                  stroke={isActiveConnection ? "hsl(var(--primary))" : "hsl(var(--primary) / 0.55)"}
                  strokeWidth={isActiveConnection ? 2.5 : 1.75}
                  strokeLinecap="round"
                  markerEnd={`url(#${isActiveConnection ? "arrowhead" : "arrowhead-muted"})`}
                  className={isActiveConnection ? "animate-pulse" : ""}
                />
              );
            })}
          </svg>

          {/* Nodes */}
          {nodes.map((node) => (
            <div 
              key={node.id} 
              className="absolute"
              style={{ left: `${node.x}px`, top: `${node.y}px`, zIndex: 10 }}
            >
              {node.id === "start" ? (
                <div 
                  onClick={(e) => handleNodeClick(node, e)}
                  onDoubleClick={() => handleNodeDoubleClick(node)}
                  onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
                  className={`flex flex-col items-center gap-2 cursor-move transition-all ${
                    connectingFrom === node.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''
                  } ${activeSimulationNodes.includes(node.id) ? 'scale-110 animate-pulse' : ''}`}
                >
                  <div className={`w-12 h-12 rounded-full bg-node border-2 flex items-center justify-center ${
                    activeSimulationNodes.includes(node.id) ? 'border-primary bg-primary/20' : 'border-primary'
                  }`}>
                    <Play className={`h-6 w-6 ${activeSimulationNodes.includes(node.id) ? 'text-primary' : 'text-primary'}`} />
                  </div>
                  <span className="text-sm text-foreground">Start</span>
                </div>
              ) : (
                <div
                  onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
                  onDoubleClick={() => handleNodeDoubleClick(node)}
                  className={`cursor-move transition-all ${activeSimulationNodes.includes(node.id) ? 'scale-110' : ''}`}
                >
                  <FlowNode 
                    icon={node.icon} 
                    label={node.label}
                    onClick={(e) => handleNodeClick(node, e)}
                    onDelete={(e) => handleDeleteNode(node.id, e)}
                    isConnecting={connectingFrom === node.id}
                    className={activeSimulationNodes.includes(node.id) ? 'ring-2 ring-primary bg-primary/10 animate-pulse' : ''}
                  />
                </div>
              )}
            </div>
          ))}

          {/* Drop Hint */}
          {nodes.length <= 5 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ top: '300px' }}>
              <p className="text-muted-foreground text-sm">
                Drag components from the left sidebar to build your workflow
              </p>
            </div>
          )}

          {/* Strategy Insights Panel - At bottom of canvas */}
          <div className="absolute bottom-4 left-4 right-4 bg-card border-2 border-border rounded-lg shadow-lg transition-all" style={{ zIndex: 20 }}>
            <div className="px-6 py-3 flex items-center justify-between border-b border-border">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                Strategy Insights
              </h4>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setInsightsPanelCollapsed(!insightsPanelCollapsed)}
                title={insightsPanelCollapsed ? "Expand Panel" : "Collapse Panel"}
              >
                {insightsPanelCollapsed ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
            {!insightsPanelCollapsed && (
              <div className="px-6 py-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Target className="h-4 w-4 text-primary" />
                      Evaluation
                    </h4>
                    <ul className="space-y-1.5 text-xs text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <Target className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                        <span>AI Evaluated</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <TrendingUp className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                        <span>Expected uplift +16.2%</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Scale className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                        <span>Confidentiality, Improvement</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <CreditCard className="h-3 w-3 text-primary mt-0.5 flex-shrink-0" />
                        <span>Predicted collections $ 2.15M Mn + 90 days +15%</span>
                      </li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                      Risk Warnings
                    </h4>
                    <ul className="space-y-1.5 text-xs text-muted-foreground">
                      <li className="flex items-start gap-2">
                        <AlertCircle className="h-3 w-3 text-orange-500 mt-0.5 flex-shrink-0" />
                        <span>Compliance review needed</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Mail className="h-3 w-3 text-orange-500 mt-0.5 flex-shrink-0" />
                        <span>Payment link fatigue - low</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <Users className="h-3 w-3 text-green-500 mt-0.5 flex-shrink-0" />
                        <span>Customer sentiment - positive</span>
                      </li>
                    </ul>
                  </div>
                  <div className="flex items-center justify-center lg:justify-end">
                    <Button 
                      onClick={handlePreviewImpact}
                      size="lg"
                      className="bg-primary text-primary-foreground hover:bg-primary/90 w-full lg:w-auto"
                    >
                      <TrendingUp className="h-4 w-4 mr-2" />
                      Preview Impact
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <EnhancedNodeConfigDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        node={selectedNode}
        onSave={handleSaveConfig}
      />

      <SimulationDialog
        open={simulationOpen}
        onOpenChange={setSimulationOpen}
        nodes={nodes}
        connections={connections}
        onActiveNodes={setActiveSimulationNodes}
      />

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="sm:max-w-[600px] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">Strategy Impact Preview</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-background border border-border rounded-lg p-4">
                <h4 className="text-sm font-semibold text-foreground mb-3">Expected Outcomes</h4>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Collection Rate</p>
                    <p className="text-2xl font-bold text-primary">+16.2%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Response Time</p>
                    <p className="text-2xl font-bold text-primary">-24h</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Customer Satisfaction</p>
                    <p className="text-2xl font-bold text-primary">+8.5%</p>
                  </div>
                </div>
              </div>
              <div className="bg-background border border-border rounded-lg p-4">
                <h4 className="text-sm font-semibold text-foreground mb-3">Revenue Impact</h4>
                <div className="space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Projected Collections</p>
                    <p className="text-2xl font-bold text-primary">$ 2.15M</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">90-Day Increase</p>
                    <p className="text-2xl font-bold text-primary">+15%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Cost Efficiency</p>
                    <p className="text-2xl font-bold text-primary">+22%</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-background border border-border rounded-lg p-4">
              <h4 className="text-sm font-semibold text-foreground mb-2">AI Confidence Score</h4>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-muted rounded-full h-3">
                  <div className="bg-primary h-3 rounded-full" style={{ width: '87%' }}></div>
                </div>
                <span className="text-sm font-bold text-primary">87%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                High confidence based on historical data and similar strategy performance
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
