import metrics from "./riskModelMetrics.json";

export interface ModelMetrics {
  modelName: string;
  version: string;
  trainedOn: string;
  trainingRecords: number;
  validationRecords: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  auc: number;
  classes: string[];
  /** Rows are the actual class, columns the predicted one, in `classes` order. */
  matrix: number[][];
}

/**
 * The validation figures for a score's model.
 *
 * Static for now — one block per score in riskModelMetrics.json, to be replaced
 * when a model is next validated. A score with no block of its own falls back
 * to the default rather than showing nothing.
 */
export const metricsFor = (code: string): ModelMetrics => {
  // The file carries a `_comment` key alongside the score blocks, so it is read
  // through `unknown` rather than pretending every value is a metrics block.
  const book = metrics as unknown as Record<string, ModelMetrics>;
  return book[code] ?? book.default;
};
