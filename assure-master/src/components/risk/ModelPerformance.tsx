import { metricsFor } from "@/data/riskModelMetrics";

const pct = (v: number) => `${v.toFixed(2)}%`;

/** Darker green the more of the row's cases land in a cell; the diagonal is right. */
const cellTone = (value: number, rowTotal: number, correct: boolean) => {
  const share = rowTotal ? value / rowTotal : 0;
  if (correct) {
    return share > 0.6 ? "bg-success text-white"
         : share > 0.3 ? "bg-success/70 text-white"
         : "bg-success/40 text-foreground";
  }
  return share > 0.25 ? "bg-destructive/30 text-foreground"
       : share > 0.1 ? "bg-destructive/15 text-foreground"
       : "bg-muted/40 text-muted-foreground";
};

/**
 * How well the model behind a score performs, and where it gets things wrong.
 *
 * Shown in place of the threshold editor when a score is switched to ML: the
 * thresholds do not apply, but the question "should I trust this?" still does.
 */
export const ModelPerformance = ({ code, scoreName, weightPct = 0, isOverall = false }: {
  code: string;
  scoreName: string;
  /** Its weight in Overall Risk, which an ML score does not contribute. */
  weightPct?: number;
  isOverall?: boolean;
}) => {
  const m = metricsFor(code);
  const totals = m.matrix.map((row) => row.reduce((a, b) => a + b, 0));
  const graded = m.matrix.reduce((sum, row, i) => sum + (row[i] ?? 0), 0);
  const judged = totals.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-foreground">{m.modelName}</span>
        <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
          {m.version}
        </span>
        {/* <span className="text-[11px] text-muted-foreground ml-auto">
          validated {new Date(m.trainedOn).toLocaleDateString(undefined, {
            day: "numeric", month: "short", year: "numeric" })}
        </span> */}
      </div>

      {/* Accuracy and the four measures that qualify it */}
      <div className="rounded-lg border border-border divide-y divide-border">
        {[
          ["Model accuracy", pct(m.accuracy), "text-success font-semibold"],
          ["Precision", pct(m.precision), ""],
          ["Recall", pct(m.recall), ""],
          ["F1 score", pct(m.f1), ""],
          ["AUC", pct(m.auc), ""],
        ].map(([label, value, tone]) => (
          <div key={label} className="flex items-center justify-between px-3 py-2">
            <span className="text-sm text-foreground">{label}</span>
            <span className={`text-sm tabular-nums ${tone || "font-medium text-foreground"}`}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Where it agrees with the outcome, and where it does not */}
      <div>
        <div className="flex items-baseline gap-2">
          <h4 className="text-sm font-medium text-foreground">Confusion matrix</h4>
          <span className="text-[11px] text-muted-foreground">
            {graded.toLocaleString()} of {judged.toLocaleString()} validation cases
            placed in the right band
          </span>
        </div>
        <div className="mt-2 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-3 py-2 text-left text-[11px] font-medium text-muted-foreground">
                  Actual ↓ / Predicted →
                </th>
                {m.classes.map((c) => (
                  <th key={c} className="px-3 py-2 text-center text-[11px] font-medium text-muted-foreground">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {m.matrix.map((row, i) => (
                <tr key={m.classes[i] ?? i}>
                  <td className="px-3 py-2 text-[11px] font-medium text-muted-foreground whitespace-nowrap">
                    {m.classes[i] ?? `Class ${i}`}
                  </td>
                  {row.map((value, j) => (
                    <td key={j} className="p-1">
                      <div
                        title={`${value} ${m.classes[i]} case(s) predicted as ${m.classes[j]}`}
                        className={`rounded-md py-2 text-center text-sm font-medium tabular-nums ${
                          cellTone(value, totals[i], i === j)}`}
                      >
                        {value}
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground mt-1.5">
          Green is the diagonal — cases the model put in the band they turned out to
          belong in. Anything off it is a misclassification.
        </p>
      </div>

      {/* <div className="rounded-lg border border-border px-3 py-2 space-y-1.5">
        {[
          ["Trained on", `${m.trainingRecords.toLocaleString()} records`],
          ["Validated against", `${m.validationRecords.toLocaleString()} records`],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-foreground">{value}</span>
          </div>
        ))}
      </div> */}

      {weightPct > 0 && !isOverall && (
        <p className="text-[11px] text-warning">
          Overall Risk is a weighted mean of the rule-based components, so while this
          score is scored by the model its {weightPct}% weight does not feed into it.
          The remaining weights are re-based to add up.
        </p>
      )}

      <p className="text-[11px] text-muted-foreground">
        Turn the switch off to score {scoreName.toLowerCase()} with thresholds instead.
      </p>
    </div>
  );
};

export default ModelPerformance;
