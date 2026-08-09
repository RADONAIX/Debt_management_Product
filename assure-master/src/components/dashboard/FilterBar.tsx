import { X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DIMENSIONS, type PortfolioFilters } from "@/data/portfolioStore";

interface FilterBarProps {
  filters: PortfolioFilters;
  onFilterChange: (filterKey: keyof PortfolioFilters, value: string) => void;
  onReset?: () => void;
  /** Accounts matching the current filters, shown so the fork is visible. */
  matchCount?: number;
  totalCount?: number;
  /** Adds the risk-band dropdown. Off by default. */
  showRisk?: boolean;
}

/**
 * Options come from the dataset's own dimension lists, so a filter can never
 * offer a value no account carries.
 */
const FILTERS: {
  key: keyof PortfolioFilters;
  allLabel: string;
  options: string[];
  optional?: boolean;
}[] = [
  { key: "segment", allLabel: "All Segments", options: DIMENSIONS.segments },
  { key: "region", allLabel: "All Regions", options: DIMENSIONS.regions },
  { key: "productType", allLabel: "All Products", options: DIMENSIONS.products },
  { key: "agingBucket", allLabel: "All Buckets", options: DIMENSIONS.buckets },
  { key: "riskLevel", allLabel: "All Risk Bands", options: DIMENSIONS.riskLevels, optional: true },
];

export const FilterBar = ({
  filters,
  onFilterChange,
  onReset,
  matchCount,
  totalCount,
  showRisk = false,
}: FilterBarProps) => {
  const activeCount = Object.values(filters).filter((v) => v && v !== "all").length;
  const visible = FILTERS.filter((f) => !f.optional || showRisk);

  return (
    <div className="flex gap-3 flex-wrap items-center">
      {visible.map(({ key, allLabel, options }) => (
        <Select
          key={key}
          value={filters[key] ?? "all"}
          onValueChange={(value) => onFilterChange(key, value)}
        >
          <SelectTrigger className="w-[190px]">
            <SelectValue placeholder={allLabel} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{allLabel}</SelectItem>
            {options.map((option) => (
              <SelectItem key={option} value={option}>
                {key === "agingBucket" && option !== "Current" ? `${option} DPD` : option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}

      {activeCount > 0 && (
        <>
          {matchCount !== undefined && totalCount !== undefined && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {matchCount.toLocaleString()} of {totalCount.toLocaleString()} accounts
            </span>
          )}
          {onReset && (
            <Button variant="ghost" size="sm" onClick={onReset} className="h-8 gap-1.5">
              <X className="h-3.5 w-3.5" />
              Clear
            </Button>
          )}
        </>
      )}
    </div>
  );
};
