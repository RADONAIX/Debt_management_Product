import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  History,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api";
import {
  createGuardrail,
  deleteGuardrail,
  getGuardrailAudit,
  getGuardrailEvents,
  getGuardrails,
  patchGuardrail,
  type AuditRow,
  type EventRow,
  type GuardrailRow,
  type Guardrails,
} from "@/lib/operations";

const PII_TYPES = [
  "Full Name",
  "Phone Number",
  "Email Address",
  "National ID",
  "Credit Card Number",
  "Address / Postal Code",
];

const LANGUAGES = ["English", "Arabic", "Hindi", "Spanish"];
const TONES = ["Professional", "Friendly", "Neutral", "Empathetic"];
const ESCALATION_ACTIONS = [
  "🚨 Notify Supervisor",
  "👤 Escalate to Human Agent",
  "🤝 Offer live agent",
  "🛑 Alert Legal Team",
];
const SEVERITIES = ["Low", "Medium", "High", "Critical"];

type RuleGroup = keyof Pick<
  Guardrails,
  "inputFilters" | "outputFilters" | "escalationRules" | "promptTemplates"
>;

/** Which list on the response a rule of this kind belongs to. */
const KIND_GROUP: Record<GuardrailRow["kind"], RuleGroup> = {
  INPUT_FILTER: "inputFilters",
  OUTPUT_FILTER: "outputFilters",
  ESCALATION_RULE: "escalationRules",
  PROMPT_TEMPLATE: "promptTemplates",
};

const groupForKind = (kind: GuardrailRow["kind"]): RuleGroup => KIND_GROUP[kind];

const messageFor = (error: unknown, fallback: string) =>
  error instanceof ApiError ? error.message : fallback;

const arrayConfig = (rule: GuardrailRow, key: string): string[] => {
  const value = rule.config[key];
  return Array.isArray(value) ? value.map(String) : [];
};

const textConfig = (rule: GuardrailRow, key: string, fallback = "") => {
  const value = rule.config[key];
  return value == null ? fallback : String(value);
};

const numberConfig = (rule: GuardrailRow, key: string, fallback: number) => {
  const value = Number(rule.config[key]);
  return Number.isFinite(value) ? value : fallback;
};

const when = (iso: string) => {
  const date = new Date(iso);
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1_440) return `${Math.round(minutes / 60)}h ago`;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};

interface EditorState {
  mode: "escalation" | "template";
  row: GuardrailRow;
  primary: string;
  secondary: string;
  severity: string;
}

interface FilterToggleProps {
  rule?: GuardrailRow;
  canEdit: boolean;
  busy: boolean;
  onToggle: (rule: GuardrailRow, enabled: boolean) => void;
  children?: React.ReactNode;
}

const FilterToggle = ({ rule, canEdit, busy, onToggle, children }: FilterToggleProps) => {
  if (!rule) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Switch
          checked={rule.isEnabled}
          disabled={!canEdit || busy}
          onCheckedChange={(checked) => onToggle(rule, checked)}
          aria-label={`${rule.isEnabled ? "Disable" : "Enable"} ${rule.label}`}
        />
        <span className="text-sm font-medium leading-snug text-foreground">
          <span className="mr-1.5" aria-hidden="true">
            {textConfig(rule, "icon", "🛡️")}
          </span>
          {rule.label}
        </span>
        {busy && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
      {children && <div className="ml-[4.15rem] space-y-3">{children}</div>}
    </div>
  );
};

interface CheckGridProps {
  rule: GuardrailRow;
  configKey: string;
  options: string[];
  disabled: boolean;
  onChange: (rule: GuardrailRow, patch: Record<string, unknown>) => void;
}

const CheckGrid = ({ rule, configKey, options, disabled, onChange }: CheckGridProps) => {
  const selected = arrayConfig(rule, configKey);
  return (
    <div className="grid gap-x-7 gap-y-2 sm:grid-cols-2">
      {options.map((option) => (
        <label key={option} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <Checkbox
            checked={selected.includes(option)}
            disabled={disabled}
            onCheckedChange={(checked) => {
              const next = checked
                ? [...selected, option]
                : selected.filter((item) => item !== option);
              onChange(rule, { [configKey]: next });
            }}
          />
          {option}
        </label>
      ))}
    </div>
  );
};

