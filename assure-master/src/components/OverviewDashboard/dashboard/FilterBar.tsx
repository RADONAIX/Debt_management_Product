import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface FilterBarProps {
  filters: {
    segment: string;
    region: string;
    productType: string;
    agingBucket: string;
  };
  onFilterChange: (filterKey: string, value: string) => void;
}

export const FilterBar = ({ filters, onFilterChange }: FilterBarProps) => {
  return (
    <div className="flex gap-3 flex-wrap">
      <Select value={filters.segment} onValueChange={(value) => onFilterChange("segment", value)}>
        <SelectTrigger className="w-[180px] bg-dashboard-card border-dashboard-border">
          <SelectValue placeholder="Segment" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Segments</SelectItem>
          <SelectItem value="government">Government</SelectItem>
          <SelectItem value="enterprise">Enterprise</SelectItem>
          <SelectItem value="smb">SMB</SelectItem>
          <SelectItem value="consumer">Consumer</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.region} onValueChange={(value) => onFilterChange("region", value)}>
        <SelectTrigger className="w-[180px] bg-dashboard-card border-dashboard-border">
          <SelectValue placeholder="Region" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Regions</SelectItem>
          <SelectItem value="north">North</SelectItem>
          <SelectItem value="south">South</SelectItem>
          <SelectItem value="east">East</SelectItem>
          <SelectItem value="west">West</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.productType} onValueChange={(value) => onFilterChange("productType", value)}>
        <SelectTrigger className="w-[180px] bg-dashboard-card border-dashboard-border">
          <SelectValue placeholder="Product Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Products</SelectItem>
          <SelectItem value="loan">Loan</SelectItem>
          <SelectItem value="credit">Credit Card</SelectItem>
          <SelectItem value="mortgage">Mortgage</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.agingBucket} onValueChange={(value) => onFilterChange("agingBucket", value)}>
        <SelectTrigger className="w-[180px] bg-dashboard-card border-dashboard-border">
          <SelectValue placeholder="Aging Bucket" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Buckets</SelectItem>
          <SelectItem value="0-30">0-30 days</SelectItem>
          <SelectItem value="31-60">31-60 days</SelectItem>
          <SelectItem value="61-90">61-90 days</SelectItem>
          <SelectItem value="90+">90+ days</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
};
