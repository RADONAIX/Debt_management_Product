import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowUpRight, FileQuestion, Loader2, Save } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MetricsCharts } from "./MetricsCharts";
import { MultiSelect } from "@/components/ui/multi-select";
import type { StrategyRow, StrategyUpdate } from "@/lib/strategies";
import { AGING_BUCKETS, RISK_LEVELS } from "@/lib/strategies";

const BEHAVIOURS = ["Willing", "Forgetful", "Evasive", "Disputed", "Hardship"];
const EMOTIONS = ["Cooperative", "Neutral", "Anxious", "Frustrated", "Hostile"];
const DIALER_TYPES = ["Predictive", "Power", "Preview"];
const VOICEMAIL_ACTIONS = ["Send SMS", "Hand over to VA", "Leave message", "Retry later"];
const PTP_ROLES = ["Update PTP", "Create PTP", "Ignore"];
const LANGUAGES = ["English", "Arabic", "Hindi", "Urdu", "Tagalog"];

/** Strategy-level dialer defaults, stored in strategy.settings.dialer. */
interface DialerSettings {
  dialerType?: string;
  contactTimes?: string;
  languages?: string[];
  retryAttempts?: number;
  voicemailAction?: string;
  ptpRole?: string;
}

interface RightSidebarProps {
  onDisputeClassifier?: () => void;
  /** The strategy being edited; null while it loads or for an unsaved one. */
  strategy?: StrategyRow | null;
  /** Persist the edited fields. Resolves true when the write succeeded. */
  onSaveStrategy?: (patch: StrategyUpdate) => Promise<boolean>;
  /** False when the signed-in role may not edit strategies. */
  canEdit?: boolean;
}

/** Empty string for an absent number, so the inputs stay controlled. */
const numText = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));
/** "" clears the value. */
const toNum = (v: string) => (v.trim() === "" ? undefined : Number(v));

