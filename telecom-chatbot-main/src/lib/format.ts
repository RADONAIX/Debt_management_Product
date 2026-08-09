/**
 * Formatting + masking helpers shared across the app.
 * Sensitive subscriber data is masked by default; unmasking is an explicit,
 * consent-gated user action handled in the subscriber state layer.
 */

export function formatInr(value: number, withDecimals = false): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: withDecimals ? 2 : 0,
    maximumFractionDigits: withDecimals ? 2 : 0,
  }).format(value);
}

export function maskMsisdn(msisdn: string, reveal: boolean): string {
  if (reveal) return msisdn;
  const digits = msisdn.replace(/\s/g, "");
  const tail = digits.slice(-4);
  const head = digits.slice(0, 3);
  return `${head} ${"X".repeat(5)}${tail}`;
}

export function maskId(value: string, reveal: boolean): string {
  if (reveal) return value;
  const parts = value.split("-");
  if (parts.length < 2) return `${value.slice(0, 3)}••••`;
  const last = parts[parts.length - 1] ?? "";
  return `${parts[0]}-••••-${last.slice(-3)}`;
}

export function maskEmail(email: string, reveal: boolean): string {
  if (reveal) return email;
  const [local, domain] = email.split("@");
  if (!local || !domain) return "•••";
  return `${local.slice(0, 2)}${"•".repeat(Math.max(local.length - 2, 3))}@${domain}`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export function formatDateLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  if (isToday) return "Today";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function referenceId(prefix: string): string {
  const stamp = Date.now().toString().slice(-8);
  const rand = Math.floor(Math.random() * 900 + 100);
  return `${prefix}-${stamp}${rand}`;
}

export function percent(used: number, total: number): number {
  if (!total) return 0;
  return Math.min(100, Math.round((used / total) * 100));
}
