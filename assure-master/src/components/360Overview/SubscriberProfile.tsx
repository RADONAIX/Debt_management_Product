import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserRound } from "lucide-react";
import { getCustomer, type CustomerProfile } from "@/lib/customers";
import { ApiError } from "@/lib/api";
import { money } from "@/lib/money";

/** Low / Medium / High read better as a coloured chip than as plain text. */
const gradeTone: Record<string, string> = {
  Low: "bg-success/10 text-success border-success/20",
  Medium: "bg-warning/10 text-warning border-warning/20",
  High: "bg-destructive/10 text-destructive border-destructive/20",
};


const pct = (v?: number | null) => (v === null || v === undefined ? "—" : `${Math.round(v)}%`);

/**
 * Subscriber 360 profile, read from the customer record rather than derived
 * on the client, so the screen shows what is actually stored.
 */
export const SubscriberProfile = ({ customerId }: { customerId?: string }) => {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getCustomer(customerId)
      .then((p) => !cancelled && setProfile(p))
      .catch((e) => {
        if (cancelled) return;
        setProfile(null);
        setError(e instanceof ApiError ? e.message : "Could not load this customer.");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const text = (label: string, value?: string | number | null) => (
    <div key={label}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value ?? "—"}</p>
    </div>
  );

  const grade = (label: string, value?: string | null) => (
    <div key={label}>
      <p className="text-xs text-muted-foreground">{label}</p>
      {value ? (
        <Badge variant="outline" className={`mt-0.5 ${gradeTone[value] ?? ""}`}>
          {value}
        </Badge>
      ) : (
        <p className="text-sm font-medium text-foreground">—</p>
      )}
    </div>
  );

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <UserRound className="h-4 w-4 text-primary" />
          Subscriber Profile
        </h3>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!customerId && <p className="text-sm text-muted-foreground">Select a customer.</p>}

      {profile && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
            {text("Behaviour Type", profile.behaviourType)}
            {text("Preferred Language", profile.preferredLanguage)}
            {text("Communication Preference", profile.communicationPreference)}
            {text("Preferred Contact Time", profile.preferredContactTime)}
            {text("Occupation", profile.occupation)}
            {text("Monthly Income", money(profile.monthlyIncome))}
            {text("Emotional State", profile.emotionalState)}
            {text("Life Event", profile.lifeEvent)}
            {grade("Financial Stress", profile.financialStress)}
            {grade("Legal Awareness", profile.legalAwareness)}
            {grade("Financial Literacy", profile.financialLiteracy)}
            {grade("Credit Awareness", profile.creditAwareness)}
            {grade("Risk Appetite", profile.riskAppetite)}
            {grade("Employment Stability", profile.employmentStability)}
            {text("Responsibility Score", pct(profile.responsibilityScore))}
            {text("Cooperation Score", pct(profile.cooperationScore))}
          </div>

          <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
            {text("Customer", `${profile.name} · ${profile.id}`)}
            {text("Segment", profile.segment)}
            {text("Risk", `${profile.riskLevel} (${Math.round(profile.riskScore)})`)}
            {text("Credit Score", profile.creditScore)}
          </div>
        </>
      )}
    </Card>
  );
};
