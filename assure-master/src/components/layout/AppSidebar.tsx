import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { NAV_GROUPS, itemOwnsModule } from "./navConfig";
import RADONaixLogo from "@/assets/RADONaix-logo.png";

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  activeModule: string;
  onSelectModule: (key: string) => void;
  expandedGroup: string | null;
  onToggleGroup: (key: string | null) => void;
  hasAccess: (perm: string) => boolean;
  notificationCounts?: Record<string, number>;
}

export function AppSidebar({
  collapsed,
  onToggle,
  activeModule,
  onSelectModule,
  expandedGroup,
  onToggleGroup,
  hasAccess,
  notificationCounts = {},
}: AppSidebarProps) {
  // Drop items the user can't reach, then drop groups left empty.
  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => hasAccess(i.perm)),
  })).filter((g) => g.items.length > 0);

  return (
    <aside
      className={`hidden md:flex shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-300 ease-in-out sticky top-0 h-screen self-start z-20 ${
        collapsed ? "w-[72px]" : "w-72"
      }`}
    >
      {/* Brand */}
      <div className="px-4 py-5 border-b border-sidebar-border flex items-center gap-3 relative">
        {/* Collapsed rail is 72px wide with px-4 padding, so the mark has to
            step down to 40px there to avoid overflowing. */}
        <img
          src={RADONaixLogo}
          alt="RADONaix"
          className={`shrink-0 object-contain transition-all duration-300 ${
            collapsed ? "h-10 w-10" : "h-14 w-14"
          }`}
        />
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-semibold tracking-tight text-base leading-none truncate">
              RADONaix Assure+
            </div>
            <div className="text-xs text-sidebar-foreground/60 mt-1 truncate">
              Collections &amp; Debt Management
            </div>
          </div>
        )}
        <button
          onClick={onToggle}
          className="absolute -right-3 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full border border-sidebar-border bg-card shadow-sm hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition z-10"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Modules */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {!collapsed && (
          <div className="px-3 pb-2 text-[10px] tracking-widest text-sidebar-foreground/40 font-semibold">
            MODULES
          </div>
        )}

        {groups.map((group) => {
          const GroupIcon = group.icon;
          const open = expandedGroup === group.key;
          const groupActive = group.items.some((i) => itemOwnsModule(i, activeModule));
          const groupCount = notificationCounts[group.key] ?? 0;

          // Collapsed rail: one icon per group. Clicking expands the sidebar
          // and opens that group, so nothing becomes unreachable.
          if (collapsed) {
            return (
              <button
                key={group.key}
                onClick={() => {
                  onToggle();
                  onToggleGroup(group.key);
                }}
                title={group.label}
                className={`group relative w-full flex items-center justify-center px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  groupActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}
              >
                <GroupIcon className={`h-4 w-4 shrink-0 ${groupActive ? "text-primary" : ""}`} />
                {groupCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-destructive-foreground">
                    {groupCount > 99 ? "99+" : groupCount}
                  </span>
                )}
                <span className="pointer-events-none absolute left-full ml-2 whitespace-nowrap rounded-md bg-foreground text-background text-xs px-2 py-1 opacity-0 group-hover:opacity-100 transition shadow-lg z-50">
                  {group.label}
                </span>
              </button>
            );
          }

          return (
            <div key={group.key}>
              <button
                onClick={() => onToggleGroup(open ? null : group.key)}
                aria-expanded={open}
                className={`group relative w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  groupActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <GroupIcon className={`h-4 w-4 shrink-0 ${groupActive ? "text-primary" : ""}`} />
                  <span className="truncate font-medium">{group.label}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {groupCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                      {groupCount > 99 ? "99+" : groupCount}
                    </span>
                  )}
                  <ChevronDown
                    className={`h-4 w-4 text-sidebar-foreground/50 transition-transform ${
                      open ? "rotate-180" : ""
                    }`}
                  />
                </span>
              </button>

              {open && (
                <div className="mt-1 mb-1 ml-4 pl-3 border-l border-sidebar-border space-y-0.5">
                  {group.items.map((item) => {
                    const ItemIcon = item.icon;
                    const active = activeModule === item.key;
                    // An item with child views expands while any of them is
                    // open, so the register list is only in the way when the
                    // user is somewhere else.
                    const owns = itemOwnsModule(item, activeModule);
                    const itemCount = notificationCounts[item.key] ?? 0;
                    return (
                      <div key={item.key}>
                        <button
                          onClick={() => onSelectModule(item.children?.[0]?.key ?? item.key)}
                          className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] text-left transition-colors ${
                            active || (owns && !item.children)
                              ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                              : owns
                                ? "text-sidebar-foreground font-medium"
                                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                          }`}
                        >
                          <ItemIcon className={`h-3.5 w-3.5 shrink-0 ${owns ? "text-primary" : ""}`} />
                          <span className="flex-1 truncate">{item.label}</span>
                          {itemCount > 0 && (
                            <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                              {itemCount > 99 ? "99+" : itemCount}
                            </span>
                          )}
                        </button>

                        {item.children && owns && (
                          <div className="mt-0.5 mb-1 ml-3.5 pl-3 border-l border-sidebar-border space-y-0.5">
                            {item.children.map((child) => {
                              const ChildIcon = child.icon;
                              const childActive = activeModule === child.key;
                              return (
                                <button
                                  key={child.key}
                                  onClick={() => onSelectModule(child.key)}
                                  className={`w-full flex items-start gap-2 px-2 py-1.5 rounded-md text-left transition-colors ${
                                    childActive
                                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                                  }`}
                                >
                                  <ChildIcon
                                    className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${
                                      childActive ? "text-primary" : ""
                                    }`}
                                  />
                                  <span className="min-w-0">
                                    <span
                                      className={`block truncate text-[13px] ${
                                        childActive ? "font-medium" : ""
                                      }`}
                                    >
                                      {child.label}
                                    </span>
                                    {child.hint && (
                                      <span className="block truncate text-[11px] text-sidebar-foreground/50">
                                        {child.hint}
                                      </span>
                                    )}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className={`px-4 py-4 border-t border-sidebar-border text-[11px] text-sidebar-foreground/50 ${
          collapsed ? "text-center" : ""
        }`}
      >
        {collapsed ? "v1.0" : "v1.0 · Powered by Radon"}
      </div>
    </aside>
  );
}