export const RightSidebar = ({
  onDisputeClassifier,
  strategy = null,
  onSaveStrategy,
  canEdit = true,
}: RightSidebarProps) => {
  const [form, setForm] = useState<StrategyUpdate>({});
  const [dialer, setDialer] = useState<DialerSettings>({});
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Reload the form whenever a different strategy is opened.
  useEffect(() => {
    if (!strategy) return;
    setForm({
      aging: strategy.aging ?? [],
      riskLevel: strategy.riskLevel ?? [],
      behaviour: strategy.behaviour ?? [],
      emotion: strategy.emotion ?? [],
      minIncome: strategy.minIncome ?? undefined,
      maxIncome: strategy.maxIncome ?? undefined,
      minLoan: strategy.minLoan ?? undefined,
      maxLoan: strategy.maxLoan ?? undefined,
      successRate: strategy.successRate ?? undefined,
      averageRecovery: strategy.averageRecovery ?? undefined,
      averageTurns: strategy.averageTurns ?? undefined,
    });
    setDialer((strategy.settings?.dialer as DialerSettings) ?? {});
    setDirty(false);
  }, [strategy]);

  const set = (patch: StrategyUpdate) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
  };
  const setDial = (patch: DialerSettings) => {
    setDialer((d) => ({ ...d, ...patch }));
    setDirty(true);
  };

  const save = async () => {
    if (!onSaveStrategy) return;
    setSaving(true);
    const ok = await onSaveStrategy({
      ...form,
      settings: { ...(strategy?.settings ?? {}), dialer },
    });
    setSaving(false);
    if (ok) setDirty(false);
  };

  // Failure is the complement of success — shown, never entered.
  const failure =
    form.successRate === undefined || form.successRate === null
      ? null
      : Math.max(0, 100 - Number(form.successRate));

  const disabled = !canEdit || !strategy;

  const field = (label: string, node: React.ReactNode) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {node}
    </div>
  );

  /** Multi-select: several values may apply at once. */
  const multi = (
    label: string,
    value: string[] | null | undefined,
    options: readonly string[],
    onChange: (v: string[]) => void,
  ) =>
    field(
      label,
      <MultiSelect
        options={options}
        value={value ?? []}
        onChange={onChange}
        disabled={disabled}
      />,
    );

  const pick = (
    label: string,
    value: string | undefined,
    options: string[],
    onChange: (v: string) => void,
  ) =>
    field(
      label,
      <Select value={value ?? ""} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className="h-9 text-sm">
          <SelectValue placeholder="Not set" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>,
    );

  const num = (
    label: string,
    value: number | null | undefined,
    onChange: (v: number | undefined) => void,
    placeholder?: string,
  ) =>
    field(
      label,
      <Input
        type="number"
        inputMode="decimal"
        className="h-9 text-sm"
        placeholder={placeholder}
        value={numText(value)}
        disabled={disabled}
        onChange={(e) => onChange(toNum(e.target.value))}
      />,
    );

  return (
    <aside className="w-80 bg-sidebar border-l border-sidebar-border overflow-y-auto">
      <Tabs defaultValue="config" className="w-full">
        <TabsList className="w-full grid grid-cols-2 bg-background/50">
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="p-4 space-y-6">
          {!strategy && (
            <p className="text-xs text-muted-foreground">
              Open a strategy from the library to configure it.
            </p>
          )}

          {/* --- Suitability ------------------------------------------------ */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Suitability</h3>
            {multi("Suitable Behaviour", form.behaviour, BEHAVIOURS, (v) => set({ behaviour: v }))}
            {multi("Suitable DPD", form.aging, AGING_BUCKETS, (v) => set({ aging: v }))}
            {multi("Suitable Risk", form.riskLevel, RISK_LEVELS, (v) => set({ riskLevel: v }))}
            {multi("Suitable Emotion", form.emotion, EMOTIONS, (v) => set({ emotion: v }))}
            <div className="grid grid-cols-2 gap-2">
              {num("Min loan size", form.minLoan, (v) => set({ minLoan: v }), "0")}
              {num("Max loan size", form.maxLoan, (v) => set({ maxLoan: v }), "Any")}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {num("Min income", form.minIncome, (v) => set({ minIncome: v }), "0")}
              {num("Max income", form.maxIncome, (v) => set({ maxIncome: v }), "Any")}
            </div>
          </section>

          {/* --- Outcomes --------------------------------------------------- */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Outcomes</h3>
            <div className="grid grid-cols-2 gap-2">
              {num("Success %", form.successRate, (v) => set({ successRate: v }), "0")}
              {field(
                "Failure %",
                <Input
                  className="h-9 text-sm bg-muted/50"
                  value={failure === null ? "" : String(failure)}
                  readOnly
                  title="Derived from Success %"
                />,
              )}
            </div>
            {num("Average recovery amount per user", form.averageRecovery, (v) => set({ averageRecovery: v }))}
            {num(
              "Average negotiation interactions (turns)",
              form.averageTurns,
              (v) => set({ averageTurns: v }),
            )}
          </section>

          {/* --- Dialer defaults -------------------------------------------- */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">AI Dialer</h3>
            {field(
              "Dialer Type",
              <div className="flex gap-1.5">
                {DIALER_TYPES.map((type) => (
                  <button
                    key={type}
                    disabled={disabled}
                    onClick={() => setDial({ dialerType: type })}
                    className={`flex-1 rounded-full px-2 py-1.5 text-xs border transition-colors disabled:opacity-50 ${
                      (dialer.dialerType ?? "Predictive") === type
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border text-foreground hover:bg-muted"
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>,
            )}
            {field(
              "Contact times",
              <Input
                className="h-9 text-sm"
                placeholder="9 AM-6 PM"
                value={dialer.contactTimes ?? ""}
                disabled={disabled}
                onChange={(e) => setDial({ contactTimes: e.target.value })}
              />,
            )}
            {multi("Languages", dialer.languages, LANGUAGES, (v) => setDial({ languages: v }))}
            {num("Retry attempts", dialer.retryAttempts, (v) => setDial({ retryAttempts: v }), "3")}
            {pick("If voicemail", dialer.voicemailAction, VOICEMAIL_ACTIONS, (v) =>
              setDial({ voicemailAction: v }),
            )}
            {pick("PTP role", dialer.ptpRole, PTP_ROLES, (v) => setDial({ ptpRole: v }))}
          </section>

          {/* --- Save ------------------------------------------------------- */}
          <div className="sticky bottom-0 -mx-4 px-4 py-3 bg-sidebar border-t border-sidebar-border">
            <Button
              className="w-full"
              onClick={save}
              disabled={disabled || !dirty || saving}
              title={canEdit ? undefined : "Your role cannot edit strategies"}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              {dirty ? "Save configuration" : "Saved"}
            </Button>
          </div>

          {/* --- Risk warnings ---------------------------------------------- */}
          <section>
            <h4 className="text-xs font-medium text-muted-foreground mb-3">Risk Warnings</h4>
            <ul className="space-y-2 mb-4">
              <li className="flex items-center justify-between text-xs">
                <span className="text-foreground">VA failure risk</span>
                <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30">
                  moderate
                </Badge>
              </li>
              <li className="flex items-center justify-between text-xs">
                <span className="text-foreground">SME contactability</span>
                <Badge variant="outline" className="bg-success/20 text-success border-success/30">
                  low
                </Badge>
              </li>
              <li className="flex items-center justify-between text-xs">
                <span className="text-foreground">Payment link fatigue</span>
                <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30">
                  medium
                </Badge>
              </li>
            </ul>

            <div className="pt-3 border-t border-border">
              <Button
                onClick={onDisputeClassifier}
                variant="outline"
                size="sm"
                className="w-full justify-start text-xs hover:bg-info/10 hover:text-info hover:border-info/30 transition-all"
              >
                <FileQuestion className="h-3.5 w-3.5 mr-2" />
                AI Dispute Classifier
              </Button>
            </div>
          </section>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 text-sm">
              Apply to Segment
              <ArrowUpRight className="h-3 w-3 ml-1" />
            </Button>
            <Button className="flex-1 text-sm">Preview Impact</Button>
          </div>
        </TabsContent>

        <TabsContent value="metrics" className="p-0">
          <MetricsCharts />
        </TabsContent>
      </Tabs>
    </aside>
  );
};
