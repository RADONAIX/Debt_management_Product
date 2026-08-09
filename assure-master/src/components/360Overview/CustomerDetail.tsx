import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, DollarSign, Calendar, TrendingUp, Phone, Mail, MessageSquare, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const customers = [
  { id: "CUST-CON-003", name: "Sarah Mitchell", status: "Past Due", riskLevel: "High Risk" },
  { id: "CUST-CON-002", name: "David Brown", status: "Past Due", riskLevel: "Medium Risk" },
  { id: "CUST-CON-004", name: "Fatima Al Zahra", status: "Current", riskLevel: "Low Risk" }
];

const customerDetails = {
  "CUST-CON-003": {
    outstanding: 125000,
    dpd: 142,
    lastPayment: { date: "2024-06-18", amount: 15000 },
    nextAction: "Immediate Follow-up Required",
    riskTrend: [
      { month: "May", score: 65 },
      { month: "Jun", score: 72 },
      { month: "Jul", score: 78 },
      { month: "Aug", score: 82 },
      { month: "Sep", score: 85 },
      { month: "Oct", score: 88 },
    ],
    paymentHistory: [
      { month: "May", amount: 25000, status: "Paid" },
      { month: "Jun", amount: 15000, status: "Partial" },
      { month: "Jul", amount: 0, status: "Missed" },
      { month: "Aug", amount: 0, status: "Missed" },
      { month: "Sep", amount: 10000, status: "Partial" },
      { month: "Oct", amount: 0, status: "Missed" },
    ],
    contactability: 45,
    disputeRate: 18,
    ptpSuccess: 22,
    communications: 23,
    bestContactTime: "2:00 PM - 4:00 PM",
    bestChannel: "SMS",
    likelihoodToPay: 32,
    recommendedAction: "Offer structured payment plan with 25% down payment",
    riskDrivers: ["Very Low Contactability", "High Dispute Rate", "Poor PTP Success"],
  },
  "CUST-CON-002": {
    outstanding: 78000,
    dpd: 75,
    lastPayment: { date: "2024-09-05", amount: 12000 },
    nextAction: "Schedule Payment Plan Discussion",
    riskTrend: [
      { month: "May", score: 45 },
      { month: "Jun", score: 48 },
      { month: "Jul", score: 52 },
      { month: "Aug", score: 55 },
      { month: "Sep", score: 58 },
      { month: "Oct", score: 60 },
    ],
    paymentHistory: [
      { month: "May", amount: 18000, status: "Paid" },
      { month: "Jun", amount: 18000, status: "Paid" },
      { month: "Jul", amount: 15000, status: "Partial" },
      { month: "Aug", amount: 18000, status: "Paid" },
      { month: "Sep", amount: 12000, status: "Partial" },
      { month: "Oct", amount: 0, status: "Missed" },
    ],
    contactability: 68,
    disputeRate: 8,
    ptpSuccess: 42,
    communications: 45,
    bestContactTime: "10:00 AM - 12:00 PM",
    bestChannel: "Phone Call",
    likelihoodToPay: 65,
    recommendedAction: "Send payment reminder with early payment discount incentive",
    riskDrivers: ["Increasing Days Past Due", "Recent Partial Payments", "Moderate Engagement"],
  },
  "CUST-CON-004": {
    outstanding: 32000,
    dpd: 15,
    lastPayment: { date: "2024-10-28", amount: 32000 },
    nextAction: "Routine Follow-up",
    riskTrend: [
      { month: "May", score: 18 },
      { month: "Jun", score: 15 },
      { month: "Jul", score: 12 },
      { month: "Aug", score: 10 },
      { month: "Sep", score: 12 },
      { month: "Oct", score: 15 },
    ],
    paymentHistory: [
      { month: "May", amount: 32000, status: "Paid" },
      { month: "Jun", amount: 32000, status: "Paid" },
      { month: "Jul", amount: 32000, status: "Paid" },
      { month: "Aug", amount: 32000, status: "Paid" },
      { month: "Sep", amount: 32000, status: "Paid" },
      { month: "Oct", amount: 32000, status: "Paid" },
    ],
    contactability: 92,
    disputeRate: 2,
    ptpSuccess: 85,
    communications: 12,
    bestContactTime: "9:00 AM - 11:00 AM",
    bestChannel: "Email",
    likelihoodToPay: 95,
    recommendedAction: "Maintain current relationship, consider upselling opportunities",
    riskDrivers: ["None - Excellent Payment Behavior"],
  },
};

