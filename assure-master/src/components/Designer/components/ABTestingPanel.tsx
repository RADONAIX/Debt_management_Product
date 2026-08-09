import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { X, Plus, TrendingUp, Users, DollarSign, Target, Calendar } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ABTestingPanelProps {
  open: boolean;
  onClose: () => void;
  strategyId?: string;
  nodes?: any[];
  onVariantAssign?: (nodeId: string, variant: "A" | "B") => void;
}

export const ABTestingPanel = ({ open, onClose, strategyId, nodes = [], onVariantAssign }: ABTestingPanelProps) => {
  const [activeTab, setActiveTab] = useState("create");
  const [variants, setVariants] = useState([
    { id: "1", name: "Variant A", channel: "SMS", template: "Template 1" },
    { id: "2", name: "Variant B", channel: "Email", template: "Template 2" },
  ]);

  const addVariant = () => {
    setVariants([...variants, { 
      id: Date.now().toString(), 
      name: `Variant ${String.fromCharCode(65 + variants.length)}`, 
      channel: "SMS", 
      template: "" 
    }]);
  };

  const removeVariant = (id: string) => {
    setVariants(variants.filter(v => v.id !== id));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold">A/B Testing</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="create">Create Test</TabsTrigger>
            <TabsTrigger value="result">Result</TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-6 mt-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Create New A/B Test</h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="test-name">Test Name</Label>
                  <Input id="test-name" placeholder="e.g., SMS vs Email Campaign" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description" 
                    placeholder="Describe the test hypothesis and expected outcome..."
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="confidence">Confidence Level</Label>
                    <Select defaultValue="80">
                      <SelectTrigger id="confidence">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="80">80%</SelectItem>
                        <SelectItem value="85">85%</SelectItem>
                        <SelectItem value="90">90%</SelectItem>
                        <SelectItem value="95">95%</SelectItem>
                        <SelectItem value="99">99%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="metric">Primary Metric</Label>
                    <Select defaultValue="response">
                      <SelectTrigger id="metric">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="response">Response Rate</SelectItem>
                        <SelectItem value="recovery">Recovery Amount</SelectItem>
                        <SelectItem value="ptp">PTP Rate</SelectItem>
                        <SelectItem value="cost">Cost Efficiency</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start-date">Start Date</Label>
                    <Input id="start-date" type="date" />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="end-date">End Date</Label>
                    <Input id="end-date" type="date" />
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Test Variants</h3>
                <Button onClick={addVariant} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Variant
                </Button>
              </div>

              <div className="space-y-4">
                {variants.map((variant, index) => (
                  <Card key={variant.id} className="p-4 bg-muted/30">
                    <div className="flex items-start justify-between mb-3">
                      <Badge variant={index === 0 ? "default" : "secondary"}>
                        {variant.name}
                      </Badge>
                      {variants.length > 2 && (
                        <Button 
                          onClick={() => removeVariant(variant.id)} 
                          size="sm" 
                          variant="ghost"
                          className="h-6 w-6 p-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor={`channel-${variant.id}`} className="text-sm">
                          Channel
                        </Label>
                        <Select defaultValue={variant.channel}>
                          <SelectTrigger id={`channel-${variant.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SMS">SMS</SelectItem>
                            <SelectItem value="Email">Email</SelectItem>
                            <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                            <SelectItem value="Phone">Phone Call</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`template-${variant.id}`} className="text-sm">
                          Template
                        </Label>
                        <Select defaultValue="template1">
                          <SelectTrigger id={`template-${variant.id}`}>
                            <SelectValue placeholder="Select template" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="template1">Template 1</SelectItem>
                            <SelectItem value="template2">Template 2</SelectItem>
                            <SelectItem value="template3">Template 3</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </Card>

            <div className="flex gap-3">
              <Button onClick={onClose} variant="outline" className="flex-1">
                Cancel
              </Button>
              <Button className="flex-1">
                <Target className="h-4 w-4 mr-2" />
                Save Test
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="result" className="space-y-6 mt-6">
            {/* Test Overview Card */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Active A/B Test</h3>
                <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
                  Running
                </Badge>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground text-sm">Test Name</Label>
                  <p className="text-base font-medium mt-1">SMS vs Email Recovery Campaign</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-sm flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Test Period
                    </Label>
                    <p className="text-sm font-medium mt-1">Jan 15 - Feb 15, 2025</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-sm flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Total Participants
                    </Label>
                    <p className="text-sm font-medium mt-1">2,450 customers</p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Statistical Confidence */}
            <Card className="p-6">
              <div className="text-center mb-6">
                <div className="text-5xl font-bold text-primary mb-2">82%</div>
                <Label className="text-muted-foreground">Statistical Confidence</Label>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Confidence Level</span>
                  <span className="font-medium">82%</span>
                </div>
                <Progress value={82} className="h-3" />
                <p className="text-xs text-muted-foreground">
                  Test is statistically significant (≥80% required)
                </p>
              </div>
            </Card>

            {/* Variant Comparison */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Variant Comparison</h3>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Metric</TableHead>
                      <TableHead className="text-center">Variant A</TableHead>
                      <TableHead className="text-center">Variant B</TableHead>
                      <TableHead className="text-center">Winner</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-medium">Customers</TableCell>
                      <TableCell className="text-center">1,225</TableCell>
                      <TableCell className="text-center">1,225</TableCell>
                      <TableCell className="text-center">-</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Responses</TableCell>
                      <TableCell className="text-center">368</TableCell>
                      <TableCell className="text-center">441</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20">B</Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Response Rate</TableCell>
                      <TableCell className="text-center">30.0%</TableCell>
                      <TableCell className="text-center">36.0%</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20">B</Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Recovery Amount</TableCell>
                      <TableCell className="text-center">$45,200</TableCell>
                      <TableCell className="text-center">$52,900</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20">B</Badge>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell className="font-medium">Cost per Response</TableCell>
                      <TableCell className="text-center">$8.50</TableCell>
                      <TableCell className="text-center">$6.20</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-success/10 text-success border-success/20">B</Badge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </Card>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">+20%</p>
                    <p className="text-xs text-muted-foreground">Performance Lift</p>
                  </div>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                    <DollarSign className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">$7.7K</p>
                    <p className="text-xs text-muted-foreground">Extra Revenue</p>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
