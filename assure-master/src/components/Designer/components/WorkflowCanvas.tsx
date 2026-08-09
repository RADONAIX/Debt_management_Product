import React, { useEffect, useLayoutEffect, useRef, useMemo, useState } from "react";
import { Play, MessageSquare, Phone, FileText, Users, Scale, ArrowDown, ArrowRight, Mail, MessageCircle, Target, CreditCard, Send, FileCheck, Zap, FolderOpen, AlertCircle, Grid3x3, PlayCircle, TrendingUp, ZoomIn, ZoomOut, Maximize, Minimize, ChevronDown, ChevronUp, Brain, Radio, Sparkles, TestTube2, Plus } from "lucide-react";
import { FlowNode } from "./FlowNode";
import { iconForType } from "@/lib/nodeIcons";
import { EnhancedNodeConfigDialog } from "./EnhancedNodeConfigDialog";
import { SimulationDialog } from "./SimulationDialog";
import { ABTestingPanel } from "./ABTestingPanel";
import { WhatIfAnalysisPanel } from "./WhatIfAnalysisPanel";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DEFAULT_WORKFLOW } from "@/lib/workflowTemplates";

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

type Side = "top" | "right" | "bottom" | "left";

interface Connection {
  from: string;
  to: string;
  /** Which side of each node the connector attaches to. Omitted = auto. */
  fromSide?: Side;
  toSide?: Side;
}


interface WorkflowCanvasProps {
  initialNodes?: WorkflowNode[];
  initialConnections?: Connection[];
  onWorkflowChange?: (data: { nodes: WorkflowNode[]; connections: Connection[] }) => void;
  /** Start from an empty canvas (a brand-new strategy), not the default template. */
  blank?: boolean;
}

