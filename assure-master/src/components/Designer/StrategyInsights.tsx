import { useParams, useNavigate } from "react-router-dom";
import { HeaderWithNav } from "./components/HeaderWithNav";
import { Button } from "./components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./components/ui/card";
import { Badge } from "./components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { ArrowLeft, TrendingUp, AlertTriangle, CheckCircle, XCircle, MessageSquare, Mail, Phone, Users } from "lucide-react";
import { Progress } from "./components/ui/progress";

const StrategyInsights = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <HeaderWithNav />
      
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate("/strategy-library")} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Library
          </Button>
          <h1 className="text-3xl font-bold text-foreground">Strategy Insights</h1>
          <p className="text-muted-foreground mt-1">
            High Value Recovery - Q1 2025
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="ai-insights">AI Insights</TabsTrigger>
            <TabsTrigger value="channel-performance">Channel Performance</TabsTrigger>
            <TabsTrigger value="outcomes">Case Outcomes</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Total Executions
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">1,247</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="text-success">+12%</span> from last period
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Success Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">68.5%</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="text-success">+5.2%</span> improvement
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Collections Generated
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">$487K</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="text-success">+18%</span> vs target
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Avg Response Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">2.4h</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="text-success">-0.6h</span> faster
                  </p>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Contact Funnel</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Initial Contact</span>
                      <span className="text-sm font-medium">1,247 (100%)</span>
                    </div>
                    <Progress value={100} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Response Received</span>
                      <span className="text-sm font-medium">934 (75%)</span>
                    </div>
                    <Progress value={75} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">PTP Created</span>
                      <span className="text-sm font-medium">687 (55%)</span>
                    </div>
                    <Progress value={55} />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <span className="text-sm">Payment Received</span>
                      <span className="text-sm font-medium">467 (37%)</span>
                    </div>
                    <Progress value={37} />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Drop-off Analysis</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-start gap-3 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                    <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Highest Drop-off: Response to PTP</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        26% of customers who respond don't create PTP
                      </p>
                      <Badge variant="outline" className="mt-2">Consider: AI Risk Score Node</Badge>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 bg-primary/10 rounded-lg border border-primary/20">
                    <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Best Performance: PTP to Payment</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        68% conversion rate - exceeds target
                      </p>
                      <Badge variant="outline" className="mt-2">Strength: Follow-up Timing</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="ai-insights" className="space-y-6">
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  AI Strategy Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-background rounded-lg border border-border">
                    <p className="text-sm text-muted-foreground">Expected Uplift</p>
                    <p className="text-2xl font-bold text-success mt-1">+22.5%</p>
                  </div>
                  <div className="p-4 bg-background rounded-lg border border-border">
                    <p className="text-sm text-muted-foreground">Predicted Collections</p>
                    <p className="text-2xl font-bold mt-1">$589K</p>
                  </div>
                  <div className="p-4 bg-background rounded-lg border border-border">
                    <p className="text-sm text-muted-foreground">AI Confidence Score</p>
                    <p className="text-2xl font-bold text-primary mt-1">87%</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold">Contactability Improvement</h4>
                  <div className="p-3 bg-background rounded border border-border">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm">AI Recommend Channel active</span>
                      <Badge>+15% reach</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      AI-driven channel selection improved contact rate from 52% to 67%
                    </p>
                  </div>

                  <div className="p-3 bg-background rounded border border-border">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm">AI Recommend Time-of-Day active</span>
                      <Badge>+12% engagement</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Optimal timing recommendations increased response rate by 12%
                    </p>
                  </div>
                </div>

                <div className="space-y-3 mt-6">
                  <h4 className="font-semibold flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Risk Warnings
                  </h4>
                  <div className="p-3 bg-amber-500/10 rounded border border-amber-500/20">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                      High dispute risk detected in 8% of accounts
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      AI Dispute Classifier automatically routed 102 cases to dispute resolution workflow
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="channel-performance" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    SMS Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Sent</span>
                    <span className="font-medium">1,247</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Delivered</span>
                    <span className="font-medium">1,198 (96%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Clicked</span>
                    <span className="font-medium">687 (55%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Converted</span>
                    <span className="font-medium text-success">423 (34%)</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Email Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Sent</span>
                    <span className="font-medium">892</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Delivered</span>
                    <span className="font-medium">856 (96%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Opened</span>
                    <span className="font-medium">412 (46%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Converted</span>
                    <span className="font-medium text-success">156 (17%)</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Phone className="h-5 w-5" />
                    AI Dialer Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Calls Attempted</span>
                    <span className="font-medium">534</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Connected</span>
                    <span className="font-medium">312 (58%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Avg Call Duration</span>
                    <span className="font-medium">4m 32s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Converted</span>
                    <span className="font-medium text-success">198 (37%)</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Virtual Assistant Performance
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Conversations</span>
                    <span className="font-medium">287</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Completed</span>
                    <span className="font-medium">243 (85%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Avg Session</span>
                    <span className="font-medium">3m 12s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Converted</span>
                    <span className="font-medium text-success">167 (58%)</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="outcomes" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-success" />
                    PTP Honored
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">467</div>
                  <p className="text-xs text-muted-foreground mt-1">68% honor rate</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-destructive" />
                    PTP Broken
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">220</div>
                  <p className="text-xs text-muted-foreground mt-1">32% break rate</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    Disputes Resolved
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">87</div>
                  <p className="text-xs text-muted-foreground mt-1">85% resolution rate</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    Legal Escalations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">34</div>
                  <p className="text-xs text-muted-foreground mt-1">2.7% of total</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Outcome Timeline</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-24 text-sm text-muted-foreground">Day 0-3</div>
                    <div className="flex-1">
                      <Progress value={78} className="mb-1" />
                      <p className="text-xs text-muted-foreground">78% initial contact success</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-24 text-sm text-muted-foreground">Day 4-7</div>
                    <div className="flex-1">
                      <Progress value={55} className="mb-1" />
                      <p className="text-xs text-muted-foreground">55% PTP creation rate</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-24 text-sm text-muted-foreground">Day 8-14</div>
                    <div className="flex-1">
                      <Progress value={68} className="mb-1" />
                      <p className="text-xs text-muted-foreground">68% payment completion</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-24 text-sm text-muted-foreground">Day 15+</div>
                    <div className="flex-1">
                      <Progress value={12} className="mb-1" />
                      <p className="text-xs text-muted-foreground">12% require escalation</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default StrategyInsights;