import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useEffect } from "react";
import { Sparkles, TrendingUp, Radio, Clock, FileQuestion } from "lucide-react";

interface NodeConfig {
  id: string;
  type: string;
  label: string;
  timing?: string;
  message?: string;
  condition?: string;
  // Channel specific
  template?: string;
  senderId?: string;
  dialerType?: string;
  contactTimeRange?: string;
  languages?: string[];
  retryAttempts?: number;
  voicemailLogic?: string;
  nLPModel?: string;
  // Action specific
  amount?: string;
  dueDate?: string;
  autoValidate?: boolean;
  installmentCount?: number;
  autoCalculateML?: boolean;
  paymentGateway?: string;
  expiryHours?: number;
  // Condition specific
  timeout?: string;
  channelFallback?: string;
  gracePeriod?: string;
  escalationRule?: string;
  riskBand?: string;
  // AI specific
  inputSignals?: string[];
  confidenceScore?: number;
  explainability?: string;
  rankedChannels?: { channel: string; probability: number }[];
  timeWindow?: string;
  detectedIntent?: string;
  ptpProbability?: number;
}

interface EnhancedNodeConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  node: NodeConfig | null;
  onSave: (config: NodeConfig) => void;
}

const channelTypes = [
  "SMS",
  "Email",
  "WhatsApp",
  "IVR",
  "AI Dialer",
  "VA",
  "Push Notification",
];
const actionTypes = [
  "Create PTP",
  "Send Payment Link",
  "Generate Settlement",
  "Create Case",
  "Credit Validation",
  "Legal Pre-Notice",
];
const conditionTypes = [
  "No Response?",
  "PTP Broken?",
  "If Dispute Detected",
  "If High-Risk Customer",
  "If Payment Posted",
  "If >90 Bucket",
];
const aiTypes = [
  "AI Next-Best-Action",
  "AI Recommend Channel",
  "AI Recommend Time-of-Day",
  "AI Dispute Classifier",
  "AI Risk Score",
  "AI PTP Probability",
];

