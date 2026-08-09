import { useEffect, useState } from "react";
import {
  ChevronDown, ChevronUp, HandCoins, Phone, Target, TrendingUp, Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { money } from "@/lib/money";
import {
  getAudienceEstimate, getChannelEconomics, getStrategySummary,
  type AudienceEstimate, type ChannelEconomics, type StrategySummary,
} from "@/lib/strategyDashboard";

/**
 * Strategy Insights.
 *
 * Live figures for the book the designer is working against — the whole book,
 * not the strategy being edited, since a draft has nobody enrolled in it yet.
 * Every number is read from the database; nothing here is a projection.
 */
export const StrategyInsightsPanel = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [book, setBook] = useState<AudienceEstimate | null>(null);
  const [summary, setSummary] = useState<StrategySummary | null>(null);
  const [channels, setChannels] = useState<ChannelEconomics[]>([]);
  const [loading, setLoading] = useState(false);

  // Only fetch once the strip is opened — it is collapsed by default and the
  // canvas should not pay for data nobody is looking at.
  useEffect(() => {
    if (!isExpanded || book) return;
    setLoading(true);
    Promise.all([getAudienceEstimate({}), getStrategySummary(), getChannelEconomics()])
      .then(([b, s, c]) => { setBook(b); setSummary(s); setChannels(c); })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [isExpanded, book]);

  const stat = (
    icon: typeof Users, label: string, value: string, caption: string, tone = "text-foreground",
  ) => {
    const Icon = icon;
    return (
      <Card className="p-4 bg-background border-border">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
        </div>
        {loading ? (
          <Skeleton className="h-7 w-20" />
        ) : (
          <div className={`text-2xl font-bold tabular-nums ${tone}`}>{value}</div>
        )}
        <div className="text-xs text-muted-foreground mt-1">{caption}</div>
      </Card>
    );
  };

  return (
    <div
      className={`border-t border-border bg-card transition-all duration-300 ${
        isExpanded ? "h-64" : "h-12"
      }`}
    >
      <div
        className="flex items-center justify-between px-6 py-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          <h3 className="text-sm font-semibold text-foreground">Strategy Insights</h3>
          <Badge variant="outline" className="text-xs">Live book</Badge>
        </div>
        <Button variant="ghost" size="sm">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </Button>
      </div>

      {isExpanded && (
        <div className="px-6 pb-4 overflow-y-auto h-[calc(100%-48px)]">
          <div className="grid grid-cols-5 gap-4">
            {stat(Users, "Customers on the book",
              book ? book.customers.toLocaleString() : "—",
              book ? `${book.accounts.toLocaleString()} accounts` : "")}

            {stat(Target, "Outstanding",
              book ? money(book.outstanding) : "—",
              book ? `average ${book.avgDpd} days overdue` : "")}

            {stat(HandCoins, "Promises kept",
              summary ? `${summary.promiseKeptRate}%` : "—",
              summary ? `${summary.promises} taken on strategy` : "")}

            {stat(Phone, "Touches that got a reply",
              summary ? `${summary.responseRate}%` : "—",
              summary ? `${summary.touches} touches sent` : "")}

            {stat(TrendingUp, "Lift over doing nothing",
              summary ? `${summary.liftPct >= 0 ? "+" : ""}${summary.liftPct}pp` : "—",
              summary ? `${summary.recoveryRate}% recovered` : "",
              summary && summary.liftPct < 0 ? "text-destructive" : "text-success")}
          </div>

          {/* What each channel has actually reached, newest data first */}
          <div className="mt-4 grid grid-cols-4 gap-3">
            {channels.slice(0, 4).map((c) => (
              <div
                key={c.channel}
                className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
              >
                <div className="min-w-0">
                  <div className="text-xs text-foreground truncate">{c.label}</div>
                  <div className="text-[10px] text-muted-foreground tabular-nums">
                    {c.touches} sent
                  </div>
                </div>
                <span className="text-sm font-semibold text-foreground tabular-nums shrink-0">
                  {c.responseRate}%
                </span>
              </div>
            ))}
            {!loading && channels.length === 0 && (
              <p className="text-xs text-muted-foreground col-span-4">
                No touches recorded yet.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
