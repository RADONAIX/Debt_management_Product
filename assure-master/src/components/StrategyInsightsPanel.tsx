import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, TrendingUp, Users, Phone, Mail, MessageSquare, Target } from "lucide-react";

export const StrategyInsightsPanel = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className={`border-t border-border bg-card transition-all duration-300 ${isExpanded ? 'h-64' : 'h-12'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-semibold text-foreground">Strategy Insights</h3>
          <Badge variant="outline" className="text-xs">Real-time Simulation</Badge>
        </div>
        
        <Button variant="ghost" size="sm">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>
      </div>

      {/* Content */}
      {isExpanded && (
        <div className="px-6 pb-4 overflow-y-auto h-[calc(100%-48px)]">
          <div className="grid grid-cols-5 gap-4">
            {/* Customer Count by Stage */}
            <Card className="p-4 bg-background border-border">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Total Customers</span>
              </div>
              <div className="text-2xl font-bold text-foreground">11,220</div>
              <div className="text-xs text-success mt-1">+8% from baseline</div>
            </Card>

            {/* Conversion Funnel */}
            <Card className="p-4 bg-background border-border">
              <div className="flex items-center gap-2 mb-2">
                <Target className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Conversion Rate</span>
              </div>
              <div className="text-2xl font-bold text-foreground">42%</div>
              <div className="text-xs text-success mt-1">+12% uplift</div>
            </Card>

            {/* Payment Uplift */}
            <Card className="p-4 bg-background border-border">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">AI Uplift</span>
              </div>
              <div className="text-2xl font-bold text-success">+14.2%</div>
              <div className="text-xs text-muted-foreground mt-1">vs traditional</div>
            </Card>

            {/* Contactability Score */}
            <Card className="p-4 bg-background border-border">
              <div className="flex items-center gap-2 mb-2">
                <Phone className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">Contactability</span>
              </div>
              <div className="text-2xl font-bold text-foreground">67%</div>
              <div className="text-xs text-success mt-1">+15% improvement</div>
            </Card>

            {/* AI Confidence */}
            <Card className="p-4 bg-background border-border">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">AI Confidence</span>
              </div>
              <div className="text-2xl font-bold text-info">87%</div>
              <div className="text-xs text-muted-foreground mt-1">High accuracy</div>
            </Card>
          </div>

          {/* Channel Performance */}
          <div className="mt-4 grid grid-cols-4 gap-3">
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-3 w-3 text-primary" />
                <span className="text-xs text-foreground">SMS Reached</span>
              </div>
              <span className="text-sm font-semibold text-foreground">8,456</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Mail className="h-3 w-3 text-primary" />
                <span className="text-xs text-foreground">Email Delivered</span>
              </div>
              <span className="text-sm font-semibold text-foreground">6,789</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Phone className="h-3 w-3 text-primary" />
                <span className="text-xs text-foreground">Dialer Connected</span>
              </div>
              <span className="text-sm font-semibold text-foreground">4,523</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <Users className="h-3 w-3 text-primary" />
                <span className="text-xs text-foreground">VA Conversations</span>
              </div>
              <span className="text-sm font-semibold text-foreground">3,112</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
