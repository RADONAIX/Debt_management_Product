import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Buttons, filters or badges shown on the right of the title row. */
  actions?: ReactNode;
}

/**
 * The single title block for every module screen.
 *
 * Screens render inside the shell's `<main className="px-6 py-6">`, so they must
 * NOT add their own `min-h-screen`, background or outer padding — wrap the screen
 * in `<div className="space-y-6">` and lead with this component.
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between border-b border-border pb-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
