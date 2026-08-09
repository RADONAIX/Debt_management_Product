import {
  TrendingUp,
  Users,
  BarChart3,
  Home,
  FileBarChart2,
  PieChart,
  Grid3x3,
  UserSearch,
  Target,
  Workflow,
  Briefcase,
  HandHeart,
  Bot,
  LayoutDashboard,
  ShieldCheck,
  Headset,
  Inbox,
  GitBranch,
  FlaskConical,
  Wallet,
  Settings2,
  HandCoins,
  FileWarning,
  Scale,
  Building2,
  type LucideIcon,
} from "lucide-react";

/**
 * A section within a screen, listed under its item in the sidebar.
 *
 * Children inherit their parent's permission — they are views of one screen,
 * not separate screens, so there is nothing extra to grant.
 */
export interface NavChild {
  /** Value written to `activeModule`. Namespaced as `<parent>:<view>`. */
  key: string;
  label: string;
  /** One line under the label saying what the view holds. */
  hint?: string;
  icon: LucideIcon;
}

export interface NavItem {
  /** Value written to `activeModule` when this item is selected. */
  key: string;
  label: string;
  icon: LucideIcon;
  /** RBAC permission key from the backend's /auth/my-permissions matrix. */
  perm: string;
  children?: NavChild[];
}

export interface NavGroup {
  /** Identifies the group for expand/collapse state. */
  key: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
}

/**
 * Single source of truth for the sidebar. The shell derives visibility,
 * active state and expansion from this — no nav markup lives in Dashboard.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    key: "overview",
    label: "Portfolio Management",
    icon: TrendingUp,
    items: [
      { key: "dashboard", label: "Portfolio Dashboard", icon: Home, perm: "portfoliodashboard" },
      { key: "risks_segmentation", label: "Risk Grid Analytics", icon: Grid3x3, perm: "riskGridAnalytics" },
      { key: "customer_360", label: "Customer 360", icon: UserSearch, perm: "customer360" },
      {
        key: "report",
        label: "Performance Reports",
        icon: FileBarChart2,
        perm: "performancereports",
        // The four registers, in the order collections work moves through them.
        children: [
          { key: "report:ptp", label: "Promises to Pay", hint: "What was agreed", icon: HandCoins },
          { key: "report:dispute", label: "Disputes", hint: "What is contested", icon: FileWarning },
          { key: "report:legal", label: "Legal Escalations", hint: "What went to law", icon: Scale },
          { key: "report:agency", label: "Agency Escalations", hint: "What was placed out", icon: Building2 },
        ],
      },
    ],
  },
  {
    key: "collections",
    label: "Collection Management",
    icon: Users,
    items: [
      // One screen for the whole collections operation: the agent queue, the
      // defaulter list, cases, promises and disputes, with supervisor and
      // configuration tabs revealed by permission.
      // How collection is going, for whichever desk the signed-in user may see.
      { key: "collections_dashboard", label: "Collections Dashboard", icon: LayoutDashboard, perm: "collectionsDashboard" },
      { key: "collections_workspace", label: "Collections Workspace", icon: Headset, perm: "collectionsWorkspace" },
    ],
  },
  {
    key: "strategy",
    label: "Strategy Management",
    icon: BarChart3,
    items: [
      { key: "risk", label: "Strategy Dashboard", icon: Target, perm: "dunningStrategySummary" },
      { key: "Designer", label: "Strategy Designer", icon: Workflow, perm: "dunningStrategyDesigner" },
      { key: "strategy_versions", label: "Strategy Versions", icon: GitBranch, perm: "strategyVersions" },
      { key: "strategy_simulation", label: "Strategy Simulation", icon: FlaskConical, perm: "strategySimulation" },
    ],
  },
  {
    key: "recovery",
    label: "Recovery Management",
    icon: Wallet,
    items: [
      { key: "recovery_workspace", label: "Recovery Workspace", icon: Wallet, perm: "recoveryWorkspace" },
    ],
  },
  {
    key: "operations",
    label: "Operations Management",
    icon: Settings2,
    items: [
      { key: "risks_analysis", label: "Risk Analytics", icon: PieChart, perm: "riskanalysis" },
      { key: "agent_performance", label: "Agent Performance", icon: HandHeart, perm: "agentPerformance" },
      { key: "ai_guardrails", label: "AI Guardrails", icon: ShieldCheck, perm: "aiGuardrails" },
      { key: "ai_dialer", label: "AI Engagement Center", icon: Bot, perm: "aiEngagementCenter" },
      // { key: "self_service_bi", label: "Self Service BI", icon: BarChart3, perm: "selfServiceBI" },
    ],
  },
];

/** True when `moduleKey` addresses this item or one of its child views. */
export function itemOwnsModule(item: NavItem, moduleKey: string): boolean {
  return item.key === moduleKey || !!item.children?.some((c) => c.key === moduleKey);
}

/** The group that owns a given module key, so the shell can auto-expand it. */
export function groupKeyForModule(moduleKey: string): string | null {
  const group = NAV_GROUPS.find((g) => g.items.some((i) => itemOwnsModule(i, moduleKey)));
  return group?.key ?? null;
}

/** The sidebar label for a module key, child views included. */
export function labelForModule(moduleKey: string): string | null {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (item.key === moduleKey) return item.label;
      const child = item.children?.find((c) => c.key === moduleKey);
      if (child) return child.label;
    }
  }
  return null;
}