export const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({ 
  initialNodes, 
  initialConnections,
  onWorkflowChange,
  blank = false,
}) => {
  const { toast } = useToast();
  
  // Use DEFAULT_WORKFLOW as fallback, mapping nodes with proper icons
  const getDefaultNodes = (): WorkflowNode[] => {
    if (blank) return [];
    if (initialNodes && initialNodes.length) return initialNodes.map(n => ({ ...n, icon: iconForType(n.type) }));
    return DEFAULT_WORKFLOW.nodes.map(node => ({
      ...node,
      icon: iconForType(node.type),
    }));
  };

  
  
  const [nodes, setNodes] = useState<WorkflowNode[]>(getDefaultNodes());
  
  
  const [connections, setConnections] = useState<Connection[]>(
    (blank ? [] : initialConnections && initialConnections.length ? initialConnections : DEFAULT_WORKFLOW.connections)
  );

useLayoutEffect(() => {
  setNodes(prev => [...prev]);        // forces recalculation
  setConnections(prev => [...prev]);  // forces connector redraw
}, []);



  // Sync when parent provides new initial workflow (e.g., after loading from storage)
  React.useEffect(() => {
    if (initialNodes && initialNodes.length) {
      setNodes(initialNodes.map(n => ({ ...n, icon: iconForType(n.type) })) as WorkflowNode[]);
    }
  }, [initialNodes]);

  React.useEffect(() => {
    if (initialConnections && initialConnections.length) {
      setConnections(initialConnections);
    }
  }, [initialConnections]);
  
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
  const [abTestingOpen, setAbTestingOpen] = useState(false);
  const [whatIfOpen, setWhatIfOpen] = useState(false);
  /** Node the pointer is over — drives the hover "+" link handle. */
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  /** Edge the pointer is over — drives its remove button. */
  const [hoveredEdge, setHoveredEdge] = useState<number | null>(null);
  /** Live cursor position while dragging a new connector, in canvas space. */
  const [linkCursor, setLinkCursor] = useState<{ x: number; y: number } | null>(null);
  /** Which side of the source node the in-progress connector left from. */
  const [connectingSide, setConnectingSide] = useState<Side>("bottom");

  // Emit workflow changes to parent
  React.useEffect(() => {
    onWorkflowChange?.({ nodes, connections });
  }, [nodes, connections]);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const componentType = e.dataTransfer.getData("componentType");
    
    if (componentType) {
      // Measured against the surface like every other position, so a component
      // lands where it was dropped however the canvas is scrolled or zoomed.
      const p = pointFrom(e);
      const x = Math.max(0, p.x - 84);   // centred on the cursor: half a node
      const y = Math.max(0, p.y - 26);
      
      const newNode: WorkflowNode = {
        id: `node-${Date.now()}`,
        type: componentType,
        label: componentType,
        icon: iconForType(componentType),
        x,
        y,
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

  /** Draw a connector from `connectingFrom` to `node`, with validation. */
  const completeConnection = (node: WorkflowNode, toSide?: Side) => {
    if (!connectingFrom || connectingFrom === node.id) {
      setConnectingFrom(null);
      return;
    }
    {
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
      const newConnection: Connection = {
        from: connectingFrom,
        to: node.id,
        fromSide: connectingSide,
        toSide,
      };
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

  /** A plain click opens the node's configuration, or lands a connector. */
  const handleNodeClick = (node: WorkflowNode, e: React.MouseEvent) => {
    e.stopPropagation();
    if (connectingFrom) {
      completeConnection(node);
      return;
    }
    setSelectedNode(node);
    setDialogOpen(true);
  };

  /**
   * Cursor position in node coordinates. The surface's own rect already
   * accounts for scrolling and padding, and it is measured post-transform —
   * so dividing by the zoom is all that's needed to undo the scale.
   */
  /**
   * Where a pointer is in canvas coordinates.
   *
   * Measured against the surface — the element the nodes are positioned in —
   * and divided by the zoom, so the answer is in the same units as node.x/y
   * whatever the canvas is scrolled or scaled to. Takes a raw event so the
   * window-level drag listeners can use it too.
   */
  const pointFrom = (e: { clientX: number; clientY: number }) => {
    const rect = surfaceRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (e.clientX - rect.left) / zoom,
      y: (e.clientY - rect.top) / zoom,
    };
  };

  const canvasPoint = (e: React.MouseEvent) => pointFrom(e);

  /** Grab a "+" handle to start dragging a connector out of that side. */
  const startLink = (nodeId: string, side: Side, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setConnectingFrom(nodeId);
    setConnectingSide(side);
    setLinkCursor(canvasPoint(e));
  };

  /** Outward direction of a side, used to shape the bezier's control points. */
  const sideNormal = (side: Side) =>
    side === "top" ? { x: 0, y: -1 }
    : side === "bottom" ? { x: 0, y: 1 }
    : side === "left" ? { x: -1, y: 0 }
    : { x: 1, y: 0 };

  /**
   * A bezier between two anchors that leaves and arrives perpendicular to the
   * node edge, stopping just short of the target so the arrowhead stays clear.
   *
   * Returns the midpoint of the curve as well as its `d`. The halfway point
   * between two node centres is not on a curved connector at all — putting the
   * delete button there left it floating in empty space, away from the line it
   * belonged to.
   */
  const connectorPath = (
    from: { x: number; y: number },
    fromSide: Side,
    to: { x: number; y: number },
    toSide: Side,
  ) => {
    const GAP = 8;
    const SNAP = 12; // treat this much offset as "in line"

    // Stacked nodes that are all but aligned get a straight line rather than a
    // shallow S — the wobble reads as a mistake.
    const vertical = (fromSide === "bottom" || fromSide === "top")
      && (toSide === "top" || toSide === "bottom");
    if (vertical && Math.abs(to.x - from.x) <= SNAP) {
      const dir = toSide === "top" ? -1 : 1;
      const endY = to.y + dir * GAP;
      return {
        d: `M ${from.x} ${from.y} L ${from.x} ${endY}`,
        mid: { x: from.x, y: (from.y + endY) / 2 },
      };
    }
    const horizontal = (fromSide === "left" || fromSide === "right")
      && (toSide === "left" || toSide === "right");
    if (horizontal && Math.abs(to.y - from.y) <= SNAP) {
      const dir = toSide === "left" ? -1 : 1;
      const endX = to.x + dir * GAP;
      return {
        d: `M ${from.x} ${from.y} L ${endX} ${from.y}`,
        mid: { x: (from.x + endX) / 2, y: from.y },
      };
    }
    const nf = sideNormal(fromSide);
    const nt = sideNormal(toSide);
    const end = { x: to.x + nt.x * GAP, y: to.y + nt.y * GAP };
    const span = Math.max(Math.abs(end.x - from.x), Math.abs(end.y - from.y));
    const c = Math.max(30, span * 0.45);
    const c1 = { x: from.x + nf.x * c, y: from.y + nf.y * c };
    const c2 = { x: end.x + nt.x * c, y: end.y + nt.y * c };
    return {
      d: `M ${from.x} ${from.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`,
      // A cubic at t = 0.5 is (P0 + 3·C1 + 3·C2 + P3) / 8.
      mid: {
        x: (from.x + 3 * c1.x + 3 * c2.x + end.x) / 8,
        y: (from.y + 3 * c1.y + 3 * c2.y + end.y) / 8,
      },
    };
  };

  /** Which side of a node a point is closest to — where the connector lands. */
  const sideForPoint = (nodeId: string, p: { x: number; y: number }): Side => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return "top";
    const { w, h } = sizeOf(nodeId);
    // Distance to each edge, normalised so tall and wide nodes behave alike.
    const d = {
      left: (p.x - node.x) / w,
      right: (node.x + w - p.x) / w,
      top: (p.y - node.y) / h,
      bottom: (node.y + h - p.y) / h,
    };
    return (Object.keys(d) as Side[]).reduce((best, s) => (d[s] < d[best] ? s : best), "top");
  };

  const removeConnection = (index: number) => {
    setConnections(connections.filter((_, i) => i !== index));
    setHoveredEdge(null);
    toast({ title: "Connection removed" });
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
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;
    // Where inside the node it was grabbed, in canvas units — so the node keeps
    // the same relationship to the cursor at any zoom or scroll position.
    const p = pointFrom(e);
    setDragOffset({ x: p.x - node.x, y: p.y - node.y });
    setDraggingNode(nodeId);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    // Dragging a connector out of a node: track the cursor for the live line.
    // Node dragging is handled by the window listener below, so that it keeps
    // working when the pointer leaves the canvas.
    if (connectingFrom) setLinkCursor(canvasPoint(e));
  };

  /**
   * Follow the pointer anywhere once a drag has started.
   *
   * The drag used to be tracked by handlers on the canvas element, so the
   * moment the cursor crossed onto a sidebar, the header, or outside the
   * window, the node stopped following — and `onMouseLeave` cancelled the drag
   * outright. Listening on the window instead means the node stays under the
   * cursor for the whole gesture, wherever it goes.
   */
  useEffect(() => {
    if (!draggingNode && !connectingFrom) return;

    const onMove = (e: MouseEvent) => {
      const p = pointFrom(e);
      if (connectingFrom) {
        setLinkCursor(p);
      } else if (draggingNode) {
        setNodes((current) =>
          current.map((n) =>
            n.id === draggingNode
              // Never negative: a node dragged off the top-left would sit
              // outside the surface and take its connectors with it.
              ? { ...n, x: Math.max(0, p.x - dragOffset.x), y: Math.max(0, p.y - dragOffset.y) }
              : n,
          ),
        );
      }

      // Dragging towards an edge scrolls the canvas, so a node can be taken
      // past whatever is currently on screen.
      const box = canvasRef.current;
      if (!box) return;
      const r = box.getBoundingClientRect();
      const EDGE = 60;   // how close to the edge before it starts moving
      const SPEED = 18;  // pixels per event, which reads as a steady glide
      if (e.clientX > r.right - EDGE) box.scrollLeft += SPEED;
      else if (e.clientX < r.left + EDGE) box.scrollLeft -= SPEED;
      if (e.clientY > r.bottom - EDGE) box.scrollTop += SPEED;
      else if (e.clientY < r.top + EDGE) box.scrollTop -= SPEED;
    };

    const onUp = () => {
      setDraggingNode(null);
      setConnectingFrom(null);
      setLinkCursor(null);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggingNode, connectingFrom, dragOffset, zoom]);

  /** Releasing over empty canvas abandons the connector being drawn. */
  const handleCanvasMouseUp = () => {
    setDraggingNode(null);
    if (connectingFrom) {
      setConnectingFrom(null);
      setLinkCursor(null);
    }
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
            icon: iconForType(node.type)
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

  // Real rendered size per node, measured after layout. Node widths vary with
  // their label, so fixed assumptions put anchors in the wrong place.
  const nodeRefs = useRef<Record<string, HTMLDivElement | null>>({});
  /** The scrolling canvas element. */
  const canvasRef = useRef<HTMLDivElement | null>(null);
  /** The zoomed, padded container the nodes are positioned inside. Cursor
      coordinates must be measured against this, not the scroll wrapper. */
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const [nodeSizes, setNodeSizes] = useState<Record<string, { w: number; h: number }>>({});

  useLayoutEffect(() => {
    const next: Record<string, { w: number; h: number }> = {};
    let changed = false;
    for (const node of nodes) {
      const el = nodeRefs.current[node.id];
      if (!el) continue;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      next[node.id] = { w, h };
      const prev = nodeSizes[node.id];
      if (!prev || prev.w !== w || prev.h !== h) changed = true;
    }
    if (changed) setNodeSizes(next);
  }, [nodes, zoom]);

  const sizeOf = (nodeId: string) => nodeSizes[nodeId] ?? { w: 140, h: 64 };

  /**
   * How much room the flow actually needs.
   *
   * Every node is absolutely positioned, so the surface has no intrinsic size:
   * left to itself it collapses to the height of the scroll window. The SVG
   * inside it inherited that, which meant any connector running past the fold
   * was clipped by the SVG's own viewport — the lines were being drawn, they
   * just had nowhere to appear. Both are given the real extent here.
   */
  const extent = useMemo(() => {
    let right = 0;
    let bottom = 0;
    for (const node of nodes) {
      const { w, h } = sizeOf(node.id);
      right = Math.max(right, node.x + w);
      bottom = Math.max(bottom, node.y + h);
    }
    // Room to drag a node past the last one without the canvas fighting back.
    return { width: right + 400, height: bottom + 320 };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, nodeSizes]);

  const getNodeCenter = (nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    const { w, h } = sizeOf(nodeId);
    return { x: node.x + w / 2, y: node.y + h / 2 };
  };

  /** Anchor on the node's edge, so connectors start and end at the boundary. */
  const getAnchor = (nodeId: string, side: "top" | "bottom" | "left" | "right") => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return { x: 0, y: 0 };
    const { w, h } = sizeOf(nodeId);
    switch (side) {
      case "bottom": return { x: node.x + w / 2, y: node.y + h };
      case "top":    return { x: node.x + w / 2, y: node.y };
      case "right":  return { x: node.x + w, y: node.y + h / 2 };
      default:       return { x: node.x, y: node.y + h / 2 };
    }
  };

  const clearConnections = () => {
    setConnections([]);
    setNodes([]);
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
        ref={canvasRef}
        className="flex-1 bg-canvas overflow-auto p-8 relative
                   [background-image:radial-gradient(hsl(var(--canvas-grid))_1px,transparent_1px)]
                   [background-size:22px_22px]"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onMouseMove={handleCanvasMouseMove}
        onMouseUp={handleCanvasMouseUp}
      >
        {/* Connector hint — bottom centre, clear of the toolbar. */}
        {connectingFrom && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-full text-sm z-50 flex items-center gap-3 shadow-lg">
            <span>Drop on a node to connect</span>
            <button
              onClick={() => {
                setConnectingFrom(null);
                setLinkCursor(null);
              }}
              className="underline underline-offset-2 opacity-90 hover:opacity-100"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Controls */}
        <div className="absolute top-4 left-4 flex flex-wrap gap-2 z-50 max-w-3xl">
          <Button 
            variant="outline" 
            size="sm"
            onClick={clearConnections}
          >
            Clear All
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
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setAbTestingOpen(true)}
          >
            <TestTube2 className="h-4 w-4 mr-1" />
            A/B Testing
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setWhatIfOpen(true)}
          >
            <Sparkles className="h-4 w-4 mr-1" />
            What-If
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
          ref={surfaceRef}
          className="relative transition-transform origin-top-left"
          style={{
            transform: `scale(${zoom})`,
            width: extent.width,
            height: extent.height,
            minWidth: "100%",
            minHeight: "100%",
          }}
        >
          {/* SVG for connections. Sized to the flow, not to the window, or the
              connectors below the fold are clipped away. */}
          <svg 
            className="absolute left-0 top-0 pointer-events-none overflow-visible"
            width={extent.width}
            height={extent.height}
            style={{ zIndex: connectingFrom ? 1 : 5 }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="9"
                markerHeight="7"
                refX="7"
                refY="3.5"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M 0 0 L 9 3.5 L 0 7 z" fill="hsl(var(--flow-line))" />
              </marker>
              <filter id="connection-glow">
                <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            {connections.map((conn, idx) => {
              const fromNode = nodes.find(n => n.id === conn.from);
              const toNode = nodes.find(n => n.id === conn.to);
              if (!fromNode || !toNode) return null;

              // Explicit sides (chosen when the connector was drawn) win; older
              // connections without them fall back to picking the facing sides.
              const fc = getNodeCenter(conn.from);
              const tc = getNodeCenter(conn.to);
              const horizontal = Math.abs(tc.x - fc.x) > Math.abs(tc.y - fc.y) * 1.5;
              const fromSide: Side =
                conn.fromSide ?? (horizontal ? (tc.x >= fc.x ? "right" : "left") : (tc.y >= fc.y ? "bottom" : "top"));
              const toSide: Side =
                conn.toSide ?? (horizontal ? (tc.x >= fc.x ? "left" : "right") : (tc.y >= fc.y ? "top" : "bottom"));

              const { d: path, mid } = connectorPath(
                getAnchor(conn.from, fromSide),
                fromSide,
                getAnchor(conn.to, toSide),
                toSide,
              );

              const isActiveConnection =
                activeSimulationNodes.includes(conn.from) && activeSimulationNodes.includes(conn.to);
              const hovered = hoveredEdge === idx;

              // A decision with two unlabelled arrows leaving it cannot be
              // read. Where a step asks a question, its outgoing branches are
              // labelled: the one that carries on down the flow is "No", the
              // one that leaves it is "Yes".
              const isDecision = (fromNode.label ?? "").includes("?");
              const branch = !isDecision ? null
                : fromSide === "bottom" ? "No" : "Yes";

              return (
                <g
                  key={idx}
                  className="pointer-events-auto"
                  onMouseEnter={() => setHoveredEdge(idx)}
                  onMouseLeave={() => setHoveredEdge((c) => (c === idx ? null : c))}
                >
                  {/* Invisible fat stroke so the thin curve is easy to hit. */}
                  <path d={path} fill="none" stroke="transparent" strokeWidth={18} />
                  {/* A halo in the canvas colour, so a curve that passes behind
                      a node or another line stays followable. */}
                  <path
                    d={path}
                    fill="none"
                    stroke="hsl(var(--canvas))"
                    strokeWidth={5}
                    strokeLinecap="round"
                    className="pointer-events-none"
                  />
                  <path
                    d={path}
                    fill="none"
                    stroke={
                      isActiveConnection
                        ? "hsl(var(--primary))"
                        : hovered
                        ? "hsl(var(--destructive))"
                        : "hsl(var(--flow-line))"
                    }
                    strokeWidth={isActiveConnection || hovered ? 3 : 2.25}
                    strokeLinecap="round"
                    markerEnd="url(#arrowhead)"
                    className={`${isActiveConnection ? "animate-pulse" : ""} pointer-events-none transition-[stroke]`}
                  />
                  {branch && !hovered && (
                    <g className="pointer-events-none">
                      <rect
                        x={mid.x - 15} y={mid.y - 9} width={30} height={18} rx={9}
                        fill="hsl(var(--canvas))"
                        stroke="hsl(var(--flow-line))"
                        strokeWidth={1}
                      />
                      <text
                        x={mid.x} y={mid.y + 4}
                        textAnchor="middle"
                        className="text-[10px] font-medium"
                        fill="hsl(var(--flow-line))"
                      >
                        {branch}
                      </text>
                    </g>
                  )}
                  {hovered && (
                    <g
                      onMouseDown={(e) => {
                        // Claim the press: the canvas below would otherwise
                        // treat it as the start of a drag.
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        removeConnection(idx);
                      }}
                      className="cursor-pointer"
                    >
                      {/* A generous invisible target around the small button. */}
                      <circle cx={mid.x} cy={mid.y} r={16} fill="transparent" />
                      <circle cx={mid.x} cy={mid.y} r={10}
                              fill="hsl(var(--destructive))"
                              stroke="hsl(var(--canvas))" strokeWidth={2} />
                      <path
                        d={`M ${mid.x - 3.5} ${mid.y - 3.5} L ${mid.x + 3.5} ${mid.y + 3.5} M ${mid.x + 3.5} ${mid.y - 3.5} L ${mid.x - 3.5} ${mid.y + 3.5}`}
                        stroke="white"
                        strokeWidth={2}
                        strokeLinecap="round"
                        className="pointer-events-none"
                      />
                      <title>Remove this connection</title>
                    </g>
                  )}
                </g>
              );
            })}

            {/* The connector currently being dragged. */}
            {connectingFrom && linkCursor && (() => {
              const from = getAnchor(connectingFrom, connectingSide);
              const n = sideNormal(connectingSide);
              return (
                <path
                  d={`M ${from.x} ${from.y} C ${from.x + n.x * 40} ${from.y + n.y * 40}, ${linkCursor.x} ${linkCursor.y}, ${linkCursor.x} ${linkCursor.y}`}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  className="pointer-events-none"
                />
              );
            })()}
            {connectingFrom && linkCursor && (
              <circle
                cx={linkCursor.x}
                cy={linkCursor.y}
                r={4}
                fill="hsl(var(--primary))"
                className="pointer-events-none"
              />
            )}
          </svg>

          {/* Nodes */}
          {nodes.map((node) => (
            <div 
              key={node.id} 
              ref={(el) => { nodeRefs.current[node.id] = el; }}
              className="absolute group"
              style={{ left: `${node.x}px`, top: `${node.y}px`, zIndex: 10 }}
              onMouseEnter={() => setHoveredNode(node.id)}
              onMouseLeave={() => setHoveredNode((c) => (c === node.id ? null : c))}
              onMouseUp={(e) => {
                // Landing a dragged connector on this node completes it, joining
                // at whichever side the pointer was nearest.
                if (connectingFrom && connectingFrom !== node.id) {
                  e.stopPropagation();
                  completeConnection(node, sideForPoint(node.id, canvasPoint(e)));
                  setLinkCursor(null);
                }
              }}
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
                  <div className={`w-12 h-12 rounded-full border-2 shadow-sm flex items-center justify-center ${
                    activeSimulationNodes.includes(node.id)
                      ? 'border-primary bg-primary/20'
                      : 'border-success bg-success/10'
                  }`}>
                    <Play className={`h-5 w-5 ${
                      activeSimulationNodes.includes(node.id) ? 'text-primary' : 'text-success'}`} />
                  </div>
                  <span className="text-xs font-medium text-foreground">Start</span>
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
                    className={`${
                      activeSimulationNodes.includes(node.id)
                        ? 'ring-2 ring-primary bg-primary/10 animate-pulse'
                        : ''
                    } ${
                      connectingFrom && connectingFrom !== node.id
                        ? 'ring-2 ring-primary/60 ring-offset-2 ring-offset-background'
                        : ''
                    }`}
                  />
                </div>
              )}

              {/* Connector handles — one per side, shown on hover. */}
              {node.id !== "start" && (hoveredNode === node.id || connectingFrom === node.id) && (
                <>
                  {(["top", "right", "bottom", "left"] as Side[]).map((side) => (
                    <button
                      key={side}
                      onMouseDown={(e) => startLink(node.id, side, e)}
                      title="Drag to connect"
                      className={`absolute h-5 w-5 rounded-full bg-primary text-primary-foreground shadow-md flex items-center justify-center hover:scale-125 transition-transform cursor-crosshair z-20 ${
                        side === "top"
                          ? "left-1/2 -translate-x-1/2 -top-2.5"
                          : side === "bottom"
                          ? "left-1/2 -translate-x-1/2 -bottom-2.5"
                          : side === "left"
                          ? "top-1/2 -translate-y-1/2 -left-2.5"
                          : "top-1/2 -translate-y-1/2 -right-2.5"
                      }`}
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  ))}
                </>
              )}
            </div>
          ))}

          {/* An empty canvas says so; once there are nodes, nothing overlays them. */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-muted-foreground text-sm">
                Drag components from the left sidebar to build your workflow
              </p>
            </div>
          )}
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

      {/* A/B Testing Panel */}
      <ABTestingPanel 
        open={abTestingOpen}
        onClose={() => setAbTestingOpen(false)}
        nodes={nodes}
      />

      {/* What-If Analysis Panel */}
      <WhatIfAnalysisPanel 
        open={whatIfOpen}
        onClose={() => setWhatIfOpen(false)}
      />
    </>
  );
};
