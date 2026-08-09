import type { ReactNode } from "react";

/** One vocabulary for state colour, so every surface in the workspace agrees. */
export const STATUS_TONE: Record<string, string> = {
  ACTIVE: "bg-primary/10 text-primary border-primary/25",
  LEGAL: "bg-purple-500/10 text-purple-600 border-purple-500/25 dark:text-purple-400",
  SETTLED: "bg-success/10 text-success border-success/25",
  RECALLED: "bg-warning/10 text-warning border-warning/25",
  CLOSED: "bg-muted text-muted-foreground border-border",
  SUSPENDED: "bg-destructive/10 text-destructive border-destructive/25",
  UNDER_REVIEW: "bg-warning/10 text-warning border-warning/25",
  TERMINATED: "bg-destructive/15 text-destructive border-destructive/30",
  OPEN: "bg-primary/10 text-primary border-primary/25",
  WON: "bg-success/10 text-success border-success/25",
  LOST: "bg-destructive/10 text-destructive border-destructive/25",
  WITHDRAWN: "bg-muted text-muted-foreground border-border",
};

export const PRIORITY_TONE: Record<string, string> = {
  Low: "bg-muted text-muted-foreground border-border",
  Medium: "bg-info/10 text-info border-info/25",
  High: "bg-warning/10 text-warning border-warning/25",
  Critical: "bg-destructive/10 text-destructive border-destructive/25",
};

export const RISK_TONE: Record<string, string> = {
  Low: "text-success",
  Medium: "text-info",
  High: "text-warning",
  Critical: "text-destructive",
};

/** Statuses read better in the UI as words than as the stored constants. */
export const pretty = (s: string) =>
  s.replace(/_/g, " ").replace(/\w\S*/g, (w) => w[0] + w.slice(1).toLowerCase());

export const Pill = ({
  tone,
  children,
  className = "",
}: {
  tone?: string;
  children: ReactNode;
  className?: string;
}) => (
  <span
    className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap ${
      tone ?? "bg-muted text-muted-foreground border-border"
    } ${className}`}
  >
    {children}
  </span>
);

/** Recovered-vs-placed as a thin track. Reads faster than a percentage alone. */
export const ProgressTrack = ({
  pct,
  className = "",
  tone = "bg-primary",
}: {
  pct: number;
  className?: string;
  tone?: string;
}) => (
  <div className={`h-1.5 w-full rounded-full bg-muted overflow-hidden ${className}`}>
    <div
      className={`h-full rounded-full ${tone} transition-all`}
      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
    />
  </div>
);

export const dateText = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—";

export const dateTimeText = (v?: string | null) =>
  v
    ? new Date(v).toLocaleString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

export const todayISO = () => new Date().toISOString().slice(0, 10);