export const EnhancedNodeConfigDialog = ({
  open,
  onOpenChange,
  node,
  onSave,
}: EnhancedNodeConfigDialogProps) => {
  const [config, setConfig] = useState<NodeConfig | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (node) {
      setConfig({ ...node });
    }
  }, [node]);

  const handleSave = () => {
    if (config) {
      onSave(config);
      onOpenChange(false);
    }
  };

  if (!config) return null;

  const isChannel = channelTypes.includes(config.type);
  const isAction = actionTypes.includes(config.type);
  const isCondition = conditionTypes.includes(config.type);
  const isAI = aiTypes.includes(config.type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            {isAI && <Sparkles className="h-5 w-5 text-primary" />}
            Configure {config.label}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="label">Node Label</Label>
              <Input
                id="label"
                value={config.label}
                onChange={(e) =>
                  setConfig({ ...config, label: e.target.value })
                }
                className="bg-background border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dpd">DPD</Label>
              <Input
                id="dpd"
                value={config.timing ?? ""}
                onChange={(e) =>
                  setConfig({ ...config, timing: e.target.value })
                }
                className="bg-background border-border"
              />
            </div>

            {/* CHANNEL NODE CONFIGURATION */}
            {isChannel && (
              <Tabs defaultValue="basic" className="w-full">
                <TabsList>
                  <TabsTrigger value="basic">Basic</TabsTrigger>
                  <TabsTrigger value="advanced">Advanced</TabsTrigger>
                </TabsList>

                <TabsContent value="basic" className="space-y-4">
                  {(config.type === "SMS" ||
                    config.type === "Email" ||
                    config.type === "WhatsApp") && (
                    <>
                      <div className="space-y-2">
                        <Label>Template</Label>
                        <Select
                          value={config.template || "default"}
                          onValueChange={(value) =>
                            setConfig({ ...config, template: value })
                          }
                        >
                          <SelectTrigger className="bg-background border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="default">
                              Default Reminder
                            </SelectItem>
                            <SelectItem value="payment_due">
                              Payment Due Notice
                            </SelectItem>
                            <SelectItem value="final_notice">
                              Final Notice
                            </SelectItem>
                            <SelectItem value="settlement_offer">
                              Settlement Offer
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* <div className="space-y-2">
                        <Label>Message</Label>
                        <Textarea
                          value={config.message || ""}
                          onChange={(e) => setConfig({ ...config, message: e.target.value })}
                          placeholder="Enter your message template with variables: {customer_name}, {amount}, {due_date}"
                          className="bg-background border-border min-h-[100px]"
                        />
                      </div> */}

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Message</Label>

                          {/* <Button
                            variant="default"
                            onClick={() =>
                              setConfig({ ...config, message: "Hi {customer_name}, this is a reminder that your payment of ₹{amount} is due on {due_date}. Please pay at your earliest convenience to avoid service interruption. Thank you." })
                            }
                            className="text-xs"
                          >
                            LLM Recommendation
                          </Button> */}

                          <Button
                            variant="default"
                            disabled={loading}
                            onClick={() => {
                              setLoading(true);
                              setTimeout(() => {
                                setConfig((prev) => ({
                                  ...prev,
                                  message:
                                    "Hi {customer_name}, this is a reminder that your payment of ₹{amount} is due on {due_date}. Please pay soon to avoid service interruption. Thank you.",
                                }));
                                setLoading(false);
                              }, 1500); // 1.5 seconds loading effect
                            }}
                            className="text-xs"
                          >
                            {loading ? "Generating..." : "LLM Recommendation"}
                          </Button>
                        </div>
                        <Textarea
                          value={config.message || ""}
                          onChange={(e) =>
                            setConfig({ ...config, message: e.target.value })
                          }
                          placeholder="Enter your message template with variables: {customer_name}, {amount}, {due_date}"
                          className="bg-background border-border min-h-[100px]"
                        />
                      </div>

                      {config.type === "SMS" && (
                        <div className="space-y-2">
                          <Label>Sender ID</Label>
                          <Input
                            value={config.senderId || ""}
                            onChange={(e) =>
                              setConfig({ ...config, senderId: e.target.value })
                            }
                            placeholder="e.g., COMPANY"
                            className="bg-background border-border"
                          />
                        </div>
                      )}
                    </>
                  )}

                  {config.type === "AI Dialer" && (
                    <>
                      <div className="space-y-2">
                        <Label>Dialer Type</Label>
                        <Select
                          value={config.dialerType || "predictive"}
                          onValueChange={(value) =>
                            setConfig({ ...config, dialerType: value })
                          }
                        >
                          <SelectTrigger className="bg-background border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="predictive">
                              Predictive Dialer
                            </SelectItem>
                            <SelectItem value="power">Power Dialer</SelectItem>
                            <SelectItem value="preview">
                              Preview Dialer
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Contact Time Range</Label>
                        <Input
                          value={config.contactTimeRange || "9:00 AM - 6:00 PM"}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              contactTimeRange: e.target.value,
                            })
                          }
                          className="bg-background border-border"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Languages</Label>
                        <div className="flex gap-2">
                          <Badge variant="secondary">Arabic</Badge>
                          <Badge variant="secondary">English</Badge>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Retry Attempts</Label>
                        <Input
                          type="number"
                          value={config.retryAttempts || 3}
                          onChange={(e) =>
                            setConfig({
                              ...config,
                              retryAttempts: parseInt(e.target.value),
                            })
                          }
                          className="bg-background border-border"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label>Voicemail Logic</Label>
                        <Select
                          value={config.voicemailLogic || "send_sms"}
                          onValueChange={(value) =>
                            setConfig({ ...config, voicemailLogic: value })
                          }
                        >
                          <SelectTrigger className="bg-background border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="send_sms">Send SMS</SelectItem>
                            <SelectItem value="handover_va">
                              Handover to VA
                            </SelectItem>
                            <SelectItem value="leave_message">
                              Leave Voicemail
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {config.type === "VA" && (
                    <>
                      <div className="space-y-2">
                        <Label>Language</Label>
                        <Select
                          value={config.languages?.[0] || "en"}
                          onValueChange={(value) =>
                            setConfig({ ...config, languages: [value] })
                          }
                        >
                          <SelectTrigger className="bg-background border-border">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="en">English</SelectItem>
                            <SelectItem value="ar">Arabic</SelectItem>
                            <SelectItem value="both">Both</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>NLP Model Version</Label>
                        <Input
                          value={config.nLPModel || "v2.5"}
                          onChange={(e) =>
                            setConfig({ ...config, nLPModel: e.target.value })
                          }
                          className="bg-background border-border"
                        />
                      </div>
                    </>
                  )}
                </TabsContent>

                <TabsContent value="advanced" className="space-y-4">
                  <div className="space-y-2">
                    <Label>Timing</Label>
                    <Select
                      value={config.timing || "immediate"}
                      onValueChange={(value) =>
                        setConfig({ ...config, timing: value })
                      }
                    >
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediate">Immediate</SelectItem>
                        <SelectItem value="1hour">After 1 Hour</SelectItem>
                        <SelectItem value="6hours">After 6 Hours</SelectItem>
                        <SelectItem value="1day">After 1 Day</SelectItem>
                        <SelectItem value="3days">After 3 Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Execution Condition</Label>
                    <Select
                      value={config.condition || "always"}
                      onValueChange={(value) =>
                        setConfig({ ...config, condition: value })
                      }
                    >
                      <SelectTrigger className="bg-background border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="always">Always Execute</SelectItem>
                        <SelectItem value="no_response">
                          If No Response
                        </SelectItem>
                        <SelectItem value="payment_pending">
                          If Payment Pending
                        </SelectItem>
                        <SelectItem value="high_risk">
                          If High Risk Score
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </TabsContent>
              </Tabs>
            )}

            {/* ACTION NODE CONFIGURATION */}
            {isAction && (
              <div className="space-y-4">
                {config.type === "Create PTP" && (
                  <>
                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input
                        value={config.amount || ""}
                        onChange={(e) =>
                          setConfig({ ...config, amount: e.target.value })
                        }
                        placeholder="Auto pre-filled by ML"
                        className="bg-background border-border"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Due Date</Label>
                      <Input
                        type="date"
                        value={config.dueDate || ""}
                        onChange={(e) =>
                          setConfig({ ...config, dueDate: e.target.value })
                        }
                        className="bg-background border-border"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Auto-validate Enabled</Label>
                      <Switch
                        checked={config.autoValidate || false}
                        onCheckedChange={(checked) =>
                          setConfig({ ...config, autoValidate: checked })
                        }
                      />
                    </div>
                  </>
                )}

                {config.type === "Generate Settlement" && (
                  <>
                    <div className="space-y-2">
                      <Label>Installment Count</Label>
                      <Input
                        type="number"
                        value={config.installmentCount || 3}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            installmentCount: parseInt(e.target.value),
                          })
                        }
                        className="bg-background border-border"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <Label>Auto-calculate using ML</Label>
                      <Switch
                        checked={config.autoCalculateML || false}
                        onCheckedChange={(checked) =>
                          setConfig({ ...config, autoCalculateML: checked })
                        }
                      />
                    </div>
                  </>
                )}

                {config.type === "Send Payment Link" && (
                  <>
                    <div className="space-y-2">
                      <Label>Payment Gateway</Label>
                      <Select
                        value={config.paymentGateway || "stripe"}
                        onValueChange={(value) =>
                          setConfig({ ...config, paymentGateway: value })
                        }
                      >
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="stripe">Stripe</SelectItem>
                          <SelectItem value="paypal">PayPal</SelectItem>
                          <SelectItem value="local_bank">Local Bank</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Link Expiry (hours)</Label>
                      <Input
                        type="number"
                        value={config.expiryHours || 48}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            expiryHours: parseInt(e.target.value),
                          })
                        }
                        className="bg-background border-border"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* CONDITION NODE CONFIGURATION */}
            {isCondition && (
              <div className="space-y-4">
                {config.type === "No Response?" && (
                  <>
                    <div className="space-y-2">
                      <Label>Timeout</Label>
                      <Select
                        value={config.timeout || "2days"}
                        onValueChange={(value) =>
                          setConfig({ ...config, timeout: value })
                        }
                      >
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="6hours">6 Hours</SelectItem>
                          <SelectItem value="1day">1 Day</SelectItem>
                          <SelectItem value="2days">2 Days</SelectItem>
                          <SelectItem value="3days">3 Days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Channel Fallback Priority</Label>
                      <Textarea
                        value={
                          config.channelFallback ||
                          "SMS → WhatsApp → AI Dialer → Email"
                        }
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            channelFallback: e.target.value,
                          })
                        }
                        className="bg-background border-border"
                      />
                    </div>
                  </>
                )}

                {config.type === "PTP Broken?" && (
                  <>
                    <div className="space-y-2">
                      <Label>Grace Period</Label>
                      <Select
                        value={config.gracePeriod || "3days"}
                        onValueChange={(value) =>
                          setConfig({ ...config, gracePeriod: value })
                        }
                      >
                        <SelectTrigger className="bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1day">1 Day</SelectItem>
                          <SelectItem value="3days">3 Days</SelectItem>
                          <SelectItem value="5days">5 Days</SelectItem>
                          <SelectItem value="7days">7 Days</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Escalation Rule</Label>
                      <Input
                        value={config.escalationRule || "Send to Legal"}
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            escalationRule: e.target.value,
                          })
                        }
                        className="bg-background border-border"
                      />
                    </div>
                  </>
                )}

                {config.type === "If High-Risk Customer" && (
                  <>
                    <div className="space-y-2">
                      <Label>Risk Band Summary</Label>
                      <Textarea
                        value={
                          config.riskBand ||
                          "High Risk (Score > 750)\n- Multiple PTP breaks\n- Low payment history"
                        }
                        onChange={(e) =>
                          setConfig({ ...config, riskBand: e.target.value })
                        }
                        className="bg-background border-border"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* AI NODE CONFIGURATION */}
            {isAI && (
              <div className="space-y-4 bg-primary/5 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold text-primary">
                    AI-Powered Insights
                  </span>
                </div>

                {config.type === "AI Next-Best-Action" && (
                  <>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Input Signals
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        <Badge>Contactability: 67%</Badge>
                        <Badge>Payment History: Good</Badge>
                        <Badge>Dispute Risk: Low</Badge>
                        <Badge>Response Rate: High</Badge>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Ranked Recommendations</Label>
                      <div className="space-y-2">
                        <div className="p-3 bg-background rounded border border-border">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">1. Send SMS</span>
                            <Badge variant="secondary">85% confidence</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            High SMS engagement history
                          </p>
                        </div>
                        <div className="p-3 bg-background rounded border border-border">
                          <div className="flex justify-between items-center">
                            <span className="font-medium">2. AI Dialer</span>
                            <Badge variant="secondary">72% confidence</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            Available during work hours
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {config.type === "AI Recommend Channel" && (
                  <>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Radio className="h-4 w-4" />
                        Channel Recommendations
                      </Label>
                      <div className="space-y-2">
                        {[
                          {
                            channel: "SMS",
                            probability: 78,
                            performance: "High",
                          },
                          {
                            channel: "WhatsApp",
                            probability: 65,
                            performance: "Medium",
                          },
                          {
                            channel: "AI Dialer",
                            probability: 54,
                            performance: "Medium",
                          },
                          {
                            channel: "Email",
                            probability: 32,
                            performance: "Low",
                          },
                        ].map((item) => (
                          <div
                            key={item.channel}
                            className="p-3 bg-background rounded border border-border"
                          >
                            <div className="flex justify-between items-center">
                              <span className="font-medium">
                                {item.channel}
                              </span>
                              <div className="flex gap-2">
                                <Badge variant="secondary">
                                  {item.probability}%
                                </Badge>
                                <Badge
                                  variant={
                                    item.performance === "High"
                                      ? "default"
                                      : "outline"
                                  }
                                >
                                  {item.performance}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {config.type === "AI Recommend Time-of-Day" && (
                  <>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Optimal Time Window
                      </Label>
                      <Input
                        value={config.timeWindow || "2:00 PM - 4:00 PM"}
                        onChange={(e) =>
                          setConfig({ ...config, timeWindow: e.target.value })
                        }
                        className="bg-background border-border"
                      />
                    </div>

                    <div className="p-3 bg-background rounded border border-border">
                      <p className="text-sm">
                        <strong>Engagement Score:</strong> 82%
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Historical analysis shows 3.2x higher response rate
                        during this window
                      </p>
                    </div>
                  </>
                )}

                {config.type === "AI Dispute Classifier" && (
                  <>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <FileQuestion className="h-4 w-4" />
                        Detected Intent
                      </Label>
                      <Input
                        value={
                          config.detectedIntent ||
                          "Payment Dispute - Fraud Claim"
                        }
                        onChange={(e) =>
                          setConfig({
                            ...config,
                            detectedIntent: e.target.value,
                          })
                        }
                        className="bg-background border-border"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Confidence Score</Label>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary"
                            style={{ width: "87%" }}
                          />
                        </div>
                        <span className="text-sm font-medium">87%</span>
                      </div>
                    </div>

                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded">
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                        Suggested Action: Create Dispute Case
                      </p>
                    </div>
                  </>
                )}

                {config.type === "AI PTP Probability" && (
                  <>
                    <div className="space-y-2">
                      <Label>PTP Honor Probability</Label>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-success"
                            style={{ width: "73%" }}
                          />
                        </div>
                        <span className="text-sm font-medium">73%</span>
                      </div>
                    </div>

                    <div className="p-3 bg-background rounded border border-border">
                      <p className="text-sm font-medium mb-2">
                        Recommendations:
                      </p>
                      <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                        <li>Send reminder 1 day before due date</li>
                        <li>Use SMS + WhatsApp combination</li>
                        <li>Enable auto-payment link</li>
                      </ul>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Configuration</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
