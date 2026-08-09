import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sparkles, TrendingUp, DollarSign, Target, AlertCircle, Lightbulb } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WhatIfAnalysisPanelProps {
  open: boolean;
  onClose: () => void;
  strategyId?: string;
}

export const WhatIfAnalysisPanel = ({ open, onClose, strategyId }: WhatIfAnalysisPanelProps) => {
  const { toast } = useToast();
  const [scenarioName, setScenarioName] = useState("");
  const [contactFrequency, setContactFrequency] = useState([5]);
  const [highRiskDays, setHighRiskDays] = useState("30");
  const [mediumRiskDays, setMediumRiskDays] = useState("60");
  const [lowRiskDays, setLowRiskDays] = useState("90");
  const [emailMix, setEmailMix] = useState("25");
  const [smsMix, setSmsMix] = useState("30");
  const [phoneMix, setPhoneMix] = useState("25");
  const [whatsappMix, setWhatsappMix] = useState("15");
  const [otherMix, setOtherMix] = useState("5");
  const [simulationRun, setSimulationRun] = useState(false);

  const totalMix = parseInt(emailMix || "0") + parseInt(smsMix || "0") + 
                   parseInt(phoneMix || "0") + parseInt(whatsappMix || "0") + 
                   parseInt(otherMix || "0");

  const handleRunSimulation = () => {
    if (totalMix !== 100) {
      toast({
        title: "Invalid Mix",
        description: "Communication mix must total 100%",
        variant: "destructive",
      });
      return;
    }

    setSimulationRun(true);
    toast({
      title: "Simulation Running",
      description: "Analyzing scenario parameters...",
    });

    // Simulate processing
    setTimeout(() => {
      toast({
        title: "Analysis Complete",
        description: "Predicted outcomes are ready",
      });
    }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            What-If Analysis
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Left Panel - Scenario Parameters */}
          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Scenario Parameters</h3>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="scenario-name">Scenario Name</Label>
                  <Input 
                    id="scenario-name" 
                    placeholder="e.g., Aggressive Recovery Strategy"
                    value={scenarioName}
                    onChange={(e) => setScenarioName(e.target.value)}
                  />
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <Label>Contact Frequency</Label>
                    <span className="text-sm font-medium text-primary">
                      Every {contactFrequency[0]} days
                    </span>
                  </div>
                  <Slider 
                    value={contactFrequency}
                    onValueChange={setContactFrequency}
                    min={1}
                    max={10}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>1 day</span>
                    <span>10 days</span>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Risk Segment Thresholds</h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="high-risk" className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-risk-high" />
                    High Risk Days Past Due
                  </Label>
                  <Input 
                    id="high-risk" 
                    type="number" 
                    value={highRiskDays}
                    onChange={(e) => setHighRiskDays(e.target.value)}
                    placeholder="30"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="medium-risk" className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-risk-medium" />
                    Medium Risk Days Past Due
                  </Label>
                  <Input 
                    id="medium-risk" 
                    type="number" 
                    value={mediumRiskDays}
                    onChange={(e) => setMediumRiskDays(e.target.value)}
                    placeholder="60"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="low-risk" className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-risk-low" />
                    Low Risk Days Past Due
                  </Label>
                  <Input 
                    id="low-risk" 
                    type="number" 
                    value={lowRiskDays}
                    onChange={(e) => setLowRiskDays(e.target.value)}
                    placeholder="90"
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Communication Mix</h3>
                <span className={`text-sm font-medium ${totalMix === 100 ? 'text-success' : 'text-destructive'}`}>
                  {totalMix}%
                </span>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="email-mix">Email</Label>
                    <span className="text-sm text-muted-foreground">{emailMix}%</span>
                  </div>
                  <Input 
                    id="email-mix" 
                    type="number" 
                    min="0" 
                    max="100"
                    value={emailMix}
                    onChange={(e) => setEmailMix(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="sms-mix">SMS</Label>
                    <span className="text-sm text-muted-foreground">{smsMix}%</span>
                  </div>
                  <Input 
                    id="sms-mix" 
                    type="number" 
                    min="0" 
                    max="100"
                    value={smsMix}
                    onChange={(e) => setSmsMix(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="phone-mix">Phone</Label>
                    <span className="text-sm text-muted-foreground">{phoneMix}%</span>
                  </div>
                  <Input 
                    id="phone-mix" 
                    type="number" 
                    min="0" 
                    max="100"
                    value={phoneMix}
                    onChange={(e) => setPhoneMix(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="whatsapp-mix">WhatsApp</Label>
                    <span className="text-sm text-muted-foreground">{whatsappMix}%</span>
                  </div>
                  <Input 
                    id="whatsapp-mix" 
                    type="number" 
                    min="0" 
                    max="100"
                    value={whatsappMix}
                    onChange={(e) => setWhatsappMix(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label htmlFor="other-mix">Other</Label>
                    <span className="text-sm text-muted-foreground">{otherMix}%</span>
                  </div>
                  <Input 
                    id="other-mix" 
                    type="number" 
                    min="0" 
                    max="100"
                    value={otherMix}
                    onChange={(e) => setOtherMix(e.target.value)}
                  />
                </div>
              </div>
            </Card>

            <Button 
              onClick={handleRunSimulation} 
              className="w-full" 
              size="lg"
              disabled={totalMix !== 100}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Run Simulation
            </Button>
          </div>

          {/* Right Panel - Predicted Outcomes */}
          <div className="space-y-6">
            {!simulationRun ? (
              <Card className="p-12 flex flex-col items-center justify-center text-center min-h-[600px]">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Sparkles className="h-10 w-10 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Ready to Predict</h3>
                <p className="text-muted-foreground max-w-sm">
                  Configure your scenario parameters on the left and click "Run Simulation" to see predicted outcomes
                </p>
              </Card>
            ) : (
              <>
                <Card className="p-6">
                  <h3 className="text-lg font-semibold mb-4">Predicted Outcomes</h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    Based on historical data and scenario parameters
                  </p>

                  <div className="space-y-4">
                    <Card className="p-4 bg-primary/5 border-primary/20">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Target className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-muted-foreground mb-1">Expected Response Rate</p>
                          <p className="text-3xl font-bold text-primary">34.5%</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            ↑ 4.5% vs current baseline
                          </p>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-4 bg-success/5 border-success/20">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                          <DollarSign className="h-5 w-5 text-success" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-muted-foreground mb-1">Expected Recovery Amount</p>
                          <p className="text-3xl font-bold text-success">$156K</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            ↑ $12K vs current baseline
                          </p>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-4 bg-info/5 border-info/20">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-lg bg-info/10 flex items-center justify-center shrink-0">
                          <TrendingUp className="h-5 w-5 text-info" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-muted-foreground mb-1">Cost Efficiency Impact</p>
                          <p className="text-3xl font-bold text-info">-18%</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            $7.20 per response (was $8.80)
                          </p>
                        </div>
                      </div>
                    </Card>

                    <Card className="p-4 bg-warning/5 border-warning/20">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                          <AlertCircle className="h-5 w-5 text-warning" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-muted-foreground mb-1">Bad-Debt Reduction</p>
                          <p className="text-3xl font-bold text-warning">-22%</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Projected reduction in charge-offs
                          </p>
                        </div>
                      </div>
                    </Card>
                  </div>
                </Card>

                <Card className="p-6 bg-accent/5 border-accent/20">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                      <Lightbulb className="h-4 w-4 text-accent" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Recommended Strategy Tweaks</h3>
                      <p className="text-sm text-muted-foreground">
                        AI-powered optimization suggestions
                      </p>
                    </div>
                  </div>

                  <ul className="space-y-3 text-sm">
                    <li className="flex gap-2">
                      <span className="text-accent font-medium">1.</span>
                      <span>Increase SMS frequency for high-risk segments to maximize early engagement</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-accent font-medium">2.</span>
                      <span>Add WhatsApp follow-up after failed phone attempts for 15% better response</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-accent font-medium">3.</span>
                      <span>Reduce email volume in low-risk segments to optimize cost efficiency</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-accent font-medium">4.</span>
                      <span>Consider AI voicebot earlier in the flow for medium-risk accounts</span>
                    </li>
                  </ul>
                </Card>

                <div className="flex gap-3">
                  <Button onClick={onClose} variant="outline" className="flex-1">
                    Discard
                  </Button>
                  <Button className="flex-1">
                    Apply to Strategy
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
