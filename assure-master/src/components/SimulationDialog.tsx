import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { Play, Pause, RotateCcw, CheckCircle2 } from "lucide-react";

interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
}

interface Connection {
  from: string;
  to: string;
}

interface SimulationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodes: WorkflowNode[];
  connections: Connection[];
  onActiveNodes: (nodeIds: string[]) => void;
}

export const SimulationDialog = ({ 
  open, 
  onOpenChange, 
  nodes, 
  connections,
  onActiveNodes 
}: SimulationDialogProps) => {
  const [isRunning, setIsRunning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [executionPath, setExecutionPath] = useState<string[]>([]);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    if (!open) {
      resetSimulation();
    }
  }, [open]);

  const buildExecutionPath = () => {
    const path: string[] = [];
    const visited = new Set<string>();
    
    const traverse = (nodeId: string) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);
      path.push(nodeId);
      
      const nextConnections = connections.filter(c => c.from === nodeId);
      nextConnections.forEach(conn => traverse(conn.to));
    };
    
    const startNode = nodes.find(n => n.type === "start");
    if (startNode) {
      traverse(startNode.id);
    }
    
    return path;
  };

  const startSimulation = () => {
    const path = buildExecutionPath();
    setExecutionPath(path);
    setCurrentStep(0);
    setLogs([`Simulation started with ${path.length} nodes`]);
    setIsRunning(true);
    executeStep(0, path);
  };

  const executeStep = (step: number, path: string[]) => {
    if (step >= path.length) {
      setIsRunning(false);
      setLogs(prev => [...prev, "Simulation completed successfully ✓"]);
      onActiveNodes([]);
      return;
    }

    const node = nodes.find(n => n.id === path[step]);
    if (node) {
      onActiveNodes([node.id]);
      setLogs(prev => [...prev, `Executing: ${node.label} (${node.type})`]);
      
      setTimeout(() => {
        setCurrentStep(step + 1);
        executeStep(step + 1, path);
      }, 1500);
    }
  };

  const pauseSimulation = () => {
    setIsRunning(false);
    setLogs(prev => [...prev, "Simulation paused"]);
  };

  const resetSimulation = () => {
    setIsRunning(false);
    setCurrentStep(0);
    setExecutionPath([]);
    setLogs([]);
    onActiveNodes([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Workflow Simulation</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Controls */}
          <div className="flex gap-2">
            {!isRunning ? (
              <Button onClick={startSimulation} disabled={isRunning}>
                <Play className="h-4 w-4 mr-2" />
                Start
              </Button>
            ) : (
              <Button onClick={pauseSimulation} variant="secondary">
                <Pause className="h-4 w-4 mr-2" />
                Pause
              </Button>
            )}
            <Button onClick={resetSimulation} variant="outline">
              <RotateCcw className="h-4 w-4 mr-2" />
              Reset
            </Button>
          </div>

          {/* Progress */}
          {executionPath.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress</span>
                <span className="text-foreground font-medium">
                  {currentStep} / {executionPath.length}
                </span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(currentStep / executionPath.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Execution Log */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Execution Log</h4>
            <div className="bg-background border border-border rounded-md p-3 h-48 overflow-y-auto">
              {logs.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Click Start to begin simulation...
                </p>
              ) : (
                <div className="space-y-1">
                  {logs.map((log, idx) => (
                    <div key={idx} className="text-xs text-foreground flex items-start gap-2">
                      <CheckCircle2 className="h-3 w-3 mt-0.5 text-primary flex-shrink-0" />
                      <span>{log}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
