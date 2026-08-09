import type { ReactNode } from "react";

export const PRIORITY_TONE: Record<string, string> = {
  Low: "bg-muted text-muted-foreground border-border",
  Medium: "bg-info/10 text-info border-info/25",
  High: "bg-warning/10 text-warning border-warning/25",
  Critical: "bg-destructive/10 text-destructive border-destructive/25",
};

export const CASE_TONE: Record<string, string> = {
  OPEN: "bg-primary/10 text-primary border-primary/25",
  IN_PROGRESS: "bg-info/10 text-info border-info/25",
  ESCALATED: "bg-warning/10 text-warning border-warning/25",
  LEGAL: "bg-purple-500/10 text-purple-600 border-purple-500/25 dark:text-purple-400",
  CLOSED: "bg-muted text-muted-foreground border-border",
};

export const PTP_TONE: Record<string, string> = {
  PENDING: "bg-info/10 text-info border-info/25",
  KEPT: "bg-success/10 text-success border-success/25",
  BROKEN: "bg-destructive/10 text-destructive border-destructive/25",
  CANCELLED: "bg-muted text-muted-foreground border-border",
};

export const RISK_TONE: Record<string, string> = {
  Low: "text-success",
  Medium: "text-info",
  High: "text-warning",
  Critical: "text-destructive",
};

/** Channel / activity icon glyphs, kept as text so no icon map can drift. */
export const ACTIVITY_ICON: Record<string, string> = {
  CALL: "☎",
  SMS: "✉",
  EMAIL: "✉",
  WHATSAPP: "✆",
  CHAT: "✆",
  IVR: "☎",
  VOICEBOT: "☎",
  NOTE: "✎",
  PTP: "✓",
  PAYMENT: "$",
  DISPUTE: "!",
  STATUS_CHANGE: "•",
  ESCALATION: "↑",
  SYSTEM: "•",
};

export const pretty = (s?: string | null) =>
  !s ? "—" : s.replace(/_/g, " ").replace(/\w\S*/g, (w) => w[0] + w.slice(1).toLowerCase());

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

export const dateText = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" }) : "—";

export const dateTimeText = (v?: string | null) =>
  v
    ? new Date(v).toLocaleString("en-US", {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

/** "in 3h", "2d ago" — an SLA is easier to act on as a distance than a date. */
export const relative = (v?: string | null): string => {
  if (!v) return "—";
  const diff = new Date(v).getTime() - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.round(abs / 60000);
  const unit =
    mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)}d`;
  return diff >= 0 ? `in ${unit}` : `${unit} ago`;
};

export const todayISO = () => new Date().toISOString().slice(0, 10);

export const plusDaysISO = (days: number) =>
  new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
