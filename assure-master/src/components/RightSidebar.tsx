import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, X, ArrowUpRight, FileQuestion } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MetricsCharts } from "./MetricsCharts";

interface RightSidebarProps {
  onDisputeClassifier?: () => void;
}

export const RightSidebar = ({ 
  onDisputeClassifier 
}: RightSidebarProps) => {
  return (
    <aside className="w-80 bg-sidebar border-l border-sidebar-border overflow-y-auto">
      <Tabs defaultValue="config" className="w-full">
        <TabsList className="w-full grid grid-cols-2 bg-background/50">
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>
        
        <TabsContent value="config" className="p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-sm font-semibold text-foreground">AI Dialer</h3>
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* Dialer Type */}
          <div className="mb-4">
            <label className="text-xs text-muted-foreground mb-2 block">Dialer Type</label>
            <div className="flex gap-2">
              <Badge className="bg-primary text-primary-foreground">Predictive</Badge>
              <Badge variant="outline">Power</Badge>
              <Badge variant="outline">Preview</Badge>
            </div>
          </div>

          {/* Contact Times */}
          <div className="mb-4">
            <label className="text-xs text-muted-foreground mb-2 block">Contact times</label>
            <div className="text-sm text-foreground">9 AM-6 PM</div>
          </div>

          {/* Languages */}
          <div className="mb-4">
            <label className="text-xs text-muted-foreground mb-2 block">Languages</label>
            <div className="text-sm text-foreground">Arabic | English</div>
          </div>

          {/* Retry Attempts */}
          <div className="mb-4">
            <label className="text-xs text-muted-foreground mb-2 block">Retry Attempts</label>
            <div className="flex items-center justify-between bg-component-tile border border-node-border rounded-md px-3 py-2">
              <span className="text-sm text-foreground">3</span>
              <div className="flex flex-col">
                <ChevronUp className="h-3 w-3 text-muted-foreground cursor-pointer" />
                <ChevronDown className="h-3 w-3 text-muted-foreground cursor-pointer" />
              </div>
            </div>
          </div>

          {/* Send SMS */}
          <div className="mb-4">
            <div className="flex items-center justify-between bg-component-tile border border-node-border rounded-md px-3 py-2">
              <span className="text-sm text-foreground">Send SMS</span>
              <X className="h-4 w-4 text-muted-foreground cursor-pointer" />
            </div>
          </div>

          {/* If voicemail */}
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">If voicemail</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground">Hand over to VA</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* PTP role */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">PTP role</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-foreground">Update PTP</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </div>

          {/* Risk Warnings */}
          <div className="mb-6">
            <h4 className="text-xs font-medium text-muted-foreground mb-3">Risk Warnings</h4>
            <ul className="space-y-2 mb-4">
              <li className="flex items-center justify-between text-xs">
                <span className="text-foreground">VA failure risk</span>
                <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30">moderate</Badge>
              </li>
              <li className="flex items-center justify-between text-xs">
                <span className="text-foreground">SME contactability</span>
                <Badge variant="outline" className="bg-success/20 text-success border-success/30">low</Badge>
              </li>
              <li className="flex items-center justify-between text-xs">
                <span className="text-foreground">Payment link fatigue</span>
                <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30">medium</Badge>
              </li>
            </ul>

            {/* AI Dispute Classifier Button */}
            <div className="pt-3 border-t border-border">
              <Button 
                onClick={onDisputeClassifier}
                variant="outline"
                size="sm"
                className="w-full justify-start text-xs hover:bg-info/10 hover:text-info hover:border-info/30 transition-all"
              >
                <FileQuestion className="h-3.5 w-3.5 mr-2" />
                AI Dispute Classifier
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 text-sm">
              Apply to Segment
              <ArrowUpRight className="h-3 w-3 ml-1" />
            </Button>
            <Button className="flex-1 text-sm">
              Preview Impact
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="p-0">
          <MetricsCharts />
        </TabsContent>
      </Tabs>
    </aside>
  );
};
