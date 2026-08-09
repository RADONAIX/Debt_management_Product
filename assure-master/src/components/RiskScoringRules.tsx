import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Binary,
  Brain,
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Save,
  Play,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { ModelPerformance } from "@/components/risk/ModelPerformance";
import {
  listRiskScores,
  listRiskDrivers,
  updateRiskScore,
  replaceRiskBands,
  getRiskSummary,
  getRiskProfiles,
  recalculateRisk,
  recalculateProfiles,
  getScoringSql,
  type Band,
  type ScoreDefinition,
  type RiskSummary,
  type RiskProfileRow,
} from "@/lib/risk";
import { ApiError } from "@/lib/api";
import { hasPermission } from "@/lib/auth";

const driverLabel = (f?: string | null) =>
  (f ?? "—").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Component risk scores. Each is either rule-based — a ladder of thresholds
 * over one field, editable on the right — or handed to the ML model.
 */
export const RiskScoringRules = () => {
  const canEdit = hasPermission("riskanalysis", "edit");
  const [scores, setScores] = useState<ScoreDefinition[]>([]);
  const [drivers, setDrivers] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [bands, setBands] = useState<Band[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  // The scored output — what the rules actually produced.
  const [summary, setSummary] = useState<RiskSummary | null>(null);
  const [profiles, setProfiles] = useState<RiskProfileRow[]>([]);
  const [running, setRunning] = useState(false);
  const [sql, setSql] = useState<string | null>(null);

  const loadResults = async () => {
    try {
      const [s, p] = await Promise.all([getRiskSummary(), getRiskProfiles()]);
      setSummary(s);
      setProfiles(p);
    } catch {
      /* the scores simply have not been computed yet */
    }
  };

  /** Apply the rules to every subscriber line and store the scores. */
  const runScoring = async () => {
    setRunning(true);
    try {
      const s = await recalculateRisk();
      // The rules also populate subscriber_risk_profile, which drives the
      // grades shown on Subscriber 360.
      const p = await recalculateProfiles();
      setSummary(s);
      setProfiles(await getRiskProfiles());
      toast.success(
        `Scored ${s.scored ?? 0} lines and ${p.profiles} subscriber profiles`,
      );
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Scoring failed");
    } finally {
      setRunning(false);
    }
  };

  const load = async (keep?: string) => {
    setLoading(true);
    try {
      const [rows, fields] = await Promise.all([listRiskScores(), listRiskDrivers()]);
      setScores(rows);
      setDrivers(fields);
      const code = keep ?? selected ?? rows[0]?.code ?? null;
      setSelected(code);
      const active = rows.find((r) => r.code === code);
      setBands(active ? active.bands.map((b) => ({ ...b })) : []);
      setDirty(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not load the scoring rules");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = scores.find((s) => s.code === selected) ?? null;

  const pick = (code: string) => {
    setSelected(code);
    setBands((scores.find((s) => s.code === code)?.bands ?? []).map((b) => ({ ...b })));
    setDirty(false);
  };

  /** The switch: off = rule-based ladder, on = scored by the model. */
  const toggleMode = async (score: ScoreDefinition, ml: boolean) => {
    try {
      await updateRiskScore(score.code, { mode: ml ? "ML" : "RULE" });
      toast.success(`${score.name} is now ${ml ? "ML based" : "rule based"}`);
      await load(score.code);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not switch the mode");
    }
  };

  const setBand = (i: number, patch: Partial<Band>) => {
    setBands((bs) => bs.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
    setDirty(true);
  };

  const addBand = () => {
    setBands((bs) => [...bs, { minValue: 0, score: 50, label: "", bandValue: "Medium" }]);
    setDirty(true);
  };

  /** The ladder is evaluated top to bottom, so order matters. */
  const moveBand = (i: number, delta: number) => {
    const j = i + delta;
    if (j < 0 || j >= bands.length) return;
    setBands((bs) => {
      const next = [...bs];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setDirty(true);
  };

  const removeBand = (i: number) => {
    setBands((bs) => bs.filter((_, idx) => idx !== i));
    setDirty(true);
  };

  const saveBands = async () => {
    if (!current) return;
    setSaving(true);
    try {
      await replaceRiskBands(current.code, bands);
      toast.success("Thresholds saved");
      await load(current.code);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const saveMeta = async (patch: Parameters<typeof updateRiskScore>[1]) => {
    if (!current) return;
    try {
      await updateRiskScore(current.code, patch);
      await load(current.code);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Save failed");
    }
  };

  const bandTone: Record<string, string> = {
    Critical: "bg-destructive/15 text-destructive border-destructive/30",
    High: "bg-destructive/10 text-destructive border-destructive/20",
    Medium: "bg-warning/10 text-warning border-warning/20",
    Low: "bg-success/10 text-success border-success/20",
  };
  const money = (v: number) => `$${Math.round(v).toLocaleString()}`;
  const cell = (v: number | null) =>
    v === null || v === undefined ? "—" : Math.round(v).toString();

  return (
    <div className="space-y-6">
    <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-6">
      {/* --- The scores ---------------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5" />
            Risk Scores
          </CardTitle>
          <CardDescription>
            Switch a score between its rule ladder and the ML model. Select one to edit its
            thresholds.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                  <th className="px-4 py-3 font-semibold">Score</th>
                  <th className="px-4 py-3 font-semibold">Driver</th>
                  <th className="px-4 py-3 font-semibold text-right">Weight</th>
                  <th className="px-4 py-3 font-semibold text-center">Rules</th>
                  <th className="px-4 py-3 font-semibold text-center">ML</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin inline" />
                    </td>
                  </tr>
                )}
                {scores.map((s) => (
                  <tr
                    key={s.code}
                    onClick={() => pick(s.code)}
                    className={`border-b border-border last:border-0 cursor-pointer hover:bg-muted/40 ${
                      s.code === selected ? "bg-primary/5" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{s.name}</div>
                      <div className="text-xs text-muted-foreground">{s.description}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {driverLabel(s.driverField)}
                    </td>
                    <td className="px-4 py-3 text-right">{s.weightPct}%</td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="outline" className={s.mode === "RULE" ? "" : "opacity-40"}>
                        {s.bands.length} bands
                      </Badge>
                    </td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-2">
                        <Switch
                          checked={s.mode === "ML"}
                          disabled={!canEdit}
                          onCheckedChange={(v) => toggleMode(s, v)}
                          aria-label={`${s.name} scoring mode`}
                        />
                        {s.mode === "ML" && <Brain className="h-3.5 w-3.5 text-primary" />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* --- Threshold editor ---------------------------------------------- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {current?.mode === "ML" && <Brain className="h-4 w-4 text-primary" />}
            {current
              ? current.mode === "ML"
                ? `${current.name} model`
                : `${current.name} thresholds`
              : "Thresholds"}
          </CardTitle>
          <CardDescription>
            {current?.mode === "ML"
              ? "Scored by the ML model, so thresholds do not apply. How well it performs:"
              : "Read top to bottom: the first threshold the value meets sets the score."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {current && current.mode === "RULE" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Driver field</Label>
                  <Select
                    value={current.driverField ?? ""}
                    disabled={!canEdit}
                    onValueChange={(v) => saveMeta({ driverField: v })}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {drivers.map((f) => (
                        <SelectItem key={f} value={f}>
                          {driverLabel(f)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Weight in overall (%)</Label>
                  <Input
                    type="number"
                    className="h-9 text-sm"
                    defaultValue={current.weightPct}
                    disabled={!canEdit}
                    onBlur={(e) => {
                      const v = Number(e.target.value);
                      if (v !== current.weightPct) saveMeta({ weightPct: v });
                    }}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border divide-y divide-border">
                <div className="grid grid-cols-[1fr_70px_90px_1fr_84px] gap-2 px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                  <span>When value ≥</span>
                  <span className="text-right">Score</span>
                  <span>Grade</span>
                  <span>Label</span>
                  <span className="text-right">Order</span>
                </div>
                {bands.map((b, i) => (
                  <div key={i} className="grid grid-cols-[1fr_70px_90px_1fr_84px] gap-2 px-3 py-2">
                    <Input
                      className="h-8 text-sm"
                      placeholder="anything else"
                      value={b.minValue ?? ""}
                      disabled={!canEdit}
                      onChange={(e) =>
                        setBand(i, {
                          minValue: e.target.value.trim() === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                    <Input
                      type="number"
                      className="h-8 text-sm text-right"
                      value={b.score}
                      disabled={!canEdit}
                      onChange={(e) => setBand(i, { score: Number(e.target.value) })}
                    />
                    <Input
                      className="h-8 text-sm"
                      placeholder="Low"
                      title="Shown on Subscriber 360 for this band"
                      value={b.bandValue ?? ""}
                      disabled={!canEdit}
                      onChange={(e) => setBand(i, { bandValue: e.target.value })}
                    />
                    <Input
                      className="h-8 text-sm"
                      placeholder="optional"
                      value={b.label ?? ""}
                      disabled={!canEdit}
                      onChange={(e) => setBand(i, { label: e.target.value })}
                    />
                    <div className="flex items-center justify-end gap-0.5">
                      <button
                        onClick={() => moveBand(i, -1)}
                        disabled={!canEdit || i === 0}
                        className="h-8 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground disabled:opacity-30"
                        title="Move up"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => moveBand(i, 1)}
                        disabled={!canEdit || i === bands.length - 1}
                        className="h-8 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground disabled:opacity-30"
                        title="Move down"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => removeBand(i)}
                        disabled={!canEdit}
                        className="h-8 w-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-destructive disabled:opacity-40"
                        title="Remove threshold"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                <span className="text-foreground">Grade</span> is what Subscriber 360 displays for
                this band. Rungs are evaluated top to bottom — use the arrows to order them. Leave a
                threshold blank for the catch-all rung; only one is allowed and it always moves
                to the end, since nothing below it could be reached.
              </p>

              <div className="flex gap-2">
                <Button variant="outline" onClick={addBand} disabled={!canEdit} className="gap-2">
                  <Plus className="h-4 w-4" /> Add threshold
                </Button>
                <Button
                  onClick={saveBands}
                  disabled={!canEdit || !dirty || saving}
                  className="gap-2 flex-1"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save thresholds
                </Button>
              </div>
            </>
          )}

          {current?.mode === "ML" && (
            <ModelPerformance
              code={current.code}
              scoreName={current.name}
              weightPct={current.weightPct}
              isOverall={current.code === "overall_risk"}
            />
          )}
        </CardContent>
      </Card>
    </div>

    {/* --- What the rules produced --------------------------------------- */}
    {/* <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Binary className="w-5 h-5" />
            Scored Portfolio
          </CardTitle>
          <CardDescription>
            The rules above, applied to every subscriber line and written to
            <code className="mx-1 text-xs">customer_schema.risk_profile</code>
            {summary?.computedAt
              ? `— last run ${new Date(summary.computedAt).toLocaleString()}`
              : "— not scored yet"}
          </CardDescription>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={async () => setSql(sql ? null : (await getScoringSql()).sql)}
            className="gap-2"
          >
            {sql ? "Hide SQL" : "View SQL"}
          </Button>
          <Button onClick={runScoring} disabled={!canEdit || running} className="gap-2">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Run scoring
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {summary?.notes?.length ? (
          <p className="text-xs text-muted-foreground">{summary.notes[0]}</p>
        ) : null}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {summary?.bands.map((b) => (
            <div key={b.band} className="rounded-xl border border-border p-3">
              <Badge variant="outline" className={bandTone[b.band] ?? ""}>
                {b.band}
              </Badge>
              <div className="mt-2 text-xl font-semibold text-foreground">{b.lines}</div>
              <div className="text-xs text-muted-foreground">
                avg score {b.avgScore} · {money(b.exposure)} exposed
              </div>
            </div>
          ))}
          {!summary?.bands.length && (
            <p className="text-sm text-muted-foreground col-span-full">
              Run the scoring to populate the portfolio.
            </p>
          )}
        </div>

        {sql && (
          <pre className="rounded-lg border border-border bg-muted/40 p-3 text-[11px] overflow-x-auto max-h-64">
            {sql}
          </pre>
        )}

        {profiles.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground border-b border-border">
                  <th className="px-3 py-2 font-semibold">Subscriber</th>
                  <th className="px-3 py-2 font-semibold text-right">DPD</th>
                  <th className="px-3 py-2 font-semibold text-right">Owed</th>
                  <th className="px-3 py-2 font-semibold text-right">Stress</th>
                  <th className="px-3 py-2 font-semibold text-right">Respon.</th>
                  <th className="px-3 py-2 font-semibold text-right">Coop.</th>
                  <th className="px-3 py-2 font-semibold text-right">Credit</th>
                  <th className="px-3 py-2 font-semibold text-right">Legal</th>
                  <th className="px-3 py-2 font-semibold text-right">Employ.</th>
                  <th className="px-3 py-2 font-semibold text-right">Overall</th>
                  <th className="px-3 py-2 font-semibold">Band</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((r) => (
                  <tr key={r.subscriberNo ?? r.name} className="border-b border-border last:border-0">
                    <td className="px-3 py-2">
                      <div className="font-medium text-foreground">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{r.subscriberNo}</div>
                    </td>
                    <td className="px-3 py-2 text-right">{r.dpd}</td>
                    <td className="px-3 py-2 text-right">{money(r.outstanding)}</td>
                    <td className="px-3 py-2 text-right">{cell(r.financialStress)}</td>
                    <td className="px-3 py-2 text-right">{cell(r.responsibility)}</td>
                    <td className="px-3 py-2 text-right">{cell(r.cooperation)}</td>
                    <td className="px-3 py-2 text-right">{cell(r.creditAwareness)}</td>
                    <td className="px-3 py-2 text-right">{cell(r.legalAwareness)}</td>
                    <td className="px-3 py-2 text-right">{cell(r.employmentStability)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{cell(r.overall)}</td>
                    <td className="px-3 py-2">
                      <Badge variant="outline" className={bandTone[r.band] ?? ""}>
                        {r.band}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card> */}
    </div>
  );
};