const CustomerDetail = () => {
  const { customerId } = useParams();
  const navigate = useNavigate();

  const customer = customers.find(c => c.id === customerId);
  const details = customerId ? customerDetails[customerId as keyof typeof customerDetails] : null;

  if (!customer || !details) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-7xl mx-auto">
          <Button onClick={() => navigate("/")} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <p className="mt-4 text-muted-foreground">Customer not found</p>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getRiskColor = (risk: string) => {
    if (risk === "High Risk") return "bg-risk-high";
    if (risk === "Medium Risk") return "bg-risk-medium";
    return "bg-risk-low";
  };

  const getStatusColor = (status: string) => {
    if (status === "Past Due") return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button onClick={() => navigate("/")} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <Button onClick={() => navigate(`/customer-profile/${customerId}`)} variant="default">
            See More Information
          </Button>
        </div>

        {/* Customer Header Card */}
        <Card className="p-6 bg-card border-border">
          <div className="flex items-start justify-between">
            <div className="flex gap-4">
              <div className="h-20 w-20 rounded-full bg-primary/20 flex items-center justify-center text-2xl font-bold text-primary">
                {customer.name.split(' ').map(n => n[0]).join('')}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-foreground">{customer.name}</h1>
                <p className="text-muted-foreground mt-1">{customer.id}</p>
                <div className="flex gap-2 mt-3">
                  <Badge className={`${getStatusColor(customer.status)} text-white`}>
                    {customer.status}
                  </Badge>
                  <Badge className={`${getRiskColor(customer.riskLevel)} text-white`}>
                    {customer.riskLevel}
                  </Badge>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Account Type</p>
              <p className="text-lg font-semibold text-foreground">Consumer</p>
            </div>
          </div>
        </Card>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-card border-border">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Outstanding</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(details.outstanding)}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-card border-border">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Days Past Due</p>
                <p className="text-2xl font-bold text-foreground">{details.dpd}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-card border-border">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Last Payment</p>
                <p className="text-lg font-bold text-foreground">{formatCurrency(details.lastPayment.amount)}</p>
                <p className="text-xs text-muted-foreground">{details.lastPayment.date}</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 bg-card border-border">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-red-500/20 flex items-center justify-center">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Next Action</p>
                <p className="text-sm font-semibold text-foreground">{details.nextAction}</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Risk Profile */}
          <Card className="p-6 bg-card border-border">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Risk Trend (6 Months)
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={details.riskTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Line type="monotone" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
            <div className="mt-4 space-y-2">
              <h3 className="font-semibold text-foreground">Risk Drivers:</h3>
              {details.riskDrivers.map((driver, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  {driver}
                </div>
              ))}
            </div>
          </Card>

          {/* Payment History */}
          <Card className="p-6 bg-card border-border">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Payment History (6 Months)
            </h2>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={details.paymentHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="amount" fill="hsl(var(--primary))" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 flex gap-4 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-muted-foreground">Paid</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-yellow-500" />
                <span className="text-muted-foreground">Partial</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-muted-foreground">Missed</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Behavioral Insights */}
        <Card className="p-6 bg-card border-border">
          <h2 className="text-xl font-bold text-foreground mb-4">Behavioral Insights</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground mb-2">Contactability Score</p>
              <div className="flex items-end gap-2">
                <p className="text-3xl font-bold text-foreground">{details.contactability}%</p>
                <p className="text-sm text-muted-foreground mb-1">({details.communications} attempts)</p>
              </div>
              <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all" 
                  style={{ width: `${details.contactability}%` }}
                />
              </div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">Dispute Rate</p>
              <p className="text-3xl font-bold text-foreground">{details.disputeRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">
                {details.disputeRate > 10 ? "Above average" : "Below average"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">PTP Success Rate</p>
              <p className="text-3xl font-bold text-foreground">{details.ptpSuccess}%</p>
              <p className="text-xs text-muted-foreground mt-1">
                Promise-to-Pay fulfillment
              </p>
            </div>
          </div>
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Best Contact Time</span>
              </div>
              <p className="text-foreground">{details.bestContactTime}</p>
            </div>
            <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                {details.bestChannel === "Phone Call" && <Phone className="h-4 w-4 text-primary" />}
                {details.bestChannel === "Email" && <Mail className="h-4 w-4 text-primary" />}
                {details.bestChannel === "SMS" && <MessageSquare className="h-4 w-4 text-primary" />}
                <span className="text-sm font-semibold text-foreground">Best Channel</span>
              </div>
              <p className="text-foreground">{details.bestChannel}</p>
            </div>
          </div>
        </Card>

        {/* AI Recommendations */}
        <Card className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-primary/30">
          <h2 className="text-xl font-bold text-foreground mb-4">🤖 AI-Powered Recommendations</h2>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Predicted Likelihood to Pay</p>
              <div className="flex items-center gap-4">
                <div className="flex-1 h-3 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all" 
                    style={{ width: `${details.likelihoodToPay}%` }}
                  />
                </div>
                <span className="text-2xl font-bold text-foreground">{details.likelihoodToPay}%</span>
              </div>
            </div>
            <div className="p-4 bg-card border border-border rounded-lg">
              <h3 className="font-semibold text-foreground mb-2">Recommended Strategy:</h3>
              <p className="text-muted-foreground">{details.recommendedAction}</p>
            </div>
          </div>
        </Card>

        {/* Action Center */}
        <Card className="p-6 bg-card border-border">
          <h2 className="text-xl font-bold text-foreground mb-4">Action Center</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Button variant="outline" className="w-full">
              <Mail className="h-4 w-4 mr-2" />
              Send Reminder
            </Button>
            <Button variant="outline" className="w-full">
              <Phone className="h-4 w-4 mr-2" />
              Schedule Call
            </Button>
            <Button variant="outline" className="w-full">
              <DollarSign className="h-4 w-4 mr-2" />
              Payment Plan
            </Button>
            <Button variant="outline" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
              <MessageSquare className="h-4 w-4 mr-2" />
              Add Note
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default CustomerDetail;