import { TrendingUp, Zap, Target } from "lucide-react";

interface Cluster {
  id: string;
  aging: string;
  risk: string;
  customers: number;
  outstanding: number;
  segment: string;
  avgDPD: number;
  carInflow: number;
  contactability: number;
  disputeRate: number;
  ptpSuccess: number;
  lastPayment: number;
  paymentFrequency?: number;
  volatility?: number;
  tenure?: number;
  engagementScore?: number;
}

interface AIRecommendationProps {
  cluster: Cluster | null;
}

export const AIRecommendation = ({ cluster }: AIRecommendationProps) => {
  if (!cluster) {
    return (
      <div className="bg-card rounded-xl border border-border p-6 shadow-lg h-full flex items-center justify-center">
        <div className="text-center text-muted-foreground">
          <Zap className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>AI recommendations will appear here when you select a cluster</p>
        </div>
      </div>
    );
  }

  const getRecommendation = () => {
    if (cluster.risk === "Critical" || cluster.risk === "High") {
      return {
        strategy: "Installment Plan + AI Dialer Follow-up Strategy",
        description:
          "High-risk cluster with significant outstanding balance requires aggressive recovery strategy with personalized payment plans.",
        uplift: cluster.risk === "Critical" ? 14.2 : 18.5,
        collection: cluster.carInflow,
        confidence: cluster.risk === "Critical" ? 87 : 92,
      };
    } else if (cluster.risk === "Medium") {
      return {
        strategy: "Automated Reminder + SMS Engagement Campaign",
        description:
          "Medium-risk cluster shows good contactability. Automated engagement can improve payment behavior with minimal intervention.",
        uplift: 22.3,
        collection: cluster.carInflow,
        confidence: 94,
      };
    } else {
      return {
        strategy: "Self-Service Portal + Incentive Program",
        description:
          "Low-risk cluster with good payment history. Encourage self-service payments with early payment incentives.",
        uplift: 28.7,
        collection: cluster.carInflow,
        confidence: 96,
      };
    }
  };

  const recommendation = getRecommendation();

  return (
    <div className="bg-card rounded-xl border border-primary/30 p-5 shadow-md shadow-primary/10 h-full">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
          <Zap className="w-5 h-5 text-primary" />
        </div>
        <h3 className="text-xl font-bold text-foreground">AI Recommendation</h3>
      </div>

      <div className="space-y-6">
        <div>
          <div className="text-xs text-muted-foreground mb-2">RECOMMENDED STRATEGY</div>
          <div className="text-lg font-semibold text-foreground mb-2">{recommendation.strategy}</div>
          <p className="text-sm text-muted-foreground leading-relaxed">{recommendation.description}</p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="bg-primary/10 rounded-lg p-4 border border-primary/30">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
              <div>
                <div className="text-xs text-muted-foreground mb-1">Expected Uplift</div>
                <div className="text-2xl font-bold text-primary">+{recommendation.uplift}%</div>
              </div>
            </div>
          </div>

          <div className="bg-secondary/50 rounded-lg p-4 border border-border">
            <div className="flex items-start gap-3">
              <Target className="w-5 h-5 text-foreground mt-1 flex-shrink-0" />
              <div>
                <div className="text-xs text-muted-foreground mb-1">Predicted Collection</div>
                <div className="text-xl font-bold text-foreground">
                  $ {(recommendation.collection / 1000000).toFixed(1)}M
                </div>
                <div className="text-xs text-muted-foreground mt-1">in the next 30 days</div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">AI Confidence Score</span>
            <span className="text-sm font-semibold text-foreground">{recommendation.confidence}%</span>
          </div>
          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${recommendation.confidence}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-secondary/30 rounded-lg p-3 border border-border/50">
          <div className="text-xs text-muted-foreground mb-1">Key Success Factors</div>
          <ul className="text-xs text-foreground space-y-1">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Contactability rate: {cluster.contactability}%</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Historical PTP success: {cluster.ptpSuccess}%</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Cluster size: {cluster.customers.toLocaleString()} customers</span>
            </li>
            {cluster.paymentFrequency !== undefined && (
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Payment frequency: {cluster.paymentFrequency}%</span>
              </li>
            )}
            {cluster.volatility !== undefined && (
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Balance volatility: {cluster.volatility}%</span>
              </li>
            )}
            {cluster.engagementScore !== undefined && (
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>Engagement score: {cluster.engagementScore}%</span>
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
};