const AiGuardrails = ({ canEdit = true }: { canEdit?: boolean }) => {
  const [data, setData] = useState<Guardrails | null>(null);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [creating, setCreating] = useState(false);

  const [newCondition, setNewCondition] = useState("");
  const [newEscalationAction, setNewEscalationAction] = useState(ESCALATION_ACTIONS[0]);
  const [newIntent, setNewIntent] = useState("");
  const [newTemplate, setNewTemplate] = useState("");
  const [newTone, setNewTone] = useState("Friendly");
  const [editor, setEditor] = useState<EditorState | null>(null);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      const [guardrails, recentEvents, recentAudit] = await Promise.all([
        getGuardrails(),
        getGuardrailEvents({ limit: 40 }),
        getGuardrailAudit(40),
      ]);
      setData(guardrails);
      setEvents(recentEvents);
      setAudit(recentAudit);
    } catch (error) {
      toast.error(messageFor(error, "Could not load AI guardrails."));
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const rulesByCode = useMemo(() => {
    const all = data
      ? [
          ...data.inputFilters,
          ...data.outputFilters,
          ...data.escalationRules,
          ...data.promptTemplates,
        ]
      : [];
    return new Map(all.map((rule) => [rule.code, rule]));
  }, [data]);

  const replaceLocal = useCallback((rule: GuardrailRow, patch: Partial<GuardrailRow>) => {
    setData((current) => {
      if (!current) return current;
      const key = groupForKind(rule.kind);
      const enabledDelta = patch.isEnabled == null || patch.isEnabled === rule.isEnabled
        ? 0
        : patch.isEnabled ? 1 : -1;
      return {
        ...current,
        [key]: current[key].map((item) => item.id === rule.id ? { ...item, ...patch } : item),
        stats: enabledDelta
          ? { ...current.stats, enabled: current.stats.enabled + enabledDelta }
          : current.stats,
      };
    });
  }, []);

  const persist = useCallback(async (
    rule: GuardrailRow,
    patch: Parameters<typeof patchGuardrail>[1],
    localPatch: Partial<GuardrailRow>,
    success?: string,
  ) => {
    setBusyIds((current) => new Set(current).add(rule.id));
    replaceLocal(rule, localPatch);
    try {
      await patchGuardrail(rule.id, patch);
      if (success) toast.success(success);
    } catch (error) {
      toast.error(messageFor(error, "That guardrail change did not save."));
      await load(false);
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(rule.id);
        return next;
      });
    }
  }, [load, replaceLocal]);

  const toggleRule = (rule: GuardrailRow, isEnabled: boolean) => {
    void persist(
      rule,
      { isEnabled, reason: "Changed from AI Guardrails configuration" },
      { isEnabled },
      `${rule.label} ${isEnabled ? "enabled" : "disabled"}.`,
    );
  };

  const patchConfig = (rule: GuardrailRow, configPatch: Record<string, unknown>) => {
    const config = { ...rule.config, ...configPatch };
    void persist(
      rule,
      { config, reason: "Settings updated from AI Guardrails configuration" },
      { config },
    );
  };

  const addEscalation = async () => {
    if (!newCondition.trim()) {
      toast.error("Enter a condition before adding the rule.");
      return;
    }
    setCreating(true);
    try {
      await createGuardrail({
        kind: "ESCALATION_RULE",
        label: newCondition.trim(),
        description: "Custom escalation configured from AI Guardrails.",
        action: "ESCALATE",
        severity: "Medium",
        config: { action: newEscalationAction },
      });
      setNewCondition("");
      setNewEscalationAction(ESCALATION_ACTIONS[0]);
      toast.success("Escalation rule added.");
      await load(false);
    } catch (error) {
      toast.error(messageFor(error, "Could not add the escalation rule."));
    } finally {
      setCreating(false);
    }
  };

  const addTemplate = async () => {
    if (!newIntent.trim() || !newTemplate.trim()) {
      toast.error("Enter both an intent and a response template.");
      return;
    }
    setCreating(true);
    try {
      await createGuardrail({
        kind: "PROMPT_TEMPLATE",
        label: newIntent.trim(),
        description: "Custom response template.",
        action: "ALLOW",
        severity: "Low",
        config: { template: newTemplate.trim(), tone: newTone },
      });
      setNewIntent("");
      setNewTemplate("");
      setNewTone("Friendly");
      toast.success("Response template added.");
      await load(false);
    } catch (error) {
      toast.error(messageFor(error, "Could not add the response template."));
    } finally {
      setCreating(false);
    }
  };

  const openEditor = (row: GuardrailRow) => {
    const isTemplate = row.kind === "PROMPT_TEMPLATE";
    setEditor({
      mode: isTemplate ? "template" : "escalation",
      row,
      primary: row.label,
      secondary: textConfig(row, isTemplate ? "template" : "action"),
      severity: row.severity,
    });
  };

  const saveEditor = async () => {
    if (!editor || !editor.primary.trim() || !editor.secondary.trim()) return;
    const configKey = editor.mode === "template" ? "template" : "action";
    const config = { ...editor.row.config, [configKey]: editor.secondary.trim() };
    await persist(
      editor.row,
      {
        label: editor.primary.trim(),
        severity: editor.severity,
        config,
        reason: "Edited from AI Guardrails configuration",
      },
      {
        label: editor.primary.trim(),
        severity: editor.severity,
        config,
      },
      `${editor.primary.trim()} saved.`,
    );
    setEditor(null);
  };

  const removeRule = async (rule: GuardrailRow) => {
    setBusyIds((current) => new Set(current).add(rule.id));
    try {
      await deleteGuardrail(rule.id);
      toast.success(`${rule.label} removed.`);
      await load(false);
    } catch (error) {
      toast.error(messageFor(error, "Could not remove that item."));
    } finally {
      setBusyIds((current) => {
        const next = new Set(current);
        next.delete(rule.id);
        return next;
      });
    }
  };

  if (loading && !data) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="flex min-h-[320px] flex-col items-center justify-center gap-3 p-8 text-center">
        <ShieldCheck className="h-10 w-10 text-muted-foreground" />
        <div>
          <h2 className="font-semibold">Guardrails could not be loaded</h2>
          <p className="mt-1 text-sm text-muted-foreground">Check the backend connection and try again.</p>
        </div>
        <Button variant="outline" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Try again
        </Button>
      </Card>
    );
  }

  const input = (code: string) => rulesByCode.get(code);
  const output = (code: string) => rulesByCode.get(code);
  const pii = input("block_pii");
  const language = input("language_restrictions");
  const length = input("limit_question_length");
  const time = input("time_of_day");
  const sensitive = input("mask_sensitive");
  const tone = output("tone_enforcement");
  const phrases = output("disallowed_phrases");

  const enabled = data.stats.enabled;
  const total = data.stats.rules;

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Guardrails"
        description="Control what reaches the model, what reaches customers, and when conversations are handed to your team."
        actions={
          <>
            <Badge variant="outline" className="h-8 gap-1.5 px-3 font-medium">
              <span className="h-2 w-2 rounded-full bg-success" />
              {enabled} of {total} enabled
            </Badge>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </>
        }
      />

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Card className="rounded-2xl p-6 shadow-sm">
          <div className="mb-6 border-b border-border pb-4">
            <h2 className="text-lg font-semibold text-foreground">A. Input Filters</h2>
            <p className="mt-1 text-xs text-muted-foreground">Inspect and protect customer messages before they reach the model.</p>
          </div>

          <div className="space-y-6">
            <FilterToggle
              rule={input("block_profanity")}
              canEdit={canEdit}
              busy={busyIds.has(input("block_profanity")?.id ?? -1)}
              onToggle={toggleRule}
            />

            <FilterToggle
              rule={pii}
              canEdit={canEdit}
              busy={busyIds.has(pii?.id ?? -1)}
              onToggle={toggleRule}
            >
              {pii && (
                <CheckGrid
                  rule={pii}
                  configKey="types"
                  options={PII_TYPES}
                  disabled={!canEdit || busyIds.has(pii.id)}
                  onChange={patchConfig}
                />
              )}
            </FilterToggle>

            <FilterToggle
              rule={language}
              canEdit={canEdit}
              busy={busyIds.has(language?.id ?? -1)}
              onToggle={toggleRule}
            >
              {language && (
                <>
                  <CheckGrid
                    rule={language}
                    configKey="allowed"
                    options={LANGUAGES}
                    disabled={!canEdit || busyIds.has(language.id)}
                    onChange={patchConfig}
                  />
                  <label className="flex cursor-pointer items-center gap-3 text-sm text-foreground">
                    <Switch
                      checked={Boolean(language.config.auto_block_mixed)}
                      disabled={!canEdit || busyIds.has(language.id)}
                      onCheckedChange={(checked) => patchConfig(language, { auto_block_mixed: checked })}
                    />
                    Auto Block Mixed Language Inputs
                  </label>
                  <div className="max-w-[270px] space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Language Detection Model</Label>
                    <Select
                      value={textConfig(language, "model", "Basic")}
                      disabled={!canEdit || busyIds.has(language.id)}
                      onValueChange={(value) => patchConfig(language, { model: value })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Basic">Basic</SelectItem>
                        <SelectItem value="Advanced">Advanced</SelectItem>
                        <SelectItem value="Multilingual">Multilingual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </FilterToggle>

            <FilterToggle
              rule={length}
              canEdit={canEdit}
              busy={busyIds.has(length?.id ?? -1)}
              onToggle={toggleRule}
            >
              {length && (
                <>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {[
                      ["Min Characters", "min_chars", 10],
                      ["Max Characters", "max_chars", 300],
                      ["Max Words", "max_words", 50],
                    ].map(([label, key, fallback]) => (
                      <div key={String(key)} className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">{String(label)}</Label>
                        <Input
                          type="number"
                          min={0}
                          key={`${key}-${numberConfig(length, String(key), Number(fallback))}`}
                          defaultValue={numberConfig(length, String(key), Number(fallback))}
                          disabled={!canEdit || busyIds.has(length.id)}
                          onBlur={(event) => patchConfig(length, {
                            [String(key)]: Math.max(0, Number(event.target.value) || 0),
                          })}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="max-w-sm space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Exceeding Action</Label>
                    <Select
                      value={textConfig(length, "exceed_action", "Block Input")}
                      disabled={!canEdit || busyIds.has(length.id)}
                      onValueChange={(value) => patchConfig(length, { exceed_action: value })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Block Input">Block Input</SelectItem>
                        <SelectItem value="Truncate Input">Truncate Input</SelectItem>
                        <SelectItem value="Warn Customer">Warn Customer</SelectItem>
                        <SelectItem value="Escalate">Escalate</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
            </FilterToggle>

            <FilterToggle
              rule={time}
              canEdit={canEdit}
              busy={busyIds.has(time?.id ?? -1)}
              onToggle={toggleRule}
            >
              {time?.isEnabled && (
                <div className="grid max-w-sm grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Allowed from</Label>
                    <Input
                      type="time"
                      defaultValue={textConfig(time, "from", "09:00")}
                      disabled={!canEdit || busyIds.has(time.id)}
                      onBlur={(event) => patchConfig(time, { from: event.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Allowed until</Label>
                    <Input
                      type="time"
                      defaultValue={textConfig(time, "to", "21:00")}
                      disabled={!canEdit || busyIds.has(time.id)}
                      onBlur={(event) => patchConfig(time, { to: event.target.value })}
                    />
                  </div>
                </div>
              )}
            </FilterToggle>

            <FilterToggle
              rule={sensitive}
              canEdit={canEdit}
              busy={busyIds.has(sensitive?.id ?? -1)}
              onToggle={toggleRule}
            >
              {sensitive?.isEnabled && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Regex patterns, one per line</Label>
                  <Textarea
                    key={arrayConfig(sensitive, "patterns").join("\n")}
                    defaultValue={arrayConfig(sensitive, "patterns").join("\n")}
                    className="min-h-[88px] font-mono text-xs"
                    disabled={!canEdit || busyIds.has(sensitive.id)}
                    onBlur={(event) => patchConfig(sensitive, {
                      patterns: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean),
                    })}
                  />
                </div>
              )}
            </FilterToggle>
          </div>
        </Card>

        <Card className="rounded-2xl p-6 shadow-sm">
          <div className="mb-6 border-b border-border pb-4">
            <h2 className="text-lg font-semibold text-foreground">B. Output Filters</h2>
            <p className="mt-1 text-xs text-muted-foreground">Validate, rewrite, or block model responses before customers see them.</p>
          </div>

          <div className="space-y-6">
            {[
              "remove_financial",
              "detect_hallucinations",
              "detect_bias_toxicity",
            ].map((code) => {
              const rule = output(code);
              return (
                <FilterToggle
                  key={code}
                  rule={rule}
                  canEdit={canEdit}
                  busy={busyIds.has(rule?.id ?? -1)}
                  onToggle={toggleRule}
                />
              );
            })}

            <FilterToggle
              rule={tone}
              canEdit={canEdit}
              busy={busyIds.has(tone?.id ?? -1)}
              onToggle={toggleRule}
            >
              {tone && (
                <CheckGrid
                  rule={tone}
                  configKey="tones"
                  options={TONES}
                  disabled={!canEdit || busyIds.has(tone.id)}
                  onChange={patchConfig}
                />
              )}
            </FilterToggle>

            <FilterToggle
              rule={output("rewrite_unsafe")}
              canEdit={canEdit}
              busy={busyIds.has(output("rewrite_unsafe")?.id ?? -1)}
              onToggle={toggleRule}
            />

            <FilterToggle
              rule={phrases}
              canEdit={canEdit}
              busy={busyIds.has(phrases?.id ?? -1)}
              onToggle={toggleRule}
            >
              {phrases?.isEnabled && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Disallowed phrases, one per line</Label>
                  <Textarea
                    key={arrayConfig(phrases, "phrases").join("\n")}
                    defaultValue={arrayConfig(phrases, "phrases").join("\n")}
                    className="min-h-[112px]"
                    disabled={!canEdit || busyIds.has(phrases.id)}
                    onBlur={(event) => patchConfig(phrases, {
                      phrases: event.target.value.split("\n").map((item) => item.trim()).filter(Boolean),
                    })}
                  />
                </div>
              )}
            </FilterToggle>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden rounded-2xl shadow-sm">
        <div className="border-b border-border px-6 py-5">
          <h2 className="text-lg font-semibold">Escalation Conditions & Actions</h2>
          <p className="mt-1 text-xs text-muted-foreground">Route sensitive or repeatedly blocked conversations to the right human team.</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[52%] px-6">Condition</TableHead>
              <TableHead>Action</TableHead>
              <TableHead className="w-[96px] text-center">Active</TableHead>
              {canEdit && <TableHead className="w-[96px]"><span className="sr-only">Actions</span></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.escalationRules.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell className="px-6 font-medium">{rule.label}</TableCell>
                <TableCell>{textConfig(rule, "action", rule.action)}</TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={rule.isEnabled}
                    disabled={!canEdit || busyIds.has(rule.id)}
                    onCheckedChange={(checked) => toggleRule(rule, checked)}
                    aria-label={`${rule.isEnabled ? "Disable" : "Enable"} ${rule.label}`}
                  />
                </TableCell>
                {canEdit && (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditor(rule)}>
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Edit {rule.label}</span>
                      </Button>
                      {!rule.isSystem && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={busyIds.has(rule.id)}
                          onClick={() => void removeRule(rule)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Delete {rule.label}</span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {canEdit && (
          <div className="grid gap-3 border-t border-border bg-muted/20 p-5 md:grid-cols-[minmax(240px,1.2fr)_minmax(220px,0.9fr)_auto]">
            <Input
              value={newCondition}
              onChange={(event) => setNewCondition(event.target.value)}
              placeholder="Condition"
              disabled={creating}
            />
            <Select value={newEscalationAction} onValueChange={setNewEscalationAction} disabled={creating}>
              <SelectTrigger><SelectValue placeholder="Select Action" /></SelectTrigger>
              <SelectContent>
                {ESCALATION_ACTIONS.map((action) => <SelectItem key={action} value={action}>{action}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => void addEscalation()} disabled={creating}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Add
            </Button>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden rounded-2xl shadow-sm">
        <div className="border-b border-border px-6 py-5">
          <h2 className="text-lg font-semibold">Custom Prompt & Response Templates</h2>
          <p className="mt-1 text-xs text-muted-foreground">Use placeholders such as {"{{name}}"}, {"{{balance}}"}, and {"{{expiry_date}}"}.</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[23%] px-6">Intent</TableHead>
              <TableHead>Template</TableHead>
              <TableHead className="w-[140px]">Tone</TableHead>
              <TableHead className="w-[96px] text-center">Active</TableHead>
              {canEdit && <TableHead className="w-[96px]"><span className="sr-only">Actions</span></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.promptTemplates.map((rule) => (
              <TableRow key={rule.id}>
                <TableCell className="px-6 font-medium">{rule.label}</TableCell>
                <TableCell className="max-w-[520px] whitespace-normal leading-relaxed">
                  {textConfig(rule, "template")}
                </TableCell>
                <TableCell>{textConfig(rule, "tone", "Neutral")}</TableCell>
                <TableCell className="text-center">
                  <Switch
                    checked={rule.isEnabled}
                    disabled={!canEdit || busyIds.has(rule.id)}
                    onCheckedChange={(checked) => toggleRule(rule, checked)}
                    aria-label={`${rule.isEnabled ? "Disable" : "Enable"} ${rule.label}`}
                  />
                </TableCell>
                {canEdit && (
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditor(rule)}>
                        <Pencil className="h-3.5 w-3.5" />
                        <span className="sr-only">Edit {rule.label}</span>
                      </Button>
                      {!rule.isSystem && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          disabled={busyIds.has(rule.id)}
                          onClick={() => void removeRule(rule)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span className="sr-only">Delete {rule.label}</span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {canEdit && (
          <div className="grid gap-3 border-t border-border bg-muted/20 p-5 lg:grid-cols-[minmax(180px,0.7fr)_minmax(320px,1.2fr)_180px_auto]">
            <Input value={newIntent} onChange={(event) => setNewIntent(event.target.value)} placeholder="Intent" disabled={creating} />
            <Input value={newTemplate} onChange={(event) => setNewTemplate(event.target.value)} placeholder="Template" disabled={creating} />
            <Select value={newTone} onValueChange={setNewTone} disabled={creating}>
              <SelectTrigger><SelectValue placeholder="Tone" /></SelectTrigger>
              <SelectContent>{TONES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" onClick={() => void addTemplate()} disabled={creating}>
              {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Add
            </Button>
          </div>
        )}
      </Card>

      <details className="group rounded-2xl border border-border bg-card shadow-sm">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-6 py-4">
          <Activity className="h-4 w-4 text-primary" />
          <span className="font-semibold">Recent guardrail activity</span>
          <span className="text-xs text-muted-foreground">{data.stats.events30d} events in the last 30 days</span>
          <span className="ml-auto text-xs text-muted-foreground group-open:hidden">Show</span>
          <span className="ml-auto hidden text-xs text-muted-foreground group-open:inline">Hide</span>
        </summary>
        <div className="grid border-t border-border xl:grid-cols-2">
          <div className="min-w-0 border-b border-border xl:border-b-0 xl:border-r">
            <div className="flex items-center gap-2 px-5 py-3 text-sm font-medium">
              <Activity className="h-4 w-4 text-muted-foreground" /> What the rules caught
            </div>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Rule</TableHead><TableHead>Outcome</TableHead><TableHead>Channel</TableHead><TableHead>When</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {events.slice(0, 8).map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">{event.label ?? event.code}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{event.outcome}</Badge></TableCell>
                    <TableCell>{event.channel.replace(/_/g, " ")}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{when(event.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 px-5 py-3 text-sm font-medium">
              <History className="h-4 w-4 text-muted-foreground" /> Change history
            </div>
            <Table>
              <TableHeader>
                <TableRow><TableHead>Rule</TableHead><TableHead>Change</TableHead><TableHead>By</TableHead><TableHead>When</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {audit.slice(0, 8).map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.code.replace(/_/g, " ")}</TableCell>
                    <TableCell>{row.action.toLowerCase()}</TableCell>
                    <TableCell>{row.actor ?? "System"}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{when(row.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </details>

      <Dialog open={Boolean(editor)} onOpenChange={(open) => !open && setEditor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editor?.mode === "template" ? "Edit response template" : "Edit escalation rule"}</DialogTitle>
            <DialogDescription>Changes are saved to Assure+_MS and recorded in the guardrail audit history.</DialogDescription>
          </DialogHeader>
          {editor && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>{editor.mode === "template" ? "Intent" : "Condition"}</Label>
                <Input value={editor.primary} onChange={(event) => setEditor({ ...editor, primary: event.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>{editor.mode === "template" ? "Template" : "Action"}</Label>
                {editor.mode === "template" ? (
                  <Textarea value={editor.secondary} onChange={(event) => setEditor({ ...editor, secondary: event.target.value })} />
                ) : (
                  <Select value={editor.secondary} onValueChange={(value) => setEditor({ ...editor, secondary: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ESCALATION_ACTIONS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
              {editor.mode === "template" ? (
                <div className="space-y-1.5">
                  <Label>Tone</Label>
                  <Select
                    value={textConfig(editor.row, "tone", "Neutral")}
                    onValueChange={(value) => setEditor({
                      ...editor,
                      row: { ...editor.row, config: { ...editor.row.config, tone: value } },
                    })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TONES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Severity</Label>
                  <Select value={editor.severity} onValueChange={(value) => setEditor({ ...editor, severity: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SEVERITIES.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditor(null)}>Cancel</Button>
            <Button onClick={() => void saveEditor()} disabled={!editor?.primary.trim() || !editor?.secondary.trim()}>
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AiGuardrails;
