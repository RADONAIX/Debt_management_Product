import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, X, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DIMENSIONS,
  deriveCustomerOptions,
  formatMoney,
  type Account,
  type PortfolioFilters,
} from "@/data/portfolioStore";

interface FilterBarProps {
  accounts: Account[];
  filters: PortfolioFilters;
  onFilterChange: (key: keyof PortfolioFilters, value: string) => void;
  onReset?: () => void;
  matchCount?: number;
  onCustomerSearch?: (customerId: string | null) => void;
  selectedCustomer?: string | null;
  setActiveModule?: (module: string) => void;
  setSelectedCustomerID?: (id: string | null) => void;
}

/**
 * Options are built from the dataset's own dimension lists, so a filter can
 * never offer a value no account carries.
 */
const FILTERS: { key: keyof PortfolioFilters; placeholder: string; allLabel: string; options: string[] }[] = [
  { key: "segment", placeholder: "Segment", allLabel: "All Segments", options: DIMENSIONS.segments },
  { key: "productType", placeholder: "Product Type", allLabel: "All Products", options: DIMENSIONS.products },
  { key: "region", placeholder: "Region", allLabel: "All Regions", options: DIMENSIONS.regions },
  { key: "agingBucket", placeholder: "Aging Bucket", allLabel: "All Buckets", options: DIMENSIONS.buckets },
  { key: "riskLevel", placeholder: "Risk Score", allLabel: "All Risks", options: DIMENSIONS.riskLevels },
];

export const FilterBar = ({
  accounts,
  filters,
  onFilterChange,
  onReset,
  matchCount,
  onCustomerSearch,
  selectedCustomer,
  setActiveModule,
  setSelectedCustomerID,
}: FilterBarProps) => {
  const handleClearSearch = () => onCustomerSearch?.(null);

  const activeFilterCount = FILTERS.filter(({ key }) => (filters[key] ?? "all") !== "all").length;

  const handleViewDetails = () => {
    if (selectedCustomer) {
      setSelectedCustomerID?.(selectedCustomer);
      setActiveModule?.("customer_360");
    }
  };

  // Shared with the 360 switcher: stratified across segment AND risk band so
  // the healthy majority of the book is represented, not just aged balances.
  const customers = deriveCustomerOptions(24, accounts);
  const selectedCustomerData = accounts.find((c) => c.customerId === selectedCustomer);

  return (
    <div className="space-y-4">
      {/* Customer Search */}
      <div className="bg-card rounded-xl border border-border shadow-lg p-4">
        <div className="flex items-center gap-2 mb-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Customer Search</span>
        </div>
        <div className="flex gap-2">
          <Select
            value={selectedCustomer || "all"}
            onValueChange={(value) => onCustomerSearch?.(value === "all" ? null : value)}
          >
            <SelectTrigger className="flex-1 bg-secondary border-border">
              <SelectValue placeholder="Search by Customer ID or Name" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-50 max-h-72">
              <SelectItem value="all">All Customers (Portfolio View)</SelectItem>
              {DIMENSIONS.segments.map((segment) => {
                const inSegment = customers.filter((c) => c.segment === segment);
                if (inSegment.length === 0) return null;
                return (
                  <SelectGroup key={segment}>
                    <SelectLabel>{segment}</SelectLabel>
                    {inSegment.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name} · {formatMoney(customer.outstanding)} · {customer.riskLevel}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                );
              })}
            </SelectContent>
          </Select>
          {selectedCustomer && (
            <>
              <Button variant="default" onClick={handleViewDetails} className="shrink-0">
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </Button>
              <Button variant="outline" size="icon" onClick={handleClearSearch} className="shrink-0">
                <X className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
        {selectedCustomerData && (
          <div className="mt-3 p-3 bg-primary/10 border border-primary/30 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-semibold text-foreground">{selectedCustomerData.name}</span>
                <span className="text-xs text-muted-foreground ml-2">({selectedCustomerData.customerId})</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {formatMoney(selectedCustomerData.outstanding)} · {selectedCustomerData.dpd}d past due
                </span>
              </div>
              <div className="flex gap-2">
                <span className="px-2 py-1 bg-secondary rounded text-xs font-medium">
                  {selectedCustomerData.status}
                </span>
                <span
                  className={`px-2 py-1 rounded text-xs font-medium text-white ${
                    selectedCustomerData.riskLevel === "Critical" || selectedCustomerData.riskLevel === "High"
                      ? "bg-risk-high"
                      : selectedCustomerData.riskLevel === "Medium"
                        ? "bg-risk-medium"
                        : "bg-risk-low"
                  }`}
                >
                  {selectedCustomerData.riskLevel} Risk
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Existing Filters */}
      <div className="flex flex-wrap gap-4 p-4 bg-card rounded-xl border border-border shadow-lg items-center">
        {FILTERS.map(({ key, placeholder, allLabel, options }) => (
          <Select
            key={key}
            value={filters[key] ?? "all"}
            onValueChange={(value) => onFilterChange(key, value)}
          >
            <SelectTrigger className="w-[180px] bg-secondary border-border">
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-50">
              <SelectItem value="all">{allLabel}</SelectItem>
              {options.map((option) => (
                <SelectItem key={option} value={option}>
                  {key === "agingBucket" && option !== "Current" ? `${option} Days` : option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        <div className="flex items-center gap-3 ml-auto">
          {matchCount !== undefined && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {matchCount.toLocaleString()} accounts
            </span>
          )}
          {activeFilterCount > 0 && onReset && (
            <Button variant="ghost" size="sm" onClick={onReset} className="h-8 gap-1.5">
              <X className="h-3.5 w-3.5" />
              Clear {activeFilterCount === 1 ? "filter" : `${activeFilterCount} filters`}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
