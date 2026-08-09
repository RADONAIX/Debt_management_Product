/**
 * The icon each workflow node type is drawn with.
 *
 * A node's `type` is the label of the Component Library tile it was dragged
 * from, so this map is keyed by exactly those labels — the canvas and the
 * sidebar therefore always show the same icon for the same component.
 * Keep it in step with `Designer/components/LeftSidebar.tsx`.
 */

import {
  AlertCircle,
  Bell,
  Bot,
  Brain,
  CheckCircle,
  Clock,
  CreditCard,
  Database,
  FileCheck,
  FileQuestion,
  FileSignature,
  FileText,
  FileWarning,
  FolderOpen,
  GitMerge,
  HelpCircle,
  Link,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  Play,
  Radio,
  Scale,
  Send,
  ShieldAlert,
  Tag,
  Target,
  TrendingDown,
  TrendingUp,
  XCircle,
  type LucideIcon,
} from "lucide-react";

export const NODE_ICONS: Record<string, LucideIcon> = {
  // Channels
  "SMS": MessageSquare,
  "Email": Mail,
  "WhatsApp": MessageCircle,
  "IVR": Phone,
  "AI Dialer": Target,
  "VA": FileText,
  "Push Notification": Bell,
  "Payment Link": Link,
  // Actions
  "Create PTP": CreditCard,
  "Send Payment Link": Send,
  "Generate Settlement": FileCheck,
  "Create Case": FolderOpen,
  "Credit Validation": CheckCircle,
  "Legal Pre-Notice": FileWarning,
  "Close Case": XCircle,
  "Label Node": Tag,
  // Conditions
  "No Response?": HelpCircle,
  "PTP Broken?": XCircle,
  "If Dispute Detected": AlertCircle,
  "If High-Risk Customer": ShieldAlert,
  "If Payment Posted": CheckCircle,
  "If >90 Bucket": TrendingDown,
  // AI
  "AI Next-Best-Action": Brain,
  "AI Recommend Channel": Radio,
  "AI Recommend Time-of-Day": Clock,
  "AI Dispute Classifier": FileQuestion,
  "AI Risk Score": TrendingUp,
  "AI PTP Probability": Scale,
  // RPA
  "RPA: Dispute Validation": Bot,
  "RPA: PTP Update": FileSignature,
  "RPA: Case Closure": XCircle,
  "RPA: Document Extraction": FileText,
  "RPA: ERP Sync": Database,
  "RPA: Workflow Trigger": GitMerge,
  // Canvas-only
  "start": Play,
};

/** Older saved workflows use these type names; map them onto current tiles. */
const LEGACY_ALIASES: Record<string, string> = {
  "Creds PTP": "Create PTP",
  "Send Payment": "Send Payment Link",
  "AI Next Best Action": "AI Next-Best-Action",
  "AI Proactive/Discovery": "AI Risk Score",
};

/** The icon for a node type, falling back to a neutral one when unknown. */
export function iconForType(type: string | undefined): LucideIcon {
  if (!type) return MessageSquare;
  return (
    NODE_ICONS[type] ??
    NODE_ICONS[LEGACY_ALIASES[type] ?? ""] ??
    MessageSquare
  );
}
