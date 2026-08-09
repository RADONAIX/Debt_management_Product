import { useCallback, useEffect, useMemo, useState } from "react";
import { Brain, Database, Loader2, RefreshCw, Table2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiError } from "@/lib/api";
import {
  getMlPredictionSample,
  listRiskScores,
  type MlPredictionColumn,
  type MlPredictionSample,
  type ScoreDefinition,
} from "@/lib/risk";

const formatValue = (value: unknown, column: MlPredictionColumn) => {
  if (value === null || value === undefined || value === "") return "—";

  if (column.dataType.includes("timestamp")) {
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  }
  if (column.dataType === "date") {
    const date = new Date(`${String(value)}T00:00:00`);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
  }
  if (typeof value === "number") {
    return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
  return String(value);
};

export const MlPredictionBrowser = () => {
  const [scores, setScores] = useState<ScoreDefinition[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [sample, setSample] = useState<MlPredictionSample | null>(null);
  const [loadingScores, setLoadingScores] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadScores = useCallback(async () => {
    setLoadingScores(true);
    setError(null);
    try {
      const enabled = (await listRiskScores()).filter(
        (score) => score.isActive && score.mode === "ML",
      );
      setScores(enabled);
      setSelected((current) =>
        current && enabled.some((score) => score.code === current)
          ? current
          : enabled[0]?.code ?? null,
      );
      if (enabled.length === 0) setSample(null);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not load ML scores.");
    } finally {
      setLoadingScores(false);
    }
  }, []);

  useEffect(() => {
    void loadScores();
  }, [loadScores]);

  useEffect(() => {
    if (!selected) return;
    let cancelled = false;
    setLoadingRows(true);
    setError(null);
    getMlPredictionSample(selected, 10)
      .then((result) => {
        if (!cancelled) setSample(result);
      })
      .catch((cause) => {
        if (!cancelled) {
          setSample(null);
          setError(cause instanceof ApiError ? cause.message : "Could not load predictions.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingRows(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selected]);

  const selectedScore = useMemo(
    () => scores.find((score) => score.code === selected) ?? null,
    [scores, selected],
  );

  const refresh = async () => {
    await loadScores();
    if (!selected) return;
    setLoadingRows(true);
    try {
      setSample(await getMlPredictionSample(selected, 10));
      setError(null);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not load predictions.");
    } finally {
      setLoadingRows(false);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="grid min-h-[34rem] lg:grid-cols-[17rem_minmax(0,1fr)]">
        <aside className="border-b border-border bg-muted/20 lg:border-b-0 lg:border-r">
          <div className="border-b border-border px-4 py-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">ML scores</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Scores switched to ML
                </p>
              </div>
              <Badge variant="secondary">{scores.length}</Badge>
            </div>
          </div>

          <nav className="space-y-1 p-2" aria-label="ML prediction scores">
            {loadingScores && (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
            {!loadingScores && scores.length === 0 && (
              <div className="px-3 py-10 text-center">
                <Brain className="mx-auto h-6 w-6 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium text-foreground">No ML scores enabled</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Turn on ML for a score in Scoring Rules.
                </p>
              </div>
            )}
            {scores.map((score) => (
              <button
                key={score.code}
                type="button"
                onClick={() => setSelected(score.code)}
                className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  selected === score.code
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-foreground hover:bg-muted"
                }`}
              >
                <Brain className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{score.name}</span>
                  <span
                    className={`block truncate text-[11px] ${
                      selected === score.code
                        ? "text-primary-foreground/75"
                        : "text-muted-foreground"
                    }`}
                  >
                    {score.code}
                  </span>
                </span>
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0">
          <div className="flex min-h-[73px] items-center justify-between gap-3 border-b border-border px-5 py-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Table2 className="h-4 w-4 shrink-0 text-primary" />
                <h3 className="truncate text-sm font-semibold text-foreground">
                  {selectedScore?.name ?? "ML predictions"}
                </h3>
              </div>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {sample?.tableName
                  ? `${sample.tableName} · latest ${sample.rows.length} prediction rows`
                  : "Select an ML score to view its latest prediction rows"}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void refresh()}
              disabled={loadingScores || loadingRows}
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loadingRows ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {error && (
            <div className="m-5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          {loadingRows && !sample && (
            <div className="flex h-80 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}

          {!loadingRows && selectedScore && sample && !sample.available && (
            <div className="flex h-80 flex-col items-center justify-center px-6 text-center">
              <Database className="h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium text-foreground">No prediction data available</p>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">{sample.message}</p>
            </div>
          )}

          {!loadingRows && sample?.available && sample.rows.length === 0 && (
            <div className="flex h-80 flex-col items-center justify-center px-6 text-center">
              <Database className="h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium text-foreground">Prediction table is empty</p>
              <p className="mt-1 text-xs text-muted-foreground">
                The model has not written any prediction rows yet.
              </p>
            </div>
          )}

          {sample?.available && sample.rows.length > 0 && (
            <div className="max-h-[calc(100vh-20rem)] min-h-[30rem] overflow-auto">
              <table className="w-max min-w-full text-xs">
                <thead className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
                  <tr className="border-b border-border text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                    <th className="sticky left-0 z-20 bg-muted px-3 py-2.5 font-semibold">#</th>
                    {sample.columns.map((column) => (
                      <th key={column.key} className="whitespace-nowrap px-3 py-2.5 font-semibold">
                        {column.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sample.rows.map((row, index) => (
                    <tr key={index} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="sticky left-0 bg-card px-3 py-2.5 text-muted-foreground tabular-nums">
                        {index + 1}
                      </td>
                      {sample.columns.map((column) => {
                        const display = formatValue(row[column.key], column);
                        return (
                          <td
                            key={column.key}
                            title={display}
                            className="max-w-[18rem] whitespace-nowrap px-3 py-2.5 text-foreground"
                          >
                            <span className="block truncate">{display}</span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Card>
  );
};

