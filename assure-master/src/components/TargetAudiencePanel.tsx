import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { Users, Target, TrendingUp } from "lucide-react";

interface TargetAudience {
  segment: string;
  agingBucket: string;
  riskScoreMin: number;
  riskScoreMax: number;
  customerCount: number;
  filters: {
    contactability?: string;
    revenueSegment?: string;
    creditClass?: string;
  };
}

interface TargetAudiencePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (audience: TargetAudience) => void;
}

export const TargetAudiencePanel = ({ open, onOpenChange, onConfirm }: TargetAudiencePanelProps) => {
  const [segment, setSegment] = useState("Enterprise");
  const [agingBucket, setAgingBucket] = useState("61-90");
  const [riskScore, setRiskScore] = useState([14, 44]);
  const [contactability, setContactability] = useState("");
  const [revenueSegment, setRevenueSegment] = useState("");
  const [creditClass, setCreditClass] = useState("");

  const customerCount = 11220; // This would be fetched from API in real implementation

  const handleConfirm = () => {
    onConfirm({
      segment,
      agingBucket,
      riskScoreMin: riskScore[0],
      riskScoreMax: riskScore[1],
      customerCount,
      filters: {
        contactability: contactability || undefined,
        revenueSegment: revenueSegment || undefined,
        creditClass: creditClass || undefined,
      }
    });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[500px] bg-card border-border">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <Target className="h-5 w-5 text-primary" />
            Target Audience Selection
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)] pr-4 mt-6">
          <div className="space-y-6">
            {/* Segment Selection */}
            <div className="space-y-2">
              <Label className="text-foreground">Segment</Label>
              <Select value={segment} onValueChange={setSegment}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Enterprise">Enterprise</SelectItem>
                  <SelectItem value="SMB">SMB</SelectItem>
                  <SelectItem value="Consumer">Consumer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Aging Buckets */}
            <div className="space-y-2">
              <Label className="text-foreground">Aging Bucket (Days)</Label>
              <Select value={agingBucket} onValueChange={setAgingBucket}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-30">1-30 Days</SelectItem>
                  <SelectItem value="31-60">31-60 Days</SelectItem>
                  <SelectItem value="61-90">61-90 Days</SelectItem>
                  <SelectItem value="91-120">91-120 Days</SelectItem>
                  <SelectItem value="120+">120+ Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Risk Score Range */}
            <div className="space-y-3">
              <Label className="text-foreground">Risk Score Range</Label>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-muted-foreground w-12">{riskScore[0]}</span>
                <Slider
                  value={riskScore}
                  onValueChange={setRiskScore}
                  min={0}
                  max={100}
                  step={1}
                  className="flex-1"
                />
                <span className="text-sm font-medium text-muted-foreground w-12">{riskScore[1]}</span>
              </div>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="text-xs">Min: {riskScore[0]}</Badge>
                <Badge variant="outline" className="text-xs">Max: {riskScore[1]}</Badge>
              </div>
            </div>

            {/* Customer Count Display */}
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-primary" />
                <Label className="text-sm font-medium text-foreground">Estimated Customer Count</Label>
              </div>
              <div className="text-3xl font-bold text-primary">{customerCount.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground mt-1">customers match this criteria</p>
            </div>

            {/* Advanced Filters */}
            <div className="space-y-4 pt-4 border-t border-border">
              <Label className="text-foreground font-semibold">Advanced Filters</Label>
              
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Contactability Score</Label>
                <Select value={contactability} onValueChange={setContactability}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Select range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High (&gt;70%)</SelectItem>
                    <SelectItem value="medium">Medium (40-70%)</SelectItem>
                    <SelectItem value="low">Low (&lt;40%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Revenue Segment</Label>
                <Select value={revenueSegment} onValueChange={setRevenueSegment}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Select segment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="premium">Premium (&gt;$1M)</SelectItem>
                    <SelectItem value="standard">Standard ($100K-$1M)</SelectItem>
                    <SelectItem value="basic">Basic (&lt;$100K)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Credit Class</Label>
                <Select value={creditClass} onValueChange={setCreditClass}>
                  <SelectTrigger className="bg-background border-border">
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a">Class A (Excellent)</SelectItem>
                    <SelectItem value="b">Class B (Good)</SelectItem>
                    <SelectItem value="c">Class C (Fair)</SelectItem>
                    <SelectItem value="d">Class D (Poor)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="flex gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleConfirm} className="flex-1">
            <TrendingUp className="h-4 w-4 mr-2" />
            Confirm Audience
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
