import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ReportFilters } from "@/lib/reports";

/** A dropdown the tab wants shown, bound to one key of the filter object. */
export interface SelectFilter {
  key: keyof ReportFilters;
  label: string;
  options: string[];
}

interface ReportFilterBarProps {
  filters: ReportFilters;
  onChange: (key: keyof ReportFilters, value: string | undefined) => void;
  onReset: () => void;
  /** Which dropdowns this register supports — they differ per tab. */
  selects: SelectFilter[];
  searchPlaceholder: string;
  /** Labels the date range means on this tab, e.g. "Promised date". */
  dateLabel: string;
}

const ALL = "__all__";

export function ReportFilterBar({
  filters,
  onChange,
  onReset,
  selects,
  searchPlaceholder,
  dateLabel,
}: ReportFilterBarProps) {
  const active = Object.values(filters).filter(Boolean).length;

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={filters.search ?? ""}
            onChange={(e) => onChange("search", e.target.value || undefined)}
            placeholder={searchPlaceholder}
            className="pl-8 h-9"
          />
        </div>

        {selects.map((s) => (
          <Select
            key={String(s.key)}
            value={(filters[s.key] as string | undefined) ?? ALL}
            onValueChange={(v) => onChange(s.key, v === ALL ? undefined : v)}
          >
            <SelectTrigger className="h-9 w-[170px]">
              <SelectValue placeholder={s.label} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All {s.label}</SelectItem>
              {s.options.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">{dateLabel}</span>
        <Input
          type="date"
          value={filters.dateFrom ?? ""}
          onChange={(e) => onChange("dateFrom", e.target.value || undefined)}
          className="h-9 w-[150px]"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <Input
          type="date"
          value={filters.dateTo ?? ""}
          onChange={(e) => onChange("dateTo", e.target.value || undefined)}
          className="h-9 w-[150px]"
        />

        {active > 0 && (
          <Button variant="ghost" size="sm" onClick={onReset} className="h-9 ml-auto">
            <X className="h-3.5 w-3.5 mr-1" />
            Clear {active} filter{active === 1 ? "" : "s"}
          </Button>
        )}
      </div>
    </div>
  );
}
