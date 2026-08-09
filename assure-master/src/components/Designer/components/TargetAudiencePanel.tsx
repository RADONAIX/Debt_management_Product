import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Target, TrendingUp, Users } from "lucide-react";
import {
  Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { money } from "@/lib/money";
import {
  getAudienceEstimate, getAudienceOptions,
  type AudienceEstimate, type AudienceOption, type AudienceOptions,
} from "@/lib/strategyDashboard";

export interface TargetAudience {
  segment: string;
  agingBucket: string;
  riskScoreMin: number;
  riskScoreMax: number;
  /** Distinct customers the criteria actually select, counted in the database. */
  customerCount: number;
  accountCount: number;
  outstanding: number;
  filters: {
    contactability?: string;
    balanceBand?: string;
    creditClass?: string;
  };
}

interface TargetAudiencePanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (audience: TargetAudience) => void;
}

const ANY = "__any__";

/** A dropdown whose choices come from the book, each showing what it covers. */
function CriteriaSelect({
  label, value, onChange, options, anyLabel, unit = "accounts",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: AudienceOption[];
  anyLabel: string;
  unit?: "accounts" | "customers";
}) {
  return (
    <div className="space-y-2">
      <Label className="text-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="bg-background border-border">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY}>{anyLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
              <span className="text-muted-foreground">
                {" "}· {unit === "accounts" ? o.accounts : o.customers}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Target Audience Selection.
 *
 * Every criterion offered here is read from the live book, and the size shown
 * is a real count against it — so a strategy can never be aimed at an audience
 * that does not exist.
 */
export const TargetAudiencePanel = ({
  open, onOpenChange, onConfirm,
}: TargetAudiencePanelProps) => {
  const [options, setOptions] = useState<AudienceOptions | null>(null);
  const [segment, setSegment] = useState(ANY);
  const [agingBucket, setAgingBucket] = useState(ANY);
  const [risk, setRisk] = useState<number[]>([0, 100]);
  const [contactability, setContactability] = useState(ANY);
  const [balanceBand, setBalanceBand] = useState(ANY);
  const [creditClass, setCreditClass] = useState(ANY);

  const [estimate, setEstimate] = useState<AudienceEstimate | null>(null);
  const [counting, setCounting] = useState(false);

  // The criteria open at "everything", so the first number a designer sees is
  // the whole book rather than an arbitrary preset.
  useEffect(() => {
    if (!open || options) return;
    getAudienceOptions()
      .then((o) => {
        setOptions(o);
        setRisk([o.riskMin, o.riskMax]);
      })
      .catch(() => setOptions(null));
  }, [open, options]);

  const criteria = useMemo(() => ({
    segment: segment === ANY ? undefined : segment,
    agingBucket: agingBucket === ANY ? undefined : agingBucket,
    riskMin: risk[0],
    riskMax: risk[1],
    contactability: contactability === ANY ? undefined : contactability,
    balanceBand: balanceBand === ANY ? undefined : balanceBand,
    creditClass: creditClass === ANY ? undefined : creditClass,
  }), [segment, agingBucket, risk, contactability, balanceBand, creditClass]);

  // Re-count as the criteria move, debounced so dragging the slider does not
  // fire a request per pixel.
  useEffect(() => {
    if (!open) return;
    setCounting(true);
    const t = setTimeout(() => {
      getAudienceEstimate(criteria)
        .then(setEstimate)
        .catch(() => setEstimate(null))
        .finally(() => setCounting(false));
    }, 250);
    return () => clearTimeout(t);
  }, [open, criteria]);

  const handleConfirm = useCallback(() => {
    onConfirm({
      segment: segment === ANY ? "All segments" : segment,
      agingBucket: agingBucket === ANY ? "All buckets" : agingBucket,
      riskScoreMin: risk[0],
      riskScoreMax: risk[1],
      customerCount: estimate?.customers ?? 0,
      accountCount: estimate?.accounts ?? 0,
      outstanding: estimate?.outstanding ?? 0,
      filters: {
        contactability: contactability === ANY ? undefined : contactability,
        balanceBand: balanceBand === ANY ? undefined : balanceBand,
        creditClass: creditClass === ANY ? undefined : creditClass,
      },
    });
    onOpenChange(false);
  }, [onConfirm, onOpenChange, segment, agingBucket, risk, estimate,
      contactability, balanceBand, creditClass]);

  const empty = estimate !== null && estimate.accounts === 0;

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
            <CriteriaSelect
              label="Segment" value={segment} onChange={setSegment}
              options={options?.segments ?? []} anyLabel="All segments"
              unit="customers"
            />

            <CriteriaSelect
              label="Ageing bucket" value={agingBucket} onChange={setAgingBucket}
              options={options?.agingBuckets ?? []} anyLabel="All buckets"
            />

            <div className="space-y-3">
              <Label className="text-foreground">Risk score range</Label>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-muted-foreground w-8 tabular-nums">
                  {risk[0]}
                </span>
                <Slider
                  value={risk} onValueChange={setRisk}
                  min={options?.riskMin ?? 0} max={options?.riskMax ?? 100}
                  step={1} className="flex-1"
                />
                <span className="text-sm font-medium text-muted-foreground w-8 tabular-nums">
                  {risk[1]}
                </span>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-xs">Min: {risk[0]}</Badge>
                <Badge variant="outline" className="text-xs">Max: {risk[1]}</Badge>
                {options && (
                  <span className="text-[11px] text-muted-foreground self-center">
                    scores on the book run {options.riskMin}–{options.riskMax}
                  </span>
                )}
              </div>
            </div>

            {/* What the criteria actually select, counted in the database */}
            <div
              className={`rounded-lg border p-4 ${
                empty ? "border-warning/30 bg-warning/5" : "border-primary/20 bg-primary/10"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Users className={`h-4 w-4 ${empty ? "text-warning" : "text-primary"}`} />
                <Label className="text-sm font-medium text-foreground">
                  Customers matched
                </Label>
                {counting && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-auto" />
                )}
              </div>

              <div
                className={`text-3xl font-bold tabular-nums ${
                  empty ? "text-warning" : "text-primary"
                }`}
              >
                {estimate ? estimate.customers.toLocaleString() : "—"}
              </div>

              {estimate && !empty && (
                <>
                  <p className="text-xs text-muted-foreground mt-1">
                    {estimate.accounts.toLocaleString()} account
                    {estimate.accounts === 1 ? "" : "s"} · {money(estimate.outstanding)} outstanding
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-2 leading-snug">
                    {estimate.shareOfAccountsPct}% of the book by accounts,{" "}
                    {estimate.shareOfValuePct}% by value. Average {estimate.avgDpd} days overdue,
                    risk {estimate.avgRisk}.
                  </p>
                </>
              )}

              {empty && (
                <p className="text-xs text-warning mt-1">
                  Nothing on the book matches these criteria. Widen the range before
                  confirming, or the strategy will run against nobody.
                </p>
              )}

              {estimate && (
                <p className="text-[10px] text-muted-foreground/70 mt-2">
                  Counted live against {estimate.totalCustomers.toLocaleString()} customers
                  and {estimate.totalAccounts.toLocaleString()} accounts.
                </p>
              )}
            </div>

            <div className="space-y-4 pt-4 border-t border-border">
              <Label className="text-foreground font-semibold">Advanced filters</Label>

              <CriteriaSelect
                label="Contactability" value={contactability} onChange={setContactability}
                options={options?.contactability ?? []} anyLabel="Any contactability"
              />
              <CriteriaSelect
                label="Outstanding balance" value={balanceBand} onChange={setBalanceBand}
                options={options?.balanceBands ?? []} anyLabel="Any balance"
              />
              <CriteriaSelect
                label="Credit class" value={creditClass} onChange={setCreditClass}
                options={options?.creditClasses ?? []} anyLabel="Any credit class"
                unit="customers"
              />
            </div>
          </div>
        </ScrollArea>

        <SheetFooter className="flex gap-2 mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleConfirm} className="flex-1" disabled={!estimate || empty}>
            <TrendingUp className="h-4 w-4 mr-2" />
            Confirm audience
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};
